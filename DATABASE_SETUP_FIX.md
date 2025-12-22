`# Database Setup Issues - Quick Fix Guide

## Problem Summary
You're seeing two issues:
1. **All stats showing 0** - Fixed in the frontend code
2. **No players in Battle list** - The `leaderboard` view doesn't exist in your database

## Root Causes

### Issue 1: Stats Showing Zero (FIXED)
The user initialization in `App.jsx` was only setting 2 fields (`citizens` and `experience`), leaving all other stats as NULL/0. This has been fixed in the code.

### Issue 2: No Players in Battle List (NEEDS SQL)
The Battle page queries a database view called `leaderboard` which doesn't exist yet. You need to run the SQL files to create it.

## Solution

### Step 1: Create the Leaderboard View
Run this SQL in your Supabase SQL Editor:

\`\`\`sql
-- Create the leaderboard view
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
    
    -- Overall Rank based on Score
    RANK() OVER (ORDER BY (rank_attack + rank_defense + rank_spy + rank_sentry) ASC) as overall_rank
FROM individual_ranks;

-- Grant access to authenticated users
GRANT SELECT ON public.leaderboard TO authenticated;
\`\`\`

### Step 2: Reset Your User Data
Since your current user has all zeros, you need to either:

**Option A: Delete and recreate your user (Recommended)**
1. Go to Supabase Dashboard → Table Editor → `user_stats`
2. Find your user row and delete it
3. Refresh the game - it will create a new user with proper starting stats

**Option B: Use the Admin Panel**
1. Log into the game
2. Click "Admin" (if you have admin privileges)
3. Use the "Reset World" feature

### Step 3: Verify
1. Refresh your browser
2. You should see your stats populated (100 turns, 2 citizens, 1000 XP, etc.)
3. Go to Battle page - you should see yourself in the player list

## SQL Files You Should Run (In Order)

If you haven't run these yet, run them in this order in Supabase SQL Editor:

1. ✅ **Basic Setup** (if not done already)
   - `supabase_schema.sql` - Creates basic tables
   - `add_serverside_resources.sql` - Resource generation
   - `add_barracks_features.sql` - Unit training
   - `add_weapon_system.sql` - Weapon system
   - `add_library_system.sql` - Library/research
   - `add_gold_mine.sql` - Gold mine
   - `add_vault_system.sql` - Vault system

2. ✅ **Leaderboard** (CRITICAL for Battle page)
   - `add_leaderboard_timestamp_logic.sql` - Creates the leaderboard view

3. ✅ **Recent Fixes**
   - `activate_weapon_research.sql` - Weapon research
   - `add_kingdom_upgrade_rpc.sql` - Secure kingdom upgrades
   - `fix_turn_generation.sql` - Turn generation rate
   - `optimize_battle_logic.sql` - Battle performance

## Quick Test
After running the leaderboard SQL:
1. Refresh the game
2. Click "Battle" in the top nav
3. You should see "1 WARRIORS FOUND" (yourself)
