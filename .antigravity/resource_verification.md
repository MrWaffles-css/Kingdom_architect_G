# Resource Generation Verification & Fix

## What I Checked

I reviewed the `generate_resources()` function to ensure all resources are being calculated and awarded correctly:

### ✅ **Turns** 
- **Status**: Needs Fix
- **Issue**: Using hardcoded formula `2 + research_level` instead of dynamic `get_turns_per_minute()` function
- **Fix**: Now calls `get_turns_per_minute(research_turns_per_min)` with fallback

### ✅ **Vault Gold (Interest)**
- **Status**: Needs Fix  
- **Issue**: Using hardcoded formula `LEAST(0.50, vault_level * 0.05)` instead of `calculate_vault_interest()`
- **Fix**: Now calls `calculate_vault_interest(vault_level)` which uses dynamic vault_configs table

### ✅ **Experience (XP)**
- **Status**: Needs Fix
- **Issue**: Using simple `library_level * minutes` instead of dynamic library_levels table
- **Fix**: Now queries `library_levels` table for `xp_rate` based on current library level

### ✅ **Main Treasury Gold**
- **Status**: Partially Correct
- **Components**:
  - **Untrained Citizens**: ✅ Correct (1 gold per citizen per minute)
  - **Trained Soldiers**: ✅ Correct (0.5 gold per soldier per minute)
  - **Miners**: Needs Fix - should use dynamic `gold_mine_configs` table for production rate
- **Fix**: Now queries `gold_mine_configs` for production_rate instead of calculating `2 + (level - 1)`

### ✅ **Citizens**
- **Status**: Needs Fix
- **Issue**: Using simple `kingdom_level * 1` instead of dynamic kingdom_configs table
- **Fix**: Now queries `kingdom_configs` for `citizens_per_minute` based on kingdom level

## The Problem

The current `generate_resources()` function had **hardcoded formulas** instead of using the **dynamic configuration functions** that allow admins to customize game mechanics. This meant:

1. Changes made in the Admin Panel weren't reflected in resource generation
2. Different parts of the code used different calculation methods
3. Resources might not match what players expect based on UI descriptions

## The Solution

Created `fix_generate_resources_comprehensive.sql` which:

1. **Uses Dynamic Functions**: Calls `calculate_vault_interest()`, `get_turns_per_minute()`, etc.
2. **Queries Config Tables**: Looks up rates from `library_levels`, `gold_mine_configs`, `kingdom_configs`
3. **Has Fallbacks**: If config tables don't exist, falls back to hardcoded calculations
4. **Maintains Accuracy**: Ensures all resources are calculated correctly every minute
5. **Multiplies by Minutes**: Correctly handles catch-up when player returns after being away

## How to Apply

Run this SQL migration on your Supabase project:

```bash
# Apply the fix
psql -h <your-db-host> -U postgres -d postgres -f fix_generate_resources_comprehensive.sql
```

Or apply it through the Supabase SQL Editor.

## Verification

After applying, you can verify it's working by:

1. **Check Console Logs**: Look for `[TimeContext] Triggering resource generation` messages
2. **Monitor Resources**: Watch your resources increase every minute
3. **Test Catch-up**: Leave the tab for 5 minutes, come back, and verify you get 5 minutes worth of resources
4. **Check Vault Interest**: Ensure vault gold increases based on your vault level's interest rate
5. **Verify Turns**: Ensure turns increase based on your research level

## Resource Calculation Summary

Per minute, you should receive:

- **Gold** = (citizens × 1) + (trained_soldiers × 0.5) + (miners × miner_rate)
- **Vault** = gold_gained × interest_rate (capped at vault capacity)
- **Experience** = library_xp_rate (from library_levels table)
- **Turns** = turns_per_minute (from get_turns_per_minute function)
- **Citizens** = citizens_per_minute (from kingdom_configs table)

All values are multiplied by the number of minutes that have passed since the last generation.
