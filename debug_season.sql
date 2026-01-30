
-- Check function definitions
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_maintenance_mode', 'get_season_end_time', 'set_season_end_time');

-- Check game_settings content
SELECT * FROM game_settings;
