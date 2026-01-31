-- Ensure reset_world includes max_boss_defeated reset
-- This updates the reset_world function to reset boss progress

CREATE OR REPLACE FUNCTION reset_world()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Reset all user stats to default values
    UPDATE user_stats SET
        gold = 0,
        experience = 600,
        turns = 0,
        vault = 0,
        vault_level = 0,
        rank = 1,
        citizens = 2,
        kingdom_level = 0,
        tutorial_step = 0,  -- Reset tutorial to beginning
        
        -- Reset Units
        attack_soldiers = 0,
        defense_soldiers = 0,
        spies = 0,
        sentries = 0,
        miners = 0,
        gold_mine_level = 0,
        barracks_level = 1, -- Reset to Level 1
        
        -- Reset Hostages
        hostages = 0,
        
        -- Reset Aggregate Weapon Counts
        attack_weapons = 0,
        defense_weapons = 0,
        spy_weapons = 0,
        sentry_weapons = 0,
        
        -- Reset Calculated Strengths
        attack = 0,
        defense = 0,
        spy = 0,
        sentry = 0,
        
        -- Library Reset
        library_level = 1,
        
        -- Economic Research
        research_turns_per_min = 0,
        research_vault_steal = 0,
        research_gold_steal = 0,
        
        -- Military Research
        research_weapons = 0,
        research_hostage_convert = 0,
        
        -- Tech Tree Research
        research_attack = 0,
        research_defense = 0,
        research_sentry = 0,
        research_spy = 0,
        
        -- Spy Research
        research_spy_report = 0,
        
        -- Boss Progress - RESET TO 0
        max_boss_defeated = 0,

        -- Settings Resets
        use_vault_gold = false,
        last_resource_generation = NOW(),
        last_stat_update = NOW()
        
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

    -- Delete all active boss fights
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_boss_fights') THEN
        DELETE FROM user_boss_fights WHERE TRUE;
    END IF;

    -- Delete all boss kill counts
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_boss_kills') THEN
        DELETE FROM user_boss_kills WHERE TRUE;
    END IF;

    -- Delete all achievements (optional - we usually keep this but can clear if full wipe needed)
    -- DELETE FROM user_achievements WHERE TRUE;

    RAISE NOTICE 'World has been reset successfully! All stats, items, research, and boss progress cleared.';
END;
$$;

NOTIFY pgrst, 'reload schema';
