-- Fix Ambiguous Column Error in Battle Query
-- The error "column reference 'id' is ambiguous" occurs because the function returns a table with an 'id' column,
-- and the internal query 'WHERE id = ...' conflicts with that output parameter name.
-- We must explicitly qualify 'user_stats.id'.

CREATE OR REPLACE FUNCTION public.get_battle_opponents(p_page int, p_limit int)
RETURNS TABLE (
    id uuid,
    username text,
    alliance text,
    gold bigint,
    overall_rank bigint,
    defense bigint,
    sentry bigint,
    last_spied_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_my_spy bigint;
BEGIN
    v_user_id := auth.uid();
    
    -- FIX: Explicitly qualify 'user_stats.id' to avoid ambiguity with output param 'id'
    SELECT spy INTO v_my_spy FROM public.user_stats WHERE user_stats.id = v_user_id;
    v_my_spy := COALESCE(v_my_spy, 0);

    RETURN QUERY
    SELECT 
        l.id,
        l.username,
        a.name as alliance,
        
        -- Fog of War: Gold
        CASE 
            WHEN (v_my_spy > us.sentry) OR (l.id = v_user_id) THEN us.gold
            ELSE NULL 
        END as gold,
        
        l.overall_rank,
        
        -- Fog of War: Defense
        CASE 
            WHEN (v_my_spy > us.sentry) OR (l.id = v_user_id) THEN us.defense
            ELSE NULL 
        END as defense,
        
        -- Fog of War: Sentry
        CASE 
            WHEN (v_my_spy > us.sentry) OR (l.id = v_user_id) THEN us.sentry
            ELSE NULL 
        END as sentry,

        -- Efficient retrieval of last spy report time
        last_spy.created_at as last_spied_at

    FROM public.leaderboard l
    JOIN public.user_stats us ON l.id = us.id
    LEFT JOIN public.profiles p ON l.id = p.id
    LEFT JOIN public.alliances a ON p.alliance_id = a.id
    LEFT JOIN LATERAL (
        SELECT created_at 
        FROM public.spy_reports 
        WHERE attacker_id = v_user_id AND defender_id = l.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) last_spy ON true
    
    ORDER BY l.overall_rank ASC
    LIMIT p_limit
    OFFSET p_page * p_limit;
END;
$$;
