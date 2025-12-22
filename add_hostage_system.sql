-- =====================================================
-- HOSTAGE SYSTEM IMPLEMENTATION
-- =====================================================

-- 1. Add columns to user_stats if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_stats' AND column_name = 'hostages') THEN
        ALTER TABLE public.user_stats ADD COLUMN hostages BIGINT DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_stats' AND column_name = 'research_hostage_convert') THEN
        ALTER TABLE public.user_stats ADD COLUMN research_hostage_convert INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. Function to upgrade Hostage Conversion Research
CREATE OR REPLACE FUNCTION public.upgrade_research_hostage_convert()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_level int;
    v_gold_cost bigint;
    v_stats record;
    v_available_gold bigint;
BEGIN
    v_user_id := auth.uid();
    
    -- Get current stats
    SELECT * INTO v_stats FROM public.user_stats WHERE id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    v_current_level := COALESCE(v_stats.research_hostage_convert, 0);

    -- Max level check
    IF v_current_level >= 10 THEN
        RAISE EXCEPTION 'Already at max level';
    END IF;

    -- Cost Table
    v_gold_cost := CASE 
        WHEN v_current_level = 0 THEN 100000        -- To Lvl 1
        WHEN v_current_level = 1 THEN 200000        -- To Lvl 2
        WHEN v_current_level = 2 THEN 500000        -- To Lvl 3
        WHEN v_current_level = 3 THEN 750000        -- To Lvl 4
        WHEN v_current_level = 4 THEN 1000000       -- To Lvl 5
        WHEN v_current_level = 5 THEN 2000000       -- To Lvl 6
        WHEN v_current_level = 6 THEN 10000000      -- To Lvl 7
        WHEN v_current_level = 7 THEN 50000000      -- To Lvl 8
        WHEN v_current_level = 8 THEN 100000000     -- To Lvl 9
        WHEN v_current_level = 9 THEN 1000000000    -- To Lvl 10
        ELSE 999999999999
    END;

    -- Calculate available gold
    v_available_gold := v_stats.gold;
    IF v_stats.use_vault_gold THEN
        v_available_gold := v_available_gold + v_stats.vault;
    END IF;

    IF v_available_gold < v_gold_cost THEN
        RAISE EXCEPTION 'Not enough Gold (Need %)', v_gold_cost;
    END IF;

    -- Deduct Gold
    IF v_stats.use_vault_gold THEN
        -- Deduct from gold first, then vault
        IF v_stats.gold >= v_gold_cost THEN
            UPDATE public.user_stats SET gold = gold - v_gold_cost WHERE id = v_user_id;
        ELSE
            UPDATE public.user_stats 
            SET gold = 0, 
                vault = vault - (v_gold_cost - v_stats.gold) 
            WHERE id = v_user_id;
        END IF;
    ELSE
        UPDATE public.user_stats SET gold = gold - v_gold_cost WHERE id = v_user_id;
    END IF;

    -- Increment Level
    UPDATE public.user_stats
    SET research_hostage_convert = v_current_level + 1
    WHERE id = v_user_id;

    -- Return updated stats
    RETURN (SELECT row_to_json(us) FROM public.user_stats us WHERE id = v_user_id);
END;
$$;

-- 3. Function to convert hostages to citizens
CREATE OR REPLACE FUNCTION public.convert_hostages_to_citizens(p_quantity INTEGER)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_stats record;
    v_total_cost bigint;
    v_available_gold bigint;
    v_qty_to_convert int;
BEGIN
    v_user_id := auth.uid();
    v_qty_to_convert := p_quantity;

    -- Get stats
    SELECT * INTO v_stats FROM public.user_stats WHERE id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Validate quantity
    IF v_qty_to_convert <= 0 THEN
        RAISE EXCEPTION 'Invalid quantity';
    END IF;

    IF v_stats.hostages < v_qty_to_convert THEN
        RAISE EXCEPTION 'Not enough hostages';
    END IF;

    -- Calculate Cost (2,000 Gold per hostage)
    v_total_cost := v_qty_to_convert * 2000;

    -- Calculate available gold
    v_available_gold := v_stats.gold;
    IF v_stats.use_vault_gold THEN
        v_available_gold := v_available_gold + v_stats.vault;
    END IF;

    IF v_available_gold < v_total_cost THEN
        RAISE EXCEPTION 'Not enough Gold';
    END IF;

    -- Deduct Gold
    IF v_stats.use_vault_gold THEN
        IF v_stats.gold >= v_total_cost THEN
            UPDATE public.user_stats SET gold = gold - v_total_cost WHERE id = v_user_id;
        ELSE
            UPDATE public.user_stats 
            SET gold = 0, 
                vault = vault - (v_total_cost - v_stats.gold) 
            WHERE id = v_user_id;
        END IF;
    ELSE
        UPDATE public.user_stats SET gold = gold - v_total_cost WHERE id = v_user_id;
    END IF;

    -- Update Population (Remove hostages, add citizens)
    UPDATE public.user_stats
    SET hostages = hostages - v_qty_to_convert,
        citizens = citizens + v_qty_to_convert
    WHERE id = v_user_id;

    -- Recalculate stats (though citizens don't affect combat stats directly, good practice)
    PERFORM public.recalculate_user_stats(v_user_id);

    RETURN (SELECT row_to_json(us) FROM public.user_stats us WHERE id = v_user_id);
END;
$$;

-- 4. Update Attack Logic to include Hostage Capture
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
    v_raw_casualties float;
    v_vault_cap bigint;
    v_kill_rate float;
    v_loss_rate float;
    -- Hostage variables
    v_hostage_chance float;
    v_hostages_captured bigint;
BEGIN
    v_attacker_id := auth.uid();

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

    -- Combat Logic
    IF v_attacker_stats.attack > v_defender_stats.defense THEN
        -- === VICTORY ===
        v_gold_stolen := v_defender_stats.gold;
        
        -- Calculate Defender Casualties (0-2% of Defense Soldiers)
        v_kill_rate := random() * 0.02;
        v_raw_casualties := COALESCE(v_defender_stats.defense_soldiers, 0) * v_kill_rate;
        v_casualty_count := floor(v_raw_casualties) + (CASE WHEN random() < (v_raw_casualties - floor(v_raw_casualties)) THEN 1 ELSE 0 END);
        
        -- === HOSTAGE CALCULATION ===
        -- Level 0 = 0%
        -- Level 1 = 10% ... Level 10 = 100%
        v_hostages_captured := 0;
        IF v_casualty_count > 0 AND (v_attacker_stats.research_hostage_convert > 0) THEN
             v_hostage_chance := (v_attacker_stats.research_hostage_convert * 0.1); -- 1 -> 0.1, 10 -> 1.0
             v_hostages_captured := floor(v_casualty_count * v_hostage_chance);
        END IF;

        -- Calculate Vault Capacity for Attacker
        v_vault_cap := public.calculate_vault_capacity(COALESCE(v_attacker_stats.vault_level, 0));
        
        -- Update Attacker (Gain Gold to Vault, capped + Gain Hostages)
        UPDATE public.user_stats
        SET vault = LEAST(vault + v_gold_stolen, v_vault_cap),
            experience = experience + 100,
            hostages = COALESCE(hostages, 0) + v_hostages_captured
        WHERE id = v_attacker_id;

        -- Update Defender (Lose Gold, Soldiers)
        UPDATE public.user_stats
        SET gold = 0,
            defense_soldiers = GREATEST(0, defense_soldiers - v_casualty_count)
        WHERE id = target_id;
        
        -- Recalculate defender's stats after losing soldiers
        PERFORM public.recalculate_user_stats(target_id);

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
                'hostages_captured', v_hostages_captured
            )
        );

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
            'hostages', v_hostages_captured,
            'message', 'Victory! You breached their defenses and killed ' || v_casualty_count || ' defense soldiers.' || (CASE WHEN v_hostages_captured > 0 THEN ' Captured ' || v_hostages_captured || ' hostages.' ELSE '' END)
        );

    ELSE
        -- === DEFEAT ===
        
        -- Calculate Attacker Casualties (5-10% of Attack Soldiers)
        v_loss_rate := 0.05 + (random() * 0.05);
        v_raw_casualties := COALESCE(v_attacker_stats.attack_soldiers, 0) * v_loss_rate;
        v_casualty_count := floor(v_raw_casualties) + (CASE WHEN random() < (v_raw_casualties - floor(v_raw_casualties)) THEN 1 ELSE 0 END);

        -- Update Attacker (Lose Soldiers) - No hostages gained on defeat
        UPDATE public.user_stats
        SET attack_soldiers = GREATEST(0, attack_soldiers - v_casualty_count)
        WHERE id = v_attacker_id;
        
        -- Recalculate attacker's stats after losing soldiers
        PERFORM public.recalculate_user_stats(v_attacker_id);

        -- Report for Attacker
        INSERT INTO public.reports (user_id, type, title, data)
        VALUES (
            v_attacker_id, 
            'attack_loss', 
            'Defeat against ' || COALESCE(v_defender_profile.username, 'Unknown'),
            json_build_object(
                'opponent_name', COALESCE(v_defender_profile.username, 'Unknown'),
                'soldiers_lost', v_casualty_count
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
                'attacker_casualties', v_casualty_count
            )
        );

        RETURN json_build_object(
            'success', false,
            'gold_stolen', 0,
            'casualties', v_casualty_count,
            'message', 'Defeat! Your forces were repelled.'
        );
    END IF;
END;
$$;
