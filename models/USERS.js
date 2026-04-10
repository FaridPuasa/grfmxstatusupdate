const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    // Existing fields
    name: { type: String, required: true },
    email: { type: String, sparse: true },
    password: { type: String, sparse: true },
    role: { type: String, enum: ['admin','manager','cs','warehouse','finance','moh','dispatcher','freelancer'], default: 'admin' },
    date: { type: Date, default: Date.now },
    
    // New fields
    fullName: { type: String, default: '' },
    icNum: { type: String, default: '' },
    jobPosition: { type: String, default: '' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    profilePicture: { type: String, default: '' },
    qrcodeVerify: { type: String, default: '' }, // New field for QR code image
    userId: { type: String, unique: true, sparse: true }
});

// Generate userId if not exists
UserSchema.pre('save', async function(next) {
    if (!this.userId) {
        const counter = await this.constructor.findOne({}, 'userId').sort({ userId: -1 });
        const lastNum = counter && counter.userId ? parseInt(counter.userId.replace('GR', '')) : 0;
        this.userId = `GR${String(lastNum + 1).padStart(6, '0')}`;
    }
    next();
});

module.exports = UserSchema;