-- =====================================================
-- DIAGNOSTIC: Check if Meg is in leaderboard view
-- =====================================================

-- Check if Meg appears in leaderboard
SELECT * FROM leaderboard WHERE username ILIKE '%meg%';

-- Check if there are any errors when selecting from leaderboard
SELECT COUNT(*) as total_players FROM leaderboard;

-- Try to manually query what GameContext does
SELECT 
    rank_attack, 
    rank_defense, 
    rank_spy, 
    rank_sentry, 
    overall_rank
FROM leaderboard
WHERE id = (SELECT id FROM profiles WHERE username ILIKE '%meg%');
