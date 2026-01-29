-- Add Boss Kill Counts
-- 1. Create table to track kills
CREATE TABLE IF NOT EXISTS user_boss_kills (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    boss_id INTEGER REFERENCES bosses(id),
    kill_count INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, boss_id)
);

ALTER TABLE user_boss_kills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own boss kills" ON user_boss_kills
    FOR SELECT USING (auth.uid() = user_id);

-- 2. Update process_boss_fight to update kill counts
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

    -- Get Boss Data
    SELECT * INTO v_boss FROM bosses WHERE id = v_fight.boss_id;

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
        -- Check Target Limit (if not infinite)
        IF v_fight.target_fights IS NOT NULL AND (v_fight.total_fights_done + v_loops_to_do) >= v_fight.target_fights THEN
            EXIT; -- Reached limit
        END IF;

        v_turns_needed := 0;
        IF (v_fight.total_fights_done + v_loops_to_do) >= 1 THEN
             v_turns_needed := v_boss.cost_turns;
        END IF;
        
        IF v_stats.turns < v_turns_needed THEN
            EXIT; -- Ran out of turns
        END IF;
        
        -- Deduct turns
        IF v_turns_needed > 0 THEN
            UPDATE user_stats SET turns = turns - v_turns_needed WHERE id = v_user_id;
            v_stats.turns := v_stats.turns - v_turns_needed; -- Update local variable
        END IF;
        
        -- Accumulate Rewards
        v_rewards_gold := v_rewards_gold + v_boss.reward_gold;
        v_rewards_xp := v_rewards_xp + v_boss.reward_xp;
        v_rewards_citizens := v_rewards_citizens + v_boss.reward_citizens;
        
        v_loops_to_do := v_loops_to_do + 1;
    END LOOP;

    -- Apply Rewards
    IF v_loops_to_do > 0 THEN
        -- Add Gold to Vault (Directly)
        UPDATE user_stats 
        SET vault = vault + v_rewards_gold,
            experience = experience + v_rewards_xp,
            citizens = citizens + v_rewards_citizens,
            max_boss_defeated = GREATEST(COALESCE(max_boss_defeated, 0), v_boss.id)
        WHERE id = v_user_id;
        
        -- Update Fight State
        UPDATE user_boss_fights
        SET last_claim_time = last_claim_time + (interval '1 second' * v_boss.duration_seconds * v_loops_to_do),
            total_fights_done = total_fights_done + v_loops_to_do
        WHERE user_id = v_user_id;
        
        -- Update Kill Count (New)
        INSERT INTO user_boss_kills (user_id, boss_id, kill_count)
        VALUES (v_user_id, v_boss.id, v_loops_to_do)
        ON CONFLICT (user_id, boss_id) 
        DO UPDATE SET kill_count = user_boss_kills.kill_count + EXCLUDED.kill_count;
        
        v_fights_processed := v_loops_to_do;
    END IF;
    
    -- Check if we finished the target or ran out of turns for the NEXT one
    SELECT * INTO v_fight FROM user_boss_fights WHERE user_id = v_user_id; -- Refresh
    
    IF v_fight.target_fights IS NOT NULL AND v_fight.total_fights_done >= v_fight.target_fights THEN
        DELETE FROM user_boss_fights WHERE user_id = v_user_id;
        v_status := 'finished';
    ELSIF v_stats.turns < v_boss.cost_turns THEN
        DELETE FROM user_boss_fights WHERE user_id = v_user_id;
        v_status := 'finished_no_turns';
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
        'next_claim_time', v_fight.last_claim_time + (interval '1 second' * v_boss.duration_seconds)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
