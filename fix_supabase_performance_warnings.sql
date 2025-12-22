-- =====================================================
-- FIX: Supabase Performance Warnings
-- =====================================================
-- This migration fixes all performance warnings from Supabase linter:
-- 1. Optimizes RLS policies by wrapping auth.uid() with (select auth.uid())
-- 2. Consolidates duplicate RLS policies
-- 3. Removes duplicate indexes

-- =====================================================
-- PART 1: Drop Duplicate Indexes
-- =====================================================

DROP INDEX IF EXISTS idx_message_recipients_recipient;
DROP INDEX IF EXISTS idx_messages_sender;

-- =====================================================
-- PART 2: Consolidate and Optimize RLS Policies
-- =====================================================

-- PROFILES TABLE
-- Drop all existing policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile or admin" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile or admin" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- Create consolidated, optimized policies
CREATE POLICY "profiles_select_all"
ON profiles FOR SELECT
TO public
USING (true);  -- Profiles are public

CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "profiles_update_own_or_admin"
ON profiles FOR UPDATE
TO authenticated
USING (
    (select auth.uid()) = id 
    OR EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = (select auth.uid()) 
        AND p.is_admin = true
    )
)
WITH CHECK (
    (select auth.uid()) = id 
    OR EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = (select auth.uid()) 
        AND p.is_admin = true
    )
);

-- USER_STATS TABLE
-- Drop all existing policies
DROP POLICY IF EXISTS "User stats are viewable by everyone" ON user_stats;
DROP POLICY IF EXISTS "Users can view own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can view own stats or admin" ON user_stats;
DROP POLICY IF EXISTS "Users can view their own stats" ON user_stats;
DROP POLICY IF EXISTS "Admins can view any stats" ON user_stats;
DROP POLICY IF EXISTS "Users can insert own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can insert their own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can update own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can update own stats or admin" ON user_stats;
DROP POLICY IF EXISTS "Users can update their own stats" ON user_stats;
DROP POLICY IF EXISTS "Admins can update any stats" ON user_stats;

-- Create consolidated, optimized policies
CREATE POLICY "user_stats_select_all"
ON user_stats FOR SELECT
TO public
USING (true);  -- Stats are public (for leaderboard)

CREATE POLICY "user_stats_insert_own"
ON user_stats FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "user_stats_update_own_or_admin"
ON user_stats FOR UPDATE
TO authenticated
USING (
    (select auth.uid()) = id 
    OR EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = (select auth.uid()) 
        AND p.is_admin = true
    )
)
WITH CHECK (
    (select auth.uid()) = id 
    OR EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = (select auth.uid()) 
        AND p.is_admin = true
    )
);

-- MESSAGES TABLE
-- Drop existing policies
DROP POLICY IF EXISTS "Senders can view own messages" ON messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON messages;

-- Create consolidated, optimized policy
CREATE POLICY "messages_select_own_or_admin"
ON messages FOR SELECT
TO public
USING (
    (select auth.uid()) = sender_id 
    OR EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = (select auth.uid()) 
        AND p.is_admin = true
    )
);

-- REPORTS TABLE
-- Optimize existing policy
DROP POLICY IF EXISTS "Users can view own reports" ON reports;

CREATE POLICY "reports_select_own"
ON reports FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

-- MESSAGE_RECIPIENTS TABLE
-- Optimize existing policy
DROP POLICY IF EXISTS "Recipients can view own messages" ON message_recipients;

CREATE POLICY "message_recipients_select_own"
ON message_recipients FOR SELECT
TO public
USING ((select auth.uid()) = recipient_id);

-- BLOCKED_USERS TABLE
-- Optimize existing policies
DROP POLICY IF EXISTS "Users can view own block list" ON blocked_users;
DROP POLICY IF EXISTS "Users can add to block list" ON blocked_users;
DROP POLICY IF EXISTS "Users can remove from block list" ON blocked_users;

CREATE POLICY "blocked_users_select_own"
ON blocked_users FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "blocked_users_insert_own"
ON blocked_users FOR INSERT
TO public
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "blocked_users_delete_own"
ON blocked_users FOR DELETE
TO public
USING ((select auth.uid()) = user_id);

-- CHAT_CONVERSATIONS TABLE
-- Optimize existing policy
DROP POLICY IF EXISTS "Users can view own conversations" ON chat_conversations;

CREATE POLICY "chat_conversations_select_own"
ON chat_conversations FOR SELECT
TO public
USING (
    (select auth.uid()) = user1_id 
    OR (select auth.uid()) = user2_id
);

-- CHAT_MESSAGES TABLE
-- Optimize existing policy
DROP POLICY IF EXISTS "Users can view own chat messages" ON chat_messages;

CREATE POLICY "chat_messages_select_own"
ON chat_messages FOR SELECT
TO public
USING (
    (select auth.uid()) = sender_id 
    OR (select auth.uid()) = recipient_id
);

-- CHAT_TYPING_STATUS TABLE
-- Optimize existing policy
DROP POLICY IF EXISTS "Users can view typing status" ON chat_typing_status;

CREATE POLICY "chat_typing_status_all_own"
ON chat_typing_status FOR ALL
TO public
USING (
    EXISTS (
        SELECT 1 FROM chat_conversations cc
        WHERE cc.id = chat_typing_status.conversation_id
        AND (
            cc.user1_id = (select auth.uid()) 
            OR cc.user2_id = (select auth.uid())
        )
    )
);

-- USER_WEAPONS TABLE
-- Optimize existing policies
DROP POLICY IF EXISTS "Users can view own weapons" ON user_weapons;
DROP POLICY IF EXISTS "Users can update own weapons" ON user_weapons;
DROP POLICY IF EXISTS "Users can insert own weapons" ON user_weapons;

CREATE POLICY "user_weapons_select_own"
ON user_weapons FOR SELECT
TO public
USING ((select auth.uid()) = user_id);

CREATE POLICY "user_weapons_insert_own"
ON user_weapons FOR INSERT
TO public
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "user_weapons_update_own"
ON user_weapons FOR UPDATE
TO public
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);
