-- Update Leaderboard Tie-Breaking Logic
-- Run this in Supabase SQL Editor

-- Drop the existing view
DROP VIEW IF EXISTS public.leaderboard;

-- Recreate the view with new ordering logic
CREATE OR REPLACE VIEW public.leaderboard AS
WITH individual_ranks AS (
    SELECT 
        us.*,
        p.username,
        p.created_at, -- Include created_at for seniority tie-breaker
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
    
    -- Overall Rank based on Score, then Seniority (created_at), then Gold
    RANK() OVER (
        ORDER BY 
            (rank_attack + rank_defense + rank_spy + rank_sentry) ASC, -- Lower score is better
            created_at ASC, -- Older accounts win ties (First to get rank)
            gold DESC -- More gold wins remaining ties
    ) as overall_rank
FROM individual_ranks;

-- Grant access to authenticated users
GRANT SELECT ON public.leaderboard TO authenticated;
