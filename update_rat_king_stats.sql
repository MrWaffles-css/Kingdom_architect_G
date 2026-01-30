-- Migration to update Rat King stat requirement
UPDATE bosses 
SET req_total_stats = 50 
WHERE name = 'Rat King';
