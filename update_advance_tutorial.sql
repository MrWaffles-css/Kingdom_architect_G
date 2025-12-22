-- Function: Advance Tutorial and Grant Rewards
-- Logic: Grants rewards for the COMPLETED step, then increments step.

CREATE OR REPLACE FUNCTION public.advance_tutorial(expected_step int)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_step int;
    v_rewards json;
    v_updates json;
    v_gold_gain int := 0;
    v_xp_gain int := 0;
    v_turn_gain int := 0;
    v_item_rewards text := '';
BEGIN
    v_user_id := auth.uid();

    -- Get current step
    SELECT tutorial_step INTO v_current_step
    FROM public.user_stats
    WHERE id = v_user_id;

    -- Validate Step
    IF v_current_step IS NULL OR v_current_step != expected_step THEN
        RETURN json_build_object('success', false, 'message', 'Sync error: refresh page');
    END IF;

    -- Define Rewards based on COMPLETED step (v_current_step)
    -- Step 0: Welcome (No reward) -> Step 1
    -- Step 1: Stats (50 XP) -> Step 2
    -- Step 2: The Goal (No reward) -> Step 3
    -- Step 3: Kingdom (1000 Gold, 300 Turns) -> Step 4
    -- Step 4: Economy (200 XP, 25 Turns, 300 Gold) -> Step 5
    -- Step 5: Library (5000 Gold) -> Step 6
    -- Step 6: Unit Types (50 XP) -> Step 7
    -- Step 7: Spying Prep (50 XP) -> Step 8
    -- Step 8: Spying (50 XP, 5 Turns) -> Step 9
    -- Step 9: Soldiers (50 XP) -> Step 10
    -- Step 10: Weapons (50 XP) -> Step 11
    -- Step 11: Attacking (150 XP, 100 Gold) -> Step 12
    -- Step 12: Reports (50 XP) -> Step 13
    -- Step 13: Vault (50 XP, 5 Turns) -> Step 14
    -- Step 14: Completion (1000 Gold, 200 XP) -> Done?

    IF v_current_step = 1 THEN
        v_xp_gain := 50;
        v_rewards := '{"XP": 50}';
    ELSIF v_current_step = 3 THEN
        v_gold_gain := 1000;
        v_turn_gain := 300;
        v_rewards := '{"Gold": 1000, "Turns": 300}';
    ELSIF v_current_step = 4 THEN
        v_xp_gain := 200;
        v_turn_gain := 25;
        v_gold_gain := 300;
        v_rewards := '{"XP": 200, "Turns": 25, "Gold": 300}';
    ELSIF v_current_step = 5 THEN
        v_gold_gain := 5000;
        v_rewards := '{"Gold": 5000}';
    ELSIF v_current_step = 6 THEN
        v_xp_gain := 50;
        v_rewards := '{"XP": 50}';
    ELSIF v_current_step = 7 THEN
        v_xp_gain := 50;
        v_rewards := '{"XP": 50}';
    ELSIF v_current_step = 8 THEN
        v_xp_gain := 50;
        v_turn_gain := 5;
        v_rewards := '{"XP": 50, "Turns": 5}';
    ELSIF v_current_step = 9 THEN
        v_xp_gain := 50;
        v_rewards := '{"XP": 50}';
    ELSIF v_current_step = 10 THEN
        v_xp_gain := 50;
        v_rewards := '{"XP": 50}';
    ELSIF v_current_step = 11 THEN
        v_xp_gain := 150;
        v_gold_gain := 100;
        v_rewards := '{"XP": 150, "Gold": 100}';
    ELSIF v_current_step = 12 THEN
        v_xp_gain := 50;
        v_rewards := '{"XP": 50}';
    ELSIF v_current_step = 13 THEN
        v_xp_gain := 50;
        v_turn_gain := 5;
        v_rewards := '{"XP": 50, "Turns": 5}';
    ELSIF v_current_step = 14 THEN
        v_gold_gain := 1000;
        v_xp_gain := 200;
        v_rewards := '{"Gold": 1000, "XP": 200}';
    ELSE
        v_rewards := '{}';
    END IF;

    -- Grant Rewards
    UPDATE public.user_stats
    SET 
        gold = gold + v_gold_gain,
        experience = experience + v_xp_gain,
        turns = turns + v_turn_gain,
        tutorial_step = tutorial_step + 1
    WHERE id = v_user_id;

    RETURN json_build_object(
        'success', true, 
        'new_step', v_current_step + 1,
        'rewards', v_rewards
    );
END;
$$;
