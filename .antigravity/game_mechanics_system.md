# Game Mechanics Toggle System

## Overview
Added a new "Mechanics" tab in the Admin Panel that allows administrators to enable/disable specific game features dynamically.

## Database Schema

### Table: `game_mechanics`
- `key` (TEXT, PRIMARY KEY) - Unique identifier for the mechanic
- `enabled` (BOOLEAN) - Whether the mechanic is currently enabled
- `description` (TEXT) - Human-readable description
- `updated_at` (TIMESTAMPTZ) - Last modification timestamp

### Available Mechanics
1. **Vault Stealing** (`vault_stealing`)
   - Allow players to steal from vaults with research
   - Icon: 🔐

2. **Hostage System** (`hostage_system`)
   - Enable hostage taking and conversion mechanics
   - Icon: ⛓️

3. **Alliance System** (`alliance_system`)
   - Enable alliance creation and management
   - Icon: 🤝

4. **Boss Fights** (`boss_fights`)
   - Enable boss raid system
   - Icon: 👹

5. **Spy Reports** (`spy_reports`)
   - Enable spy intelligence gathering
   - Icon: 🕵️

## RPC Functions

### `get_mechanic_enabled(p_key TEXT) -> BOOLEAN`
- Returns whether a specific mechanic is enabled
- Defaults to `true` if mechanic not found
- Can be called by any user

### `toggle_mechanic(p_key TEXT, p_enabled BOOLEAN) -> JSONB`
- Toggles a mechanic on/off
- **Admin only**
- Returns success status and updated values

### `get_all_mechanics() -> TABLE`
- Returns all mechanics with their current state
- **Admin only**
- Used by the admin panel to display all mechanics

## UI Features

### Admin Panel - Mechanics Tab
- Grid layout showing all available mechanics
- Color-coded cards:
  - **Green** = Enabled
  - **Red** = Disabled
- Each card shows:
  - Icon and name
  - Description
  - Current status (ENABLED/DISABLED)
  - Last updated timestamp
  - Toggle button

### Usage
1. Open Admin Panel (admin users only)
2. Click "Mechanics" tab
3. Click "Enable" or "Disable" button for any mechanic
4. Changes take effect immediately

## Implementation Notes

- All mechanics default to `enabled = true`
- The system is extensible - new mechanics can be added via SQL INSERT
- Frontend automatically fetches and displays all mechanics
- No page reload required when toggling mechanics

## Future Enhancements

To actually enforce these mechanics in the game logic, you'll need to:

1. Check mechanic status before allowing actions:
```javascript
const { data: isEnabled } = await supabase.rpc('get_mechanic_enabled', { 
    p_key: 'vault_stealing' 
});

if (!isEnabled) {
    // Block the action or hide the UI
    return;
}
```

2. Hide UI elements when mechanics are disabled
3. Add server-side validation in RPC functions to check mechanic status

## Files Modified
- `src/components/AdminPanel.jsx` - Added Mechanics tab and AdminMechanicsPanel component
- `create_game_mechanics_system.sql` - Database schema and RPC functions
