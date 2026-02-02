# Boss Fight Custom Input Feature

## Overview
Enhanced the Boss Raids page to allow players to specify exactly how many times they want to fight a boss, with both preset buttons and a custom input field.

## Changes Made

### Visual Layout
**Before:**
- 4 preset buttons: `1x`, `10x`, `100x`, `∞`

**After:**
- 3 preset buttons: `1x`, `10x`, `100x`
- 1 infinity button: `∞` (now highlighted in purple for distinction)
- **NEW:** Custom input field for entering any number between 1-9999

### Features

#### 1. **Preset Quick Select Buttons**
- **1x** - Fight once
- **10x** - Fight 10 times
- **100x** - Fight 100 times
- Buttons highlight in **blue** when selected

#### 2. **Infinity Button (∞)**
- Special button for infinite fighting
- Highlighted in **purple** to stand out
- Fights continuously until you run out of turns
- Gold automatically goes to Vault during infinite fights

#### 3. **Custom Input Field**
- Label: "Custom:"
- Accepts numbers from **1 to 9999**
- Placeholder text: "1-9999"
- Auto-validates and clamps input to valid range
- Shows empty when infinity (∞) is selected
- Real-time value clamping on input

### Input Validation
```javascript
// Min: 1
// Max: 9999
// Auto-clamps invalid values
const clamped = Math.min(9999, Math.max(1, val));
```

### UI/UX Improvements

1. **Clear Visual Hierarchy**
   - Preset buttons on top row
   - Infinity button at the end (visually distinct in purple)
   - Custom input on separate row below

2. **Smart State Management**
   - Input clears when infinity is selected
   - Selecting a preset button updates the selected value
   - Typing in custom field updates the selected value
   - Each boss card maintains its own independent selection

3. **Responsive Design**
   - Adapts to mobile screens with text size adjustments
   - Input field scales properly
   - Button sizing remains consistent

### Updated Help Text
Added clearer instructions in the info panel:
- **Fight Count:** Use preset buttons (1x, 10x, 100x) or enter a custom number (1-9999) to repeat fights automatically.
- **Infinity (∞):** Fight continuously until you run out of turns. Gold goes directly to Vault!

## Use Cases

### Example 1: Quick Farming
- Want to fight exactly 50 times? Type `50` in the custom input!
- No need to click a button 50 times

### Example 2: Precise Resource Planning
- Know you have exactly 237 turns? Enter `237` to use them all on a boss
- Perfect for min-maxing resource generation

### Example 3: Overnight Grinding
- Use the `∞` button before logging off
- Wake up with maximum gold in your vault!

### Example 4: Quick Single Attempts
- Use the `1x` button for testing a new boss
- See the rewards and difficulty before committing more turns

## Technical Details

### State Management
- `selectedTarget` object stores the fight count for each boss by ID
- Default value: `1` if not set
- Special value: `999999` represents infinity

### Component Updates
**File:** `Bosses.jsx`

**Modified Sections:**
1. Control panel layout (lines 389-438)
2. Help text descriptions (lines 217-222)

**Key Changes:**
- Split preset buttons from infinity button
- Added custom input with validation
- Improved button styling and feedback
- Enhanced accessibility with labels and placeholders

## Benefits

✅ **Flexibility** - Enter any number of fights you want  
✅ **Efficiency** - No more clicking the same button repeatedly  
✅ **Precision** - Exactly control your resource spending  
✅ **User-Friendly** - Clear labels and validation  
✅ **Visual Feedback** - Color-coded buttons show active selection  
✅ **Mobile-Friendly** - Responsive design works on all devices

## Notes
- The backend already supports custom fight counts via `start_boss_fight` RPC
- Input validation happens client-side for immediate feedback
- Values outside range are automatically clamped to valid numbers
- Infinity mode (∞) bypasses the custom input entirely
