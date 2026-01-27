-- 1. Nerf Clippy's stats to 0 (as requested)
-- Keep Gold and Citizens so he is a valid target
UPDATE public.user_stats 
SET 
    attack = 0,
    defense = 0,
    spy = 0,
    sentry = 0,
    attack_soldiers = 0,
    defense_soldiers = 0,
    spies = 0,
    sentries = 0,
    gold = 50000, -- Give him some gold to steal
    updated_at = now()
WHERE id = (SELECT id FROM profiles WHERE username ILIKE 'Clippy');

-- 2. Update Battle Opponents RPC to FORCE Clippy to the top (Pinned)
-- This ensures he is visible even if his Rank is low due to 0 stats.

DROP FUNCTION IF EXISTS public.get_battle_opponents(integer, integer);

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
    
    -- Get Current User's Spy Stat
    SELECT spy INTO v_my_spy FROM public.user_stats WHERE user_stats.id = v_user_id;
    
    -- Handle missing stats
    IF v_my_spy IS NULL THEN
        v_my_spy := 0;
    END IF;

    RETURN QUERY
    SELECT 
        l.id,
        l.username,
        a.name as alliance,
        
        -- FOG OF WAR:
        -- If user is Clippy, ALWAYS show Gold/Stats (since he is tutorial dummy)
        -- OR if My Spy > Their Sentry
        CASE 
            WHEN (l.username ILIKE 'Clippy') OR (v_my_spy > us.sentry) OR (l.id = v_user_id) THEN us.gold
            ELSE NULL 
        END as gold,
        
        l.overall_rank,
        
        -- Defense/Sentry visiblity
        CASE 
            WHEN (l.username ILIKE 'Clippy') OR (v_my_spy > us.sentry) OR (l.id = v_user_id) THEN us.defense
            ELSE NULL 
        END as defense,
        
        CASE 
            WHEN (l.username ILIKE 'Clippy') OR (v_my_spy > us.sentry) OR (l.id = v_user_id) THEN us.sentry
            ELSE NULL 
        END as sentry,

        -- Last Spied At
        (
            SELECT created_at 
            FROM public.spy_reports 
            WHERE attacker_id = v_user_id AND defender_id = l.id 
            ORDER BY created_at DESC 
            LIMIT 1
        ) as last_spied_at

    FROM public.leaderboard l
    LEFT JOIN public.user_stats us ON l.id = us.id
    LEFT JOIN public.profiles p ON l.id = p.id
    LEFT JOIN public.alliances a ON p.alliance_id = a.id
    WHERE 
        us.id IS NOT NULL
    ORDER BY 
        -- CUSTOM SORT: Puts Clippy at the very top (True sorts first in DESC for boolean? Wait. False < True. DESC = True first.)
        (l.username ILIKE 'Clippy') DESC,
        l.overall_rank ASC
    LIMIT p_limit
    OFFSET p_page * p_limit;
END;
$$;
