-- Function to handle Kingdom Building and Upgrading securely
-- Replaces client-side logic in App.jsx

CREATE OR REPLACE FUNCTION public.upgrade_kingdom()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_xp bigint;
    v_current_level int;
    v_next_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    -- Get current stats
    SELECT experience, kingdom_level INTO v_current_xp, v_current_level
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Default to 0 if null
    IF v_current_level IS NULL THEN v_current_level := 0; END IF;
    
    -- Calculate Next Level
    v_next_level := v_current_level + 1;

    -- Max Level Check (100)
    IF v_next_level > 100 THEN 
        RAISE EXCEPTION 'Max kingdom level reached'; 
    END IF;

    -- Calculate Cost (Level * 100 XP)
    -- Level 1 Cost: 100 XP
    -- Level 2 Cost: 200 XP
    -- ...
    v_cost := v_next_level * 100;

    -- Check Experience
    IF v_current_xp < v_cost THEN 
        RAISE EXCEPTION 'Not enough experience'; 
    END IF;

    -- Deduct XP & Increment Level
    UPDATE public.user_stats
    SET experience = experience - v_cost,
        kingdom_level = v_next_level,
        updated_at = now()
    WHERE id = v_user_id;

    -- Return updated stats
    SELECT row_to_json(us) INTO v_new_stats 
    FROM public.user_stats us 
    WHERE id = v_user_id;
    
    RETURN v_new_stats;
END;
$$;
