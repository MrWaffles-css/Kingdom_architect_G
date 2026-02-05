-- Combine Dynamic Gold Stealing AND Hostage Stealing Logic
CREATE OR REPLACE FUNCTION public.attack_player(
    target_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attacker_id uuid;
    v_attacker_stats record;
    v_defender_stats record;
    v_defender_profile record;
    v_attacker_profile record;
    v_gold_stolen bigint;
    v_turn_cost int := 100;
    v_casualty_count bigint;
    v_stat_loss bigint;
    v_raw_casualties float;
    v_vault_cap bigint;
    v_kill_rate float;
    v_loss_rate float;
    v_report_id uuid; 
    
    -- Gold Steal Config Variables
    v_gold_steal_percent float;
    v_raw_steal_level int;

    -- Hostage Variables
    v_hostages_captured bigint := 0;
    v_hostage_rate float;
    v_hostage_config record;
    v_hostage_level int;
    v_hostage_level_config jsonb;
    v_hostage_bonus_percent int;
BEGIN
    v_attacker_id := auth.uid();

    -- Self-attack check
    IF v_attacker_id = target_id THEN
        RAISE EXCEPTION 'Cannot attack yourself';
    END IF;

    -- Generate resources for both attacker and defender
    PERFORM public.generate_resources_for_user(v_attacker_id);
    PERFORM public.generate_resources_for_user(target_id);

    -- Get Attacker Stats & Profile
    SELECT * INTO v_attacker_stats FROM public.user_stats WHERE id = v_attacker_id;
    SELECT * INTO v_attacker_profile FROM public.profiles WHERE id = v_attacker_id;

    -- Check Turns
    IF v_attacker_stats.turns < v_turn_cost THEN
        RAISE EXCEPTION 'Not enough turns (Need 100)';
    END IF;

    -- Get Defender Stats & Profile
    SELECT * INTO v_defender_stats FROM public.user_stats WHERE id = target_id;
    SELECT * INTO v_defender_profile FROM public.profiles WHERE id = target_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target not found';
    END IF;

    -- Deduct Turns
    UPDATE public.user_stats
    SET turns = turns - v_turn_cost
    WHERE id = v_attacker_id;

    -- Combat Logic
    IF v_attacker_stats.attack > v_defender_stats.defense THEN
        -- === VICTORY ===
        
        -- 1. GOLD STEAL CALCULATION
        v_raw_steal_level := COALESCE(v_attacker_stats.research_gold_steal, 0);

        -- Fetch from gold_steal_configs table
        SELECT steal_percent INTO v_gold_steal_percent
        FROM public.gold_steal_configs
        WHERE level = v_raw_steal_level;

        -- Fallback: if level exceeds config, use max configured level
        IF v_gold_steal_percent IS NULL THEN
             SELECT steal_percent INTO v_gold_steal_percent
             FROM public.gold_steal_configs
             ORDER BY level DESC
             LIMIT 1;
        END IF;

        -- Absolute fallback
        v_gold_steal_percent := COALESCE(v_gold_steal_percent, 0.50);

        -- Cap at 100% just in case
        IF v_gold_steal_percent > 1.0 THEN v_gold_steal_percent := 1.0; END IF;

        -- Calculate Gold Stolen based on Defender's Gold
        v_gold_stolen := FLOOR(v_defender_stats.gold * v_gold_steal_percent);
        
        
        -- 2. CASUALTY CALCULATION
        -- Calculate Defender Casualties (0-2% of Defense Soldiers)
        v_kill_rate := random() * 0.02;
        v_raw_casualties := COALESCE(v_defender_stats.defense_soldiers, 0) * v_kill_rate;
        v_casualty_count := floor(v_raw_casualties) + (CASE WHEN random() < (v_raw_casualties - floor(v_raw_casualties)) THEN 1 ELSE 0 END);
        
        -- 3. HOSTAGE CALCULATION
        -- Fetch Config for Rate
        SELECT * INTO v_hostage_config FROM public.hostage_configs WHERE id = 1;
        
        -- Only proceed if hostage config exists
        IF FOUND THEN
            v_hostage_level := COALESCE(v_attacker_stats.research_hostage_convert, 0);
            
            v_hostage_level_config := v_hostage_config.levels -> v_hostage_level;
            -- Fallback
            IF v_hostage_level_config IS NULL AND jsonb_array_length(v_hostage_config.levels) > 0 THEN
                v_hostage_level_config := v_hostage_config.levels -> (jsonb_array_length(v_hostage_config.levels) - 1);
            END IF;

            v_hostage_bonus_percent := COALESCE((v_hostage_level_config ->> 'bonus')::int, 0);
            
            -- Rate: Explicit % from config
            v_hostage_rate := v_hostage_bonus_percent::float / 100.0;
            
            IF v_hostage_rate > 0 AND v_casualty_count > 0 THEN
                v_hostages_captured := floor(v_casualty_count * v_hostage_rate);
            END IF;
        END IF;

        -- 4. UPDATE ATTACKER
        -- Calculate Vault Capacity for Attacker
        v_vault_cap := public.calculate_vault_capacity(COALESCE(v_attacker_stats.vault_level, 0));
        
        UPDATE public.user_stats
        SET vault = LEAST(vault + v_gold_stolen, v_vault_cap),
            experience = experience + 100,
            hostages = COALESCE(hostages, 0) + v_hostages_captured
        WHERE id = v_attacker_id;

        -- 5. UPDATE DEFENDER
        UPDATE public.user_stats
        SET gold = GREATEST(0, gold - v_gold_stolen),
            defense_soldiers = GREATEST(0, defense_soldiers - v_casualty_count)
        WHERE id = target_id;
        
        -- Recalculate defender's stats after losing soldiers
        PERFORM public.recalculate_user_stats(target_id);

        -- 6. RECORD REPORTS
        -- Report for Attacker
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            v_attacker_id, 
            'attack_win', 
            'Victory against ' || COALESCE(v_defender_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_defender_profile.username, 'Unknown'),
                'gold_stolen', v_gold_stolen,
                'enemy_killed', v_casualty_count,
                'steal_percent', (v_gold_steal_percent * 100),
                'citizens_stolen', v_hostages_captured
            )
        ) RETURNING id INTO v_report_id; 

        -- Report for Defender
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            target_id, 
            'defend_loss', 
            'Defeat against ' || COALESCE(v_attacker_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_attacker_profile.username, 'Unknown'),
                'gold_lost', v_gold_stolen,
                'soldiers_lost', v_casualty_count
            )
        );

        -- Achievement Tracking
        PERFORM public.track_daily_attack();
        IF v_gold_stolen > 0 THEN
            PERFORM public.track_daily_gold_stolen(v_gold_stolen);
        END IF;
        PERFORM public.check_rank_achievements(v_attacker_id);

        -- 7. RETURN RESULT
        RETURN json_build_object(
            'success', true,
            'report_id', v_report_id, 
            'gold_stolen', v_gold_stolen,
            'casualties', v_casualty_count,
            'hostages_captured', v_hostages_captured,
            'steal_percent', v_gold_steal_percent,
            'message', 'Victory! You breached their defenses and killed ' || v_casualty_count || ' defense soldiers.'
        );

    ELSE
        -- === DEFEAT (Unchanged) ===
        
        v_loss_rate := 0.05 + (random() * 0.05);
        v_raw_casualties := COALESCE(v_attacker_stats.attack_soldiers, 0) * v_loss_rate;
        v_casualty_count := floor(v_raw_casualties) + (CASE WHEN random() < (v_raw_casualties - floor(v_raw_casualties)) THEN 1 ELSE 0 END);

        UPDATE public.user_stats
        SET attack_soldiers = GREATEST(0, attack_soldiers - v_casualty_count)
        WHERE id = v_attacker_id;
        
        PERFORM public.recalculate_user_stats(v_attacker_id);

        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            v_attacker_id, 
            'attack_loss', 
            'Defeat against ' || COALESCE(v_defender_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_defender_profile.username, 'Unknown'),
                'soldiers_lost', v_casualty_count
            )
        ) RETURNING id INTO v_report_id;

        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            target_id, 
            'defend_win', 
            'Victory against ' || COALESCE(v_attacker_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_attacker_profile.username, 'Unknown'),
                'attacker_casualties', v_casualty_count
            )
        );

        RETURN json_build_object(
            'success', false,
            'report_id', v_report_id, 
            'gold_stolen', 0,
            'casualties', v_casualty_count,
            'hostages_captured', 0,
            'message', 'Defeat! Your forces were repelled.'
        );
    END IF;
END;
$$;
