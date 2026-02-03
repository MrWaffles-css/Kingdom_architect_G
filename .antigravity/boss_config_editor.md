# Boss Configuration Editor System

## Overview
Added a dynamic boss configuration system that allows admins to modify boss stats in real-time without code changes. Changes take effect immediately for all players.

## Features

### 1. Database-Driven Boss Configurations
- Boss data moved from hardcoded `bosses.js` to `boss_configs` database table
- All 30 bosses initialized with current values
- Frontend now fetches boss data dynamically

### 2. Admin Boss Editor
- Accessible via **Admin Panel → Mechanics Tab → Boss Fights → Configure Button**
- Full-screen modal with scrollable table
- Edit all boss properties:
  - **Name** - Boss display name
  - **Required Stats** - Total stats needed to unlock
  - **Turn Cost** - Turns required per fight
  - **Duration (seconds)** - How long each fight takes
  - **XP Reward** - Experience points earned
  - **Gold Reward** - Gold earned per clear
  - **Citizens Reward** - Citizens earned per clear

### 3. Real-Time Updates
- Changes save immediately to database
- All players see updated values on next page load/refresh
- Active fights continue with old values until completed
- No server restart or code deployment needed

## Database Schema

### Table: `boss_configs`
```sql
CREATE TABLE boss_configs (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    req_total_stats INTEGER NOT NULL,
    cost_turns INTEGER NOT NULL DEFAULT 1,
    duration_seconds INTEGER NOT NULL,
    reward_xp INTEGER NOT NULL,
    reward_gold INTEGER NOT NULL,
    reward_citizens INTEGER NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## RPC Functions

### `get_all_bosses()`
- Returns all boss configurations
- Used by frontend to display bosses
- Public access (no admin required)

### `get_boss_configs()` 
- Returns all boss configurations with timestamps
- **Admin only**
- Used by boss editor

### `update_boss_config(...)`
- Updates a single boss configuration
- **Admin only**
- Validates all inputs (must be positive numbers)
- Returns success/error status

### `get_boss_by_id(p_boss_id)`
- Returns a specific boss configuration
- Public access

## UI Components

### AdminMechanicsPanel
- Added "Configure" button for boss_fights mechanic
- Opens BossEditorModal when clicked

### BossEditorModal
- Windows 98-style modal dialog
- Scrollable table showing all 30 bosses
- Inline editing - click "Edit" to modify a row
- Save/Cancel buttons per row
- Important notes section explaining:
  - Changes are immediate
  - Active fights use old values
  - Duration is in seconds
  - Required Stats = total of all combat stats

### BossRow Component
- Displays boss data in view mode
- Switches to edit mode with input fields
- Number inputs for all numeric fields
- Text input for boss name
- Validation on save

## Usage Instructions

### For Admins:
1. Open Admin Panel (admin users only)
2. Click "Mechanics" tab
3. Find "Boss Fights" card
4. Click "⚙️ Configure" button
5. Click "Edit" on any boss row
6. Modify values as needed
7. Click "Save" to apply changes
8. Changes are live immediately!

### For Players:
- Boss changes appear automatically
- Refresh the Bosses page to see updates
- No action required

## Example Use Cases

1. **Event Boss** - Temporarily increase rewards for a specific boss
2. **Balance Adjustment** - Reduce difficulty by lowering required stats
3. **Speed Up Progression** - Decrease fight durations
4. **Economy Tuning** - Adjust gold/XP/citizen rewards
5. **New Content** - Modify existing bosses to create variety

## Files Modified

- `src/components/AdminPanel.jsx` - Added boss editor modal and configure button
- `src/components/Bosses.jsx` - Changed to fetch bosses from database
- `create_boss_configs_system.sql` - Database schema and functions

## Technical Notes

- Boss data is cached in component state
- Fetched every 10 seconds along with other boss data
- No performance impact - single RPC call
- Backward compatible - old boss data preserved in `bosses.js` as backup

## Future Enhancements

Potential additions:
- Add new bosses dynamically (not just edit existing)
- Delete bosses
- Duplicate boss configurations
- Import/Export boss configurations
- Boss difficulty presets (Easy/Normal/Hard modes)
- Seasonal boss variants
