-- 1. Delete Clippy from the database permanently
DELETE FROM public.user_stats WHERE id IN (SELECT id FROM public.profiles WHERE username ILIKE 'Clippy');
DELETE FROM public.profiles WHERE username ILIKE 'Clippy';

-- 2. Create RPC for Attacking Fake Clippy
-- This gives the rewards and advances the tutorial step
CREATE OR REPLACE FUNCTION public.tutorial_attack_clippy()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_step int;
    v_rewards json;
BEGIN
    v_user_id := auth.uid();
    
    -- Check current step
    SELECT tutorial_step INTO v_step FROM public.user_stats WHERE id = v_user_id;
    
    IF v_step != 12 THEN
        RETURN json_build_object('success', false, 'message', 'You are not on the correct tutorial step.');
    END IF;

    -- Give Rewards (20,000 Gold + 150 XP)
    -- Also advance tutorial to step 13
    UPDATE public.user_stats 
    SET 
        gold = gold + 20000, 
        experience = experience + 150,
        tutorial_step = 13
    WHERE id = v_user_id;

    RETURN json_build_object(
        'success', true, 
        'message', 'You defeated Clippy! You looted 20,000 Gold.',
        'gold_stolen', 20000,
        'casualties', 0,
        'xp_gained', 150
    );
END;
$$;
