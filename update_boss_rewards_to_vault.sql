CREATE OR REPLACE FUNCTION process_boss_fight()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_fight RECORD;
    v_boss RECORD;
    v_stats RECORD;
    v_loops_possible INTEGER;
    v_loops_to_do INTEGER;
    v_total_turns_cost INTEGER := 0;
    v_current_turns_snapshot INTEGER;
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
    v_current_turns_snapshot := v_stats.turns;

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
            IF (v_current_turns_snapshot - v_total_turns_cost) < v_boss.cost_turns THEN
                v_status := 'finished_no_turns';
                EXIT;
            END IF;
            v_total_turns_cost := v_total_turns_cost + v_boss.cost_turns;
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
        vault = COALESCE(vault, 0) + v_rewards_gold, -- Redirect gold to vault. COALESCE ensures we don't add to NULL.
        experience = experience + v_rewards_xp,
        citizens = citizens + v_rewards_citizens,
        turns = turns - v_total_turns_cost, -- Relative update to prevent lost updates
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
