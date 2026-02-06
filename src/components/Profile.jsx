import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { avatars, getAvatarPath } from '../config/avatars';

// Helper component for Spy Level Visibility
const SpyCheck = ({ level, required, children, fallback = '???' }) => {
    if (level >= required) return children;
    return <span className="text-gray-500 font-mono tracking-widest text-[#000080]" title={`Requires Spy Level ${required}`}>{fallback}</span>;
};

export default function Profile({ userId, isOwnProfile, session, onNavigate, onAction, stats: liveStats, initialTab = 'empire', onTitleChange, updateTrigger }) {
    const [profileData, setProfileData] = useState(null);
    const [currentUserStats, setCurrentUserStats] = useState(null);
    const [spyReport, setSpyReport] = useState(null);
    const [spyFailure, setSpyFailure] = useState(null);
    const [attackResult, setAttackResult] = useState(null);

    const [battleHistory, setBattleHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

    // Reset state when target changes to prevent stale data
    useEffect(() => {
        setProfileData(null);
        setSpyReport(null);
        setSpyFailure(null);
        setBattleHistory([]);

    }, [userId]);

    const targetUserId = userId || session?.user?.id;
    const viewingOwnProfile = !userId || userId === session?.user?.id;

    // Determine the data source for stats
    // Own Profile: liveStats directly
    // Other Profile: spyReport (snapshot) -> fallback to profileData (e.g. public rank/xp)
    const statsSource = viewingOwnProfile ? liveStats : { ...(profileData || {}), ...(spyReport || {}) };

    // Determine Viewer's Spy Level
    // Own Profile: Level 5 (Max)
    // Other Profile: currentUserStats.research_spy_report (or 0)
    // IMPORTANT: If NO successful spy report exists, effectively Level -1 (can't see anything private) unless we want to show ???
    // But the user said "If they successfully spy, they can see ...". So we check if spyReport exists.
    const hasReport = viewingOwnProfile || !!spyReport;
    const viewerSpyLevel = viewingOwnProfile
        ? 5
        : (hasReport ? (currentUserStats?.research_spy_report || 0) : -1);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        if (targetUserId) {
            fetchData();
        }
    }, [targetUserId, updateTrigger]);

    // Lazy Load Data based on Active Tab
    useEffect(() => {
        if (!targetUserId) return;

        if (activeTab === 'empire' && !viewingOwnProfile && !spyReport) {
            fetchSpyReport();
            fetchCurrentUserStats(); // Need this for spy level check
        }
        if (activeTab === 'military' && !viewingOwnProfile && !spyReport) {
            fetchSpyReport();
        }

        // Battle History is usually at the bottom or in a specific tab, 
        // asking the user if they want to see it or lazy loading it might be better?
        // For now, let's load it if we are on the 'military' tab or maybe a new 'history' tab?
        // The original code didn't have a history tab shown in the render tabs list clearly above, 
        // but let's assume it might be needed for context. 
        // Use 'military' for history for now as it relates to battles.
        if (activeTab === 'military' && battleHistory.length === 0 && !viewingOwnProfile) {
            fetchBattleHistory();
        }
    }, [activeTab, targetUserId]);


    const [notification, setNotification] = useState(null);

    // Auto-clear notification
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const fetchData = async (isManualRefresh = false) => {
        setLoading(true);
        try {
            // ONLY fetch core profile data initially.
            await fetchProfileData();

            if (isManualRefresh) {
                setNotification({ type: 'info', message: 'Profile data reloaded.' });
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchProfileData = async () => {
        try {
            // Prepared Promises
            // SECURITY FIX: Only fetch full user_stats for OWN profile. 
            // For others, rely on Leaderboard (public) + Spy Report (private status).
            const statsPromise = viewingOwnProfile
                ? supabase.from('user_stats').select('*').eq('id', targetUserId).single()
                : Promise.resolve({ data: {} });

            const rankPromise = supabase.from('leaderboard').select('*').eq('id', targetUserId).single();

            // Profile Fetch with fallback logic for robustness
            const profilePromise = (async () => {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('username, created_at, avatar_id, alliance_id')
                    .eq('id', targetUserId)
                    .single();

                if (error || !data) {
                    // Fallback retry without new columns if needed
                    const { data: fallback } = await supabase
                        .from('profiles')
                        .select('username, created_at')
                        .eq('id', targetUserId)
                        .single();
                    return fallback;
                }
                return data;
            })();

            // Execute parallel fetch
            const [statsResult, rankResult, profile] = await Promise.all([
                statsPromise,
                rankPromise,
                profilePromise
            ]);

            const stats = statsResult.data;
            const rankData = rankResult.data;

            // Fetch Alliance Name if applicable
            let allianceName = 'None';
            if (profile?.alliance_id) {
                const { data: alliance } = await supabase
                    .from('alliances')
                    .select('name')
                    .eq('id', profile.alliance_id)
                    .single();
                if (alliance) allianceName = alliance.name;
            }

            setProfileData({
                ...stats,
                ...rankData,
                username: profile?.username || 'Unknown Player',
                created_at: profile?.created_at,
                avatar_id: profile?.avatar_id,
                alliance: allianceName
            });

            if (onTitleChange && profile?.username) {
                onTitleChange(profile.username);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    const handleAvatarUpdate = async (avatarId) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ avatar_id: avatarId })
                .eq('id', session.user.id);

            if (error) throw error;

            // Optimistic update
            setProfileData(prev => ({ ...prev, avatar_id: avatarId }));
            setNotification({ type: 'success', message: 'Avatar updated!' });
            setIsAvatarModalOpen(false);
            if (onAction) onAction(); // Trigger refresh elsewhere if needed
        } catch (error) {
            console.error('Error updating avatar:', error);
            setNotification({ type: 'error', message: 'Failed to update avatar' });
        }
    };

    const fetchCurrentUserStats = async () => {
        try {
            const { data } = await supabase.from('user_stats').select('spy, research_spy_report').eq('id', session.user.id).single();
            setCurrentUserStats(data);
        } catch (error) { console.error(error); }
    };

    const fetchSpyReport = async () => {
        try {
            // 1. Get MY official spy reports
            const { data: myReports } = await supabase
                .from('spy_reports')
                .select('*')
                .eq('attacker_id', session.user.id)
                .eq('defender_id', targetUserId)
                .order('created_at', { ascending: false })
                .limit(1);

            // 2. Get updates from Alliance (Shared Intel)
            // This returns reports from ANYONE in my alliance (could include me, but filtered in RPC usually)
            const { data: sharedReports } = await supabase.rpc('get_shared_spy_reports', { p_target_id: targetUserId });

            // 3. Compare and find the newest relevant report
            let bestReport = null;
            let reportSource = 'none'; // 'me', 'alliance', 'passive'

            // Check my report
            if (myReports && myReports.length > 0) {
                bestReport = myReports[0];
                reportSource = 'me';
            }

            // Check alliance reports
            if (sharedReports && sharedReports.length > 0) {
                // sharedReports[0] is the newest because RPC orders by desc
                const newestShared = sharedReports[0];

                // Parse the inner data if it's JSON string, or used directly if jsonb
                // RPC returns 'data' column as jsonb. 
                // We need to shape it like a spy_report. 
                // The RPC return structure is { id, attacker_id, attacker_name, created_at, hours_old, data }
                // 'data' is the spy_report row content.

                const sharedDate = new Date(newestShared.created_at);
                const myDate = bestReport ? new Date(bestReport.created_at) : new Date(0);

                if (sharedDate > myDate) {
                    // Alliance report is newer!
                    bestReport = {
                        ...newestShared.data, // The raw spy report data
                        id: newestShared.id,
                        attacker_name: newestShared.attacker_name,
                        created_at: newestShared.created_at,
                        is_shared: true,
                        shared_by: newestShared.attacker_name
                    };
                    reportSource = 'alliance';
                }
            }

            // Calculate hours old
            if (bestReport) {
                const created = new Date(bestReport.created_at);
                bestReport.hours_old = (new Date() - created) / (1000 * 60 * 60);
            }

            setSpyReport(bestReport);

        } catch (error) { console.error('fetchSpyReport error:', error); }
    };

    const fetchBattleHistory = async () => {
        try {
            const { data: battles } = await supabase.rpc('get_battle_history', { target_id: targetUserId, limit_count: 10 });

            // Get Alliance Spy Logs for History
            const { data: sharedReports } = await supabase.rpc('get_shared_spy_reports', { p_target_id: targetUserId });

            let spyLogs = [];
            if (sharedReports) {
                spyLogs = sharedReports.map(s => ({
                    id: s.id,
                    created_at: s.created_at,
                    attacker_name: s.attacker_id === session.user.id ? 'You' : s.attacker_name, // Should match RPC output
                    defender_name: profileData?.username || 'Target',
                    success: true,
                    is_spy: true,
                    is_shared: s.attacker_id !== session.user.id,
                    attacker_id: s.attacker_id
                }));
            }

            const combined = [...(battles || []), ...spyLogs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setBattleHistory(combined);
        } catch (error) { console.error(error); }
    };



    const handleSpy = async () => {
        setActionLoading(true);
        setSpyFailure(null);
        try {
            const { data, error } = await supabase.rpc('spy_player', { target_id: targetUserId });
            if (error) throw error;
            if (data.success) {
                await fetchCurrentUserStats();

                // Use returned data directly to avoid fetch latency/race conditions
                if (data.data) {
                    const newReport = {
                        ...data.data,
                        created_at: new Date().toISOString(),
                        hours_old: 0,
                        is_passive: false,
                        is_shared: false
                    };
                    setSpyReport(newReport);
                } else {
                    // Fallback if data not returned for some reason
                    await fetchSpyReport();
                }

                if (onAction) onAction();
                setNotification({ type: 'success', message: 'Spy Successful! Data updated.' });
            } else {
                setSpyFailure(data.message);
                setNotification({ type: 'error', message: 'Spy Failed!' });
            }
        } catch (err) {
            setSpyFailure('Spy failed: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAttack = async () => {
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('attack_player', { target_id: targetUserId });
            if (error) throw error;
            setAttackResult({
                success: data.success,
                message: data.message,
                gold_stolen: data.gold_stolen,
                casualties: data.casualties,
                opponent: profileData?.username
            });
            await fetchBattleHistory();
            await fetchProfileData();
            if (onAction) onAction();
            setNotification({ type: 'warning', message: 'Attack complete. Spy Report may now be old.' });
        } catch (err) {
            alert('Attack failed: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const formatNumber = (num) => new Intl.NumberFormat('en-US').format(num || 0);

    const accountAge = profileData?.created_at
        ? Math.floor((Date.now() - new Date(profileData.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    // -------------- RENDERERS --------------

    // 0. GENERAL TAB
    const renderGeneralTab = () => {
        const s = statsSource || {};
        const lvl = viewerSpyLevel;
        return (
            <div className="space-y-4">
                <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2">
                    <legend className="px-1 text-sm font-bold">Kingdom Resources</legend>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-white p-2 border border-gray-400">
                            <div className="text-xs text-gray-500 uppercase font-bold">Gold</div>
                            <div className="text-lg font-bold flex items-center gap-2">
                                <span>💰</span>
                                <SpyCheck level={lvl} required={0}>{formatNumber(s.gold)}</SpyCheck>
                            </div>
                        </div>
                        <div className="bg-white p-2 border border-gray-400">
                            <div className="text-xs text-gray-500 uppercase font-bold">Vault</div>
                            <div className="text-lg font-bold flex items-center gap-2">
                                <span>🏦</span>
                                <SpyCheck level={lvl} required={3}>{formatNumber(s.vault)}</SpyCheck>
                            </div>
                        </div>
                        <div className="bg-white p-2 border border-gray-400">
                            <div className="text-xs text-gray-500 uppercase font-bold">Turns</div>
                            <div className="text-lg font-bold flex items-center gap-2">
                                <span>⏳</span>
                                <SpyCheck level={lvl} required={3}>{formatNumber(s.turns)}</SpyCheck>
                            </div>
                        </div>
                        <div className="bg-white p-2 border border-gray-400">
                            <div className="text-xs text-gray-500 uppercase font-bold">Experience</div>
                            <div className="text-lg font-bold flex items-center gap-2">
                                <span>⭐</span>
                                <SpyCheck level={lvl} required={0}>{formatNumber(s.experience)}</SpyCheck>
                            </div>
                        </div>
                    </div>
                </fieldset>

                {/* Combat Strength Overview */}
                <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2">
                    <legend className="px-1 text-sm font-bold">Combat Strength Overview</legend>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        {[
                            { label: 'Attack', val: s.attack, icon: '⚔️', rank: s.rank_attack },
                            { label: 'Defense', val: s.defense, icon: '🛡️', rank: s.rank_defense },
                            { label: 'Spy Network', val: s.spy, icon: '🕵️', rank: s.rank_spy },
                            { label: 'Sentry Guard', val: s.sentry, icon: '👁️', rank: s.rank_sentry },
                        ].map((stat, i) => (
                            <div key={i} className="bg-white p-2 border border-gray-400 flex justify-between items-center">
                                <div>
                                    <div className="text-xs text-gray-500 uppercase font-bold">{stat.label}</div>
                                    <div className="font-bold flex items-center gap-1">
                                        <span>{stat.icon}</span>
                                        <SpyCheck level={lvl} required={0}>{formatNumber(stat.val)}</SpyCheck>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-gray-400 uppercase">Rank</div>
                                    <div className="text-xs font-bold text-gray-600">
                                        <SpyCheck level={lvl} required={0}>#{stat.rank || '-'}</SpyCheck>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </fieldset>
            </div>
        );
    };

    // 1. ECONOMY TAB
    const renderEconomyTab = () => {
        const s = statsSource || {};
        const lvl = viewerSpyLevel;

        // --- CALCULATION LOGIC (Matching generate_resources.sql) ---
        const citizenCount = s.citizens || 0;
        const citizenRate = 1;

        let citizenIncome = citizenCount * citizenRate;

        // Trained Units (Attack + Defense + Spy + Sentry)
        const trainedCount = (s.attack_soldiers || 0) + (s.defense_soldiers || 0) + (s.spies || 0) + (s.sentries || 0);
        const trainedRate = 0.5;

        let trainedIncome = Math.floor(trainedCount * trainedRate);

        // Miners
        const minerCount = s.miners || 0;
        const goldMineLevel = s.gold_mine_level || 1;
        const minerRate = 2 + Math.max(0, goldMineLevel - 1);

        let minerIncome = minerCount * minerRate;

        // Check for Ad Bonus
        let bonusMultiplier = 1;
        const now = new Date();
        const bonusEnd = s.ad_bonus_ends_at ? new Date(s.ad_bonus_ends_at) : null;

        if (bonusEnd && bonusEnd > now) {
            bonusMultiplier = 2;
        }

        // Apply Multiplier
        citizenIncome *= bonusMultiplier;
        trainedIncome *= bonusMultiplier;
        minerIncome *= bonusMultiplier;

        // Base Gold Income (Subtotal)
        const baseGoldIncome = citizenIncome + trainedIncome + minerIncome;

        // Vault Interest (Bonus)
        const vaultLevel = s.vault_level || 0;
        const interestRate = Math.min(0.50, vaultLevel * 0.05); // 5% per level, max 50%
        const vaultIncome = Math.floor(baseGoldIncome * interestRate);

        const totalIncome = baseGoldIncome; // Vault income goes to Vault, not Treasury directly, but is part of "Earnings"

        const getHourly = (val) => val * 60;
        const getDaily = (val) => val * 60 * 24;

        return (
            <div className="space-y-4">
                {/* Economy Overview */}
                <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2">
                    <legend className="px-1 text-sm font-bold">Financial Status</legend>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div className="bg-white p-2 border border-gray-400">
                            <div className="text-xs text-gray-500 uppercase font-bold">Treasury</div>
                            <div className="text-lg font-bold flex items-center gap-2">
                                <span>💰</span>
                                <SpyCheck level={lvl} required={0}>{formatNumber(s.gold)}</SpyCheck>
                            </div>
                        </div>

                        <div className="bg-white p-2 border border-gray-400">
                            <div className="text-xs text-gray-500 uppercase font-bold">Vault</div>
                            <div className="text-lg font-bold flex items-center gap-2">
                                <span>🏦</span>
                                <SpyCheck level={lvl} required={3}>{formatNumber(s.vault)}</SpyCheck>
                            </div>
                        </div>

                        <div className="bg-white p-2 border border-gray-400">
                            <div className="text-xs text-gray-500 uppercase font-bold">Net Income</div>
                            <div className="text-lg font-bold flex items-center gap-2 text-green-700">
                                <span>📈</span>
                                <SpyCheck level={lvl} required={2} fallback="?">
                                    {bonusMultiplier > 1 && <span className="text-xs mr-1 animate-pulse">⚡</span>}
                                    +{formatNumber(totalIncome)}/m
                                </SpyCheck>
                            </div>
                        </div>
                    </div>
                </fieldset>

                {/* Income Breakdown Table */}
                <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2">
                    <legend className="px-1 text-sm font-bold">Income Breakdown</legend>
                    <div className="bg-white border border-gray-400 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-200 border-b border-gray-400">
                                <tr>
                                    <th className="p-2 border-r border-gray-400">Source</th>
                                    <th className="p-2 border-r border-gray-400 text-right">Units</th>
                                    <th className="p-2 border-r border-gray-400 text-right hidden sm:table-cell">Rate</th>
                                    <th className="p-2 border-r border-gray-400 text-right">Per Minute</th>
                                    <th className="p-2 border-r border-gray-400 text-right hidden sm:table-cell">Per Hour</th>
                                    <th className="p-2 text-right">Per Day</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {/* Citizens */}
                                <tr className="hover:bg-blue-50">
                                    <td className="p-2 border-r border-gray-400 flex items-center gap-2">
                                        <span>👥</span> Citizens
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono">
                                        <SpyCheck level={lvl} required={1}>{formatNumber(citizenCount)}</SpyCheck>
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono text-gray-500 hidden sm:table-cell">
                                        {citizenRate.toFixed(1)} {bonusMultiplier > 1 && <span className="text-green-600 font-bold" title="2x Bonus Active">x2</span>}
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono font-bold text-green-700">
                                        <SpyCheck level={lvl} required={2}>+{formatNumber(citizenIncome)}</SpyCheck>
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono hidden sm:table-cell">
                                        <SpyCheck level={lvl} required={2}>+{formatNumber(getHourly(citizenIncome))}</SpyCheck>
                                    </td>
                                    <td className="p-2 text-right font-mono">
                                        <SpyCheck level={lvl} required={2}>+{formatNumber(getDaily(citizenIncome))}</SpyCheck>
                                    </td>
                                </tr>

                                {/* Military */}
                                <tr className="hover:bg-blue-50">
                                    <td className="p-2 border-r border-gray-400 flex items-center gap-2">
                                        <span>⚔️</span> Military
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono">
                                        <SpyCheck level={lvl} required={2}>{formatNumber(trainedCount)}</SpyCheck>
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono text-gray-500 hidden sm:table-cell">
                                        {trainedRate.toFixed(1)} {bonusMultiplier > 1 && <span className="text-green-600 font-bold" title="2x Bonus Active">x2</span>}
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono font-bold text-green-700">
                                        <SpyCheck level={lvl} required={2}>+{formatNumber(trainedIncome)}</SpyCheck>
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono hidden sm:table-cell">
                                        <SpyCheck level={lvl} required={2}>+{formatNumber(getHourly(trainedIncome))}</SpyCheck>
                                    </td>
                                    <td className="p-2 text-right font-mono">
                                        <SpyCheck level={lvl} required={2}>+{formatNumber(getDaily(trainedIncome))}</SpyCheck>
                                    </td>
                                </tr>

                                {/* Miners */}
                                <tr className="hover:bg-blue-50">
                                    <td className="p-2 border-r border-gray-400 flex items-center gap-2">
                                        <span>⛏️</span> Gold Miners
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono">
                                        <SpyCheck level={lvl} required={2}>{formatNumber(minerCount)}</SpyCheck>
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono text-gray-500 hidden sm:table-cell">
                                        {minerRate.toFixed(1)} {bonusMultiplier > 1 && <span className="text-green-600 font-bold" title="2x Bonus Active">x2</span>}
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono font-bold text-green-700">
                                        <SpyCheck level={lvl} required={2}>+{formatNumber(minerIncome)}</SpyCheck>
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono hidden sm:table-cell">
                                        <SpyCheck level={lvl} required={2}>+{formatNumber(getHourly(minerIncome))}</SpyCheck>
                                    </td>
                                    <td className="p-2 text-right font-mono">
                                        <SpyCheck level={lvl} required={2}>+{formatNumber(getDaily(minerIncome))}</SpyCheck>
                                    </td>
                                </tr>

                                {/* Vault Bonus */}
                                <tr className="bg-yellow-50 hover:bg-yellow-100 border-t border-gray-300">
                                    <td className="p-2 border-r border-gray-400 flex items-center gap-2 italic">
                                        <span>🏦</span> Vault Interest (Savings)
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono italic text-gray-600">
                                        <SpyCheck level={lvl} required={3}>Lvl {vaultLevel}</SpyCheck>
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono text-gray-500 hidden sm:table-cell">{(interestRate * 100).toFixed(0)}%</td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono font-bold text-blue-700">
                                        <SpyCheck level={lvl} required={3}>+{formatNumber(vaultIncome)}</SpyCheck>
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono hidden sm:table-cell text-blue-700">
                                        <SpyCheck level={lvl} required={3}>+{formatNumber(getHourly(vaultIncome))}</SpyCheck>
                                    </td>
                                    <td className="p-2 text-right font-mono text-blue-700">
                                        <SpyCheck level={lvl} required={3}>+{formatNumber(getDaily(vaultIncome))}</SpyCheck>
                                    </td>
                                </tr>

                                {/* TOTAL */}
                                <tr className="bg-gray-100 border-t-2 border-gray-400 font-bold">
                                    <td className="p-2 border-r border-gray-400 text-right" colSpan={3}>
                                        TOTAL GROSS INCOME {bonusMultiplier > 1 && <span className="ml-2 text-green-600 uppercase text-xs">(2x Active)</span>}
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono text-lg text-green-800">
                                        <SpyCheck level={lvl} required={2}>+{formatNumber(totalIncome + vaultIncome)}</SpyCheck>
                                    </td>
                                    <td className="p-2 border-r border-gray-400 text-right font-mono hidden sm:table-cell text-green-800">
                                        <SpyCheck level={lvl} required={2}>+{formatNumber(getHourly(totalIncome + vaultIncome))}</SpyCheck>
                                    </td>
                                    <td className="p-2 text-right font-mono text-green-800">
                                        <SpyCheck level={lvl} required={2}>+{formatNumber(getDaily(totalIncome + vaultIncome))}</SpyCheck>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </fieldset>
            </div>
        );
    };

    // 2. STRUCTURES TAB (Renamed from Infrastructure logic)
    const renderStructuresTab = () => {
        const s = statsSource || {};
        const lvl = viewerSpyLevel;

        return (
            <div className="space-y-4">
                <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2">
                    <legend className="px-1 text-sm font-bold">Kingdom Infrastructure</legend>
                    <div className="space-y-1">
                        {[
                            { name: 'Kingdom', level: s.kingdom_level, req: 2, icon: '🏰', nav: 'Kingdom', desc: 'Increases citizen cap and defense.' },
                            { name: 'Gold Mine', level: s.gold_mine_level, req: 2, icon: '⛏️', nav: 'GoldMine', desc: 'Increases gold production rate per miner.' },
                            { name: 'Barracks', level: s.barracks_level, req: 2, icon: '⚔️', nav: 'Barracks', desc: 'Training ground for soldiers.' },
                            { name: 'Library', level: s.library_level, req: 4, icon: '📚', nav: 'Library', desc: 'Generates experience.' },
                            { name: 'Vault', level: s.vault_level, req: 5, icon: '🏦', nav: 'Vault', desc: 'Protects gold and generates interest.' },
                        ].map((b, i) => (
                            <div key={i} className="flex items-center justify-between bg-white px-3 py-2 border border-gray-300 hover:bg-gray-50 group">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl filter drop-shadow-sm">{b.icon}</span>
                                    <div className="flex flex-col">
                                        <span className={`font-bold text-sm ${viewingOwnProfile ? 'cursor-pointer hover:underline text-blue-900' : ''}`} onClick={() => viewingOwnProfile && onNavigate(b.nav)}>
                                            {b.name}
                                        </span>
                                        <span className="text-[10px] text-gray-500">{b.desc}</span>
                                    </div>
                                </div>
                                <div className="font-mono font-bold text-lg bg-gray-100 px-3 py-1 border border-gray-300 rounded shadow-inner">
                                    <SpyCheck level={lvl} required={b.req}>Lvl {b.level || 0}</SpyCheck>
                                </div>
                            </div>
                        ))}
                    </div>
                </fieldset>
            </div>
        );
    };

    // 2. MILITARY TAB
    const renderMilitaryTab = () => {
        const s = statsSource || {};
        const lvl = viewerSpyLevel;

        const units = [
            { label: 'Attack Soldiers', val: s.attack_soldiers, icon: '⚔️', req: 1 },
            { label: 'Defense Soldiers', val: s.defense_soldiers, icon: '🛡️', req: 1 },
            { label: 'Spies', val: s.spies, icon: '🕵️', req: 1 },
            { label: 'Sentries', val: s.sentries, icon: '👁️', req: 1 },
            { label: 'Miners', val: s.miners, icon: '⛏️', req: 2 },
            { label: 'Hostages', val: s.hostages, icon: '⛓️', req: 2 },
            { label: 'Hidden Units', val: 0, icon: '👻', req: 5, comment: '(Feature Coming Soon)' }
        ];

        return (
            <div className="space-y-4">
                {/* Combat Power */}
                <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2">
                    <legend className="px-1 text-sm font-bold">Combat Strength</legend>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        {[
                            { label: 'Attack', val: s.attack, icon: '⚔️', rank: s.rank_attack },
                            { label: 'Defense', val: s.defense, icon: '🛡️', rank: s.rank_defense },
                            { label: 'Spy Network', val: s.spy, icon: '🕵️', rank: s.rank_spy },
                            { label: 'Sentry Guard', val: s.sentry, icon: '👁️', rank: s.rank_sentry },
                        ].map((stat, i) => (
                            <div key={i} className="bg-white p-2 border border-gray-400 flex justify-between items-center">
                                <div>
                                    <div className="text-xs text-gray-500 uppercase font-bold">{stat.label}</div>
                                    <div className="font-bold flex items-center gap-1">
                                        <span>{stat.icon}</span>
                                        <SpyCheck level={lvl} required={0}>{formatNumber(stat.val)}</SpyCheck>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-gray-400 uppercase">Rank</div>
                                    <div className="text-xs font-bold text-gray-600">
                                        <SpyCheck level={lvl} required={0}>#{stat.rank || '-'}</SpyCheck>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </fieldset>

                {/* Unit Breakdown */}
                <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2">
                    <legend className="px-1 text-sm font-bold">Unit Composition</legend>
                    <table className="w-full text-sm text-left bg-white border border-gray-400">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="p-1">Unit Type</th>
                                <th className="p-1 text-right">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {units.filter(u => !u.hidden).map((u, i) => (
                                <tr key={i} className="border-t border-gray-200">
                                    <td className="p-1 flex items-center gap-2">
                                        <span>{u.icon}</span>
                                        <span>{u.label}</span>
                                    </td>
                                    <td className="p-1 text-right font-mono font-bold">
                                        <SpyCheck level={lvl} required={u.req}>{formatNumber(u.val)}</SpyCheck>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </fieldset>

                {/* Armoury / Weapons */}
                {lvl >= 3 || viewingOwnProfile ? (
                    <fieldset className="border-2 border-white border-l-gray-500 border-t-gray-500 p-2">
                        <legend className="px-1 text-sm font-bold">Armoury</legend>
                        <div className="p-2 bg-white border border-gray-400 text-sm">
                            <div className="flex justify-between">
                                <span>Weapons Research Tier:</span>
                                <span className="font-bold"><SpyCheck level={lvl} required={3}>{s.research_weapons || 0}</SpyCheck></span>
                            </div>
                            <div className="text-center italic text-gray-500 mt-2 text-xs">
                                Detailed weapon counts requires Armoury check (Simulated)
                            </div>
                        </div>
                    </fieldset>
                ) : (
                    <div className="text-center text-gray-500 text-xs mt-2 italic">
                        Requires Spy Level 3 to see Armoury Details
                    </div>
                )}
            </div>
        );
    };

    // 3. TECHNOLOGY TAB
    const renderTechTab = () => {
        const s = statsSource || {};
        const lvl = viewerSpyLevel;

        const researches = [
            { name: 'Weapons Tech', val: s.research_weapons },
            { name: 'Attack Tech', val: s.research_attack },
            { name: 'Defense Tech', val: s.research_defense },
            { name: 'Spy Tech', val: s.research_spy },
            { name: 'Sentry Tech', val: s.research_sentry },
            { name: 'Economy Tech', val: s.research_turns_per_min },
            { name: 'Hostage Convert', val: s.research_hostage_convert }

        ];

        return (
            <div className="space-y-2">
                <div className="bg-white p-2 border border-gray-400 mb-2">
                    <h3 className="font-bold border-b border-gray-300 mb-2">Research Progress</h3>
                    {lvl >= 4 ? (
                        <div className="grid grid-cols-1 gap-1">
                            {researches.map((r, i) => (
                                <div key={i} className="flex justify-between text-sm p-1 hover:bg-gray-50">
                                    <span>{r.name}</span>
                                    <span className="font-mono font-bold flex items-center gap-2">
                                        Level {r.val || 0}
                                        <div className="w-16 h-2 bg-gray-200 border border-gray-400">
                                            <div className="h-full bg-blue-800" style={{ width: `${Math.min(100, ((r.val || 0) / 10) * 100)}%` }}></div>
                                        </div>
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500 italic">
                            Research Data Classified.<br />Requires Spy Level 4.
                        </div>
                    )}
                </div>
            </div>
        );
    };



    // 6. HISTORY TAB
    const renderHistoryTab = () => {
        return (
            <div className="space-y-2">
                <div className="bg-white border-2 border-gray-400 p-2">
                    <h3 className="font-bold border-b border-gray-300 mb-2">Battle & Spy Log</h3>
                    {battleHistory.length === 0 ? (
                        <div className="text-center text-gray-500 mt-10">No recent activity reported.</div>
                    ) : (
                        <div className="space-y-1">
                            {battleHistory.map((battle, i) => {
                                const isAttacker = battle.attacker_id === session.user.id;
                                const won = isAttacker ? battle.success : !battle.success;
                                return (
                                    <div key={i} className={`p-2 border ${battle.is_spy ? 'bg-yellow-50 border-yellow-200' : (won ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')} text-xs flex justify-between items-center`}>
                                        <div>
                                            <div className="font-bold">
                                                {battle.is_spy ? (
                                                    <span>🕵️ Spied on {battle.defender_name}</span>
                                                ) : (
                                                    <span>{isAttacker ? 'You attacked' : 'Attacked by'} {isAttacker ? battle.defender_name : battle.attacker_name}</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-gray-500">{new Date(battle.created_at).toLocaleString()}</div>
                                        </div>
                                        <div className={`font-bold px-2 py-0.5 rounded ${battle.is_spy ? 'bg-yellow-200 text-yellow-800' : (won ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800')}`}>
                                            {battle.is_spy ? 'REPORT' : (won ? 'VICTORY' : 'DEFEAT')}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // 4. MAIN RENDER
    return (
        <div className="p-2 font-sans bg-[#c0c0c0] h-full flex flex-col select-user mr-1">
            {/* Battle Modal */}
            {attackResult && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
                    <div className="w-[300px] bg-[#c0c0c0] border-2 border-white border-r-gray-800 border-b-gray-800 p-1 shadow-xl">
                        <div className={`px-2 py-1 text-white font-bold flex justify-between items-center ${attackResult.success ? 'bg-[#000080]' : 'bg-red-800'}`}>
                            <span>{attackResult.success ? 'Battle Report - VICTORY' : 'Battle Report - DEFEAT'}</span>
                            <button onClick={() => setAttackResult(null)} className="bg-[#c0c0c0] text-black w-4 h-4 flex items-center justify-center border border-white border-r-black border-b-black text-xs">✕</button>
                        </div>
                        <div className="p-4 text-center text-sm">
                            <p className="mb-4">{attackResult.message}</p>
                            <div className="grid grid-cols-2 gap-2 text-left mb-4">
                                <div className="border border-gray-600 p-1 bg-white">
                                    <div className="text-[10px] font-bold">GOLD</div>
                                    <div>{formatNumber(attackResult.gold_stolen)}</div>
                                </div>
                                <div className="border border-gray-600 p-1 bg-white">
                                    <div className="text-[10px] font-bold">LOSSES</div>
                                    <div className="text-red-700">{formatNumber(attackResult.casualties)}</div>
                                </div>
                            </div>
                            <button onClick={() => setAttackResult(null)} className="w-20 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white">OK</button>
                        </div>
                    </div>
                </div>
            )}





            {/* Avatar Selection Modal */}
            {isAvatarModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={(e) => { e.stopPropagation(); setIsAvatarModalOpen(false); }}>
                    <div className="bg-[#c0c0c0] border-2 border-white border-r-black border-b-black p-1 shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
                        <div className="px-2 py-1 bg-[#000080] text-white font-bold flex justify-between items-center mb-2">
                            <span>Select Avatar</span>
                            <button onClick={() => setIsAvatarModalOpen(false)} className="bg-[#c0c0c0] text-black w-4 h-4 flex items-center justify-center border border-white border-r-black border-b-black text-xs">✕</button>
                        </div>
                        <div className="p-4 grid grid-cols-3 gap-4">
                            {avatars.map(avatar => (
                                <button
                                    key={avatar.id}
                                    onClick={() => handleAvatarUpdate(avatar.id)}
                                    className={`flex flex-col items-center gap-2 p-2 border-2 ${profileData?.avatar_id === avatar.id ? 'border-blue-600 bg-blue-100' : 'border-transparent hover:border-gray-400 hover:bg-gray-200'}`}
                                >
                                    <img src={avatar.src} alt={avatar.name} className="w-16 h-16 object-cover border border-gray-600 pixelated" />
                                    <span className="text-xs text-center">{avatar.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Header */}
            <div className="flex gap-4 p-4 border-2 border-white border-r-gray-600 border-b-gray-600 mb-4 bg-gray-200">
                <div
                    className={`w-16 h-16 bg-[#008080] border-2 border-gray-600 border-r-white border-b-white flex items-center justify-center shadow-inner relative overflow-hidden group ${viewingOwnProfile ? 'cursor-pointer hover:opacity-90' : ''}`}
                    onClick={() => viewingOwnProfile && setIsAvatarModalOpen(true)}
                    title={viewingOwnProfile ? "Click to change avatar" : ""}
                >
                    {profileData?.avatar_id && getAvatarPath(profileData.avatar_id) ? (
                        <img
                            src={getAvatarPath(profileData.avatar_id)}
                            alt="Avatar"
                            className="w-full h-full object-cover pixelated"
                        />
                    ) : (
                        <>
                            {/* Placeholder Avatar */}
                            <span className="text-3xl text-white font-bold relative z-10">{profileData?.username?.charAt(0).toUpperCase()}</span>
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/20"></div>
                        </>
                    )}
                    {viewingOwnProfile && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-white font-bold bg-black/50 px-1">EDIT</span>
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold truncate">{profileData?.username}</h1>
                    <div className="flex flex-wrap gap-x-4 text-sm text-gray-700">
                        <span className="flex items-center gap-1">
                            <span className="font-bold">Rank:</span> #{profileData?.overall_rank || 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="font-bold">Alliance:</span> {profileData?.alliance || 'None'}
                        </span>
                    </div>
                </div>
                {!viewingOwnProfile && (
                    <div className="flex flex-col gap-1 justify-center min-w-[80px]">
                        <button
                            onClick={() => window.openChatWith && window.openChatWith(targetUserId, profileData?.username)}
                            className="px-3 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white text-xs"
                        >
                            Message
                        </button>
                        <button
                            onClick={() => fetchData(true)}
                            disabled={loading || actionLoading}
                            className="px-3 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white text-xs"
                        >
                            Refresh
                        </button>
                        <button
                            onClick={handleSpy}
                            disabled={actionLoading}
                            className="px-3 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white text-xs disabled:text-gray-500"
                        >
                            Spy
                        </button>
                        <button
                            onClick={handleAttack}
                            disabled={actionLoading}
                            className="px-3 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white text-xs font-bold disabled:text-gray-500"
                        >
                            Attack
                        </button>
                    </div>
                )}
            </div>

            {/* View Source Info Banner (Spy Report Status) */}
            {!viewingOwnProfile && (
                <div className={`mb-2 px-2 py-1 text-xs border ${hasReport ? 'bg-yellow-50 border-yellow-400 text-yellow-900' : 'bg-gray-200 border-gray-400 text-gray-600'}`}>
                    {hasReport ? (
                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                                <span>
                                    <strong>
                                        {spyReport.is_shared ? `ALLIANCE INTEL (via ${spyReport.shared_by})` :
                                            'INTELLIGENCE REPORT ACQUIRED'}
                                    </strong>
                                    ({spyReport.hours_old < 1 ? 'Fresh' : `${Math.floor(spyReport.hours_old)}h old`})
                                </span>
                                <span className="font-mono bg-yellow-200 px-1 border border-yellow-500">Spy Level: {currentUserStats?.research_spy_report || 0}</span>
                            </div>
                            {spyReport.is_shared && (
                                <div className="text-[10px] italic opacity-80">
                                    This report was shared by an alliance member.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex justify-between">
                            <span>No Intelligence Data Available</span>
                            <span className="italic">Use Spy action to reveal restricted info</span>
                        </div>
                    )}
                    {spyFailure && <div className="mt-1 text-red-600 font-bold">Latest Spy Attempt Failed: {spyFailure}</div>}
                </div>
            )}

            {/* Notification Toast */}
            {notification && (
                <div className={`mb-2 mx-2 px-2 py-1 text-xs border font-bold text-center animate-pulse ${notification.type === 'success' ? 'bg-green-200 border-green-600 text-green-900' :
                    notification.type === 'error' ? 'bg-red-200 border-red-600 text-red-900' :
                        notification.type === 'warning' ? 'bg-orange-200 border-orange-600 text-orange-900' :
                            'bg-blue-200 border-blue-600 text-blue-900'
                    }`}>
                    {notification.message}
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex gap-1 border-b border-white pr-2 pl-2 overflow-x-auto no-scrollbar whitespace-nowrap">
                {[
                    { id: 'general', label: 'General' },
                    { id: 'economy', label: 'Economy' },
                    { id: 'structures', label: 'Structures' },
                    { id: 'military', label: 'Military' },
                    { id: 'tech', label: 'Technology' },

                    ...(viewingOwnProfile ? [] : [{ id: 'history', label: 'History' }])
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3 py-1 text-xs font-bold border-t-2 border-l-2 border-r-2 rounded-t transition-all ${activeTab === tab.id
                            ? 'bg-[#c0c0c0] border-white border-r-black border-b-0 -mb-[1px] z-10 pb-2'
                            : 'bg-gray-300 border-white border-r-gray-600 text-gray-600 mb-[1px] hover:bg-gray-200'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content Container */}
            <div className="p-4 border-2 border-white border-l-gray-600 border-t-gray-600 bg-[#c0c0c0] min-h-[350px] overflow-y-auto">
                {activeTab === 'general' && renderGeneralTab()}
                {(activeTab === 'economy' || activeTab === 'empire') && renderEconomyTab()}
                {activeTab === 'structures' && renderStructuresTab()}
                {activeTab === 'military' && renderMilitaryTab()}
                {activeTab === 'tech' && renderTechTab()}

                {activeTab === 'history' && renderHistoryTab()}
            </div>
        </div>
    );
}
