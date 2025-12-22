-- Function: Advance Tutorial and Grant Rewards (V2)
-- Logic: Grants rewards for the COMPLETED step, then increments step.
-- Updated for split Economy Step (4 & 5)

DROP FUNCTION IF EXISTS public.advance_tutorial(integer);

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
    v_citizen_gain int := 0;
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
    
    IF v_current_step = 1 THEN -- Stats
        v_xp_gain := 50;
        v_rewards := '{"XP": 50}';
    ELSIF v_current_step = 3 THEN -- Kingdom
        v_gold_gain := 1000;
        v_turn_gain := 300;
        v_rewards := '{"Gold": 1000, "Turns": 300}';
    ELSIF v_current_step = 4 THEN -- Economy Part 1 (Build Mine)
        v_gold_gain := 10600;
        v_citizen_gain := 10;
        v_rewards := '{"Gold": 10600, "Citizens": 10}';
    ELSIF v_current_step = 5 THEN -- Economy Part 2 (Hire Miners)
        v_xp_gain := 200;
        v_turn_gain := 25;
        v_rewards := '{"XP": 200, "Turns": 25}';
    ELSIF v_current_step = 6 THEN -- Library
        v_gold_gain := 5000;
        v_rewards := '{"Gold": 5000}';
    ELSIF v_current_step = 7 THEN -- Unit Types
        v_xp_gain := 50;
        v_rewards := '{"XP": 50}';
    ELSIF v_current_step = 8 THEN -- Spying Prep
        v_xp_gain := 50;
        v_rewards := '{"XP": 50}';
    ELSIF v_current_step = 9 THEN -- Spying
        v_xp_gain := 50;
        v_turn_gain := 5;
        v_rewards := '{"XP": 50, "Turns": 5}';
    ELSIF v_current_step = 10 THEN -- Soldiers
        v_xp_gain := 50;
        v_rewards := '{"XP": 50}';
    ELSIF v_current_step = 11 THEN -- Weapons
        v_xp_gain := 50;
        v_rewards := '{"XP": 50}';
    ELSIF v_current_step = 12 THEN -- Attacking
        v_xp_gain := 150;
        v_gold_gain := 100;
        v_rewards := '{"XP": 150, "Gold": 100}';
    ELSIF v_current_step = 13 THEN -- Reports
        v_xp_gain := 50;
        v_rewards := '{"XP": 50}';
    ELSIF v_current_step = 14 THEN -- Vault
        v_xp_gain := 50;
        v_turn_gain := 5;
        v_rewards := '{"XP": 50, "Turns": 5}';
    ELSIF v_current_step = 15 THEN -- Completion
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
        citizens = citizens + v_citizen_gain,
        tutorial_step = tutorial_step + 1
    WHERE id = v_user_id;

    RETURN json_build_object(
        'success', true, 
        'new_step', v_current_step + 1,
        'rewards', v_rewards
    );
END;
$$;
