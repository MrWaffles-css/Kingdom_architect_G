import React from 'react';

export default function Header({ currentPage, onNavigate, onLogout, serverTime, user, isAdmin, onOpenAdmin }) {
    const mainPages = ['Overview', 'Battle', 'Reports', 'Mail', 'Alliance', 'Profile'];
    const subPages = ['Kingdom', 'GoldMine', 'Vault', 'Armoury', 'Barracks', 'Library'];
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    const formatTime = (date) => {
        if (!date) return '00:00:00';
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    // Get username from metadata or email
    const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Architect';

    return (
        <header className="sticky top-0 z-50 backdrop-blur-md bg-[#e4d5b7]/95 border-b border-[#8b4513]/20 shadow-md flex flex-col font-serif">
            {/* Top Row: Main Navigation */}
            <div className="w-full px-6 py-3 flex justify-between items-center border-b border-[#8b4513]/5">
                {/* Logo / Title */}
                <div className="flex items-center gap-3 group cursor-pointer" onClick={() => onNavigate('Overview')}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c5a059] to-[#8b4513] shadow-lg shadow-[#8b4513]/20 flex items-center justify-center transform group-hover:scale-105 transition-all duration-300">
                        <span className="text-xl font-bold text-[#fdfbf7]">K</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg font-bold text-[#5c4033] tracking-tight leading-none group-hover:text-[#8b4513] transition-colors">Kingdom Architect</span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-[#8b4513]/60 tracking-wider">
                                {formatTime(serverTime)}
                            </span>
                            <span className="text-[10px] font-bold text-[#c5a059] uppercase tracking-wider">
                                • {username}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Desktop Main Navigation */}
                <nav className="hidden md:flex items-center gap-1">
                    {mainPages.map(page => (
                        <button
                            key={page}
                            onClick={() => onNavigate(page)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 relative overflow-hidden ${currentPage === page
                                ? 'text-[#fdfbf7] shadow-md bg-gradient-to-r from-[#c5a059] to-[#8b4513]'
                                : 'text-[#5c4033]/70 hover:text-[#5c4033] hover:bg-[#8b4513]/5'
                                }`}
                        >
                            <span className="relative z-10">{page}</span>
                        </button>
                    ))}
                </nav>

                {/* User Actions & Mobile Toggle */}
                <div className="flex items-center gap-4">
                    {isAdmin && (
                        <button
                            onClick={onOpenAdmin}
                            className="hidden md:flex px-3 py-1.5 text-xs font-bold text-[#fdfbf7] bg-red-800/80 hover:bg-red-900 rounded-md transition-colors shadow-sm uppercase tracking-wider"
                        >
                            Admin
                        </button>
                    )}
                    <button
                        onClick={onLogout}
                        className="hidden md:flex px-4 py-1.5 text-sm font-medium text-[#8b4513]/80 hover:text-[#8b4513] border border-[#8b4513]/20 rounded-lg hover:bg-[#8b4513]/10 transition-all duration-300 items-center gap-2 group"
                    >
                        <span>Logout</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2 text-[#5c4033] hover:text-[#8b4513] transition-colors"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {isMobileMenuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>
                </div>
            </div>

            {/* Bottom Row: Secondary Navigation */}
            <div className="w-full px-6 py-2 bg-[#8b4513]/10 hidden md:flex justify-center border-b border-[#8b4513]/10">
                <nav className="flex items-center gap-6">
                    {subPages.map(page => (
                        <button
                            key={page}
                            onClick={() => onNavigate(page)}
                            className={`text-xs uppercase tracking-widest font-semibold transition-all duration-300 ${currentPage === page
                                ? 'text-[#8b4513] border-b border-[#8b4513]'
                                : 'text-[#5c4033]/60 hover:text-[#5c4033]'
                                }`}
                        >
                            {page}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMobileMenuOpen && (
                <div className="md:hidden absolute top-full left-0 right-0 bg-[#fdfbf7] border-b border-[#8b4513]/10 shadow-xl animate-fade-in max-h-[80vh] overflow-y-auto">
                    <div className="flex flex-col p-4 gap-2">
                        <div className="text-xs font-bold text-[#8b4513]/60 uppercase tracking-wider mb-1">Main Menu</div>
                        {mainPages.map(page => (
                            <button
                                key={page}
                                onClick={() => {
                                    onNavigate(page);
                                    setIsMobileMenuOpen(false);
                                }}
                                className={`px-4 py-3 rounded-lg text-left text-sm font-medium transition-all duration-200 ${currentPage === page
                                    ? 'bg-[#8b4513]/10 text-[#8b4513] border border-[#8b4513]/20'
                                    : 'text-[#5c4033]/70 hover:bg-[#8b4513]/5 hover:text-[#5c4033]'
                                    }`}
                            >
                                {page}
                            </button>
                        ))}

                        <div className="h-px bg-[#8b4513]/10 my-2" />
                        <div className="text-xs font-bold text-[#8b4513]/60 uppercase tracking-wider mb-1">Kingdom Management</div>

                        {subPages.map(page => (
                            <button
                                key={page}
                                onClick={() => {
                                    onNavigate(page);
                                    setIsMobileMenuOpen(false);
                                }}
                                className={`px-4 py-3 rounded-lg text-left text-sm font-medium transition-all duration-200 ${currentPage === page
                                    ? 'bg-[#8b4513]/10 text-[#8b4513] border border-[#8b4513]/20'
                                    : 'text-[#5c4033]/70 hover:bg-[#8b4513]/5 hover:text-[#5c4033]'
                                    }`}
                            >
                                {page}
                            </button>
                        ))}

                        <div className="h-px bg-[#8b4513]/10 my-2" />

                        {isAdmin && (
                            <button
                                onClick={() => {
                                    onOpenAdmin();
                                    setIsMobileMenuOpen(false);
                                }}
                                className="px-4 py-3 rounded-lg text-left text-sm font-medium text-red-800 hover:bg-red-50 transition-all duration-200 flex items-center gap-2"
                            >
                                Admin Panel
                            </button>
                        )}

                        <button
                            onClick={onLogout}
                            className="px-4 py-3 rounded-lg text-left text-sm font-medium text-[#8b4513]/80 hover:bg-[#8b4513]/10 transition-all duration-200 flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Logout
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
}
