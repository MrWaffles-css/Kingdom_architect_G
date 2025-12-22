-- Implement "First to Achieve" Leaderboard Logic
-- Run this in Supabase SQL Editor

-- 1. Add column to track when stats were last updated
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS last_stat_update TIMESTAMPTZ DEFAULT NOW();

-- 2. Create function to update timestamp
CREATE OR REPLACE FUNCTION public.update_last_stat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update timestamp if the stats affecting rank have changed
    IF (NEW.attack <> OLD.attack OR 
        NEW.defense <> OLD.defense OR 
        NEW.spy <> OLD.spy OR 
        NEW.sentry <> OLD.sentry) THEN
        NEW.last_stat_update = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS update_stat_timestamp ON public.user_stats;
CREATE TRIGGER update_stat_timestamp
    BEFORE UPDATE ON public.user_stats
    FOR EACH ROW
    EXECUTE FUNCTION public.update_last_stat_timestamp();

-- 4. Update Leaderboard View
DROP VIEW IF EXISTS public.leaderboard;

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
    
    -- Overall Rank Logic:
    -- 1. Rank Score (Lower is better)
    -- 2. Last Update Time (Earlier is better - "First to Achieve")
    -- 3. Gold (Higher is better - Final tie breaker)
    RANK() OVER (
        ORDER BY 
            (rank_attack + rank_defense + rank_spy + rank_sentry) ASC,
            last_stat_update ASC, 
            gold DESC
    ) as overall_rank
FROM individual_ranks;

-- Grant access
GRANT SELECT ON public.leaderboard TO authenticated;
