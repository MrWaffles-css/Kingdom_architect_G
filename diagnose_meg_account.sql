-- =====================================================
-- DIAGNOSTIC: Check Meg's Account Data
-- =====================================================

-- 1. Find Meg's user ID
SELECT 'Meg Profile' as check_name, id, username, created_at
FROM profiles
WHERE username ILIKE '%meg%';

-- 2. Check if Meg has user_stats
SELECT 'Meg Stats' as check_name, *
FROM user_stats
WHERE id IN (SELECT id FROM profiles WHERE username ILIKE '%meg%');

-- 3. Check if Meg appears in leaderboard
SELECT 'Meg Leaderboard' as check_name, *
FROM leaderboard
WHERE username ILIKE '%meg%';

-- 4. Check for any NULL or problematic values in Meg's stats
SELECT 
    'Meg NULL Check' as check_name,
    id,
    CASE WHEN gold IS NULL THEN 'gold is NULL' ELSE 'gold OK' END as gold_check,
    CASE WHEN citizens IS NULL THEN 'citizens is NULL' ELSE 'citizens OK' END as citizens_check,
    CASE WHEN kingdom_level IS NULL THEN 'kingdom_level is NULL' ELSE 'kingdom_level OK' END as kingdom_check,
    CASE WHEN library_level IS NULL THEN 'library_level is NULL' ELSE 'library_level OK' END as library_check
FROM user_stats
WHERE id IN (SELECT id FROM profiles WHERE username ILIKE '%meg%');
