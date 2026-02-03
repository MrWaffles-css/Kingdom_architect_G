-- Update boss fight functions to use boss_configs table instead of hardcoded bosses table

-- Update start_boss_fight to use boss_configs
CREATE OR REPLACE FUNCTION start_boss_fight(p_boss_id INTEGER, p_target_fights INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_stats RECORD;
    v_boss RECORD;
    v_total_stats BIGINT;
    v_max_defeated INTEGER;
    v_last_claim_time TIMESTAMPTZ;
BEGIN
    -- Check if user is already fighting
    IF EXISTS (SELECT 1 FROM user_boss_fights WHERE user_id = v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'You already have an active boss fight.');
    END IF;

    -- Get Boss Data from boss_configs
    SELECT * INTO v_boss FROM boss_configs WHERE id = p_boss_id;
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

    -- Set last_claim_time to NOW()
    v_last_claim_time := NOW();

    -- Insert active fight
    INSERT INTO user_boss_fights (user_id, boss_id, start_time, last_claim_time, target_fights, total_fights_done)
    VALUES (v_user_id, p_boss_id, NOW(), v_last_claim_time, p_target_fights, 0);

    -- Return the fight data with the exact last_claim_time
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Fight started!', 
        'fight', jsonb_build_object(
            'user_id', v_user_id,
            'boss_id', p_boss_id,
            'start_time', NOW(),
            'last_claim_time', v_last_claim_time,
            'target_fights', p_target_fights,
            'total_fights_done', 0
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update process_boss_fight to use boss_configs
CREATE OR REPLACE FUNCTION process_boss_fight()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_fight RECORD;
    v_boss RECORD;
    v_stats RECORD;
    v_loops_possible INTEGER;
    v_loops_to_do INTEGER;
    v_turns_needed INTEGER;
    v_new_claim_time TIMESTAMPTZ;
    v_status TEXT := 'active';
    v_rewards_gold BIGINT := 0;
    v_rewards_xp BIGINT := 0;
    v_rewards_citizens BIGINT := 0;
    v_fights_processed INTEGER := 0;
BEGIN
    -- Get active fight
    SELECT * INTO v_fight FROM user_boss_fights WHERE user_id = v_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'status', 'finished');
    END IF;

    -- Get Boss Data from boss_configs
    SELECT * INTO v_boss FROM boss_configs WHERE id = v_fight.boss_id;

    -- Get User Stats
    SELECT * INTO v_stats FROM user_stats WHERE id = v_user_id;

    -- Calculate how many loops are mathematically possible by time
    v_loops_possible := FLOOR(EXTRACT(EPOCH FROM (NOW() - v_fight.last_claim_time)) / v_boss.duration_seconds);
    
    IF v_loops_possible <= 0 THEN
        RETURN jsonb_build_object(
            'success', true, 
            'status', 'active', 
            'next_claim_time', v_fight.last_claim_time + (interval '1 second' * v_boss.duration_seconds),
            'fights_done', v_fight.total_fights_done
        );
    END IF;

    -- Determine how many we can actually afford/need
    v_loops_to_do := 0;
    
    FOR i IN 1..v_loops_possible LOOP
        -- Check Target Limit
        IF v_fight.target_fights IS NOT NULL AND (v_fight.total_fights_done + v_loops_to_do) >= v_fight.target_fights THEN
            EXIT;
        END IF;

        -- Check Cost (skip first fight as it was already paid)
        IF (v_fight.total_fights_done + v_loops_to_do) > 0 THEN
            IF v_stats.turns < v_boss.cost_turns THEN
                v_status := 'finished_no_turns';
                EXIT;
            END IF;
            v_stats.turns := v_stats.turns - v_boss.cost_turns;
        END IF;

        v_loops_to_do := v_loops_to_do + 1;
    END LOOP;

    IF v_loops_to_do = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', v_status,
            'fights_processed', 0,
            'next_claim_time', v_fight.last_claim_time + (interval '1 second' * v_boss.duration_seconds),
            'fights_done', v_fight.total_fights_done
        );
    END IF;

    -- Calculate rewards
    v_rewards_gold := v_boss.reward_gold * v_loops_to_do;
    v_rewards_xp := v_boss.reward_xp * v_loops_to_do;
    v_rewards_citizens := v_boss.reward_citizens * v_loops_to_do;
    v_fights_processed := v_loops_to_do;

    -- Update user stats
    UPDATE user_stats
    SET 
        gold = gold + v_rewards_gold,
        xp = xp + v_rewards_xp,
        citizens = citizens + v_rewards_citizens,
        turns = v_stats.turns,
        max_boss_defeated = GREATEST(COALESCE(max_boss_defeated, 0), v_fight.boss_id)
    WHERE id = v_user_id;

    -- Update boss kills
    INSERT INTO user_boss_kills (user_id, boss_id, kill_count)
    VALUES (v_user_id, v_fight.boss_id, v_loops_to_do)
    ON CONFLICT (user_id, boss_id) 
    DO UPDATE SET kill_count = user_boss_kills.kill_count + v_loops_to_do;

    -- Calculate new claim time
    v_new_claim_time := v_fight.last_claim_time + (interval '1 second' * (v_boss.duration_seconds * v_loops_to_do));

    -- Check if finished
    IF v_fight.target_fights IS NOT NULL AND (v_fight.total_fights_done + v_loops_to_do) >= v_fight.target_fights THEN
        v_status := 'finished';
        DELETE FROM user_boss_fights WHERE user_id = v_user_id;
    ELSIF v_status = 'finished_no_turns' THEN
        DELETE FROM user_boss_fights WHERE user_id = v_user_id;
    ELSE
        UPDATE user_boss_fights
        SET 
            last_claim_time = v_new_claim_time,
            total_fights_done = total_fights_done + v_loops_to_do
        WHERE user_id = v_user_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'status', v_status,
        'fights_processed', v_fights_processed,
        'rewards', jsonb_build_object(
            'gold', v_rewards_gold,
            'xp', v_rewards_xp,
            'citizens', v_rewards_citizens
        ),
        'next_claim_time', v_new_claim_time,
        'fights_done', v_fight.total_fights_done + v_loops_to_do
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
