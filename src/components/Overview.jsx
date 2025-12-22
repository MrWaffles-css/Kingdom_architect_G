import React from 'react';

export default function Overview({ stats }) {
    return (
        <div className="space-y-4 font-sans text-black">
            {/* Valid Windows 98 Header */}
            <div className="bg-white p-4 border-2 border-inset border-gray-400 border-r-white border-b-white shadow-[inset_1px_1px_0px_0px_#000] mb-4">
                <h1 className="text-2xl font-bold mb-2">Welcome back, Architect.</h1>
                <p>Your kingdom awaits your command. The citizens look to you for guidance and prosperity.</p>
            </div>

            {/* Quick Stats Grid */}
            <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-4">
                <legend className="px-1">Kingdom Statistics</legend>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(14em,1fr))] gap-4">
                    {/* Kingdom Level */}
                    <div className="flex items-center gap-3 p-2">
                        <div className="w-10 h-10 flex items-center justify-center text-2xl">
                            🏰
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase font-bold">Kingdom Level</div>
                            <div className="text-xl font-bold">{stats?.kingdom_level || 0}</div>
                        </div>
                    </div>

                    {/* Population */}
                    <div className="flex items-center gap-3 p-2">
                        <div className="w-10 h-10 flex items-center justify-center text-2xl">
                            👥
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase font-bold">Population</div>
                            <div className="text-xl font-bold">{stats?.citizens?.toLocaleString() || 0}</div>
                        </div>
                    </div>

                    {/* Treasury */}
                    <div className="flex items-center gap-3 p-2">
                        <div className="w-10 h-10 flex items-center justify-center text-2xl">
                            💰
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase font-bold">Treasury</div>
                            <div className="text-xl font-bold">{stats?.gold?.toLocaleString() || 0}</div>
                        </div>
                    </div>
                </div>
            </fieldset>

            {/* Military Overview */}
            <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-4">
                <legend className="px-1">Military Strength</legend>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(12em,1fr))] gap-4">
                    {/* Attack */}
                    <div className="flex items-center gap-3 p-2">
                        <div className="w-10 h-10 flex items-center justify-center text-2xl">
                            ⚔️
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase font-bold">Attack</div>
                            <div className="text-xl font-bold">
                                {stats?.attack?.toLocaleString() || 0}
                                {stats?.rank_attack && <span className="text-xs text-gray-500 ml-1">#{stats.rank_attack}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Defense */}
                    <div className="flex items-center gap-3 p-2">
                        <div className="w-10 h-10 flex items-center justify-center text-2xl">
                            🛡️
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase font-bold">Defense</div>
                            <div className="text-xl font-bold">
                                {stats?.defense?.toLocaleString() || 0}
                                {stats?.rank_defense && <span className="text-xs text-gray-500 ml-1">#{stats.rank_defense}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Spy */}
                    <div className="flex items-center gap-3 p-2">
                        <div className="w-10 h-10 flex items-center justify-center text-2xl">
                            🕵️
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase font-bold">Spy</div>
                            <div className="text-xl font-bold">
                                {stats?.spy?.toLocaleString() || 0}
                                {stats?.rank_spy && <span className="text-xs text-gray-500 ml-1">#{stats.rank_spy}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Sentry */}
                    <div className="flex items-center gap-3 p-2">
                        <div className="w-10 h-10 flex items-center justify-center text-2xl">
                            👁️
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase font-bold">Sentry</div>
                            <div className="text-xl font-bold">
                                {stats?.sentry?.toLocaleString() || 0}
                                {stats?.rank_sentry && <span className="text-xs text-gray-500 ml-1">#{stats.rank_sentry}</span>}
                            </div>
                        </div>
                    </div>
                </div>
            </fieldset>

            {/* Recent Activity / Status */}
            <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-4">
                <legend className="px-1">Realm Status</legend>
                <div className="space-y-2 bg-white p-2">
                    <div className="flex items-center gap-2">
                        <span className="text-green-600 font-bold">OK</span>
                        <span>Resource production is optimal.</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-blue-600 font-bold">INFO</span>
                        <span>The citizens are content.</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-bold">NOTE</span>
                        <span>No immediate threats detected.</span>
                    </div>
                </div>
            </fieldset>
        </div>
    );
}
