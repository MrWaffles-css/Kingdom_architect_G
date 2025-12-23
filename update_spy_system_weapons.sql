DO $$ 
BEGIN 
    -- 1. Add weapons_data JSON column to spy_reports
    BEGIN 
        ALTER TABLE public.spy_reports ADD COLUMN weapons_data jsonb DEFAULT '[]'::jsonb; 
    EXCEPTION WHEN duplicate_column THEN 
        NULL;
    END;
END $$;

-- 2. Update get_latest_spy_report to include weapons_data
DROP FUNCTION IF EXISTS public.get_latest_spy_report(uuid);

CREATE OR REPLACE FUNCTION public.get_latest_spy_report(target_id uuid)
RETURNS TABLE (
    id uuid, created_at timestamptz,
    attacker_id uuid, defender_id uuid,
    gold bigint, vault bigint, citizens int, land int,
    attack int, defense int, spy int, sentry int,
    attack_soldiers int, defense_soldiers int, spies int, sentries int, miners int,
    kingdom_level int, gold_mine_level int, barracks_level int, vault_level int, library_level int,
    research_weapons int, research_attack int, research_defense int, research_spy int, research_sentry int, research_turns_per_min int,
    hostages int, research_hostage_convert int,
    weapons_data jsonb, -- New column
    hours_old float
) 
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        sr.id, sr.created_at,
        sr.attacker_id, sr.defender_id,
        sr.gold, sr.vault, sr.citizens, sr.land,
        sr.attack, sr.defense, sr.spy, sr.sentry,
        sr.attack_soldiers, sr.defense_soldiers, sr.spies, sr.sentries, sr.miners,
        sr.kingdom_level, sr.gold_mine_level, sr.barracks_level, sr.vault_level, sr.library_level,
        sr.research_weapons, sr.research_attack, sr.research_defense, sr.research_spy, sr.research_sentry, sr.research_turns_per_min,
        sr.hostages, sr.research_hostage_convert,
        sr.weapons_data, -- Return weapons data
        EXTRACT(EPOCH FROM (now() - sr.created_at)) / 3600.0 AS hours_old
    FROM public.spy_reports sr
    WHERE sr.attacker_id = auth.uid() AND sr.defender_id = target_id
    ORDER BY sr.created_at DESC
    LIMIT 1;
END;
$$;

-- 3. Update spy_player to capture user_weapons
DROP FUNCTION IF EXISTS public.spy_player(uuid);

CREATE OR REPLACE FUNCTION public.spy_player(target_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_attacker_id uuid;
    v_attacker_stats record;
    v_defender_stats record;
    v_weapons_json jsonb;
BEGIN
    v_attacker_id := auth.uid();

    IF v_attacker_id = target_id THEN
        RAISE EXCEPTION 'Cannot spy on yourself';
    END IF;

    -- Get Attacker Stats
    SELECT * INTO v_attacker_stats FROM public.user_stats WHERE id = v_attacker_id;

    -- Get Defender Stats
    SELECT * INTO v_defender_stats FROM public.user_stats WHERE id = target_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Target not found'; END IF;

    -- Get Defender's Weapons (only qty > 0)
    SELECT json_agg(json_build_object(
        'type', weapon_type,
        'tier', tier,
        'quantity', quantity
    )) INTO v_weapons_json
    FROM public.user_weapons 
    WHERE user_id = target_id AND quantity > 0;

    -- Spy Logic
    -- Simple check: if Spy > Sentry (with variance), Success.
    IF (v_attacker_stats.spy * (0.8 + random() * 0.4)) > (v_defender_stats.sentry * (0.8 + random() * 0.4)) THEN
        -- SUCCESS: Insert Report
        INSERT INTO public.spy_reports (
            attacker_id, defender_id, 
            gold, vault, citizens, land,
            attack, defense, spy, sentry,
            attack_soldiers, defense_soldiers, spies, sentries, miners,
            kingdom_level, gold_mine_level, barracks_level, vault_level, library_level,
            research_weapons, research_attack, research_defense, research_spy, research_sentry, research_turns_per_min,
            hostages, research_hostage_convert,
            weapons_data
        ) VALUES (
            v_attacker_id, target_id,
            v_defender_stats.gold, v_defender_stats.vault, v_defender_stats.citizens, v_defender_stats.land,
            v_defender_stats.attack, v_defender_stats.defense, v_defender_stats.spy, v_defender_stats.sentry,
            v_defender_stats.attack_soldiers, v_defender_stats.defense_soldiers, v_defender_stats.spies, v_defender_stats.sentries, v_defender_stats.miners,
            v_defender_stats.kingdom_level, v_defender_stats.gold_mine_level, v_defender_stats.barracks_level, v_defender_stats.vault_level, v_defender_stats.library_level,
            v_defender_stats.research_weapons, v_defender_stats.research_attack, v_defender_stats.research_defense, v_defender_stats.research_spy, v_defender_stats.research_sentry, v_defender_stats.research_turns_per_min,
            v_defender_stats.hostages, v_defender_stats.research_hostage_convert,
            COALESCE(v_weapons_json, '[]'::jsonb)
        );

        RETURN json_build_object(
            'success', true, 
            'message', 'Spy report generated successfully.',
            'data', json_build_object(
                'gold', v_defender_stats.gold,
                'vault', v_defender_stats.vault,
                'citizens', v_defender_stats.citizens,
                'land', v_defender_stats.land,
                'attack', v_defender_stats.attack,
                'defense', v_defender_stats.defense,
                'spy', v_defender_stats.spy,
                'sentry', v_defender_stats.sentry,
                'attack_soldiers', v_defender_stats.attack_soldiers,
                'defense_soldiers', v_defender_stats.defense_soldiers,
                'spies', v_defender_stats.spies,
                'sentries', v_defender_stats.sentries,
                'miners', v_defender_stats.miners,
                'hostages', v_defender_stats.hostages,
                'kingdom_level', v_defender_stats.kingdom_level,
                'gold_mine_level', v_defender_stats.gold_mine_level,
                'barracks_level', v_defender_stats.barracks_level,
                'vault_level', v_defender_stats.vault_level,
                'library_level', v_defender_stats.library_level,
                'research_weapons', v_defender_stats.research_weapons,
                'research_attack', v_defender_stats.research_attack,
                'research_defense', v_defender_stats.research_defense,
                'research_spy', v_defender_stats.research_spy,
                'research_sentry', v_defender_stats.research_sentry,
                'research_turns_per_min', v_defender_stats.research_turns_per_min,
                'research_hostage_convert', v_defender_stats.research_hostage_convert,
                'weapons_data', COALESCE(v_weapons_json, '[]'::jsonb)
            )
        );
    ELSE
        -- FAILURE
        RETURN json_build_object('success', false, 'message', 'Spy mission failed! Their sentries detected your agents.');
    END IF;
END;
$$;
