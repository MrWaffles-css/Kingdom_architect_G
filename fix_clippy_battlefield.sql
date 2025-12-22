-- Fix Duplicate Clippy & Update Battlefield Logic

-- 1. Delete the "Real" Clippy user (duplicate)
DELETE FROM profiles WHERE username = 'Clippy';
DELETE FROM user_stats WHERE id = '00000000-0000-0000-0000-000000000001'; -- Just in case

-- 2. Update get_battle_opponents to show Fake Clippy for correct tutorial steps (8-13)
CREATE OR REPLACE FUNCTION public.get_battle_opponents(p_page integer, p_limit integer)
 RETURNS TABLE(id uuid, username text, alliance text, overall_rank bigint, gold bigint, sentry bigint, is_admin boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_my_spy int;
    v_offset int;
    v_step int;
BEGIN
    v_offset := p_page * p_limit;

    -- Get my spy level & tutorial step
    SELECT spy, tutorial_step INTO v_my_spy, v_step
    FROM public.user_stats us_lookup
    WHERE us_lookup.id = auth.uid();
    
    -- Default to 0 if not found
    IF v_my_spy IS NULL THEN v_my_spy := 0; END IF;

    -- Standard Query
    RETURN QUERY
    SELECT * FROM (
        SELECT 
            l.id,
            l.username,
            NULL::text as alliance, -- Placeholder until alliance system exists
            l.overall_rank,
            -- Conditional Gold Reveal
            CASE 
                WHEN l.id = auth.uid() THEN us.gold -- Always see own gold
                WHEN v_my_spy > us.sentry THEN us.gold -- Spy check
                ELSE NULL -- Hidden
            END as gold,
            us.sentry,
            l.is_admin
        FROM public.leaderboard l
        JOIN public.user_stats us ON l.id = us.id
        ORDER BY l.overall_rank ASC
        LIMIT p_limit
        OFFSET v_offset
    ) regular_results
    UNION ALL
    -- FAKE CLIPPY ROW (Show during Tutorial Steps 8 to 13)
    SELECT 
        '00000000-0000-0000-0000-000000000000'::uuid as id,
        'Clippy' as username,
        'Microsoft' as alliance,
        0::bigint as overall_rank,
        -- Corrected: Only ONE gold column
        50::bigint as gold, -- Clippy always shows 50 gold (easy target)
        0::bigint as sentry,
        true as is_admin
    WHERE v_step >= 8 AND v_step <= 13 AND p_page = 0; -- Only show on first page
END;
$function$;
