-- Simple fix: Just reload the schema cache
-- Run this AFTER running rebuild_tech_system.sql

NOTIFY pgrst, 'reload schema';
