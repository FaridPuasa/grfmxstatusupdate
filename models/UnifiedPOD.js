const mongoose = require('mongoose');

const unifiedPodSchema = new mongoose.Schema({
    podName: { type: String, required: true },
    product: { type: String, required: true },
    podDate: { type: String, required: true },
    podCreator: { type: String, required: true },
    deliveryDate: { type: String, required: true },
    area: { type: String, required: true },
    dispatcher: { type: String, required: true },
    htmlContent: { type: String, required: true },
    rowCount: { type: String, required: true },
    creationDate: { type: String, default: Date.now }
});

module.exports = unifiedPodSchema;