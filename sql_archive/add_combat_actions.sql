-- Add Combat Actions (Attack & Spy)
-- Run this in Supabase SQL Editor

-- 1. Attack Function
-- Cost: 100 Turns
-- Win Condition: Attacker Attack > Defender Defense
-- Win Effect: Steal 100% of Defender's Gold
CREATE OR REPLACE FUNCTION public.attack_player(
    target_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_attacker_id uuid;
    v_attacker_stats record;
    v_defender_stats record;
    v_gold_stolen bigint;
    v_turn_cost int := 100;
BEGIN
    v_attacker_id := auth.uid();

    -- Self-attack check
    IF v_attacker_id = target_id THEN
        RAISE EXCEPTION 'Cannot attack yourself';
    END IF;

    -- Get Attacker Stats
    SELECT * INTO v_attacker_stats
    FROM public.user_stats
    WHERE id = v_attacker_id;

    -- Check Turns
    IF v_attacker_stats.turns < v_turn_cost THEN
        RAISE EXCEPTION 'Not enough turns (Need 100)';
    END IF;

    -- Get Defender Stats
    SELECT * INTO v_defender_stats
    FROM public.user_stats
    WHERE id = target_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target not found';
    END IF;

    -- Deduct Turns
    UPDATE public.user_stats
    SET turns = turns - v_turn_cost
    WHERE id = v_attacker_id;

    -- Combat Logic
    IF v_attacker_stats.attack > v_defender_stats.defense THEN
        -- WIN
        v_gold_stolen := v_defender_stats.gold;

        -- Transfer Gold
        UPDATE public.user_stats
        SET gold = gold + v_gold_stolen
        WHERE id = v_attacker_id;

        UPDATE public.user_stats
        SET gold = 0
        WHERE id = target_id;

        RETURN json_build_object(
            'success', true,
            'gold_stolen', v_gold_stolen,
            'message', 'Victory! You breached their defenses and seized their treasury.'
        );
    ELSE
        -- LOSS
        RETURN json_build_object(
            'success', false,
            'gold_stolen', 0,
            'message', 'Defeat! Your forces were repelled by their defenses.'
        );
    END IF;
END;
$$;

-- 2. Spy Function
-- Cost: 0 Turns
-- Win Condition: Attacker Spy > Defender Sentry
-- Win Effect: Reveal Enemy Stats
CREATE OR REPLACE FUNCTION public.spy_player(
    target_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_attacker_id uuid;
    v_attacker_stats record;
    v_defender_stats record;
BEGIN
    v_attacker_id := auth.uid();

    -- Self-spy check
    IF v_attacker_id = target_id THEN
        RAISE EXCEPTION 'Cannot spy on yourself';
    END IF;

    -- Get Attacker Stats
    SELECT * INTO v_attacker_stats
    FROM public.user_stats
    WHERE id = v_attacker_id;

    -- Get Defender Stats
    SELECT * INTO v_defender_stats
    FROM public.user_stats
    WHERE id = target_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target not found';
    END IF;

    -- Spy Logic
    IF v_attacker_stats.spy > v_defender_stats.sentry THEN
        -- WIN: Return stats
        RETURN json_build_object(
            'success', true,
            'data', json_build_object(
                'gold', v_defender_stats.gold,
                'citizens', v_defender_stats.citizens,
                'attack', v_defender_stats.attack,
                'defense', v_defender_stats.defense,
                'spy', v_defender_stats.spy,
                'sentry', v_defender_stats.sentry,
                'attack_soldiers', v_defender_stats.attack_soldiers,
                'defense_soldiers', v_defender_stats.defense_soldiers,
                'spies', v_defender_stats.spies,
                'sentries', v_defender_stats.sentries
            ),
            'message', 'Spy report generated successfully.'
        );
    ELSE
        -- LOSS
        RETURN json_build_object(
            'success', false,
            'message', 'Spy mission failed! Their sentries detected your agents.'
        );
    END IF;
END;
$$;
