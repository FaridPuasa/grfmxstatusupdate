const mongoose = require('mongoose');

const formSchema = new mongoose.Schema({
    formName: String,
    formDate: String,
    batchNo: String,
    startNo: String,
    endNo: String,
    htmlContent: String,
    creationDate: String,
    mohForm: String,
    numberOfForms: String,
    formCreator: String,
});

module.exports = formSchema; // schema only
