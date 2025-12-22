import React, { useState } from 'react';
import { supabase } from '../supabase';
import GuideArrow from './GuideArrow';
import { calculateMinerGoldRate, GOLD_MINE_LEVELS } from '../gameConfig';

export default function GoldMine({ userStats, onUpdate }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const gold = userStats?.gold || 0;
    const citizens = userStats?.citizens || 0;
    const mineLevel = userStats?.gold_mine_level || 0;
    const miners = userStats?.miners || 0;

    const [trainQty, setTrainQty] = useState('');

    const currentStats = GOLD_MINE_LEVELS.find(l => l.level === mineLevel) || { cost: 0, production_rate: 1 };
    const nextStats = GOLD_MINE_LEVELS.find(l => l.level === mineLevel + 1);

    // Simplified: Flat fee of 2000 Gold per miner
    const calculateTotalCost = (quantity) => {
        if (quantity <= 0) return 0;
        return quantity * 2000;
    };

    // Calculate real max trainable using the fixed cost
    let maxTrainable = 0;
    if (citizens > 0) {
        maxTrainable = Math.floor(gold / 2000);
        // Cap at available citizens
        if (maxTrainable > citizens) maxTrainable = citizens;
    }

    // Cost for next single miner (for display)
    const trainCost = 2000;

    const currentTotalCost = calculateTotalCost(parseInt(trainQty) || 0);

    const handleUpgrade = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('upgrade_gold_mine');
            if (error) throw error;
            if (onUpdate) onUpdate(data);
        } catch (err) {
            console.error('Error upgrading mine:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTrainInput = async () => {
        const qty = parseInt(trainQty) || 1;
        if (qty <= 0) return;

        // Final Client-side check
        const estimatedCost = calculateTotalCost(qty);
        if (gold < estimatedCost) {
            setError(`Not enough gold! Need ${estimatedCost}, have ${gold}`);
            return;
        }

        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('train_miners', { p_quantity: qty });
            if (error) throw error;
            if (onUpdate) onUpdate(data);
            setTrainQty('');
            setError(null);
        } catch (err) {
            console.error('Error training miner:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 font-sans text-black">
            {/* Header */}
            <div className="bg-white p-4 border-2 border-gray-400 border-r-white border-b-white shadow-[inset_1px_1px_0px_0px_#000] flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-xl font-bold mb-1">Royal Gold Mine</h1>
                    <p className="text-sm">Manage your gold production and workforce.</p>
                </div>
                <div className="text-right">
                    <div className="text-xs text-gray-600">Level</div>
                    <div className="text-2xl font-bold font-mono">{mineLevel} <span className="text-sm text-gray-400">/ 25</span></div>
                </div>
            </div>

            <div className="flex gap-4">
                {/* Upgrade Section */}
                <fieldset className="flex-1 border-2 border-white border-l-gray-500 border-t-gray-500 p-4 relative">
                    <legend className="px-1 text-sm font-bold">Infrastructure</legend>

                    {nextStats ? (
                        <>
                            <div className="mb-4">
                                <div className="text-xs font-bold text-gray-600 uppercase mb-1">Upgrade Benefits</div>
                                <div className="bg-gray-100 border border-gray-400 p-2 text-sm grid grid-cols-2 gap-2">
                                    <div>
                                        <div className="text-xs text-gray-500">Gold / Miner</div>
                                        <div className="font-bold">{currentStats.production_rate} → {nextStats.production_rate}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500">Capacity</div>
                                        <div className="font-bold">{(currentStats.production_rate * miners).toLocaleString()} → {(nextStats.production_rate * miners).toLocaleString()} /m</div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleUpgrade}
                                disabled={loading || gold < currentStats.upgrade_cost}
                                className={`w-full py-2 border-2 border-white border-r-black border-b-black font-bold relative ${gold >= currentStats.upgrade_cost ? 'bg-[#c0c0c0] active:border-black active:border-r-white active:border-b-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                            >
                                {mineLevel === 0 ? 'Build Mine' : 'Upgrade Mine'} ({currentStats.upgrade_cost.toLocaleString()} Gold)
                                {userStats?.tutorial_step === 4 && mineLevel === 0 && <GuideArrow direction="down" className="top-[-40px] left-1/2 -translate-x-1/2" />}
                            </button>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-500 font-bold">
                            Max Level Reached
                        </div>
                    )}
                </fieldset>

                {/* Training Section */}
                <fieldset className="flex-1 border-2 border-white border-l-gray-500 border-t-gray-500 p-4 relative">
                    <legend className="px-1 text-sm font-bold">Workforce</legend>

                    {mineLevel === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-75">
                            <div className="text-4xl mb-2">🚧</div>
                            <div className="font-bold text-gray-600 mb-1">Construction Needed</div>
                            <div className="text-xs text-gray-500">Build the gold mine to start training miners.</div>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-sm font-bold">Active Miners</span>
                                    <span className="text-2xl font-mono">{miners.toLocaleString()}</span>
                                </div>
                                <div className="text-xs text-gray-600">
                                    Producing <span className="font-bold text-black">{(miners * currentStats.production_rate).toLocaleString()}</span> gold / minute
                                </div>
                            </div>

                            <div className="bg-gray-100 border border-gray-400 p-2 mb-4">
                                <div className="text-xs font-bold mb-1">Recruitment Cost</div>
                                <div className="flex justify-between text-sm">
                                    <span>1 Citizen + {trainCost} Gold</span>
                                </div>
                            </div>

                            <div className="flex gap-2 mb-2">
                                <input
                                    type="number"
                                    min="1"
                                    max={maxTrainable}
                                    value={trainQty}
                                    onChange={(e) => setTrainQty(e.target.value)}
                                    placeholder="Qty"
                                    className="w-20 px-2 py-1 bg-white border-2 border-gray-500 border-r-white border-b-white shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] outline-none"
                                />
                                <button
                                    onClick={() => setTrainQty(maxTrainable.toString())}
                                    disabled={maxTrainable === 0}
                                    className="px-3 py-1 bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white focus:outline-dotted text-xs font-bold"
                                >
                                    Max
                                </button>
                                <button
                                    onClick={handleTrainInput}
                                    disabled={loading || gold < trainCost || citizens < 1 || (parseInt(trainQty) > maxTrainable)}
                                    className={`flex-1 py-1 border-2 border-white border-r-black border-b-black font-bold relative ${gold >= trainCost && citizens >= 1 ? 'bg-[#c0c0c0] active:border-black active:border-r-white active:border-b-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                                >
                                    Train
                                    {userStats?.tutorial_step === 5 && mineLevel > 0 && miners < 5 && <GuideArrow direction="down" className="top-[-40px] left-1/2 -translate-x-1/2" />}
                                </button>
                            </div>
                            {trainQty > 0 && (
                                <div className="text-xs text-center text-gray-600 mb-2">
                                    Total: {currentTotalCost.toLocaleString()} Gold
                                </div>
                            )}
                            {citizens === 0 && <div className="text-xs text-red-600 mt-1 text-center">No citizens available</div>}
                        </>
                    )}
                </fieldset>
            </div>
            {error && <div className="text-red-600 text-center font-bold mt-2">{error}</div>}
        </div>
    );
}
