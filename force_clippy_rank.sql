-- Force update ranks to ensure visibility
UPDATE public.user_stats SET rank = 1, experience = 999999 WHERE id = (SELECT id FROM profiles WHERE username ILIKE 'Clippy');
-- Refresh leaderboard (if it's a materialized view, but usually it's live or triggered)
-- If leaderboard is a table, update it too
UPDATE public.leaderboard SET overall_rank = 1 WHERE username ILIKE 'Clippy';

-- Move 1122 down
UPDATE public.leaderboard SET overall_rank = 5 WHERE username = '1122';
