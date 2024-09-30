const mongoose = require('mongoose');

const waorderSchema = new mongoose.Schema({
    icPictureFront: String,
    icPictureBack: String,
    dateTimeSubmission: String,
    receiverPhoneNumber: String,
}, { collection: 'wargaemasorder' });

// Create a model for the "orders" collection
module.exports = mongoose.model('WAORDERS', waorderSchema);
