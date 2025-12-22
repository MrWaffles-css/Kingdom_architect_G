-- Add Library System
-- Run this in Supabase SQL Editor

-- 1. Add library_level column to user_stats
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS library_level int DEFAULT 1;

-- 2. Function: Upgrade Library
CREATE OR REPLACE FUNCTION public.upgrade_library()
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
    SELECT gold, library_level INTO v_current_gold, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Handle null library_level (default to 1)
    IF v_current_level IS NULL THEN
        v_current_level := 1;
    END IF;

    -- Check Max Level
    IF v_current_level >= 10 THEN
        RAISE EXCEPTION 'Max library level reached';
    END IF;

    -- Calculate Gold Cost for NEXT level
    -- Level 1 -> 2: 100,000
    -- Level 2 -> 3: 300,000
    -- Level 3 -> 4: 600,000
    -- Level 4 -> 5: 900,000
    -- Level 5 -> 6: 2,000,000
    -- Level 6 -> 7: 5,000,000
    -- Level 7 -> 8: 25,000,000
    -- Level 8 -> 9: 50,000,000
    -- Level 9 -> 10: 100,000,000

    IF v_current_level = 1 THEN v_cost := 100000;
    ELSIF v_current_level = 2 THEN v_cost := 300000;
    ELSIF v_current_level = 3 THEN v_cost := 600000;
    ELSIF v_current_level = 4 THEN v_cost := 900000;
    ELSIF v_current_level = 5 THEN v_cost := 2000000;
    ELSIF v_current_level = 6 THEN v_cost := 5000000;
    ELSIF v_current_level = 7 THEN v_cost := 25000000;
    ELSIF v_current_level = 8 THEN v_cost := 50000000;
    ELSIF v_current_level = 9 THEN v_cost := 100000000;
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
        library_level = v_current_level + 1
    WHERE id = v_user_id;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;
