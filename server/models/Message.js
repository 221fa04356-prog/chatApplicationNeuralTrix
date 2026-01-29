const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, required: true }, // 'user' or 'ai'
    content: { type: String },
    type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    file_path: { type: String },
    reply_to: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    is_pinned: { type: Boolean, default: false },
    is_starred: { type: Boolean, default: false },
    is_deleted_by_admin: { type: Boolean, default: false },
    is_flagged: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

module.exports = mongoose.model('Message', messageSchema);
