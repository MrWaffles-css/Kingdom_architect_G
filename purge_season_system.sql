-- purge_season_system.sql
-- Completely removes all season-related tables, functions, and logic to start fresh.

-- 1. Drop season-related functions
DROP FUNCTION IF EXISTS get_admin_season_dashboard() CASCADE;
DROP FUNCTION IF EXISTS admin_schedule_season(integer, timestamptz, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS admin_start_season_now(uuid) CASCADE;
DROP FUNCTION IF EXISTS admin_end_season_now(uuid) CASCADE;
DROP FUNCTION IF EXISTS schedule_next_season(timestamptz, integer, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS activate_pending_season(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_next_scheduled_season() CASCADE;

-- 2. Drop the seasons table
DROP TABLE IF EXISTS seasons CASCADE;

-- 3. Revert process_game_tick to remove season check
CREATE OR REPLACE FUNCTION public.process_game_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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

    -- No season logic anymore
END;
$$;

NOTIFY pgrst, 'reload schema';
