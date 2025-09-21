let dotenv = require('dotenv').config()
const pass = process.env.DBPASS
const user = process.env.DBUSER
const collection = process.env.COLLECTION

module.exports = {
    MongoURI: `mongodb+srv://itsupport:GSB110011@cluster0.kkzdiku.mongodb.net/`
}