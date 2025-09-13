const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    plate: String,
    status: String,
}, { collection: 'vehicles' });

// Create a model for the "orders" collection
module.exports = mongoose.model('VEHICLE', vehicleSchema);