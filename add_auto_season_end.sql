-- add_auto_season_end.sql

-- Redefine process_game_tick to include automated season ending logic.
-- This ensures that if a scheduled_end_date is reached, the season automatically closes
-- without requiring an admin to be online or the Welcome Page to be open.

CREATE OR REPLACE FUNCTION public.process_game_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Standard Resource Generation (Preserved)
    WITH gains AS (
        SELECT
            id,
            -- Gold Gain Calculation
            (
                (COALESCE(citizens, 0) * 1) + -- Untrained
                (FLOOR(
                    (COALESCE(attack_soldiers, 0) + COALESCE(defense_soldiers, 0) + COALESCE(spies, 0) + COALESCE(sentries, 0))
                    * 0.5
                )) + -- Trained
                (COALESCE(miners, 0) * (2 + GREATEST(0, COALESCE(gold_mine_level, 1) - 1))) -- Miners
            ) AS gold_gain,
            
            -- Vault Capacity Lookup
            CASE
                WHEN COALESCE(vault_level, 0) = 1 THEN 100000
                WHEN vault_level = 2 THEN 500000
                WHEN vault_level = 3 THEN 1500000
                WHEN vault_level = 4 THEN 5000000
                WHEN vault_level = 5 THEN 15000000
                WHEN vault_level = 6 THEN 50000000
                WHEN vault_level = 7 THEN 150000000
                WHEN vault_level = 8 THEN 500000000
                WHEN vault_level = 9 THEN 1500000000
                WHEN vault_level >= 10 THEN 5000000000
                ELSE 0
            END AS vault_cap,
            
            -- Vault Interest Rate
            LEAST(0.50, COALESCE(vault_level, 0) * 0.05) AS interest_rate
        FROM public.user_stats
    )
    UPDATE public.user_stats u
    SET
        citizens = citizens + (COALESCE(kingdom_level, 0) * 10),
        
        gold = gold + g.gold_gain,
        
        -- Vault: If not over capacity, add interest (min with capacity)
        vault = CASE
            WHEN u.vault >= g.vault_cap THEN u.vault -- Over capacity => No interest
            ELSE LEAST(g.vault_cap, u.vault + FLOOR(g.gold_gain * g.interest_rate)::bigint)
        END,
        
        experience = experience + COALESCE(library_level, 1),
        
        turns = turns + COALESCE(research_turns_per_min, 0),
        
        updated_at = NOW(),
        last_resource_generation = NOW()
    FROM gains g
    WHERE u.id = g.id;

    -- 2. Automated Season Ending Check
    -- If a season is active AND has passed its scheduled end date, close it.
    UPDATE seasons
    SET is_active = FALSE
    WHERE is_active = TRUE
      AND scheduled_end_date IS NOT NULL
      AND scheduled_end_date <= NOW();

END;
$$;

-- Ensure pg_cron is scheduled (idempotent)
SELECT cron.schedule(
    'process_game_tick', -- Job name
    '* * * * *',         -- Schedule (Every minute)
    'SELECT public.process_game_tick()'
);

NOTIFY pgrst, 'reload schema';
