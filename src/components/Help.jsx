import React, { useState } from 'react';

export default function Help() {
    const [openSection, setOpenSection] = useState(null);

    const toggleSection = (section) => {
        setOpenSection(openSection === section ? null : section);
    };

    return (
        <div className="p-4 bg-white min-w-[500px] h-full flex flex-col">
            <h2 className="font-bold text-lg mb-3 border-b-2 border-gray-300 pb-1">❓ Game Guide & Help</h2>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 text-sm">

                {/* Getting Started Section */}
                <div className="border-2 border-gray-400 p-3 bg-gray-50">
                    <h3 className="font-bold mb-2">🚀 Getting Started</h3>
                    <p className="mb-2">Welcome to Kingdom Architect! Your goal is to build the most powerful kingdom through economy, war, and research.</p>
                    <ul className="list-disc list-inside space-y-1 ml-2 text-gray-800">
                        <li><strong>Citizens:</strong> The lifeblood of your kingdom. They generate gold (as miners) or become soldiers.</li>
                        <li><strong>Turns:</strong> Required to attack or spy. You regenerate turns every minute.</li>
                        <li><strong>Gold:</strong> The main currency. Used for buildings, weapons, and training.</li>
                        <li><strong>XP:</strong> Earned from actions. Used for Library research.</li>
                    </ul>
                </div>

                {/* Buildings Section Header */}
                <h3 className="font-bold text-base border-b border-gray-300 pb-1 mt-4">🏛️ Buildings & Features</h3>

                {/* 1. Kingdom */}
                <div className="border border-gray-400">
                    <button
                        onClick={() => toggleSection('kingdom')}
                        className="w-full text-left font-bold bg-gray-200 px-3 py-2 text-sm flex justify-between items-center hover:bg-gray-300"
                    >
                        <span>🏰 The Kingdom</span>
                        <span>{openSection === 'kingdom' ? '▼' : '▶'}</span>
                    </button>
                    {openSection === 'kingdom' && (
                        <div className="p-3 bg-white">
                            <p className="mb-2">Your central command post. Here you can view your population overview and recruit new citizens.</p>
                            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-700 mb-4">
                                <li><strong>Population:</strong> Total count of Citizens + Soldiers.</li>
                                <li><strong>Recruitment:</strong> Spend gold to bring new citizens to your kingdom.</li>
                                <li><strong>Growth:</strong> You need citizens to work in the mines or to train as soldiers.</li>
                            </ul>

                            {/* Kingdom Upgrades Table */}
                            <div className="mb-2">
                                <div className="font-bold bg-gray-700 text-white px-2 py-1 text-xs uppercase mb-1">
                                    📈 Kingdom Upgrades (Levels 1-100)
                                </div>
                                <div className="overflow-y-auto max-h-60 border border-gray-400 p-1 bg-white">
                                    <table className="w-full text-xs text-left relative">
                                        <thead className="bg-gray-200 border-b border-gray-400 font-bold sticky top-0 shadow-sm z-10">
                                            <tr>
                                                <th className="p-1 border-r border-gray-400">Level</th>
                                                <th className="p-1 border-r border-gray-400">Cost (XP)</th>
                                                <th className="p-1">Benefit (Citizens/min)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {Array.from({ length: 100 }).map((_, i) => {
                                                const lvl = i + 1;
                                                const cost = lvl * 100;
                                                const bonus = lvl; // +1 per level total
                                                return (
                                                    <tr key={lvl} className="border-b border-gray-300 hover:bg-yellow-50">
                                                        <td className="p-1 border-r text-center font-bold">{lvl}</td>
                                                        <td className="p-1 border-r">{cost.toLocaleString()} XP</td>
                                                        <td className="p-1 font-bold text-green-700">+{bonus}/min</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Gold Mine */}
                <div className="border border-gray-400 border-t-0">
                    <button
                        onClick={() => toggleSection('goldmine')}
                        className="w-full text-left font-bold bg-gray-200 px-3 py-2 text-sm flex justify-between items-center hover:bg-gray-300"
                    >
                        <span>⛏️ Gold Mine</span>
                        <span>{openSection === 'goldmine' ? '▼' : '▶'}</span>
                    </button>
                    {openSection === 'goldmine' && (
                        <div className="p-3 bg-white">
                            <p className="mb-2">The primary source of income. Citizens working here generate gold every minute.</p>
                            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-700 mb-4">
                                <li><strong>Production:</strong> Gold transmitted directly to your treasury.</li>
                                <li><strong>Upgrades:</strong> New levels increase gold per miner and max miner capacity.</li>
                                <li><strong>Management:</strong> You must hire miners from your citizen pool to maximize output.</li>
                            </ul>

                            {/* Gold Mine Upgrades Table */}
                            <div className="mb-2">
                                <div className="font-bold bg-yellow-600 text-white px-2 py-1 text-xs uppercase mb-1">
                                    💰 Mine Upgrades
                                </div>
                                <div className="overflow-y-auto max-h-60 border border-gray-400 p-1 bg-white">
                                    <table className="w-full text-xs text-left relative">
                                        <thead className="bg-gray-200 border-b border-gray-400 font-bold sticky top-0 shadow-sm z-10">
                                            <tr>
                                                <th className="p-1 border-r border-gray-400">Level</th>
                                                <th className="p-1 border-r border-gray-400">Cost (Gold)</th>
                                                <th className="p-1">Production (Gold/Miner)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {Array.from({ length: 26 }).map((_, i) => {
                                                // Matches gameConfig logic
                                                let cost = 0;
                                                if (i === 0) cost = 1000;
                                                else if (i === 1) cost = 5000;
                                                else if (i === 2) cost = 15000;
                                                else if (i === 3) cost = 45000;
                                                else cost = Math.floor(45000 * Math.pow(3, i - 3));

                                                const rate = 2 + Math.max(0, i - 1);

                                                // For display, level 0 is "Build"
                                                const label = i === 0 ? "Build" : i;

                                                return (
                                                    <tr key={i} className="border-b border-gray-300 hover:bg-yellow-50">
                                                        <td className="p-1 border-r text-center font-bold">{label}</td>
                                                        <td className="p-1 border-r">{cost.toLocaleString()} G</td>
                                                        <td className="p-1 font-bold text-green-700">{rate} g/m</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Barracks */}
                <div className="border border-gray-400 border-t-0">
                    <button
                        onClick={() => toggleSection('barracks')}
                        className="w-full text-left font-bold bg-gray-200 px-3 py-2 text-sm flex justify-between items-center hover:bg-gray-300"
                    >
                        <span>⚔️ Barracks</span>
                        <span>{openSection === 'barracks' ? '▼' : '▶'}</span>
                    </button>
                    {openSection === 'barracks' && (
                        <div className="p-3 bg-white">
                            <p className="mb-2">Train your citizens into specialized military units. Training costs gold.</p>
                            <div className="grid grid-cols-2 gap-4 mt-2 mb-4">
                                <div className="p-2 border bg-gray-50">
                                    <span className="font-bold block text-red-700">Attack Soldiers</span>
                                    <span className="text-xs">Used to invade other lands and steal gold.</span>
                                </div>
                                <div className="p-2 border bg-gray-50">
                                    <span className="font-bold block text-blue-700">Defense Soldiers</span>
                                    <span className="text-xs">Protect your gold from invaders.</span>
                                </div>
                                <div className="p-2 border bg-gray-50">
                                    <span className="font-bold block text-purple-700">Spies</span>
                                    <span className="text-xs">Gather intel on enemy stats and gold.</span>
                                </div>
                                <div className="p-2 border bg-gray-50">
                                    <span className="font-bold block text-orange-700">Sentries</span>
                                    <span className="text-xs">Defend against enemy spies.</span>
                                </div>
                            </div>

                            {/* Barracks Upgrades Table */}
                            <div className="mb-2">
                                <div className="font-bold bg-red-800 text-white px-2 py-1 text-xs uppercase mb-1">
                                    🎖️ Barracks Upgrades
                                </div>
                                <div className="overflow-x-auto border border-gray-400 p-1 bg-white">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-200 border-b border-gray-400 font-bold">
                                            <tr>
                                                <th className="p-1 border-r border-gray-400">Level</th>
                                                <th className="p-1 border-r border-gray-400">Cost (Gold)</th>
                                                <th className="p-1">Stats Per Unit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {/* Matches gameConfig BARRACKS_LEVELS */}
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">1</td><td className="p-1 border-r">0</td><td className="p-1 font-bold">1</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">2</td><td className="p-1 border-r">10,000 G</td><td className="p-1 font-bold">3</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">3</td><td className="p-1 border-r">25,000 G</td><td className="p-1 font-bold">6</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">4</td><td className="p-1 border-r">50,000 G</td><td className="p-1 font-bold">10</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">5</td><td className="p-1 border-r">100,000 G</td><td className="p-1 font-bold">15</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">6</td><td className="p-1 border-r">250,000 G</td><td className="p-1 font-bold">21</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">7</td><td className="p-1 border-r">500,000 G</td><td className="p-1 font-bold">28</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">8</td><td className="p-1 border-r">1,000,000 G</td><td className="p-1 font-bold">36</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">9</td><td className="p-1 border-r">2,500,000 G</td><td className="p-1 font-bold">45</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">10 (MAX)</td><td className="p-1 border-r">5,000,000 G</td><td className="p-1 font-bold">55</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. Armoury */}
                <div className="border border-gray-400 border-t-0">
                    <button
                        onClick={() => toggleSection('armoury')}
                        className="w-full text-left font-bold bg-gray-200 px-3 py-2 text-sm flex justify-between items-center hover:bg-gray-300"
                    >
                        <span>🛡️ Armoury</span>
                        <span>{openSection === 'armoury' ? '▼' : '▶'}</span>
                    </button>
                    {openSection === 'armoury' && (
                        <div className="p-3 bg-white">
                            <p className="mb-2">Soldiers are weak without equipment. Buy weapons here to boost their power stats.</p>
                            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-700">
                                <li><strong>Tiers:</strong> There are 5 tiers of weapons. Higher tiers give massive stat boosts.</li>
                                <li><strong>Research:</strong> You must research "Unlock Better Weapons" in the Library to buy higher tiers.</li>
                                <li><strong>Stats:</strong> Buying weapons instantly updates your Attack/Defense strength.</li>
                            </ul>
                        </div>
                    )}
                </div>

                {/* 5. Battle & Bosses */}
                <div className="border border-gray-400 border-t-0">
                    <button
                        onClick={() => toggleSection('battle')}
                        className="w-full text-left font-bold bg-gray-200 px-3 py-2 text-sm flex justify-between items-center hover:bg-gray-300"
                    >
                        <span>🔥 Battlefield & Bosses</span>
                        <span>{openSection === 'battle' ? '▼' : '▶'}</span>
                    </button>
                    {openSection === 'battle' && (
                        <div className="p-3 bg-white">
                            <p className="mb-2 font-bold">PvP Battlefield:</p>
                            <ul className="list-disc list-inside space-y-1 ml-2 mb-4 text-gray-700">
                                <li><strong>Attacking:</strong> Uses turns. If your Attack &gt; their Defense, you win and steal gold.</li>
                                <li><strong>Spying:</strong> Spy Strength vs Sentry Strength. Success reveals info.</li>
                            </ul>
                            <p className="mb-2 font-bold">PvE Bosses:</p>
                            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-700">
                                <li><strong>Raid Bosses:</strong> Fight powerful AI enemies.</li>
                                <li><strong>Rewards:</strong> Earn massive XP, Gold, and Citizens for defeating them.</li>
                                <li><strong>Progression:</strong> Defeating a boss unlocks the next difficulty.</li>
                            </ul>
                        </div>
                    )}
                </div>

                {/* 6. Vault */}
                <div className="border border-gray-400 border-t-0">
                    <button
                        onClick={() => toggleSection('vault')}
                        className="w-full text-left font-bold bg-gray-200 px-3 py-2 text-sm flex justify-between items-center hover:bg-gray-300"
                    >
                        <span>🔐 Vault</span>
                        <span>{openSection === 'vault' ? '▼' : '▶'}</span>
                    </button>
                    {openSection === 'vault' && (
                        <div className="p-3 bg-white">
                            <p className="mb-2">Your bank. Gold stored here is safe from attackers.</p>
                            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-700">
                                <li><strong>Safety:</strong> Attackers cannot steal gold from the Vault (unless they research Vault Theft!).</li>
                                <li><strong>Usage:</strong> Vault gold can now be used directly for most upgrades without withdrawing.</li>
                                <li><strong>Deposit/Withdraw:</strong> Manage your funds to keep your treasury empty of stealable gold.</li>
                            </ul>
                        </div>
                    )}
                </div>

                {/* 7. Library (With Tables) */}
                <div className="border border-gray-400 border-t-0">
                    <button
                        onClick={() => toggleSection('library')}
                        className="w-full text-left font-bold bg-gray-200 px-3 py-2 text-sm flex justify-between items-center hover:bg-gray-300"
                    >
                        <span>📚 Library (Research Tables)</span>
                        <span>{openSection === 'library' ? '▼' : '▶'}</span>
                    </button>

                    {openSection === 'library' && (
                        <div className="p-3 bg-white">
                            <p className="mb-4">Spend XP here to get permanent account upgrades. Click a category below to see costs.</p>

                            {/* --- NESTED TABLE TOGGLES --- */}

                            {/* Core Stats Table */}
                            <div className="mb-2">
                                <div className="font-bold bg-[#000080] text-white px-2 py-1 text-xs uppercase mb-1">
                                    ⚔️ Attack, Defense, Spy, Sentry (Levels 1-63)
                                </div>
                                <div className="overflow-y-auto max-h-60 border border-gray-400 p-1 bg-white">
                                    <table className="w-full text-xs text-left relative">
                                        <thead className="bg-gray-200 border-b border-gray-400 font-bold sticky top-0 shadow-sm z-10">
                                            <tr>
                                                <th className="p-1 border-r border-gray-400">Level</th>
                                                <th className="p-1 border-r border-gray-400">Cost (XP)</th>
                                                <th className="p-1">Total Bonus</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {(() => {
                                                const costs = [
                                                    300, 340, 385, 435, 490, 550, 620, 700, 790, 890,
                                                    1000, 1130, 1275, 1440, 1625, 1830, 2065, 2330, 2625, 2960,
                                                    3340, 3765, 4245, 4785, 5395, 6080, 6855, 7725, 8710, 9820,
                                                    11070, 12480, 14070, 15860, 17880, 20155, 22720, 25610, 28870, 32545,
                                                    36685, 41350, 46610, 52540, 59225, 66760, 75255, 84830, 95625, 107790,
                                                    121505, 136965, 154390, 174035, 196175, 221135, 249275, 281000, 316750, 357055,
                                                    402490, 453700, 800000
                                                ];
                                                const bonuses = [
                                                    5, 10, 15, 20, 25, 30, 35, 40, 45,
                                                    50, 55, 60, 65, 70, 75, 80, 85, 90, 95,
                                                    100, 110, 120, 130, 140, 150, 160, 170, 180, 190,
                                                    200, 215, 230, 245, 260, 275, 290, 305, 320, 335,
                                                    350, 370, 390, 410, 430, 450, 470, 490, 510, 530,
                                                    550, 575, 600, 625, 650, 675, 700, 730, 760, 790,
                                                    820, 850, 880, 900
                                                ];

                                                return costs.map((cost, index) => (
                                                    <tr key={index} className="border-b border-gray-300 hover:bg-yellow-50">
                                                        <td className="p-1 border-r text-center font-bold">{index + 1}</td>
                                                        <td className="p-1 border-r">{cost.toLocaleString()} XP</td>
                                                        <td className="p-1 font-bold text-green-700">+{bonuses[index]}%</td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Turns Research Table */}
                            <div className="mb-2">
                                <div className="font-bold bg-[#000080] text-white px-2 py-1 text-xs uppercase mb-1">
                                    ⏳ Turns Per Minute
                                </div>
                                <div className="overflow-x-auto border border-gray-400 p-1 bg-white">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-200 border-b border-gray-400 font-bold">
                                            <tr>
                                                <th className="p-1 border-r border-gray-400">Level</th>
                                                <th className="p-1 border-r border-gray-400">Cost (XP)</th>
                                                <th className="p-1">Total Bonus</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">1</td><td className="p-1 border-r">1,000 XP</td><td className="p-1">+1 Turn/min</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">2</td><td className="p-1 border-r">5,000 XP</td><td className="p-1">+2 Turns/min</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">3</td><td className="p-1 border-r">25,000 XP</td><td className="p-1">+3 Turns/min</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">4</td><td className="p-1 border-r">100,000 XP</td><td className="p-1">+4 Turns/min</td></tr>
                                            <tr><td className="p-1 border-r">5 (MAX)</td><td className="p-1 border-r">500,000 XP</td><td className="p-1">+5 Turns/min</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Vault Steal Table */}
                            <div className="mb-2">
                                <div className="font-bold bg-[#000080] text-white px-2 py-1 text-xs uppercase mb-1">
                                    🔐 Steal from Vault %
                                </div>
                                <div className="overflow-x-auto border border-gray-400 p-1 bg-white">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-200 border-b border-gray-400 font-bold">
                                            <tr>
                                                <th className="p-1 border-r border-gray-400">Level</th>
                                                <th className="p-1 border-r border-gray-400">Cost (XP)</th>
                                                <th className="p-1">Effect</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">1</td><td className="p-1 border-r">5,000 XP</td><td className="p-1">Steal 5% from Vault</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">2</td><td className="p-1 border-r">10,000 XP</td><td className="p-1">Steal 10% from Vault</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">3</td><td className="p-1 border-r">15,000 XP</td><td className="p-1">Steal 15% from Vault</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">4</td><td className="p-1 border-r">20,000 XP</td><td className="p-1">Steal 20% from Vault</td></tr>
                                            <tr><td className="p-1 border-r">5 (MAX)</td><td className="p-1 border-r">25,000 XP</td><td className="p-1">Steal 25% from Vault</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Spy Reports Table */}
                            <div className="mb-2">
                                <div className="font-bold bg-[#000080] text-white px-2 py-1 text-xs uppercase mb-1">
                                    🕵️ Unlock Better Spy Reports
                                </div>
                                <div className="overflow-x-auto border border-gray-400 p-1 bg-white">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-200 border-b border-gray-400 font-bold">
                                            <tr>
                                                <th className="p-1 border-r border-gray-400">Level</th>
                                                <th className="p-1 border-r border-gray-400">Cost (XP)</th>
                                                <th className="p-1">Unlocks</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">1</td><td className="p-1 border-r">5,000 XP</td><td className="p-1">Basic Stats</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">2</td><td className="p-1 border-r">10,000 XP</td><td className="p-1">Unit Counts</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">3</td><td className="p-1 border-r">15,000 XP</td><td className="p-1">Weapon Levels</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">4</td><td className="p-1 border-r">20,000 XP</td><td className="p-1">Gold & Resource</td></tr>
                                            <tr><td className="p-1 border-r">5 (MAX)</td><td className="p-1 border-r">25,000 XP</td><td className="p-1">Full Inventory Reveal</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Increase Stolen Gold Table */}
                            <div className="mb-2">
                                <div className="font-bold bg-[#000080] text-white px-2 py-1 text-xs uppercase mb-1">
                                    💰 Increase Stolen Gold %
                                </div>
                                <div className="overflow-x-auto border border-gray-400 p-1 bg-white">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-200 border-b border-gray-400 font-bold">
                                            <tr>
                                                <th className="p-1 border-r border-gray-400">Level</th>
                                                <th className="p-1 border-r border-gray-400">Cost (XP)</th>
                                                <th className="p-1">Total Steal %</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {Array.from({ length: 10 }).map((_, i) => {
                                                const lvl = i + 1;
                                                const cost = 5000 * lvl;
                                                const bonus = 50 + (lvl * 5);
                                                return (
                                                    <tr key={lvl} className="border-b border-gray-300">
                                                        <td className="p-1 border-r">{lvl}</td>
                                                        <td className="p-1 border-r">{cost.toLocaleString()} XP</td>
                                                        <td className="p-1">{bonus}%</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Hostage Conversion Table */}
                            <div className="mb-2">
                                <div className="font-bold bg-[#000080] text-white px-2 py-1 text-xs uppercase mb-1">
                                    ⛓️ Convert Citizens to Hostages
                                </div>
                                <div className="overflow-x-auto border border-gray-400 p-1 bg-white">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-200 border-b border-gray-400 font-bold">
                                            <tr>
                                                <th className="p-1 border-r border-gray-400">Level</th>
                                                <th className="p-1 border-r border-gray-400">Cost (Gold)</th>
                                                <th className="p-1">Conversion Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">1</td><td className="p-1 border-r">100,000 Gold</td><td className="p-1">10%</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">2</td><td className="p-1 border-r">200,000 Gold</td><td className="p-1">20%</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">3</td><td className="p-1 border-r">500,000 Gold</td><td className="p-1">30%</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">4</td><td className="p-1 border-r">750,000 Gold</td><td className="p-1">40%</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">5</td><td className="p-1 border-r">1,000,000 Gold</td><td className="p-1">50%</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">6</td><td className="p-1 border-r">2,000,000 Gold</td><td className="p-1">60%</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">7</td><td className="p-1 border-r">10,000,000 Gold</td><td className="p-1">70%</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">8</td><td className="p-1 border-r">50,000,000 Gold</td><td className="p-1">80%</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">9</td><td className="p-1 border-r">100,000,000 Gold</td><td className="p-1">90%</td></tr>
                                            <tr><td className="p-1 border-r">10 (MAX)</td><td className="p-1 border-r">1,000,000,000 Gold</td><td className="p-1">100%</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Weapon Tech Table */}
                            <div className="mb-2">
                                <div className="font-bold bg-[#000080] text-white px-2 py-1 text-xs uppercase mb-1">
                                    🗡️ Weapon Technology (Unlock Tiers)
                                </div>
                                <div className="overflow-x-auto border border-gray-400 p-1 bg-white">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-200 border-b border-gray-400 font-bold">
                                            <tr>
                                                <th className="p-1 border-r border-gray-400">Level</th>
                                                <th className="p-1 border-r border-gray-400">Cost (Gold)</th>
                                                <th className="p-1">Unlocks</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">1</td><td className="p-1 border-r">100,000 Gold</td><td className="p-1">Tier 1 Weapons</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">2</td><td className="p-1 border-r">300,000 Gold</td><td className="p-1">Tier 2 Weapons</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">3</td><td className="p-1 border-r">900,000 Gold</td><td className="p-1">Tier 3 Weapons</td></tr>
                                            <tr className="border-b border-gray-300"><td className="p-1 border-r">4</td><td className="p-1 border-r">2,700,000 Gold</td><td className="p-1">Tier 4 Weapons</td></tr>
                                            <tr><td className="p-1 border-r">5 (MAX)</td><td className="p-1 border-r">8,100,000 Gold</td><td className="p-1">Tier 5 Weapons</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-2 border-gray-400 p-3 bg-gray-50 mt-4">
                    <h3 className="font-bold mb-2">📞 Need More Help?</h3>
                    <p>
                        Use the in-game chat to ask questions or seek advice from experienced players.
                        The Kingdom Architect community is here to help!
                    </p>
                </div>
            </div>
        </div>
    );
}
