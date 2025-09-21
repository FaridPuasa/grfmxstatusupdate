let dotenv = require('dotenv').config()
const pass = process.env.DBPASS
const user = process.env.DBUSER
const collection = process.env.COLLECTION

module.exports = {
  MongoURI: process.env.MONGO_URI
};