-- Add Mail System Tables & Functions
-- Run this in Supabase SQL Editor

-- 1. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id uuid REFERENCES public.profiles(id) NOT NULL,
    subject text NOT NULL CHECK (length(subject) <= 100),
    body text NOT NULL CHECK (length(body) <= 1000),
    priority text NOT NULL CHECK (priority IN ('admin', 'system', 'player')),
    created_at timestamptz DEFAULT now(),
    is_broadcast boolean DEFAULT false,
    parent_message_id uuid REFERENCES public.messages(id)
);

-- 2. Create Message Recipients Table
CREATE TABLE IF NOT EXISTS public.message_recipients (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
    recipient_id uuid REFERENCES public.profiles(id) NOT NULL,
    is_read boolean DEFAULT false,
    read_at timestamptz,
    is_deleted boolean DEFAULT false,
    deleted_at timestamptz
);

-- 3. Create Blocked Users Table
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) NOT NULL,
    blocked_user_id uuid REFERENCES public.profiles(id) NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, blocked_user_id)
);

-- 4. Create Profanity Filter Table
CREATE TABLE IF NOT EXISTS public.profanity_words (
    id serial PRIMARY KEY,
    word text UNIQUE NOT NULL,
    severity text CHECK (severity IN ('strict', 'moderate')) NOT NULL
);

-- 5. Create Message Audit Log
CREATE TABLE IF NOT EXISTS public.message_audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id uuid REFERENCES public.profiles(id) NOT NULL,
    action text NOT NULL,
    message_id uuid REFERENCES public.messages(id),
    details jsonb,
    created_at timestamptz DEFAULT now()
);

-- 6. Create Chat Bans Table
CREATE TABLE IF NOT EXISTS public.chat_bans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) NOT NULL,
    banned_by uuid REFERENCES public.profiles(id) NOT NULL,
    reason text,
    banned_at timestamptz DEFAULT now(),
    expires_at timestamptz, -- null = permanent
    is_active boolean DEFAULT true
);

-- 7. Create Message Rate Limit Table
CREATE TABLE IF NOT EXISTS public.message_rate_limit (
    user_id uuid REFERENCES public.profiles(id) PRIMARY KEY,
    message_count int DEFAULT 0,
    window_start timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_recipient ON public.message_recipients(recipient_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_message ON public.message_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_bans_user ON public.chat_bans(user_id) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_bans ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Messages: Senders can view their own messages
CREATE POLICY "Senders can view own messages" ON public.messages
    FOR SELECT USING (auth.uid() = sender_id);

-- Recipients: Users can view messages sent to them
CREATE POLICY "Recipients can view own messages" ON public.message_recipients
    FOR SELECT USING (auth.uid() = recipient_id);

-- Blocked Users: Users can manage their block list
CREATE POLICY "Users can view own block list" ON public.blocked_users
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add to block list" ON public.blocked_users
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from block list" ON public.blocked_users
    FOR DELETE USING (auth.uid() = user_id);

-- Chat Bans: Publicly viewable (needed for checks) but only admins can insert/update
CREATE POLICY "Chat bans are viewable" ON public.chat_bans
    FOR SELECT USING (true);

-- Functions

-- Helper: Check Profanity
CREATE OR REPLACE FUNCTION check_profanity(p_text text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_word text;
    v_clean_text text := p_text;
BEGIN
    FOR v_word IN SELECT word FROM public.profanity_words LOOP
        v_clean_text := regexp_replace(v_clean_text, '\y' || v_word || '\y', repeat('*', length(v_word)), 'gi');
    END LOOP;
    return v_clean_text;
END;
$$;

-- Helper: Check Rate Limit
CREATE OR REPLACE FUNCTION check_rate_limit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_limit int := 50; -- 50 messages per hour
    v_record record;
BEGIN
    SELECT * INTO v_record FROM public.message_rate_limit WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO public.message_rate_limit (user_id, message_count, window_start)
        VALUES (p_user_id, 1, now());
        RETURN true;
    END IF;
    
    -- Check if window expired (1 hour)
    IF v_record.window_start < now() - interval '1 hour' THEN
        UPDATE public.message_rate_limit
        SET message_count = 1, window_start = now()
        WHERE user_id = p_user_id;
        RETURN true;
    END IF;
    
    -- Check limit
    IF v_record.message_count >= v_limit THEN
        RETURN false;
    END IF;
    
    -- Increment
    UPDATE public.message_rate_limit
    SET message_count = message_count + 1
    WHERE user_id = p_user_id;
    
    RETURN true;
END;
$$;

-- Helper: Check Chat Ban
CREATE OR REPLACE FUNCTION check_chat_ban(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ban record;
BEGIN
    -- Check for active ban
    SELECT * INTO v_ban 
    FROM public.chat_bans 
    WHERE user_id = p_user_id 
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY banned_at DESC
    LIMIT 1;
    
    IF FOUND THEN
        RETURN jsonb_build_object('is_banned', true, 'reason', v_ban.reason, 'expires_at', v_ban.expires_at);
    END IF;
    
    RETURN jsonb_build_object('is_banned', false);
END;
$$;

-- Function: Send Message
CREATE OR REPLACE FUNCTION send_message(
    p_recipient_ids uuid[],
    p_subject text,
    p_body text,
    p_parent_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_id uuid := auth.uid();
    v_clean_subject text;
    v_clean_body text;
    v_message_id uuid;
    v_recipient_id uuid;
    v_ban_status jsonb;
    v_blocked boolean;
BEGIN
    -- 1. Check Chat Ban
    v_ban_status := check_chat_ban(v_sender_id);
    IF (v_ban_status->>'is_banned')::boolean THEN
        RAISE EXCEPTION 'You are banned from sending messages. Reason: %', v_ban_status->>'reason';
    END IF;

    -- 2. Check Rate Limit
    IF NOT check_rate_limit(v_sender_id) THEN
        RAISE EXCEPTION 'Rate limit exceeded. You can only send 50 messages per hour.';
    END IF;

    -- 3. Filter Profanity
    v_clean_subject := check_profanity(p_subject);
    v_clean_body := check_profanity(p_body);

    -- 4. Create Message
    INSERT INTO public.messages (sender_id, subject, body, priority, parent_message_id)
    VALUES (v_sender_id, v_clean_subject, v_clean_body, 'player', p_parent_id)
    RETURNING id INTO v_message_id;

    -- 5. Create Recipients
    FOREACH v_recipient_id IN ARRAY p_recipient_ids LOOP
        -- Check if blocked
        SELECT EXISTS(SELECT 1 FROM public.blocked_users WHERE user_id = v_recipient_id AND blocked_user_id = v_sender_id)
        INTO v_blocked;
        
        IF NOT v_blocked THEN
            INSERT INTO public.message_recipients (message_id, recipient_id)
            VALUES (v_message_id, v_recipient_id);
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message_id', v_message_id);
END;
$$;

-- Function: Get Inbox
CREATE OR REPLACE FUNCTION get_inbox(
    p_folder text DEFAULT 'inbox',
    p_filter text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_result jsonb;
BEGIN
    IF p_folder = 'inbox' THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', m.id,
                'subject', m.subject,
                'body', m.body,
                'priority', m.priority,
                'created_at', m.created_at,
                'sender_name', p.username,
                'sender_id', m.sender_id,
                'is_read', mr.is_read,
                'is_broadcast', m.is_broadcast
            ) ORDER BY 
                CASE WHEN m.priority = 'admin' THEN 1 WHEN m.priority = 'system' THEN 2 ELSE 3 END,
                m.created_at DESC
        )
        INTO v_result
        FROM public.message_recipients mr
        JOIN public.messages m ON mr.message_id = m.id
        JOIN public.profiles p ON m.sender_id = p.id
        WHERE mr.recipient_id = v_user_id
          AND mr.is_deleted = false
          AND (
              p_filter = 'all' OR
              (p_filter = 'unread' AND mr.is_read = false) OR
              (p_filter = 'admin' AND m.priority = 'admin') OR
              (p_filter = 'system' AND m.priority = 'system') OR
              (p_filter = 'player' AND m.priority = 'player')
          );
          
    ELSIF p_folder = 'sent' THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', m.id,
                'subject', m.subject,
                'body', m.body,
                'priority', m.priority,
                'created_at', m.created_at,
                'recipient_count', (SELECT count(*) FROM public.message_recipients WHERE message_id = m.id)
            ) ORDER BY m.created_at DESC
        )
        INTO v_result
        FROM public.messages m
        WHERE m.sender_id = v_user_id;
        
    ELSIF p_folder = 'deleted' THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', m.id,
                'subject', m.subject,
                'body', m.body,
                'priority', m.priority,
                'created_at', m.created_at,
                'sender_name', p.username,
                'deleted_at', mr.deleted_at
            ) ORDER BY mr.deleted_at DESC
        )
        INTO v_result
        FROM public.message_recipients mr
        JOIN public.messages m ON mr.message_id = m.id
        JOIN public.profiles p ON m.sender_id = p.id
        WHERE mr.recipient_id = v_user_id
          AND mr.is_deleted = true;
    END IF;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Function: Mark as Read
CREATE OR REPLACE FUNCTION mark_as_read(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.message_recipients
    SET is_read = true, read_at = now()
    WHERE message_id = p_message_id AND recipient_id = auth.uid();
    
    RETURN FOUND;
END;
$$;

-- Function: Delete Message (Soft)
CREATE OR REPLACE FUNCTION delete_message(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.message_recipients
    SET is_deleted = true, deleted_at = now()
    WHERE message_id = p_message_id AND recipient_id = auth.uid();
    
    RETURN FOUND;
END;
$$;

-- Function: Admin Broadcast
CREATE OR REPLACE FUNCTION admin_broadcast(
    p_subject text,
    p_body text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id uuid := auth.uid();
    v_is_admin boolean;
    v_message_id uuid;
BEGIN
    -- Check Admin
    SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Create Message
    INSERT INTO public.messages (sender_id, subject, body, priority, is_broadcast)
    VALUES (v_admin_id, p_subject, p_body, 'admin', true)
    RETURNING id INTO v_message_id;

    -- Send to ALL users
    INSERT INTO public.message_recipients (message_id, recipient_id)
    SELECT v_message_id, id FROM public.profiles;

    RETURN true;
END;
$$;

-- Seed some profanity words (Basic list)
INSERT INTO public.profanity_words (word, severity) VALUES
('badword', 'strict'),
('spam', 'moderate')
ON CONFLICT DO NOTHING;
