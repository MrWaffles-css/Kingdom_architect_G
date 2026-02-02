-- Fix: Create Missing upgrade_research_gold_steal() function
-- This function allows players to upgrade their gold steal percentage from 50% up to 100%
-- Each level increases steal by 5% (Level 0 = 50%, Level 10 = 100%)
-- Cost: 5000 XP per level * level number

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
    
    -- Check if already at max level
    IF v_current_level >= 10 THEN 
        RAISE EXCEPTION 'Max research level reached'; 
    END IF;
    
    -- Calculate cost: 5000 * (current_level + 1)
    -- Level 0->1: 5,000 XP
    -- Level 1->2: 10,000 XP
    -- Level 2->3: 15,000 XP
    -- ...
    -- Level 9->10: 50,000 XP
    v_cost := 5000 * (v_current_level + 1);
    
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.upgrade_research_gold_steal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upgrade_research_gold_steal() TO service_role;

-- Verify the function exists and is accessible
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'upgrade_research_gold_steal';

-- ============================================================
-- Create upgrade_research_vault_steal() function
-- ============================================================
-- This function allows players to upgrade their vault steal percentage
-- Each level increases vault steal by 5% (Level 0 = 0%, Level 5 = 25%)
-- Cost: XP cost increases per level (5k, 10k, 15k, 20k, 25k)

CREATE OR REPLACE FUNCTION public.upgrade_research_vault_steal()
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
        COALESCE(research_vault_steal, 0) 
    INTO 
        v_current_xp, 
        v_current_level 
    FROM user_stats 
    WHERE id = v_user_id;
    
    -- Check if already at max level
    IF v_current_level >= 5 THEN 
        RAISE EXCEPTION 'Max research level reached'; 
    END IF;
    
    -- Calculate cost based on current level
    -- Level 0->1: 5,000 XP
    -- Level 1->2: 10,000 XP
    -- Level 2->3: 15,000 XP
    -- Level 3->4: 20,000 XP
    -- Level 4->5: 25,000 XP
    CASE v_current_level
        WHEN 0 THEN v_cost := 5000;
        WHEN 1 THEN v_cost := 10000;
        WHEN 2 THEN v_cost := 15000;
        WHEN 3 THEN v_cost := 20000;
        WHEN 4 THEN v_cost := 25000;
        ELSE v_cost := 999999999;
    END CASE;
    
    -- Check if user has enough XP
    IF v_current_xp < v_cost THEN 
        RAISE EXCEPTION 'Not enough experience (Need % XP)', v_cost; 
    END IF;
    
    -- Deduct XP and increment level
    UPDATE user_stats 
    SET 
        experience = experience - v_cost, 
        research_vault_steal = v_current_level + 1 
    WHERE id = v_user_id;
    
    -- Return updated stats
    SELECT row_to_json(us) INTO v_new_stats 
    FROM user_stats us 
    WHERE id = v_user_id;
    
    RETURN v_new_stats;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.upgrade_research_vault_steal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upgrade_research_vault_steal() TO service_role;

-- Verify the function exists
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'upgrade_research_vault_steal';

