const mongoose = require('mongoose');

module.exports = mongoose.model('GRPPOD', require('../schemas/podSchema')); // Adjust the path to 'podSchema.js' if needed
