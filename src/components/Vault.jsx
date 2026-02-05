import React, { useState } from 'react';
import { supabase } from '../supabase';
import { GOLD_RATES, calculateMinerGoldRate } from '../gameConfig';

export default function Vault({ userStats, onUpdate }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [vaultConfig, setVaultConfig] = useState(null);
    const [configLoading, setConfigLoading] = useState(true);

    const user = userStats || {};
    const vaultLevel = user?.vault_level || 0;
    const vaultGold = user?.vault || 0;
    const useVaultGold = user?.use_vault_gold || false;
    const gold = user?.gold || 0;

    const availableGold = useVaultGold
        ? (gold + vaultGold)
        : gold;

    // Fetch vault configuration from database
    React.useEffect(() => {
        const fetchVaultConfig = async () => {
            try {
                setConfigLoading(true);
                const { data, error } = await supabase.rpc('get_vault_config');
                if (error) throw error;
                setVaultConfig(data);
            } catch (err) {
                console.error('Error fetching vault config:', err);
                // Fallback to hardcoded values if fetch fails
                setVaultConfig(null);
            } finally {
                setConfigLoading(false);
            }
        };

        fetchVaultConfig();
    }, []);

    // Level Data - now uses database config
    const getLevelData = (level) => {
        if (level === 0) return { cost: 0, interest: 0, capacity: 0 };

        // Use database config if available
        if (vaultConfig?.levels) {
            const levelConfig = vaultConfig.levels.find(l => l.level === level);
            if (levelConfig) {
                return {
                    cost: levelConfig.upgrade_cost,
                    interest: levelConfig.interest_rate / 100, // Convert percentage to decimal
                    capacity: levelConfig.capacity
                };
            }
            // If level not found, use max level config
            const maxLevel = vaultConfig.levels[vaultConfig.levels.length - 1];
            if (maxLevel && level >= maxLevel.level) {
                return {
                    cost: maxLevel.upgrade_cost,
                    interest: maxLevel.interest_rate / 100,
                    capacity: maxLevel.capacity
                };
            }
        }

        // Fallback to hardcoded values if config not available
        if (level === 1) return { cost: 5000, interest: 0.05, capacity: 200000 };
        if (level === 2) return { cost: 100000, interest: 0.10, capacity: 300000 };
        if (level === 3) return { cost: 1000000, interest: 0.15, capacity: 1500000 };
        if (level === 4) return { cost: 4000000, interest: 0.20, capacity: 5000000 };
        if (level === 5) return { cost: 8000000, interest: 0.25, capacity: 15000000 };
        if (level === 6) return { cost: 20000000, interest: 0.30, capacity: 50000000 };
        if (level === 7) return { cost: 75000000, interest: 0.35, capacity: 150000000 };
        if (level === 8) return { cost: 200000000, interest: 0.40, capacity: 500000000 };
        if (level === 9) return { cost: 1000000000, interest: 0.45, capacity: 1500000000 };
        if (level >= 10) return { cost: 5000000000, interest: 0.50, capacity: 5000000000 };
        return { cost: null, interest: 0, capacity: 0 };
    };

    const currentStats = getLevelData(vaultLevel);
    const nextStats = getLevelData(vaultLevel + 1);

    // Calculate Gold Production for Interest Estimate
    const untrainedGold = Math.floor((user?.citizens || 0) * GOLD_RATES.CITIZEN_BASE);
    const trainedCount = (user?.attack_soldiers || 0) + (user?.defense_soldiers || 0) + (user?.spies || 0) + (user?.sentries || 0);
    const trainedGold = Math.floor(trainedCount * GOLD_RATES.TRAINED_UNIT);
    const minerRate = calculateMinerGoldRate(user?.gold_mine_level);
    const minerGold = (user?.miners || 0) * minerRate;
    const totalGoldProduction = untrainedGold + trainedGold + minerGold;
    const estimatedInterest = Math.floor(totalGoldProduction * currentStats.interest);

    const handleUpgrade = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error } = await supabase.rpc('upgrade_vault');

            if (error) throw error;

            if (onUpdate) onUpdate(data);
        } catch (err) {
            console.error('Error upgrading vault:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Local state for optimistic UI updates to prevent flickering
    const [optimisticSpending, setOptimisticSpending] = useState(null);
    const effectiveSpending = optimisticSpending !== null ? optimisticSpending : useVaultGold;

    const handleToggleSpending = async () => {
        if (loading) return;

        const newValue = !effectiveSpending;

        // set local optimistic state immediately
        setOptimisticSpending(newValue);
        // Do NOT call onUpdate here, as it triggers a refetch in Desktop.jsx 
        // which would fetch the OLD value from DB before our RPC completes.

        try {
            const { data, error } = await supabase.rpc('toggle_vault_spending', { p_enable: newValue });

            if (error) throw error;

            // RPC successful, now we can update the parent state
            if (onUpdate) onUpdate(data);

            // Success - clear optimistic state
            setOptimisticSpending(null);
        } catch (err) {
            console.error('Error toggling vault spending:', err);
            // Revert local state on error
            setOptimisticSpending(null);
            setError('Failed to update preference: ' + err.message);
        }
    };

    const formatNumber = (num) => {
        return new Intl.NumberFormat('en-US').format(num);
    };

    if (vaultLevel === 0) {
        return (
            <div className="space-y-4 font-sans text-black">
                <div className="bg-white p-4 border-2 border-gray-400 text-center">
                    <div className="text-4xl mb-2">🏦</div>
                    <h1 className="text-2xl font-bold mb-2">The Royal Vault</h1>
                    <p className="mb-4 max-w-md mx-auto">
                        Construct a secure vault to store your gold and earn interest.
                        Gold in the vault is protected from attacks (for now) and earns 5% interest per minute.
                    </p>

                    <div className="bg-gray-100 p-2 border border-gray-400 inline-block mb-4">
                        <div className="text-xs uppercase font-bold mb-1">Construction Cost</div>
                        <div className="text-lg font-bold">{formatNumber(5000)} Gold</div>
                    </div>

                    <div>
                        <button
                            onClick={handleUpgrade}
                            disabled={loading || availableGold < 5000}
                            className={`px-4 py-1 border-2 border-white border-r-gray-800 border-b-gray-800 bg-[#c0c0c0] active:border-gray-800 active:border-r-white active:border-b-white font-bold ${availableGold < 5000 ? 'text-gray-500' : 'text-black'}`}
                        >
                            {loading ? 'Constructing...' : 'Construct Vault'}
                        </button>
                    </div>
                    {error && <div className="mt-2 text-red-600">{error}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 font-sans text-black">
            {/* Header */}
            {/* Header */}
            <div className="bg-white border-2 border-gray-400 border-r-white border-b-white shadow-[inset_1px_1px_0px_0px_#000] mb-4">
                <img
                    src="/images/vault-banner.png"
                    alt="The Royal Vault"
                    className="w-full h-48 object-cover object-center border-b-2 border-gray-400"
                    style={{ imageRendering: 'pixelated' }}
                />
                <div className="p-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold mb-1">The Royal Vault</h1>
                        <p className="text-sm">Secure storage and treasury management.</p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-gray-600">Vault Balance</div>
                        <div className="text-2xl font-bold font-mono">{formatNumber(vaultGold)}</div>
                        <div className="text-xs text-gray-500 mt-1">
                            Capacity: {formatNumber(currentStats.capacity)}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(15em,1fr))] gap-4">
                {/* Stats & Settings */}
                <div className="space-y-4">
                    {/* Status Card */}
                    <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-4">
                        <legend className="px-1">Vault Status</legend>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span>Interest Rate</span>
                                <span className="font-bold">{(currentStats.interest * 100).toFixed(0)}% / min</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span>Estimated Interest</span>
                                <span className="font-bold">+{formatNumber(estimatedInterest)} Gold / min</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span>Storage Capacity</span>
                                <span className="font-bold">{formatNumber(currentStats.capacity)} Gold</span>
                            </div>
                            <div>
                                <div className="flex justify-between items-center text-sm mb-1">
                                    <span>Fill Level</span>
                                    <span className="font-bold text-xs">
                                        {((vaultGold / currentStats.capacity) * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <div className="h-4 border-2 border-gray-600 border-r-white border-b-white bg-white relative">
                                    <div
                                        className="h-full bg-[#000080]"
                                        style={{ width: `${Math.min(100, (vaultGold / currentStats.capacity) * 100)}%` }}
                                    ></div>
                                </div>
                                {(() => {
                                    const remaining = currentStats.capacity - vaultGold;
                                    if (remaining <= 0 || estimatedInterest <= 0) return null;
                                    const minutesToFull = Math.ceil(remaining / estimatedInterest);
                                    const hours = Math.floor(minutesToFull / 60);
                                    const minutes = minutesToFull % 60;
                                    const days = Math.floor(hours / 24);
                                    const remainingHours = hours % 24;

                                    let timeString = '';
                                    if (days > 0) timeString += `${days}d `;
                                    if (remainingHours > 0 || days > 0) timeString += `${remainingHours}h `;
                                    timeString += `${minutes}m`;

                                    return (
                                        <div className="text-xs text-gray-500 mt-1 text-right">
                                            Time to full: {timeString}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </fieldset>

                    {/* Settings Card */}
                    <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-4">
                        <legend className="px-1">Treasury Settings</legend>

                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <div className="font-bold text-sm mb-1">Spending Source</div>
                                <div className="text-xs text-gray-500">
                                    {effectiveSpending ? 'Using Vault Storage' : 'Using Main Treasury'}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${!effectiveSpending ? "text-black" : "text-gray-400"}`}>Main</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="1"
                                    value={effectiveSpending ? "1" : "0"}
                                    onChange={(e) => handleToggleSpending(e.target.value === "1")}
                                    className="w-12 h-4 bg-gray-200 appearane-none cursor-pointer border border-gray-600 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)]"
                                    style={{
                                        accentColor: '#000080'
                                    }}
                                />
                                <span className={`text-xs font-bold ${effectiveSpending ? "text-black" : "text-gray-400"}`}>Vault</span>
                            </div>
                        </div>
                    </fieldset>
                </div>

                {/* Upgrade Card */}
                <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-4 flex flex-col">
                    <legend className="px-1">Vault Upgrade</legend>

                    {vaultLevel >= 10 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-500">
                            <div className="text-3xl mb-2">⭐</div>
                            <div className="font-bold">Maximum Level Reached</div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col">
                            <div className="flex-1 space-y-4 mb-4">
                                <div className="bg-gray-100 border border-gray-400 p-2">
                                    <div className="text-xs text-gray-600 uppercase font-bold mb-1">Next Level Benefits</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <div className="text-xs text-gray-500">Interest</div>
                                            <div className="font-bold text-sm">
                                                {(currentStats.interest * 100).toFixed(0)}% → {(nextStats.interest * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500">Capacity</div>
                                            <div className="font-bold text-sm">
                                                {formatNumber(nextStats.capacity)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-gray-400 pt-4">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-sm">Upgrade Cost:</span>
                                    <span className={`font-bold ${availableGold >= nextStats.cost ? 'text-black' : 'text-red-600'}`}>
                                        {formatNumber(nextStats.cost)} Gold
                                    </span>
                                </div>
                                <button
                                    onClick={handleUpgrade}
                                    disabled={loading || availableGold < nextStats.cost}
                                    className={`w-full py-1 border-2 border-white border-r-gray-800 border-b-gray-800 bg-[#c0c0c0] active:border-gray-800 active:border-r-white active:border-b-white font-bold ${availableGold < nextStats.cost ? 'text-gray-500' : 'text-black'}`}
                                >
                                    {loading ? 'Upgrading...' : `Upgrade to Level ${vaultLevel + 1}`}
                                </button>
                                {error && <div className="mt-2 text-center text-xs text-red-600">{error}</div>}
                            </div>
                        </div>
                    )}
                </fieldset>
            </div>
        </div>
    );
}
