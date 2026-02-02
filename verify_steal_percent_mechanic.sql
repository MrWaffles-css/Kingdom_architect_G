-- ============================================================
-- Verification Script: Steal % Mechanic
-- ============================================================
-- This script verifies that the steal percentage mechanic is working correctly

-- 1. CHECK: Verify the columns exist in user_stats
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns
WHERE table_name = 'user_stats'
AND column_name IN ('research_gold_steal', 'research_vault_steal')
ORDER BY column_name;

-- 2. CHECK: Verify current steal research levels for all players
SELECT 
    p.username,
    us.research_gold_steal as gold_steal_level,
    (50 + (COALESCE(us.research_gold_steal, 0) * 5)) as gold_steal_percent,
    us.research_vault_steal as vault_steal_level,
    (COALESCE(us.research_vault_steal, 0) * 5) as vault_steal_percent
FROM user_stats us
JOIN profiles p ON us.id = p.id
ORDER BY p.username;

-- 3. CHECK: Verify the attack_player function uses steal percentages correctly
-- Extract the relevant logic from attack_player function
SELECT 
    prosrc 
FROM pg_proc 
WHERE proname = 'attack_player';

-- 4. VERIFY: Test the steal calculation logic
-- This simulates what happens during an attack
DO $$
DECLARE
    -- Scenario: Attacker with level 0 gold steal (50%) attacking defender with 1000 gold
    test_gold_steal_level int := 0;
    test_vault_steal_level int := 0;
    defender_gold bigint := 1000;
    defender_vault bigint := 500;
    
    calculated_gold_steal_percent float;
    calculated_vault_steal_percent float;
    calculated_gold_stolen bigint;
    calculated_vault_stolen bigint;
    calculated_total_stolen bigint;
BEGIN
    -- Calculate gold steal percent: 50% base + 5% per level
    calculated_gold_steal_percent := 0.50 + (test_gold_steal_level * 0.05);
    IF calculated_gold_steal_percent > 1.0 THEN 
        calculated_gold_steal_percent := 1.0; 
    END IF;
    
    -- Calculate vault steal percent: 0% base + 5% per level
    calculated_vault_steal_percent := test_vault_steal_level * 0.05;
    IF calculated_vault_steal_percent > 1.0 THEN 
        calculated_vault_steal_percent := 1.0; 
    END IF;
    
    -- Calculate stolen amounts
    calculated_gold_stolen := FLOOR(defender_gold * calculated_gold_steal_percent);
    calculated_vault_stolen := FLOOR(defender_vault * calculated_vault_steal_percent);
    calculated_total_stolen := calculated_gold_stolen + calculated_vault_stolen;
    
    -- Display results
    RAISE NOTICE '=== STEAL CALCULATION TEST ===';
    RAISE NOTICE 'Attacker Gold Steal Level: %', test_gold_steal_level;
    RAISE NOTICE 'Attacker Vault Steal Level: %', test_vault_steal_level;
    RAISE NOTICE 'Gold Steal %: %', (calculated_gold_steal_percent * 100);
    RAISE NOTICE 'Vault Steal %: %', (calculated_vault_steal_percent * 100);
    RAISE NOTICE '---';
    RAISE NOTICE 'Defender Gold: %', defender_gold;
    RAISE NOTICE 'Defender Vault: %', defender_vault;
    RAISE NOTICE '---';
    RAISE NOTICE 'Gold Stolen: %', calculated_gold_stolen;
    RAISE NOTICE 'Vault Stolen: %', calculated_vault_stolen;
    RAISE NOTICE 'Total Stolen: %', calculated_total_stolen;
    RAISE NOTICE '===========================';
END $$;

-- 5. VERIFY: Test all levels of gold steal
DO $$
DECLARE
    level int;
    steal_percent float;
    defender_gold bigint := 1000000; -- 1M gold
BEGIN
    RAISE NOTICE '=== GOLD STEAL % BY LEVEL ===';
    FOR level IN 0..10 LOOP
        steal_percent := 0.50 + (level * 0.05);
        IF steal_percent > 1.0 THEN steal_percent := 1.0; END IF;
        
        RAISE NOTICE 'Level %: %% (Steals % from %)',
            level, 
            (steal_percent * 100),
            FLOOR(defender_gold * steal_percent),
            defender_gold;
    END LOOP;
    RAISE NOTICE '===========================';
END $$;

-- 6. VERIFY: Test all levels of vault steal
DO $$
DECLARE
    level int;
    steal_percent float;
    defender_vault bigint := 500000; -- 500k vault
BEGIN
    RAISE NOTICE '=== VAULT STEAL % BY LEVEL ===';
    FOR level IN 0..5 LOOP
        steal_percent := level * 0.05;
        IF steal_percent > 1.0 THEN steal_percent := 1.0; END IF;
        
        RAISE NOTICE 'Level %: %% (Steals % from %)',
            level, 
            (steal_percent * 100),
            FLOOR(defender_vault * steal_percent),
            defender_vault;
    END LOOP;
    RAISE NOTICE '===========================';
END $$;

-- 7. CHECK: Verify upgrade functions exist
SELECT 
    p.proname as function_name,
    p.pronargs as num_args,
    pg_catalog.pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname IN ('upgrade_research_gold_steal', 'upgrade_research_vault_steal')
ORDER BY p.proname;

-- 8. SUMMARY: Display the expected behavior
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════════════╗';
    RAISE NOTICE '║     STEAL % MECHANIC SPECIFICATION             ║';
    RAISE NOTICE '╠════════════════════════════════════════════════╣';
    RAISE NOTICE '║ GOLD STEAL (Main Treasury)                     ║';
    RAISE NOTICE '║ - Base: 50%% (Level 0)                          ║';
    RAISE NOTICE '║ - Increase: +5%% per level                      ║';
    RAISE NOTICE '║ - Max: 100%% (Level 10)                         ║';
    RAISE NOTICE '║ - Cost: 5,000 XP × Level                       ║';
    RAISE NOTICE '║                                                ║';
    RAISE NOTICE '║ VAULT STEAL (Protected Treasury)              ║';
    RAISE NOTICE '║ - Base: 0%% (Level 0)                           ║';
    RAISE NOTICE '║ - Increase: +5%% per level                      ║';
    RAISE NOTICE '║ - Max: 25%% (Level 5)                           ║';
    RAISE NOTICE '║ - Cost: Variable (5k, 10k, 15k, 20k, 25k)     ║';
    RAISE NOTICE '╚════════════════════════════════════════════════╝';
    RAISE NOTICE '';
END $$;
