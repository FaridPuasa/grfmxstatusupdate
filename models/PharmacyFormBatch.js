const mongoose = require('mongoose');

const pharmacyFormOrderSchema = new mongoose.Schema({
    formNumber: String,
    doTrackingNumber: String,
    receiverName: String,
    receiverAddress: String,
    area: String,
    patientNumber: String,
    icPassNum: String,
    receiverPhoneNumber: String,
    additionalPhoneNumber: String,
    remarks: String,
    deliveryTypeCode: String,
}, { _id: false });

const pharmacyFormBatchSchema = new mongoose.Schema({
    formName: String,
    formDate: { type: Date, default: Date.now },
    createdBy: String,
    orders: [pharmacyFormOrderSchema],
}, { collection: 'pharmacyformbatches' });

module.exports = pharmacyFormBatchSchema; // schema only
