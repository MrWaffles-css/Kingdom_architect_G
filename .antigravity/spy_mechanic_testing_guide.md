# Spy Mechanic Testing Guide

## Quick Verification Steps

### 1. Test Spy Success/Failure
**Goal**: Verify the deterministic success condition works correctly

**Steps**:
1. Open Battlefield
2. Find a player with **lower** Sentry than your Spy
3. Click "Spy" button
4. **Expected**: Should **always succeed**
5. Try spying on a player with **higher** Sentry than your Spy
6. **Expected**: Should **always fail**
7. Try spying on a player with **equal** Sentry to your Spy
8. **Expected**: Should **always fail** (must be greater than, not equal)

**Key Points to Check**:
- ✅ Free to attempt (no turn cost)
- ✅ Spy > Sentry = always success
- ✅ Spy ≤ Sentry = always failure
- ✅ Deterministic (same result every time)

---

### 2. Test Research Level Gating
**Goal**: Verify that information is properly hidden/shown based on research level

**Test Matrix**:

| Research Level | What to Check |
|----------------|---------------|
| 0 | Only Gold and Combat Stats visible, rest shows "???" |
| 1 | Citizens + all unit counts now visible |
| 2 | Miners, Hostages, building levels (Kingdom/Mine/Barracks) visible |
| 3 | Full Armoury inventory visible, Weapon Tech level shown |
| 4 | All research levels visible (Attack/Defense/Spy/Sentry/Turns/Hostage) |
| 5 | Vault gold and Vault level visible |

**Steps**:
1. Start with research_spy_report = 0
2. Spy on a target and note what's visible
3. Upgrade research in Library
4. Spy again (same or different target)
5. Verify new fields are now visible

---

### 3. Test Help Documentation
**Goal**: Verify Help section is accurate and comprehensive

**Steps**:
1. Open Help window
2. Navigate to Library section
3. Find "Unlock Better Spy Reports" table
4. **Expected**:
   - Shows all 6 levels (0-5)
   - Each level lists specific fields unlocked
   - Shows XP costs
   - Has mechanics explanation box at bottom

**Check**:
- ✅ Level 0 labeled as "Base Information"
- ✅ Each level has descriptive title (e.g., "Economic & Infrastructure Data")
- ✅ Bullet points list specific fields
- ✅ Mechanics box explains success condition, cost, sharing

---

### 4. Integration Test
**Complete workflow test**

**Steps**:
1. **Scout Phase**:
   - Spy on 3-5 different players
   - Note their Defense/Sentry stats
   - Mark which ones succeeded vs failed

2. **Research Phase**:
   - Upgrade spy reports to Level 2
   - Re-spy on same targets
   - Verify new information is visible

3. **Intel Sharing**:
   - Open a successful spy report
   - Click "Share Report"
   - Share with alliance or individual
   - Verify recipient can see shared report

4. **Attack Planning**:
   - Use spy intelligence to pick a target
   - Compare reported Defense to your Attack
   - Execute attack
   - Verify reported stats matched reality

---

## SQL Testing (Optional - Admin/Dev Only)

### Direct Database Checks

```sql
-- Check spy report storage
SELECT 
    attacker_id, 
    defender_id, 
    gold, 
    created_at,
    kingdom_level,
    research_weapons
FROM spy_reports 
ORDER BY created_at DESC 
LIMIT 10;

-- Check research levels
SELECT 
    id, 
    username, 
    research_spy_report, 
    spy, 
    sentry
FROM user_stats 
ORDER BY research_spy_report DESC 
LIMIT 10;

-- Test spy_player function manually
SELECT spy_player('target-uuid-here'::uuid);
```

---

## Known Edge Cases

### 1. Self-Spy Prevention
- **Test**: Try to spy on yourself
- **Expected**: Error message "Cannot spy on yourself"

### 2. Tutorial Clippy
- **Test**: During tutorial (steps 9 or 12), Clippy appears in battlefield
- **Expected**: Spying on Clippy always succeeds, advances tutorial

### 3. Equal Stats Edge Case
- **Scenario**: Spy = 100, Sentry = 100
- **Expected**: Always fails (needs to be strictly greater than)
- **Test**: Spy 5 times with equal stats, should fail all 5 times

### 4. Report Age Display
- **Test**: Spy on player, wait 30 minutes, view report again
- **Expected**: Shows "30m ago" or similar timestamp

---

## Common Issues & Fixes

### Issue: Reports not saving
**Check**: Verify `spy_reports` table exists
**Fix**: Run `update_spy_system.sql`

### Issue: All fields showing as "???"
**Check**: User's `research_spy_report` level
**Fix**: Upgrade research in Library

### Issue: Unexpected failure with higher Spy
**Check**: Verify your Spy stat is actually higher than target's Sentry
**Check**: Remember equal stats (Spy = Sentry) always fails
**Note**: Must be strictly greater than (>), not greater than or equal (≥)

### Issue: Help section not visible
**Check**: Help.jsx has correct content around line 400-490
**Fix**: Re-apply Help.jsx changes

---

## Performance Metrics

**Expected Performance**:
- Spy action: < 500ms
- Report modal open: < 200ms
- Help section load: < 100ms

**Database Efficiency**:
- One INSERT per successful spy
- One SELECT per report view
- No real-time updates needed

---

## User Experience Checklist

Before considering feature complete:

- [ ] Spying feels responsive (quick feedback)
- [ ] Success/failure is clear and comprehensible
- [ ] Research progression feels rewarding
- [ ] Help documentation answers common questions
- [ ] Report sharing works with alliance
- [ ] Mobile-friendly report view
- [ ] No confusing "???" without explanation
- [ ] Costs are clearly displayed
- [ ] Strategic value is apparent to players

---

## Final Validation

**All tests passed?** → Feature is working as intended ✅

**Any issues found?** → Refer to analysis document for implementation details
