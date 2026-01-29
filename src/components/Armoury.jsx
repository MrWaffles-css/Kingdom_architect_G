import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const WEAPON_DATA = {
    attack: [
        { tier: 0, name: 'Rusty Dagger', cost: 100, strength: 1 },
        { tier: 1, name: 'Iron Sword', cost: 1000, strength: 12 },
        { tier: 2, name: 'Steel Mace', cost: 10000, strength: 150 },
        { tier: 3, name: 'Knight\'s Lance', cost: 100000, strength: 2000 },
        { tier: 4, name: 'Royal Claymore', cost: 1000000, strength: 25000 },
        { tier: 5, name: 'Void Blade', cost: 10000000, strength: 300000 },
    ],
    defense: [
        { tier: 0, name: 'Tattered Tunic', cost: 100, strength: 1 },
        { tier: 1, name: 'Leather Jerkin', cost: 1000, strength: 12 },
        { tier: 2, name: 'Chainmail Hauberk', cost: 10000, strength: 150 },
        { tier: 3, name: 'Steel Plate', cost: 100000, strength: 2000 },
        { tier: 4, name: 'Enchanted Shield', cost: 1000000, strength: 25000 },
        { tier: 5, name: 'Divine Barrier', cost: 10000000, strength: 300000 },
    ],
    spy: [
        { tier: 0, name: 'Hooded Cloak', cost: 100, strength: 1 },
        { tier: 1, name: 'Lockpicks', cost: 1000, strength: 12 },
        { tier: 2, name: 'Smoke Bomb', cost: 10000, strength: 150 },
        { tier: 3, name: 'Poison Vial', cost: 100000, strength: 2000 },
        { tier: 4, name: 'Assassin\'s Blade', cost: 1000000, strength: 25000 },
        { tier: 5, name: 'Shadow Essence', cost: 10000000, strength: 300000 },
    ],
    sentry: [
        { tier: 0, name: 'Wooden Torch', cost: 100, strength: 1 },
        { tier: 1, name: 'Signal Horn', cost: 1000, strength: 12 },
        { tier: 2, name: 'Watchtower Lens', cost: 10000, strength: 150 },
        { tier: 3, name: 'Guard Dog', cost: 100000, strength: 2000 },
        { tier: 4, name: 'Mystic Ward', cost: 1000000, strength: 25000 },
        { tier: 5, name: 'All-Seeing Eye', cost: 10000000, strength: 300000 },
    ]
};

export default function Armoury({ userStats, onUpdate }) {
    if (!userStats) return <div className="text-center p-4">Loading stats...</div>;

    const [activeTab, setActiveTab] = useState('attack');
    const [userWeapons, setUserWeapons] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null); // 'buy-tier-0'
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [quantities, setQuantities] = useState({}); // { 'attack-0': 10 }

    const researchLevel = userStats.research_weapons || 0;

    useEffect(() => {
        fetchWeapons();
    }, [userStats.id]);

    const fetchWeapons = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_weapons')
                .select('*')
                .eq('user_id', userStats.id);

            if (error) throw error;
            setUserWeapons(data || []);
        } catch (err) {
            console.error('Error fetching weapons:', err);
        } finally {
            setLoading(false);
        }
    };

    const availableGold = userStats.use_vault_gold
        ? (userStats.gold || 0) + (userStats.vault || 0)
        : (userStats.gold || 0);

    const getOwnedQuantity = (type, tier) => {
        const weapon = userWeapons.find(w => w.weapon_type === type && w.tier === tier);
        return weapon ? weapon.quantity : 0;
    };

    const handleQuantityChange = (key, value) => {
        setQuantities(prev => ({ ...prev, [key]: parseInt(value) || 0 }));
    };

    const handleBuy = async (type, tier) => {
        const qty = quantities[`${type}-${tier}`] || 1;
        if (qty <= 0) return;

        setActionLoading(`buy-${type}-${tier}`);
        setError(null);
        setSuccessMsg(null);

        try {
            const { data, error } = await supabase.rpc('buy_weapon', {
                p_type: type,
                p_tier: tier,
                p_quantity: qty
            });

            if (error) throw error;

            onUpdate(data); // Update gold
            await fetchWeapons(); // Refresh inventory
            setSuccessMsg(`Successfully bought ${qty} weapons!`);
            setQuantities(prev => ({ ...prev, [`${type}-${tier}`]: '' }));
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleSell = async (type, tier) => {
        const qty = quantities[`${type}-${tier}`] || 1;
        if (qty <= 0) return;

        setActionLoading(`sell-${type}-${tier}`);
        setError(null);
        setSuccessMsg(null);

        try {
            const { data, error } = await supabase.rpc('sell_weapon', {
                p_type: type,
                p_tier: tier,
                p_quantity: qty
            });

            if (error) throw error;

            onUpdate(data); // Update vault
            await fetchWeapons(); // Refresh inventory
            setSuccessMsg(`Successfully sold ${qty} weapons!`);
            setQuantities(prev => ({ ...prev, [`${type}-${tier}`]: '' }));
        } catch (err) {
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-4 font-sans text-black animate-fade-in">
            {/* Header Banner */}
            {/* Header Banner */}
            <div className="bg-white border-2 border-gray-400 border-r-white border-b-white shadow-[inset_1px_1px_0px_0px_#000] mb-4">
                <img
                    src="/images/armory-banner.png"
                    alt="Royal Armoury"
                    className="w-full h-48 object-cover object-center border-b-2 border-gray-400"
                    style={{ imageRendering: 'pixelated' }}
                />
                <div className="p-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold mb-1">Royal Armoury</h1>
                        <p className="text-sm">Equip your forces with the finest steel.</p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-gray-600 uppercase font-bold">Research Level</div>
                        <div className="text-2xl font-bold">{researchLevel} <span className="text-sm text-gray-500">/ 5</span></div>
                    </div>
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

            {/* Weapon/Soldier Ratio Warning */}
            {(() => {
                const soldierCount = (() => {
                    switch (activeTab) {
                        case 'attack': return userStats.attack_soldiers || 0;
                        case 'defense': return userStats.defense_soldiers || 0;
                        case 'spy': return userStats.spies || 0;
                        case 'sentry': return userStats.sentries || 0;
                        default: return 0;
                    }
                })();

                // Calculate total weapons owned in this category
                const totalWeapons = WEAPON_DATA[activeTab].reduce((sum, w) => sum + getOwnedQuantity(activeTab, w.tier), 0);

                if (totalWeapons > soldierCount) {
                    return (
                        <div className="bg-yellow-100 border text-yellow-800 px-4 py-2 border-yellow-600 mb-4 flex items-center gap-2 text-xs" role="alert">
                            <span className="text-xl">⚠️</span>
                            <div>
                                <strong className="font-bold block">Excess Weapons!</strong>
                                <span>You have {totalWeapons} {activeTab} weapons but only {soldierCount} units. <br />
                                    {totalWeapons - soldierCount} weapons are currently unused and providing no stat bonus. Train more units in the Barracks!</span>
                            </div>
                        </div>
                    );
                }
                return null;
            })()}

            {/* Wrapper for Tabs and Content */}
            <div className="border border-gray-400 p-1">
                {/* Tabs */}
                <div className="flex gap-1 border-b border-white bg-gray-200 p-1 pb-0">
                    {Object.keys(WEAPON_DATA).map(type => (
                        <button
                            key={type}
                            onClick={() => setActiveTab(type)}
                            className={`px-4 py-1 text-xs font-bold uppercase border-t-2 border-l-2 border-r-2 rounded-t transition-colors ${activeTab === type
                                ? 'bg-white border-white border-r-gray-600 border-b-0 -mb-[1px] z-10'
                                : 'bg-gray-300 border-white border-r-gray-600 text-gray-600'
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                {/* Tab Summary Bar */}
                {(() => {
                    const soldierCount = (() => {
                        switch (activeTab) {
                            case 'attack': return userStats.attack_soldiers || 0;
                            case 'defense': return userStats.defense_soldiers || 0;
                            case 'spy': return userStats.spies || 0;
                            case 'sentry': return userStats.sentries || 0;
                            default: return 0;
                        }
                    })();

                    const totalWeapons = WEAPON_DATA[activeTab].reduce((sum, w) => sum + getOwnedQuantity(activeTab, w.tier), 0);
                    const equipped = Math.min(soldierCount, totalWeapons);
                    const unequipped = Math.max(0, soldierCount - totalWeapons);
                    const excess = Math.max(0, totalWeapons - soldierCount);

                    return (
                        <div className="bg-gray-100 border-b border-gray-400 p-2 text-xs flex justify-around items-center text-gray-800">
                            <div className="text-center">
                                <div className="font-bold text-lg text-blue-900">{soldierCount.toLocaleString()}</div>
                                <div className="text-[10px] uppercase text-gray-500">Total Soldiers</div>
                            </div>
                            <div className="text-gray-400 font-light text-2xl">/</div>
                            <div className="text-center">
                                <div className="font-bold text-lg text-green-700">{equipped.toLocaleString()}</div>
                                <div className="text-[10px] uppercase text-gray-500">Equipped</div>
                            </div>
                            <div className="text-gray-400 font-light text-2xl">/</div>
                            <div className="text-center">
                                <div className={`font-bold text-lg ${unequipped > 0 ? 'text-red-600' : 'text-gray-400'}`}>{unequipped.toLocaleString()}</div>
                                <div className="text-[10px] uppercase text-gray-500">Unequipped</div>
                            </div>
                            {excess > 0 && (
                                <>
                                    <div className="text-gray-400 font-light text-2xl">/</div>
                                    <div className="text-center">
                                        <div className="font-bold text-lg text-yellow-600">{excess.toLocaleString()}</div>
                                        <div className="text-[10px] uppercase text-gray-500">Spare Weapons</div>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })()}

                {/* Weapons Grid */}
                <div className="p-4 bg-white border-2 border-gray-600 border-t-white border-l-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {WEAPON_DATA[activeTab].map((weapon) => {
                            const isLocked = weapon.tier > 0 && weapon.tier > researchLevel;
                            const owned = getOwnedQuantity(activeTab, weapon.tier);
                            const key = `${activeTab}-${weapon.tier}`;
                            const inputQty = quantities[key] || '';

                            return (
                                <fieldset key={weapon.tier} className={`border-2 border-white border-l-gray-500 border-t-gray-500 p-2 relative ${isLocked ? 'bg-gray-100' : 'bg-transparent'}`}>
                                    <legend className="font-bold text-black mb-1 px-1">{weapon.name}</legend>

                                    {isLocked && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-gray-200/50 z-10">
                                            <div className="bg-white border text-xs font-bold px-2 py-1 shadow">
                                                REQUIRES RESEARCH LVL {weapon.tier}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] text-gray-500 font-bold uppercase">Tier {weapon.tier}</span>
                                    </div>

                                    <div className="space-y-1 mb-4 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-800">Strength</span>
                                            <span className="font-bold text-red-900">+{weapon.strength.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-800">Cost</span>
                                            <span className="font-bold text-yellow-700">{weapon.cost.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between bg-gray-100 px-1 border border-gray-300">
                                            <span className="text-gray-800">Owned</span>
                                            <span className="font-bold text-green-900">{owned.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                min="1"
                                                placeholder="Qty"
                                                value={inputQty}
                                                onChange={(e) => handleQuantityChange(key, e.target.value)}
                                                disabled={isLocked}
                                                className="w-16 px-1 py-0.5 text-sm bg-white border-2 border-gray-600 border-r-white border-b-white shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] outline-none"
                                            />
                                            <button
                                                onClick={() => handleBuy(activeTab, weapon.tier)}
                                                disabled={isLocked || actionLoading === `buy-${key}` || !inputQty || availableGold < (parseInt(inputQty) * weapon.cost)}
                                                className="flex-1 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white text-xs font-bold uppercase disabled:text-gray-500"
                                            >
                                                {actionLoading === `buy-${key}` ? '...' : 'Buy'}
                                            </button>
                                            <button
                                                onClick={() => handleSell(activeTab, weapon.tier)}
                                                disabled={isLocked || actionLoading === `sell-${key}` || !inputQty || owned < (parseInt(inputQty) || 1)}
                                                className="flex-1 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white text-xs font-bold uppercase disabled:text-gray-500"
                                            >
                                                {actionLoading === `sell-${key}` ? '...' : 'Sell'}
                                            </button>
                                        </div>
                                        <div className="text-[10px] text-center text-gray-500">
                                            Sell value: 50%
                                        </div>
                                    </div>
                                </fieldset>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
