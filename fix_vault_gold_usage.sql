-- Fix Vault Gold Usage - Use Vault First, Then Main Gold
-- Run this in Supabase SQL Editor

-- This updates all purchase functions to:
-- 1. Use all available vault gold first
-- 2. If vault is insufficient, use the remainder from main gold
-- 3. Allow purchases that use both vault + main gold combined

-- =====================================================
-- 1. Fix train_units function
-- =====================================================
DROP FUNCTION IF EXISTS train_units(TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.train_units(
    p_unit_type text,
    p_quantity int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_gold_cost bigint;
    v_current_gold bigint;
    v_current_vault bigint;
    v_current_citizens bigint;
    v_stat_increase bigint;
    v_new_stats json;
    v_use_vault_gold boolean;
    v_vault_used bigint;
    v_gold_used bigint;
BEGIN
    v_user_id := auth.uid();
    v_gold_cost := p_quantity * 1000;
    v_stat_increase := p_quantity * 100;

    -- Get current stats
    SELECT gold, vault, citizens, use_vault_gold 
    INTO v_current_gold, v_current_vault, v_current_citizens, v_use_vault_gold
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Check citizens
    IF v_current_citizens < p_quantity THEN
        RAISE EXCEPTION 'Not enough citizens';
    END IF;

    -- Calculate gold deduction
    IF v_use_vault_gold THEN
        -- Use vault first, then main gold
        v_vault_used := LEAST(v_current_vault, v_gold_cost);
        v_gold_used := v_gold_cost - v_vault_used;
        
        -- Check if we have enough total gold
        IF (v_current_vault + v_current_gold) < v_gold_cost THEN
            RAISE EXCEPTION 'Not enough gold (need %, have % vault + % main)', 
                v_gold_cost, v_current_vault, v_current_gold;
        END IF;
        
        -- Deduct from both sources
        UPDATE public.user_stats
        SET vault = vault - v_vault_used,
            gold = gold - v_gold_used
        WHERE id = v_user_id;
    ELSE
        -- Use main gold only
        IF v_current_gold < v_gold_cost THEN
            RAISE EXCEPTION 'Not enough gold';
        END IF;
        
        UPDATE public.user_stats
        SET gold = gold - v_gold_cost
        WHERE id = v_user_id;
    END IF;

    -- Update stats based on unit type
    IF p_unit_type = 'attack' THEN
        UPDATE public.user_stats
        SET citizens = citizens - p_quantity,
            attack_soldiers = attack_soldiers + p_quantity,
            attack = attack + v_stat_increase
        WHERE id = v_user_id;
    ELSIF p_unit_type = 'defense' THEN
        UPDATE public.user_stats
        SET citizens = citizens - p_quantity,
            defense_soldiers = defense_soldiers + p_quantity,
            defense = defense + v_stat_increase
        WHERE id = v_user_id;
    ELSIF p_unit_type = 'spy' THEN
        UPDATE public.user_stats
        SET citizens = citizens - p_quantity,
            spies = spies + p_quantity,
            spy = spy + v_stat_increase
        WHERE id = v_user_id;
    ELSIF p_unit_type = 'sentry' THEN
        UPDATE public.user_stats
        SET citizens = citizens - p_quantity,
            sentries = sentries + p_quantity,
            sentry = sentry + v_stat_increase
        WHERE id = v_user_id;
    ELSE
        RAISE EXCEPTION 'Invalid unit type';
    END IF;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

-- =====================================================
-- 2. Fix upgrade_gold_mine function
-- =====================================================
DROP FUNCTION IF EXISTS upgrade_gold_mine();
CREATE OR REPLACE FUNCTION public.upgrade_gold_mine()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_gold bigint;
    v_current_vault bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
    v_use_vault_gold boolean;
    v_vault_used bigint;
    v_gold_used bigint;
BEGIN
    v_user_id := auth.uid();
    
    -- Get current stats
    SELECT gold, vault, gold_mine_level, use_vault_gold 
    INTO v_current_gold, v_current_vault, v_current_level, v_use_vault_gold
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Check Max Level
    IF v_current_level >= 25 THEN
        RAISE EXCEPTION 'Max level reached';
    END IF;

    -- Calculate Cost
    IF v_current_level = 0 THEN
        v_cost := 1000;
    ELSIF v_current_level = 1 THEN
        v_cost := 5000;
    ELSIF v_current_level = 2 THEN
        v_cost := 15000;
    ELSIF v_current_level = 3 THEN
        v_cost := 45000;
    ELSE
        v_cost := 45000 * (3 ^ (v_current_level - 3));
    END IF;

    -- Calculate gold deduction
    IF v_use_vault_gold THEN
        -- Use vault first, then main gold
        v_vault_used := LEAST(v_current_vault, v_cost);
        v_gold_used := v_cost - v_vault_used;
        
        -- Check if we have enough total gold
        IF (v_current_vault + v_current_gold) < v_cost THEN
            RAISE EXCEPTION 'Not enough gold (need %, have % vault + % main)', 
                v_cost, v_current_vault, v_current_gold;
        END IF;
        
        -- Deduct from both sources and upgrade
        UPDATE public.user_stats
        SET vault = vault - v_vault_used,
            gold = gold - v_gold_used,
            gold_mine_level = v_current_level + 1
        WHERE id = v_user_id;
    ELSE
        -- Use main gold only
        IF v_current_gold < v_cost THEN
            RAISE EXCEPTION 'Not enough gold';
        END IF;
        
        UPDATE public.user_stats
        SET gold = gold - v_cost,
            gold_mine_level = v_current_level + 1
        WHERE id = v_user_id;
    END IF;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

-- =====================================================
-- 3. Fix train_miners function
-- =====================================================
DROP FUNCTION IF EXISTS train_miners(INTEGER);
CREATE OR REPLACE FUNCTION public.train_miners(
    p_quantity int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_unit_cost bigint;
    v_total_cost bigint;
    v_current_gold bigint;
    v_current_vault bigint;
    v_current_citizens bigint;
    v_current_level int;
    v_new_stats json;
    v_use_vault_gold boolean;
    v_vault_used bigint;
    v_gold_used bigint;
BEGIN
    v_user_id := auth.uid();

    -- Get current stats
    SELECT gold, vault, citizens, gold_mine_level, use_vault_gold 
    INTO v_current_gold, v_current_vault, v_current_citizens, v_current_level, v_use_vault_gold
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Validation
    IF v_current_level < 1 THEN
        RAISE EXCEPTION 'You must build a Gold Mine first';
    END IF;

    IF v_current_citizens < p_quantity THEN
        RAISE EXCEPTION 'Not enough citizens';
    END IF;

    -- Calculate Dynamic Cost: 2000 * (1.1 ^ (current_level - 1))
    v_unit_cost := floor(2000 * (1.1 ^ (v_current_level - 1)));
    v_total_cost := p_quantity * v_unit_cost;

    -- Calculate gold deduction
    IF v_use_vault_gold THEN
        -- Use vault first, then main gold
        v_vault_used := LEAST(v_current_vault, v_total_cost);
        v_gold_used := v_total_cost - v_vault_used;
        
        -- Check if we have enough total gold
        IF (v_current_vault + v_current_gold) < v_total_cost THEN
            RAISE EXCEPTION 'Not enough gold (need %, have % vault + % main)', 
                v_total_cost, v_current_vault, v_current_gold;
        END IF;
        
        -- Deduct from both sources
        UPDATE public.user_stats
        SET vault = vault - v_vault_used,
            gold = gold - v_gold_used,
            citizens = citizens - p_quantity,
            miners = miners + p_quantity
        WHERE id = v_user_id;
    ELSE
        -- Use main gold only
        IF v_current_gold < v_total_cost THEN
            RAISE EXCEPTION 'Not enough gold';
        END IF;
        
        UPDATE public.user_stats
        SET gold = gold - v_total_cost,
            citizens = citizens - p_quantity,
            miners = miners + p_quantity
        WHERE id = v_user_id;
    END IF;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

-- =====================================================
-- 4. Fix upgrade_vault function
-- =====================================================
DROP FUNCTION IF EXISTS upgrade_vault();
CREATE OR REPLACE FUNCTION public.upgrade_vault()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_gold bigint;
    v_current_vault bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
    v_use_vault_gold boolean;
    v_vault_used bigint;
    v_gold_used bigint;
BEGIN
    v_user_id := auth.uid();
    
    -- Get current stats
    SELECT gold, vault, vault_level, use_vault_gold 
    INTO v_current_gold, v_current_vault, v_current_level, v_use_vault_gold
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Check Max Level
    IF v_current_level >= 10 THEN
        RAISE EXCEPTION 'Max vault level reached';
    END IF;

    -- Calculate Cost (exponential: 10,000 * 3^level)
    v_cost := 10000 * (3 ^ v_current_level);

    -- Calculate gold deduction
    IF v_use_vault_gold THEN
        -- Use vault first, then main gold
        v_vault_used := LEAST(v_current_vault, v_cost);
        v_gold_used := v_cost - v_vault_used;
        
        -- Check if we have enough total gold
        IF (v_current_vault + v_current_gold) < v_cost THEN
            RAISE EXCEPTION 'Not enough gold (need %, have % vault + % main)', 
                v_cost, v_current_vault, v_current_gold;
        END IF;
        
        -- Deduct from both sources and upgrade
        UPDATE public.user_stats
        SET vault = vault - v_vault_used,
            gold = gold - v_gold_used,
            vault_level = v_current_level + 1
        WHERE id = v_user_id;
    ELSE
        -- Use main gold only
        IF v_current_gold < v_cost THEN
            RAISE EXCEPTION 'Not enough gold';
        END IF;
        
        UPDATE public.user_stats
        SET gold = gold - v_cost,
            vault_level = v_current_level + 1
        WHERE id = v_user_id;
    END IF;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

-- Done! All purchase functions now use vault gold first, then main gold.
