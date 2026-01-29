-- Disable the process_game_tick cron job to prevent database locking
-- The client-side "lazy evaluation" (generate_resources) handles resource generation efficiently
-- and prevents the "1 minute" lag spike caused by table locking.

SELECT cron.unschedule('process_game_tick');

-- Optional: You can also drop the function if you want to be sure it never runs
-- DROP FUNCTION public.process_game_tick();
