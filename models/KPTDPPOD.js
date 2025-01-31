const mongoose = require('mongoose');

module.exports = mongoose.model('KPTDPPOD', require('../schemas/podSchema')); // Adjust the path to 'podSchema.js' if needed
