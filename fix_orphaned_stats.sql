-- Repair script to fix "Spy failed: Target not found"
-- This ensures that all users in 'profiles' have a corresponding entry in 'user_stats'
-- Specifically targeting the "Clippy" tutorial bot if it exists but is broken

DO $$
DECLARE
    r RECORD;
    v_count int := 0;
BEGIN
    FOR r IN 
        SELECT p.id, p.username 
        FROM public.profiles p
        LEFT JOIN public.user_stats s ON p.id = s.id
        WHERE s.id IS NULL
    LOOP
        RAISE NOTICE 'Fixing orphaned profile: % (ID: %)', r.username, r.id;
        
        INSERT INTO public.user_stats (id, gold, experience, turns, vault, rank, citizens, kingdom_level)
        VALUES (
            r.id, 
            0,    -- gold
            600,  -- experience (default)
            0,    -- turns
            0,    -- vault
            1,    -- rank
            2,    -- citizens
            0     -- kingdom_level
        );
        
        v_count := v_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Fixed % orphaned user stats.', v_count;
    
    -- Ensure Clippy specifically exists if he wasn't found above/at all
    -- (Optional: checks if a user named 'Clippy' exists, if not, creates him)
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE username ILIKE 'Clippy') THEN
        RAISE NOTICE 'Clippy not found. Creating Clippy...';
        -- Note: We can't easily create a user in auth.users from here due to permissions/hashing usually,
        -- but we can insert into profiles/user_stats if we fake an ID or if we assume this is just for DB consistency.
        -- However, creating a fake ID in profiles requires a matching auth.users ID usually due to foreign keys.
        -- So we will skip creation and rely on the user to register 'Clippy' if he is missing from auth.
        -- BUT usually the issue is he IS in auth/profiles but not user_stats.
    END IF;

END $$;
