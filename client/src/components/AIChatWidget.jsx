import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, MessageCircle, X, Paperclip, File, Image as ImageIcon } from 'lucide-react';
import '../styles/AIChatWidget.css'; // We'll create this CSS next

export default function AIChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('Agent is thinking...');
    const [loadingCategory, setLoadingCategory] = useState('text');

    // Drag State
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    const bottomRef = useRef(null);
    const fileInputRef = useRef(null);

    // Auth context (simulated check)
    // Auth State
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));

    useEffect(() => {
        const handleAuthChange = () => {
            setUser(JSON.parse(localStorage.getItem('user') || '{}'));
        };
        window.addEventListener('authChange', handleAuthChange);
        return () => window.removeEventListener('authChange', handleAuthChange);
    }, []);

    useEffect(() => {
        if (isOpen && user.id) {
            fetchHistory();
        }
    }, [isOpen, user.id]);

    // Ensure widget is hidden on login/register pages regardless of local storage state
    if (!user.id || ['/', '/register', '/admin-register', '/admin-reset'].includes(window.location.pathname)) {
        return null;
    }

    const hasMoved = useRef(false);

    // Drag Effects
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - dragStartRef.current.x;
            const dy = e.clientY - dragStartRef.current.y;

            // Only consider it a move if significant (fixes overly sensitive clicks)
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                hasMoved.current = true;
            }

            setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            dragStartRef.current = { x: e.clientX, y: e.clientY };
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const handleMouseDown = (e) => {
        setIsDragging(true);
        hasMoved.current = false; // Reset move tracking
        dragStartRef.current = { x: e.clientX, y: e.clientY };
    };

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen, isLoading]);

    // Loading Animation Effect
    useEffect(() => {
        let interval;
        if (isLoading) {
            if (loadingCategory === 'text') {
                setLoadingText('Agent is thinking...');
            } else {
                const step1 = loadingCategory === 'image' ? "Analyzing the picture..." : "Analyzing the document...";
                const texts = [step1, "Generating Response..."];
                let index = 0;
                setLoadingText(texts[0]);
                interval = setInterval(() => {
                    index = (index + 1) % texts.length;
                    setLoadingText(texts[index]);
                }, 2000);
            }
        } else {
            setLoadingText('');
        }
        return () => clearInterval(interval);
    }, [isLoading, loadingCategory]);

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`/api/chat/history/${user.id}`);
            setMessages(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const getFriendlyDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            day: 'numeric',
            month: 'short'
        });
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() && !file) return;

        const formData = new FormData();
        formData.append('userId', user.id);
        formData.append('content', input);
        if (file) formData.append('file', file);

        let category = 'text';
        if (file) {
            category = file.type.startsWith('image/') ? 'image' : 'file';
        }
        setLoadingCategory(category);

        const tempMsg = {
            id: Date.now(),
            role: 'user',
            content: input,
            type: category,
            file_path: file ? URL.createObjectURL(file) : null
        };
        setMessages(prev => [...prev, tempMsg]);
        setInput('');
        setFile(null);
        setIsLoading(true);

        try {
            await axios.post('/api/chat/send', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            fetchHistory();
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = (e) => {
        // Prevent toggle if it was a drag gesture
        if (hasMoved.current) return;
        setIsOpen(!isOpen);
    };

    return (
        <div
            className={`ai-widget-container ${isOpen ? 'open' : ''}`}
            style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        >
            {!isOpen && (
                <div
                    className="ai-toggle-btn"
                    onMouseDown={handleMouseDown}
                    onClick={handleToggle}
                    style={{ cursor: 'move' }}
                >
                    <MessageCircle size={32} />
                </div>
            )}

            {isOpen && (
                <div className="ai-chat-window">
                    <div
                        className="ai-header"
                        onMouseDown={handleMouseDown}
                        style={{ cursor: 'move' }}
                    >
                        <h3>AI Assistant</h3>
                        <button onClick={() => setIsOpen(false)} className="close-icon-btn"><X size={24} /></button>
                    </div>

                    <div className="ai-messages">
                        {messages.map((msg, idx) => {
                            const msgDate = msg.created_at ? new Date(msg.created_at).toDateString() : null;
                            const prevMsgDate = idx > 0 && messages[idx - 1].created_at ? new Date(messages[idx - 1].created_at).toDateString() : null;
                            const showSeparator = msgDate && msgDate !== prevMsgDate;

                            return (
                                <React.Fragment key={msg.id}>
                                    {showSeparator && (
                                        <div style={{ textAlign: 'center', margin: '1rem 0', position: 'relative', width: '100%' }}>
                                            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(0,0,0,0.05)', zIndex: 0 }}></div>
                                            <span style={{ background: '#f8fafc', padding: '0 0.5rem', fontSize: '0.65rem', color: '#94a3b8', position: 'relative', zIndex: 1, fontWeight: '600' }}>
                                                {getFriendlyDate(msg.created_at)}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`ai-message ${msg.role}`}>
                                        {msg.type === 'image' && <img src={msg.file_path} alt="upload" className="msg-img" />}
                                        {msg.type === 'file' && (
                                            <div className="file-attachment">
                                                <File size={14} />
                                                <a href={msg.file_path} target="_blank" rel="noreferrer">File</a>
                                            </div>
                                        )}
                                        <p>{msg.content}</p>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                        {isLoading && (
                            <div className="ai-message model loading">
                                <div className="loader"></div>
                                <span>{loadingText}</span>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    <form onSubmit={handleSend} className="ai-input-area">
                        <button type="button" onClick={() => fileInputRef.current.click()} className="icon-btn">
                            <Paperclip size={18} />
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".jpg,.jpeg,.png,.doc,.docx"
                            onChange={(e) => setFile(e.target.files[0])}
                        />
                        {file && <span className="file-badge">{file.name}</span>}
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask AI..."
                        />
                        <button type="submit" className="send-btn"><Send size={18} /></button>
                    </form>
                </div>
            )}
        </div>
    );
}
