const mongoose = require('mongoose');

const podSchema = new mongoose.Schema({
    podName: String,
    product: String,
    podDate: String,
    podCreator: String,
    deliveryDate: String,
    area: String,
    dispatcher: String,
    htmlContent: String
});

module.exports = podSchema;