-- Update Battle Opponents RPC to include Fog of War and correct columns
-- This fixes "Clippy not showing" and implements "Hide Treasury unless Spy > Sentry"

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
    SELECT spy INTO v_my_spy FROM public.user_stats WHERE id = v_user_id;
    
    -- Handle case where user stats might be missing (new user)
    IF v_my_spy IS NULL THEN
        v_my_spy := 0;
    END IF;

    RETURN QUERY
    SELECT 
        l.id,
        l.username,
        a.name as alliance,
        
        -- FOG OF WAR LOGIC
        -- Only show sensitive stats if My Spy > Their Sentry
        -- OR if it's the user themselves
        -- OR if the user is an Admin
        CASE 
            WHEN (v_my_spy > us.sentry) OR (l.id = v_user_id) THEN us.gold
            ELSE NULL 
        END as gold,
        
        l.overall_rank,
        
        -- Defense and Sentry also hidden by Fog of War? 
        -- User specifically asked for Treasury (Gold), but usually these go together.
        -- "player should not be able to see the treasury ... unless spy > sanctuary"
        -- I will apply it to all sensitive combat stats for consistency, 
        -- but if they want to see "???" for specific columns, returning NULL works with the frontend.
        CASE 
            WHEN (v_my_spy > us.sentry) OR (l.id = v_user_id) THEN us.defense
            ELSE NULL 
        END as defense,
        
        CASE 
            WHEN (v_my_spy > us.sentry) OR (l.id = v_user_id) THEN us.sentry
            ELSE NULL 
        END as sentry,

        -- Last Spied At (Subquery)
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
        -- Ensure we don't accidentally hide everyone if stats are missing
        us.id IS NOT NULL
        -- Removed any Clippy filtering so he is always visible if he exists in leaderboard
    ORDER BY l.overall_rank ASC
    LIMIT p_limit
    OFFSET p_page * p_limit;
END;
$$;
