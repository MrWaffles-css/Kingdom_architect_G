-- Fix Database Security and Performance Issues
-- Run this in Supabase SQL Editor

-- ==========================================
-- 1. Fix Security Definer Views
-- ==========================================

-- Recreate leaderboard view with security_invoker = true
CREATE OR REPLACE VIEW public.leaderboard WITH (security_invoker = true) AS
WITH individual_ranks AS (
    SELECT us.id,
           us.kingdom_level,
           us.attack,
           us.defense,
           us.spy,
           us.sentry,
           us.updated_at,
           p.username,
           p.is_admin,
           dense_rank() OVER (ORDER BY us.attack DESC, us.updated_at) AS rank_attack,
           dense_rank() OVER (ORDER BY us.defense DESC, us.updated_at) AS rank_defense,
           dense_rank() OVER (ORDER BY us.spy DESC, us.updated_at) AS rank_spy,
           dense_rank() OVER (ORDER BY us.sentry DESC, us.updated_at) AS rank_sentry
    FROM user_stats us
    JOIN profiles p ON us.id = p.id
)
SELECT id,
       username,
       is_admin,
       kingdom_level,
       attack,
       defense,
       spy,
       sentry,
       rank_attack,
       rank_defense,
       rank_spy,
       rank_sentry,
       rank_attack + rank_defense + rank_spy + rank_sentry AS rank_score,
       rank() OVER (ORDER BY (rank_attack + rank_defense + rank_spy + rank_sentry), updated_at) AS overall_rank,
       updated_at
FROM individual_ranks;

-- Recreate daily_leaderboard view with security_invoker = true
CREATE OR REPLACE VIEW public.daily_leaderboard WITH (security_invoker = true) AS
SELECT ds.user_id,
       ds.date,
       ds.attacks_count,
       ds.gold_stolen,
       p.username,
       row_number() OVER (PARTITION BY ds.date ORDER BY ds.attacks_count DESC) AS attacker_rank,
       row_number() OVER (PARTITION BY ds.date ORDER BY ds.gold_stolen DESC) AS looter_rank
FROM daily_stats ds
LEFT JOIN profiles p ON ds.user_id = p.id
WHERE ds.date >= (CURRENT_DATE - '7 days'::interval);

-- ==========================================
-- 2. Fix Function Search Path
-- ==========================================

CREATE OR REPLACE FUNCTION public.check_profanity(p_text text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    v_word text;
    v_clean_text text := p_text;
BEGIN
    FOR v_word IN SELECT word FROM public.profanity_words LOOP
        v_clean_text := regexp_replace(v_clean_text, '\y' || v_word || '\y', repeat('*', length(v_word)), 'gi');
    END LOOP;
    return v_clean_text;
END;
$function$;

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_typing_status_user_id ON public.chat_typing_status(user_id);
CREATE INDEX IF NOT EXISTS idx_message_audit_log_admin_id ON public.message_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_message_rate_limit_user_id ON public.message_rate_limit(user_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_recipient_id ON public.message_recipients(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_user_weapons_user_id ON public.user_weapons(user_id);

