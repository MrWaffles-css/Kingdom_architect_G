CREATE OR REPLACE FUNCTION public.perform_tutorial_attack()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_step int;
    v_report_id uuid;
    v_report_data jsonb;
BEGIN
    v_user_id := auth.uid();
    
    -- Check current step
    SELECT tutorial_step INTO v_step FROM public.user_stats WHERE id = v_user_id;

    -- STEP 12 ONLY (or allow purely for testing if needed, but strict is better)
    IF v_step IS NULL OR v_step != 12 THEN
        RETURN json_build_object('success', false, 'message', 'You are not on the correct tutorial step (12).');
    END IF;

    -- Give Rewards (20,000 Gold + 150 XP)
    -- Also advance tutorial to step 13
    UPDATE public.user_stats 
    SET 
        gold = gold + 20000, 
        experience = experience + 150,
        tutorial_step = 13,
        turns = turns - 1
    WHERE id = v_user_id;

    -- Create Fake Report Data
    v_report_data := jsonb_build_object(
        'gold', 20000,
        'enemy', 'Clippy',
        'outcome', 'victory',
        'casualties', 0,
        'xp_gained', 150,
        'timestamp', now()
    );

    -- Insert into reports table
    INSERT INTO public.reports (user_id, type, title, data, is_read, created_at)
    VALUES (
        v_user_id,
        'attack_win',
        'Victory against Clippy',
        v_report_data,
        false,
        now()
    )
    RETURNING id INTO v_report_id;

    RETURN json_build_object(
        'success', true, 
        'message', 'You defeated Clippy! You looted 20,000 Gold.',
        'gold_stolen', 20000,
        'casualties', 0,
        'xp_gained', 150,
        'report_id', v_report_id
    );
END;
$$;
