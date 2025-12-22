-- =====================================================
-- FEATURE: Secure Battle Opponents Fetch
-- =====================================================
-- This function returns leaderboard data for the Battle page,
-- but securely handles the "Passive Spy" feature by only
-- revealing gold if the caller's spy level > target's sentry level.

DROP FUNCTION IF EXISTS get_battle_opponents(int, int);

CREATE OR REPLACE FUNCTION get_battle_opponents(
    p_page int,
    p_limit int
)
RETURNS TABLE (
    id uuid,
    username text,
    alliance text, -- Placeholder for now
    overall_rank bigint,
    gold bigint, -- Nullable, revealed only if spied
    sentry bigint,  -- Needed for client-side "???" logic if we want to keep it
    is_admin boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_my_spy int;
    v_offset int;
BEGIN
    v_offset := p_page * p_limit;

    -- Get my spy level from leaderboard (includes weapons)
    SELECT spy INTO v_my_spy 
    FROM public.leaderboard
    WHERE id = auth.uid();
    
    -- Default to 0 if not found
    IF v_my_spy IS NULL THEN v_my_spy := 0; END IF;

    RETURN QUERY
    SELECT 
        l.id,
        l.username,
        NULL::text as alliance, -- Placeholder until alliance system exists
        l.overall_rank,
        -- Conditional Gold Reveal: Show if my spy > their sentry
        CASE 
            WHEN l.id = auth.uid() THEN us.gold -- Always see own gold
            WHEN v_my_spy > l.sentry THEN us.gold -- Passive spy check
            ELSE NULL -- Hidden
        END as gold,
        l.sentry,
        l.is_admin
    FROM public.leaderboard l
    JOIN public.user_stats us ON l.id = us.id
    ORDER BY l.overall_rank ASC
    LIMIT p_limit
    OFFSET v_offset;
END;
$$;

-- =====================================================
-- IMPORTANT: Grant Permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION get_battle_opponents(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_battle_opponents(int, int) TO service_role;

-- =====================================================
-- IMPORTANT: Force Schema Cache Reload
-- =====================================================
-- This notifies PostgREST to refresh its schema cache immediately.
NOTIFY pgrst, 'reload config';
