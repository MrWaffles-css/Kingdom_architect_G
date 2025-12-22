-- Function: Skip Tutorial and Grant All Rewards
-- Logic: Grants all cumulative rewards from the tutorial and sets step to completed (999).

DROP FUNCTION IF EXISTS public.skip_tutorial();

CREATE OR REPLACE FUNCTION public.skip_tutorial()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_current_step int;
    v_total_gold int := 17700; -- Sum of all gold rewards
    v_total_xp int := 950;     -- Sum of all XP rewards
    v_total_turns int := 335;  -- Sum of all Turn rewards
    v_total_citizens int := 10; -- Sum of all Citizen rewards
BEGIN
    v_user_id := auth.uid();

    -- Get current step to ensure they haven't already finished
    SELECT tutorial_step INTO v_current_step
    FROM public.user_stats
    WHERE id = v_user_id;

    IF v_current_step >= 999 THEN
        RETURN json_build_object('success', false, 'message', 'Tutorial already completed');
    END IF;

    -- Grant All Rewards & Set Step to 999 (Completed)
    -- Also force enable research/buildings that would be unlocked
    UPDATE public.user_stats
    SET 
        gold = gold + v_total_gold,
        experience = experience + v_total_xp,
        turns = turns + v_total_turns,
        citizens = citizens + v_total_citizens,
        tutorial_step = 999,
        -- Ensure critical unlockables are set if they weren't already
        gold_mine_level = GREATEST(gold_mine_level, 1),
        research_turns_per_min = GREATEST(research_turns_per_min, 1) 
    WHERE id = v_user_id;

    RETURN json_build_object(
        'success', true, 
        'message', 'Tutorial skipped! Rewards granted.',
        'rewards', json_build_object(
            'Gold', v_total_gold,
            'XP', v_total_xp,
            'Turns', v_total_turns,
            'Citizens', v_total_citizens
        )
    );
END;
$$;
