import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { User, Shield, Lock, Mail, Eye, EyeOff } from 'lucide-react';

export default function Home() {
    const [isAdmin, setIsAdmin] = useState(false);

    // Separate state for Admin and User
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');

    const [userLoginId, setUserLoginId] = useState('');
    const [userPassword, setUserPassword] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setMsg('');

        try {
            const payload = isAdmin
                ? { email: adminEmail, password: adminPassword }
                : { loginId: userLoginId, password: userPassword };

            const res = await axios.post('/api/auth/login', payload);
            const user = res.data.user;

            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('user', JSON.stringify(user));

            // Force reload to ensure socket and state are clean, which fixes the blank screen issue
            window.location.href = isAdmin && user.role === 'admin' ? '/admin' : '/chat';
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        }
    };

    const handleForgotPassword = async () => {
        if (isAdmin && !adminEmail) {
            setError('Please enter your email to reset password');
            return;
        }
        if (!isAdmin && !userLoginId) {
            setError('Please enter your Login ID to request password reset');
            return;
        }

        try {
            const payload = isAdmin ? { email: adminEmail } : { loginId: userLoginId };
            await axios.post('/api/auth/forgot-password', payload);
            setMsg('Password reset request sent to Admin.');
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Request failed');
            setMsg('');
        }
    };

    return (
        <div className="center-page">
            <div className="card">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>NeuralChat</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Secure AI-Powered Communication</p>
                </div>

                <div style={{ display: 'flex', marginBottom: '2rem', background: '#f3f4f6', padding: '0.25rem', borderRadius: '0.5rem' }}>
                    <button
                        type="button"
                        className={!isAdmin ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => { setIsAdmin(false); setError(''); setMsg(''); }}
                        style={{ borderRadius: '0.4rem', border: 'none' }}
                    >
                        <User size={18} style={{ display: 'inline', marginRight: '5px' }} />
                        User Login
                    </button>
                    <button
                        type="button"
                        className={isAdmin ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => { setIsAdmin(true); setError(''); setMsg(''); }}
                        style={{ borderRadius: '0.4rem', border: 'none' }}
                    >
                        <Shield size={18} style={{ display: 'inline', marginRight: '5px' }} />
                        Admin Login
                    </button>
                </div>

                <form onSubmit={handleLogin}>
                    {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', padding: '0.5rem', background: '#fee2e2', borderRadius: '0.5rem' }}>{error}</div>}
                    {msg && <div style={{ color: 'var(--success)', marginBottom: '1rem', padding: '0.5rem', background: '#d1fae5', borderRadius: '0.5rem' }}>{msg}</div>}

                    {isAdmin ? (
                        <>
                            <div className="form-group">
                                <label>Email Address</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={18} style={{ position: 'absolute', top: '12px', left: '10px', color: '#9ca3af' }} />
                                    <input
                                        type="email"
                                        value={adminEmail}
                                        onChange={(e) => setAdminEmail(e.target.value)}
                                        placeholder="Enter your email"
                                        style={{ paddingLeft: '2.5rem' }}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={18} style={{ position: 'absolute', top: '12px', left: '10px', color: '#9ca3af' }} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={adminPassword}
                                        onChange={(e) => setAdminPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: '#9ca3af', width: 'auto' }}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="form-group">
                                <label>Login ID</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={18} style={{ position: 'absolute', top: '12px', left: '10px', color: '#9ca3af' }} />
                                    <input
                                        type="text"
                                        value={userLoginId}
                                        onChange={(e) => setUserLoginId(e.target.value)}
                                        placeholder="Enter your Login ID"
                                        style={{ paddingLeft: '2.5rem' }}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={18} style={{ position: 'absolute', top: '12px', left: '10px', color: '#9ca3af' }} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={userPassword}
                                        onChange={(e) => setUserPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: '#9ca3af', width: 'auto' }}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    <button type="submit" className="btn-primary" style={{ marginBottom: '1rem' }}>
                        Login as {isAdmin ? 'Admin' : 'User'}
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                        {isAdmin ? (
                            <>
                                <Link to="/admin-reset" className="link" style={{ color: 'var(--primary)', fontWeight: '500' }}>Forgot Password?</Link>
                                <Link to="/admin-register" className="link">Create Admin Account</Link>
                            </>
                        ) : (
                            <>
                                <button type="button" onClick={handleForgotPassword} style={{ background: 'none', border: 'none', color: 'var(--primary)', width: 'auto', padding: 0, fontWeight: '500' }}>
                                    Forgot Password?
                                </button>
                                <Link to="/register" className="link">Create an Account</Link>
                            </>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
