import React from 'react';

const MobileTopBar = ({ stats }) => {
    if (!stats) return null;

    return (
        <div className="fixed top-0 left-0 right-0 h-[2.5rem] bg-[#c0c0c0] border-b-2 border-white flex items-center justify-between px-2 z-50 md:hidden select-none text-xs font-sans shadow-md">

            {/* Rank - Left aligned */}
            <div className="flex items-center gap-1 border-2 border-gray-600 border-b-white border-r-white bg-[#d4d0c8] px-2 py-[2px]" title="Rank">
                <span>🏆</span>
                <span className="font-bold">Rank: {stats.rank || '-'}</span>
            </div>

            {/* Resources - Right aligned / Flex */}
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar ml-2">

                <div className="flex items-center gap-1 whitespace-nowrap" title="Gold">
                    <span>💰</span>
                    <span className="font-mono">{stats.gold?.toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-1 whitespace-nowrap" title="Vault">
                    <span>🏦</span>
                    <span className="font-mono text-gray-600">{stats.vault?.toLocaleString()}</span>
                </div>



                <div className="flex items-center gap-1 whitespace-nowrap" title="Experience">
                    <span>⭐</span>
                    <span className="font-mono text-purple-800">{stats.experience?.toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-1 whitespace-nowrap" title="Turns">
                    <span>⏳</span>
                    <span className="font-mono font-bold">{stats.turns?.toLocaleString()}</span>
                </div>

            </div>
        </div>
    );
};

export default MobileTopBar;
