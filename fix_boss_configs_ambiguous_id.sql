-- Fix the get_boss_configs function to avoid ambiguous column reference
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
    SELECT p.is_admin INTO v_is_admin
    FROM profiles p
    WHERE p.id = v_user_id;
    
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
