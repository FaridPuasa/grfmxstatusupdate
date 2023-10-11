const mongoose = require('mongoose');

module.exports = mongoose.model('PharmacyPOD', require('../schemas/podSchema')); // Adjust the path to 'podSchema.js' if needed