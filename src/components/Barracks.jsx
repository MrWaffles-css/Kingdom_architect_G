import React, { useState } from 'react';
import { supabase } from '../supabase';
import { GAME_COSTS, UNIT_STATS } from '../gameConfig';

export default function Barracks({ userStats, onUpdate }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [quantities, setQuantities] = useState({
        attack: '',
        defense: '',
        spy: '',
        sentry: ''
    });

    const UNIT_TYPES = [
        { id: 'attack', name: 'Attack Soldier', icon: '⚔️', description: 'Increases Attack strength.', stat: 'Attack' },
        { id: 'defense', name: 'Defense Soldier', icon: '🛡️', description: 'Increases Defense strength.', stat: 'Defense' },
        { id: 'spy', name: 'Spy', icon: '🕵️', description: 'Increases Spy strength.', stat: 'Spy' },
        { id: 'sentry', name: 'Sentry', icon: '👁️', description: 'Increases Sentry strength.', stat: 'Sentry' }
    ];

    const handleTrain = async (type) => {
        const qty = parseInt(quantities[type]);
        if (!qty || qty <= 0) return;

        setLoading(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const { data, error } = await supabase
                .rpc('train_units', {
                    p_unit_type: type,
                    p_quantity: qty
                });

            if (error) throw error;

            onUpdate(data); // Update parent state with new stats
            setSuccessMsg(`Successfully trained ${qty} ${UNIT_TYPES.find(u => u.id === type).name}(s)!`);
            setQuantities(prev => ({ ...prev, [type]: '' }));
        } catch (err) {
            console.error('Training error:', err);
            setError(err.message || 'Failed to train units');
        } finally {
            setLoading(false);
        }
    };

    const availableGold = userStats.use_vault_gold
        ? (userStats.gold || 0) + (userStats.vault || 0)
        : (userStats.gold || 0);

    const maxTrainable = Math.min(
        userStats.citizens,
        Math.floor(availableGold / GAME_COSTS.TRAIN_SOLDIER)
    );

    return (
        <div className="space-y-4 font-sans text-black">
            {/* Header Info */}
            <div className="flex justify-between items-end border-b-2 border-gray-400 pb-2 mb-4">
                <div>
                    <h1 className="text-xl font-bold">Barracks</h1>
                    <p className="text-sm">Train your citizens into powerful units.</p>
                </div>
                <div className="text-right">
                    <div className="text-xs uppercase font-bold text-gray-600">Available Recruits</div>
                    <div className="text-xl font-bold">{userStats.citizens?.toLocaleString()}</div>
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

            {/* Training Grid */}
            <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-4">
                <legend className="px-1">Unit Training</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {UNIT_TYPES.map((unit) => (
                        <div key={unit.id} className="bg-gray-200 border-2 border-white border-r-gray-500 border-b-gray-500 p-3 flex flex-col">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 border border-gray-500 bg-white flex items-center justify-center text-2xl shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)]">
                                        {unit.icon}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{unit.name}</h3>
                                        <p className="text-xs text-gray-600">{unit.description}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-600 uppercase font-bold">Current</div>
                                    <div className="font-mono font-bold">
                                        {/* Map unit type to state key */}
                                        {(userStats[`${unit.id === 'spy' ? 'spies' : unit.id === 'sentry' ? 'sentries' : unit.id + '_soldiers'}`] || 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto space-y-3">
                                <div className="flex justify-between text-xs font-medium">
                                    <span>Cost: {GAME_COSTS.TRAIN_SOLDIER.toLocaleString()} Gold</span>
                                    <span>+{UNIT_STATS.BASE_STRENGTH} {unit.stat}</span>
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max={maxTrainable}
                                        value={quantities[unit.id]}
                                        onChange={(e) => setQuantities(prev => ({ ...prev, [unit.id]: e.target.value }))}
                                        placeholder="Qty"
                                        className="w-20 px-2 py-1 bg-white border-2 border-gray-500 border-r-white border-b-white shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] outline-none"
                                    />
                                    <button
                                        onClick={() => setQuantities(prev => ({ ...prev, [unit.id]: maxTrainable.toString() }))}
                                        disabled={maxTrainable === 0}
                                        className="px-3 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white focus:outline-dotted text-xs font-bold"
                                    >
                                        Max
                                    </button>
                                    <button
                                        onClick={() => handleTrain(unit.id)}
                                        disabled={loading || !quantities[unit.id] || parseInt(quantities[unit.id]) > maxTrainable || parseInt(quantities[unit.id]) <= 0}
                                        className="flex-1 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white text-black font-bold py-1 px-4 disabled:text-gray-500"
                                    >
                                        {loading ? '...' : 'Train'}
                                    </button>
                                </div>
                                {quantities[unit.id] > 0 && (
                                    <div className="text-xs text-center text-gray-600">
                                        Total: {(quantities[unit.id] * GAME_COSTS.TRAIN_SOLDIER).toLocaleString()} Gold
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </fieldset>

            {/* Hostage Conversion Section */}
            <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-4 bg-gray-100">
                <legend className="px-1 font-bold">Hostages</legend>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex-1 text-center md:text-left">
                        <div className="text-xl font-bold">{userStats.hostages?.toLocaleString() || 0}</div>
                        <p className="text-xs text-gray-600">Captured Enemy Soldiers</p>
                    </div>

                    <div className="flex-1 flex flex-col items-center gap-2">
                        <p className="text-sm font-bold text-gray-800">Convert to Citizens</p>
                        <p className="text-xs text-gray-600 mb-2">Cost: 2,000 Gold per hostage</p>
                        <div className="flex gap-2 w-full justify-center">
                            <button
                                onClick={async () => {
                                    setLoading(true);
                                    setError(null);
                                    setSuccessMsg(null);
                                    try {
                                        const { data, error } = await supabase.rpc('convert_hostages_to_citizens', { p_quantity: 1 });
                                        if (error) throw error;
                                        onUpdate(data);
                                        setSuccessMsg('Converted 1 hostage to citizen!');
                                    } catch (err) {
                                        setError(err.message || 'Conversion failed');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading || !userStats.hostages || userStats.hostages < 1 || availableGold < 2000}
                                className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white text-xs font-bold disabled:text-gray-500"
                            >
                                Convert 1
                            </button>
                            <button
                                onClick={async () => {
                                    if (!userStats.hostages) return;
                                    setLoading(true);
                                    setError(null);
                                    setSuccessMsg(null);
                                    try {
                                        // Calculate max possible conversions based on gold
                                        const maxAffordable = Math.floor(availableGold / 2000);
                                        const qty = Math.min(userStats.hostages, maxAffordable);

                                        if (qty <= 0) throw new Error("Not enough gold to convert any hostages.");

                                        const { data, error } = await supabase.rpc('convert_hostages_to_citizens', { p_quantity: qty });
                                        if (error) throw error;
                                        onUpdate(data);
                                        setSuccessMsg(`Converted ${qty} hostages to citizens!`);
                                    } catch (err) {
                                        setError(err.message || 'Conversion failed');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading || !userStats.hostages || userStats.hostages < 1 || availableGold < 2000}
                                className="px-4 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white text-xs font-bold disabled:text-gray-500"
                            >
                                Convert All
                            </button>
                        </div>
                    </div>
                </div>
            </fieldset>
        </div>
    );
}
