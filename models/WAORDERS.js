const mongoose = require('mongoose');

const waorderSchema = new mongoose.Schema({
    icPictureFront: String,
    icPictureBack: String,
    dateTimeSubmission: String,
    receiverPhoneNumber: String,
}, { collection: 'wargaemasorder' });

module.exports = waorderSchema; // schema only
