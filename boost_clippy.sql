-- Boost Clippy Stats to ensure #1 Rank
UPDATE public.user_stats 
SET 
    attack = 1000000,
    defense = 1000000,
    spy = 1000000,
    sentry = 1000000,
    gold = 100000000,
    updated_at = now()
WHERE id = (SELECT id FROM profiles WHERE username ILIKE 'Clippy');
