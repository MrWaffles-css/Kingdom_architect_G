-- strict_server_cron_system.sql
-- Implements strict server-side resource generation every minute on the :00.

-- 1. Enable pg_cron if not available
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 2. Define the exact processing logic (Set-Based Update for Atomic Consistency)
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
END;
$$;

-- 3. Schedule the Cron Job to run exactly every minute
-- Note: 'SELECT public.process_game_tick()' ensures it runs inside the database.
SELECT cron.schedule(
    'process_game_tick', -- Job name
    '* * * * *',         -- Schedule (Every minute)
    'SELECT public.process_game_tick()'
);

-- 4. Convert client-side trigger to Read-Only
-- This ensures strictly server-side timing and prevents double-dipping.
CREATE OR REPLACE FUNCTION public.generate_resources()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result json;
BEGIN
    -- Just return current stats. The Cron Job handles the updates.
    SELECT row_to_json(us) INTO v_result FROM public.user_stats us WHERE id = auth.uid();
    RETURN v_result;
END;
$$;
