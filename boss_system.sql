-- Bosses System Migration Script

-- 1. Add `max_boss_defeated` to user_stats if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_stats' AND column_name = 'max_boss_defeated') THEN
        ALTER TABLE user_stats ADD COLUMN max_boss_defeated INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. Create `bosses` table
CREATE TABLE IF NOT EXISTS bosses (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    req_total_stats BIGINT NOT NULL,
    cost_turns INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    reward_xp BIGINT NOT NULL,
    reward_gold BIGINT NOT NULL,
    reward_citizens BIGINT NOT NULL
);

-- 3. Seed Bosses Data (Upsert)
INSERT INTO bosses (id, name, req_total_stats, cost_turns, duration_seconds, reward_xp, reward_gold, reward_citizens) VALUES
(1, 'Rat King', 100, 1, 10, 1, 10, 1),
(2, 'Goblin Chief', 1000, 2, 20, 2, 100, 2),
(3, 'Bandit Leader', 10000, 3, 30, 3, 1000, 3),
(4, 'Orc Warlord', 30000, 4, 40, 4, 3000, 4),
(5, 'Troll Berserker', 65000, 5, 50, 5, 6500, 5),
(6, 'Giant Spider', 100000, 6, 60, 6, 10000, 6),
(7, 'Dark Sorcerer', 150000, 7, 90, 7, 15000, 8),
(8, 'Undead Knight', 200000, 8, 120, 8, 20000, 10),
(9, 'Golem Guardian', 300000, 9, 150, 9, 30000, 12),
(10, 'Chimera', 500000, 10, 180, 10, 50000, 14),
(11, 'Wyvern', 1000000, 11, 240, 12, 100000, 16),
(12, 'Cyclops', 2000000, 12, 300, 14, 200000, 20),
(13, 'Hydra', 5000000, 13, 360, 16, 500000, 25),
(14, 'Minotaur Lord', 10000000, 14, 420, 18, 1000000, 30),
(15, 'Vampire Lord', 20000000, 15, 480, 20, 2000000, 35),
(16, 'Lich', 21400000, 16, 540, 25, 2140000, 40),
(17, 'Kraken', 26000000, 17, 600, 30, 2600000, 45),
(18, 'Phoenix', 30600000, 18, 660, 35, 3060000, 50),
(19, 'Behemoth', 35200000, 19, 720, 40, 3520000, 60),
(20, 'Leviathan', 39800000, 20, 780, 45, 3980000, 70),
(21, 'Demon Prince', 44400000, 21, 840, 50, 4440000, 80),
(22, 'Archangel', 49000000, 22, 900, 55, 4900000, 90),
(23, 'Titan', 53600000, 23, 960, 60, 5360000, 100),
(24, 'Dragon Lord', 58200000, 24, 1080, 65, 5820000, 150),
(25, 'Void Entity', 62800000, 25, 1200, 70, 6280000, 200),
(26, 'Chaos God', 67400000, 26, 1320, 75, 6740000, 250),
(27, 'Time Keeper', 72000000, 27, 1440, 80, 7200000, 300),
(28, 'World Eater', 76600000, 28, 1560, 85, 7660000, 400),
(29, 'Star Destroyer', 81200000, 29, 1680, 90, 8120000, 500),
(30, 'Universe END', 85800000, 30, 1800, 100, 8580000, 600)
ON CONFLICT (id) DO UPDATE SET
name = EXCLUDED.name,
req_total_stats = EXCLUDED.req_total_stats,
cost_turns = EXCLUDED.cost_turns,
duration_seconds = EXCLUDED.duration_seconds,
reward_xp = EXCLUDED.reward_xp,
reward_gold = EXCLUDED.reward_gold,
reward_citizens = EXCLUDED.reward_citizens;


-- 4. Create `user_boss_fights` table
CREATE TABLE IF NOT EXISTS user_boss_fights (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    boss_id INTEGER NOT NULL REFERENCES bosses(id),
    start_time TIMESTAMPTZ DEFAULT NOW(),
    last_claim_time TIMESTAMPTZ DEFAULT NOW(),
    total_fights_done INTEGER DEFAULT 0,
    target_fights INTEGER, -- NULL means Infinite
    status TEXT DEFAULT 'active'
);

-- 5. RPC: start_boss_fight
CREATE OR REPLACE FUNCTION start_boss_fight(p_boss_id INTEGER, p_target_fights INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_stats RECORD;
    v_boss RECORD;
    v_total_stats BIGINT;
    v_max_defeated INTEGER;
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

    -- Insert active fight
    INSERT INTO user_boss_fights (user_id, boss_id, start_time, last_claim_time, target_fights, total_fights_done)
    VALUES (v_user_id, p_boss_id, NOW(), NOW(), p_target_fights, 0);

    RETURN jsonb_build_object('success', true, 'message', 'Fight started!', 'boss', v_boss);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. RPC: cancel_boss_fight
CREATE OR REPLACE FUNCTION cancel_boss_fight()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    DELETE FROM user_boss_fights WHERE user_id = v_user_id;
    RETURN jsonb_build_object('success', true, 'message', 'Fight cancelled.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. RPC: process_boss_fight (Auto-Claim Logic)
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
    -- Uses last_claim_time to determine progress since last check
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
    
    -- We assume the FIRST fight's turns were paid on START.
    -- So for subsequent fights, we pay turns.
    -- Wait, if `total_fights_done` == 0, that means we are completing the FIRST fight.
    -- The first fight was paid for at START.
    -- Subsequent fights (loop 2, 3...) need payment.
    
    FOR i IN 1..v_loops_possible LOOP
        -- Check Target Limit (if not infinite)
        IF v_fight.target_fights IS NOT NULL AND (v_fight.total_fights_done + v_loops_to_do) >= v_fight.target_fights THEN
            EXIT; -- Reached limit
        END IF;

        -- Check Cost (Only if NOT the very first fight completion? No, wait)
        -- Logic:
        -- Start: Pay for Fight #1.
        -- Process (Time passed for #1): Complete #1. (No cost).
        -- Process (Time passed for #2): Need to pay for #2.
        
        -- So if (total_fights_done + v_loops_to_do) > 0, we need to pay turns for the NEXT one we are starting?
        -- Actually, simpler model:
        -- We are completing a fight.
        -- If it was paid for, we grant rewards.
        -- Then we try to start next one if turns available.
        -- This is getting complex with "bulk" processing.
        
        -- Alternative Bulk Logic:
        -- 1. We have N potential completions.
        -- 2. Let `current_completed` = `total_fights_done`.
        -- 3. For k = 0 to N-1:
        --      Fight index = `current_completed` + k + 1.
        --      If Fight index == 1: Cost is 0 (paid at start).
        --      If Fight index > 1: Cost is `v_boss.cost_turns`.
        --      Check turns >= Cost. If not, STOP.
        --      Accumulate Rewards.
        --      Deduct Cost.
        --      `loops_to_do++`.
        
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
        
        v_fights_processed := v_loops_to_do;
    END IF;
    
    -- Check if we finished the target or ran out of turns for the NEXT one
    SELECT * INTO v_fight FROM user_boss_fights WHERE user_id = v_user_id; -- Refresh
    
    -- Condition to end:
    -- 1. Reached Target
    IF v_fight.target_fights IS NOT NULL AND v_fight.total_fights_done >= v_fight.target_fights THEN
        DELETE FROM user_boss_fights WHERE user_id = v_user_id;
        v_status := 'finished';
    -- 2. Can't afford next one (and we are not currently waiting for one that was paid)
    -- We just completed a batch. The "Current" fight is technically "Started" if we have time left over?
    -- No, if we processed N loops, we advanced `last_claim_time`.
    -- If `last_claim_time` is still in the past (unlikely loop logic above consumes all possible time), we might have partial progress.
    -- But if we stopped because of Turns, we literally cannot pay for the next one.
    -- We only paid for completed ones (except the first).
    -- If we are at Fight #5, and we finished it. Fight #6 costs turns.
    -- If v_stats.turns < v_boss.cost_turns, we cannot start #6.
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
