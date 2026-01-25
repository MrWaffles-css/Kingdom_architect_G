-- Fix database linter warnings by setting fixed search_path for SECURITY DEFINER functions.
-- Also covers other functions flagged by the linter as having mutable search_path.
-- Run this in Supabase SQL Editor.

-- 1. Season and Time Management
ALTER FUNCTION public.set_season_end_time SET search_path = public;
ALTER FUNCTION public.get_season_end_time SET search_path = public;
ALTER FUNCTION public.get_public_season_status SET search_path = public;
ALTER FUNCTION public.check_season_expiry SET search_path = public;
ALTER FUNCTION public.check_season_transitions SET search_path = public;
ALTER FUNCTION public.check_season_start SET search_path = public;
ALTER FUNCTION public.get_server_time SET search_path = public;
ALTER FUNCTION public.check_and_end_season_cron SET search_path = public;
ALTER FUNCTION public.check_and_activate_season_cron SET search_path = public;

-- 2. Admin Functions
ALTER FUNCTION public.admin_schedule_season_v3 SET search_path = public;
ALTER FUNCTION public.admin_start_season_now_v3 SET search_path = public;
ALTER FUNCTION public.admin_end_season_now_v3 SET search_path = public;
ALTER FUNCTION public.admin_archive_season_and_reset SET search_path = public;
ALTER FUNCTION public.admin_archive_season SET search_path = public;
ALTER FUNCTION public.admin_reset_world_stats SET search_path = public;
ALTER FUNCTION public.schedule_next_season_v2 SET search_path = public;
ALTER FUNCTION public.reset_world() SET search_path = public;

-- 3. Research and Tech
ALTER FUNCTION public.upgrade_research_turns SET search_path = public;
ALTER FUNCTION public.get_tech_multiplier(int) SET search_path = public;
ALTER FUNCTION public.get_tech_video_cost(int) SET search_path = public;
ALTER FUNCTION public.upgrade_research_spy_report() SET search_path = public;
ALTER FUNCTION public.upgrade_research_hostage_convert SET search_path = public;
ALTER FUNCTION public.upgrade_research_attack() SET search_path = public;
ALTER FUNCTION public.upgrade_research_defense() SET search_path = public;
ALTER FUNCTION public.upgrade_research_gold_steal SET search_path = public;
ALTER FUNCTION public.upgrade_research_spy() SET search_path = public;
ALTER FUNCTION public.upgrade_research_sentry() SET search_path = public;

-- 4. Gameplay / Economy
ALTER FUNCTION public.generate_resources SET search_path = public;
ALTER FUNCTION public.train_miners(int) SET search_path = public;
ALTER FUNCTION public.recalculate_user_stats(uuid) SET search_path = public;
ALTER FUNCTION public.buy_weapon(text, int, int) SET search_path = public;
ALTER FUNCTION public.sell_weapon(text, int, int) SET search_path = public;
ALTER FUNCTION public.convert_hostages_to_citizens SET search_path = public;
ALTER FUNCTION public.process_game_tick SET search_path = public;
ALTER FUNCTION public.advance_tutorial(int) SET search_path = public;
ALTER FUNCTION public.skip_tutorial SET search_path = public;

-- 5. Combat and Spy
ALTER FUNCTION public.get_battle_opponents SET search_path = public;
ALTER FUNCTION public.get_latest_spy_report(uuid) SET search_path = public;
ALTER FUNCTION public.spy_player(uuid) SET search_path = public;
ALTER FUNCTION public.attack_player(uuid) SET search_path = public;

-- 6. Other
ALTER FUNCTION public.archive_hall_of_fame SET search_path = public;

-- Note on 'Leaked Password Protection Disabled':
-- This is a Supabase Auth setting. To fix this:
-- 1. Go to Authentication > Providers > Email
-- 2. Enable "Check for leaked passwords" (HaveIBeenPwned integration).
