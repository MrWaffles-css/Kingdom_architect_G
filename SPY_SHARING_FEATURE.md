# Spy Report Sharing Feature - Implementation Summary

## Overview
Players can now share spy reports with their alliance members or individual players. Shared reports appear as clickable links and expire after 24 hours.

## Database Changes (spy_report_sharing.sql)

### New Table: `shared_spy_reports`
- Stores shared spy reports with expiration
- Fields:
  - `shared_by`: User who shared the report
  - `target_player_id`: The player who was spied on
  - `target_username`: Name of the spied player
  - `report_data`: Full spy report data (JSONB)
  - `share_type`: 'alliance' or 'individual'
  - `shared_with_user_id`: Specific recipient (for individual shares)
  - `alliance_id`: Alliance to share with (for alliance shares)
  - `expires_at`: Auto-expires after 24 hours

### New Functions:

1. **`share_spy_report(...)`**
   - Shares a spy report with alliance or individual
   - Validates permissions and recipients
   - Returns success/failure status

2. **`get_shared_spy_reports()`**
   - Retrieves all spy reports shared with the current user
   - Filters out expired reports
   - Returns reports from alliance or direct shares

3. **`cleanup_expired_spy_reports()`**
   - Removes expired reports (can be called via cron)
   - Returns count of deleted reports

## Frontend Changes (SpyReport.jsx)

### New Features:
- **📤 Share Button** - Blue button next to Close button
- **Share Modal** with two options:
  1. **Entire Alliance** - Shares with all alliance members
  2. **Individual Player** - Select specific alliance member from dropdown

### New State:
- `showShareModal`: Controls modal visibility
- `shareType`: 'alliance' or 'individual'
- `allianceMembers`: List of alliance members for individual sharing
- `selectedUser`: Selected recipient for individual shares
- `sharing`: Loading state during share operation

### New Functions:
- `handleOpenShareModal()`: Opens modal and fetches alliance members
- `handleShare()`: Executes the share operation via RPC

## How It Works:

1. **Player spies on someone** → Spy report opens
2. **Click "📤 Share Report"** → Share modal appears
3. **Choose share type:**
   - Alliance: All members can see it
   - Individual: Select one member
4. **Click "Share"** → Report saved to database
5. **Recipients see shared reports** in alliance chat (future implementation)

## Features:
- ✅ Share with entire alliance
- ✅ Share with individual alliance members
- ✅ 24-hour expiration on shared reports
- ✅ Validation (must be in alliance to share with alliance)
- ✅ Clean modal UI matching Windows 98 theme
- ✅ Loading states and error handling
- ✅ RLS policies for security

## Future Enhancements (To Do):
- [ ] Display shared spy reports in alliance chat as clickable links
- [ ] Add notification when someone shares a report with you
- [ ] Add "View Shared Reports" section in alliance tab
- [ ] Allow re-sharing of received reports
- [ ] Add report sharing history/analytics

## Database Applied:
✅ Migration successfully applied to Supabase

## Files Modified:
- ✅ `spy_report_sharing.sql` - Database migration
- ✅ `src/components/SpyReport.jsx` - Added sharing UI and logic
