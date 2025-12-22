-- Grant Vault Level 1 to All Players by Default
-- Run this in Supabase SQL Editor

-- 1. Update handle_new_user to give vault level 1 by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, email, is_admin)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email), 
        NEW.email, 
        false
    );

    INSERT INTO public.user_stats (
        id, gold, experience, turns, vault, vault_level, rank, citizens, kingdom_level, 
        attack, defense, spy, sentry, alliance,
        attack_soldiers, defense_soldiers, spies, sentries,
        miners, gold_mine_level
    )
    VALUES (
        NEW.id, 
        0,    -- gold
        1000, -- experience
        0,    -- turns
        0,    -- vault
        1,    -- vault_level (START WITH LEVEL 1)
        1,    -- rank
        2,    -- citizens
        0,    -- kingdom_level
        0,    -- attack
        0,    -- defense
        0,    -- spy
        0,    -- sentry
        NULL, -- alliance
        0, 0, 0, 0, -- units
        0, 0  -- miners, gold_mine_level
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update existing players to have vault level 1 if they have 0
UPDATE public.user_stats
SET vault_level = 1
WHERE vault_level = 0 OR vault_level IS NULL;

-- 3. Update the start_new_season function to grant vault level 1
-- (This is in add_achievement_system.sql, but we'll update it here)
DROP FUNCTION IF EXISTS start_new_season(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION start_new_season(target_month INTEGER, target_year INTEGER)
RETURNS JSONB AS $$
DECLARE
    last_season RECORD;
    new_season_number INTEGER;
    cooldown_end TIMESTAMPTZ;
BEGIN
    -- Get the last season
    SELECT * INTO last_season FROM seasons ORDER BY season_number DESC LIMIT 1;
    
    -- Check if we're still in cooldown
    IF last_season.cooldown_until IS NOT NULL AND last_season.cooldown_until > NOW() THEN
        RAISE EXCEPTION 'Cannot start new season yet. Cooldown period until: %', last_season.cooldown_until;
    END IF;
    
    -- Calculate new season number
    new_season_number := COALESCE(last_season.season_number, 0) + 1;
    
    -- Create new season
    INSERT INTO seasons (season_number, month, year, start_date, is_active)
    VALUES (
        new_season_number,
        target_month,
        target_year,
        NOW(),
        true
    );
    
    -- Reset all user stats for new season
    UPDATE user_stats SET
        gold = 0,
        experience = 1000,
        turns = 0,
        vault = 0,
        vault_level = 1,  -- Grant vault level 1 at season start
        citizens = 2,
        kingdom_level = 0,
        attack = 0,
        defense = 0,
        spy = 0,
        sentry = 0,
        attack_soldiers = 0,
        defense_soldiers = 0,
        spies = 0,
        sentries = 0,
        miners = 0,
        gold_mine_level = 0;
    
    -- Clear daily stats
    DELETE FROM daily_stats;
    
    RETURN jsonb_build_object(
        'success', true,
        'season_number', new_season_number,
        'message', 'New season started successfully!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Done! All new players and season resets will now start with vault level 1.
