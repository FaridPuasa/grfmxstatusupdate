const mongoose = require('mongoose');

module.exports = mongoose.model('CBSLPOD', require('../schemas/podSchema')); // Adjust the path to 'podSchema.js' if needed
