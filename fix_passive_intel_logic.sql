CREATE OR REPLACE FUNCTION get_passive_intel(target_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_my_stats record;
    v_target_stats record;
    v_visible boolean;
    v_gold bigint;
    v_is_admin boolean;
BEGIN
    v_user_id := auth.uid();
    
    -- Check if user is admin
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = v_user_id;
    
    -- Get my stats
    SELECT * INTO v_my_stats FROM user_stats WHERE id = v_user_id;
    
    -- Get target stats
    SELECT * INTO v_target_stats FROM user_stats WHERE id = target_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false);
    END IF;

    -- Logic: Strict Spy > Sentry
    -- Compare Spy Stat vs Sentry Stat
    IF (COALESCE(v_my_stats.spy, 0) > COALESCE(v_target_stats.sentry, 0)) OR (v_user_id = target_id) OR (v_is_admin = true) THEN
        v_visible := true;
        v_gold := v_target_stats.gold;
    ELSE
        v_visible := false;
    END IF;
    
    IF v_visible THEN
        RETURN json_build_object(
            'success', true,
            'gold', v_gold
        );
    ELSE
        RETURN json_build_object('success', false);
    END IF;
END;
$$;
