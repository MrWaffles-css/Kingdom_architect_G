-- Fix Boss Fight Timer Sync Issue
-- This updates start_boss_fight to return the exact last_claim_time that was set,
-- preventing timing discrepancies from network latency

CREATE OR REPLACE FUNCTION start_boss_fight(p_boss_id INTEGER, p_target_fights INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_stats RECORD;
    v_boss RECORD;
    v_total_stats BIGINT;
    v_max_defeated INTEGER;
    v_start_time TIMESTAMPTZ;
BEGIN
    -- Check if user is already fighting
    IF EXISTS (SELECT 1 FROM user_boss_fights WHERE user_id = v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'You already have an active boss fight.');
    END IF;

    -- Get Boss Data
    SELECT * INTO v_boss FROM bosses WHERE id = p_boss_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Boss not found.');
    END IF;

    -- Get User Stats
    SELECT * INTO v_stats FROM user_stats WHERE id = v_user_id;
    v_max_defeated := COALESCE(v_stats.max_boss_defeated, 0);

    -- 1. Check Sequential Order
    IF p_boss_id > 1 AND v_max_defeated < (p_boss_id - 1) THEN
         RETURN jsonb_build_object('success', false, 'message', 'You must defeat the previous boss first.');
    END IF;

    -- 2. Check Requirements (Total Stats)
    v_total_stats := (v_stats.attack + v_stats.defense + v_stats.spy + v_stats.sentry);
    IF v_total_stats < v_boss.req_total_stats THEN
         RETURN jsonb_build_object('success', false, 'message', 'Your stats are too low for this boss.');
    END IF;

    -- 3. Check Turns (for FIRST fight)
    IF v_stats.turns < v_boss.cost_turns THEN
         RETURN jsonb_build_object('success', false, 'message', 'Not enough turns to start.');
    END IF;

    -- Deduct turns for the first fight
    UPDATE user_stats SET turns = turns - v_boss.cost_turns WHERE id = v_user_id;

    -- Capture the exact start time
    v_start_time := NOW();

    -- Insert active fight
    INSERT INTO user_boss_fights (user_id, boss_id, start_time, last_claim_time, target_fights, total_fights_done)
    VALUES (v_user_id, p_boss_id, v_start_time, v_start_time, p_target_fights, 0);

    -- Return the fight data including the exact timestamp
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Fight started!', 
        'boss', v_boss,
        'fight', jsonb_build_object(
            'user_id', v_user_id,
            'boss_id', p_boss_id,
            'start_time', v_start_time,
            'last_claim_time', v_start_time,
            'target_fights', p_target_fights,
            'total_fights_done', 0
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
