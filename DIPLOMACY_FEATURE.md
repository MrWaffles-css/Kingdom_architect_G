# Alliance Diplomacy Feature - Implementation Summary

## Overview
Added a new "Diplomacy" tab to the Alliance interface where alliance leaders can manage diplomatic relations with other alliances.

## Database Changes (alliance_diplomacy.sql)

### New Table: `alliance_relations`
- Stores diplomatic relationships between alliances
- Fields:
  - `alliance_id`: The alliance setting the relation
  - `target_alliance_id`: The target alliance
  - `relation_type`: One of 'neutral', 'ally', or 'enemy'
  - Unique constraint on (alliance_id, target_alliance_id)

### New Functions:

1. **`get_alliance_diplomacy()`**
   - Returns all other alliances with their current relation status
   - Accessible by any alliance member
   - Shows: alliance name, description, member count, and current relation

2. **`set_alliance_relation(p_target_alliance_id, p_relation_type)`**
   - Sets or updates diplomatic relation with another alliance
   - Only accessible by alliance leaders
   - Validates relation type and permissions
   - Setting to 'neutral' removes the relation record (default state)

## Frontend Changes (Alliance.jsx)

### New State:
- `diplomacyList`: Stores the list of alliances and their relations

### New Functions:
- `fetchDiplomacy()`: Fetches all alliances and current relations
- `handleSetRelation(targetAllianceId, relationType)`: Updates a diplomatic relation

### New UI:
- **Diplomacy Tab** (leader-only):
  - Table showing all other alliances
  - Dropdown for each alliance to set relation (Neutral/Ally/Enemy)
  - Color-coded relations:
    - Neutral: Gray
    - Ally: Green
    - Enemy: Red
  - Helpful guide explaining each relation type

## How to Apply

1. **Run the SQL migration:**
   - Open Supabase SQL Editor
   - Copy and paste contents of `alliance_diplomacy.sql`
   - Execute the script

2. **Test the feature:**
   - Log in as an alliance leader
   - Navigate to Alliance window
   - Click the "Diplomacy" tab
   - Select relations for other alliances using the dropdown menus

## Features:
- ✅ Leader-only access to diplomacy management
- ✅ Simple dropdown interface for setting relations
- ✅ Color-coded visual feedback
- ✅ Automatic data refresh after changes
- ✅ Proper validation and error handling
- ✅ RLS policies for security

## Future Enhancements (Optional):
- Display alliance relations on the battlefield
- Show allied/enemy indicators on member profiles
- Add diplomacy history/logs
- Implement alliance-wide notifications for relation changes
- Add mutual alliance agreements (both sides must agree)
