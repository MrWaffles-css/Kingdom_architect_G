-- Improve Attack Report Details
-- 1. Restore Hostage Capture Logic (was overwritten)
-- 2. Added Attacker vs Defender Power to Report
-- 3. Detailed Casualty Breakdown

CREATE OR REPLACE FUNCTION public.attack_player(
    target_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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
    
    -- Config variables
    v_min_kill_rate numeric;
    v_max_kill_rate numeric;
    v_min_loss_rate numeric;
    v_max_loss_rate numeric;
    v_min_miner_kill_rate numeric;
    v_max_miner_kill_rate numeric;
    v_min_citizen_kill_rate numeric;
    v_max_citizen_kill_rate numeric;
    
    -- Calculated values
    v_steal_pct float;
    v_miner_kill_rate float;
    v_citizen_kill_rate float;
    v_miners_killed bigint := 0;
    v_citizens_killed bigint := 0;
    
    -- Hostage Variables
    v_hostages_captured bigint := 0;
    v_hostage_rate float;
    
    -- Power Comparison
    v_attacker_power bigint;
    v_defender_power bigint;
BEGIN
    v_attacker_id := auth.uid();
    
    -- Load Configs
    v_min_kill_rate := public.get_game_config_variable('defense_kill_rate_min', 0.0);
    v_max_kill_rate := public.get_game_config_variable('defense_kill_rate_max', 0.02);
    v_min_loss_rate := public.get_game_config_variable('attack_loss_rate_min', 0.05);
    v_max_loss_rate := public.get_game_config_variable('attack_loss_rate_max', 0.10);
    v_min_miner_kill_rate := public.get_game_config_variable('miner_kill_rate_min', 0.00);
    v_max_miner_kill_rate := public.get_game_config_variable('miner_kill_rate_max', 0.05);
    v_min_citizen_kill_rate := public.get_game_config_variable('citizen_kill_rate_min', 0.00);
    v_max_citizen_kill_rate := public.get_game_config_variable('citizen_kill_rate_max', 0.05);

    -- Self-attack check
    IF v_attacker_id = target_id THEN
        RAISE EXCEPTION 'Cannot attack yourself';
    END IF;

    -- Generate resources for both attacker and defender FIRST
    PERFORM public.generate_resources_for_user(v_attacker_id);
    PERFORM public.generate_resources_for_user(target_id);

    -- Get Attacker Stats & Profile (AFTER resource generation)
    SELECT * INTO v_attacker_stats FROM public.user_stats WHERE id = v_attacker_id;
    SELECT * INTO v_attacker_profile FROM public.profiles WHERE id = v_attacker_id;

    -- Check Turns
    IF v_attacker_stats.turns < v_turn_cost THEN
        RAISE EXCEPTION 'Not enough turns (Need 100)';
    END IF;

    -- Get Defender Stats & Profile (AFTER resource generation)
    SELECT * INTO v_defender_stats FROM public.user_stats WHERE id = target_id;
    SELECT * INTO v_defender_profile FROM public.profiles WHERE id = target_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target not found';
    END IF;

    -- Deduct Turns
    UPDATE public.user_stats
    SET turns = turns - v_turn_cost
    WHERE id = v_attacker_id;
    
    -- Set Power Values
    v_attacker_power := v_attacker_stats.attack;
    v_defender_power := v_defender_stats.defense;

    -- Combat Logic
    IF v_attacker_power > v_defender_power THEN
        -- === VICTORY ===
        
        -- 1. Calculate Gold Stolen based on Research
        SELECT steal_percent INTO v_steal_pct 
        FROM public.gold_steal_configs 
        WHERE level = COALESCE(v_attacker_stats.research_gold_steal, 0);

        -- Fallback
        IF v_steal_pct IS NULL THEN
            SELECT steal_percent INTO v_steal_pct 
            FROM public.gold_steal_configs 
            ORDER BY level DESC LIMIT 1;
            IF v_steal_pct IS NULL THEN v_steal_pct := 0.5; END IF;
        END IF;

        v_gold_stolen := floor(v_defender_stats.gold * v_steal_pct);
        
        -- 2. Calculate Defender Soldier Casualties
        v_kill_rate := v_min_kill_rate + (random() * (v_max_kill_rate - v_min_kill_rate));
        v_raw_casualties := COALESCE(v_defender_stats.defense_soldiers, 0) * v_kill_rate;
        v_casualty_count := floor(v_raw_casualties) + (CASE WHEN random() < (v_raw_casualties - floor(v_raw_casualties)) THEN 1 ELSE 0 END);
        
        -- 3. Calculate Civilian Casualties (Miners & Citizens)
        -- Miners
        v_miner_kill_rate := v_min_miner_kill_rate + (random() * (v_max_miner_kill_rate - v_min_miner_kill_rate));
        v_miners_killed := floor(COALESCE(v_defender_stats.miners, 0) * v_miner_kill_rate);
        
        -- Citizens
        v_citizen_kill_rate := v_min_citizen_kill_rate + (random() * (v_max_citizen_kill_rate - v_min_citizen_kill_rate));
        v_citizens_killed := floor(COALESCE(v_defender_stats.citizens, 0) * v_citizen_kill_rate);

        -- 4. Calculate Hostage Capture (From killed soldiers)
        -- Rate: 10% per research level (0 - 100%)
        v_hostage_rate := (COALESCE(v_attacker_stats.research_hostage_convert, 0) * 10)::float / 100.0;
        
        IF v_hostage_rate > 0 AND v_casualty_count > 0 THEN
            v_hostages_captured := floor(v_casualty_count * v_hostage_rate);
        END IF;

        -- 5. Calculate Vault Capacity for Attacker
        v_vault_cap := public.calculate_vault_capacity(COALESCE(v_attacker_stats.vault_level, 0));
        
        -- 6. Update Attacker (Gain Gold to Vault, Gain Hostages)
        UPDATE public.user_stats
        SET vault = LEAST(vault + v_gold_stolen, v_vault_cap),
            experience = experience + 100,
            hostages = COALESCE(hostages, 0) + v_hostages_captured
        WHERE id = v_attacker_id;

        -- 7. Update Defender (Lose Gold, Soldiers, Miners, Citizens)
        UPDATE public.user_stats
        SET gold = GREATEST(0, gold - v_gold_stolen),
            defense_soldiers = GREATEST(0, defense_soldiers - v_casualty_count),
            miners = GREATEST(0, miners - v_miners_killed),
            citizens = GREATEST(0, citizens - v_citizens_killed)
        WHERE id = target_id;
        
        -- Recalculate defender's stats
        PERFORM public.recalculate_user_stats(target_id);

        -- 8. Report for Attacker
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            v_attacker_id, 
            'attack_win', 
            'Victory against ' || COALESCE(v_defender_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_defender_profile.username, 'Unknown'),
                'gold_stolen', v_gold_stolen,
                'enemy_killed', v_casualty_count,
                'miners_killed', v_miners_killed,
                'citizens_killed', v_citizens_killed,
                'hostages_captured', v_hostages_captured,
                'steal_percent', v_steal_pct,
                'attacker_power', v_attacker_power,
                'defender_power', v_defender_power
            )
        );

        -- 9. Report for Defender
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            target_id, 
            'defend_loss', 
            'Defeat against ' || COALESCE(v_attacker_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_attacker_profile.username, 'Unknown'),
                'gold_lost', v_gold_stolen,
                'soldiers_lost', v_casualty_count,
                'miners_lost', v_miners_killed,
                'citizens_lost', v_citizens_killed,
                'hostages_taken', v_hostages_captured,
                'attacker_power', v_attacker_power,
                'defender_power', v_defender_power
            )
        );

        -- === OPTIMIZATION: Internal Achievement Tracking ===
        PERFORM public.track_daily_attack();
        IF v_gold_stolen > 0 THEN
            PERFORM public.track_daily_gold_stolen(v_gold_stolen);
        END IF;
        PERFORM public.check_rank_achievements(v_attacker_id);
        -- ===================================================

        RETURN json_build_object(
            'success', true,
            'gold_stolen', v_gold_stolen,
            'casualties', v_casualty_count,
            'miners_killed', v_miners_killed,
            'citizens_killed', v_citizens_killed,
            'hostages_captured', v_hostages_captured,
            'attacker_power', v_attacker_power,
            'defender_power', v_defender_power,
            'steal_percent', v_steal_pct,
            'message', 'Victory! You breached their defenses and stole ' || v_gold_stolen || ' gold.'
        );

    ELSE
        -- === DEFEAT ===
        
        -- Calculate Attacker Casualties using Dynamic Configuration
        v_loss_rate := v_min_loss_rate + (random() * (v_max_loss_rate - v_min_loss_rate));
        
        v_raw_casualties := COALESCE(v_attacker_stats.attack_soldiers, 0) * v_loss_rate;
        v_casualty_count := floor(v_raw_casualties) + (CASE WHEN random() < (v_raw_casualties - floor(v_raw_casualties)) THEN 1 ELSE 0 END);

        -- Update Attacker (Lose Soldiers)
        UPDATE public.user_stats
        SET attack_soldiers = GREATEST(0, attack_soldiers - v_casualty_count)
        WHERE id = v_attacker_id;
        
        -- Recalculate attacker's stats
        PERFORM public.recalculate_user_stats(v_attacker_id);

        -- Report for Attacker
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            v_attacker_id, 
            'attack_loss', 
            'Defeat against ' || COALESCE(v_defender_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_defender_profile.username, 'Unknown'),
                'soldiers_lost', v_casualty_count,
                'attacker_power', v_attacker_power,
                'defender_power', v_defender_power
            )
        );

        -- Report for Defender
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            target_id, 
            'defend_win', 
            'Victory against ' || COALESCE(v_attacker_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_attacker_profile.username, 'Unknown'),
                'attacker_casualties', v_casualty_count,
                'attacker_power', v_attacker_power,
                'defender_power', v_defender_power
            )
        );

        RETURN json_build_object(
            'success', false,
            'gold_stolen', 0,
            'casualties', v_casualty_count,
            'attacker_power', v_attacker_power,
            'defender_power', v_defender_power,
            'message', 'Defeat! Your forces were repelled.'
        );
    END IF;
END;
$$;
