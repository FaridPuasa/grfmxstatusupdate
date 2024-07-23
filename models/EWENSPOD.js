const mongoose = require('mongoose');

module.exports = mongoose.model('EWENSPOD', require('../schemas/podSchema')); // Adjust the path to 'podSchema.js' if needed
