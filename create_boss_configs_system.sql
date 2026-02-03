-- Create boss configurations table
CREATE TABLE IF NOT EXISTS boss_configs (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    req_total_stats INTEGER NOT NULL,
    cost_turns INTEGER NOT NULL DEFAULT 1,
    duration_seconds INTEGER NOT NULL,
    reward_xp INTEGER NOT NULL,
    reward_gold INTEGER NOT NULL,
    reward_citizens INTEGER NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default boss configurations from the game data
INSERT INTO boss_configs (id, name, req_total_stats, cost_turns, duration_seconds, reward_xp, reward_gold, reward_citizens) VALUES
    (1, 'Rat King', 50, 1, 10, 1, 100, 1),
    (2, 'Goblin Chief', 250, 1, 20, 2, 500, 2),
    (3, 'Bandit Leader', 1000, 1, 30, 3, 1000, 3),
    (4, 'Orc Warlord', 3000, 1, 40, 4, 3000, 4),
    (5, 'Troll Berserker', 6500, 1, 50, 5, 6500, 5),
    (6, 'Giant Spider', 10000, 1, 60, 6, 10000, 6),
    (7, 'Dark Sorcerer', 150000, 1, 90, 7, 15000, 8),
    (8, 'Undead Knight', 200000, 1, 120, 8, 20000, 10),
    (9, 'Golem Guardian', 300000, 1, 150, 9, 30000, 12),
    (10, 'Chimera', 500000, 1, 180, 10, 50000, 14),
    (11, 'Wyvern', 1000000, 1, 240, 12, 100000, 16),
    (12, 'Cyclops', 2000000, 1, 300, 14, 200000, 20),
    (13, 'Hydra', 5000000, 1, 360, 16, 500000, 25),
    (14, 'Minotaur Lord', 10000000, 1, 420, 18, 1000000, 30),
    (15, 'Vampire Lord', 20000000, 1, 480, 20, 2000000, 35),
    (16, 'Lich', 21400000, 1, 540, 25, 2140000, 40),
    (17, 'Kraken', 26000000, 1, 600, 30, 2600000, 45),
    (18, 'Phoenix', 30600000, 1, 660, 35, 3060000, 50),
    (19, 'Behemoth', 35200000, 1, 720, 40, 3520000, 60),
    (20, 'Leviathan', 39800000, 1, 780, 45, 3980000, 70),
    (21, 'Demon Prince', 44400000, 1, 840, 50, 4440000, 80),
    (22, 'Archangel', 49000000, 1, 900, 55, 4900000, 90),
    (23, 'Titan', 53600000, 1, 960, 60, 5360000, 100),
    (24, 'Dragon Lord', 58200000, 1, 1080, 65, 5820000, 150),
    (25, 'Void Entity', 62800000, 1, 1200, 70, 6280000, 200),
    (26, 'Chaos God', 67400000, 1, 1320, 75, 6740000, 250),
    (27, 'Time Keeper', 72000000, 1, 1440, 80, 7200000, 300),
    (28, 'World Eater', 76600000, 1, 1560, 85, 7660000, 400),
    (29, 'Star Destroyer', 81200000, 1, 1680, 90, 8120000, 500),
    (30, 'Universe END', 85800000, 1, 1800, 100, 8580000, 600)
ON CONFLICT (id) DO NOTHING;

-- Function to get all boss configurations (admin only)
CREATE OR REPLACE FUNCTION get_boss_configs()
RETURNS TABLE (
    id INTEGER,
    name TEXT,
    req_total_stats INTEGER,
    cost_turns INTEGER,
    duration_seconds INTEGER,
    reward_xp INTEGER,
    reward_gold INTEGER,
    reward_citizens INTEGER,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_admin BOOLEAN;
BEGIN
    -- Check if user is admin
    SELECT is_admin INTO v_is_admin
    FROM profiles
    WHERE id = v_user_id;
    
    IF NOT COALESCE(v_is_admin, false) THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;
    
    RETURN QUERY
    SELECT bc.id, bc.name, bc.req_total_stats, bc.cost_turns, bc.duration_seconds,
           bc.reward_xp, bc.reward_gold, bc.reward_citizens, bc.updated_at
    FROM boss_configs bc
    ORDER BY bc.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update a boss configuration (admin only)
CREATE OR REPLACE FUNCTION update_boss_config(
    p_id INTEGER,
    p_name TEXT,
    p_req_total_stats INTEGER,
    p_cost_turns INTEGER,
    p_duration_seconds INTEGER,
    p_reward_xp INTEGER,
    p_reward_gold INTEGER,
    p_reward_citizens INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_admin BOOLEAN;
BEGIN
    -- Check if user is admin
    SELECT is_admin INTO v_is_admin
    FROM profiles
    WHERE id = v_user_id;
    
    IF NOT COALESCE(v_is_admin, false) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Admin access required');
    END IF;
    
    -- Validate inputs
    IF p_req_total_stats < 0 OR p_cost_turns < 0 OR p_duration_seconds < 1 OR
       p_reward_xp < 0 OR p_reward_gold < 0 OR p_reward_citizens < 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid values: all numbers must be positive');
    END IF;
    
    -- Update the boss configuration
    UPDATE boss_configs
    SET name = p_name,
        req_total_stats = p_req_total_stats,
        cost_turns = p_cost_turns,
        duration_seconds = p_duration_seconds,
        reward_xp = p_reward_xp,
        reward_gold = p_reward_gold,
        reward_citizens = p_reward_citizens,
        updated_at = NOW()
    WHERE id = p_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Boss not found');
    END IF;
    
    RETURN jsonb_build_object('success', true, 'message', 'Boss updated successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get boss config by ID (used by frontend)
CREATE OR REPLACE FUNCTION get_boss_by_id(p_boss_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    name TEXT,
    req_total_stats INTEGER,
    cost_turns INTEGER,
    duration_seconds INTEGER,
    reward_xp INTEGER,
    reward_gold INTEGER,
    reward_citizens INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT bc.id, bc.name, bc.req_total_stats, bc.cost_turns, bc.duration_seconds,
           bc.reward_xp, bc.reward_gold, bc.reward_citizens
    FROM boss_configs bc
    WHERE bc.id = p_boss_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all bosses (used by frontend for display)
CREATE OR REPLACE FUNCTION get_all_bosses()
RETURNS TABLE (
    id INTEGER,
    name TEXT,
    req_total_stats INTEGER,
    cost_turns INTEGER,
    duration_seconds INTEGER,
    reward_xp INTEGER,
    reward_gold INTEGER,
    reward_citizens INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT bc.id, bc.name, bc.req_total_stats, bc.cost_turns, bc.duration_seconds,
           bc.reward_xp, bc.reward_gold, bc.reward_citizens
    FROM boss_configs bc
    ORDER BY bc.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
