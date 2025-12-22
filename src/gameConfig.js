/**
 * Game Configuration
 * 
 * This file acts as the central "spreadsheet" for balancing the game.
 * You can edit costs, descriptions, and rates here.
 * 
 * IMPORTANT: These values should match the server-side calculations
 * in your Supabase RPC functions (e.g., generate_resources).
 */

// Kingdom Levels Configuration
// Level: The target level
// Cost: Experience points needed to reach this level
// Description: Text shown on the button
// Generate 100 levels programmatically
const levels = [
    { level: 0, cost: 0, description: "Unclaimed Land" } // Placeholder for index 0
];

for (let i = 1; i <= 100; i++) {
    levels.push({
        level: i,
        cost: i * 100,
        description: i === 1 ? "Found Kingdom" : `Upgrade to Level ${i}`
    });
}

export const KINGDOM_LEVELS = levels;

// Gold Mine Levels Configuration
const goldMineLevels = [];
for (let i = 0; i <= 25; i++) {
    let cost = 0;
    if (i === 0) cost = 1000;
    else if (i === 1) cost = 5000;
    else if (i === 2) cost = 15000;
    else if (i === 3) cost = 45000;
    else cost = Math.floor(45000 * Math.pow(3, i - 3));

    // Production rate matches calculateMinerGoldRate logic
    // Base 2, +1 per level above 1
    const rate = 2 + Math.max(0, i - 1);

    goldMineLevels.push({
        level: i,
        upgrade_cost: cost,
        production_rate: rate
    });
}
export const GOLD_MINE_LEVELS = goldMineLevels;

// =====================================================
// GOLD GENERATION RATES
// =====================================================
export const GOLD_RATES = {
    // Base gold per citizen per minute
    CITIZEN_BASE: 1,

    // Gold per trained unit per minute (soldiers, spies, sentries)
    TRAINED_UNIT: 0.5,

    // Base gold per miner (before gold mine bonus)
    MINER_BASE: 2,

    // Additional gold per miner per gold mine level
    // Formula: miner_gold = MINER_BASE + (gold_mine_level - 1) * MINER_PER_LEVEL
    // At level 1: 2 gold/min
    // At level 2: 3 gold/min
    // At level 25: 26 gold/min
    MINER_PER_LEVEL: 1,
};

// =====================================================
// GAME COSTS
// =====================================================
export const GAME_COSTS = {
    // Cost to train one soldier/spy/sentry
    TRAIN_SOLDIER: 1000,
};

// =====================================================
// UNIT STATS
// =====================================================
export const UNIT_STATS = {
    // Base strength for all units (Attack, Defense, Spy, Sentry)
    BASE_STRENGTH: 1,
};

// =====================================================
// POPULATION GROWTH
// =====================================================
export const POPULATION_RATES = {
    // Citizens gained per minute per kingdom level
    CITIZENS_PER_LEVEL: 1,
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Calculate gold generation per minute for a user
 * This should match the server-side calculation in generate_resources()
 */
export function calculateGoldPerMinute(userStats) {
    const citizens = userStats?.citizens || 0;
    const attackSoldiers = userStats?.attack_soldiers || 0;
    const defenseSoldiers = userStats?.defense_soldiers || 0;
    const spies = userStats?.spies || 0;
    const sentries = userStats?.sentries || 0;
    const miners = userStats?.miners || 0;
    const goldMineLevel = userStats?.gold_mine_level || 1;

    // Citizens contribution
    const citizenGold = citizens * GOLD_RATES.CITIZEN_BASE;

    // Trained units contribution (soldiers, spies, sentries)
    const trainedUnitsGold = (attackSoldiers + defenseSoldiers + spies + sentries) * GOLD_RATES.TRAINED_UNIT;

    // Miners contribution (scales with gold mine level)
    const minerMultiplier = GOLD_RATES.MINER_BASE + Math.max(0, goldMineLevel - 1) * GOLD_RATES.MINER_PER_LEVEL;
    const minerGold = miners * minerMultiplier;

    return citizenGold + trainedUnitsGold + minerGold;
}

/**
 * Calculate gold per miner based on gold mine level
 */
export function calculateMinerGoldRate(goldMineLevel = 1) {
    return GOLD_RATES.MINER_BASE + Math.max(0, goldMineLevel - 1) * GOLD_RATES.MINER_PER_LEVEL;
}

/**
 * Calculate citizens gained per minute
 */
export function calculateCitizensPerMinute(kingdomLevel = 0) {
    return kingdomLevel * POPULATION_RATES.CITIZENS_PER_LEVEL;
}
