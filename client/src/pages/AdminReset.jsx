import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Shield, Lock, Mail, Key, Eye, EyeOff } from 'lucide-react';

export default function AdminReset() {
    const [formData, setFormData] = useState({ email: '', newPassword: '', confirmPassword: '', secretKey: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.newPassword !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        try {
            await axios.post('/api/auth/admin/reset', formData);
            alert('Password Reset Successful! Please Login.');
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Reset failed');
        }
    };

    return (
        <div className="center-page">
            <div className="card">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '1.8rem', color: 'var(--primary)' }}>Admin Recovery</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Reset Access using Master Key</p>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', background: '#fee2e2', padding: '0.5rem', borderRadius: '0.5rem' }}>{error}</div>}

                    <div className="form-group">
                        <label>Admin Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', top: '12px', left: '10px', color: '#9ca3af' }} />
                            <input
                                type="email"
                                placeholder="Enter Registered Email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                style={{ paddingLeft: '2.5rem' }}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>New Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', top: '12px', left: '10px', color: '#9ca3af' }} />
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter New Password"
                                value={formData.newPassword}
                                onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
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

                    <div className="form-group">
                        <label>Confirm Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', top: '12px', left: '10px', color: '#9ca3af' }} />
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm new Password"
                                value={formData.confirmPassword}
                                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: '#9ca3af', width: 'auto' }}
                            >
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Secret Key</label>
                        <div style={{ position: 'relative' }}>
                            <Key size={18} style={{ position: 'absolute', top: '12px', left: '10px', color: '#9ca3af' }} />
                            <input
                                type="password"
                                placeholder="Master Secret Key"
                                value={formData.secretKey}
                                onChange={e => setFormData({ ...formData, secretKey: e.target.value })}
                                style={{ paddingLeft: '2.5rem' }}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn-primary">Reset Password</button>

                    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                        <Link to="/" className="link">Back to Login</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
