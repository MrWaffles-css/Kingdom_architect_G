import React from 'react';
import GuideArrow from './GuideArrow';
import { KINGDOM_LEVELS, calculateGoldPerMinute, calculateMinerGoldRate, calculateCitizensPerMinute } from '../gameConfig';

export default function Kingdom({ kingdomLevel, citizens, experience, onBuild, onUpgrade, userStats, onNavigate }) {
    const formatNumber = (num) => new Intl.NumberFormat('en-US').format(Math.floor(num));

    // Helper to get level config safely
    const getLevelConfig = (level) => KINGDOM_LEVELS.find(l => l.level === level) || { cost: 999, description: 'Unknown' };

    return (
        <div className="w-full font-sans text-black p-2 animate-fade-in">
            {/* Header Banner */}
            <div className="bg-white p-4 border-2 border-gray-400 border-r-white border-b-white shadow-[inset_1px_1px_0px_0px_#000] mb-4 text-center">
                <h2 className="text-2xl font-bold mb-1">
                    {kingdomLevel === 0 ? 'Unclaimed Land' : `Kingdom Level ${kingdomLevel}`}
                </h2>
                <div className="w-full h-px bg-gray-400 my-2"></div>
                <p className="text-sm">
                    {kingdomLevel === 0
                        ? "Establish your kingdom to begin gathering citizens."
                        : `Managing the ${kingdomLevel === 0 ? 'Land' : 'Kingdom'} of ${userStats?.username || 'Architect'}`}
                </p>
            </div>

            {/* Core Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2 text-center bg-gray-100">
                    <legend className="px-1 text-xs">Citizens</legend>
                    <div className="text-2xl font-bold">{formatNumber(citizens)}</div>
                    <div className="text-xs text-gray-600 mt-1">
                        +{calculateCitizensPerMinute(kingdomLevel)} per minute
                    </div>
                </fieldset>
                <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2 text-center bg-gray-100">
                    <legend className="px-1 text-xs">Gold Generation</legend>
                    <div className="text-2xl font-bold">
                        {formatNumber(calculateGoldPerMinute(userStats))}/m
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1 text-center">
                        Cit: {formatNumber(userStats?.citizens || 0)} | Mil: {formatNumber(((userStats?.attack_soldiers || 0) + (userStats?.defense_soldiers || 0) + (userStats?.spies || 0) + (userStats?.sentries || 0)) * 0.5)} | Min: {formatNumber((userStats?.miners || 0) * calculateMinerGoldRate(userStats?.gold_mine_level))}
                    </div>
                </fieldset>
            </div>

            {/* Dynamic Upgrade Section */}
            {kingdomLevel < 100 ? (
                <div className="text-center bg-gray-100 p-4 border border-gray-400 mb-4">
                    <p className="text-black mb-4 mx-auto max-w-md">
                        {kingdomLevel === 0
                            ? "This land is fertile and ready for a new ruler. Establish your kingdom to begin gathering citizens and wealth."
                            : "Your kingdom is growing. Upgrade to attract more citizens and increase your influence."}
                    </p>
                    <button
                        onClick={kingdomLevel === 0 ? onBuild : onUpgrade}
                        disabled={experience < getLevelConfig(kingdomLevel + 1).cost}
                        className={`px-6 py-2 border-2 border-white border-r-gray-700 border-b-gray-700 active:border-gray-700 active:border-r-white active:border-b-white text-base font-bold ${experience >= getLevelConfig(kingdomLevel + 1).cost
                            ? 'bg-[#c0c0c0] text-black'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {getLevelConfig(kingdomLevel + 1).description} ({getLevelConfig(kingdomLevel + 1).cost.toLocaleString()} EXP)
                        {userStats?.tutorial_step === 3 && <GuideArrow direction="right" className="left-[-50px] top-2" />}
                    </button>
                </div>
            ) : (
                <div className="text-center bg-gray-100 p-4 border border-gray-400 mb-4">
                    <p className="text-black mb-4 max-w-md mx-auto">
                        You have reached the pinnacle of power. Your kingdom is legendary.
                    </p>
                    <button
                        disabled
                        className="px-6 py-2 bg-gray-200 border border-gray-400 text-gray-500 cursor-not-allowed"
                    >
                        Max Level Reached
                    </button>
                </div>
            )}

            {/* Population Breakdown */}
            <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2 mb-4">
                <legend className="px-1 text-xs font-bold flex items-center gap-1"><span>👥</span> Population</legend>
                <div className="space-y-1">
                    {/* Citizens */}
                    <div className="bg-white p-1 border border-gray-400 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="text-sm">👤</div>
                            <div>
                                <div className="text-[11px] font-bold">Citizens <span className="font-normal text-gray-500">(1g/m)</span></div>
                            </div>
                        </div>
                        <div className="text-sm font-bold">{formatNumber(userStats?.citizens || 0)}</div>
                    </div>

                    {/* Miners */}
                    <div className="bg-white p-1 border border-gray-400 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="text-sm">⛏️</div>
                            <div>
                                <div className="text-[11px] font-bold">Miners <span className="font-normal text-gray-500">({calculateMinerGoldRate(userStats?.gold_mine_level)}g/m)</span></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="text-sm font-bold">{formatNumber(userStats?.miners || 0)}</div>
                            <button
                                onClick={() => onNavigate && onNavigate('GoldMine')}
                                className="px-1.5 py-0.5 text-[9px] bg-[#c0c0c0] border border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white font-bold"
                            >
                                Train
                            </button>
                        </div>
                    </div>

                    {/* Attack Soldiers */}
                    <div className="bg-white p-1 border border-gray-400 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="text-sm">⚔️</div>
                            <div>
                                <div className="text-[11px] font-bold">Attack <span className="font-normal text-gray-500">(0.5g/m)</span></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="text-sm font-bold text-red-900">{formatNumber(userStats?.attack_soldiers || 0)}</div>
                            <button
                                onClick={() => onNavigate && onNavigate('Barracks')}
                                className="px-1.5 py-0.5 text-[9px] bg-[#c0c0c0] border border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white font-bold"
                            >
                                Train
                            </button>
                        </div>
                    </div>

                    {/* Defense Soldiers */}
                    <div className="bg-white p-1 border border-gray-400 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="text-sm">🛡️</div>
                            <div>
                                <div className="text-[11px] font-bold">Defense <span className="font-normal text-gray-500">(0.5g/m)</span></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="text-sm font-bold text-blue-900">{formatNumber(userStats?.defense_soldiers || 0)}</div>
                            <button
                                onClick={() => onNavigate && onNavigate('Barracks')}
                                className="px-1.5 py-0.5 text-[9px] bg-[#c0c0c0] border border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white font-bold"
                            >
                                Train
                            </button>
                        </div>
                    </div>

                    {/* Spies */}
                    <div className="bg-white p-1 border border-gray-400 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="text-sm">🕵️</div>
                            <div>
                                <div className="text-[11px] font-bold">Spies <span className="font-normal text-gray-500">(0.5g/m)</span></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="text-sm font-bold text-purple-900">{formatNumber(userStats?.spies || 0)}</div>
                            <button
                                onClick={() => onNavigate && onNavigate('Barracks')}
                                className="px-1.5 py-0.5 text-[9px] bg-[#c0c0c0] border border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white font-bold"
                            >
                                Train
                            </button>
                        </div>
                    </div>

                    {/* Sentries */}
                    <div className="bg-white p-1 border border-gray-400 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="text-sm">👁️</div>
                            <div>
                                <div className="text-[11px] font-bold">Sentries <span className="font-normal text-gray-500">(0.5g/m)</span></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="text-sm font-bold text-green-900">{formatNumber(userStats?.sentries || 0)}</div>
                            <button
                                onClick={() => onNavigate && onNavigate('Barracks')}
                                className="px-1.5 py-0.5 text-[9px] bg-[#c0c0c0] border border-white border-r-gray-800 border-b-gray-800 active:border-gray-800 active:border-r-white active:border-b-white font-bold"
                            >
                                Train
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-2 pt-2 border-t border-gray-300 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-700">Total:</span>
                    <span className="text-base font-bold text-black">
                        {formatNumber(
                            (userStats?.citizens || 0) +
                            (userStats?.miners || 0) +
                            (userStats?.attack_soldiers || 0) +
                            (userStats?.defense_soldiers || 0) +
                            (userStats?.spies || 0) +
                            (userStats?.sentries || 0)
                        )}
                    </span>
                </div>
            </fieldset>
        </div>
    );
}
