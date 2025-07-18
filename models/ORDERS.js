const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    product: String,
    doTrackingNumber: String,
    jobDate: String,
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
    icNum: String, // Include fields from the second schema
    items: [{
        quantity: String,
        expiryDate: String,
        description: String,
        totalItemPrice: String,
    }],
    ldCOD: String,
    billTo: String,
    currency: String,
    passport: String,
    sequence: String,
    buyerName: String,
    startDate: String,
    addressLat: String,
    cargoPrice: String,
    pickupDate: String,
    senderName: String,
    totalPrice: String,
    addressLong: String,
    cubicMeters: String,
    dateOfBirth: String,
    ldProductType: String,
    ldCODAmount: String,
    parcelWidth: String,
    senderEmail: String,
    creationDate: String,
    jobType: String,
    instructions: String,
    itemContains: String,
    parcelHeight: String,
    parcelLength: String,
    parcelWeight: String,
    qbExpiryDate: String,
    supplierName: String,
    trackingLink: String,
    payingPatient: String,
    paymentAmount: String,
    pickupAddress: String,
    qbServiceDate: String,
    receiverEmail: String,
    senderAddress: String,
    qbCreationDate: String,
    shipmentMethod: String,
    ldProductWeight: String,
    appointmentPlace: String,
    parcelTrackingNum: String,
    permitApplication: String,
    senderPhoneNumber: String,
    ldPickupOrDelivery: String,
    warehouseReference: String,
    appointmentDistrict: String,
    goRushReceivingCountry: String,
    subscription: String,
    loyaltyPoints: String,
    pharmacyFormCreated: String,
    sendOrderTo: String,
    itemCommodityType: String,
    screenshotInvoice: String,
    currentStatus: String,
    lastUpdateDateTime: String,
    warehouseEntry: String,
    warehouseEntryDateTime: String,
    assignedTo: String,
    attempt: String,
    flightDate: String,
    mawbNo: String,
    fmxMilestoneStatus: String,
    fmxMilestoneStatusCode: String,
    latestReason: String,
    latestLocation: String,
    lastUpdatedBy: String,
    lastAssignedTo: String,
    receiverPostalCode: String,
    jobMethod: String,
    room: String,
    rackRowNum: String,
    fridge: String,
    grRemark: String,
    jpmcRemark: String,
    history: [{
        statusHistory: String,
        dateUpdated: String,
        updatedBy: String,
        lastAssignedTo: String,
        reason: String,
        lastLocation: String,
    }],
}, { collection: 'orders' });

// Create a model for the "orders" collection
module.exports = mongoose.model('ORDERS', orderSchema);