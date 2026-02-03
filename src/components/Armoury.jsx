import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useGame } from '../contexts/GameContext';

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

    const { showNotification } = useGame();
    const [activeTab, setActiveTab] = useState('attack');
    const [userWeapons, setUserWeapons] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null); // 'buy-tier-0'
    const [quantities, setQuantities] = useState({}); // { 'attack-0': 10 }
    const [sellModal, setSellModal] = useState(null); // { type, tier, qty, name, cost }

    const researchLevel = userStats.research_weapons || 0;

    const [weaponConfigs, setWeaponConfigs] = useState(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            await Promise.all([fetchWeapons(), fetchConfigs()]);
            setLoading(false);
        };
        fetchInitialData();
    }, [userStats.id]);

    const fetchConfigs = async () => {
        try {
            const { data, error } = await supabase.rpc('get_weapon_configs');
            if (error) throw error;

            // Transform array to object { attack: [...], defense: [...] }
            const grouped = (data || []).reduce((acc, curr) => {
                if (!acc[curr.weapon_type]) acc[curr.weapon_type] = [];
                acc[curr.weapon_type].push(curr);
                // Ensure sorted by tier
                acc[curr.weapon_type].sort((a, b) => a.tier - b.tier);
                return acc;
            }, {});

            // If DB is empty for some reason, fallback will be handled by rendering logic or alert?
            // But let's assume if it returns something, we use it. If not, maybe fallback to formatted hardcode?
            // For now, let's trust the DB or fallback to existing WEAPON_DATA constant as initial state if preferred,
            // but we want to use the DB.
            if (Object.keys(grouped).length > 0) {
                setWeaponConfigs(grouped);
            }
        } catch (err) {
            console.error('Error fetching weapon configs:', err);
            // Verify if WEAPON_DATA is still a valid fallback
        }
    };

    const fetchWeapons = async () => {
        try {
            const { data, error } = await supabase
                .from('user_weapons')
                .select('*')
                .eq('user_id', userStats.id);

            if (error) throw error;
            setUserWeapons(data || []);
        } catch (err) {
            console.error('Error fetching inventory:', err);
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

        try {
            const { data, error } = await supabase.rpc('buy_weapon', {
                p_type: type,
                p_tier: tier,
                p_quantity: qty
            });

            if (error) throw error;

            onUpdate(data); // Update gold
            await fetchWeapons(); // Refresh inventory
            showNotification(`Successfully bought ${qty} weapons!`);
            setQuantities(prev => ({ ...prev, [`${type}-${tier}`]: '' }));
        } catch (err) {
            showNotification(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const initiateSell = (type, tier, name, cost) => {
        const qty = parseInt(quantities[`${type}-${tier}`] || 0);
        if (qty <= 0) return;
        setSellModal({ type, tier, qty, name, cost });
    };

    const executeSell = async () => {
        if (!sellModal) return;
        const { type, tier, qty } = sellModal;

        setActionLoading(`sell-${type}-${tier}`);
        setSellModal(null); // Close modal immediately or wait? Better close and show loading on button or global? 
        // Actually, let's keep it simple: Close modal, show global loading or re-use actionLoading logic which affects the buttons behind.

        try {
            const { data, error } = await supabase.rpc('sell_weapon', {
                p_type: type,
                p_tier: tier,
                p_quantity: qty
            });

            if (error) throw error;

            onUpdate(data); // Update vault
            await fetchWeapons(); // Refresh inventory
            showNotification(`Successfully sold ${qty} weapons!`);
            setQuantities(prev => ({ ...prev, [`${type}-${tier}`]: '' }));
        } catch (err) {
            showNotification(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    // Use DB configs if available, otherwise fallback to hardcoded WEAPON_DATA
    const activeData = weaponConfigs || WEAPON_DATA;

    return (
        <div className="space-y-4 font-sans text-black animate-fade-in">
            {/* Header Banner */}
            <div className="bg-white border-2 border-gray-400 border-r-white border-b-white shadow-[inset_1px_1px_0px_0px_#000] mb-4">
                <img
                    src="/images/armory-banner.png"
                    alt="Royal Armoury"
                    className="w-full h-48 object-cover object-center"
                    style={{ imageRendering: 'pixelated' }}
                />
            </div>

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
                const totalWeapons = (activeData[activeTab] || []).reduce((sum, w) => sum + getOwnedQuantity(activeTab, w.tier), 0);

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
                    {Object.keys(activeData).map(type => (
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

                    const totalWeapons = (activeData[activeTab] || []).reduce((sum, w) => sum + getOwnedQuantity(activeTab, w.tier), 0);
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

                {/* Weapons Table */}
                <div className="bg-white border-2 border-gray-600 border-t-white border-l-white">
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-[#c0c0c0] sticky top-0 z-10 text-xs">
                            <tr>
                                <th className="border border-gray-500 border-t-white border-l-white px-2 py-1 text-center w-12">Tier</th>
                                <th className="border border-gray-500 border-t-white border-l-white px-2 py-1 text-left">Name</th>
                                <th className="border border-gray-500 border-t-white border-l-white px-2 py-1 text-right w-24">Power</th>
                                <th className="border border-gray-500 border-t-white border-l-white px-2 py-1 text-right w-24">Cost</th>
                                <th className="border border-gray-500 border-t-white border-l-white px-2 py-1 text-center w-20">Owned</th>
                                <th className="border border-gray-500 border-t-white border-l-white px-2 py-1 text-center w-48">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(activeData[activeTab] || []).map((weapon) => {
                                const isLocked = weapon.tier > 0 && weapon.tier > researchLevel;
                                const owned = getOwnedQuantity(activeTab, weapon.tier);
                                const key = `${activeTab}-${weapon.tier}`;
                                const inputQty = quantities[key] || '';
                                const maxAffordable = Math.floor(availableGold / weapon.cost);

                                return (
                                    <tr key={weapon.tier} className={`${isLocked ? 'bg-gray-200 text-gray-500' : 'hover:bg-blue-50'} border-b border-gray-300`}>
                                        <td className="border-r border-gray-300 p-2 text-center font-bold">
                                            {weapon.tier}
                                        </td>
                                        <td className="border-r border-gray-300 p-2 font-bold relative">
                                            {weapon.name}
                                            {isLocked && (
                                                <span className="ml-2 text-[10px] bg-red-100 text-red-800 border border-red-300 px-1 rounded">
                                                    Requires Research Lvl {weapon.tier}
                                                </span>
                                            )}
                                        </td>
                                        <td className="border-r border-gray-300 p-2 text-right font-mono text-red-700">
                                            +{weapon.strength.toLocaleString()}
                                        </td>
                                        <td className="border-r border-gray-300 p-2 text-right font-mono text-yellow-700">
                                            {weapon.cost.toLocaleString()}
                                        </td>
                                        <td className="border-r border-gray-300 p-2 text-center font-bold font-mono text-blue-900">
                                            {owned.toLocaleString()}
                                        </td>
                                        <td className="p-2 text-center">
                                            <div className="flex bg-white border border-gray-400 p-1 gap-1">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    placeholder="Qty"
                                                    value={inputQty}
                                                    onChange={(e) => handleQuantityChange(key, e.target.value)}
                                                    disabled={isLocked}
                                                    className="w-16 px-1 text-xs border border-gray-400 outline-none font-mono"
                                                />
                                                <button
                                                    onClick={() => handleQuantityChange(key, maxAffordable)}
                                                    disabled={isLocked || maxAffordable <= 0}
                                                    className="px-1 bg-yellow-100 border border-yellow-400 text-[10px] font-bold text-yellow-800 hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title={`Max: ${maxAffordable.toLocaleString()}`}
                                                >
                                                    MAX
                                                </button>
                                                <button
                                                    onClick={() => handleBuy(activeTab, weapon.tier)}
                                                    disabled={isLocked || actionLoading === `buy-${key}` || !inputQty || availableGold < (parseInt(inputQty) * weapon.cost)}
                                                    className="flex-1 bg-green-100 border border-green-500 text-green-800 text-xs font-bold hover:bg-green-200 disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed"
                                                >
                                                    {actionLoading === `buy-${key}` ? '...' : 'Buy'}
                                                </button>
                                                <button
                                                    onClick={() => initiateSell(activeTab, weapon.tier, weapon.name, weapon.cost)}
                                                    disabled={isLocked || actionLoading === `sell-${key}` || !inputQty || owned < (parseInt(inputQty) || 1)}
                                                    className="px-2 bg-red-100 border border-red-400 text-red-800 text-xs font-bold hover:bg-red-200 disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed"
                                                    title="Sell for 50%"
                                                >
                                                    Sell
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sell Confirmation Modal */}
            {sellModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-[#c0c0c0] border-2 border-white border-r-black border-b-black p-1 shadow-xl w-80">
                        <div className="bg-[#000080] text-white px-2 py-1 font-bold text-xs mb-4 flex justify-between items-center bg-gradient-to-r from-[#000080] to-[#1084d0]">
                            <span>Confirm Sale</span>
                            <button
                                onClick={() => setSellModal(null)}
                                className="w-4 h-4 bg-[#c0c0c0] border border-white border-r-black border-b-black text-black flex items-center justify-center leading-none active:border-r-white active:border-b-white active:border-black"
                            >
                                ×
                            </button>
                        </div>
                        <div className="px-4 pb-4">
                            <div className="flex gap-4 mb-4 items-start">
                                <div className="text-3xl">⚠️</div>
                                <div className="text-sm">
                                    <p className="mb-2">Are you sure you want to sell <strong>{sellModal.qty} x {sellModal.name}</strong>?</p>
                                    <p className="text-gray-700 text-xs">
                                        You will receive <span className="font-bold text-yellow-800">{(sellModal.qty * sellModal.cost * 0.5).toLocaleString()} Gold</span> (50% value).
                                        <br />
                                        <span className="italic text-red-700">Note: Sold items are refunded at 50% of the current database cost.</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setSellModal(null)}
                                    className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeSell}
                                    className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white text-sm font-bold"
                                >
                                    Sell Items
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
