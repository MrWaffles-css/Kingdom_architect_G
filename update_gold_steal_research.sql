-- Update research upgrade function to use dynamic config
CREATE OR REPLACE FUNCTION public.upgrade_research_gold_steal()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_current_xp bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    v_user_id := auth.uid();
    
    -- Get current experience and research level
    SELECT 
        experience, 
        COALESCE(research_gold_steal, 0) 
    INTO 
        v_current_xp, 
        v_current_level 
    FROM user_stats 
    WHERE id = v_user_id;
    
    -- Fetch cost for NEXT level (current + 1)
    SELECT cost INTO v_cost
    FROM public.gold_steal_configs
    WHERE level = v_current_level + 1;

    -- If no config found for next level, we are at max
    IF v_cost IS NULL THEN 
        RAISE EXCEPTION 'Max research level reached'; 
    END IF;
    
    -- Check if user has enough XP
    IF v_current_xp < v_cost THEN 
        RAISE EXCEPTION 'Not enough experience (Need % XP)', v_cost; 
    END IF;
    
    -- Deduct XP and increment level
    UPDATE user_stats 
    SET 
        experience = experience - v_cost, 
        research_gold_steal = v_current_level + 1 
    WHERE id = v_user_id;
    
    -- Return updated stats
    SELECT row_to_json(us) INTO v_new_stats 
    FROM user_stats us 
    WHERE id = v_user_id;
    
    RETURN v_new_stats;
END;
$$;
