const mongoose = require('mongoose');

module.exports = mongoose.model('FMXPOD', require('../schemas/podSchema')); // Adjust the path to 'podSchema.js' if needed
