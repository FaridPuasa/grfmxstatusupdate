const mongoose = require('mongoose');

// Define the schema for the "orders" collection
const orderSchema = new mongoose.Schema({
    product: String,
    doTrackingNumber: String,
    receiverName: String,
    receiverAddress: String,
    area: String,
    patientNumber: String,
    icPassNum: String,
    appointmentPlace: String,
    receiverPhoneNumber: String,
    additionalPhoneNumber: String,
    deliveryTypeCode: String,
    remarks: String,
    paymentMethod: String,
    dateTimeSubmission: String,
    membership: String,
    // Add more fields as needed
});

// Create a model for the "orders" collection
const Order = mongoose.model('ORDERS', orderSchema);

module.exports = Order;
