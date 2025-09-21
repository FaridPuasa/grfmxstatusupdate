const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  plate: { type: String, required: true },
  status: { type: String, required: true } // active/inactive
});

module.exports = vehicleSchema; // schema only
