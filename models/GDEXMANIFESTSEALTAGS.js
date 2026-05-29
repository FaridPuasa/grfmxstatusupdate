const mongoose = require('mongoose');

const gdexmanifestsealtagsSchema = new mongoose.Schema({
    mawbNo: String,
    manifestsealtags: [String],
    lastUpdateDateTime: String
}, { collection: 'gdexmanifestsealtags' });

module.exports = gdexmanifestsealtagsSchema;