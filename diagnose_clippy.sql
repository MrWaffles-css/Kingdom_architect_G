-- Check for Clippy's existence
DO $$
DECLARE
    v_profile_exists boolean;
    v_stats_exists boolean;
    v_leaderboard_exists boolean;
    v_clippy_id uuid;
BEGIN
    SELECT id INTO v_clippy_id FROM public.profiles WHERE username ILIKE 'Clippy' LIMIT 1;
    
    v_profile_exists := (v_clippy_id IS NOT NULL);
    v_stats_exists := EXISTS(SELECT 1 FROM public.user_stats WHERE id = v_clippy_id);
    v_leaderboard_exists := EXISTS(SELECT 1 FROM public.leaderboard WHERE id = v_clippy_id);
    
    RAISE NOTICE 'Clippy Profile: %, Stats: %, Leaderboard: %, ID: %', 
        v_profile_exists, v_stats_exists, v_leaderboard_exists, v_clippy_id;

    -- If Profile exists but Stats missing, Fix it
    IF v_profile_exists AND NOT v_stats_exists THEN
        RAISE NOTICE 'Creating missing stats for Clippy...';
        INSERT INTO public.user_stats (id, gold, turns, rank, citizens, kingdom_level)
        VALUES (v_clippy_id, 1000000, 1000, 100, 500, 5);
    END IF;

    -- If NO Profile, Create everything
    IF NOT v_profile_exists THEN
        RAISE NOTICE 'Creating FULL Clippy Account...';
        -- We'll just print instructions, as creating a user with a specific UUID usually requires auth.users
        -- But we can try inserting into profiles directly if RLS allows or if we are postgres
        -- Ideally, we need a real auth user.
    END IF;
END $$;
