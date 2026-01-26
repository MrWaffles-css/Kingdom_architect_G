-- =====================================================
-- 1. Create ALLIANCES Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.alliances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    leader_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    member_count INTEGER DEFAULT 1,
    is_open BOOLEAN DEFAULT true,
    min_level INTEGER DEFAULT 0
);

-- =====================================================
-- 2. Add ALLIANCE_ID to PROFILES (Publicly visible)
-- =====================================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS alliance_id UUID REFERENCES public.alliances(id) DEFAULT NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_alliance_id ON public.profiles(alliance_id);

-- =====================================================
-- 3. Create ALLIANCE_MESSAGES Table (Chat)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.alliance_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alliance_id UUID REFERENCES public.alliances(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for fetching chat
CREATE INDEX IF NOT EXISTS idx_alliance_messages_alliance_id ON public.alliance_messages(alliance_id);
