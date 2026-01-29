DO $$
BEGIN
    BEGIN
        ALTER TABLE public.user_stats ADD COLUMN attack_weapons INTEGER DEFAULT 0;
    EXCEPTION WHEN duplicate_column THEN NULL; END;

    BEGIN
        ALTER TABLE public.user_stats ADD COLUMN defense_weapons INTEGER DEFAULT 0;
    EXCEPTION WHEN duplicate_column THEN NULL; END;

    BEGIN
        ALTER TABLE public.user_stats ADD COLUMN spy_weapons INTEGER DEFAULT 0;
    EXCEPTION WHEN duplicate_column THEN NULL; END;

    BEGIN
        ALTER TABLE public.user_stats ADD COLUMN sentry_weapons INTEGER DEFAULT 0;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
END $$;

CREATE OR REPLACE FUNCTION recalculate_user_stats(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_attack_soldiers INTEGER;
    v_defense_soldiers INTEGER;
    v_spies INTEGER;
    v_sentries INTEGER;
    v_attack_strength BIGINT;
    v_defense_strength BIGINT;
    v_spy_strength BIGINT;
    v_sentry_strength BIGINT;
    
    v_attack_weapons INTEGER;
    v_defense_weapons INTEGER;
    v_spy_weapons INTEGER;
    v_sentry_weapons INTEGER;
BEGIN
    SELECT attack_soldiers, defense_soldiers, spies, sentries
    INTO v_attack_soldiers, v_defense_soldiers, v_spies, v_sentries
    FROM user_stats
    WHERE id = p_user_id;

    v_attack_strength := calculate_weapon_strength(p_user_id, 'attack', COALESCE(v_attack_soldiers, 0));
    v_defense_strength := calculate_weapon_strength(p_user_id, 'defense', COALESCE(v_defense_soldiers, 0));
    v_spy_strength := calculate_weapon_strength(p_user_id, 'spy', COALESCE(v_spies, 0));
    v_sentry_strength := calculate_weapon_strength(p_user_id, 'sentry', COALESCE(v_sentries, 0));

    SELECT COALESCE(SUM(quantity), 0) INTO v_attack_weapons 
    FROM user_weapons WHERE user_id = p_user_id AND weapon_type = 'attack';
    
    SELECT COALESCE(SUM(quantity), 0) INTO v_defense_weapons 
    FROM user_weapons WHERE user_id = p_user_id AND weapon_type = 'defense';
    
    SELECT COALESCE(SUM(quantity), 0) INTO v_spy_weapons 
    FROM user_weapons WHERE user_id = p_user_id AND weapon_type = 'spy';
    
    SELECT COALESCE(SUM(quantity), 0) INTO v_sentry_weapons 
    FROM user_weapons WHERE user_id = p_user_id AND weapon_type = 'sentry';

    UPDATE user_stats
    SET 
        attack = v_attack_strength,
        defense = v_defense_strength,
        spy = v_spy_strength,
        sentry = v_sentry_strength,
        attack_weapons = v_attack_weapons,
        defense_weapons = v_defense_weapons,
        spy_weapons = v_spy_weapons,
        sentry_weapons = v_sentry_weapons,
        updated_at = now()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM user_stats LOOP
        PERFORM recalculate_user_stats(r.id);
    END LOOP;
END $$;
