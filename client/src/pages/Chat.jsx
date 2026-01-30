import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Send, LogOut, CheckCheck } from 'lucide-react';
import io from 'socket.io-client';

const socket = io('http://localhost:3000'); // Adjust if deployed

export default function Chat() {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const navigate = useNavigate();
    const bottomRef = useRef(null);

    useEffect(() => {
        if (!user.id) {
            navigate('/');
            return;
        }

        // Join my own room
        socket.emit('join_room', user.id);

        // Fetch Users
        fetchUsers();

        // Listen for incoming messages
        socket.on('receive_message', (data) => {
            // Only add if chatting with the sender OR if I want to update unread counts (not implemented yet)
            setMessages(prev => {
                // If I am chatting with the sender, append
                if (selectedUser && data.sender_id === selectedUser._id) {
                    return [...prev, { ...data, role: 'user', created_at: new Date() }];
                }
                return prev;
            });
        });

        return () => {
            socket.off('receive_message');
        };
    }, [selectedUser]); // Dependency on selectedUser to know context

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/chat/users');
            // Filter out self
            setUsers(res.data.filter(u => u._id !== user.id));
        } catch (err) {
            console.error(err);
        }
    };

    const fetchP2PRequest = async (otherId) => {
        try {
            const res = await axios.get(`/api/chat/p2p/${user.id}/${otherId}`);
            setMessages(res.data);
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch (err) {
            console.error(err);
        }
    };

    const handleUserSelect = (u) => {
        setSelectedUser(u);
        fetchP2PRequest(u._id);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || !selectedUser) return;

        const tempMsg = {
            id: Date.now(),
            sender_id: user.id, // Display purpose
            receiver_id: selectedUser._id,
            role: 'user', // visual style
            content: input,
            type: 'text',
            created_at: new Date()
        };

        // Optimistic Update
        setMessages(prev => [...prev, tempMsg]);
        setInput('');

        // Socket Emit
        socket.emit('send_message', {
            sender_id: user.id,
            receiverId: selectedUser._id,
            content: input,
            type: 'text',
            role: 'user'
        });

        // Save to DB
        try {
            await axios.post('/api/chat/send', {
                userId: user.id,
                toUserId: selectedUser._id,
                content: input
            });
        } catch (err) {
            console.error("Failed to save msg", err);
        }
    };

    const logout = () => {
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('authChange'));
        window.location.href = '/'; // Hard reload to prevent blank screen
    };

    return (
        <div style={{ display: 'flex', height: '100vh', background: '#f3f4f6' }}>
            {/* Sidebar */}
            <div style={{ width: '300px', background: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: 'var(--primary)' }}>Contacts</h3>
                    <button className="btn-secondary" style={{ padding: '0.4rem' }} onClick={logout} title="Logout">
                        <LogOut size={16} />
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {users.map(u => (
                        <div
                            key={u._id}
                            onClick={() => handleUserSelect(u)}
                            style={{
                                padding: '1rem',
                                borderBottom: '1px solid #f3f4f6',
                                cursor: 'pointer',
                                background: selectedUser?._id === u._id ? '#eef2ff' : 'white'
                            }}
                        >
                            <div style={{ fontWeight: 'bold' }}>{u.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{u.email}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Chat Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {selectedUser ? (
                    <>
                        {/* Header */}
                        <div style={{ padding: '1rem', background: 'white', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold' }}>
                            {selectedUser.name}
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {messages.map((msg, idx) => {
                                    // Identify if I sent it
                                    const isMe = (msg.sender_id === user.id) || (msg.user_id === user.id);
                                    return (
                                        <div key={idx} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                                            <div style={{
                                                padding: '1rem',
                                                borderRadius: '1rem',
                                                borderBottomRightRadius: isMe ? 0 : '1rem',
                                                borderBottomLeftRadius: isMe ? '1rem' : 0,
                                                background: isMe ? 'var(--primary)' : 'white',
                                                color: isMe ? 'white' : 'black',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                            }}>
                                                {msg.content}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.2rem', textAlign: isMe ? 'right' : 'left' }}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={bottomRef} />
                            </div>
                        </div>

                        {/* Input */}
                        <div style={{ padding: '1rem', background: 'white', borderTop: '1px solid #e5e7eb' }}>
                            <form onSubmit={handleSend} style={{ display: 'flex', gap: '1rem' }}>
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Type a message..."
                                    style={{ flex: 1, padding: '0.75rem', borderRadius: '2rem', border: '1px solid #e5e7eb' }}
                                />
                                <button type="submit" className="btn-primary" style={{ borderRadius: '50%', width: '48px', height: '48px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Send size={20} />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#9ca3af' }}>
                        Select a user to start chatting
                    </div>
                )}
            </div>
        </div>
    );
}
