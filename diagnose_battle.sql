-- =====================================================
-- DIAGNOSTIC: Deep Dive into Battle System
-- =====================================================

-- 1. Count User Stats (Should be > 0)
SELECT 'user_stats count' as check_name, count(*) as count FROM user_stats;

-- 2. Count Profiles (Should be > 0)
SELECT 'profiles count' as check_name, count(*) as count FROM profiles;

-- 3. Count Leaderboard View (Should be > 0)
-- Note: This runs as YOU (the admin/postgres), so it should see everything.
SELECT 'leaderboard view count' as check_name, count(*) as count FROM leaderboard;

-- 4. Test the RPC Function
-- This runs the function with your permissions.
SELECT * FROM get_battle_opponents(0, 5);

-- 5. Check RLS Policies
SELECT tablename, policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('user_stats', 'profiles');
