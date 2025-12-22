-- Fix Technology Research System
-- Run this in Supabase SQL Editor to ensure all functions exist and have permissions

-- 1. Ensure columns exist
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS research_attack int DEFAULT 0,
ADD COLUMN IF NOT EXISTS research_defense int DEFAULT 0,
ADD COLUMN IF NOT EXISTS research_spy int DEFAULT 0,
ADD COLUMN IF NOT EXISTS research_sentry int DEFAULT 0;

-- 2. Helper: Get Tech Multiplier
CREATE OR REPLACE FUNCTION public.get_tech_multiplier(p_level int)
RETURNS float
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_level <= 0 THEN RETURN 1.0; END IF;
    CASE p_level
        WHEN 0 THEN RETURN 1.0;
        WHEN 1 THEN RETURN 1.10;
        WHEN 2 THEN RETURN 1.10;
        WHEN 3 THEN RETURN 1.20;
        WHEN 4 THEN RETURN 1.30;
        WHEN 5 THEN RETURN 1.30;
        WHEN 6 THEN RETURN 1.40;
        WHEN 7 THEN RETURN 1.50;
        WHEN 8 THEN RETURN 1.50;
        WHEN 9 THEN RETURN 1.60;
        WHEN 10 THEN RETURN 1.70;
        WHEN 11 THEN RETURN 1.80;
        WHEN 12 THEN RETURN 1.80;
        WHEN 13 THEN RETURN 1.90;
        WHEN 14 THEN RETURN 2.00;
        WHEN 15 THEN RETURN 2.10;
        WHEN 16 THEN RETURN 2.20;
        WHEN 17 THEN RETURN 2.30;
        WHEN 18 THEN RETURN 2.50;
        WHEN 19 THEN RETURN 2.60;
        WHEN 20 THEN RETURN 2.70;
        WHEN 21 THEN RETURN 2.80;
        WHEN 22 THEN RETURN 3.00;
        WHEN 23 THEN RETURN 3.10;
        WHEN 24 THEN RETURN 3.30;
        WHEN 25 THEN RETURN 3.40;
        WHEN 26 THEN RETURN 3.60;
        WHEN 27 THEN RETURN 3.80;
        WHEN 28 THEN RETURN 4.00;
        WHEN 29 THEN RETURN 4.20;
        WHEN 30 THEN RETURN 4.40;
        WHEN 31 THEN RETURN 4.60;
        WHEN 32 THEN RETURN 4.80;
        WHEN 33 THEN RETURN 5.00;
        WHEN 34 THEN RETURN 5.30;
        WHEN 35 THEN RETURN 5.60;
        WHEN 36 THEN RETURN 5.80;
        WHEN 37 THEN RETURN 6.10;
        WHEN 38 THEN RETURN 6.40;
        WHEN 39 THEN RETURN 6.70;
        WHEN 40 THEN RETURN 7.10;
        WHEN 41 THEN RETURN 7.40;
        WHEN 42 THEN RETURN 7.80;
        WHEN 43 THEN RETURN 8.20;
        WHEN 44 THEN RETURN 8.60;
        WHEN 45 THEN RETURN 9.00;
        WHEN 46 THEN RETURN 9.50;
        WHEN 47 THEN RETURN 10.00;
        WHEN 48 THEN RETURN 10.40;
        WHEN 49 THEN RETURN 11.00;
        WHEN 50 THEN RETURN 11.50;
        WHEN 51 THEN RETURN 12.10;
        WHEN 52 THEN RETURN 12.70;
        WHEN 53 THEN RETURN 13.30;
        WHEN 54 THEN RETURN 14.00;
        WHEN 55 THEN RETURN 14.70;
        WHEN 56 THEN RETURN 15.40;
        WHEN 57 THEN RETURN 16.20;
        WHEN 58 THEN RETURN 17.00;
        WHEN 59 THEN RETURN 17.80;
        WHEN 60 THEN RETURN 18.70;
        WHEN 61 THEN RETURN 19.70;
        WHEN 62 THEN RETURN 20.60;
        WHEN 63 THEN RETURN 21.70;
        ELSE RETURN 21.70;
    END CASE;
END;
$$;

-- 3. Helper: Get Tech Cost
CREATE OR REPLACE FUNCTION public.get_tech_video_cost(p_current_level int)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    CASE p_current_level
        WHEN 0 THEN RETURN 300;
        WHEN 1 THEN RETURN 340;
        WHEN 2 THEN RETURN 385;
        WHEN 3 THEN RETURN 435;
        WHEN 4 THEN RETURN 490;
        WHEN 5 THEN RETURN 550;
        WHEN 6 THEN RETURN 620;
        WHEN 7 THEN RETURN 700;
        WHEN 8 THEN RETURN 790;
        WHEN 9 THEN RETURN 890;
        WHEN 10 THEN RETURN 1000;
        WHEN 11 THEN RETURN 1130;
        WHEN 12 THEN RETURN 1275;
        WHEN 13 THEN RETURN 1440;
        WHEN 14 THEN RETURN 1625;
        WHEN 15 THEN RETURN 1830;
        WHEN 16 THEN RETURN 2065;
        WHEN 17 THEN RETURN 2330;
        WHEN 18 THEN RETURN 2625;
        WHEN 19 THEN RETURN 2960;
        WHEN 20 THEN RETURN 3340;
        WHEN 21 THEN RETURN 3765;
        WHEN 22 THEN RETURN 4245;
        WHEN 23 THEN RETURN 4785;
        WHEN 24 THEN RETURN 5395;
        WHEN 25 THEN RETURN 6080;
        WHEN 26 THEN RETURN 6855;
        WHEN 27 THEN RETURN 7725;
        WHEN 28 THEN RETURN 8710;
        WHEN 29 THEN RETURN 9820;
        WHEN 30 THEN RETURN 11070;
        WHEN 31 THEN RETURN 12480;
        WHEN 32 THEN RETURN 14070;
        WHEN 33 THEN RETURN 15860;
        WHEN 34 THEN RETURN 17880;
        WHEN 35 THEN RETURN 20155;
        WHEN 36 THEN RETURN 22720;
        WHEN 37 THEN RETURN 25610;
        WHEN 38 THEN RETURN 28870;
        WHEN 39 THEN RETURN 32545;
        WHEN 40 THEN RETURN 36685;
        WHEN 41 THEN RETURN 41350;
        WHEN 42 THEN RETURN 46610;
        WHEN 43 THEN RETURN 52540;
        WHEN 44 THEN RETURN 59225;
        WHEN 45 THEN RETURN 66760;
        WHEN 46 THEN RETURN 75255;
        WHEN 47 THEN RETURN 84830;
        WHEN 48 THEN RETURN 95625;
        WHEN 49 THEN RETURN 107790;
        WHEN 50 THEN RETURN 121505;
        WHEN 51 THEN RETURN 136965;
        WHEN 52 THEN RETURN 154390;
        WHEN 53 THEN RETURN 174035;
        WHEN 54 THEN RETURN 196175;
        WHEN 55 THEN RETURN 221135;
        WHEN 56 THEN RETURN 249275;
        WHEN 57 THEN RETURN 281000;
        WHEN 58 THEN RETURN 316750;
        WHEN 59 THEN RETURN 357055;
        WHEN 60 THEN RETURN 402490;
        WHEN 61 THEN RETURN 453700;
        WHEN 62 THEN RETURN 800000;
        ELSE RETURN 999999999;
    END CASE;
END;
$$;

-- 4. UPDATE recaluclate_user_stats Function
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
        sentry = FLOOR(v_sentry_raw * v_mult_sentry)
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. UPGRADE FUNCTIONS & PERMISSIONS

-- Upgrade Attack
CREATE OR REPLACE FUNCTION public.upgrade_research_attack()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_xp bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    SELECT experience, COALESCE(research_attack, 0) INTO v_current_xp, v_current_level FROM user_stats WHERE id = v_user_id;
    IF v_current_level >= 63 THEN RAISE EXCEPTION 'Max research level learned'; END IF;
    
    v_cost := get_tech_video_cost(v_current_level);
    if v_current_xp < v_cost THEN RAISE EXCEPTION 'Not enough experience'; END IF;

    UPDATE user_stats SET experience = experience - v_cost, research_attack = v_current_level + 1 WHERE id = v_user_id;
    PERFORM recalculate_user_stats(v_user_id);
    
    SELECT row_to_json(us) INTO v_new_stats FROM user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;
GRANT EXECUTE ON FUNCTION public.upgrade_research_attack() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upgrade_research_attack() TO service_role;

-- Upgrade Defense
CREATE OR REPLACE FUNCTION public.upgrade_research_defense()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_xp bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    SELECT experience, COALESCE(research_defense, 0) INTO v_current_xp, v_current_level FROM user_stats WHERE id = v_user_id;
    IF v_current_level >= 63 THEN RAISE EXCEPTION 'Max research level learned'; END IF;
    
    v_cost := get_tech_video_cost(v_current_level);
    if v_current_xp < v_cost THEN RAISE EXCEPTION 'Not enough experience'; END IF;

    UPDATE user_stats SET experience = experience - v_cost, research_defense = v_current_level + 1 WHERE id = v_user_id;
    PERFORM recalculate_user_stats(v_user_id);
    
    SELECT row_to_json(us) INTO v_new_stats FROM user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;
GRANT EXECUTE ON FUNCTION public.upgrade_research_defense() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upgrade_research_defense() TO service_role;

-- Upgrade Spy
CREATE OR REPLACE FUNCTION public.upgrade_research_spy()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_xp bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    SELECT experience, COALESCE(research_spy, 0) INTO v_current_xp, v_current_level FROM user_stats WHERE id = v_user_id;
    IF v_current_level >= 63 THEN RAISE EXCEPTION 'Max research level learned'; END IF;
    
    v_cost := get_tech_video_cost(v_current_level);
    if v_current_xp < v_cost THEN RAISE EXCEPTION 'Not enough experience'; END IF;

    UPDATE user_stats SET experience = experience - v_cost, research_spy = v_current_level + 1 WHERE id = v_user_id;
    PERFORM recalculate_user_stats(v_user_id);
    
    SELECT row_to_json(us) INTO v_new_stats FROM user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;
GRANT EXECUTE ON FUNCTION public.upgrade_research_spy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upgrade_research_spy() TO service_role;

-- Upgrade Sentry
CREATE OR REPLACE FUNCTION public.upgrade_research_sentry()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_current_xp bigint;
    v_current_level int;
    v_cost bigint;
    v_new_stats json;
BEGIN
    SELECT experience, COALESCE(research_sentry, 0) INTO v_current_xp, v_current_level FROM user_stats WHERE id = v_user_id;
    IF v_current_level >= 63 THEN RAISE EXCEPTION 'Max research level learned'; END IF;
    
    v_cost := get_tech_video_cost(v_current_level);
    if v_current_xp < v_cost THEN RAISE EXCEPTION 'Not enough experience'; END IF;

    UPDATE user_stats SET experience = experience - v_cost, research_sentry = v_current_level + 1 WHERE id = v_user_id;
    PERFORM recalculate_user_stats(v_user_id);
    
    SELECT row_to_json(us) INTO v_new_stats FROM user_stats us WHERE id = v_user_id;
    RETURN v_new_stats;
END;
$$;
GRANT EXECUTE ON FUNCTION public.upgrade_research_sentry() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upgrade_research_sentry() TO service_role;

-- 6. Recalculate everyone now to ensure columns are good
DO $$
DECLARE
    v_user RECORD;
BEGIN
    FOR v_user IN SELECT id FROM user_stats LOOP
        PERFORM recalculate_user_stats(v_user.id);
    END LOOP;
END $$;

-- 7. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload config';
