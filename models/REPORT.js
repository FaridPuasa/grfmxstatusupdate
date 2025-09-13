const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reportType: String,
    reportContent: String, // saved HTML table
    datetimeUpdated: { type: Date, default: Date.now },
    createdBy: String,
}, { collection: 'Reports' });

// Create a model for the "orders" collection
module.exports = mongoose.model('REPORT', reportSchema);