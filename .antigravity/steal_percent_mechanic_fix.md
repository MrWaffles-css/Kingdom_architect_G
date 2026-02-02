# Steal % Mechanic - Issue Analysis & Fix

**Date**: 2026-02-01  
**Status**: 🔴 **CRITICAL BUG FOUND & FIXED**

---

## 🐛 Problem Identified

The steal % research mechanic has **two critical missing database functions**:

1. `upgrade_research_gold_steal()` - Allows upgrading gold steal from 50% to 100%
2. `upgrade_research_vault_steal()` - Allows stealing from opponent's protected vault

### Impact
- Players could see the research options in the Library UI
- Clicking "Research" button would **fail** with a database error
- No way to upgrade steal percentage beyond the base 50%
- Vault stealing was completely non-functional

---

## 🔍 Root Cause

The functions were **referenced but never created**:
- ✅ Frontend code in `Library.jsx` correctly calls these functions
- ✅ Database columns `research_gold_steal` and `research_vault_steal` exist
- ❌ **Database functions were never implemented**
- ✅ Attack logic in `attack_player()` correctly uses these values

---

## 📊 How the Mechanic SHOULD Work

### Gold Steal % (Main Treasury)
- **Base**: 50% (Level 0) - Steal half of opponent's gold
- **Progression**: +5% per level
- **Max**: 100% (Level 10) - Steal all opponent's gold
- **Cost**: 5,000 XP × (next level)
  - Level 0→1: 5,000 XP
  - Level 1→2: 10,000 XP
  - Level 2→3: 15,000 XP
  - ...
  - Level 9→10: 50,000 XP
- **Total Cost to Max**: 275,000 XP

### Vault Steal % (Protected Treasury)
- **Base**: 0% (Level 0) - Cannot steal from vault
- **Progression**: +5% per level
- **Max**: 25% (Level 5) - Steal quarter of opponent's vault
- **Cost Structure**:
  - Level 0→1: 5,000 XP
  - Level 1→2: 10,000 XP
  - Level 2→3: 15,000 XP
  - Level 3→4: 20,000 XP
  - Level 4→5: 25,000 XP
- **Total Cost to Max**: 75,000 XP

---

## ✅ Fix Applied

### Created `fix_steal_percent_research.sql`
This migration file creates both missing functions:

```sql
-- 1. upgrade_research_gold_steal()
--    - Validates level (max 10)
--    - Calculates cost: 5000 * (level + 1)
--    - Deducts XP and increments research_gold_steal
--    - Returns updated stats

-- 2. upgrade_research_vault_steal()
--    - Validates level (max 5)
--    - Uses CASE statement for tiered costs
--    - Deducts XP and increments research_vault_steal
--    - Returns updated stats
```

---

## 🧪 Verification

### Attack Logic Review
Checked `add_vault_steal_logic.sql` (lines 72-84):

```sql
-- Main Gold Steal (Base 50% + 5% per level)
v_raw_steal_percent := COALESCE(v_attacker_stats.research_gold_steal, 0);
v_main_steal_percent := 0.50 + (v_raw_steal_percent * 0.05);
IF v_main_steal_percent > 1.0 THEN v_main_steal_percent := 1.0; END IF;

v_stolen_from_main := FLOOR(v_defender_stats.gold * v_main_steal_percent);

-- Vault Gold Steal (5% per level, Base 0%)
v_raw_vault_steal_level := COALESCE(v_attacker_stats.research_vault_steal, 0);
v_vault_steal_percent := v_raw_vault_steal_level * 0.05;
IF v_vault_steal_percent > 1.0 THEN v_vault_steal_percent := 1.0; END IF;

v_stolen_from_vault := FLOOR(v_defender_stats.vault * v_vault_steal_percent);
```

✅ **Attack logic is correct** - properly calculates steal percentages
✅ **Formula matches specification**
✅ **Caps at 100% for safety**

---

## 📋 Testing Steps

### Before Applying Fix
1. ❌ Try to research "Increase Stolen %" in Library → Database error
2. ❌ Try to research "Steal from Vault %" in Library → Database error

### After Applying Fix
1. Run `fix_steal_percent_research.sql` in Supabase SQL Editor
2. ✅ Research "Increase Stolen %" → Should upgrade from 50% to 55%
3. ✅ Research "Steal from Vault %" → Should upgrade from 0% to 5%
4. ✅ Attack an opponent → Verify correct steal amount in battle report
5. ✅ Run `verify_steal_percent_mechanic.sql` for comprehensive tests

---

## 🎯 Expected Behavior Examples

### Scenario 1: New Player (Level 0/0)
- Attacking player with 1,000,000 gold and 500,000 vault
- **Gold Stolen**: 500,000 (50%)
- **Vault Stolen**: 0 (0%)
- **Total**: 500,000

### Scenario 2: Mid-Level Research (Level 5/2)
- Attacking player with 1,000,000 gold and 500,000 vault
- **Gold Stolen**: 750,000 (75%)
- **Vault Stolen**: 50,000 (10%)
- **Total**: 800,000

### Scenario 3: Max Research (Level 10/5)
- Attacking player with 1,000,000 gold and 500,000 vault
- **Gold Stolen**: 1,000,000 (100%)
- **Vault Stolen**: 125,000 (25%)
- **Total**: 1,125,000

---

## 📝 Files Modified/Created

1. ✅ **Created**: `fix_steal_percent_research.sql` - Contains both missing functions
2. ✅ **Created**: `verify_steal_percent_mechanic.sql` - Comprehensive testing script
3. ℹ️ **Reviewed**: `add_vault_steal_logic.sql` - Attack logic verified correct
4. ℹ️ **Reviewed**: `Library.jsx` - Frontend verified correct

---

## 🚀 Deployment Instructions

1. **Execute SQL Migration**:
   ```bash
   # In Supabase SQL Editor, run:
   fix_steal_percent_research.sql
   ```

2. **Verify Installation**:
   ```bash
   # Run verification script:
   verify_steal_percent_mechanic.sql
   ```

3. **Test In-Game**:
   - Open Library → ESPIONAGE tab
   - Verify "Increase Stolen %" shows correct cost (5,000 XP)
   - Click "Research" button
   - Confirm level increases and XP is deducted
   - Verify "Steal from Vault %" works similarly

4. **Combat Test**:
   - Attack an opponent with visible gold
   - Check battle report for correct steal amounts
   - Verify stolen gold matches expected percentage

---

## ✅ Checklist

- [x] Identified missing database functions
- [x] Created `upgrade_research_gold_steal()` function
- [x] Created `upgrade_research_vault_steal()` function
- [x] Verified attack logic uses correct formulas
- [x] Created verification test script
- [ ] Apply migration to database (USER needs to run SQL)
- [ ] Test in-game functionality
- [ ] Update patch notes

---

## 🎮 Player-Facing Changes

After applying this fix, players will be able to:
- ✅ Upgrade gold steal percentage from 50% → 100%
- ✅ Unlock vault stealing (0% → 25%)
- ✅ See accurate costs and progression in Library
- ✅ Steal exact percentages shown in UI during attacks

---

## 🔗 Related Files

- Attack Logic: `add_vault_steal_logic.sql`
- UI Component: `src/components/Library.jsx`
- Battle Reports: `src/components/Reports.jsx`
- Help Documentation: `src/components/Help.jsx`
