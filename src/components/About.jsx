import React from 'react';

export default function About() {
    return (
        <div className="p-4 bg-white h-full flex flex-col font-sans text-black">
            <h2 className="font-bold text-lg mb-3 border-b-2 border-gray-400 pb-1 flex items-center gap-2">
                <span>ℹ️</span> About Kingdom Architect
            </h2>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6 text-sm">
                {/* Header Banner */}
                <div className="border border-gray-400 p-4 bg-gray-100 text-center shadow-[inset_1px_1px_0px_#fff]">
                    <h1 className="text-2xl font-bold text-[#000080] mb-1">Kingdom Architect</h1>
                    <p className="text-gray-600 font-bold">Version 1.0.0</p>
                    <p className="text-[10px] text-gray-500 mt-2 italic">Building empires since 2026</p>
                </div>

                {/* Introduction */}
                <section className="space-y-2">
                    <h3 className="font-bold text-[#000080] border-b border-gray-300 pb-1">Introduction</h3>
                    <p>
                        Welcome, Commander. <strong>Kingdom Architect</strong> is a deep multiplayer strategy simulation where you must manage your resources, build an army, and compete for dominance in the realm.
                    </p>
                </section>

                {/* Core Resources */}
                <section className="space-y-2">
                    <h3 className="font-bold text-[#000080] border-b border-gray-300 pb-1">Core Resources</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-2 border border-blue-200 bg-blue-50">
                            <strong className="block text-blue-900">💰 Gold</strong>
                            The primary currency for building and training. Earned through citizens, miners, and the Royal Vault.
                        </div>
                        <div className="p-2 border border-green-200 bg-green-50">
                            <strong className="block text-green-900">✨ Experience (XP)</strong>
                            Earned from successful game actions. Required for advanced Research and upgrading your Technology levels.
                        </div>
                        <div className="p-2 border border-amber-200 bg-amber-50">
                            <strong className="block text-amber-900">⚒️ Turns</strong>
                            Required for aggressive actions. You generate base turns over time, which can be increased via Library research.
                        </div>
                        <div className="p-2 border border-purple-200 bg-purple-50">
                            <strong className="block text-purple-900">👥 Citizens</strong>
                            Your population base. Higher Kingdom Levels increase your citizen growth rate automatically.
                        </div>
                    </div>
                </section>

                {/* Infrastructure */}
                <section className="space-y-2">
                    <h3 className="font-bold text-[#000080] border-b border-gray-300 pb-1">Key Infrastructure</h3>
                    <div className="space-y-3">
                        <div className="flex gap-3">
                            <span className="text-2xl">🏰</span>
                            <div>
                                <strong className="block">Kingdom</strong>
                                Upgrade your kingdom to increase your population growth. Higher levels attract more loyal subjects per minute.
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <span className="text-2xl">⛏️</span>
                            <div>
                                <strong className="block">Gold Mine</strong>
                                Employ miners to generate gold. Upgrading the mine increases the efficiency of every miner in your service.
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <span className="text-2xl">🏥</span>
                            <div>
                                <strong className="block">Barracks</strong>
                                Train citizens into specialized military units. Higher levels increase the base strength of all trained units.
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <span className="text-2xl">🏦</span>
                            <div>
                                <strong className="block">Royal Vault</strong>
                                Secure your gold production. The Vault earns interest as a percentage of your current Gold Per Minute (GPM).
                            </div>
                        </div>
                    </div>
                </section>

                {/* Warfare & Bosses */}
                <section className="space-y-2">
                    <h3 className="font-bold text-[#000080] border-b border-gray-300 pb-1">Warfare & Boss Raids</h3>
                    <p>
                        Expand your influence through tactical engagements:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                        <li><strong>PvP Attacks:</strong> Cost 100 turns. Victory lets you seize treasury gold and capture hostages.</li>
                        <li><strong>Spying:</strong> Gather intel on enemy defenses. Successful reports reveal treasure balances and unit counts.</li>
                        <li><strong>Boss Raids:</strong> Challenge unique entities in sequential order. These battles run passively and provide direct rewards in Gold, XP, and Citizens.</li>
                    </ul>
                </section>

                {/* Research */}
                <section className="space-y-2">
                    <h3 className="font-bold text-[#000080] border-b border-gray-300 pb-1">The Royal Library</h3>
                    <p>
                        Invest your XP into four research categories:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 border border-gray-300 bg-gray-50">
                            <strong>📈 Economy</strong>
                            Increase turns per minute and vault raiding efficiency.
                        </div>
                        <div className="p-2 border border-gray-300 bg-gray-50">
                            <strong>⚔️ Military</strong>
                            Unlock tier-based weapons and hostage conversion technologies.
                        </div>
                        <div className="p-2 border border-gray-300 bg-gray-50">
                            <strong>🕵️ Espionage</strong>
                            Enhance the depth of spy reports and reconnaissance.
                        </div>
                        <div className="p-2 border border-gray-300 bg-gray-50">
                            <strong>🧬 Technology</strong>
                            Scale your core Attack, Defense, Spy, and Sentry power.
                        </div>
                    </div>
                </section>

                {/* Tips */}
                <section className="p-3 bg-[#ffffcc] border border-[#e6db55] text-xs">
                    <h4 className="font-bold mb-1">💡 Pro Tips:</h4>
                    <ul className="list-disc list-inside space-y-1">
                        <li>Weapons only provide bonuses if you have enough troops to carry them. Check the <strong>Armoury</strong> details.</li>
                        <li><strong>Hostages</strong> provide a passive bonus to both your Gold income and XP gain.</li>
                        <li>Use the **Vault's** individual spending toggle to choose whether purchases use main gold or vault storage.</li>
                        <li>Bosses must be defeated in order; each victory unlocks a more difficult and rewarding challenge.</li>
                    </ul>
                </section>

                <div className="border-t border-gray-300 pt-4 text-center text-[10px] text-gray-500">
                    <p>© 2026 Kingdom Architect Inc. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
}
