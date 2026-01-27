CREATE OR REPLACE VIEW public.leaderboard AS
WITH 
-- 1. Filter Active Users (Completed Tutorial)
active_users AS (
    SELECT 
        u.id, 
        u.kingdom_level,
        u.attack,
        u.defense,
        u.spy,
        u.sentry,
        u.experience, -- ADDED: Publicly visible stat
        u.updated_at, -- Use updated_at for tie-breaking "achieved first" (Oldest timestamp = first)
        p.username, 
        p.is_admin,
        p.created_at as account_created_at
    FROM user_stats u
    JOIN profiles p ON u.id = p.id
    WHERE u.tutorial_step >= 15 -- Users visible only after tutorial (Step 15 is completion)
),

-- 2. First Pass: Calculate Ranks based on Stats + Timestamp (Standard Rule)
pass1_ranks AS (
    SELECT 
        *,
        -- Rank 1 is Best. Higher Stat = Better.
        -- Tie Breaker: updated_at ASC (Whoever got there first / is older active)
        -- Using ROW_NUMBER to ensure unique ranks (1, 2, 3...) as requested ("never want two #2s")
        ROW_NUMBER() OVER (ORDER BY attack DESC, updated_at ASC) as p1_rank_attack,
        ROW_NUMBER() OVER (ORDER BY defense DESC, updated_at ASC) as p1_rank_defense,
        ROW_NUMBER() OVER (ORDER BY spy DESC, updated_at ASC) as p1_rank_spy,
        ROW_NUMBER() OVER (ORDER BY sentry DESC, updated_at ASC) as p1_rank_sentry
    FROM active_users
),

-- 3. First Pass: Calculate Overall Score & Rank
pass1_overall AS (
    SELECT 
        *,
        (p1_rank_attack + p1_rank_defense + p1_rank_spy + p1_rank_sentry) as p1_score
    FROM pass1_ranks
),

pass1_ranking AS (
    SELECT 
        *,
        -- Lowest Score is Best.
        ROW_NUMBER() OVER (ORDER BY p1_score ASC, updated_at ASC) as p1_overall_rank
    FROM pass1_overall
),

-- 4. Second Pass: Re-Calculate Individual Ranks using Overall Rank as Tie-Breaker
-- "If two people have the same stat... the player with the higher overall ranking will gain the superior rank"
pass2_ranks AS (
    SELECT 
        id,
        username,
        is_admin,
        kingdom_level,
        attack,
        defense,
        spy,
        sentry,
        experience,
        updated_at,
        p1_score as rank_score_debug, -- debug
        p1_overall_rank,
        
        -- New Ranks: Primary = Stat DESC, Secondary = P1 Overall Rank ASC (Lower is better), Tertiary = Timestamp
        ROW_NUMBER() OVER (ORDER BY attack DESC, p1_overall_rank ASC, updated_at ASC) as rank_attack,
        ROW_NUMBER() OVER (ORDER BY defense DESC, p1_overall_rank ASC, updated_at ASC) as rank_defense,
        ROW_NUMBER() OVER (ORDER BY spy DESC, p1_overall_rank ASC, updated_at ASC) as rank_spy,
        ROW_NUMBER() OVER (ORDER BY sentry DESC, p1_overall_rank ASC, updated_at ASC) as rank_sentry
    FROM pass1_ranking
),

-- 5. Final Overall Score & Rank
final_scoring AS (
    SELECT 
        *,
        (rank_attack + rank_defense + rank_spy + rank_sentry) as rank_score
    FROM pass2_ranks
)

SELECT 
    id,
    username,
    is_admin,
    kingdom_level,
    attack,
    defense,
    spy,
    sentry,
    experience,
    rank_attack,
    rank_defense,
    rank_spy,
    rank_sentry,
    rank_score,
    -- Final Overall Rank
    ROW_NUMBER() OVER (ORDER BY rank_score ASC, updated_at ASC) as overall_rank,
    updated_at
FROM final_scoring;

-- Grant permissions (View requires explicit grants usually if created new, but replace preserves?)
GRANT SELECT ON public.leaderboard TO authenticated;
GRANT SELECT ON public.leaderboard TO service_role;
