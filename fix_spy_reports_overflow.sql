-- Fix Spy Reports Integer Overflow
-- The user stats were upgraded to BIGINT, but the spy_reports table was still using INTEGER.
-- This caused crashes when spying on players with high stats (e.g. > 2 billion).

ALTER TABLE public.spy_reports
    ALTER COLUMN attack TYPE BIGINT,
    ALTER COLUMN defense TYPE BIGINT,
    ALTER COLUMN spy TYPE BIGINT,
    ALTER COLUMN sentry TYPE BIGINT,
    ALTER COLUMN attack_soldiers TYPE BIGINT,
    ALTER COLUMN defense_soldiers TYPE BIGINT,
    ALTER COLUMN spies TYPE BIGINT,
    ALTER COLUMN sentries TYPE BIGINT,
    ALTER COLUMN citizens TYPE BIGINT,
    ALTER COLUMN miners TYPE BIGINT,
    ALTER COLUMN hostages TYPE BIGINT;
