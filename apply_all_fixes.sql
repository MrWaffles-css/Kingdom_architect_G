-- MASTER FIX SCRIPT
-- This script combines all recent fixes into one execution order to ensure consistency.

-- =========================================================
-- 1. FIX DEPENDENCIES (from fix_attack_error.sql)
-- =========================================================

-- Drop potentially problematic triggers that caused "relation 'seasons' does not exist"
DROP TRIGGER IF EXISTS tr_season_activity_user_stats ON public.user_stats;
DROP TRIGGER IF EXISTS tr_season_activity_reports ON public.reports;

-- Ensure 'seasons' table exists to satisfy any lingering dependencies
CREATE TABLE IF NOT EXISTS public.seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_number INTEGER NOT NULL UNIQUE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scheduled_end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 2. UPDATE ATTACK LOGIC (from add_vault_steal_logic.sql)
-- includes: Vault Steal, Research %, Report ID return
-- =========================================================

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

    -- Combat Logic
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

        -- Calculate Defenders Casualties
        v_kill_rate := random() * 0.02;
        v_raw_casualties := COALESCE(v_defender_stats.defense_soldiers, 0) * v_kill_rate;
        v_casualty_count := floor(v_raw_casualties) + (CASE WHEN random() < (v_raw_casualties - floor(v_raw_casualties)) THEN 1 ELSE 0 END);
        
        -- Calculate Attacker Vault Cap
        v_vault_cap := public.calculate_vault_capacity(COALESCE(v_attacker_stats.vault_level, 0));
        
        -- Update Attacker (Gain Gold)
        UPDATE public.user_stats
        SET vault = LEAST(vault + v_gold_stolen_total, v_vault_cap),
            experience = experience + 100
        WHERE id = v_attacker_id;

        -- Update Defender (Lose Gold)
        UPDATE public.user_stats
        SET gold = GREATEST(0, gold - v_stolen_from_main),
            vault = GREATEST(0, vault - v_stolen_from_vault),
            defense_soldiers = GREATEST(0, defense_soldiers - v_casualty_count)
        WHERE id = target_id;
        
        PERFORM public.recalculate_user_stats(target_id);

        -- Report for Attacker
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
                'enemy_killed', v_casualty_count
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
                'gold_lost', v_gold_stolen_total,
                'lost_from_main', v_stolen_from_main,
                'lost_from_vault', v_stolen_from_vault,
                'soldiers_lost', v_casualty_count
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
            'casualties', v_casualty_count,
            'message', 'Victory! You stole ' || v_gold_stolen_total || ' gold.'
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
            'message', 'Defeat! Your forces were repelled.'
        );
    END IF;
END;
$$;

-- =========================================================
-- 3. UPDATE TURN GENERATION (from fix_turn_generation.sql)
-- Linear (Base 2 + Level)
-- =========================================================

CREATE OR REPLACE FUNCTION public.generate_resources()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_stats RECORD;
    v_now timestamptz;
    v_last_update timestamptz;
    v_elapsed_seconds numeric;
    v_minutes_passed integer;
    
    -- Resource gains
    v_citizen_gain integer;
    v_gold_gain bigint;
    v_xp_gain bigint;
    v_turn_gain integer;
    v_vault_gain bigint;
    
    -- Gold generation components
    v_untrained_gold bigint;
    v_trained_gold bigint;
    v_miner_gold bigint;
    v_miner_rate integer;
    v_trained_count integer;
    
    -- Vault calculations
    v_vault_level integer;
    v_interest_rate numeric;
    v_vault_capacity bigint;
    v_current_vault bigint;
    v_is_over_capacity boolean;
    v_new_vault bigint;
    
    v_result json;
BEGIN
    v_user_id := auth.uid();
    v_now := NOW();
    
    -- Get current stats
    SELECT * INTO v_stats FROM public.user_stats WHERE id = v_user_id;
    
    IF v_stats IS NULL THEN
        RAISE EXCEPTION 'User stats not found';
    END IF;
    
    -- Calculate time elapsed since last update
    v_last_update := v_stats.updated_at;
    IF v_last_update IS NULL THEN
        v_last_update := v_now;
    END IF;
    
    v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - v_last_update));
    v_minutes_passed := FLOOR(v_elapsed_seconds / 60);
    
    -- If less than 1 minute has passed, return current stats
    IF v_minutes_passed < 1 THEN
        SELECT row_to_json(us) INTO v_result FROM public.user_stats us WHERE id = v_user_id;
        RETURN v_result;
    END IF;
    
    -- =====================================================
    -- CITIZEN GENERATION
    -- =====================================================
    v_citizen_gain := FLOOR(COALESCE(v_stats.kingdom_level, 0) * 1) * v_minutes_passed;
    
    -- =====================================================
    -- GOLD GENERATION
    -- =====================================================
    v_untrained_gold := FLOOR(COALESCE(v_stats.citizens, 0) * 1) * v_minutes_passed;
    
    v_trained_count := COALESCE(v_stats.attack_soldiers, 0) + 
                       COALESCE(v_stats.defense_soldiers, 0) + 
                       COALESCE(v_stats.spies, 0) + 
                       COALESCE(v_stats.sentries, 0);
    v_trained_gold := FLOOR(v_trained_count * 0.5) * v_minutes_passed;
    
    v_miner_rate := 2 + GREATEST(0, COALESCE(v_stats.gold_mine_level, 1) - 1);
    v_miner_gold := COALESCE(v_stats.miners, 0) * v_miner_rate * v_minutes_passed;
    
    v_gold_gain := v_untrained_gold + v_trained_gold + v_miner_gold;
    
    -- =====================================================
    -- VAULT INTEREST
    -- =====================================================
    v_vault_level := COALESCE(v_stats.vault_level, 0);
    v_interest_rate := 0;
    v_vault_capacity := 0;
    
    IF v_vault_level > 0 THEN
        v_interest_rate := LEAST(0.50, v_vault_level * 0.05);
        IF v_vault_level = 1 THEN v_vault_capacity := 100000;
        ELSIF v_vault_level = 2 THEN v_vault_capacity := 500000;
        ELSIF v_vault_level = 3 THEN v_vault_capacity := 1500000;
        ELSIF v_vault_level = 4 THEN v_vault_capacity := 5000000;
        ELSIF v_vault_level = 5 THEN v_vault_capacity := 15000000;
        ELSIF v_vault_level = 6 THEN v_vault_capacity := 50000000;
        ELSIF v_vault_level = 7 THEN v_vault_capacity := 150000000;
        ELSIF v_vault_level = 8 THEN v_vault_capacity := 500000000;
        ELSIF v_vault_level = 9 THEN v_vault_capacity := 1500000000;
        ELSIF v_vault_level >= 10 THEN v_vault_capacity := 5000000000;
        END IF;
    END IF;
    
    v_current_vault := COALESCE(v_stats.vault, 0);
    v_is_over_capacity := v_current_vault > v_vault_capacity;
    
    IF v_is_over_capacity THEN
        v_vault_gain := 0;
        v_new_vault := v_current_vault; 
    ELSE
        v_vault_gain := FLOOR(v_gold_gain * v_interest_rate);
        v_new_vault := LEAST(v_vault_capacity, v_current_vault + v_vault_gain);
    END IF;
    
    -- =====================================================
    -- EXPERIENCE GENERATION
    -- =====================================================
    v_xp_gain := COALESCE(v_stats.library_level, 1) * v_minutes_passed;
    
    -- =====================================================
    -- TURN GENERATION (UPDATED)
    -- =====================================================
    DECLARE
        v_turns_per_min int;
        v_res_level int;
    BEGIN
        v_res_level := COALESCE(v_stats.research_turns_per_min, 0);
        v_turns_per_min := 2 + v_res_level; 
        
        v_turn_gain := v_turns_per_min * v_minutes_passed;
    END;

    -- =====================================================
    -- UPDATE DATABASE
    -- =====================================================
    UPDATE public.user_stats
    SET 
        citizens = citizens + v_citizen_gain,
        gold = gold + v_gold_gain,
        vault = v_new_vault,
        experience = experience + v_xp_gain,
        turns = turns + v_turn_gain,
        updated_at = v_now
    WHERE id = v_user_id;
    
    -- Return updated stats
    SELECT row_to_json(us) INTO v_result FROM public.user_stats us WHERE id = v_user_id;
    RETURN v_result;
END;
$$;
