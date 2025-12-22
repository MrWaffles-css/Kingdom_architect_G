-- Add Ranking System (Fixed)
-- Run this in Supabase SQL Editor

-- Create a View that calculates ranks dynamically
-- We use a CTE (Common Table Expression) to calculate individual ranks first
-- because Postgres doesn't allow nesting window functions directly.
CREATE OR REPLACE VIEW public.leaderboard AS
WITH individual_ranks AS (
    SELECT 
        us.*,
        p.username,
        -- Individual Ranks
        DENSE_RANK() OVER (ORDER BY us.attack DESC) as rank_attack,
        DENSE_RANK() OVER (ORDER BY us.defense DESC) as rank_defense,
        DENSE_RANK() OVER (ORDER BY us.spy DESC) as rank_spy,
        DENSE_RANK() OVER (ORDER BY us.sentry DESC) as rank_sentry
    FROM public.user_stats us
    JOIN public.profiles p ON us.id = p.id
)
SELECT 
    *,
    -- Rank Score (Sum of ranks)
    (rank_attack + rank_defense + rank_spy + rank_sentry) as rank_score,
    
    -- Overall Rank based on Score
    RANK() OVER (ORDER BY (rank_attack + rank_defense + rank_spy + rank_sentry) ASC) as overall_rank
FROM individual_ranks;

-- Grant access to authenticated users
GRANT SELECT ON public.leaderboard TO authenticated;
