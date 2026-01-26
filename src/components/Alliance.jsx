import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { getAvatarPath } from '../config/avatars';

const Alliance = ({ stats: rawStats, session, onUpdate, onClose, onNavigate }) => {
    const stats = rawStats || {};
    // If user has an alliance_id, default to 'overview'. Else default to 'browse'.
    const initialTab = stats.alliance_id ? 'overview' : 'browse';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Data Storage
    const [allianceList, setAllianceList] = useState([]);
    const [myAlliance, setMyAlliance] = useState(null);
    const [members, setMembers] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [leaderboard, setLeaderboard] = useState([]);
    const [announcementEdit, setAnnouncementEdit] = useState(false);
    const [tempAnnouncement, setTempAnnouncement] = useState('');

    // Approval System State
    const [myRequests, setMyRequests] = useState([]);
    const [joinRequests, setJoinRequests] = useState([]);
    const [modal, setModal] = useState({ show: false, type: '', message: '', onConfirm: null });

    const chatEndRef = useRef(null);

    useEffect(() => {
        if (stats.alliance_id) {
            // Default to 'home' if initial load
            if (activeTab === 'browse' || !activeTab) setActiveTab('home');
            fetchMyAllianceData();
            subscribeToChat();
        } else {
            if (['home', 'overview', 'chat', 'requests'].includes(activeTab)) {
                setActiveTab('browse');
            }
            fetchAllianceList();
        }
    }, [stats.alliance_id]);

    const [unreadCount, setUnreadCount] = useState(0);
    const activeTabRef = useRef(activeTab);

    useEffect(() => {
        activeTabRef.current = activeTab;
        if (activeTab === 'chat' && stats.alliance_id) {
            setUnreadCount(0);
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
        if (activeTab === 'requests') {
            fetchJoinRequests();
        }
    }, [activeTab, chatMessages, stats.alliance_id]);

    const fetchAllianceList = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('alliances')
                .select('*')
                .order('member_count', { ascending: false });

            if (error) throw error;
            setAllianceList(data || []);

            const { data: reqs } = await supabase.rpc('get_my_requests');
            setMyRequests(reqs ? reqs.map(r => r.alliance_id) : []);

        } catch (err) {
            console.error(err);
            setError('Failed to load alliances.');
        } finally {
            setLoading(false);
        }
    };

    const fetchMyAllianceData = async () => {
        if (!stats.alliance_id) return;
        setLoading(true);

        try {
            // 1. Alliance Details
            const { data: allianceData, error: allianceError } = await supabase
                .from('alliances')
                .select('*')
                .eq('id', stats.alliance_id)
                .single();
            if (allianceError) throw allianceError;
            setMyAlliance(allianceData);
            setTempAnnouncement(allianceData.announcement || '');

            // 2. Members with overall_rank from leaderboard
            const { data: membersData, error: membersError } = await supabase
                .from('profiles')
                .select(`
                    id, 
                    username, 
                    avatar_id,
                    user_stats(rank, citizens)
                `)
                .eq('alliance_id', stats.alliance_id);

            if (membersError) throw membersError;

            // Get overall_rank for each member from leaderboard
            const memberIds = (membersData || []).map(m => m.id);
            const { data: leaderboardData, error: lbError } = await supabase
                .from('leaderboard')
                .select('id, overall_rank')
                .in('id', memberIds);

            if (!lbError && leaderboardData) {
                // Merge overall_rank into members data
                const rankMap = {};
                leaderboardData.forEach(lb => {
                    rankMap[lb.id] = lb.overall_rank;
                });

                membersData.forEach(m => {
                    m.overall_rank = rankMap[m.id] || 999999;
                });
            }

            // Sort members by overall_rank ASC (lower rank = better)
            const sortedMembers = (membersData || []).sort((a, b) => {
                const rankA = a.overall_rank || 999999;
                const rankB = b.overall_rank || 999999;
                return rankA - rankB;
            });
            setMembers(sortedMembers);

            // 3. Global Leaderboard
            const { data: lbData, error: lbError2 } = await supabase.rpc('get_alliance_leaderboard');
            if (!lbError2) setLeaderboard(lbData || []);

            // 4. Chat
            const { data: msgs, error: chatError } = await supabase
                .from('alliance_messages')
                .select('*, sender:sender_id(username, avatar_id)')
                .eq('alliance_id', stats.alliance_id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (chatError) throw chatError;
            setChatMessages((msgs || []).reverse());

        } catch (err) {
            console.error("Error fetching alliance data:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchJoinRequests = async () => {
        try {
            const { data, error } = await supabase.rpc('get_alliance_requests');
            if (error) throw error;
            setJoinRequests(data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const updateAnnouncement = async () => {
        try {
            const { data, error } = await supabase.rpc('update_alliance_announcement', { p_text: tempAnnouncement });
            if (error) throw error;
            if (!data.success) throw new Error(data.message);

            setAnnouncementEdit(false);
            setMyAlliance(prev => ({ ...prev, announcement: tempAnnouncement }));
        } catch (err) {
            setModal({ show: true, type: 'alert', message: err.message });
        }
    };

    // --- ACTIONS ---

    const handleCreate = async (e) => {
        e.preventDefault();
        const name = e.target.name.value;
        const desc = e.target.description.value;
        if (!name) return;

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('create_alliance', {
                p_name: name,
                p_description: desc
            });
            if (error) throw error;
            if (!data.success) throw new Error(data.message);

            // Success
            onUpdate({ alliance_id: data.alliance_id }); // Update context
            // Effect will trigger fetch
        } catch (err) {
            setModal({ show: true, type: 'alert', message: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRequest = async (id) => {
        setLoading(true);
        try {
            // Updated to be a Request
            const { data, error } = await supabase.rpc('join_alliance', {
                p_alliance_id: id
            });
            if (error) throw error;
            if (!data.success) throw new Error(data.message);

            // Optimistic update
            setMyRequests(prev => [...prev, id]);
            setModal({ show: true, type: 'alert', message: 'Request sent to alliance leader.' });
        } catch (err) {
            setModal({ show: true, type: 'alert', message: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleLeave = async () => {
        const isLastPerson = members.length === 1;

        if (isLastPerson) {
            setModal({
                show: true,
                type: 'disband',
                message: 'You are the last member. Leaving will disband the alliance. Are you sure?',
                onConfirm: executeLeave
            });
        } else {
            setModal({
                show: true,
                type: 'leave',
                message: 'Are you sure you want to leave?',
                onConfirm: executeLeave
            });
        }
    };

    const executeLeave = async () => {
        setModal({ show: false, type: '', message: '', onConfirm: null });
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('leave_alliance');
            if (error) throw error;
            if (!data.success) throw new Error(data.message);

            onUpdate({ alliance_id: null });
            setMyAlliance(null);
            setMembers([]);
            setChatMessages([]);
            setActiveTab('browse');
        } catch (err) {
            setModal({ show: true, type: 'alert', message: err.message });
        } finally {
            setLoading(false);
        }
    };

    const membersRef = useRef(members);
    useEffect(() => {
        membersRef.current = members;
    }, [members]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const msgContent = newMessage;
        setNewMessage(''); // Clear input immediately

        // 1. Optimistic Update
        const tempId = 'temp-' + Date.now();
        const myProfile = membersRef.current.find(m => m.id === session.user.id);
        const optimisticMsg = {
            id: tempId,
            alliance_id: stats.alliance_id,
            sender_id: session.user.id,
            message: msgContent,
            created_at: new Date().toISOString(),
            sender: myProfile ? { username: myProfile.username, avatar_id: myProfile.avatar_id } : { username: 'Me' } // Fallback
        };

        setChatMessages(prev => [...prev, optimisticMsg]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

        try {
            const { data, error } = await supabase.rpc('send_alliance_message', { p_message: msgContent });

            if (error) throw error;
            if (!data.success) throw new Error(data.message);

            const realMsgData = data.data; // Returned from RPC

            // 2. Reconcile with Realtime / State
            setChatMessages(prev => {
                // Remove temp message
                const filtered = prev.filter(m => m.id !== tempId);

                // Check if real message already exists (from Realtime)
                if (filtered.some(m => m.id === realMsgData.id)) {
                    return filtered;
                }

                // Add real message with properly formatted sender
                const realMsg = {
                    ...realMsgData,
                    sender: optimisticMsg.sender // Reuse sender info we already have
                };

                // Insert at end (or resorts automatically if we sort by date)
                // Since we just appended, let's append.
                return [...filtered, realMsg];
            });

        } catch (err) {
            console.error(err);
            setModal({ show: true, type: 'alert', message: 'Failed to send message: ' + err.message });
            // Remove optimistic message on error
            setChatMessages(prev => prev.filter(m => m.id !== tempId));
            setNewMessage(msgContent); // Restore input
        }
    };

    const handleApprove = async (reqId) => {
        try {
            const { data, error } = await supabase.rpc('approve_join_request', { p_request_id: reqId });
            if (error) throw error;
            if (data.success) {
                // Refresh requests and members
                fetchJoinRequests();
                fetchMyAllianceData();
            }
        } catch (err) { console.error(err); setModal({ show: true, type: 'alert', message: err.message }); }
    };

    const handleReject = async (reqId) => {
        setModal({
            show: true,
            type: 'confirm',
            message: 'Are you sure you want to reject this user?',
            onConfirm: async () => {
                setModal({ show: false, type: '', message: '', onConfirm: null }); // Close confirm modal
                try {
                    const { data, error } = await supabase.rpc('reject_join_request', { p_request_id: reqId });
                    if (error) throw error;
                    if (data.success) {
                        fetchJoinRequests();
                    }
                } catch (err) { console.error(err); setModal({ show: true, type: 'alert', message: err.message }); }
            }
        });
    };

    // --- REALTIME CHAT ---
    const subscribeToChat = () => {
        const channel = supabase
            .channel(`alliance_chat:${stats.alliance_id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'alliance_messages',
                filter: `alliance_id=eq.${stats.alliance_id}`
            }, async (payload) => {
                if (!payload.new) return;

                // Determine user name for the payload sender
                const senderId = payload.new.sender_id;

                // Use Ref to check current members without closure staleness
                const sender = membersRef.current.find(m => m.id === senderId);
                let senderData = sender ? { username: sender.username, avatar_id: sender.avatar_id } : { username: 'Unknown' };

                // If not found in members (e.g. new member or failed fetch), fetch from DB
                if (!sender) {
                    try {
                        const { data } = await supabase.from('profiles').select('username, avatar_id').eq('id', senderId).single();
                        if (data) senderData = data;
                    } catch (e) {
                        console.error("Error identifying chat sender", e);
                    }
                }

                const newMsg = {
                    ...payload.new,
                    sender: senderData
                };

                setChatMessages(prev => {
                    // Simple deduplication check: if message with same ID exists, ignore
                    if (prev.some(m => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg];
                });

                if (activeTabRef.current !== 'chat') {
                    setUnreadCount(prev => prev + 1);
                }

                setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    if (!stats.alliance_id) {
        // ... existing render for Browse/Create ...
        return (
            <div className="h-full flex flex-col bg-gray-100">
                <div className="flex border-b border-gray-400 bg-gray-200">
                    <button
                        onClick={() => setActiveTab('browse')}
                        className={`px-4 py-1 text-sm ${activeTab === 'browse' ? 'bg-white font-bold border-t-2 border-l-2 border-r-2 border-gray-100 border-b-white translate-y-[1px]' : 'border-2 border-transparent hover:bg-gray-300'}`}
                    >
                        Browse Alliances
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`px-4 py-1 text-sm ${activeTab === 'create' ? 'bg-white font-bold border-t-2 border-l-2 border-r-2 border-gray-100 border-b-white translate-y-[1px]' : 'border-2 border-transparent hover:bg-gray-300'}`}
                    >
                        Create Alliance
                    </button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto bg-white">
                    {activeTab === 'browse' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg">Active Alliances</h3>
                                <button onClick={fetchAllianceList} className="text-xs underline text-blue-800">Refresh</button>
                            </div>
                            {loading && <p>Loading...</p>}
                            {!loading && allianceList.length === 0 && <p className="text-gray-500 italic">No alliances found.</p>}
                            <div className="space-y-2">
                                {allianceList.map(a => {
                                    const isPending = myRequests.includes(a.id);
                                    return (
                                        <div key={a.id} className="border border-gray-400 p-2 flex justify-between items-center bg-gray-50 shadow-sm hover:bg-yellow-50">
                                            <div>
                                                <div className="font-bold text-[#000080]">{a.name}</div>
                                                <div className="text-xs text-gray-600">{a.description || 'No description'}</div>
                                                <div className="text-xs text-black mt-1">Members: {a.member_count}</div>
                                            </div>
                                            <button
                                                onClick={() => !isPending && handleJoinRequest(a.id)}
                                                disabled={isPending || loading}
                                                className={`px-3 py-1 border-2 text-xs font-bold ${isPending ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed italic' : 'bg-gray-200 border-white border-r-black border-b-black active:border-r-white active:border-b-white'}`}
                                            >
                                                {isPending ? 'Pending' : 'Request to Join'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {activeTab === 'create' && (
                        <div className="max-w-md mx-auto mt-4 border border-gray-400 p-4 bg-gray-50 shadow-md">
                            <h3 className="font-bold text-center mb-4 text-xl">Establish New Alliance</h3>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <div><label className="block text-xs font-bold mb-1">Alliance Name</label><input name="name" className="w-full border border-gray-600 p-1 text-sm" required /></div>
                                <div><label className="block text-xs font-bold mb-1">Description</label><textarea name="description" className="w-full border border-gray-600 p-1 text-sm h-20" /></div>
                                <div className="text-center pt-2"><button type="submit" disabled={loading} className="px-6 py-2 bg-gray-200 border-2 border-white border-r-black border-b-black font-bold">Create</button></div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // DASHBOARD
    const isLeader = myAlliance?.leader_id === session?.user?.id;

    return (
        <div className="h-full flex flex-col bg-gray-100">
            <div className="bg-[#000080] text-white p-2 flex justify-between items-center">
                <div>
                    <span className="font-bold text-lg mr-2">{myAlliance?.name || 'My Alliance'}</span>
                    <span className="text-xs opacity-70">({members.length} Members)</span>
                    {isLeader && <span className="ml-2 text-xs bg-yellow-400 text-black px-1 rounded font-bold">LEADER</span>}
                </div>
                <button onClick={handleLeave} className="text-xs bg-red-800 px-2 py-0.5 border border-red-400 hover:bg-red-700">Leave</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-400 bg-gray-200">
                <button onClick={() => setActiveTab('home')} className={`px-4 py-1 text-sm ${activeTab === 'home' ? 'bg-white font-bold border-t-2 border-l-2 border-r-2 border-gray-100 border-b-white translate-y-[1px]' : 'border-2 border-transparent hover:bg-gray-300'}`}>Home</button>
                <button onClick={() => setActiveTab('overview')} className={`px-4 py-1 text-sm ${activeTab === 'overview' ? 'bg-white font-bold border-t-2 border-l-2 border-r-2 border-gray-100 border-b-white translate-y-[1px]' : 'border-2 border-transparent hover:bg-gray-300'}`}>Members</button>
                <button onClick={() => setActiveTab('chat')} className={`px-4 py-1 text-sm relative ${activeTab === 'chat' ? 'bg-white font-bold border-t-2 border-l-2 border-r-2 border-gray-100 border-b-white translate-y-[1px]' : 'border-2 border-transparent hover:bg-gray-300'}`}>
                    Chat
                    {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full shadow-sm">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </button>
                {isLeader && <button onClick={() => setActiveTab('requests')} className={`px-4 py-1 text-sm ${activeTab === 'requests' ? 'bg-white font-bold border-t-2 border-l-2 border-r-2 border-gray-100 border-b-white translate-y-[1px]' : 'border-2 border-transparent hover:bg-gray-300'}`}>Requests</button>}
            </div>

            <div className="flex-1 overflow-hidden relative bg-white">
                {activeTab === 'home' && (
                    <div className="h-full overflow-y-auto p-4 space-y-6">
                        {/* Announcement / Info */}
                        <div className="border border-gray-400 p-4 bg-[#ffffe0] shadow-sm relative">
                            <h3 className="font-bold text-[#000080] mb-2 border-b border-[#000080] pb-1">Alliance Board</h3>
                            {isLeader && !announcementEdit && (
                                <button onClick={() => setAnnouncementEdit(true)} className="absolute top-2 right-2 text-xs text-blue-600 underline">Edit Info</button>
                            )}

                            {announcementEdit ? (
                                <div>
                                    <textarea
                                        className="w-full h-32 p-2 text-sm border border-gray-400 mb-2"
                                        value={tempAnnouncement}
                                        onChange={(e) => setTempAnnouncement(e.target.value)}
                                        placeholder="Write helpful info, sites, or announcements here..."
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={updateAnnouncement} className="px-3 py-1 bg-green-200 border border-green-500 text-xs font-bold">Save</button>
                                        <button onClick={() => { setAnnouncementEdit(false); setTempAnnouncement(myAlliance.announcement || ''); }} className="px-3 py-1 bg-gray-200 border border-gray-500 text-xs">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm whitespace-pre-wrap min-h-[60px]">
                                    {myAlliance?.announcement ? myAlliance.announcement : <span className="text-gray-500 italic">No announcements from the leader.</span>}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Global Leaderboard */}
                            <div>
                                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                                    <img src="https://win98icons.alexmeub.com/icons/png/world-0.png" className="w-5 h-5" /> Alliance Leaderboard
                                </h3>
                                <div className="border border-gray-400 bg-gray-50">
                                    <div className="grid grid-cols-12 bg-gray-200 p-1 font-bold text-xs border-b border-gray-400">
                                        <div className="col-span-2 text-center">Rank</div>
                                        <div className="col-span-7">Name</div>
                                        <div className="col-span-3 text-right">Score</div>
                                    </div>
                                    {leaderboard.map(l => (
                                        <div key={l.alliance_id} className={`grid grid-cols-12 p-1 text-xs border-b border-gray-200 items-center ${l.alliance_id === stats.alliance_id ? 'bg-yellow-100 font-bold' : ''}`}>
                                            <div className="col-span-2 text-center">#{l.rank}</div>
                                            <div className="col-span-7 truncate">{l.name}</div>
                                            <div className="col-span-3 text-right">{l.total_score.toLocaleString()}</div>
                                        </div>
                                    ))}
                                    {leaderboard.length === 0 && <div className="p-2 text-xs italic text-gray-500">No data available.</div>}
                                </div>
                            </div>

                            {/* Internal Ranking */}
                            <div>
                                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                                    <img src="https://win98icons.alexmeub.com/icons/png/users-1.png" className="w-5 h-5" /> Member Rankings
                                </h3>
                                <div className="border border-gray-400 bg-white max-h-[300px] overflow-y-auto">
                                    {/* Header Row */}
                                    <div className="grid grid-cols-12 bg-gray-200 p-2 font-bold text-xs border-b border-gray-400 sticky top-0">
                                        <div className="col-span-1 text-center">#</div>
                                        <div className="col-span-7">Member</div>
                                        <div className="col-span-4 text-right">Overall Rank</div>
                                    </div>

                                    {members.map((m, idx) => {
                                        const overallRank = m.overall_rank || 999999;

                                        return (
                                            <div key={m.id} className="grid grid-cols-12 p-2 border-b border-gray-100 hover:bg-gray-50 text-xs items-center">
                                                <div className="col-span-1 text-center">
                                                    <span className="font-mono font-bold text-gray-500">#{idx + 1}</span>
                                                </div>
                                                <div className="col-span-7 flex items-center gap-2">
                                                    <img src={getAvatarPath(m.avatar_id)} className="w-6 h-6 border border-gray-300" />
                                                    <span
                                                        className="cursor-pointer hover:underline text-blue-900 font-bold truncate"
                                                        onClick={() => onNavigate('profile', { userId: m.id })}
                                                    >
                                                        {m.username} {m.id === myAlliance?.leader_id && '👑'}
                                                    </span>
                                                </div>
                                                <div className="col-span-4 text-right font-semibold text-gray-700">
                                                    #{overallRank.toLocaleString()}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'overview' && (
                    <div className="h-full overflow-y-auto p-4">
                        <div className="text-sm italic mb-4 p-2 bg-yellow-50 border border-yellow-200 text-gray-700">
                            "{myAlliance?.description || 'Welcome.'}"
                        </div>
                        <h4 className="font-bold border-b border-gray-300 mb-2">Member Roster</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {members.map(m => (
                                <div key={m.id} className="flex items-center gap-2 p-2 border border-gray-200 hover:bg-gray-50 cursor-pointer" onClick={() => onNavigate('profile', { userId: m.id })}>
                                    <img src={getAvatarPath(m.avatar_id)} className="w-8 h-8 object-cover border border-gray-400" alt="" />
                                    <div>
                                        <div className="font-bold text-sm text-[#000080] flex items-center gap-1">
                                            {m.username}
                                            {m.id === myAlliance?.leader_id && <span title="Leader">👑</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="h-full flex flex-col">
                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                            {chatMessages.length === 0 && <p className="text-center text-gray-400 text-sm mt-10">No messages yet. Say hello!</p>}

                            {chatMessages.map(msg => {
                                const isMe = msg.sender_id === session.user.id;
                                return (
                                    <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                                        <div
                                            className="flex-shrink-0 cursor-pointer hover:opacity-80"
                                            title={msg.sender?.username}
                                            onClick={() => onNavigate('profile', { userId: msg.sender_id })}
                                        >
                                            <img src={getAvatarPath(msg.sender?.avatar_id)} className="w-8 h-8 object-cover border border-gray-400 bg-gray-200" alt="" />
                                        </div>
                                        <div className={`max-w-[70%] p-2 rounded border border-gray-400 shadow-sm text-sm ${isMe ? 'bg-[#ffffe0]' : 'bg-gray-100'}`}>
                                            <div className="font-bold text-[10px] text-gray-500 mb-1 flex justify-between gap-2">
                                                <span
                                                    className="cursor-pointer hover:underline hover:text-blue-800"
                                                    onClick={() => onNavigate('profile', { userId: msg.sender_id })}
                                                >
                                                    {msg.sender?.username}
                                                </span>
                                                <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="break-words">{msg.message}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef}></div>
                        </div>

                        {/* Input Area */}
                        <div className="p-2 bg-gray-200 border-t border-gray-400 flex gap-2">
                            <form onSubmit={handleSendMessage} className="flex w-full gap-2">
                                <input
                                    className="flex-1 border border-gray-500 p-2 text-sm focus:outline-none focus:border-blue-600"
                                    placeholder="Message alliance..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                />
                                <button className="px-4 bg-gray-300 border-2 border-white border-r-black border-b-black active:border-r-white active:border-b-white font-bold text-sm">Send</button>
                            </form>
                        </div>
                    </div>
                )}

                {activeTab === 'requests' && isLeader && (
                    <div className="h-full overflow-y-auto p-4">
                        <h4 className="font-bold border-b border-gray-300 mb-4">Pending Join Requests</h4>

                        {joinRequests.length === 0 && (
                            <div className="text-gray-500 italic text-center mt-10">No pending requests.</div>
                        )}

                        <div className="space-y-2">
                            {joinRequests.map(req => (
                                <div key={req.request_id} className="flex justify-between items-center p-2 border border-gray-300 shadow-sm bg-gray-50">
                                    <div className="flex items-center gap-3">
                                        <img src={getAvatarPath(req.avatar_id)} className="w-10 h-10 border border-gray-400" />
                                        <div>
                                            <div className="font-bold cursor-pointer hover:underline text-blue-900" onClick={() => onNavigate('profile', { userId: req.user_id })}>
                                                {req.username}
                                            </div>
                                            <div className="text-[10px] text-gray-500">Requested: {new Date(req.created_at).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApprove(req.request_id)}
                                            className="px-3 py-1 bg-green-100 border border-green-600 text-green-800 text-xs font-bold hover:bg-green-200"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleReject(req.request_id)}
                                            className="px-3 py-1 bg-red-100 border border-red-600 text-red-800 text-xs font-bold hover:bg-red-200"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {modal.show && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="min-w-[300px] max-w-sm bg-gray-200 border-2 border-white border-r-gray-800 border-b-gray-800 shadow-xl p-1">
                        <div className="bg-[#000080] text-white px-2 py-1 font-bold mb-4 flex justify-between items-center bg-gradient-to-r from-[#000080] to-[#1084d0]">
                            <span>
                                {modal.type === 'disband' && 'Disband Alliance'}
                                {modal.type === 'leave' && 'Leave Alliance'}
                                {modal.type === 'alert' && 'Alliance'}
                                {modal.type === 'confirm' && 'Confirm Action'}
                            </span>
                            <button
                                onClick={() => setModal({ show: false, type: '', message: '', onConfirm: null })}
                                className="text-white hover:bg-red-500 px-1 font-bold"
                            >
                                x
                            </button>
                        </div>
                        <div className="px-4 pb-4">
                            <div className="flex items-start gap-4 mb-6">
                                <img
                                    src={modal.type === 'disband' || modal.type === 'leave' || modal.type === 'confirm'
                                        ? "https://win98icons.alexmeub.com/icons/png/msg_question-0.png"
                                        : "https://win98icons.alexmeub.com/icons/png/msg_information-0.png"
                                    }
                                    className="w-8 h-8"
                                    alt=""
                                />
                                {modal.type === 'disband' && (
                                    <img src="https://win98icons.alexmeub.com/icons/png/msg_warning-0.png" className="w-8 h-8 -ml-8" alt="" />
                                )}
                                <p className="text-sm pt-1">{modal.message}</p>
                            </div>
                            <div className="flex justify-center gap-4">
                                {(modal.type === 'leave' || modal.type === 'disband' || modal.type === 'confirm') ? (
                                    <>
                                        <button
                                            onClick={modal.onConfirm}
                                            className="px-6 py-1 bg-gray-200 border-2 border-white border-r-black border-b-black font-bold text-sm active:border-r-white active:border-b-white focus:outline-dotted focus:outline-1 focus:outline-black"
                                        >
                                            {modal.type === 'disband' ? 'Disband' : 'Yes'}
                                        </button>
                                        <button
                                            onClick={() => setModal({ show: false, type: '', message: '', onConfirm: null })}
                                            className="px-6 py-1 bg-gray-200 border-2 border-white border-r-black border-b-black font-bold text-sm active:border-r-white active:border-b-white focus:outline-dotted focus:outline-1 focus:outline-black"
                                        >
                                            {modal.type === 'disband' ? 'Cancel' : 'No'}
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setModal({ show: false, type: '', message: '', onConfirm: null })}
                                        className="px-6 py-1 bg-gray-200 border-2 border-white border-r-black border-b-black font-bold text-sm active:border-r-white active:border-b-white focus:outline-dotted focus:outline-1 focus:outline-black"
                                    >
                                        OK
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Alliance;
