-- =====================================================
-- FIX: Ensure MrWaffles (and all users) show up properly
-- =====================================================
-- This script fixes common issues with user data not appearing

-- STEP 1: Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 2: Create user_stats table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_stats (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    gold BIGINT DEFAULT 0,
    experience BIGINT DEFAULT 1000,
    turns INTEGER DEFAULT 100,
    vault BIGINT DEFAULT 0,
    citizens INTEGER DEFAULT 2,
    kingdom_level INTEGER DEFAULT 0,
    attack BIGINT DEFAULT 0,
    defense BIGINT DEFAULT 0,
    spy BIGINT DEFAULT 0,
    sentry BIGINT DEFAULT 0,
    attack_soldiers INTEGER DEFAULT 0,
    defense_soldiers INTEGER DEFAULT 0,
    spies INTEGER DEFAULT 0,
    sentries INTEGER DEFAULT 0,
    miners INTEGER DEFAULT 0,
    gold_mine_level INTEGER DEFAULT 0,
    vault_level INTEGER DEFAULT 0,
    library_level INTEGER DEFAULT 1,
    research_turns_per_min INTEGER DEFAULT 0,
    research_weapons INTEGER DEFAULT 0,
    use_vault_gold BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 3: Ensure all auth.users have a profile entry
INSERT INTO public.profiles (id, username, is_admin)
SELECT 
    au.id,
    COALESCE(au.email, 'User_' || substring(au.id::text, 1, 8)) as username,
    FALSE as is_admin
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- STEP 4: Ensure all profiles have user_stats
INSERT INTO public.user_stats (
    id, gold, experience, turns, vault, citizens, kingdom_level,
    attack, defense, spy, sentry,
    attack_soldiers, defense_soldiers, spies, sentries,
    miners, gold_mine_level, vault_level, library_level,
    research_turns_per_min, research_weapons, use_vault_gold
)
SELECT 
    p.id,
    0, 1000, 100, 0, 2, 0,  -- gold, exp, turns, vault, citizens, kingdom_level
    0, 0, 0, 0,              -- attack, defense, spy, sentry
    0, 0, 0, 0,              -- soldiers counts
    0, 0, 0, 1,              -- miners, gold_mine, vault, library
    0, 0, FALSE              -- research_turns, research_weapons, use_vault
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_stats us WHERE us.id = p.id
)
ON CONFLICT (id) DO NOTHING;

-- STEP 5: Create or recreate the leaderboard view
DROP VIEW IF EXISTS public.leaderboard CASCADE;

CREATE OR REPLACE VIEW public.leaderboard AS
WITH individual_ranks AS (
    SELECT 
        us.id,
        us.gold,
        us.experience,
        us.turns,
        us.vault,
        us.citizens,
        us.kingdom_level,
        us.attack,
        us.defense,
        us.spy,
        us.sentry,
        us.attack_soldiers,
        us.defense_soldiers,
        us.spies,
        us.sentries,
        us.miners,
        us.gold_mine_level,
        us.vault_level,
        us.library_level,
        us.research_turns_per_min,
        us.research_weapons,
        us.use_vault_gold,
        us.created_at,
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
    *,
    -- Rank Score (Sum of ranks - lower is better)
    (rank_attack + rank_defense + rank_spy + rank_sentry) as rank_score,
    
    -- Overall Rank based on Score (lower score = better overall rank)
    RANK() OVER (ORDER BY (rank_attack + rank_defense + rank_spy + rank_sentry) ASC, updated_at ASC) as overall_rank
FROM individual_ranks;

-- STEP 6: Grant permissions
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.user_stats TO authenticated;
GRANT SELECT ON public.leaderboard TO authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.user_stats TO authenticated;

-- STEP 7: Create trigger to auto-create profile and stats for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, username, is_admin)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, 'User_' || substring(NEW.id::text, 1, 8)),
        FALSE
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Create user_stats
    INSERT INTO public.user_stats (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- STEP 8: Verify the fix
SELECT 
    'VERIFICATION' as status,
    COUNT(DISTINCT au.id) as total_auth_users,
    COUNT(DISTINCT p.id) as total_profiles,
    COUNT(DISTINCT us.id) as total_user_stats,
    COUNT(DISTINCT l.id) as total_in_leaderboard
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
LEFT JOIN public.user_stats us ON au.id = us.id
LEFT JOIN public.leaderboard l ON au.id = l.id;

-- STEP 9: Show all users with their data
SELECT 
    p.username,
    us.gold,
    us.experience,
    us.turns,
    us.citizens,
    us.kingdom_level,
    l.overall_rank,
    us.created_at
FROM public.profiles p
LEFT JOIN public.user_stats us ON p.id = us.id
LEFT JOIN public.leaderboard l ON p.id = l.id
ORDER BY us.created_at DESC;
