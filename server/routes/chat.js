const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Message = require('../models/Message');
const User = require('../models/User'); // Import User model
const Groq = require('groq-sdk');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
let pdfImgConvert;
try {
    pdfImgConvert = require('pdf-img-convert');
} catch (e) {
    console.error("Warning: pdf-img-convert not found. PDF image features will be disabled.", e.message);
}
const fs = require('fs');
// const Filter = require('bad-words');
// const filter = new Filter();

const badWords = ['hell', 'damn', 'badword', 'idiot', 'stupid', 'hate', 'kill', 'abuse']; // Add more as needed

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', // Images
            'application/pdf', // PDF
            'application/msword', // .doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
        ];
        // Check mime type and extension
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx'];

        if (allowedTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Images, PDF, and Word files are allowed.'));
        }
    }
});

// Get Chat History (AI Chat)
router.get('/history/:userId', async (req, res) => {
    try {
        const messages = await Message.find({
            user_id: req.params.userId,
            receiver_id: null // Only AI messages
        })
            .sort({ created_at: 1 })
            .populate('reply_to', 'content type file_path role');
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get All Users (for Contacts)
router.get('/users', async (req, res) => {
    try {
        // Exclude current user if passed in query, or just return all and filter on client
        // Better to filter on client or pass ?currentUserId=...
        const users = await User.find({ status: 'approved' }).select('name email _id');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get P2P Chat History
router.get('/p2p/:userId/:otherUserId', async (req, res) => {
    try {
        const { userId, otherUserId } = req.params;
        const messages = await Message.find({
            $or: [
                { user_id: userId, receiver_id: otherUserId },
                { user_id: otherUserId, receiver_id: userId }
            ]
        })
            .sort({ created_at: 1 })
            .populate('reply_to', 'content type file_path');
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send Message
router.post('/send', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, async (req, res) => {
    const { userId, content, replyTo, toUserId } = req.body;
    const file = req.file;

    if (!userId) return res.status(400).json({ error: 'User ID required' });

    // Determine type
    let type = 'text';
    let filePath = null;
    if (file) {
        type = file.mimetype.startsWith('image/') ? 'image' : 'file';
        filePath = '/uploads/' + file.filename;
    }

    try {
        // Check for unprofessional content
        const isFlagged = content && badWords.some(word => content.toLowerCase().includes(word));

        // If toUserId is present -> P2P Message
        if (toUserId) {
            const msg = await Message.create({
                user_id: userId,
                receiver_id: toUserId,
                role: 'user',
                content: content || '',
                type,
                file_path: filePath,
                reply_to: replyTo || null,
                is_flagged: !!isFlagged // Force boolean
            });
            return res.json({ status: 'sent', message: msg });
        }

        // --- AI LOGIC BELOW (Only if no toUserId) ---

        // Save User Message (for AI chat)
        await Message.create({
            user_id: userId,
            receiver_id: null,
            role: 'user',
            content: content || '',
            type,
            file_path: filePath,
            reply_to: replyTo || null,
            is_flagged: !!isFlagged // Force boolean
        });

        // Prepare context for AI
        let aiContent = "I received your file.";
        let messages = [];

        // 1. Handle Images (Vision Model)
        if (type === 'image') {
            const imagePath = path.join(__dirname, '../uploads', file.filename);
            const bitmap = fs.readFileSync(imagePath);
            const base64Image = bitmap.toString('base64');

            messages = [
                {
                    role: "user",
                    content: [
                        { type: "text", text: content || "Analyze this image." },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                    ]
                }
            ];

            const chatCompletion = await groq.chat.completions.create({
                messages: messages,
                model: "meta-llama/llama-4-maverick-17b-128e-instruct",
            });
            aiContent = chatCompletion.choices[0]?.message?.content || "Image processed.";

        }
        // 2. Handle PDFs - REMOVED AS REQUESTED
        else if (type === 'file' && file.mimetype === 'application/pdf') {
            aiContent = "The file format is not supported.";
        }
        // 3. Handle Word Documents (DOCX) - Text + Embedded Images
        else if (type === 'file' && file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const docPath = path.join(__dirname, '../uploads', file.filename);
            try {
                // Convert to HTML to extract base64 images easily
                const result = await mammoth.convertToHtml({ path: docPath });
                const html = result.value || "";
                const rawText = result.messages.map(m => m.message).join("\n") + "\n" + (await mammoth.extractRawText({ path: docPath })).value;

                // Extract base64 images from HTML
                const imgRegex = /src="data:image\/([a-zA-Z]+);base64,([^"]+)"/g;
                let match;
                let extractedImages = [];

                while ((match = imgRegex.exec(html)) !== null) {
                    if (extractedImages.length < 3) { // Limit to 3 images
                        extractedImages.push({ type: match[1], data: match[2] });
                    }
                }

                if (extractedImages.length > 0) {
                    // Vision Request
                    let contentPayload = [
                        { type: "text", text: content || "Analyze this Word document with its images." }
                    ];
                    const trimmedText = rawText.substring(0, 5000);
                    if (trimmedText) contentPayload.push({ type: "text", text: `\n\nDocument Text:\n${trimmedText}` });

                    extractedImages.forEach(img => {
                        contentPayload.push({
                            type: "image_url",
                            image_url: { url: `data:image/${img.type};base64,${img.data}` }
                        });
                    });

                    messages = [{ role: "user", content: contentPayload }];
                    const chatCompletion = await groq.chat.completions.create({
                        messages: messages,
                        model: "meta-llama/llama-4-maverick-17b-128e-instruct",
                    });
                    aiContent = chatCompletion.choices[0]?.message?.content || "Word document analyzed (Vision).";

                } else {
                    // Text Only Fallback
                    const docText = (await mammoth.extractRawText({ path: docPath })).value.trim().substring(0, 10000);
                    if (!docText || docText.length < 5) {
                        aiContent = "The Word document appears empty.";
                    } else {
                        messages = [
                            { role: "system", content: "You are a helpful assistant. Analyze the document." },
                            { role: "user", content: `${content || "Analyze this"}\n\nContent:\n${docText}` }
                        ];
                        const chatCompletion = await groq.chat.completions.create({
                            messages: messages,
                            model: "llama-3.3-70b-versatile",
                        });
                        aiContent = chatCompletion.choices[0]?.message?.content || "Document analyzed.";
                    }
                }
            } catch (docErr) {
                console.error("DOCX Parse Error:", docErr);
                aiContent = "Error reading the Word document.";
            }
        }
        // 3. Handle Regular Text
        else if (content) {
            messages = [{ role: "user", content: content }];
            const chatCompletion = await groq.chat.completions.create({
                messages: messages,
                model: "llama-3.3-70b-versatile",
            });
            aiContent = chatCompletion.choices[0]?.message?.content || "Done.";
        } else {
            // Just file (non-PDF or other), no content
            aiContent = "File uploaded successfully.";
        }

        // Save AI Response
        await Message.create({
            user_id: userId,
            receiver_id: null,
            role: 'model',
            content: aiContent,
            type: 'text'
        });

        res.json({ status: 'sent', aiResponse: aiContent });

    } catch (aiErr) {
        console.error("Groq/DB Error FULL:", aiErr); // Enhanced logging
        // Fallback
        try {
            const errorMsg = "Sorry, I encountered an error processing that. (" + (aiErr.error?.message || aiErr.message) + ")";
            await Message.create({
                user_id: userId,
                receiver_id: null,
                role: 'model',
                content: errorMsg,
                type: 'text'
            });
            res.json({ status: 'sent', aiResponse: errorMsg });
        } catch (dbErr) {
            res.status(500).json({ error: 'Database Error' });
        }
    }
});

// Toggle Pin/Star
router.post('/message/:id/toggle', async (req, res) => {
    const { action, value } = req.body; // action: 'pin' or 'star'
    try {
        const update = {};
        if (action === 'pin') update.is_pinned = value;
        if (action === 'star') update.is_starred = value;

        const msg = await Message.findByIdAndUpdate(req.params.id, update, { new: true });
        res.json(msg);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;