const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    // Existing fields
    name: { type: String, required: [true, 'Nickname is required'] },
    email: { 
        type: String, 
        lowercase: true,
        trim: true,
        default: undefined,  // Use undefined instead of null
        set: function(email) {
            // If email is empty string or falsy, set to undefined
            if (!email || email === '') {
                return undefined;
            }
            return email;
        }
    },
    password: { type: String, default: null },
    role: { 
        type: String, 
        enum: ['admin','manager','cs','warehouse','finance','moh','dispatcher','freelancer'], 
        default: 'admin' 
    },
    date: { type: Date, default: Date.now },
    
    // New fields
    fullName: { type: String, default: '' },
    icNum: { type: String, default: '' },
    jobPosition: { type: String, default: '' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    profilePicture: { type: String, default: '' },
    qrcodeVerify: { type: String, default: '' },
    userId: { type: String, unique: true, sparse: true }
});

// Generate userId if not exists (pre-save middleware)
UserSchema.pre('save', async function(next) {
    try {
        if (!this.userId) {
            console.log('Generating userId for:', this.name);
            
            // Find the highest userId
            const lastUser = await this.constructor.findOne({ 
                userId: { $exists: true, $ne: null, $ne: '' } 
            }).sort({ userId: -1 });
            
            let lastNum = 0;
            if (lastUser && lastUser.userId) {
                const match = lastUser.userId.match(/GR(\d+)/);
                if (match) {
                    lastNum = parseInt(match[1]);
                }
            }
            
            const newNumber = lastNum + 1;
            this.userId = `GR${String(newNumber).padStart(6, '0')}`;
            console.log(`Generated userId: ${this.userId}`);
        }
        next();
    } catch (error) {
        console.error('Error in pre-save middleware:', error);
        next(error);
    }
});

module.exports = UserSchema;