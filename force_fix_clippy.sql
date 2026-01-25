-- Forcefully fix the specific 'Target not found' error by creating a stats row
-- for any user in profiles who does not have one.

-- This is a more aggressive version of fix_orphaned_stats.sql
-- We also explicitly check for 'Clippy' by name to be sure.

DO $$
DECLARE
    r RECORD;
    v_clippy_id uuid;
    v_exists boolean;
BEGIN
    -- 1. Fix ALL orphans
    FOR r IN 
        SELECT p.id, p.username 
        FROM public.profiles p
        LEFT JOIN public.user_stats s ON p.id = s.id
        WHERE s.id IS NULL
    LOOP
        RAISE NOTICE 'Restoring stats for: %', r.username;
        INSERT INTO public.user_stats (id, gold, experience, turns, vault, rank, citizens, kingdom_level)
        VALUES (r.id, 0, 600, 0, 0, 1, 2, 0);
    END LOOP;

    -- 2. SPECIFIC CHECK FOR CLIPPY (The Tutorial Bot)
    -- First, does he exist in profiles?
    SELECT id INTO v_clippy_id FROM public.profiles WHERE username ILIKE 'Clippy' LIMIT 1;
    
    IF v_clippy_id IS NOT NULL THEN
        -- Clippy exists in profiles. Does he exist in stats?
        SELECT EXISTS(SELECT 1 FROM public.user_stats WHERE id = v_clippy_id) INTO v_exists;
        
        IF NOT v_exists THEN
            RAISE NOTICE 'Clippy found in Profiles but missing Stats. Fixing...';
            INSERT INTO public.user_stats (id, gold, experience, turns, vault, rank, citizens, kingdom_level)
            VALUES (v_clippy_id, 50, 600, 1000, 0, 1, 10, 1);
        ELSE
            RAISE NOTICE 'Clippy exists and has stats. All good.';
        END IF;
    ELSE
        -- Clippy does not exist in profiles. We must create him.
        -- We will generate a random UUID since he is a bot.
        -- This logic usually runs at seed time but might have been wiped.
        RAISE NOTICE 'Clippy completely missing. Creating from scratch...';
        
        -- We need a UUID.
        v_clippy_id := gen_random_uuid();
        
        INSERT INTO public.profiles (id, username, email, is_admin)
        VALUES (v_clippy_id, 'Clippy', 'clippy@microsoft.com', false);
        
        INSERT INTO public.user_stats (id, gold, experience, turns, vault, rank, citizens, kingdom_level)
        VALUES (v_clippy_id, 50, 600, 1000, 0, 1, 10, 1);
    END IF;

END $$;
