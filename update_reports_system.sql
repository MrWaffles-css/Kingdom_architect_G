-- Update Reports System & Attack Logic
-- Adds: Damage tracking, Hostage taking (Citizens), and detailed report logs.

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
    
    v_turn_cost int := 100;
    v_casualty_count bigint;
    v_vault_cap bigint;
    v_kill_rate float;
    v_loss_rate float;
    v_report_id uuid;
    v_raw_casualties float;
    
    -- Steal Calculation Variables
    v_gold_stolen_total bigint;
    v_stolen_from_main bigint;
    v_stolen_from_vault bigint;
    
    v_raw_steal_percent int;
    v_main_steal_percent float;
    
    v_raw_vault_steal_level int;
    v_vault_steal_percent float;

    -- New Stats
    v_damage_dealt bigint;
    v_damage_taken bigint;
    v_citizens_stolen bigint;
    v_attacker_citizens_gained bigint;
    v_defender_citizens_lost bigint;
    
    -- Battle Power
    v_attacker_power bigint;
    v_defender_power bigint;

BEGIN
    v_attacker_id := auth.uid();

    -- Self-attack check
    IF v_attacker_id = target_id THEN
        RAISE EXCEPTION 'Cannot attack yourself';
    END IF;

    -- Generate resources for both
    PERFORM public.generate_resources_for_user(v_attacker_id);
    PERFORM public.generate_resources_for_user(target_id);

    -- Get Stats
    SELECT * INTO v_attacker_stats FROM public.user_stats WHERE id = v_attacker_id;
    SELECT * INTO v_attacker_profile FROM public.profiles WHERE id = v_attacker_id;
    
    IF v_attacker_stats.turns < v_turn_cost THEN
        RAISE EXCEPTION 'Not enough turns (Need 100)';
    END IF;

    SELECT * INTO v_defender_stats FROM public.user_stats WHERE id = target_id;
    SELECT * INTO v_defender_profile FROM public.profiles WHERE id = target_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target not found';
    END IF;

    -- Deduct Turns
    UPDATE public.user_stats SET turns = turns - v_turn_cost WHERE id = v_attacker_id;

    -- Calculate Battle Power (Simulated Damage)
    -- Power = Stat + (Random Variance of +/- 10%)
    v_attacker_power := floor(v_attacker_stats.attack * (0.9 + random() * 0.2));
    v_defender_power := floor(v_defender_stats.defense * (0.9 + random() * 0.2));
    
    -- Ensure non-zero for report purposes
    If v_attacker_power < 1 THEN v_attacker_power := 1; END IF;
    If v_defender_power < 1 THEN v_defender_power := 1; END IF;

    -- Assign to Damage Variables (Attacker Deals 'Attacker Power', Takes 'Defender Power' roughly)
    v_damage_dealt := v_attacker_power;
    v_damage_taken := v_defender_power;

    -- Combat Logic (Compare Raw Stats primarily, or Power? Using Original logic: Raw Stats comparison for consistency, but logging Power as Damage)
    -- Original logic: IF v_attacker_stats.attack > v_defender_stats.defense
    -- We stick to deterministic stat compare to avoid user frustration if they have higher stats but lose to RNG.
    -- However, damage numbers will show variance.
    
    IF v_attacker_stats.attack > v_defender_stats.defense THEN
        -- === VICTORY ===
        
        -- 1. Main Gold Steal (Base 50% + 5% per level)
        v_raw_steal_percent := COALESCE(v_attacker_stats.research_gold_steal, 0);
        v_main_steal_percent := 0.50 + (v_raw_steal_percent * 0.05);
        IF v_main_steal_percent > 1.0 THEN v_main_steal_percent := 1.0; END IF;
        
        v_stolen_from_main := FLOOR(v_defender_stats.gold * v_main_steal_percent);
        
        -- 2. Vault Gold Steal (5% per level, Base 0%)
        v_raw_vault_steal_level := COALESCE(v_attacker_stats.research_vault_steal, 0);
        v_vault_steal_percent := v_raw_vault_steal_level * 0.05;
        IF v_vault_steal_percent > 1.0 THEN v_vault_steal_percent := 1.0; END IF;
        
        v_stolen_from_vault := FLOOR(v_defender_stats.vault * v_vault_steal_percent);
        
        -- Total Stolen
        v_gold_stolen_total := v_stolen_from_main + v_stolen_from_vault;

        -- 3. Hostage Taking (Citizens) - New Mechanic
        -- Steal 0.5% of citizens on win, minimum 0.
        v_citizens_stolen := FLOOR(v_defender_stats.citizens * 0.005);
        IF v_citizens_stolen < 0 THEN v_citizens_stolen := 0; END IF;
        
        -- Calculate Defenders Casualties
        v_kill_rate := random() * 0.02;
        v_raw_casualties := COALESCE(v_defender_stats.defense_soldiers, 0) * v_kill_rate;
        v_casualty_count := floor(v_raw_casualties) + (CASE WHEN random() < (v_raw_casualties - floor(v_raw_casualties)) THEN 1 ELSE 0 END);
        
        -- Calculate Attacker Vault Cap
        v_vault_cap := public.calculate_vault_capacity(COALESCE(v_attacker_stats.vault_level, 0));
        
        -- Update Attacker (Gain Gold + Citizens)
        UPDATE public.user_stats
        SET vault = LEAST(vault + v_gold_stolen_total, v_vault_cap),
            experience = experience + 100,
            citizens = citizens + v_citizens_stolen
        WHERE id = v_attacker_id;

        -- Update Defender (Lose Gold + Citizens + Soldiers)
        -- Ensure citizens don't drop below 1
        UPDATE public.user_stats
        SET gold = GREATEST(0, gold - v_stolen_from_main),
            vault = GREATEST(0, vault - v_stolen_from_vault),
            defense_soldiers = GREATEST(0, defense_soldiers - v_casualty_count),
            citizens = GREATEST(1, citizens - v_citizens_stolen)
        WHERE id = target_id;
        
        PERFORM public.recalculate_user_stats(target_id);

        -- Report for Attacker [Victory]
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            v_attacker_id, 
            'attack_win', 
            'Victory against ' || COALESCE(v_defender_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_defender_profile.username, 'Unknown'),
                'gold_stolen', v_gold_stolen_total,
                'stolen_from_main', v_stolen_from_main,
                'stolen_from_vault', v_stolen_from_vault,
                'main_steal_percent', v_main_steal_percent,
                'vault_steal_percent', v_vault_steal_percent,
                'enemy_killed', v_casualty_count,
                'citizens_stolen', v_citizens_stolen,
                'damage_dealt', v_damage_dealt,
                'damage_taken', v_damage_taken,
                'success', true
            )
        ) RETURNING id INTO v_report_id;

        -- Report for Defender [Defeat]
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            target_id, 
            'defend_loss', 
            'Defeat against ' || COALESCE(v_attacker_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_attacker_profile.username, 'Unknown'),
                'gold_lost', v_gold_stolen_total,
                'lost_from_main', v_stolen_from_main,
                'lost_from_vault', v_stolen_from_vault,
                'soldiers_lost', v_casualty_count,
                'citizens_lost', v_citizens_stolen,
                'damage_dealt', v_damage_taken, -- Defender dealt what attacker took
                'damage_taken', v_damage_dealt,  -- Defender took what attacker dealt
                'success', false
            )
        );

        -- Achievements
        PERFORM public.track_daily_attack();
        IF v_gold_stolen_total > 0 THEN
            PERFORM public.track_daily_gold_stolen(v_gold_stolen_total);
        END IF;
        PERFORM public.check_rank_achievements(v_attacker_id);

        RETURN json_build_object(
            'success', true,
            'report_id', v_report_id,
            'gold_stolen', v_gold_stolen_total,
            'citizens_stolen', v_citizens_stolen,
            'casualties', v_casualty_count,
            'message', 'Victory! You stole ' || v_gold_stolen_total || ' gold.'
        );

    ELSE
        -- === DEFEAT ===
        
        v_loss_rate := 0.05 + (random() * 0.05);
        v_raw_casualties := COALESCE(v_attacker_stats.attack_soldiers, 0) * v_loss_rate;
        v_casualty_count := floor(v_raw_casualties) + (CASE WHEN random() < (v_raw_casualties - floor(v_raw_casualties)) THEN 1 ELSE 0 END);

        UPDATE public.user_stats
        SET attack_soldiers = GREATEST(0, attack_soldiers - v_casualty_count)
        WHERE id = v_attacker_id;
        
        PERFORM public.recalculate_user_stats(v_attacker_id);

        -- Report for Attacker [Defeat]
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            v_attacker_id, 
            'attack_loss', 
            'Defeat against ' || COALESCE(v_defender_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_defender_profile.username, 'Unknown'),
                'soldiers_lost', v_casualty_count,
                'damage_dealt', v_damage_dealt,
                'damage_taken', v_damage_taken,
                'success', false
            )
        ) RETURNING id INTO v_report_id;

        -- Report for Defender [Victory]
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            target_id, 
            'defend_win', 
            'Victory against ' || COALESCE(v_attacker_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_attacker_profile.username, 'Unknown'),
                'attacker_casualties', v_casualty_count,
                'damage_dealt', v_damage_taken, -- Defender dealt
                'damage_taken', v_damage_dealt,  -- Defender took
                'success', true
            )
        );

        RETURN json_build_object(
            'success', false,
            'report_id', v_report_id,
            'gold_stolen', 0,
            'casualties', v_casualty_count,
            'message', 'Defeat! Your forces were repelled.'
        );
    END IF;
END;
$$;
