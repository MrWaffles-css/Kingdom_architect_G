-- =====================================================
-- DIAGNOSTIC: Verify Battle System
-- =====================================================
-- Run this script to check if the Battle page components exist.

-- 1. Check if Leaderboard View exists
SELECT 
    table_schema, 
    table_name, 
    table_type 
FROM information_schema.tables 
WHERE table_name = 'leaderboard';

-- 2. Check if RPC Function exists
SELECT 
    routine_name, 
    routine_type 
FROM information_schema.routines 
WHERE routine_name = 'get_battle_opponents';

-- 3. Try to run the function (Test Call)
-- This mimics what the frontend does.
-- If this fails, the issue is in the SQL logic.
SELECT * FROM get_battle_opponents(0, 5);
