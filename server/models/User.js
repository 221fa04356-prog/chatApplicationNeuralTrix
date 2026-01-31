const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    mobile: { type: String, unique: true, required: true },
    designation: { type: String },
    login_id: { type: String, unique: true, sparse: true }, // sparse allows null/undefined to not clash
    password: { type: String }, // optional for initial request? No, usually required.
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
    created_at: { type: Date, default: Date.now }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

module.exports = mongoose.model('User', userSchema);
