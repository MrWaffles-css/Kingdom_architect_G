-- 1. Add is_beta column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hall_of_fame_seasons' AND column_name = 'is_beta') THEN
        ALTER TABLE public.hall_of_fame_seasons ADD COLUMN is_beta BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Update Archive Function to accept is_beta
CREATE OR REPLACE FUNCTION public.archive_hall_of_fame(
    p_season_number INTEGER,
    p_is_beta BOOLEAN DEFAULT FALSE
)
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
    INSERT INTO public.hall_of_fame_seasons (season_number, archived_by, is_beta)
    VALUES (p_season_number, auth.uid(), p_is_beta)
    RETURNING id INTO v_season_id;

    -- Snapshot Current Rankings from Leaderboard View
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
