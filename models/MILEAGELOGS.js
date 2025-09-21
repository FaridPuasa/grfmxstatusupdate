const mongoose = require('mongoose');

const mileageLogSchema = new mongoose.Schema({
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'VEHICLE', required: true },
  date: { type: Date, required: true },
  mileage: { type: Number, required: true }
});

module.exports = mileageLogSchema; // schema only
