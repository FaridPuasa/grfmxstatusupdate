const mongoose = require('mongoose');

module.exports = mongoose.model('MGLOBALPOD', require('../schemas/podSchema')); // Adjust the path to 'podSchema.js' if needed
