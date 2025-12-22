-- Ensure the upgrade_research_weapons function is active and correct
-- This allows the Library to unlock better weapons in the Armoury

CREATE OR REPLACE FUNCTION public.upgrade_research_weapons()
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
    SELECT gold, research_weapons INTO v_current_gold, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Default to 0 if null
    IF v_current_level IS NULL THEN v_current_level := 0; END IF;
    
    -- Max level check (Max Tier is 5, so max research level is 5)
    IF v_current_level >= 5 THEN 
        RAISE EXCEPTION 'Max weapon research level reached'; 
    END IF;

    -- Cost Calculation
    -- Level 0 -> 1: 100,000
    -- Level 1 -> 2: 300,000
    -- Level 2 -> 3: 900,000
    -- Level 3 -> 4: 2,700,000
    -- Level 4 -> 5: 8,100,000
    IF v_current_level = 0 THEN v_cost := 100000;
    ELSIF v_current_level = 1 THEN v_cost := 300000;
    ELSIF v_current_level = 2 THEN v_cost := 900000;
    ELSIF v_current_level = 3 THEN v_cost := 2700000;
    ELSIF v_current_level = 4 THEN v_cost := 8100000;
    ELSE 
        RAISE EXCEPTION 'Invalid level';
    END IF;

    -- Check Gold
    IF v_current_gold < v_cost THEN 
        RAISE EXCEPTION 'Not enough gold'; 
    END IF;

    -- Deduct Gold & Increment Level
    UPDATE public.user_stats
    SET gold = gold - v_cost,
        research_weapons = v_current_level + 1
    WHERE id = v_user_id;

    -- Return updated stats
    SELECT row_to_json(us) INTO v_new_stats 
    FROM public.user_stats us 
    WHERE id = v_user_id;
    
    RETURN v_new_stats;
END;
$$;
