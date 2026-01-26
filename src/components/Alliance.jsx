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

    // Approval System State
    const [myRequests, setMyRequests] = useState([]); // List of alliance IDs I've requested
    const [joinRequests, setJoinRequests] = useState([]); // List of incoming requests (if leader)
    const [modal, setModal] = useState({ show: false, type: '', message: '', onConfirm: null });

    const chatEndRef = useRef(null);

    // Initial Load & Effect to switch modes if stats change
    useEffect(() => {
        if (stats.alliance_id) {
            setActiveTab('overview'); // Force switch if they just joined/created
            fetchMyAllianceData();
            subscribeToChat();
        } else {
            // Only force browse if they were in overview/chat (i.e. they left)
            if (activeTab === 'overview' || activeTab === 'chat' || activeTab === 'requests') {
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




    // --- FETCHING ---

    const fetchAllianceList = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('alliances')
                .select('*') // RLS allows reading all
                .order('member_count', { ascending: false });

            if (error) throw error;
            setAllianceList(data || []);

            // Also fetch my pending requests to show status
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

        // 1. Fetch Alliance Details
        try {
            const { data: allianceData, error: allianceError } = await supabase
                .from('alliances')
                .select('*')
                .eq('id', stats.alliance_id)
                .single();
            if (allianceError) throw allianceError;
            setMyAlliance(allianceData);
        } catch (err) {
            console.error("Error fetching alliance details:", err);
            // If main details fail, we probably can't do much, but let's continue trying to fetch other things just in case, 
            // though without alliance details the UI might be sparse.
        }

        // 2. Fetch Members
        try {
            // Attempt to fetch members with rank/citizens if possible
            const { data: membersData, error: membersError } = await supabase
                .from('profiles')
                .select('id, username, avatar_id, user_stats(rank, citizens)')
                .eq('alliance_id', stats.alliance_id);

            if (membersError) throw membersError;
            setMembers(membersData || []);
        } catch (err) {
            console.error("Error fetching members (trying fallback):", err);
            // Fallback: fetch without user_stats if the relation is missing
            try {
                const { data: fallbackMembers, error: fallbackError } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_id')
                    .eq('alliance_id', stats.alliance_id);
                if (fallbackError) throw fallbackError;
                setMembers(fallbackMembers || []);
            } catch (finalErr) {
                console.error("Failed to fetch members:", finalErr);
            }
        }

        // 3. Fetch Chat History
        try {
            const { data: msgs, error: chatError } = await supabase
                .from('alliance_messages')
                .select('*, sender:sender_id(username, avatar_id)')
                .eq('alliance_id', stats.alliance_id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (chatError) throw chatError;
            setChatMessages((msgs || []).reverse());
        } catch (err) {
            console.error("Error fetching chat:", err);
        }

        setLoading(false);
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

    // ...

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            const { error } = await supabase.rpc('send_alliance_message', { p_message: newMessage });
            if (error) throw error;
            setNewMessage('');
        } catch (err) {
            console.error(err);
            setModal({ show: true, type: 'alert', message: 'Failed to send message: ' + err.message });
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

    // --- RENDER HELPERS ---

    // If NOT in Alliance
    if (!stats.alliance_id) {
        return (
            <div className="h-full flex flex-col bg-gray-100">
                {/* Tabs */}
                {/* Using a simpler tab style for this window */}
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

                            {!loading && allianceList.length === 0 && (
                                <p className="text-gray-500 italic">No alliances found. Be the first to create one!</p>
                            )}

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
                                                className={`px-3 py-1 border-2 text-xs font-bold ${isPending
                                                    ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed italic'
                                                    : 'bg-gray-200 border-white border-r-black border-b-black active:border-r-white active:border-b-white'
                                                    }`}
                                            >
                                                {isPending ? 'Pending Approval' : 'Request to Join'}
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
                                <div>
                                    <label className="block text-xs font-bold mb-1">Alliance Name</label>
                                    <input name="name" className="w-full border border-gray-600 p-1 text-sm" placeholder="e.g. The Royal Guards" maxLength={30} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1">Description</label>
                                    <textarea name="description" className="w-full border border-gray-600 p-1 text-sm h-20" placeholder="Briefly describe your alliance..." maxLength={150} />
                                </div>
                                <div className="text-center pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-6 py-2 bg-gray-200 border-2 border-white border-r-black border-b-black active:border-r-white active:border-b-white font-bold"
                                    >
                                        {loading ? 'Creating...' : 'Create Alliance'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // If matches, render DASHBOARD
    const isLeader = myAlliance?.leader_id === session?.user?.id;

    return (
        <div className="h-full flex flex-col bg-gray-100">
            {/* Header */}
            <div className="bg-[#000080] text-white p-2 flex justify-between items-center">
                <div>
                    <span className="font-bold text-lg mr-2">{myAlliance?.name || 'My Alliance'}</span>
                    <span className="text-xs opacity-70">({members.length} Members)</span>
                    {isLeader && <span className="ml-2 text-xs bg-yellow-400 text-black px-1 rounded font-bold">LEADER</span>}
                </div>
                <button onClick={handleLeave} className="text-xs bg-red-800 px-2 py-0.5 border border-red-400 hover:bg-red-700">Leave</button>
            </div>

            {/* Inner Tabs */}
            <div className="flex border-b border-gray-400 bg-gray-200">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-1 text-sm ${activeTab === 'overview' ? 'bg-white font-bold border-t-2 border-l-2 border-r-2 border-gray-100 border-b-white translate-y-[1px]' : 'border-2 border-transparent hover:bg-gray-300'}`}
                >
                    Members
                </button>
                <button
                    onClick={() => setActiveTab('chat')}
                    className={`px-4 py-1 text-sm relative ${activeTab === 'chat' ? 'bg-white font-bold border-t-2 border-l-2 border-r-2 border-gray-100 border-b-white translate-y-[1px]' : 'border-2 border-transparent hover:bg-gray-300'}`}
                >
                    Chat
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full shadow-sm">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
                {isLeader && (
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`px-4 py-1 text-sm ${activeTab === 'requests' ? 'bg-white font-bold border-t-2 border-l-2 border-r-2 border-gray-100 border-b-white translate-y-[1px]' : 'border-2 border-transparent hover:bg-gray-300'}`}
                    >
                        Requests
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-hidden relative bg-white">
                {activeTab === 'overview' && (
                    <div className="h-full overflow-y-auto p-4">
                        <div className="text-sm italic mb-4 p-2 bg-yellow-50 border border-yellow-200 text-gray-700">
                            "{myAlliance?.description || 'Welcome to the alliance.'}"
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
                                        <div className="flex-shrink-0" title={msg.sender?.username}>
                                            <img src={getAvatarPath(msg.sender?.avatar_id)} className="w-8 h-8 object-cover border border-gray-400 bg-gray-200" alt="" />
                                        </div>
                                        <div className={`max-w-[70%] p-2 rounded border border-gray-400 shadow-sm text-sm ${isMe ? 'bg-[#ffffe0]' : 'bg-gray-100'}`}>
                                            <div className="font-bold text-[10px] text-gray-500 mb-1 flex justify-between gap-2">
                                                <span>{msg.sender?.username}</span>
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
