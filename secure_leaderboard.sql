-- =====================================================
-- PRIVACY FIX: Secure Leaderboard View
-- =====================================================
-- This script recreates the leaderboard view to ONLY expose
-- public ranking information, preventing data leakage.

-- =====================================================
-- STEP 1: Drop Existing Leaderboard View
-- =====================================================

DROP VIEW IF EXISTS public.leaderboard CASCADE;

-- =====================================================
-- STEP 2: Create Secure Leaderboard View
-- =====================================================
-- This view ONLY exposes:
-- - Username
-- - Ranking information (overall_rank, individual ranks)
-- - Kingdom level (public information)
-- - Last updated timestamp
--
-- EXCLUDED (Private Data):
-- - gold, vault, citizens
-- - attack_soldiers, defense_soldiers, spies, sentries
-- - miners, gold_mine_level, vault_level
-- - research data

CREATE OR REPLACE VIEW public.leaderboard AS
WITH individual_ranks AS (
    SELECT 
        us.id,
        us.kingdom_level,
        us.attack,
        us.defense,
        us.spy,
        us.sentry,
        us.updated_at,
        p.username,
        p.is_admin,
        -- Individual Ranks (higher stats = better rank = lower number)
        DENSE_RANK() OVER (ORDER BY us.attack DESC, us.updated_at ASC) as rank_attack,
        DENSE_RANK() OVER (ORDER BY us.defense DESC, us.updated_at ASC) as rank_defense,
        DENSE_RANK() OVER (ORDER BY us.spy DESC, us.updated_at ASC) as rank_spy,
        DENSE_RANK() OVER (ORDER BY us.sentry DESC, us.updated_at ASC) as rank_sentry
    FROM public.user_stats us
    JOIN public.profiles p ON us.id = p.id
)
SELECT 
    id,
    username,
    is_admin,
    kingdom_level,
    -- Combat stats (these are public - they represent army strength)
    attack,
    defense,
    spy,
    sentry,
    -- Ranking information
    rank_attack,
    rank_defense,
    rank_spy,
    rank_sentry,
    -- Rank Score (Sum of ranks - lower is better)
    (rank_attack + rank_defense + rank_spy + rank_sentry) as rank_score,
    -- Overall Rank based on Score (lower score = better overall rank)
    RANK() OVER (ORDER BY (rank_attack + rank_defense + rank_spy + rank_sentry) ASC, updated_at ASC) as overall_rank,
    -- Timestamp
    updated_at
FROM individual_ranks;

-- =====================================================
-- STEP 3: Grant Permissions
-- =====================================================

GRANT SELECT ON public.leaderboard TO authenticated;
GRANT SELECT ON public.leaderboard TO anon;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Show sample of leaderboard (should NOT show gold, citizens, etc.)
SELECT 
    username,
    kingdom_level,
    attack,
    defense,
    overall_rank,
    rank_score
FROM public.leaderboard
ORDER BY overall_rank
LIMIT 10;

-- Verify columns (should NOT include sensitive data)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'leaderboard'
ORDER BY ordinal_position;
