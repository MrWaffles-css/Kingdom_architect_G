-- Optimize Battle Page Loading
-- 1. Add Index to spy_reports to speed up the "Last Spied" lookup
-- 2. Optimize get_battle_opponents RPC to use efficient joins

-- Index for fast lookup of latest spy report per target
CREATE INDEX IF NOT EXISTS idx_spy_reports_lookup 
ON public.spy_reports(attacker_id, defender_id, created_at DESC);

-- Redefine get_battle_opponents with optimization
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
    
    -- optimization: fetch my spy level once
    SELECT spy INTO v_my_spy FROM public.user_stats WHERE id = v_user_id;
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
    JOIN public.user_stats us ON l.id = us.id -- Inner join to ensure valid stats
    LEFT JOIN public.profiles p ON l.id = p.id
    LEFT JOIN public.alliances a ON p.alliance_id = a.id
    -- Lateral join is more efficient than correlated subquery for each row
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
