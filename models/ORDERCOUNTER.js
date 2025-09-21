const mongoose = require('mongoose');

const ordercounterSchema = new mongoose.Schema({
    pharmacy: { type: Number, default: 0 },
    localdelivery: { type: Number, default: 0 },
    cbsl: { type: Number, default: 0 }
}, { collection: 'ordercounter' });

module.exports = ordercounterSchema; // schema only
