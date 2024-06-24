const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'manager', 'cs', 'warehouse', 'finance', 'moh'],
        default: 'admin'
    },
    date: {
        type: Date,
        default: Date.now
    }
});

const USERS = mongoose.model('USERS', UserSchema);

module.exports = USERS;