-- RPC to get passive intel on a player (Gold) if spies are strong enough
-- Matches logic in get_battle_opponents

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
BEGIN
    v_user_id := auth.uid();
    
    -- Get my stats
    SELECT * INTO v_my_stats FROM user_stats WHERE id = v_user_id;
    
    -- Get target stats
    SELECT * INTO v_target_stats FROM user_stats WHERE id = target_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false);
    END IF;

    -- Logic: If my Spy > Target Sentry (plus variance), I see gold
    -- We'll use a simplified check here: Spy * 1.0 > Sentry * 1.0
    -- To align with battle opponents which uses (my.spy * (0.8+rand)) > (their.sentry * ...)
    -- Since this is a static check for profile, we can be slightly generous or strict.
    -- Let's stick to the base values for stability: Spy > Sentry.
    
    IF (v_my_stats.spy > v_target_stats.sentry) OR (v_user_id = target_id) THEN
        v_visible := true;
        v_gold := v_target_stats.gold;
    ELSE
        -- Admin always sees?
        IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND is_admin = true) THEN
            v_visible := true;
            v_gold := v_target_stats.gold;
        ELSE
            v_visible := false;
        END IF;
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
