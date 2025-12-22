-- =====================================================
-- SPY REPORTS STORAGE SYSTEM
-- =====================================================
-- This script adds spy report storage so players can see
-- the last time they spied on someone with data staleness

-- =====================================================
-- TABLE: spy_reports
-- =====================================================
-- Stores the most recent spy report for each spy-target pair
CREATE TABLE IF NOT EXISTS spy_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spy_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Spy report data
    gold BIGINT,
    citizens INTEGER,
    attack BIGINT,
    defense BIGINT,
    spy BIGINT,
    sentry BIGINT,
    attack_soldiers INTEGER,
    defense_soldiers INTEGER,
    spies INTEGER,
    sentries INTEGER,
    
    -- Metadata
    spied_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One report per spy-target pair
    UNIQUE(spy_user_id, target_user_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_spy_reports_spy_user ON spy_reports(spy_user_id);
CREATE INDEX IF NOT EXISTS idx_spy_reports_target_user ON spy_reports(target_user_id);

-- =====================================================
-- FUNCTION: get_latest_spy_report
-- =====================================================
-- Gets the most recent spy report for a target user
CREATE OR REPLACE FUNCTION get_latest_spy_report(target_id UUID)
RETURNS TABLE (
    gold BIGINT,
    citizens INTEGER,
    attack BIGINT,
    defense BIGINT,
    spy BIGINT,
    sentry BIGINT,
    attack_soldiers INTEGER,
    defense_soldiers INTEGER,
    spies INTEGER,
    sentries INTEGER,
    spied_at TIMESTAMPTZ,
    hours_old NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.gold,
        sr.citizens,
        sr.attack,
        sr.defense,
        sr.spy,
        sr.sentry,
        sr.attack_soldiers,
        sr.defense_soldiers,
        sr.spies,
        sr.sentries,
        sr.spied_at,
        EXTRACT(EPOCH FROM (NOW() - sr.spied_at)) / 3600 AS hours_old
    FROM spy_reports sr
    WHERE sr.spy_user_id = auth.uid()
    AND sr.target_user_id = target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: get_battle_history
-- =====================================================
-- Gets recent battle history between current user and target
CREATE OR REPLACE FUNCTION get_battle_history(target_id UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    attacker_id UUID,
    defender_id UUID,
    attacker_name TEXT,
    defender_name TEXT,
    success BOOLEAN,
    gold_stolen BIGINT,
    attacker_casualties INTEGER,
    defender_casualties INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.attacker_id,
        r.defender_id,
        p1.username as attacker_name,
        p2.username as defender_name,
        r.success,
        r.gold_stolen,
        r.attacker_casualties,
        r.defender_casualties,
        r.created_at
    FROM reports r
    LEFT JOIN profiles p1 ON r.attacker_id = p1.id
    LEFT JOIN profiles p2 ON r.defender_id = p2.id
    WHERE (
        (r.attacker_id = auth.uid() AND r.defender_id = target_id)
        OR
        (r.attacker_id = target_id AND r.defender_id = auth.uid())
    )
    ORDER BY r.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- UPDATE: spy_player function to save reports
-- =====================================================
-- Drop existing function first, then recreate with report saving
DROP FUNCTION IF EXISTS spy_player(UUID);
CREATE OR REPLACE FUNCTION spy_player(target_id UUID)
RETURNS JSONB AS $$
DECLARE
    my_spy BIGINT;
    their_sentry BIGINT;
    target_stats RECORD;
    result JSONB;
BEGIN
    -- Get my spy rating
    SELECT spy INTO my_spy FROM user_stats WHERE id = auth.uid();
    
    -- Get target's sentry and stats
    SELECT * INTO target_stats FROM user_stats WHERE id = target_id;
    their_sentry := target_stats.sentry;
    
    -- Check if spy mission succeeds
    IF my_spy > their_sentry THEN
        -- Success - return full intel and save report
        result := jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'gold', target_stats.gold,
                'citizens', target_stats.citizens,
                'attack', target_stats.attack,
                'defense', target_stats.defense,
                'spy', target_stats.spy,
                'sentry', target_stats.sentry,
                'attack_soldiers', target_stats.attack_soldiers,
                'defense_soldiers', target_stats.defense_soldiers,
                'spies', target_stats.spies,
                'sentries', target_stats.sentries
            )
        );
        
        -- Save spy report to database
        INSERT INTO spy_reports (
            spy_user_id, target_user_id,
            gold, citizens, attack, defense, spy, sentry,
            attack_soldiers, defense_soldiers, spies, sentries,
            spied_at
        ) VALUES (
            auth.uid(), target_id,
            target_stats.gold, target_stats.citizens,
            target_stats.attack, target_stats.defense,
            target_stats.spy, target_stats.sentry,
            target_stats.attack_soldiers, target_stats.defense_soldiers,
            target_stats.spies, target_stats.sentries,
            NOW()
        )
        ON CONFLICT (spy_user_id, target_user_id)
        DO UPDATE SET
            gold = EXCLUDED.gold,
            citizens = EXCLUDED.citizens,
            attack = EXCLUDED.attack,
            defense = EXCLUDED.defense,
            spy = EXCLUDED.spy,
            sentry = EXCLUDED.sentry,
            attack_soldiers = EXCLUDED.attack_soldiers,
            defense_soldiers = EXCLUDED.defense_soldiers,
            spies = EXCLUDED.spies,
            sentries = EXCLUDED.sentries,
            spied_at = NOW();
        
        RETURN result;
    ELSE
        -- Failed - detected
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Your spies were detected! Their sentry rating is too high.'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT SELECT, INSERT, UPDATE ON spy_reports TO authenticated;

-- Done! Spy reports will now be saved and retrievable.
