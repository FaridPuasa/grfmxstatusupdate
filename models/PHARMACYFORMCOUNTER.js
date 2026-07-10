const mongoose = require('mongoose');

const pharmacyformcounterSchema = new mongoose.Schema({
    STD: { type: Number, default: 0 },
    EXP: { type: Number, default: 0 },
    IMM: { type: Number, default: 0 },
    TTG: { type: Number, default: 0 },
    KB: { type: Number, default: 0 },
    datetimeUpdated: { type: Date, default: Date.now }
}, { collection: 'pharmacyformcounter' });

module.exports = pharmacyformcounterSchema; // schema only
