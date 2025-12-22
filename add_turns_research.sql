-- Add Turns Per Minute Research
-- Run this in Supabase SQL Editor

-- 1. Add research column to user_stats
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS research_turns_per_min int DEFAULT 0;

-- 2. Function: Upgrade Turns Per Minute Research
CREATE OR REPLACE FUNCTION public.upgrade_research_turns()
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
    SELECT gold, research_turns_per_min INTO v_current_gold, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Handle null level (default to 0)
    IF v_current_level IS NULL THEN
        v_current_level := 0;
    END IF;

    -- Check Max Level
    IF v_current_level >= 5 THEN
        RAISE EXCEPTION 'Max research level reached';
    END IF;

    -- Calculate Gold Cost for NEXT level
    -- Level 0 -> 1: 1,000,000
    -- Level 1 -> 2: 5,000,000
    -- Level 2 -> 3: 20,000,000
    -- Level 3 -> 4: 100,000,000
    -- Level 4 -> 5: 1,000,000,000

    IF v_current_level = 0 THEN v_cost := 1000000;
    ELSIF v_current_level = 1 THEN v_cost := 5000000;
    ELSIF v_current_level = 2 THEN v_cost := 20000000;
    ELSIF v_current_level = 3 THEN v_cost := 100000000;
    ELSIF v_current_level = 4 THEN v_cost := 1000000000;
    ELSE
        RAISE EXCEPTION 'Invalid level';
    END IF;

    -- Validation
    IF v_current_gold < v_cost THEN
        RAISE EXCEPTION 'Not enough gold';
    END IF;

    -- Deduct Gold & Upgrade
    UPDATE public.user_stats
    SET gold = gold - v_cost,
        research_turns_per_min = v_current_level + 1
    WHERE id = v_user_id;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;
