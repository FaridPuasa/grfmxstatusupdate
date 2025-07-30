const mongoose = require('mongoose');

const ordercounterSchema = new mongoose.Schema({
    pharmacy: { type: Number, default: 0 },
    localdelivery: { type: Number, default: 0 },
    cbsl: { type: Number, default: 0 }
}, { collection: 'ordercounter' });

// Create a model for the "orders" collection
module.exports = mongoose.model('ORDERCOUNTER', ordercounterSchema);
