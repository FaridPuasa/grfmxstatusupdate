const mongoose = require('mongoose');

const inventoryHistorySchema = new mongoose.Schema({
    date: { type: Date, default: Date.now },
    qtyIn: { type: Number, default: 0 },
    qtyOut: { type: Number, default: 0 },
    reason: { type: String, enum: ['Delivery', 'Other', null], default: null },
    trackingNumbers: { type: [String], default: [] },
    otherReason: { type: String, default: '' },
    updatedBy: { type: String, required: true }
}, { _id: false });

const inventoryStockSchema = new mongoose.Schema({
    itemDescription: { type: String, required: true },
    product: { type: String, required: true },
    quantity: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
    lastUpdatedBy: { type: String, required: true },
    history: { type: [inventoryHistorySchema], default: [] }
}, { collection: 'inventoryStock' });

module.exports = inventoryStockSchema;
