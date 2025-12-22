-- =====================================================
-- ACHIEVEMENT SYSTEM - Database Schema & Functions
-- =====================================================
-- This script creates the complete achievement system including:
-- - Season management with cooldown periods
-- - Achievement definitions and user achievements
-- - Daily stats tracking for daily achievements
-- - Season-end legacy achievements
-- - Automated functions for awarding achievements

-- =====================================================
-- TABLE: seasons
-- =====================================================
CREATE TABLE IF NOT EXISTS seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_number INTEGER NOT NULL UNIQUE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT false,
    cooldown_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for active season lookup
CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(is_active) WHERE is_active = true;

-- =====================================================
-- TABLE: achievements
-- =====================================================
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('daily', 'seasonal', 'legacy')),
    category TEXT CHECK (category IN ('attacker', 'looter', 'rank')),
    icon TEXT NOT NULL,
    rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    requirement JSONB, -- Stores requirement data (e.g., {"rank": 100} or {"attacks": 1})
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: user_achievements
-- =====================================================
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    season_number INTEGER,
    metadata JSONB, -- Stores additional data (e.g., {"attacks": 150, "date": "2025-11-24"})
    UNIQUE(user_id, achievement_id, season_number)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_season ON user_achievements(season_number);

-- =====================================================
-- TABLE: daily_stats
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    attacks_count INTEGER DEFAULT 0,
    gold_stolen BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Create index for daily leaderboard queries
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

-- =====================================================
-- TABLE: season_end_achievements
-- =====================================================
CREATE TABLE IF NOT EXISTS season_end_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    final_rank INTEGER NOT NULL,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    awarded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, season_number)
);

-- Create index for user lookup
CREATE INDEX IF NOT EXISTS idx_season_end_achievements_user ON season_end_achievements(user_id);

-- =====================================================
-- FUNCTION: track_daily_attack
-- =====================================================
CREATE OR REPLACE FUNCTION track_daily_attack()
RETURNS void AS $$
BEGIN
    INSERT INTO daily_stats (user_id, date, attacks_count, gold_stolen)
    VALUES (auth.uid(), CURRENT_DATE, 1, 0)
    ON CONFLICT (user_id, date)
    DO UPDATE SET 
        attacks_count = daily_stats.attacks_count + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: track_daily_gold_stolen
-- =====================================================
CREATE OR REPLACE FUNCTION track_daily_gold_stolen(amount BIGINT)
RETURNS void AS $$
BEGIN
    INSERT INTO daily_stats (user_id, date, attacks_count, gold_stolen)
    VALUES (auth.uid(), CURRENT_DATE, 0, amount)
    ON CONFLICT (user_id, date)
    DO UPDATE SET 
        gold_stolen = daily_stats.gold_stolen + amount,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: award_daily_achievements
-- =====================================================
CREATE OR REPLACE FUNCTION award_daily_achievements()
RETURNS void AS $$
DECLARE
    current_season INTEGER;
    attacker_achievement_id UUID;
    looter_achievement_id UUID;
    top_attacker RECORD;
    top_looter RECORD;
BEGIN
    -- Get current active season
    SELECT season_number INTO current_season
    FROM seasons
    WHERE is_active = true
    LIMIT 1;

    -- Get achievement IDs
    SELECT id INTO attacker_achievement_id
    FROM achievements
    WHERE name = 'Attacker of the Day';

    SELECT id INTO looter_achievement_id
    FROM achievements
    WHERE name = 'Looter of the Day';

    -- Find top attacker for yesterday
    SELECT user_id, attacks_count INTO top_attacker
    FROM daily_stats
    WHERE date = CURRENT_DATE - INTERVAL '1 day'
    ORDER BY attacks_count DESC
    LIMIT 1;

    -- Award attacker achievement
    IF top_attacker.user_id IS NOT NULL AND top_attacker.attacks_count > 0 THEN
        INSERT INTO user_achievements (user_id, achievement_id, season_number, metadata)
        VALUES (
            top_attacker.user_id,
            attacker_achievement_id,
            current_season,
            jsonb_build_object('attacks', top_attacker.attacks_count, 'date', CURRENT_DATE - INTERVAL '1 day')
        )
        ON CONFLICT (user_id, achievement_id, season_number) DO NOTHING;
    END IF;

    -- Find top looter for yesterday
    SELECT user_id, gold_stolen INTO top_looter
    FROM daily_stats
    WHERE date = CURRENT_DATE - INTERVAL '1 day'
    ORDER BY gold_stolen DESC
    LIMIT 1;

    -- Award looter achievement
    IF top_looter.user_id IS NOT NULL AND top_looter.gold_stolen > 0 THEN
        INSERT INTO user_achievements (user_id, achievement_id, season_number, metadata)
        VALUES (
            top_looter.user_id,
            looter_achievement_id,
            current_season,
            jsonb_build_object('gold_stolen', top_looter.gold_stolen, 'date', CURRENT_DATE - INTERVAL '1 day')
        )
        ON CONFLICT (user_id, achievement_id, season_number) DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: check_rank_achievements
-- =====================================================
CREATE OR REPLACE FUNCTION check_rank_achievements(target_user_id UUID)
RETURNS void AS $$
DECLARE
    current_season INTEGER;
    user_rank INTEGER;
BEGIN
    -- Get current active season
    SELECT season_number INTO current_season
    FROM seasons
    WHERE is_active = true
    LIMIT 1;

    -- Get user's current rank
    SELECT overall_rank INTO user_rank
    FROM leaderboard
    WHERE id = target_user_id;

    -- Award achievements based on rank
    -- Top 100
    IF user_rank <= 100 THEN
        INSERT INTO user_achievements (user_id, achievement_id, season_number)
        SELECT target_user_id, id, current_season
        FROM achievements
        WHERE name = 'Elite Hundred'
        ON CONFLICT (user_id, achievement_id, season_number) DO NOTHING;
    END IF;

    -- Top 50
    IF user_rank <= 50 THEN
        INSERT INTO user_achievements (user_id, achievement_id, season_number)
        SELECT target_user_id, id, current_season
        FROM achievements
        WHERE name = 'Elite Fifty'
        ON CONFLICT (user_id, achievement_id, season_number) DO NOTHING;
    END IF;

    -- Top 10
    IF user_rank <= 10 THEN
        INSERT INTO user_achievements (user_id, achievement_id, season_number)
        SELECT target_user_id, id, current_season
        FROM achievements
        WHERE name = 'Elite Ten'
        ON CONFLICT (user_id, achievement_id, season_number) DO NOTHING;
    END IF;

    -- Rank 1
    IF user_rank = 1 THEN
        INSERT INTO user_achievements (user_id, achievement_id, season_number)
        SELECT target_user_id, id, current_season
        FROM achievements
        WHERE name = 'Supreme Ruler'
        ON CONFLICT (user_id, achievement_id, season_number) DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: end_season
-- =====================================================
CREATE OR REPLACE FUNCTION end_season(cooldown_hours INTEGER DEFAULT 3)
RETURNS void AS $$
DECLARE
    current_season_record RECORD;
    user_record RECORD;
    achievement_id UUID;
BEGIN
    -- Get current active season
    SELECT * INTO current_season_record
    FROM seasons
    WHERE is_active = true
    LIMIT 1;

    IF current_season_record IS NULL THEN
        RAISE EXCEPTION 'No active season found';
    END IF;

    -- Award legacy achievements based on final ranks
    FOR user_record IN
        SELECT id, overall_rank
        FROM leaderboard
        ORDER BY overall_rank
    LOOP
        -- Determine which achievement to award
        IF user_record.overall_rank = 1 THEN
            SELECT id INTO achievement_id FROM achievements WHERE name = 'Season Champion';
        ELSIF user_record.overall_rank <= 10 THEN
            SELECT id INTO achievement_id FROM achievements WHERE name = 'Season Elite';
        ELSIF user_record.overall_rank <= 50 THEN
            SELECT id INTO achievement_id FROM achievements WHERE name = 'Season Contender';
        ELSIF user_record.overall_rank <= 100 THEN
            SELECT id INTO achievement_id FROM achievements WHERE name = 'Season Participant';
        ELSE
            CONTINUE;
        END IF;

        -- Award season-end achievement
        INSERT INTO season_end_achievements (user_id, season_number, final_rank, achievement_id)
        VALUES (user_record.id, current_season_record.season_number, user_record.overall_rank, achievement_id)
        ON CONFLICT (user_id, season_number) DO NOTHING;

        -- Also add to user_achievements for display
        INSERT INTO user_achievements (user_id, achievement_id, season_number, metadata)
        VALUES (
            user_record.id,
            achievement_id,
            current_season_record.season_number,
            jsonb_build_object('final_rank', user_record.overall_rank)
        )
        ON CONFLICT (user_id, achievement_id, season_number) DO NOTHING;
    END LOOP;

    -- Mark season as ended and set cooldown
    UPDATE seasons
    SET 
        is_active = false,
        end_date = NOW(),
        cooldown_until = NOW() + (cooldown_hours || ' hours')::INTERVAL
    WHERE id = current_season_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: start_new_season
-- =====================================================
CREATE OR REPLACE FUNCTION start_new_season(target_month INTEGER, target_year INTEGER)
RETURNS UUID AS $$
DECLARE
    new_season_id UUID;
    new_season_number INTEGER;
    last_season RECORD;
BEGIN
    -- Get the last season
    SELECT * INTO last_season
    FROM seasons
    ORDER BY season_number DESC
    LIMIT 1;

    -- Check if cooldown period has passed
    IF last_season.cooldown_until IS NOT NULL AND NOW() < last_season.cooldown_until THEN
        RAISE EXCEPTION 'Cooldown period has not expired yet. Wait until %', last_season.cooldown_until;
    END IF;

    -- Calculate new season number
    IF last_season IS NULL THEN
        new_season_number := 1;
    ELSE
        new_season_number := last_season.season_number + 1;
    END IF;

    -- Create new season
    INSERT INTO seasons (season_number, month, year, start_date, is_active)
    VALUES (
        new_season_number,
        target_month,
        target_year,
        NOW(),
        true
    )
    RETURNING id INTO new_season_id;

    RETURN new_season_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: get_user_achievements
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_achievements(target_user_id UUID)
RETURNS TABLE (
    achievement_name TEXT,
    description TEXT,
    type TEXT,
    category TEXT,
    icon TEXT,
    rarity TEXT,
    earned_at TIMESTAMPTZ,
    season_number INTEGER,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.name,
        a.description,
        a.type,
        a.category,
        a.icon,
        a.rarity,
        ua.earned_at,
        ua.season_number,
        ua.metadata
    FROM user_achievements ua
    JOIN achievements a ON ua.achievement_id = a.id
    WHERE ua.user_id = target_user_id
    ORDER BY ua.earned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VIEW: daily_leaderboard
-- =====================================================
CREATE OR REPLACE VIEW daily_leaderboard AS
SELECT 
    ds.user_id,
    ds.date,
    ds.attacks_count,
    ds.gold_stolen,
    p.username,
    ROW_NUMBER() OVER (PARTITION BY ds.date ORDER BY ds.attacks_count DESC) as attacker_rank,
    ROW_NUMBER() OVER (PARTITION BY ds.date ORDER BY ds.gold_stolen DESC) as looter_rank
FROM daily_stats ds
LEFT JOIN profiles p ON ds.user_id = p.id
WHERE ds.date >= CURRENT_DATE - INTERVAL '7 days';

-- =====================================================
-- INSERT DEFAULT ACHIEVEMENTS
-- =====================================================
INSERT INTO achievements (name, description, type, category, icon, rarity, requirement) VALUES
-- Daily Achievements
('Attacker of the Day', 'Most attacks in a single day', 'daily', 'attacker', '🗡️', 'rare', '{"attacks": 1}'::jsonb),
('Looter of the Day', 'Most gold stolen in a single day', 'daily', 'looter', '💰', 'rare', '{"gold_stolen": 1}'::jsonb),

-- Seasonal Achievements
('Elite Hundred', 'Reach Top 100 rank', 'seasonal', 'rank', '🏅', 'common', '{"rank": 100}'::jsonb),
('Elite Fifty', 'Reach Top 50 rank', 'seasonal', 'rank', '🥉', 'rare', '{"rank": 50}'::jsonb),
('Elite Ten', 'Reach Top 10 rank', 'seasonal', 'rank', '🥈', 'epic', '{"rank": 10}'::jsonb),
('Supreme Ruler', 'Reach #1 rank', 'seasonal', 'rank', '👑', 'legendary', '{"rank": 1}'::jsonb),

-- Legacy Achievements (Season-End)
('Season Champion', 'Finished #1 in a season', 'legacy', 'rank', '🏆', 'legendary', '{"rank": 1}'::jsonb),
('Season Elite', 'Finished Top 10 in a season', 'legacy', 'rank', '⭐', 'epic', '{"rank": 10}'::jsonb),
('Season Contender', 'Finished Top 50 in a season', 'legacy', 'rank', '🎖️', 'rare', '{"rank": 50}'::jsonb),
('Season Participant', 'Finished Top 100 in a season', 'legacy', 'rank', '🎗️', 'common', '{"rank": 100}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- CREATE INITIAL SEASON (if none exists)
-- =====================================================
INSERT INTO seasons (season_number, month, year, start_date, is_active)
SELECT 1, EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, NOW(), true
WHERE NOT EXISTS (SELECT 1 FROM seasons);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT SELECT ON seasons TO authenticated;
GRANT SELECT ON achievements TO authenticated;
GRANT SELECT, INSERT ON user_achievements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON daily_stats TO authenticated;
GRANT SELECT ON season_end_achievements TO authenticated;
GRANT SELECT ON daily_leaderboard TO authenticated;

-- Done! Achievement system is ready.
