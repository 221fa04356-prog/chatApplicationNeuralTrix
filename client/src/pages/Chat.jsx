import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Send, Paperclip, LogOut, File, Image as ImageIcon, MoreVertical, Reply, Forward, Pin, Star, Copy, Info, X, Check, CheckCheck, ChevronDown } from 'lucide-react';

export default function Chat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [file, setFile] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, msg: null });
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const navigate = useNavigate();
    const bottomRef = useRef(null);
    const fileInputRef = useRef(null);

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleAction = async (action, msg) => {
        setContextMenu({ ...contextMenu, visible: false });
        if (action === 'reply') {
            setReplyingTo(msg);
            document.querySelector('input[type="text"]')?.focus();
        } else if (action === 'forward') {
            setInput(msg.content || (msg.type === 'image' ? '[Image]' : '[File]'));
        } else if (action === 'copy') {
            if (msg.content) navigator.clipboard.writeText(msg.content);
        } else if (action === 'pin') {
            await axios.post(`/api/chat/message/${msg.id}/toggle`, { action: 'pin', value: !msg.is_pinned });
            fetchHistory();
        } else if (action === 'star') {
            await axios.post(`/api/chat/message/${msg.id}/toggle`, { action: 'star', value: !msg.is_starred });
            fetchHistory();
        } else if (action === 'info') {
            alert(`Sent: ${new Date(msg.created_at).toLocaleString()}`);
        }
    };

    useEffect(() => {
        if (!user.id) navigate('/');
        fetchHistory();
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`/api/chat/history/${user.id}`);
            setMessages(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() && !file) return;

        const formData = new FormData();
        formData.append('userId', user.id);
        formData.append('content', input);
        if (file) formData.append('file', file);
        if (replyingTo) formData.append('replyTo', replyingTo.id);

        // Optimistic UI update
        const tempMsg = {
            id: Date.now(),
            role: 'user',
            content: input,
            type: file ? (file.type.startsWith('image/') ? 'image' : 'file') : 'text',
            file_path: file ? URL.createObjectURL(file) : null
        };
        setMessages(prev => [...prev, tempMsg]);
        setInput('');
        setFile(null);
        setReplyingTo(null);

        try {
            const res = await axios.post('/api/chat/send', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Refresh to get real path and AI response
            fetchHistory();
        } catch (err) {
            console.error(err);
        }
    };

    const logout = () => {
        localStorage.removeItem('user');
        navigate('/');
    };

    const renderContent = (msg) => {
        if (msg.is_deleted_by_admin) {
            return <span>🚫 This message was deleted by admin</span>;
        }
        if (msg.type === 'image') {
            return (
                <div>
                    <img src={msg.file_path} alt="upload" style={{ maxWidth: '200px', borderRadius: '0.5rem' }} />
                    {msg.content && <p>{msg.content}</p>}
                </div>
            );
        }
        if (msg.type === 'file') {
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.1)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                    <File size={16} />
                    <a href={msg.file_path} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                        View Attached File
                    </a>
                    {msg.content && <span>{msg.content}</span>}
                </div>
            );
        }
        return <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'white' }}>
            {/* Header */}
            <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ color: 'var(--primary)' }}>NeuralChat</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span>Welcome, {user.name}</span>
                    <button className="btn-secondary" style={{ width: 'auto', padding: '0.5rem' }} onClick={logout}>
                        <LogOut size={16} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', background: '#f9fafb' }}>
                <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {messages.map((msg) => {
                        const isUser = msg.role === 'user';
                        return (
                            <div key={msg.id} style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: isUser ? '70%' : '60%' }}>
                                <div style={{
                                    padding: '1rem',
                                    paddingRight: '2rem', // Make room for chevron
                                    borderRadius: '1rem',
                                    borderBottomRightRadius: isUser ? 0 : '1rem',
                                    borderBottomLeftRadius: isUser ? '1rem' : 0,
                                    background: isUser ? 'var(--primary)' : 'white',
                                    color: isUser ? 'white' : 'var(--text-main)',
                                    boxShadow: isUser ? 'var(--shadow)' : 'var(--shadow-sm)',
                                    border: isUser ? 'none' : '1px solid #e5e7eb',
                                    position: 'relative',
                                    minWidth: '120px',
                                    fontStyle: msg.is_deleted_by_admin ? 'italic' : 'normal',
                                    opacity: msg.is_deleted_by_admin ? 0.7 : 1
                                }}
                                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                                    onMouseLeave={() => setHoveredMessageId(null)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, msg });
                                    }}>
                                    {/* Pinned/Starred Icons */}
                                    {!msg.is_deleted_by_admin && (
                                        <div style={{ display: 'flex', gap: '5px', marginBottom: '5px', fontSize: '0.8rem', color: isUser ? '#e0e7ff' : '#6b7280' }}>
                                            {msg.is_pinned && <Pin size={12} fill="currentColor" />}
                                            {msg.is_starred && <Star size={12} fill="currentColor" />}
                                        </div>
                                    )}

                                    {/* Quoted Message */}
                                    {msg.reply_to && !msg.is_deleted_by_admin && (
                                        <div style={{
                                            background: 'rgba(0,0,0,0.1)',
                                            padding: '0.5rem',
                                            borderRadius: '0.5rem',
                                            marginBottom: '0.5rem',
                                            borderLeft: '4px solid #6366f1',
                                            fontSize: '0.85rem'
                                        }}>
                                            <div style={{ fontWeight: 'bold' }}>{msg.reply_to.role === 'user' ? 'You' : 'AI'}</div>
                                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                                {msg.reply_to.type === 'text' ? msg.reply_to.content : `[${msg.reply_to.type}]`}
                                            </div>
                                        </div>
                                    )}

                                    {renderContent(msg)}

                                    {/* Meta Row: Time & Ticks */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        marginTop: '0.3rem',
                                        fontSize: '0.7rem',
                                        color: isUser ? 'rgba(255,255,255,0.8)' : '#9ca3af'
                                    }}>
                                        <span>{formatTime(msg.created_at)}</span>
                                        {isUser && <CheckCheck size={14} color="#93c5fd" />}
                                    </div>

                                    {/* Top Right Dropdown Trigger */}
                                    {(hoveredMessageId === msg.id || contextMenu.msg?.id === msg.id) && (
                                        <ChevronDown
                                            size={18}
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                cursor: 'pointer',
                                                opacity: 1, // Full opacity when visible
                                                color: isUser ? 'white' : '#374151',
                                                zIndex: 5
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setContextMenu({ visible: true, x: e.clientX, y: e.clientY, msg });
                                            }}
                                        />
                                    )}
                                </div>
                                {/* Timestamp could go here */}
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Replying Banner */}
            {replyingTo && (
                <div style={{ padding: '0.5rem 1rem', background: '#eef2ff', borderTop: '1px solid #e0e7ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Replying to {replyingTo.role === 'user' ? 'You' : 'AI'}</span>
                        <div style={{ color: '#6b7280', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                            {replyingTo.type === 'text' ? replyingTo.content : `[${replyingTo.type}]`}
                        </div>
                    </div>
                    <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={18} color="#6b7280" />
                    </button>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu.visible && (
                <div
                    style={{
                        position: 'fixed',
                        left: contextMenu.x - 140, // Shift left
                        top: contextMenu.y > window.innerHeight - 300 ? 'auto' : contextMenu.y,
                        bottom: contextMenu.y > window.innerHeight - 300 ? (window.innerHeight - contextMenu.y) : 'auto',
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        borderRadius: '0.5rem',
                        zIndex: 1000,
                        overflow: 'hidden'
                    }}
                    onClick={() => setContextMenu({ ...contextMenu, visible: false })}
                >
                    <div className="menu-item" onClick={() => handleAction('info', contextMenu.msg)} style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', hover: { background: '#f3f4f6' } }}>
                        <Info size={16} /> Info
                    </div>
                    <div className="menu-item" onClick={() => handleAction('reply', contextMenu.msg)} style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Reply size={16} /> Reply
                    </div>
                    <div className="menu-item" onClick={() => handleAction('copy', contextMenu.msg)} style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Copy size={16} /> Copy
                    </div>
                    <div className="menu-item" onClick={() => handleAction('forward', contextMenu.msg)} style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Forward size={16} /> Forward
                    </div>
                    <div className="menu-item" onClick={() => handleAction('pin', contextMenu.msg)} style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Pin size={16} /> {contextMenu.msg.is_pinned ? 'Unpin' : 'Pin'}
                    </div>
                    <div className="menu-item" onClick={() => handleAction('star', contextMenu.msg)} style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Star size={16} fill={contextMenu.msg.is_starred ? '#fbbf24' : 'none'} color={contextMenu.msg.is_starred ? '#fbbf24' : 'currentColor'} /> {contextMenu.msg.is_starred ? 'Unstar' : 'Star'}
                    </div>
                </div>
            )}
            {/* Overlay to close menu */}
            {contextMenu.visible && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} onClick={() => setContextMenu({ ...contextMenu, visible: false })} />}

            {/* Input */}
            <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', background: 'white' }}>
                <form onSubmit={handleSend} className="container" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        style={{ width: 'auto', padding: '0.75rem', background: '#f3f4f6', borderRadius: '50%' }}
                        title="Attach File/Image"
                    >
                        <Paperclip size={20} color="#6b7280" />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".jpg,.jpeg,.png,.gif,.webp,.doc,.docx"
                        onChange={(e) => {
                            const selected = e.target.files[0];
                            if (!selected) return;

                            const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'doc', 'docx'];
                            const ext = selected.name.split('.').pop().toLowerCase();

                            if (allowedExts.includes(ext)) {
                                setFile(selected);
                            } else {
                                alert('This file format is not supported.\n\nSupported formats: .jpg, .jpeg, .png, .gif, .webp, .doc, .docx');
                                e.target.value = null; // Clear input
                                setFile(null);
                            }
                        }}
                        style={{ display: 'none' }}
                    />
                    {file && (
                        <div style={{ padding: '0.2rem 0.5rem', background: '#e0e7ff', borderRadius: '1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {file.name}
                            <button type="button" onClick={() => setFile(null)} style={{ border: 'none', background: 'none', color: 'red', padding: 0, width: 'auto' }}>x</button>
                        </div>
                    )}

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a message..."
                        style={{ flex: 1, borderRadius: '2rem' }}
                    />
                    <button type="submit" className="btn-primary" style={{ width: 'auto', borderRadius: '2rem', padding: '0.75rem 1.5rem' }}>
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}
