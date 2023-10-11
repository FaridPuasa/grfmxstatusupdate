const mongoose = require('mongoose');

module.exports = mongoose.model('LDPOD', require('../schemas/podSchema')); // Adjust the path to 'podSchema.js' if needed
