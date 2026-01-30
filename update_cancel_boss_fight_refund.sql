CREATE OR REPLACE FUNCTION cancel_boss_fight()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_fight RECORD;
    v_boss_cost INTEGER;
    v_msg TEXT;
BEGIN
    -- Get Active Fight
    SELECT * INTO v_fight FROM user_boss_fights WHERE user_id = v_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'No active fight to cancel.');
    END IF;

    -- Get Boss Cost
    SELECT cost_turns INTO v_boss_cost FROM bosses WHERE id = v_fight.boss_id;

    -- Check if it's the first fight (prepaid)
    -- If total_fights_done is 0, it means the first fight was paid for but not completed.
    IF v_fight.total_fights_done = 0 THEN
        UPDATE user_stats SET turns = turns + v_boss_cost WHERE id = v_user_id;
        v_msg := 'Fight cancelled. ' || v_boss_cost || ' turns refunded.';
    ELSE
        -- For subsequent fights, payment happens at completion, so no turns were spent on the *current* pending fight yet.
        v_msg := 'Fight cancelled.';
    END IF;

    -- Delete Fight
    DELETE FROM user_boss_fights WHERE user_id = v_user_id;

    RETURN jsonb_build_object('success', true, 'message', v_msg);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
