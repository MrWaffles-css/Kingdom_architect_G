-- Create game mechanics settings table
CREATE TABLE IF NOT EXISTS game_mechanics (
    key TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default mechanics
INSERT INTO game_mechanics (key, enabled, description) VALUES
    ('vault_stealing', true, 'Allow players to steal from vaults with research'),
    ('hostage_system', true, 'Enable hostage taking and conversion mechanics'),
    ('alliance_system', true, 'Enable alliance creation and management'),
    ('boss_fights', true, 'Enable boss raid system'),
    ('spy_reports', true, 'Enable spy intelligence gathering')
ON CONFLICT (key) DO NOTHING;

-- Function to get a specific mechanic setting
CREATE OR REPLACE FUNCTION get_mechanic_enabled(p_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_enabled BOOLEAN;
BEGIN
    SELECT enabled INTO v_enabled
    FROM game_mechanics
    WHERE key = p_key;
    
    -- Default to true if not found
    RETURN COALESCE(v_enabled, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle a mechanic (admin only)
CREATE OR REPLACE FUNCTION toggle_mechanic(p_key TEXT, p_enabled BOOLEAN)
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
    
    -- Update or insert the mechanic
    INSERT INTO game_mechanics (key, enabled, updated_at)
    VALUES (p_key, p_enabled, NOW())
    ON CONFLICT (key) DO UPDATE
    SET enabled = p_enabled, updated_at = NOW();
    
    RETURN jsonb_build_object('success', true, 'key', p_key, 'enabled', p_enabled);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all mechanics (admin only)
CREATE OR REPLACE FUNCTION get_all_mechanics()
RETURNS TABLE (
    key TEXT,
    enabled BOOLEAN,
    description TEXT,
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
    SELECT gm.key, gm.enabled, gm.description, gm.updated_at
    FROM game_mechanics gm
    ORDER BY gm.key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
