const mongoose = require('mongoose');

const dispatcherSchema = new mongoose.Schema({
  dispatcherName: { type: String, required: true },
  vehicle: { type: String, required: true },
  assignedJob: { type: String },   // 🔹 new field for Assigned Job column
  mileage: { type: Number },       // optional, from morning mileage
  area: { type: String }           // optional, can be empty
}, { _id: false });

const reportSchema = new mongoose.Schema({
  reportType: { type: String, required: true },
  reportName: { type: String, required: true },
  reportContent: { type: String, required: true },
  datetimeUpdated: { type: Date, default: Date.now },
  createdBy: { type: String, required: true },
  assignedDispatchers: { type: [dispatcherSchema], default: [] }
}, { collection: 'reports' });

module.exports = reportSchema;