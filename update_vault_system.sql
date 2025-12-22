-- Update Vault System with New Progression
-- Run this in Supabase SQL Editor

-- 1. Update Helper Function: Calculate Vault Capacity
CREATE OR REPLACE FUNCTION public.calculate_vault_capacity(p_level int)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_level = 0 THEN RETURN 0;
    ELSIF p_level = 1 THEN RETURN 200000;      -- Changed from 100,000
    ELSIF p_level = 2 THEN RETURN 300000;      -- Changed from 500,000
    ELSIF p_level = 3 THEN RETURN 1500000;
    ELSIF p_level = 4 THEN RETURN 5000000;
    ELSIF p_level = 5 THEN RETURN 15000000;
    ELSIF p_level = 6 THEN RETURN 50000000;
    ELSIF p_level = 7 THEN RETURN 150000000;
    ELSIF p_level = 8 THEN RETURN 500000000;
    ELSIF p_level = 9 THEN RETURN 1500000000;
    ELSIF p_level = 10 THEN RETURN 5000000000;
    ELSE RETURN 5000000000; -- Cap at level 10
    END IF;
END;
$$;

-- 2. Update Function: Upgrade Vault (Costs)
CREATE OR REPLACE FUNCTION public.upgrade_vault()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_gold bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    -- Get current stats
    SELECT gold, vault_level
    INTO v_current_gold, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Check Max Level
    IF v_current_level >= 10 THEN
        RAISE EXCEPTION 'Max vault level reached';
    END IF;

    -- Calculate Gold Cost based on level
    IF v_current_level = 0 THEN
        v_cost := 5000;        -- Initial construction
    ELSIF v_current_level = 1 THEN
        v_cost := 100000;      -- Level 1 -> 2
    ELSIF v_current_level = 2 THEN
        v_cost := 1000000;     -- Level 2 -> 3
    ELSIF v_current_level = 3 THEN
        v_cost := 4000000;     -- Level 3 -> 4
    ELSIF v_current_level = 4 THEN
        v_cost := 8000000;     -- Level 4 -> 5
    ELSIF v_current_level = 5 THEN
        v_cost := 20000000;    -- Level 5 -> 6
    ELSIF v_current_level = 6 THEN
        v_cost := 75000000;    -- Level 6 -> 7
    ELSIF v_current_level = 7 THEN
        v_cost := 200000000;   -- Level 7 -> 8
    ELSIF v_current_level = 8 THEN
        v_cost := 1000000000;  -- Level 8 -> 9
    ELSIF v_current_level = 9 THEN
        v_cost := 5000000000;  -- Level 9 -> 10
    END IF;

    -- Check if user has enough Gold
    IF v_current_gold < v_cost THEN
        RAISE EXCEPTION 'Not enough gold (need %, have %)', v_cost, v_current_gold;
    END IF;
    
    -- Deduct Gold and upgrade vault
    UPDATE public.user_stats
    SET gold = gold - v_cost,
        vault_level = v_current_level + 1
    WHERE id = v_user_id;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;
