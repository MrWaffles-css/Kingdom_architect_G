-- Fix: Ensure updated_at is updated when stats are recalculated
-- This helps the frontend distinguish between stale and fresh data

CREATE OR REPLACE FUNCTION public.recalculate_user_stats(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_attack_soldiers INTEGER;
    v_defense_soldiers INTEGER;
    v_spies INTEGER;
    v_sentries INTEGER;
    
    v_attack_raw BIGINT;
    v_defense_raw BIGINT;
    v_spy_raw BIGINT;
    v_sentry_raw BIGINT;

    v_r_attack INT;
    v_r_defense INT;
    v_r_spy INT;
    v_r_sentry INT;
    
    v_mult_attack FLOAT;
    v_mult_defense FLOAT;
    v_mult_spy FLOAT;
    v_mult_sentry FLOAT;
BEGIN
    SELECT 
        attack_soldiers, defense_soldiers, spies, sentries,
        COALESCE(research_attack, 0), COALESCE(research_defense, 0), 
        COALESCE(research_spy, 0), COALESCE(research_sentry, 0)
    INTO 
        v_attack_soldiers, v_defense_soldiers, v_spies, v_sentries,
        v_r_attack, v_r_defense, v_r_spy, v_r_sentry
    FROM user_stats
    WHERE id = p_user_id;

    v_attack_raw := calculate_weapon_strength(p_user_id, 'attack', COALESCE(v_attack_soldiers, 0));
    v_defense_raw := calculate_weapon_strength(p_user_id, 'defense', COALESCE(v_defense_soldiers, 0));
    v_spy_raw := calculate_weapon_strength(p_user_id, 'spy', COALESCE(v_spies, 0));
    v_sentry_raw := calculate_weapon_strength(p_user_id, 'sentry', COALESCE(v_sentries, 0));

    v_mult_attack := get_tech_multiplier(v_r_attack);
    v_mult_defense := get_tech_multiplier(v_r_defense);
    v_mult_spy := get_tech_multiplier(v_r_spy);
    v_mult_sentry := get_tech_multiplier(v_r_sentry);

    UPDATE user_stats
    SET 
        attack = FLOOR(v_attack_raw * v_mult_attack),
        defense = FLOOR(v_defense_raw * v_mult_defense),
        spy = FLOOR(v_spy_raw * v_mult_spy),
        sentry = FLOOR(v_sentry_raw * v_mult_sentry),
        updated_at = now()  -- FORCE TIMESTAMP UPDATE
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
