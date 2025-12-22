-- Fix Vault Upgrade to Use Experience Instead of Gold
-- Run this in Supabase SQL Editor

DROP FUNCTION IF EXISTS upgrade_vault();
CREATE OR REPLACE FUNCTION public.upgrade_vault()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_xp bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    -- Get current stats
    SELECT experience, vault_level
    INTO v_current_xp, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Check Max Level
    IF v_current_level >= 10 THEN
        RAISE EXCEPTION 'Max vault level reached';
    END IF;

    -- Calculate XP Cost based on level
    IF v_current_level = 0 THEN
        v_cost := 1000;
    ELSIF v_current_level = 1 THEN
        v_cost := 5000;
    ELSIF v_current_level = 2 THEN
        v_cost := 15000;
    ELSIF v_current_level = 3 THEN
        v_cost := 45000;
    ELSIF v_current_level = 4 THEN
        v_cost := 135000;
    ELSIF v_current_level = 5 THEN
        v_cost := 400000;
    ELSIF v_current_level = 6 THEN
        v_cost := 1200000;
    ELSIF v_current_level = 7 THEN
        v_cost := 3600000;
    ELSIF v_current_level = 8 THEN
        v_cost := 10000000;
    ELSIF v_current_level = 9 THEN
        v_cost := 30000000;
    END IF;

    -- Check if user has enough XP
    IF v_current_xp < v_cost THEN
        RAISE EXCEPTION 'Not enough experience (need %, have %)', v_cost, v_current_xp;
    END IF;
    
    -- Deduct XP and upgrade vault
    UPDATE public.user_stats
    SET experience = experience - v_cost,
        vault_level = v_current_level + 1
    WHERE id = v_user_id;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;
