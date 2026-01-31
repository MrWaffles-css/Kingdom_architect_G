-- Update boss rewards for Rat King and Goblin Chief
-- Rat King: 10 gold -> 100 gold
-- Goblin Chief: 100 gold -> 500 gold

UPDATE bosses 
SET reward_gold = 100 
WHERE id = 1 AND name = 'Rat King';

UPDATE bosses 
SET reward_gold = 500 
WHERE id = 2 AND name = 'Goblin Chief';

-- Verify the changes
SELECT id, name, reward_gold 
FROM bosses 
WHERE id IN (1, 2)
ORDER BY id;
