import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Profile({ userId, isOwnProfile, session, onNavigate, onAction }) {
    const [profileData, setProfileData] = useState(null);
    const [currentUserStats, setCurrentUserStats] = useState(null);
    const [spyReport, setSpyReport] = useState(null);
    const [spyFailure, setSpyFailure] = useState(null);
    const [attackResult, setAttackResult] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [battleHistory, setBattleHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('general');

    const targetUserId = userId || session?.user?.id;
    const viewingOwnProfile = !userId || userId === session?.user?.id;

    useEffect(() => {
        if (targetUserId) {
            fetchProfileData();
            fetchAchievements();
            if (!viewingOwnProfile) {
                fetchCurrentUserStats();
                fetchSpyReport();
                fetchBattleHistory();
            }
        }
    }, [targetUserId]);

    const fetchProfileData = async () => {
        try {
            setLoading(true);
            const { data: stats } = await supabase.from('user_stats').select('*').eq('id', targetUserId).single();
            const { data: rankData } = await supabase.from('leaderboard').select('*').eq('id', targetUserId).single();
            const { data: profile } = await supabase.from('profiles').select('username, created_at').eq('id', targetUserId).single();

            setProfileData({
                ...stats,
                ...rankData,
                username: profile?.username || 'Unknown Player',
                created_at: profile?.created_at
            });
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCurrentUserStats = async () => {
        try {
            const { data } = await supabase.from('user_stats').select('spy').eq('id', session.user.id).single();
            setCurrentUserStats(data);
        } catch (error) { console.error(error); }
    };

    const fetchSpyReport = async () => {
        try {
            const { data } = await supabase.rpc('get_latest_spy_report', { target_id: targetUserId });
            if (data && data.length > 0) setSpyReport(data[0]);
        } catch (error) { console.error(error); }
    };

    const fetchBattleHistory = async () => {
        try {
            const { data } = await supabase.rpc('get_battle_history', { target_id: targetUserId, limit_count: 10 });
            setBattleHistory(data || []);
        } catch (error) { console.error(error); }
    };

    const fetchAchievements = async () => {
        try {
            const { data } = await supabase.rpc('get_user_achievements', { target_user_id: targetUserId });
            setAchievements(data || []);
        } catch (error) { console.error(error); }
    };

    const handleSpy = async () => {
        setActionLoading(true);
        setSpyFailure(null);
        try {
            const { data, error } = await supabase.rpc('spy_player', { target_id: targetUserId });
            if (error) throw error;
            if (data.success) {
                await fetchSpyReport();
                if (onAction) onAction();
                setActiveTab('stats');
            } else {
                setSpyFailure(data.message);
                setActiveTab('stats');
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
        } catch (err) {
            alert('Attack failed: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const formatNumber = (num) => new Intl.NumberFormat('en-US').format(num || 0);

    const canSeeTreasury = () => {
        if (viewingOwnProfile) return true;
        if (!currentUserStats || !profileData) return false;
        const mySpy = currentUserStats.spy || 0;
        const theirSentry = profileData.sentry || 0;
        return mySpy > theirSentry;
    };

    if (loading) return <div className="p-4 text-center">Loading user data...</div>;

    const accountAge = profileData?.created_at
        ? Math.floor((Date.now() - new Date(profileData.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    return (
        <div className="p-2 font-sans bg-[#c0c0c0] h-full flex flex-col">
            {/* Attack Result Modal (Dialog) */}
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

            {/* Profile Header */}
            <div className="flex gap-4 p-4 border-2 border-white border-r-gray-600 border-b-gray-600 mb-4 bg-gray-200">
                <div className="w-16 h-16 bg-[#008080] border-2 border-gray-600 border-r-white border-b-white flex items-center justify-center">
                    <span className="text-3xl text-white font-bold">{profileData?.username?.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                    <h1 className="text-xl font-bold">{profileData?.username}</h1>
                    <div className="text-sm text-gray-700">Rank: #{profileData?.overall_rank || 'N/A'}</div>
                    <div className="text-sm text-gray-700">Alliance: {profileData?.alliance || 'None'}</div>
                </div>
                {!viewingOwnProfile && (
                    <div className="ml-auto flex flex-col gap-1 justify-center">
                        <button
                            onClick={() => window.openChatWith && window.openChatWith(targetUserId, profileData?.username)}
                            className="px-3 py-1 bg-[#c0c0c0] border-2 border-white border-r-black border-b-black active:border-black active:border-r-white active:border-b-white text-xs"
                        >
                            Message
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

            {/* Tabs */}
            <div className="flex gap-1 border-b border-white pr-2 pl-2">
                {[
                    { id: 'general', label: 'General' },
                    { id: 'stats', label: 'Statistics' },
                    { id: 'achievements', label: 'Achievements' },
                    ...(viewingOwnProfile ? [] : [{ id: 'history', label: 'History' }])
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3 py-1 text-xs font-bold border-t-2 border-l-2 border-r-2 rounded-t transition-colors ${activeTab === tab.id
                            ? 'bg-[#c0c0c0] border-white border-r-black border-b-0 -mb-[1px] z-10'
                            : 'bg-gray-300 border-white border-r-gray-600 text-gray-600 mb-[1px]'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="p-4 border-2 border-white border-l-gray-600 border-t-gray-600 bg-[#c0c0c0] min-h-[300px]">
                {activeTab === 'general' && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <fieldset className="border border-gray-400 p-2">
                            <legend className="ml-1 px-1">Identity</legend>
                            <div className="grid grid-cols-[80px_1fr] gap-1">
                                <div className="text-right text-gray-600">Username:</div>
                                <div className="font-bold">{profileData?.username}</div>
                                <div className="text-right text-gray-600">ID:</div>
                                <div className="font-mono text-xs overflow-hidden text-ellipsis">{targetUserId}</div>
                                <div className="text-right text-gray-600">Joined:</div>
                                <div>{accountAge} days ago</div>
                            </div>
                        </fieldset>
                        <fieldset className="border border-gray-400 p-2">
                            <legend className="ml-1 px-1">Status</legend>
                            <div className="grid grid-cols-[80px_1fr] gap-1">
                                <div className="text-right text-gray-600">Gold:</div>
                                <div className="font-bold">{canSeeTreasury() ? formatNumber(profileData?.gold) : '???'}</div>
                                <div className="text-right text-gray-600">Turns:</div>
                                <div>{viewingOwnProfile ? formatNumber(profileData?.turns) : '???'}</div>
                                <div className="text-right text-gray-600">Land:</div>
                                <div>{formatNumber(profileData?.land || 100)} acres</div>
                            </div>
                        </fieldset>
                    </div>
                )}

                {activeTab === 'stats' && (
                    <div>
                        {!viewingOwnProfile && spyFailure && (
                            <div className="mb-2 p-2 bg-red-100 border border-red-500 text-red-800 text-xs">
                                <strong>Spy Failed:</strong> {spyFailure}
                            </div>
                        )}
                        {!viewingOwnProfile && spyReport && (
                            <div className="mb-2 text-xs text-gray-600">
                                Report Age: {spyReport.hours_old < 1 ? 'Fresh' : `${Math.floor(spyReport.hours_old)} hours`}
                            </div>
                        )}

                        <div className="bg-white border-2 border-gray-600 border-r-white border-b-white p-1">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-[#c0c0c0] font-normal">
                                    <tr>
                                        <th className="p-1 border border-gray-400">Attribute</th>
                                        <th className="p-1 border border-gray-400 text-right">Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { label: 'Attack Power', key: 'attack' },
                                        { label: 'Defense Power', key: 'defense' },
                                        { label: 'Spy Network', key: 'spy' },
                                        { label: 'Sentry Guard', key: 'sentry' },
                                        { label: 'Citizens', key: 'citizens' },
                                        { label: 'Attack Units', key: 'attack_soldiers' },
                                        { label: 'Defense Units', key: 'defense_soldiers' },
                                        { label: 'Spies', key: 'spies' },
                                        { label: 'Sentries', key: 'sentries' },
                                    ].map((stat, i) => {
                                        const value = viewingOwnProfile ? profileData?.[stat.key] : spyReport?.[stat.key];
                                        const visible = viewingOwnProfile || (spyReport && value !== null && value !== undefined);
                                        return (
                                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-100'}>
                                                <td className="p-1 border-r border-gray-200">{stat.label}</td>
                                                <td className="p-1 text-right font-mono">{visible ? formatNumber(value) : '???'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'achievements' && (
                    <div className="bg-white border-2 border-gray-600 border-r-white border-b-white h-64 overflow-y-auto p-1">
                        {achievements.length === 0 ? (
                            <div className="text-center text-gray-500 mt-10">No achievements earned yet.</div>
                        ) : (
                            <div className="grid grid-cols-1 gap-1">
                                {achievements.map((ach, i) => (
                                    <div key={i} className="flex items-center gap-2 p-1 border-b border-gray-200">
                                        <div className="text-xl">{ach.icon}</div>
                                        <div>
                                            <div className="font-bold text-xs">{ach.achievement_name}</div>
                                            <div className="text-[10px] text-gray-500">{ach.rarity}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && !viewingOwnProfile && (
                    <div className="bg-white border-2 border-gray-600 border-r-white border-b-white h-64 overflow-y-auto p-1">
                        {battleHistory.length === 0 ? (
                            <div className="text-center text-gray-500 mt-10">No recent battles reported by spies.</div>
                        ) : (
                            <div className="space-y-1">
                                {battleHistory.map((battle, i) => {
                                    const isAttacker = battle.attacker_id === session.user.id;
                                    const won = isAttacker ? battle.success : !battle.success;
                                    return (
                                        <div key={i} className={`p-1 border ${won ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} text-xs`}>
                                            <div className="font-bold">
                                                {isAttacker ? 'You attacked' : 'Attacked by'} {isAttacker ? battle.defender_name : battle.attacker_name}
                                            </div>
                                            <div>{won ? 'VICTORY' : 'DEFEAT'} - {new Date(battle.created_at).toLocaleDateString()}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
