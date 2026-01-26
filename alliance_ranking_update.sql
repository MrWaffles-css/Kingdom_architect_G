-- Add announcement column to alliances if it doesn't exist
ALTER TABLE public.alliances ADD COLUMN IF NOT EXISTS announcement TEXT DEFAULT '';

-- Function to get alliance leaderboards
-- Returns: top 10 alliances ordered by total rank of their top 10 members
CREATE OR REPLACE FUNCTION public.get_alliance_leaderboard()
RETURNS TABLE (
    alliance_id UUID,
    name TEXT,
    member_count INTEGER,
    total_score BIGINT,
    rank INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH AllianceScores AS (
        SELECT 
            a.id,
            a.name,
            a.member_count,
            (
                SELECT COALESCE(SUM(us.rank), 0)
                FROM (
                    SELECT us.rank
                    FROM public.user_stats us
                    JOIN public.profiles p ON p.id = us.id
                    WHERE p.alliance_id = a.id
                    ORDER BY us.rank DESC
                    LIMIT 10
                ) us
            ) as score
        FROM public.alliances a
    )
    SELECT 
        id as alliance_id,
        AllianceScores.name,
        AllianceScores.member_count,
        CAST(score AS BIGINT) as total_score,
        CAST(RANK() OVER (ORDER BY score DESC) AS INTEGER) as rank
    FROM AllianceScores
    ORDER BY score DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update announcement (Leader only)
CREATE OR REPLACE FUNCTION public.update_alliance_announcement(p_text TEXT)
RETURNS JSONB AS $$
DECLARE
    v_alliance_id UUID;
    v_is_leader BOOLEAN;
BEGIN
    SELECT alliance_id INTO v_alliance_id FROM public.profiles WHERE id = auth.uid();
    
    IF v_alliance_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not in an alliance');
    END IF;

    -- Check if leader
    SELECT (leader_id = auth.uid()) INTO v_is_leader 
    FROM public.alliances WHERE id = v_alliance_id;

    IF NOT v_is_leader THEN
         RETURN jsonb_build_object('success', false, 'message', 'Only the leader can update the announcement.');
    END IF;

    UPDATE public.alliances SET announcement = p_text WHERE id = v_alliance_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
