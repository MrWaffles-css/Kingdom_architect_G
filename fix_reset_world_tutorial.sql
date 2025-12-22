-- Migration: Reset Tutorial Step in reset_world Function
-- This ensures that when the world is reset, the tutorial also resets to step 0

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS reset_world();

-- Create the reset_world function
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
