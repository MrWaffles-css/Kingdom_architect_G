-- =====================================================
-- FIX: Add weapon strength calculation to spy reports
-- =====================================================
-- Run this after add_weapon_system.sql

-- Helper function to calculate total strength for a unit type
CREATE OR REPLACE FUNCTION calculate_weapon_strength(
    p_user_id UUID,
    p_weapon_type TEXT,
    p_soldier_count INTEGER
)
RETURNS BIGINT AS $$
DECLARE
    v_total_strength BIGINT := 0;
    v_remaining_soldiers INTEGER := p_soldier_count;
    v_weapon RECORD;
    v_weapon_strength INTEGER;
    v_count INTEGER;
BEGIN
    -- If no soldiers, return 0
    IF p_soldier_count <= 0 THEN
        RETURN 0;
    END IF;

    -- Get weapons for this type, ordered by tier (best first)
    FOR v_weapon IN 
        SELECT tier, quantity 
        FROM user_weapons 
        WHERE user_id = p_user_id 
        AND weapon_type = p_weapon_type 
        ORDER BY tier DESC
    LOOP
        EXIT WHEN v_remaining_soldiers <= 0;
        
        -- Get weapon strength based on tier
        v_weapon_strength := CASE v_weapon.tier
            WHEN 0 THEN 1
            WHEN 1 THEN 12
            WHEN 2 THEN 150
            WHEN 3 THEN 2000
            WHEN 4 THEN 25000
            WHEN 5 THEN 300000
            ELSE 1
        END;
        
        -- Calculate how many soldiers get this weapon
        v_count := LEAST(v_remaining_soldiers, v_weapon.quantity);
        
        -- Add strength: Unit Base (100) + Weapon Strength
        v_total_strength := v_total_strength + (v_count * (100 + v_weapon_strength));
        v_remaining_soldiers := v_remaining_soldiers - v_count;
    END LOOP;
    
    -- Remaining soldiers without weapons still have base strength of 100
    IF v_remaining_soldiers > 0 THEN
        v_total_strength := v_total_strength + (v_remaining_soldiers * 100);
    END IF;
    
    RETURN v_total_strength;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Update spy_player function to calculate weapon strength
DROP FUNCTION IF EXISTS spy_player(UUID);
CREATE OR REPLACE FUNCTION spy_player(target_id UUID)
RETURNS JSONB AS $$
DECLARE
    my_spy BIGINT;
    their_sentry BIGINT;
    target_stats RECORD;
    result JSONB;
    -- Calculated strengths
    calc_attack BIGINT;
    calc_defense BIGINT;
    calc_spy BIGINT;
    calc_sentry BIGINT;
BEGIN
    -- Get my spy rating
    SELECT spy INTO my_spy FROM user_stats WHERE id = auth.uid();
    
    -- Get target's stats
    SELECT * INTO target_stats FROM user_stats WHERE id = target_id;
    their_sentry := target_stats.sentry;
    
    -- Check if spy mission succeeds
    IF my_spy > their_sentry THEN
        -- Calculate actual strengths including weapons
        calc_attack := calculate_weapon_strength(target_id, 'attack', target_stats.attack_soldiers);
        calc_defense := calculate_weapon_strength(target_id, 'defense', target_stats.defense_soldiers);
        calc_spy := calculate_weapon_strength(target_id, 'spy', target_stats.spies);
        calc_sentry := calculate_weapon_strength(target_id, 'sentry', target_stats.sentries);
        
        -- Success - return full intel with calculated strengths
        result := jsonb_build_object(
            'success', true,
            'data', jsonb_build_object(
                'gold', target_stats.gold,
                'citizens', target_stats.citizens,
                'attack', calc_attack,
                'defense', calc_defense,
                'spy', calc_spy,
                'sentry', calc_sentry,
                'attack_soldiers', target_stats.attack_soldiers,
                'defense_soldiers', target_stats.defense_soldiers,
                'spies', target_stats.spies,
                'sentries', target_stats.sentries
            )
        );
        
        -- Save spy report to database with calculated strengths
        INSERT INTO spy_reports (
            spy_user_id, target_user_id,
            gold, citizens, attack, defense, spy, sentry,
            attack_soldiers, defense_soldiers, spies, sentries,
            spied_at
        ) VALUES (
            auth.uid(), target_id,
            target_stats.gold, target_stats.citizens,
            calc_attack, calc_defense,
            calc_spy, calc_sentry,
            target_stats.attack_soldiers, target_stats.defense_soldiers,
            target_stats.spies, target_stats.sentries,
            NOW()
        )
        ON CONFLICT (spy_user_id, target_user_id)
        DO UPDATE SET
            gold = EXCLUDED.gold,
            citizens = EXCLUDED.citizens,
            attack = EXCLUDED.attack,
            defense = EXCLUDED.defense,
            spy = EXCLUDED.spy,
            sentry = EXCLUDED.sentry,
            attack_soldiers = EXCLUDED.attack_soldiers,
            defense_soldiers = EXCLUDED.defense_soldiers,
            spies = EXCLUDED.spies,
            sentries = EXCLUDED.sentries,
            spied_at = NOW();
        
        RETURN result;
    ELSE
        -- Failed - detected
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Your spies were detected! Their sentry rating is too high.'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
