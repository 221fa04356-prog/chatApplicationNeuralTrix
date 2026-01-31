import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Shield, Lock, Mail, User, Key, Eye, EyeOff } from 'lucide-react';

export default function AdminRegister() {
    const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '', secretKey: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validations
        const nameRegex = /^[a-zA-Z\s]+$/;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

        if (!nameRegex.test(formData.name)) {
            setError('Full Name must contain only alphabets');
            return;
        }

        if (!emailRegex.test(formData.email)) {
            setError('Please enter a valid email address');
            return;
        }

        if (!passwordRegex.test(formData.password)) {
            setError('Password must be at least 8 characters long and include an uppercase letter, a number, and a special character');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        try {
            await axios.post('/api/auth/admin/register', formData);
            alert('Admin Account Created! Please Login.');
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed');
        }
    };

    return (
        <div className="center-page">
            <div className="card">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '1.8rem', color: 'var(--primary)' }}>Admin Registration</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Secure Enrollment</p>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', background: '#fee2e2', padding: '0.5rem', borderRadius: '0.5rem' }}>{error}</div>}

                    <div className="form-group">
                        <label>Full Name</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', top: '12px', left: '10px', color: '#9ca3af' }} />
                            <input
                                type="text"
                                placeholder="Enter Name"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                style={{ paddingLeft: '2.5rem' }}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Email Address</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', top: '12px', left: '10px', color: '#9ca3af' }} />
                            <input
                                type="email"
                                placeholder="Enter Email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
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
                                placeholder="Enter Password"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
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
                                placeholder="Confirm Password"
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

                    <button type="submit" className="btn-primary">Create Admin Account</button>

                    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                        <Link to="/" className="link">Back to Login</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
