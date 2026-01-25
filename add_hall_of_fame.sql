-- Update Hall of Fame Tables (Remove Gold and Citizens)

-- 1. CLEANUP: Drop existing objects to ensure clean state
DROP FUNCTION IF EXISTS public.archive_hall_of_fame(INTEGER);
DROP TABLE IF EXISTS public.hall_of_fame_entries;
DROP TABLE IF EXISTS public.hall_of_fame_seasons;

-- 2. Seasons Table
CREATE TABLE public.hall_of_fame_seasons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    season_number INTEGER NOT NULL UNIQUE,
    archived_at TIMESTAMPTZ DEFAULT NOW(),
    archived_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.hall_of_fame_seasons ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on seasons"
    ON public.hall_of_fame_seasons
    FOR SELECT
    USING (true);

-- 3. Entries Table (Removed Gold and Citizens)
CREATE TABLE public.hall_of_fame_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    season_id UUID REFERENCES public.hall_of_fame_seasons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    username TEXT NOT NULL,
    overall_rank INTEGER,
    rank_attack INTEGER,
    rank_defense INTEGER,
    rank_spy INTEGER,
    rank_sentry INTEGER,
    attack BIGINT,
    defense BIGINT,
    spy BIGINT,
    sentry BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.hall_of_fame_entries ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on entries"
    ON public.hall_of_fame_entries
    FOR SELECT
    USING (true);


-- 4. Archive Function
CREATE OR REPLACE FUNCTION public.archive_hall_of_fame(p_season_number INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_season_id UUID;
    v_count INTEGER;
BEGIN
    -- Check if season number already exists
    IF EXISTS (SELECT 1 FROM public.hall_of_fame_seasons WHERE season_number = p_season_number) THEN
        RAISE EXCEPTION 'Season number % already exists in Hall of Fame', p_season_number;
    END IF;

    -- Create new season record
    INSERT INTO public.hall_of_fame_seasons (season_number, archived_by)
    VALUES (p_season_number, auth.uid())
    RETURNING id INTO v_season_id;

    -- Snapshot Current Rankings from Leaderboard View
    -- Explicitly select only the supported columns.
    INSERT INTO public.hall_of_fame_entries (
        season_id,
        user_id,
        username,
        overall_rank,
        rank_attack,
        rank_defense,
        rank_spy,
        rank_sentry,
        attack,
        defense,
        spy,
        sentry
    )
    SELECT
        v_season_id,
        id, -- user_id
        username,
        overall_rank,
        rank_attack,
        rank_defense,
        rank_spy,
        rank_sentry,
        attack,
        defense,
        spy,
        sentry
    FROM public.leaderboard;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'season_id', v_season_id,
        'entries_archived', v_count
    );
END;
$$;
