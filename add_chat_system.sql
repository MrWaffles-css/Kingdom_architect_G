-- Add Chat System Tables & Functions
-- Run this in Supabase SQL Editor

-- 1. Create Chat Conversations Table
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user1_id uuid REFERENCES public.profiles(id) NOT NULL,
    user2_id uuid REFERENCES public.profiles(id) NOT NULL,
    last_message_at timestamptz DEFAULT now(),
    user1_unread_count int DEFAULT 0,
    user2_unread_count int DEFAULT 0,
    UNIQUE(user1_id, user2_id)
);

-- 2. Create Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid REFERENCES public.chat_conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id uuid REFERENCES public.profiles(id) NOT NULL,
    recipient_id uuid REFERENCES public.profiles(id) NOT NULL,
    message text NOT NULL CHECK (length(message) <= 500),
    created_at timestamptz DEFAULT now(),
    is_read boolean DEFAULT false,
    read_at timestamptz
);

-- 3. Create Typing Status Table
CREATE TABLE IF NOT EXISTS public.chat_typing_status (
    conversation_id uuid REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id),
    is_typing boolean DEFAULT false,
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user1 ON public.chat_conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user2 ON public.chat_conversations(user2_id);

-- Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_typing_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Conversations: Users can view their own conversations
CREATE POLICY "Users can view own conversations" ON public.chat_conversations
    FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Messages: Users can view messages in their conversations
CREATE POLICY "Users can view own chat messages" ON public.chat_messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Typing: Users can view/update typing in their conversations
CREATE POLICY "Users can view typing status" ON public.chat_typing_status
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.chat_conversations 
            WHERE id = conversation_id 
            AND (user1_id = auth.uid() OR user2_id = auth.uid())
        )
    );

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_typing_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;

-- Functions

-- Function: Send Chat Message
CREATE OR REPLACE FUNCTION send_chat_message(
    p_recipient_id uuid,
    p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_id uuid := auth.uid();
    v_conversation_id uuid;
    v_user1 uuid;
    v_user2 uuid;
    v_clean_message text;
    v_ban_status jsonb;
    v_blocked boolean;
    v_msg_id uuid;
BEGIN
    -- 1. Check Chat Ban
    v_ban_status := check_chat_ban(v_sender_id);
    IF (v_ban_status->>'is_banned')::boolean THEN
        RAISE EXCEPTION 'You are banned from sending messages.';
    END IF;

    -- 2. Check Blocked
    SELECT EXISTS(SELECT 1 FROM public.blocked_users WHERE user_id = p_recipient_id AND blocked_user_id = v_sender_id)
    INTO v_blocked;
    
    IF v_blocked THEN
        RAISE EXCEPTION 'You cannot message this user.';
    END IF;

    -- 3. Filter Profanity
    v_clean_message := check_profanity(p_message);

    -- 4. Get or Create Conversation
    -- Ensure consistent user ordering (smaller ID first)
    IF v_sender_id < p_recipient_id THEN
        v_user1 := v_sender_id;
        v_user2 := p_recipient_id;
    ELSE
        v_user1 := p_recipient_id;
        v_user2 := v_sender_id;
    END IF;

    SELECT id INTO v_conversation_id
    FROM public.chat_conversations
    WHERE user1_id = v_user1 AND user2_id = v_user2;

    IF NOT FOUND THEN
        INSERT INTO public.chat_conversations (user1_id, user2_id, last_message_at)
        VALUES (v_user1, v_user2, now())
        RETURNING id INTO v_conversation_id;
    END IF;

    -- 5. Insert Message
    INSERT INTO public.chat_messages (conversation_id, sender_id, recipient_id, message)
    VALUES (v_conversation_id, v_sender_id, p_recipient_id, v_clean_message)
    RETURNING id INTO v_msg_id;

    -- 6. Update Conversation (Timestamp & Unread Count)
    IF v_sender_id = v_user1 THEN
        -- Sender is User1, Recipient is User2 -> Increment User2 unread
        UPDATE public.chat_conversations
        SET last_message_at = now(),
            user2_unread_count = user2_unread_count + 1
        WHERE id = v_conversation_id;
    ELSE
        -- Sender is User2, Recipient is User1 -> Increment User1 unread
        UPDATE public.chat_conversations
        SET last_message_at = now(),
            user1_unread_count = user1_unread_count + 1
        WHERE id = v_conversation_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'message_id', v_msg_id, 'conversation_id', v_conversation_id);
END;
$$;

-- Function: Get Chat Conversations
CREATE OR REPLACE FUNCTION get_chat_conversations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_result jsonb;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'conversation_id', c.id,
            'other_user_id', CASE WHEN c.user1_id = v_user_id THEN c.user2_id ELSE c.user1_id END,
            'other_user_name', p.username,
            'last_message_at', c.last_message_at,
            'unread_count', CASE WHEN c.user1_id = v_user_id THEN c.user1_unread_count ELSE c.user2_unread_count END,
            'last_message', (
                SELECT message FROM public.chat_messages 
                WHERE conversation_id = c.id 
                ORDER BY created_at DESC LIMIT 1
            )
        ) ORDER BY c.last_message_at DESC
    )
    INTO v_result
    FROM public.chat_conversations c
    JOIN public.profiles p ON p.id = (CASE WHEN c.user1_id = v_user_id THEN c.user2_id ELSE c.user1_id END)
    WHERE c.user1_id = v_user_id OR c.user2_id = v_user_id;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Function: Mark Chat Read
CREATE OR REPLACE FUNCTION mark_chat_as_read(p_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_user1 uuid;
    v_user2 uuid;
BEGIN
    SELECT user1_id, user2_id INTO v_user1, v_user2
    FROM public.chat_conversations
    WHERE id = p_conversation_id;

    -- Reset unread count for current user
    IF v_user_id = v_user1 THEN
        UPDATE public.chat_conversations
        SET user1_unread_count = 0
        WHERE id = p_conversation_id;
    ELSIF v_user_id = v_user2 THEN
        UPDATE public.chat_conversations
        SET user2_unread_count = 0
        WHERE id = p_conversation_id;
    END IF;

    -- Mark messages as read
    UPDATE public.chat_messages
    SET is_read = true, read_at = now()
    WHERE conversation_id = p_conversation_id
      AND recipient_id = v_user_id
      AND is_read = false;

    RETURN true;
END;
$$;
