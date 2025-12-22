-- Add Vault System
-- Run this in Supabase SQL Editor

-- 1. Add columns to user_stats
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS vault_level int DEFAULT 0,
ADD COLUMN IF NOT EXISTS use_vault_gold boolean DEFAULT false;

-- Ensure vault column exists (it should, but just in case)
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS vault bigint DEFAULT 0;

-- 2. Helper Function: Calculate Vault Capacity
CREATE OR REPLACE FUNCTION public.calculate_vault_capacity(p_level int)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_level = 0 THEN RETURN 0;
    ELSIF p_level = 1 THEN RETURN 100000;
    ELSIF p_level = 2 THEN RETURN 500000;
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

-- 3. Helper Function: Calculate Vault Interest Rate
CREATE OR REPLACE FUNCTION public.calculate_vault_interest(p_level int)
RETURNS float
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_level = 0 THEN RETURN 0;
    ELSIF p_level = 1 THEN RETURN 0.05;
    ELSIF p_level = 2 THEN RETURN 0.10;
    ELSIF p_level = 3 THEN RETURN 0.15;
    ELSIF p_level = 4 THEN RETURN 0.20;
    ELSIF p_level = 5 THEN RETURN 0.25;
    ELSIF p_level = 6 THEN RETURN 0.30;
    ELSIF p_level = 7 THEN RETURN 0.35;
    ELSIF p_level = 8 THEN RETURN 0.40;
    ELSIF p_level = 9 THEN RETURN 0.45;
    ELSIF p_level = 10 THEN RETURN 0.50;
    ELSE RETURN 0.50; -- Cap at 50%
    END IF;
END;
$$;

-- 4. Function: Upgrade Vault
CREATE OR REPLACE FUNCTION public.upgrade_vault()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_xp bigint;
    v_current_level int;
    v_xp_cost bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    -- Get current stats
    SELECT experience, vault_level INTO v_current_xp, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Check Max Level
    IF v_current_level >= 10 THEN
        RAISE EXCEPTION 'Max vault level reached';
    END IF;

    -- Calculate XP Cost
    IF v_current_level = 0 THEN
        v_xp_cost := 1000;
    ELSIF v_current_level = 1 THEN
        v_xp_cost := 5000;
    ELSIF v_current_level = 2 THEN
        v_xp_cost := 15000;
    ELSIF v_current_level = 3 THEN
        v_xp_cost := 45000;
    ELSIF v_current_level = 4 THEN
        v_xp_cost := 135000;
    ELSIF v_current_level = 5 THEN
        v_xp_cost := 400000;
    ELSIF v_current_level = 6 THEN
        v_xp_cost := 1200000;
    ELSIF v_current_level = 7 THEN
        v_xp_cost := 3600000;
    ELSIF v_current_level = 8 THEN
        v_xp_cost := 10000000;
    ELSIF v_current_level = 9 THEN
        v_xp_cost := 30000000;
    ELSE
        v_xp_cost := 999999999; -- Should not happen
    END IF;

    -- Validation
    IF v_current_xp < v_xp_cost THEN
        RAISE EXCEPTION 'Not enough experience';
    END IF;

    -- Deduct XP & Upgrade
    UPDATE public.user_stats
    SET experience = experience - v_xp_cost,
        vault_level = v_current_level + 1
    WHERE id = v_user_id;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;

-- 5. Function: Toggle Vault Spending
CREATE OR REPLACE FUNCTION public.toggle_vault_spending(
    p_enable boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();

    UPDATE public.user_stats
    SET use_vault_gold = p_enable
    WHERE id = v_user_id;

    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;
