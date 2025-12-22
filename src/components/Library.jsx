import React, { useState } from 'react';
import { supabase } from '../supabase';
import GuideArrow from './GuideArrow';

export default function Library({ userStats, onUpdate }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [activeTab, setActiveTab] = useState('economy');

    const currentLevel = userStats.library_level || 1;

    // Upgrade Cost Logic
    const getUpgradeCost = (level) => {
        if (level === 1) return 100000;
        if (level === 2) return 300000;
        if (level === 3) return 600000;
        if (level === 4) return 900000;
        if (level === 5) return 2000000;
        if (level === 6) return 5000000;
        if (level === 7) return 25000000;
        if (level === 8) return 50000000;
        if (level === 9) return 100000000;
        return 0; // Max level
    };

    const nextLevelCost = getUpgradeCost(currentLevel);
    const isMaxLevel = currentLevel >= 10;

    const handleUpgrade = async () => {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const { data, error } = await supabase.rpc('upgrade_library');
            if (error) throw error;

            onUpdate(data);
            setSuccessMsg('Library upgraded successfully!');
        } catch (err) {
            console.error('Upgrade error:', err);
            setError(err.message || 'Failed to upgrade Library');
        } finally {
            setLoading(false);
        }
    };

    const availableGold = userStats.use_vault_gold
        ? (userStats.gold || 0) + (userStats.vault || 0)
        : (userStats.gold || 0);

    // Helper to get cost string for weapon research
    const getWeaponResearchCost = (level) => {
        if (level === 0) return '100,000 Gold';
        if (level === 1) return '300,000 Gold';
        if (level === 2) return '900,000 Gold';
        if (level === 3) return '2,700,000 Gold';
        if (level === 4) return '8,100,000 Gold';
        return 'Max Level';
    };

    // Helper to get numeric cost for weapon research validation
    const getWeaponResearchCostNum = (level) => {
        if (level === 0) return 100000;
        if (level === 1) return 300000;
        if (level === 2) return 900000;
        if (level === 3) return 2700000;
        if (level === 4) return 8100000;
        return Infinity;
    };

    // Helper to get cost string for vault steal research (XP)
    const getVaultStealResearchCost = (level) => {
        if (level === 0) return '5,000 XP';
        if (level === 1) return '10,000 XP';
        if (level === 2) return '15,000 XP';
        if (level === 3) return '20,000 XP';
        if (level === 4) return '25,000 XP';
        return 'Max Level';
    };

    // Helper to get numeric cost for vault steal research validation
    const getVaultStealResearchCostNum = (level) => {
        if (level === 0) return 5000;
        if (level === 1) return 10000;
        if (level === 2) return 15000;
        if (level === 3) return 20000;
        if (level === 4) return 25000;
        return Infinity;
    };

    // Helper to get cost string for hostage research
    const getHostageResearchCost = (level) => {
        if (level === 0) return '100,000 Gold';
        if (level === 1) return '200,000 Gold';
        if (level === 2) return '500,000 Gold';
        if (level === 3) return '750,000 Gold';
        if (level === 4) return '1,000,000 Gold';
        if (level === 5) return '2,000,000 Gold';
        if (level === 6) return '10,000,000 Gold';
        if (level === 7) return '50,000,000 Gold';
        if (level === 8) return '100,000,000 Gold';
        if (level === 9) return '1,000,000,000 Gold';
        return 'Max Level';
    };

    // Helper to get numeric cost for hostage research validation
    const getHostageResearchCostNum = (level) => {
        if (level === 0) return 100000;
        if (level === 1) return 200000;
        if (level === 2) return 500000;
        if (level === 3) return 750000;
        if (level === 4) return 1000000;
        if (level === 5) return 2000000;
        if (level === 6) return 10000000;
        if (level === 7) return 50000000;
        if (level === 8) return 100000000;
        if (level === 9) return 1000000000;
        return Infinity;
    };

    // Helper to get cost for Tech Upgrades (Attack, Defense, Spy, Sentry)
    // Matches the 64-level table
    const getTechUpgradeCost = (level) => {
        const costs = [
            300, 340, 385, 435, 490, 550, 620, 700, 790, 890,
            1000, 1130, 1275, 1440, 1625, 1830, 2065, 2330, 2625, 2960,
            3340, 3765, 4245, 4785, 5395, 6080, 6855, 7725, 8710, 9820,
            11070, 12480, 14070, 15860, 17880, 20155, 22720, 25610, 28870, 32545,
            36685, 41350, 46610, 52540, 59225, 66760, 75255, 84830, 95625, 107790,
            121505, 136965, 154390, 174035, 196175, 221135, 249275, 281000, 316750, 357055,
            402490, 453700, 800000
        ];
        if (level >= costs.length) return 'Max Level';
        return costs[level].toLocaleString() + ' XP';
    };

    const getTechUpgradeCostNum = (level) => {
        const costs = [
            300, 340, 385, 435, 490, 550, 620, 700, 790, 890,
            1000, 1130, 1275, 1440, 1625, 1830, 2065, 2330, 2625, 2960,
            3340, 3765, 4245, 4785, 5395, 6080, 6855, 7725, 8710, 9820,
            11070, 12480, 14070, 15860, 17880, 20155, 22720, 25610, 28870, 32545,
            36685, 41350, 46610, 52540, 59225, 66760, 75255, 84830, 95625, 107790,
            121505, 136965, 154390, 174035, 196175, 221135, 249275, 281000, 316750, 357055,
            402490, 453700, 800000
        ];
        if (level >= costs.length) return Infinity;
        return costs[level];
    };

    // Helper to get bonus description
    // Returns: "Increases power by X% -> Y%"
    const getTechBonusDesc = (level) => {
        const bonuses = [
            0, 5, 10, 15, 20, 25, 30, 35, 40, 45,
            50, 55, 60, 65, 70, 75, 80, 85, 90, 95,
            100, 110, 120, 130, 140, 150, 160, 170, 180, 190,
            200, 215, 230, 245, 260, 275, 290, 305, 320, 335,
            350, 370, 390, 410, 430, 450, 470, 490, 510, 530,
            550, 575, 600, 625, 650, 675, 700, 730, 760, 790,
            820, 850, 880, 900
        ];

        const currentBonus = bonuses[Math.min(level, bonuses.length - 1)];

        if (level >= 63) {
            return `Increases power by ${currentBonus}% (Max)`;
        }

        const nextBonus = bonuses[Math.min(level + 1, bonuses.length - 1)];
        return `Increases power by ${currentBonus}% → ${nextBonus}%`;
    };

    const handleResearchUpgrade = async (researchName) => {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);

        try {
            let rpcName = '';
            if (researchName === 'Increase Turns per Minute') {
                rpcName = 'upgrade_research_turns';
            } else if (researchName === 'Unlock Better Weapons') {
                rpcName = 'upgrade_research_weapons';
            } else if (researchName === 'Steal from Vault %') {
                rpcName = 'upgrade_research_vault_steal';
            } else if (researchName === 'Increase Stolen %') {
                rpcName = 'upgrade_research_gold_steal';
            } else if (researchName === 'Convert into Hostages %') {
                rpcName = 'upgrade_research_hostage_convert';
            } else if (researchName === 'Attack Technology') {
                rpcName = 'upgrade_research_attack';
            } else if (researchName === 'Defense Technology') {
                rpcName = 'upgrade_research_defense';
            } else if (researchName === 'Sentry Technology') {
                rpcName = 'upgrade_research_sentry';
            } else if (researchName === 'Spy Technology') {
                rpcName = 'upgrade_research_spy';
            } else {
                return;
            }

            const { data, error } = await supabase.rpc(rpcName);
            if (error) throw error;

            onUpdate(data);
            setSuccessMsg(`${researchName} upgraded successfully!`);
        } catch (err) {
            console.error('Research upgrade error:', err);
            setError(err.message || 'Failed to upgrade research');
        } finally {
            setLoading(false);
        }
    };

    // Helper to get cost string for turns research
    const getTurnsResearchCost = (level) => {
        if (level === 0) return '1,000 XP';
        if (level === 1) return '5,000 XP';
        if (level === 2) return '25,000 XP';
        if (level === 3) return '100,000 XP';
        if (level === 4) return '500,000 XP';
        return 'Max Level';
    };

    // Helper to get numeric cost for validation
    const getTurnsResearchCostNum = (level) => {
        if (level === 0) return 1000;
        if (level === 1) return 5000;
        if (level === 2) return 25000;
        if (level === 3) return 100000;
        if (level === 4) return 500000;
        return Infinity;
    };

    // Helper to get turns generated per minute
    const getTurnsGenerated = (level) => {
        if (level === 0) return 0;
        if (level === 1) return 1;
        if (level === 2) return 2;
        if (level === 3) return 4;
        if (level === 4) return 8;
        if (level >= 5) return 15;
        return 0;
    };

    // Description Generators for Standard Upgrades
    const getVaultStealDesc = (level) => {
        const current = level * 5;
        if (level >= 5) return `Steal ${current}% from enemy vaults (Max)`;
        return `Steal ${current}% → ${(level + 1) * 5}% from enemy vaults`;
    };

    const getGoldStealDesc = (level) => {
        const current = 50 + (level * 5);
        if (level >= 10) return `Steal ${current}% of enemy gold (Max)`;
        return `Steal ${current}% → ${50 + ((level + 1) * 5)}% of enemy gold`;
    };

    const getTurnsDesc = (level) => {
        const current = getTurnsGenerated(level);
        if (level >= 5) return `Generate ${current} turns per minute (Max)`;
        const next = getTurnsGenerated(level + 1);
        return `Generate ${current} → ${next} turns per minute`;
    };

    const getHostageDesc = (level) => {
        const current = level * 10;
        if (level >= 10) return `Convert ${current}% of killed soldiers to hostages (Max)`;
        return `Convert ${current}% → ${(level + 1) * 10}% of killed soldiers to hostages`;
    };

    const getWeaponDesc = (level) => {
        if (level >= 5) return `Access to Tier ${level} Weapons (Max)`;
        return `Access to Tier ${level} Weapons → Tier ${level + 1} Weapons`;
    };

    // Research Data (Dynamic)
    const researchCategories = {
        economy: [
            {
                name: 'Steal from Vault %',
                level: userStats.research_vault_steal || 0,
                maxLevel: 5,
                description: getVaultStealDesc(userStats.research_vault_steal || 0),
                cost: getVaultStealResearchCost(userStats.research_vault_steal || 0),
                costNum: getVaultStealResearchCostNum(userStats.research_vault_steal || 0),
                currency: 'xp', // Specify currency type
                disabled: false
            },
            {
                name: 'Increase Stolen %',
                level: userStats.research_gold_steal || 0,
                maxLevel: 10,
                description: getGoldStealDesc(userStats.research_gold_steal || 0),
                cost: (userStats.research_gold_steal || 0) >= 10 ? 'Max Level' : `${(5000 * ((userStats.research_gold_steal || 0) + 1)).toLocaleString()} XP`,
                costNum: 5000 * ((userStats.research_gold_steal || 0) + 1),
                currency: 'xp',
                disabled: false
            },
            {
                name: 'Increase Turns per Minute',
                level: userStats.research_turns_per_min || 0,
                maxLevel: 5,
                description: getTurnsDesc(userStats.research_turns_per_min || 0),
                cost: getTurnsResearchCost(userStats.research_turns_per_min || 0),
                costNum: getTurnsResearchCostNum(userStats.research_turns_per_min || 0),
                currency: 'xp',
                disabled: false
            },
        ],
        military: [
            {
                name: 'Convert into Hostages %',
                level: userStats.research_hostage_convert || 0,
                maxLevel: 10,
                description: getHostageDesc(userStats.research_hostage_convert || 0),
                cost: getHostageResearchCost(userStats.research_hostage_convert || 0),
                costNum: getHostageResearchCostNum(userStats.research_hostage_convert || 0),
                disabled: false
            },
            {
                name: 'Unlock Better Weapons',
                level: userStats.research_weapons || 0,
                maxLevel: 5,
                description: getWeaponDesc(userStats.research_weapons || 0),
                cost: getWeaponResearchCost(userStats.research_weapons || 0),
                costNum: getWeaponResearchCostNum(userStats.research_weapons || 0),
                disabled: false
            },
            {
                name: 'Attack Technology',
                level: userStats.research_attack || 0,
                maxLevel: 63,
                description: getTechBonusDesc(userStats.research_attack || 0),
                cost: getTechUpgradeCost(userStats.research_attack || 0),
                costNum: getTechUpgradeCostNum(userStats.research_attack || 0),
                currency: 'xp',
                disabled: false
            },
        ],
        defense: [
            {
                name: 'Defense Technology',
                level: userStats.research_defense || 0,
                maxLevel: 63,
                description: getTechBonusDesc(userStats.research_defense || 0),
                cost: getTechUpgradeCost(userStats.research_defense || 0),
                costNum: getTechUpgradeCostNum(userStats.research_defense || 0),
                currency: 'xp',
                disabled: false
            },
            {
                name: 'Sentry Technology',
                level: userStats.research_sentry || 0,
                maxLevel: 63,
                description: getTechBonusDesc(userStats.research_sentry || 0),
                cost: getTechUpgradeCost(userStats.research_sentry || 0),
                costNum: getTechUpgradeCostNum(userStats.research_sentry || 0),
                currency: 'xp',
                disabled: false
            },
        ],
        espionage: [
            { name: 'Unlock Better Spy Reports', level: 0, maxLevel: 5, description: 'Reveal more enemy intel', cost: '5,000 XP', disabled: true },
            {
                name: 'Spy Technology',
                level: userStats.research_spy || 0,
                maxLevel: 63,
                description: getTechBonusDesc(userStats.research_spy || 0),
                cost: getTechUpgradeCost(userStats.research_spy || 0),
                costNum: getTechUpgradeCostNum(userStats.research_spy || 0),
                currency: 'xp',
                disabled: false
            },
        ]
    };

    return (
        <div className="space-y-4 font-sans text-black">
            {/* Header Banner */}
            <div className="bg-white p-4 border-2 border-gray-400 border-r-white border-b-white shadow-[inset_1px_1px_0px_0px_#000] flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-xl font-bold mb-1">Royal Library</h1>
                    <p className="text-sm">Research technologies to advance your kingdom.</p>
                </div>
                <div className="text-right">
                    <div className="text-xs text-gray-600 uppercase font-bold">Level</div>
                    <div className="text-2xl font-bold">{currentLevel} <span className="text-sm text-gray-500">/ 10</span></div>
                </div>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="bg-white border text-red-600 px-4 py-2 border-red-500 mb-4" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}
            {successMsg && (
                <div className="bg-white border text-green-700 px-4 py-2 border-green-600 mb-4" role="alert">
                    <strong className="font-bold">Success: </strong>
                    <span className="block sm:inline">{successMsg}</span>
                </div>
            )}

            {/* Building Stats & Upgrade */}
            <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-4 mb-4">
                <legend className="px-1 font-bold">Library Status</legend>
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex-1">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-2 border border-black bg-white">
                                <div className="text-xs text-black uppercase font-bold">XP Bonus</div>
                                <div className="font-bold text-black">+{currentLevel} XP / min</div>
                            </div>
                        </div>
                    </div>

                    {!isMaxLevel && (
                        <div className="flex-1 text-center md:text-right border-t md:border-t-0 md:border-l border-gray-400 pt-4 md:pt-0 md:pl-6">
                            <p className="text-sm text-gray-800 mb-2">
                                Upgrade to Level {currentLevel + 1} for +1 XP/min
                            </p>
                            <div className="text-sm font-bold text-black mb-3">
                                Cost: {nextLevelCost.toLocaleString()} Gold
                            </div>
                            <button
                                onClick={handleUpgrade}
                                disabled={loading || availableGold < nextLevelCost}
                                className="px-6 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white text-black font-bold disabled:text-gray-500"
                            >
                                {loading ? 'Upgrading...' : 'Upgrade Library'}
                                {userStats?.tutorial_step === 6 && <GuideArrow direction="down" className="top-[-40px] left-1/2 -translate-x-1/2" />}
                            </button>
                        </div>
                    )}
                </div>
            </fieldset>

            {/* Research Section */}
            <div className="border border-gray-400 p-1">
                {/* Tabs */}
                <div className="flex gap-1 border-b border-white bg-gray-200 p-1 pb-0">
                    {Object.keys(researchCategories).map(category => (
                        <button
                            key={category}
                            onClick={() => setActiveTab(category)}
                            className={`px-4 py-1 text-xs font-bold uppercase border-t-2 border-l-2 border-r-2 rounded-t transition-colors ${activeTab === category
                                ? 'bg-white border-white border-r-gray-600 border-b-0 -mb-[1px] z-10'
                                : 'bg-gray-300 border-white border-r-gray-600 text-gray-600'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                {/* Research Grid */}
                <div className="p-4 bg-white border-2 border-gray-600 border-t-white border-l-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {researchCategories[activeTab].map((research, index) => (
                            <fieldset key={index} className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2 relative group hover:bg-gray-50">
                                <legend className="font-bold text-black mb-1 px-1">{research.name}</legend>

                                <p className="text-xs text-gray-800 mb-3 min-h-[2.5em]">{research.description}</p>

                                <div className="flex justify-between items-end mt-2 mb-2">
                                    <div>
                                        <div className="text-[10px] uppercase text-gray-500 font-bold">Level</div>
                                        <div className="font-bold text-black">{research.level} / {research.maxLevel}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] uppercase text-gray-500 font-bold">Next Cost</div>
                                        <div className="font-bold text-black text-sm">{research.cost}</div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleResearchUpgrade(research.name)}
                                    disabled={
                                        research.disabled ||
                                        loading ||
                                        (research.currency === 'xp'
                                            ? (research.costNum && (userStats.experience || 0) < research.costNum)
                                            : (research.costNum && availableGold < research.costNum)
                                        ) ||
                                        research.level >= research.maxLevel
                                    }
                                    className={`w-full mt-2 py-1 font-bold text-xs uppercase border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white bg-[#c0c0c0] text-black disabled:text-gray-500 disabled:border-gray-400`}
                                >
                                    {research.level >= research.maxLevel ? 'Max Level' : (research.disabled ? 'Coming Soon' : 'Research')}
                                </button>
                            </fieldset>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
