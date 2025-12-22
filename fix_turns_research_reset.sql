-- Migration: Fix Reset World and Update Turns Research
-- 1. Updates reset_world to reset research_turns_per_min
-- 2. Updates upgrade_research_turns to use Experience instead of Gold

-- =====================================================
-- 1. Function: Reset World (Fixed)
-- =====================================================
CREATE OR REPLACE FUNCTION reset_world()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Reset all user stats to default values
    UPDATE user_stats SET
        gold = 0,
        experience = 1000,
        turns = 0,
        vault = 0,
        vault_level = 0,
        rank = 1,
        citizens = 2,
        kingdom_level = 0,
        tutorial_step = 0,  -- Reset tutorial to beginning
        attack_soldiers = 0,
        defense_soldiers = 0,
        spies = 0,
        sentries = 0,
        miners = 0,
        gold_mine_level = 0,
        research_weapons = 0,  -- Reset weapon research to 0
        research_turns_per_min = 0, -- Reset turns research to 0
        research_vault_steal = 0,
        research_gold_steal = 0,
        library_level = 1  -- Reset library to level 1
    WHERE TRUE;  -- Intentionally update all rows for world reset

    -- Delete all user weapons (weapons are stored in separate table)
    DELETE FROM user_weapons WHERE TRUE;

    -- Delete all battle/combat reports  
    DELETE FROM reports WHERE TRUE;

    -- Delete all spy reports  
    DELETE FROM spy_reports WHERE TRUE;

    -- Delete all messages
    DELETE FROM messages WHERE TRUE;

    -- Delete all chat messages
    DELETE FROM chat_messages WHERE TRUE;

    -- Delete all achievements (optional - comment out if you want to keep achievements)
    -- DELETE FROM user_achievements WHERE TRUE;

    RAISE NOTICE 'World has been reset successfully!';
END;
$$;

-- Grant execute permission to authenticated users (admin only should call this)
GRANT EXECUTE ON FUNCTION reset_world() TO authenticated;


-- =====================================================
-- 2. Function: Upgrade Turns Per Minute Research (Updated to use XP)
-- =====================================================
CREATE OR REPLACE FUNCTION public.upgrade_research_turns()
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
    
    -- Get current stats (Experience instead of Gold)
    SELECT experience, research_turns_per_min INTO v_current_xp, v_current_level
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

    -- Calculate XP Cost for NEXT level (Tutorial Curve)
    -- Level 0 -> 1: 1,000 XP
    -- Level 1 -> 2: 5,000 XP
    -- Level 2 -> 3: 25,000 XP
    -- Level 3 -> 4: 100,000 XP
    -- Level 4 -> 5: 500,000 XP

    IF v_current_level = 0 THEN v_cost := 1000;
    ELSIF v_current_level = 1 THEN v_cost := 5000;
    ELSIF v_current_level = 2 THEN v_cost := 25000;
    ELSIF v_current_level = 3 THEN v_cost := 100000;
    ELSIF v_current_level = 4 THEN v_cost := 500000;
    ELSE
        RAISE EXCEPTION 'Invalid level';
    END IF;

    -- Validation
    IF v_current_xp < v_cost THEN
        RAISE EXCEPTION 'Not enough experience';
    END IF;

    -- Deduct XP & Upgrade
    UPDATE public.user_stats
    SET experience = experience - v_cost,
        research_turns_per_min = v_current_level + 1
    WHERE id = v_user_id;

    -- Return new stats
    SELECT row_to_json(us) INTO v_new_stats
    FROM public.user_stats us
    WHERE id = v_user_id;

    RETURN v_new_stats;
END;
$$;
