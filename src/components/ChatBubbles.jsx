import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import ChatWindow from './ChatWindow';

export default function ChatBubbles({ session }) {
    const [conversations, setConversations] = useState([]);
    const [openChats, setOpenChats] = useState([]); // Array of conversation IDs
    const [minimizedChats, setMinimizedChats] = useState([]); // Array of conversation IDs

    useEffect(() => {
        if (session) {
            fetchConversations();
            subscribeToConversations();
        }
    }, [session]);

    const fetchConversations = async () => {
        try {
            const { data, error } = await supabase.rpc('get_chat_conversations');
            if (error) throw error;
            setConversations(data || []);

            // Auto-open chats with unread messages
            if (data) {
                const unreadIds = data.filter(c => c.unread_count > 0).map(c => c.conversation_id);
                if (unreadIds.length > 0) {
                    setOpenChats(prev => {
                        const newIds = unreadIds.filter(id => !prev.includes(id));
                        if (newIds.length > 0) {
                            setMinimizedChats(prevMin => {
                                const newMinIds = newIds.filter(id => !prevMin.includes(id));
                                return [...prevMin, ...newMinIds];
                            });
                            const combined = [...prev, ...newIds];
                            return combined.slice(-3);
                        }
                        return prev;
                    });
                }
            }
        } catch (err) {
            console.error('Error fetching conversations:', err);
        }
    };

    const subscribeToConversations = () => {
        const channel = supabase
            .channel('chat_notifications')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_conversations',
                    filter: `user1_id=eq.${session.user.id}`
                },
                () => fetchConversations()
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_conversations',
                    filter: `user2_id=eq.${session.user.id}`
                },
                () => fetchConversations()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    const handleBubbleClick = (conv) => {
        if (openChats.includes(conv.conversation_id)) {
            // If open but minimized, maximize it
            if (minimizedChats.includes(conv.conversation_id)) {
                setMinimizedChats(prev => prev.filter(id => id !== conv.conversation_id));
            } else {
                // If open and maximized, minimize it
                setMinimizedChats(prev => [...prev, conv.conversation_id]);
            }
        } else {
            // Open new chat
            setOpenChats(prev => [...prev, conv.conversation_id]);
            if (openChats.length >= 3) {
                setOpenChats(prev => prev.slice(1));
            }
        }
    };

    const handleCloseChat = (convId) => {
        setOpenChats(prev => prev.filter(id => id !== convId));
        setMinimizedChats(prev => prev.filter(id => id !== convId));
    };

    const handleMinimizeChat = (convId) => {
        if (minimizedChats.includes(convId)) {
            setMinimizedChats(prev => prev.filter(id => id !== convId));
        } else {
            setMinimizedChats(prev => [...prev, convId]);
        }
    };

    // Expose a global function to open chat
    useEffect(() => {
        window.openChatWith = async (userId, username) => {
            const existingConv = conversations.find(c => c.other_user_id === userId);

            if (existingConv) {
                if (!openChats.includes(existingConv.conversation_id)) {
                    setOpenChats(prev => [...prev, existingConv.conversation_id]);
                }
                setMinimizedChats(prev => prev.filter(id => id !== existingConv.conversation_id));
            } else {
                try {
                    const { data } = await supabase
                        .from('chat_conversations')
                        .select('id')
                        .or(`and(user1_id.eq.${session.user.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${session.user.id})`)
                        .single();

                    if (data) {
                        const newConv = {
                            conversation_id: data.id,
                            other_user_id: userId,
                            other_user_name: username,
                            unread_count: 0
                        };
                        setConversations(prev => [newConv, ...prev]);
                        setOpenChats(prev => [...prev, data.id]);
                        setMinimizedChats(prev => prev.filter(id => id !== data.id));
                    } else {
                        // Create empty/start
                        const { data: newConvData, error } = await supabase.rpc('send_chat_message', {
                            p_recipient_id: userId,
                            p_message: '👋'
                        });
                        // Assume this triggers update via subscription or we can re-fetch
                        fetchConversations();
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        };
    }, [conversations, openChats, session]);

    return (
        <div className="fixed bottom-12 right-4 flex flex-col items-end gap-2 z-[60] pointer-events-none">
            {/* Chat Windows Container */}
            <div className="fixed bottom-0 right-20 flex flex-row-reverse gap-4 pointer-events-auto items-end">
                {openChats.map(chatId => {
                    const conv = conversations.find(c => c.conversation_id === chatId);
                    if (!conv) return null;
                    // Don't render window if minimized (bubbles handle that)
                    // But ChatWindow handles its own minimized state if passed 'isMinimized'?
                    // Actually ChatWindow returns null if minimized. So we render it always.
                    return (
                        <ChatWindow
                            key={chatId}
                            conversationId={chatId}
                            otherUser={{ id: conv.other_user_id, username: conv.other_user_name }}
                            onClose={() => handleCloseChat(chatId)}
                            onMinimize={() => handleMinimizeChat(chatId)}
                            isMinimized={minimizedChats.includes(chatId)}
                        />
                    );
                })}
            </div>

            {/* Chat Bubbles (Minimized or Active Icons) */}
            <div className="flex flex-col gap-1 pointer-events-auto">
                {openChats.map(chatId => {
                    const conv = conversations.find(c => c.conversation_id === chatId);
                    if (!conv) return null;
                    const isMin = minimizedChats.includes(chatId);

                    return (
                        <div
                            key={conv.conversation_id}
                            onClick={() => handleBubbleClick(conv)}
                            className={`relative w-32 h-8 cursor-pointer flex items-center px-1 gap-2 text-xs font-bold
                                ${!isMin
                                    ? 'bg-[#e0e0e0] border-2 border-gray-600 border-b-white border-r-white border-t-black border-l-black shadow-[inset_1px_1px_0px_#000]'
                                    : 'bg-[#c0c0c0] border-2 border-white border-r-black border-b-black'
                                }`}
                            title={conv.other_user_name}
                        >
                            <span className="text-black">💬</span>
                            <span className="truncate text-black">{conv.other_user_name}</span>

                            {/* Unread Badge - Red box */}
                            {conv.unread_count > 0 && (
                                <div className="absolute -top-1 -left-1 w-4 h-4 bg-red-600 text-white text-[9px] font-bold flex items-center justify-center border border-white z-10">
                                    {conv.unread_count}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
