const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    product: String,
    productName: String,
    remarks: String,
    dateTimeSubmission: String,
    items: [{
        quantity: String,
        expiryDate: String,
        description: String,
        totalItemPrice: String,
    }],
    cargoPrice: String,
    pickupDate: String,
    senderName: String,
    totalPrice: String,
    creationDate: String,
    instructions: String,
    itemContains: String,
    parcelWeight: String,
    supplierName: String,
    paymentAmount: String,
    shipmentMethod: String,
    permitApplication: String,
    itemCommodityType: String,
    currentStatus: String,
    lastUpdateDateTime: String,
    warehouseEntry: String,
    warehouseEntryDateTime: String,
    flightDate: String,
    mawbNo: String,
    latestReason: String,
    latestLocation: String,
    lastUpdatedBy: String,
    history: [{
        statusHistory: String,
        dateUpdated: String,
        updatedBy: String,
        lastAssignedTo: String,
        reason: String,
        lastLocation: String,
    }],
}, { collection: 'inventory' });

// Create a model for the "orders" collection
module.exports = mongoose.model('INVENTORY', inventorySchema);
