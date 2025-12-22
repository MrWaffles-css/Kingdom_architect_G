-- Check Current Multiplier Values
-- Run this to see what multipliers are currently being used

SELECT 
    4 as level,
    get_tech_multiplier(4) as level_4_multiplier,
    get_tech_multiplier(5) as level_5_multiplier,
    CASE 
        WHEN get_tech_multiplier(4) = get_tech_multiplier(5) THEN 'SAME (Problem!)'
        ELSE 'DIFFERENT (Good!)'
    END as status;

-- Also check levels 1-10 to see the progression
SELECT 
    level,
    get_tech_multiplier(level) as multiplier,
    (get_tech_multiplier(level) - 1.0) * 100 as bonus_percent
FROM generate_series(0, 10) as level
ORDER BY level;
