-- Allow admins to view all messages
CREATE POLICY "Admins can view all messages" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Function: Admin Chat Unban
CREATE OR REPLACE FUNCTION admin_chat_unban(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id uuid := auth.uid();
    v_is_admin boolean;
BEGIN
    -- Check Admin
    SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Deactivate Ban
    UPDATE public.chat_bans
    SET is_active = false
    WHERE user_id = p_user_id AND is_active = true;

    RETURN true;
END;
$$;

-- Function: Admin Delete Message (Permanent)
CREATE OR REPLACE FUNCTION admin_delete_message(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id uuid := auth.uid();
    v_is_admin boolean;
BEGIN
    -- Check Admin
    SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Delete Message (Cascades to recipients)
    DELETE FROM public.messages WHERE id = p_message_id;

    RETURN true;
END;
$$;
