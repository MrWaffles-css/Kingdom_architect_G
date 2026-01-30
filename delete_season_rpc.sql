CREATE OR REPLACE FUNCTION public.delete_hall_of_fame_season(p_season_number INTEGER)
RETURNS VOID AS $$
BEGIN
    -- Check if the season exists
    IF NOT EXISTS (SELECT 1 FROM public.hall_of_fame_seasons WHERE season_number = p_season_number) THEN
        RAISE EXCEPTION 'Season % does not exist', p_season_number;
    END IF;

    -- Delete the season (Cascades to entries)
    DELETE FROM public.hall_of_fame_seasons
    WHERE season_number = p_season_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
