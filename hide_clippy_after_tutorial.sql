CREATE OR REPLACE FUNCTION public.get_battle_opponents(p_page int, p_limit int)
RETURNS TABLE (
    id uuid,
    username text,
    alliance text,
    gold bigint,
    overall_rank bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_tutorial_step int;
BEGIN
    v_user_id := auth.uid();
    
    -- Get caller's tutorial step, default to 0 if not found
    SELECT tutorial_step INTO v_tutorial_step
    FROM public.user_stats
    WHERE id = v_user_id;

    RETURN QUERY
    SELECT 
        l.id,
        l.username,
        us.alliance,
        us.gold,
        l.overall_rank
    FROM public.leaderboard l
    LEFT JOIN public.user_stats us ON l.id = us.id
    WHERE 
        -- If tutorial step > 12 (Attack Clippy step is 12), hide Clippy
        -- If tutorial skipped (999), this is > 12, so Clippy is hidden.
        (CASE 
            WHEN COALESCE(v_tutorial_step, 0) > 12 THEN l.username NOT ILIKE 'Clippy'
            ELSE TRUE
        END)
    ORDER BY l.overall_rank ASC
    LIMIT p_limit
    OFFSET p_page * p_limit;
END;
$$;
