// ==================================================
// 🌐 Environment & Core Modules
// ==================================================
require('dotenv').config();
const path = require('path');
const moment = require('moment-timezone');
// At the top of your index.js (after require('dotenv').config())
const GDEX_ENV = process.env.GDEX_ENVIRONMENT || 'uat'; // Default to uat if not set
const isLive = GDEX_ENV === 'live';

// Log which environment you're using
console.log(`GDEX API running in: ${GDEX_ENV.toUpperCase()} mode`);

const GDEX_CONFIG = {
    uat: {
        authUrl: 'https://uat1.gdexpress.com/CustomerAPI/api/Account/Authenticate',
        trackingUrl: 'https://uat1.gdexpress.com/CustomerAPI/api/webhook/trackingstatus',
        username: '1000030',
        password: '1000030uat@G0rU2H'
    },
    live: {
        authUrl: 'https://esvr3.gdexpress.com/CustomerAPI/api/Account/Authenticate',
        trackingUrl: 'https://esvr3.gdexpress.com/CustomerAPI/api/webhook/trackingstatus',
        username: '1000030',
        password: '1000030@G0rU2H'
    }
};

const gdexConfig = GDEX_CONFIG[GDEX_ENV];

// ==================================================
// 📦 Core Packages
// ==================================================
const express = require('express');
const mongoose = require('mongoose');
mongoose.set('strictQuery', true);
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');

// ==================================================
// 🔐 Auth & Security
// ==================================================
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

// ==================================================
// 🌍 HTTP & Utilities
// ==================================================
const request = require('request');
const axios = require('axios');
const multer = require('multer');
const xlsx = require('xlsx');

// ==================================================
// ⚡ Cache
// ==================================================
const NodeCache = require('node-cache');
const urgentCache = new NodeCache({ stdTTL: 60 });   // 1 min
const codBtCache = new NodeCache({ stdTTL: 600 });  // 10 min
const grWebsiteCache = new NodeCache({ stdTTL: 60 });   // 1 min
const searchJobsCache = new NodeCache({ stdTTL: 300 }); // 5 min

// ==================================================
// 🚀 App Config
// ==================================================
const app = express();
const port = process.env.PORT || 3000;

// ==================================================
// 🛠 Middleware
// ==================================================
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static('images'));

// Body Parsers
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));

// ==================================================
// 🗄 Database Connections
// ==================================================
const dbURI = require('./config/keys').MongoURI;

// --- Main DB (GR_DMS) ---
const mainConn = mongoose.createConnection(dbURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'GR_DMS'
});
mainConn.on('connected', async () => {
    console.log('Connected to GR_DMS');
    await preloadCodBtCache(7);
    await preloadGrWebsiteCache();
});
mainConn.on('error', err => console.error('GR_DMS connection error:', err));

// --- Vehicle DB ---
const vehicleConn = mongoose.createConnection(dbURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'Vehicle'
});
vehicleConn.on('connected', () => console.log('Connected to Vehicle DB'));
vehicleConn.on('error', err => console.error('Vehicle DB connection error:', err));

// ==================================================
// 📊 Models
// ==================================================
// Main DB
const USERS = mainConn.model('USERS', require('./models/USERS'));
const ORDERS = mainConn.model('ORDERS', require('./models/ORDERS'));
const PharmacyPOD = mainConn.model('PharmacyPOD', require('./models/PharmacyPOD'));
const LDPOD = mainConn.model('LDPOD', require('./models/LDPOD'));
const CBSLPOD = mainConn.model('CBSLPOD', require('./models/CBSLPOD'));
const NONCODPOD = mainConn.model('NONCODPOD', require('./models/NONCODPOD'));
const WAORDERS = mainConn.model('WAORDERS', require('./models/WAORDERS'));
const PharmacyFORM = mainConn.model('PharmacyFORM', require('./models/PharmacyFORM'));
const ORDERCOUNTER = mainConn.model('ORDERCOUNTER', require('./models/ORDERCOUNTER'));
const REPORTS = mainConn.model('REPORTS', require('./models/REPORTS'));

// Vehicle DB
const VEHICLE = vehicleConn.model('VEHICLE', require('./models/VEHICLE'));
const MILEAGELOGS = vehicleConn.model('MILEAGELOGS', require('./models/MILEAGELOGS'));

// ==================================================
// 🔧 Other Config / Globals
// ==================================================
const COUNTER_ID = "68897ff1c0ccfbcb817e0c15";
const orderWatch = ORDERS.watch();
const apiKey = process.env.API_KEY;
const processingResults = [];

// File Upload (Multer)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ==================================================
// 🔑 Session & Authentication
// ==================================================
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use((req, res, next) => {
    console.log(req.session); // Debug session
    next();
});

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Passport config
passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
    USERS.findOne({ email })
        .then(user => {
            if (!user) return done(null, false, { message: 'No user found with that email' });

            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) throw err;
                return isMatch
                    ? done(null, user)
                    : done(null, false, { message: 'Password incorrect' });
            });
        })
        .catch(err => done(err));
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await USERS.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Middleware to check authentication and authorization
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error_msg', 'Please log in to view that resource');
    res.redirect('/login');
}

// Middleware to check if user is authenticated
function ensureNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        // If user is authenticated, redirect to dashboard or another page
        return res.redirect('/'); // Change '/dashboard' to the appropriate URL
    }
    // If user is not authenticated, continue to the next middleware
    next();
}

function ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'admin') {
        return next();
    }
    req.flash('error_msg', 'You are not authorized to view that resource');
    res.redirect('/');
}

function ensureGeneratePODandUpdateDelivery(req, res, next) {
    if (req.isAuthenticated() && (req.user.role === 'warehouse' || req.user.role === 'cs' || req.user.role === 'dispatcher' || req.user.role === 'manager' || req.user.role === 'admin')) {
        return next();
    }
    req.flash('error_msg', 'You are not authorized to view that resource');
    res.redirect('/');
}

function ensureViewPOD(req, res, next) {
    if (req.isAuthenticated() && (req.user.role === 'warehouse' || req.user.role === 'finance' || req.user.role === 'cs' || req.user.role === 'dispatcher' || req.user.role === 'manager' || req.user.role === 'admin')) {
        return next();
    }
    req.flash('error_msg', 'You are not authorized to view that resource');
    res.redirect('/');
}

function ensureViewJob(req, res, next) {
    if (req.isAuthenticated() && (req.user.role === 'warehouse' || req.user.role === 'finance' || req.user.role === 'cs' || req.user.role === 'manager' || req.user.role === 'admin')) {
        return next();
    }
    req.flash('error_msg', 'You are not authorized to view that resource');
    res.redirect('/');
}

function ensureViewMOHJob(req, res, next) {
    if (req.isAuthenticated() && (req.user.role === 'warehouse' || req.user.role === 'finance' || req.user.role === 'cs' || req.user.role === 'manager' || req.user.role === 'admin')) {
        return next();
    }
    req.flash('error_msg', 'You are not authorized to view that resource');
    res.redirect('/');
}

function ensureMOHForm(req, res, next) {
    if (req.isAuthenticated() && (req.user.role === 'cs' || req.user.role === 'manager' || req.user.role === 'admin')) {
        return next();
    }
    req.flash('error_msg', 'You are not authorized to view that resource');
    res.redirect('/');
}

function ensureSearchMOHJob(req, res, next) {
    if (req.isAuthenticated() && (req.user.role === 'moh' || req.user.role === 'cs' || req.user.role === 'manager' || req.user.role === 'admin')) {
        return next();
    }
    req.flash('error_msg', 'You are not authorized to view that resource');
    res.redirect('/');
}

// 🔹 Preload cache at startup (today’s orders)
async function preloadGrWebsiteCache() {
    try {
        const today = moment().tz("Asia/Brunei").format("YYYY-MM-DD");
        console.log(`Preloading GR Website cache for ${today}...`);
        const data = await fetchGrWebsiteOrders(today);
        grWebsiteCache.set(`grWebsite-${today}`, data);
        console.log("✅ GR Website cache preloaded.");
    } catch (err) {
        console.error("❌ Failed to preload GR Website cache:", err);
    }
}

async function preloadCodBtCache(days = 7) {
    console.log(`Preloading COD/BT cache for last ${days} days...`);
    for (let i = 0; i < days; i++) {
        const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
        const formattedDateKey = moment(date, 'YYYY-MM-DD').format('DD-MM-YYYY');

        if (codBtCache.has(formattedDateKey)) {
            continue; // already cached
        }

        try {
            const codBtMap = await getCodBtMapForDate(date);
            const mapData = codBtMap[formattedDateKey] || {};
            codBtCache.set(formattedDateKey, mapData);
            console.log(`Cached COD/BT data for ${formattedDateKey}`);
        } catch (error) {
            console.error(`Failed to preload COD/BT cache for ${formattedDateKey}:`, error);
        }
    }
}

// Function 3: Check for Stale Info Received Jobs (Updated Logic)
async function checkStaleInfoReceivedJobs() {
    const apiKey = process.env.API_KEY;
    try {
        const targetProducts = ["pharmacymoh", "pharmacyjpmc", "pharmacyphc", "localdelivery", "cbsl"];
        const thirtyDaysAgo = moment().subtract(30, 'days').format('YYYY-MM-DD');

        const staleOrders = await ORDERS.find({
            currentStatus: "Info Received",
            product: { $in: targetProducts },
            creationDate: { $lt: thirtyDaysAgo }
        });

        for (let order of staleOrders) {
            const consignmentID = order.doTrackingNumber;
            const product = order.product;

            let update = {};
            let option = { upsert: false, new: false };

            if (product === 'pharmacymoh') {
                update = {
                    currentStatus: "Cancelled",
                    lastUpdateDateTime: moment().format(),
                    latestReason: "Cancelled",
                    lastUpdatedBy: "System",
                    pharmacyFormCreated: "Yes",
                    $push: {
                        history: {
                            statusHistory: "Cancelled",
                            dateUpdated: moment().format(),
                            updatedBy: "System",
                            reason: "Cancelled",
                        }
                    }
                };
            } else {
                update = {
                    currentStatus: "Cancelled",
                    lastUpdateDateTime: moment().format(),
                    latestReason: "Cancelled",
                    lastUpdatedBy: "System",
                    $push: {
                        history: {
                            statusHistory: "Cancelled",
                            dateUpdated: moment().format(),
                            updatedBy: "System",
                            reason: "Cancelled",
                        }
                    }
                };
            }

            const result = await ORDERS.findOneAndUpdate({ doTrackingNumber: consignmentID }, update, option);
            if (result) {
                console.log(`MongoDB Updated for Tracking Number: ${consignmentID}`);
            } else {
                console.error(`MongoDB Update Failed for Tracking Number: ${consignmentID}`);
            }

            // Always Run Detrack Update Sequence
            console.log(`Starting Detrack Update Sequence (Date → Cancelled Status) for Tracking: ${consignmentID}`);

            // Step 1: Update Date Only
            const updateDateData = {
                do_number: consignmentID,
                data: { date: moment().format('YYYY-MM-DD') }
            };

            const dateUpdateSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, updateDateData);

            if (dateUpdateSuccess) {
                console.log(`[STEP 1 SUCCESS] Date updated for Tracking: ${consignmentID}`);

                // Step 2: Update Status to "cancelled"
                const updateStatusData = {
                    do_number: consignmentID,
                    data: { status: "cancelled" }
                };

                const statusUpdateSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, updateStatusData);

                if (statusUpdateSuccess) {
                    console.log(`[COMPLETE] Date and Cancelled Status both updated for Tracking: ${consignmentID}`);
                } else {
                    console.error(`[ERROR] Failed to update Status to "cancelled" for Tracking: ${consignmentID}`);
                }
            } else {
                console.error(`[ERROR] Failed to update Date for Tracking: ${consignmentID}. Status update skipped.`);
            }
        }

    } catch (error) {
        console.error('Error in stale Info Received jobs check:', error);
    }
}

async function checkActiveDeliveriesStatus() {
    try {
        const activeOrders = await ORDERS.find(
            { currentStatus: { $in: ["Out for Delivery", "Self Collect", "Drop Off"] } },
            { doTrackingNumber: 1, currentStatus: 1, assignedTo: 1 }
        );

        for (let order of activeOrders) {
            const { doTrackingNumber: trackingNumber, currentStatus } = order;

            if (!trackingNumber) continue;

            try {
                const response = await axios.get(`https://app.detrack.com/api/v2/dn/jobs/show/`, {
                    params: { do_number: trackingNumber },
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': 'd4dfab3975765c8ffa920d9a0c6bda0c12d17a35a946d337'
                    }
                });

                const data = response.data;
                const now = moment().format();

                if (data.data.status?.toLowerCase() === 'completed') {
                    const filter = { doTrackingNumber: trackingNumber };
                    let update = {};
                    const options = { upsert: false, new: false };

                    if (["Out for Delivery", "Self Collect"].includes(currentStatus)) {
                        // Preserve assignedTo if Out for Delivery and contains FL1
                        const assigned = currentStatus === "Out for Delivery" && order.assignedTo?.includes("FL1")
                            ? order.assignedTo
                            : data.data.assign_to || '-';

                        update = {
                            currentStatus: "Completed",
                            lastUpdateDateTime: now,
                            latestLocation: "Customer",
                            lastUpdatedBy: "System",
                            assignedTo: assigned,
                            $push: {
                                history: {
                                    statusHistory: "Completed",
                                    dateUpdated: now,
                                    updatedBy: "System",
                                    lastAssignedTo: assigned,
                                    lastLocation: "Customer"
                                }
                            }
                        };

                    } else if (currentStatus === "Drop Off") {
                        update = {
                            currentStatus: "Completed",
                            lastUpdateDateTime: now,
                            latestLocation: "K1 Warehouse",
                            lastUpdatedBy: "System",
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: now,
                            assignedTo: "Selfcollect",
                            $push: {
                                history: {
                                    statusHistory: "Completed",
                                    dateUpdated: now,
                                    updatedBy: "System",
                                    lastAssignedTo: "Selfcollect",
                                    lastLocation: "K1 Warehouse"
                                }
                            }
                        };
                    }

                    await ORDERS.findOneAndUpdate(filter, update, options);
                    console.log(`Order ${trackingNumber} updated successfully.`);
                } else {
                    console.log(`Order ${trackingNumber} is not completed yet.`);
                }

            } catch (apiError) {
                console.error(`Error checking tracking ${trackingNumber}:`, apiError.response?.data || apiError.message);
            }

            // Delay between requests to avoid API rate limit
            await new Promise(resolve => setTimeout(resolve, 500));
        }

    } catch (error) {
        console.error('Watcher encountered an error:', error);
    }
}

// Function 2: Check and Update Orders with Empty Area
async function checkAndUpdateEmptyAreaOrders() {
    const apiKey = process.env.API_KEY;
    try {
        const targetProducts = ["pdu", "mglobal", "ewe"];

        const ordersWithNoArea = await ORDERS.find({
            product: { $in: targetProducts },
            $or: [
                { area: null },
                { area: "" }
            ]
        });

        console.log(`Found ${ordersWithNoArea.length} orders with empty area.`);

        for (let order of ordersWithNoArea) {
            let address = order.receiverAddress ? order.receiverAddress.toUpperCase() : "";

            let area = "N/A";
            let kampong = "";

            if (address.includes("MANGGIS") == true) { area = "B", kampong = "MANGGIS" }
            else if (address.includes("DELIMA") == true) { area = "B", kampong = "DELIMA" }
            else if (address.includes("ANGGREK DESA") == true) { area = "B", kampong = "ANGGREK DESA" }
            else if (address.includes("ANGGREK") == true) { area = "B", kampong = "ANGGREK DESA" }
            else if (address.includes("PULAIE") == true) { area = "B", kampong = "PULAIE" }
            else if (address.includes("LAMBAK") == true) { area = "B", kampong = "LAMBAK" }
            else if (address.includes("TERUNJING") == true) { area = "B", kampong = "TERUNJING" }
            else if (address.includes("MADANG") == true) { area = "B", kampong = "MADANG" }
            else if (address.includes("AIRPORT") == true) { area = "B", kampong = "AIRPORT" }
            else if (address.includes("ORANG KAYA BESAR IMAS") == true) { area = "B", kampong = "OKBI" }
            else if (address.includes("OKBI") == true) { area = "B", kampong = "OKBI" }
            else if (address.includes("SERUSOP") == true) { area = "B", kampong = "SERUSOP" }
            else if (address.includes("BURONG PINGAI") == true) { area = "B", kampong = "BURONG PINGAI" }
            else if (address.includes("SETIA NEGARA") == true) { area = "B", kampong = "SETIA NEGARA" }
            else if (address.includes("PASIR BERAKAS") == true) { area = "B", kampong = "PASIR BERAKAS" }
            else if (address.includes("MENTERI BESAR") == true) { area = "B", kampong = "MENTERI BESAR" }
            else if (address.includes("KEBANGSAAN LAMA") == true) { area = "B", kampong = "KEBANGSAAN LAMA" }
            else if (address.includes("BATU MARANG") == true) { area = "B", kampong = "BATU MARANG" }
            else if (address.includes("DATO GANDI") == true) { area = "B", kampong = "DATO GANDI" }
            else if (address.includes("KAPOK") == true) { area = "B", kampong = "KAPOK" }
            else if (address.includes("KOTA BATU") == true) { area = "B", kampong = "KOTA BATU" }
            else if (address.includes("MENTIRI") == true) { area = "B", kampong = "MENTIRI" }
            else if (address.includes("MERAGANG") == true) { area = "B", kampong = "MERAGANG" }
            else if (address.includes("PELAMBAIAN") == true) { area = "B", kampong = "PELAMBAIAN" }
            else if (address.includes("PINTU MALIM") == true) { area = "B", kampong = "PINTU MALIM" }
            else if (address.includes("SALAMBIGAR") == true) { area = "B", kampong = "SALAMBIGAR" }
            else if (address.includes("SALAR") == true) { area = "B", kampong = "SALAR" }
            else if (address.includes("SERASA") == true) { area = "B", kampong = "SERASA" }
            else if (address.includes("SERDANG") == true) { area = "B", kampong = "SERDANG" }
            else if (address.includes("SUNGAI BASAR") == true) { area = "B", kampong = "SUNGAI BASAR" }
            else if (address.includes("SG BASAR") == true) { area = "B", kampong = "SUNGAI BASAR" }
            else if (address.includes("SUNGAI BELUKUT") == true) { area = "B", kampong = "SUNGAI BELUKUT" }
            else if (address.includes("SG BELUKUT") == true) { area = "B", kampong = "SUNGAI BELUKUT" }
            else if (address.includes("SUNGAI HANCHING") == true) { area = "B", kampong = "SUNGAI HANCHING" }
            else if (address.includes("SG HANCHING") == true) { area = "B", kampong = "SUNGAI HANCHING" }
            else if (address.includes("SUNGAI TILONG") == true) { area = "B", kampong = "SUNGAI TILONG" }
            else if (address.includes("SG TILONG") == true) { area = "B", kampong = "SUNGAI TILONG" }
            else if (address.includes("SUBOK") == true) { area = "B", kampong = "SUBOK" }
            else if (address.includes("SUNGAI AKAR") == true) { area = "B", kampong = "SUNGAI AKAR" }
            else if (address.includes("SG AKAR") == true) { area = "B", kampong = "SUNGAI AKAR" }
            else if (address.includes("SUNGAI BULOH") == true) { area = "B", kampong = "SUNGAI BULOH" }
            else if (address.includes("SG BULOH") == true) { area = "B", kampong = "SUNGAI BULOH" }
            else if (address.includes("TANAH JAMBU") == true) { area = "B", kampong = "TANAH JAMBU" }
            else if (address.includes("SUNGAI OROK") == true) { area = "B", kampong = "SUNGAI OROK" }
            else if (address.includes("SG OROK") == true) { area = "B", kampong = "SUNGAI OROK" }
            else if (address.includes("KATOK") == true) { area = "G", kampong = "KATOK" }
            else if (address.includes("MATA-MATA") == true) { area = "G", kampong = "MATA-MATA" }
            else if (address.includes("MATA MATA") == true) { area = "G", kampong = "MATA-MATA" }
            else if (address.includes("RIMBA") == true) { area = "G", kampong = "RIMBA" }
            else if (address.includes("TUNGKU") == true) { area = "G", kampong = "TUNGKU" }
            else if (address.includes("UBD") == true) { area = "G", kampong = "UBD" }
            else if (address.includes("UNIVERSITI BRUNEI DARUSSALAM") == true) { area = "G", kampong = "UBD" }
            else if (address.includes("JIS") == true) { area = "G" }
            else if (address.includes("JERUDONG INTERNATIONAL SCHOOL") == true) { area = "G", kampong = "JIS" }
            else if (address.includes("BERANGAN") == true) { area = "G", kampong = "BERANGAN" }
            else if (address.includes("BERIBI") == true) { area = "G", kampong = "BERIBI" }
            else if (address.includes("KIULAP") == true) { area = "G", kampong = "KIULAP" }
            else if (address.includes("RIPAS") == true) { area = "G", kampong = "RIPAS" }
            else if (address.includes("RAJA ISTERI PENGIRAN ANAK SALLEHA") == true) { area = "G", kampong = "RIPAS" }
            else if (address.includes("KIARONG") == true) { area = "G", kampong = "KIARONG" }
            else if (address.includes("PUSAR ULAK") == true) { area = "G", kampong = "PUSAR ULAK" }
            else if (address.includes("KUMBANG PASANG") == true) { area = "G", kampong = "KUMBANG PASANG" }
            else if (address.includes("MENGLAIT") == true) { area = "G", kampong = "MENGLAIT" }
            else if (address.includes("MABOHAI") == true) { area = "G", kampong = "MABOHAI" }
            else if (address.includes("ONG SUM PING") == true) { area = "G", kampong = "ONG SUM PING" }
            else if (address.includes("GADONG") == true) { area = "G", kampong = "GADONG" }
            else if (address.includes("TASEK LAMA") == true) { area = "G", kampong = "TASEK LAMA" }
            else if (address.includes("BANDAR TOWN") == true) { area = "G", kampong = "BANDAR TOWN" }
            else if (address.includes("BATU SATU") == true) { area = "JT", kampong = "BATU SATU" }
            else if (address.includes("BENGKURONG") == true) { area = "JT", kampong = "BENGKURONG" }
            else if (address.includes("BUNUT") == true) { area = "JT", kampong = "BUNUT" }
            else if (address.includes("JALAN BABU RAJA") == true) { area = "JT", kampong = "JALAN BABU RAJA" }
            else if (address.includes("JALAN ISTANA") == true) { area = "JT", kampong = "JALAN ISTANA" }
            else if (address.includes("JUNJONGAN") == true) { area = "JT", kampong = "JUNJONGAN" }
            else if (address.includes("KASAT") == true) { area = "JT", kampong = "KASAT" }
            else if (address.includes("LUMAPAS") == true) { area = "JT", kampong = "LUMAPAS" }
            else if (address.includes("JALAN HALUS") == true) { area = "JT", kampong = "JALAN HALUS" }
            else if (address.includes("MADEWA") == true) { area = "JT", kampong = "MADEWA" }
            else if (address.includes("PUTAT") == true) { area = "JT", kampong = "PUTAT" }
            else if (address.includes("SINARUBAI") == true) { area = "JT", kampong = "SINARUBAI" }
            else if (address.includes("TASEK MERADUN") == true) { area = "JT", kampong = "TASEK MERADUN" }
            else if (address.includes("TELANAI") == true) { area = "JT", kampong = "TELANAI" }
            else if (address.includes("BAN 1") == true) { area = "JT", kampong = "BAN" }
            else if (address.includes("BAN 2") == true) { area = "JT", kampong = "BAN" }
            else if (address.includes("BAN 3") == true) { area = "JT", kampong = "BAN" }
            else if (address.includes("BAN 4") == true) { area = "JT", kampong = "BAN" }
            else if (address.includes("BAN 5") == true) { area = "JT", kampong = "BAN" }
            else if (address.includes("BAN 6") == true) { area = "JT", kampong = "BAN" }
            else if (address.includes("BATONG") == true) { area = "JT", kampong = "BATONG" }
            else if (address.includes("BATU AMPAR") == true) { area = "JT", kampong = "BATU AMPAR" }
            else if (address.includes("BEBATIK") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
            else if (address.includes("BEBULOH") == true) { area = "JT", kampong = "BEBULOH" }
            else if (address.includes("BEBATIK KILANAS") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
            else if (address.includes("KILANAS") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
            else if (address.includes("DADAP") == true) { area = "JT", kampong = "DADAP" }
            else if (address.includes("KUALA LURAH") == true) { area = "JT", kampong = "KUALA LURAH" }
            else if (address.includes("KULAPIS") == true) { area = "JT", kampong = "KULAPIS" }
            else if (address.includes("LIMAU MANIS") == true) { area = "JT", kampong = "LIMAU MANIS" }
            else if (address.includes("MASIN") == true) { area = "JT", kampong = "MASIN" }
            else if (address.includes("MULAUT") == true) { area = "JT", kampong = "MULAUT" }
            else if (address.includes("PANCHOR MURAI") == true) { area = "JT", kampong = "PANCHOR MURAI" }
            else if (address.includes("PANCHUR MURAI") == true) { area = "JT", kampong = "PANCHOR MURAI" }
            else if (address.includes("PANGKALAN BATU") == true) { area = "JT", kampong = "PANGKALAN BATU" }
            else if (address.includes("PASAI") == true) { area = "JT", kampong = "PASAI" }
            else if (address.includes("WASAN") == true) { area = "JT", kampong = "WASAN" }
            else if (address.includes("PARIT") == true) { area = "JT", kampong = "PARIT" }
            else if (address.includes("EMPIRE") == true) { area = "JT", kampong = "EMPIRE" }
            else if (address.includes("JANGSAK") == true) { area = "JT", kampong = "JANGSAK" }
            else if (address.includes("JERUDONG") == true) { area = "JT", kampong = "JERUDONG" }
            else if (address.includes("KATIMAHAR") == true) { area = "JT", kampong = "KATIMAHAR" }
            else if (address.includes("LUGU") == true) { area = "JT", kampong = "LUGU" }
            else if (address.includes("SENGKURONG") == true) { area = "JT", kampong = "SENGKURONG" }
            else if (address.includes("TANJONG NANGKA") == true) { area = "JT", kampong = "TANJONG NANGKA" }
            else if (address.includes("TANJONG BUNUT") == true) { area = "JT", kampong = "TANJONG BUNUT" }
            else if (address.includes("TANJUNG BUNUT") == true) { area = "JT", kampong = "TANJONG BUNUT" }
            else if (address.includes("SUNGAI TAMPOI") == true) { area = "JT", kampung = "SUNGAI TAMPOI" }
            else if (address.includes("SG TAMPOI") == true) { area = "JT", kampong = "SUNGAI TAMPOI" }
            else if (address.includes("MUARA") == true) { area = "B", kampong = "MUARA" }
            //TU
            else if (address.includes("SENGKARAI") == true) { area = "TUTONG", kampong = "SENGKARAI" }
            else if (address.includes("PANCHOR") == true) { area = "TUTONG", kampong = "PANCHOR" }
            else if (address.includes("PENABAI") == true) { area = "TUTONG", kampong = "PENABAI" }
            else if (address.includes("KUALA TUTONG") == true) { area = "TUTONG", kampong = "KUALA TUTONG" }
            else if (address.includes("PENANJONG") == true) { area = "TUTONG", kampong = "PENANJONG" }
            else if (address.includes("KERIAM") == true) { area = "TUTONG", kampong = "KERIAM" }
            else if (address.includes("BUKIT PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
            else if (address.includes("PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
            else if (address.includes("LUAGAN") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
            else if (address.includes("DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
            else if (address.includes("LUAGAN DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
            else if (address.includes("SINAUT") == true) { area = "TUTONG", kampong = "SINAUT" }
            else if (address.includes("SUNGAI KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
            else if (address.includes("KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
            else if (address.includes("SG KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
            else if (address.includes("KUPANG") == true) { area = "TUTONG", kampong = "KUPANG" }
            else if (address.includes("KIUDANG") == true) { area = "TUTONG", kampong = "KIUDANG" }
            else if (address.includes("PAD") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
            else if (address.includes("NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
            else if (address.includes("PAD NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
            else if (address.includes("BEKIAU") == true) { area = "TUTONG", kampong = "BEKIAU" }
            else if (address.includes("MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
            else if (address.includes("PENGKALAN MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
            else if (address.includes("BATANG MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
            else if (address.includes("MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
            else if (address.includes("KEBIA") == true) { area = "TUTONG", kampong = "KEBIA" }
            else if (address.includes("BIRAU") == true) { area = "TUTONG", kampong = "BIRAU" }
            else if (address.includes("LAMUNIN") == true) { area = "TUTONG", kampong = "LAMUNIN" }
            else if (address.includes("LAYONG") == true) { area = "TUTONG", kampong = "LAYONG" }
            else if (address.includes("MENENGAH") == true) { area = "TUTONG", kampong = "MENENGAH" }
            else if (address.includes("PANCHONG") == true) { area = "TUTONG", kampong = "PANCHONG" }
            else if (address.includes("PENAPAR") == true) { area = "TUTONG", kampong = "PANAPAR" }
            else if (address.includes("TANJONG MAYA") == true) { area = "TUTONG", kampong = "TANJONG MAYA" }
            else if (address.includes("MAYA") == true) { area = "TUTONG", kampong = "MAYA" }
            else if (address.includes("LUBOK") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
            else if (address.includes("PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
            else if (address.includes("LUBOK PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
            else if (address.includes("BUKIT UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
            else if (address.includes("UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
            else if (address.includes("RAMBAI") == true) { area = "TUTONG", kampong = "RAMBAI" }
            else if (address.includes("BENUTAN") == true) { area = "TUTONG", kampong = "BENUTAN" }
            else if (address.includes("MERIMBUN") == true) { area = "TUTONG", kampong = "MERIMBUN" }
            else if (address.includes("UKONG") == true) { area = "TUTONG", kampong = "UKONG" }
            else if (address.includes("LONG") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
            else if (address.includes("MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
            else if (address.includes("LONG MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
            else if (address.includes("TELISAI") == true) { area = "TUTONG", kampong = "TELISAI" }
            else if (address.includes("DANAU") == true) { area = "TUTONG", kampong = "DANAU" }
            else if (address.includes("BUKIT BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
            else if (address.includes("BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
            else if (address.includes("TUTONG") == true) { area = "TUTONG", kampong = "TUTONG" }
            //KB
            else if (address.includes("AGIS") == true) { area = "LUMUT", kampong = "AGIS" }
            else if (address.includes("ANDALAU") == true) { area = "LUMUT", kampong = "ANDALAU" }
            else if (address.includes("ANDUKI") == true) { area = "LUMUT", kampong = "ANDUKI" }
            else if (address.includes("APAK") == true) { area = "KB / SERIA", kampong = "APAK" }
            else if (address.includes("BADAS") == true) { area = "LUMUT", kampong = "BADAS" }
            else if (address.includes("BANG") == true) { area = "KB / SERIA", kampong = "BANG" }
            else if (address.includes("GARANG") == true) { area = "KB / SERIA", kampong = "GARANG" }
            else if (address.includes("PUKUL") == true) { area = "KB / SERIA", kampong = "PUKUL" }
            else if (address.includes("TAJUK") == true) { area = "KB / SERIA", kampong = "TAJUK" }
            else if (address.includes("BENGERANG") == true) { area = "KB / SERIA", kampong = "BENGERANG" }
            else if (address.includes("BIADONG") == true) { area = "KB / SERIA", kampong = "BIADONG" }
            else if (address.includes("ULU") == true) { area = "KB / SERIA", kampong = "ULU" }
            else if (address.includes("TENGAH") == true) { area = "KB / SERIA", kampong = "TENGAH" }
            else if (address.includes("BISUT") == true) { area = "KB / SERIA", kampong = "BISUT" }
            else if (address.includes("BUAU") == true) { area = "KB / SERIA", kampong = "BUAU" }
            else if (address.includes("KANDOL") == true) { area = "KB / SERIA", kampong = "KANDOL" }
            else if (address.includes("PUAN") == true) { area = "KB / SERIA", kampong = "PUAN" }
            else if (address.includes("TUDING") == true) { area = "LUMUT", kampong = "TUDING" }
            else if (address.includes("SAWAT") == true) { area = "KB / SERIA", kampong = "SAWAT" }
            else if (address.includes("SERAWONG") == true) { area = "KB / SERIA", kampong = "SERAWONG" }
            else if (address.includes("CHINA") == true) { area = "KB / SERIA", kampong = "CHINA" }
            else if (address.includes("DUGUN") == true) { area = "KB / SERIA", kampong = "DUGUN" }
            else if (address.includes("GATAS") == true) { area = "KB / SERIA", kampong = "GATAS" }
            else if (address.includes("JABANG") == true) { area = "KB / SERIA", kampong = "JABANG" }
            else if (address.includes("KAGU") == true) { area = "KB / SERIA", kampong = "KAGU" }
            else if (address.includes("KAJITAN") == true) { area = "KB / SERIA", kampong = "KAJITAN" }
            else if (address.includes("KELUYOH") == true) { area = "KB / SERIA", kampong = "KELUYOH" }
            else if (address.includes("KENAPOL") == true) { area = "KB / SERIA", kampong = "KENAPOL" }
            else if (address.includes("KUALA BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
            else if (address.includes("BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
            else if (address.includes("KUALA BELAIT") == true) { area = "KB", kampong = "KUALA BELAIT" }
            else if (address.includes("KUKUB") == true) { area = "KB / SERIA", kampong = "KUKUB" }
            else if (address.includes("LABI") == true) { area = "LUMUT", kampong = "LABI" }
            else if (address.includes("LAKANG") == true) { area = "KB / SERIA", kampong = "LAKANG" }
            else if (address.includes("LAONG ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
            else if (address.includes("ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
            else if (address.includes("LAONG") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
            else if (address.includes("LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
            else if (address.includes("SUNGAI LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
            else if (address.includes("SG LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
            else if (address.includes("LUMUT") == true) { area = "LUMUT", kampong = "LUMUT" }
            else if (address.includes("LORONG") == true) { area = "SERIA", kampong = "LORONG" }
            else if (address.includes("LORONG TENGAH") == true) { area = "SERIA", kampong = "LORONG TENGAH" }
            else if (address.includes("LORONG TIGA SELATAN") == true) { area = "SERIA", kampong = "LORONG TIGA SELATAN" }
            else if (address.includes("LILAS") == true) { area = "KB / SERIA", kampong = "LILAS" }
            else if (address.includes("LUBUK LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
            else if (address.includes("LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
            else if (address.includes("LUBUK TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
            else if (address.includes("TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
            else if (address.includes("MALA'AS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
            else if (address.includes("MALAAS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
            else if (address.includes("MALAYAN") == true) { area = "KB / SERIA", kampong = "MELAYAN" }
            else if (address.includes("MELAYU") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
            else if (address.includes("ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
            else if (address.includes("MELAYU ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
            else if (address.includes("MELILAS") == true) { area = "LUMUT", kampong = "MELILAS" }
            else if (address.includes("MENDARAM") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
            else if (address.includes("MENDARAM BESAR") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
            else if (address.includes("MENDARAM KECIL") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
            else if (address.includes("MERANGKING") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
            else if (address.includes("MERANGKING ULU") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
            else if (address.includes("MERANGKING HILIR") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
            else if (address.includes("MUMONG") == true) { area = "KB", kampong = "MUMONG" }
            else if (address.includes("PANDAN") == true) { area = "KB", kampong = "PANDAN" }
            else if (address.includes("PADANG") == true) { area = "KB", kampong = "PADANG" }
            else if (address.includes("PANAGA") == true) { area = "SERIA", kampong = "PANAGA" }
            else if (address.includes("PENGKALAN SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
            else if (address.includes("SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
            else if (address.includes("PENGALAYAN") == true) { area = "KB / SERIA", kampong = "PENGALAYAN" }
            else if (address.includes("PENYRAP") == true) { area = "KB / SERIA", kampong = "PENYRAP" }
            else if (address.includes("PERANGKONG") == true) { area = "KB / SERIA", kampong = "PERANGKONG" }
            else if (address.includes("PERUMPONG") == true) { area = "LUMUT", kampong = "PERUMPONG" }
            else if (address.includes("PESILIN") == true) { area = "KB / SERIA", kampong = "PESILIN" }
            else if (address.includes("PULAU APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
            else if (address.includes("APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
            else if (address.includes("RAMPAYOH") == true) { area = "KB / SERIA", kampong = "RAMPAYOH" }
            else if (address.includes("RATAN") == true) { area = "KB / SERIA", kampong = "RATAN" }
            else if (address.includes("SAUD") == true) { area = "KB / SERIA", kampong = "SAUD" }
            //else if (address.includes("SIMPANG") == true) {area = "KB / SERIA", kampong = "SIMPANG TIGA"}
            else if (address.includes("SIMPANG TIGA") == true) { area = "LUMUT", kampong = "SIMPANG TIGA" }
            else if (address.includes("SINGAP") == true) { area = "KB / SERIA", kampong = "SINGAP" }
            else if (address.includes("SUKANG") == true) { area = "KB / SERIA", kampong = "SUKANG" }
            else if (address.includes("BAKONG") == true) { area = "LUMUT", kampong = "BAKONG" }
            else if (address.includes("DAMIT") == true) { area = "KB / SERIA", kampong = "DAMIT" }
            else if (address.includes("BERA") == true) { area = "KB / SERIA", kampong = "BERA" }
            else if (address.includes("DUHON") == true) { area = "KB / SERIA", kampong = "DUHON" }
            else if (address.includes("GANA") == true) { area = "LUMUT", kampong = "GANA" }
            else if (address.includes("HILIR") == true) { area = "KB / SERIA", kampong = "HILIR" }
            else if (address.includes("KANG") == true) { area = "LUMUT", kampong = "KANG" }
            else if (address.includes("KURU") == true) { area = "LUMUT", kampong = "KURU" }
            else if (address.includes("LALIT") == true) { area = "LUMUT", kampong = "LALIT" }
            else if (address.includes("LUTONG") == true) { area = "KB / SERIA", kampong = "LUTONG" }
            else if (address.includes("MAU") == true) { area = "KB / SERIA", kampong = "MAU" }
            else if (address.includes("MELILIT") == true) { area = "KB / SERIA", kampong = "MELILIT" }
            else if (address.includes("PETAI") == true) { area = "KB / SERIA", kampong = "PETAI" }
            else if (address.includes("TALI") == true) { area = "LUMUT", kampong = "TALI" }
            else if (address.includes("TARING") == true) { area = "LUMUT", kampong = "TARING" }
            else if (address.includes("TERABAN") == true) { area = "KB", kampong = "TERABAN" }
            else if (address.includes("UBAR") == true) { area = "KB / SERIA", kampong = "UBAR" }
            else if (address.includes("TANAJOR") == true) { area = "KB / SERIA", kampong = "TANAJOR" }
            else if (address.includes("TANJONG RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
            else if (address.includes("RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
            else if (address.includes("TANJONG SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
            else if (address.includes("SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
            else if (address.includes("TAPANG LUPAK") == true) { area = "KB / SERIA", kampong = "TAPANG LUPAK" }
            else if (address.includes("TARAP") == true) { area = "KB / SERIA", kampong = "TARAP" }
            else if (address.includes("TEMPINAK") == true) { area = "KB / SERIA", kampong = "TEMPINAK" }
            else if (address.includes("TERAJA") == true) { area = "KB / SERIA", kampong = "TERAJA" }
            else if (address.includes("TERAWAN") == true) { area = "KB / SERIA", kampong = "TERAWAN" }
            else if (address.includes("TERUNAN") == true) { area = "KB / SERIA", kampong = "TERUNAN" }
            else if (address.includes("TUGONG") == true) { area = "KB / SERIA", kampong = "TUGONG" }
            else if (address.includes("TUNGULLIAN") == true) { area = "LUMUT", kampong = "TUNGULLIAN" }
            else if (address.includes("UBOK") == true) { area = "KB / SERIA", kampong = "UBOK" }
            else if (address.includes("BELAIT") == true) { area = "KB / SERIA", kampong = "BELAIT" }
            else if (address.includes("SERIA") == true) { area = "KB / SERIA", kampong = "BELAIT" }
            //TE
            else if (address.includes("AMO") == true) { area = "TEMBURONG", kampong = "AMO" }
            else if (address.includes("AYAM-AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
            else if (address.includes("AYAM AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
            else if (address.includes("BAKARUT") == true) { area = "TEMBURONG", kampong = "BAKARUT" }
            else if (address.includes("BATANG DURI") == true) { area = "TEMBURONG", kampong = "BATANG DURI" }
            else if (address.includes("BATANG TUAU") == true) { area = "TEMBURONG", kampong = "BATANG TUAU" }
            else if (address.includes("BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
            else if (address.includes("APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
            else if (address.includes("BATU BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
            else if (address.includes("BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
            else if (address.includes("BELABAN") == true) { area = "TEMBURONG", kampong = "BELABAN" }
            else if (address.includes("BELAIS") == true) { area = "TEMBURONG", kampong = "BELAIS" }
            else if (address.includes("BELINGOS") == true) { area = "TEMBURONG", kampong = "BELINGOS" }
            else if (address.includes("BIANG") == true) { area = "TEMBURONG", kampong = "BIANG" }
            else if (address.includes("BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
            else if (address.includes("BUDA BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
            else if (address.includes("BUDA-BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
            else if (address.includes("GADONG BARU") == true) { area = "TEMBURONG", kampong = "GADONG BARU" }
            else if (address.includes("KENUA") == true) { area = "TEMBURONG", kampong = "KENUA" }
            else if (address.includes("LABU ESTATE") == true) { area = "TEMBURONG", kampong = "LABU" }
            else if (address.includes("LABU") == true) { area = "TEMBURONG", kampong = "LABU" }
            else if (address.includes("LAGAU") == true) { area = "TEMBURONG", kampong = "LAGAU" }
            else if (address.includes("LAKIUN") == true) { area = "TEMBURONG", kampong = "LAKIUN" }
            else if (address.includes("LAMALING") == true) { area = "TEMBURONG", kampong = "LAMALING" }
            else if (address.includes("LEPONG") == true) { area = "TEMBURONG", kampong = "LEPONG" }
            else if (address.includes("LUAGAN") == true) { area = "TEMBURONG", kampong = "LUAGAN" }
            else if (address.includes("MANIUP") == true) { area = "TEMBURONG", kampong = "MANIUP" }
            else if (address.includes("MENENGAH") == true) { area = "TEMBURONG", kampong = "MENGENGAH" }
            else if (address.includes("NEGALANG") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
            else if (address.includes("NEGALANG ERING") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
            else if (address.includes("NEGALANG UNAT") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
            else if (address.includes("PARIT") == true) { area = "TEMBURONG", kampong = "PARIT" }
            else if (address.includes("PARIT BELAYANG") == true) { area = "TEMBURONG", kampong = "PARIT BELAYANG" }
            else if (address.includes("PAYAU") == true) { area = "TEMBURONG", kampong = "PAYAU" }
            else if (address.includes("PELIUNAN") == true) { area = "TEMBURONG", kampong = "PELIUNAN" }
            else if (address.includes("PERDAYAN") == true) { area = "TEMBURONG", kampong = "PERDAYAN" }
            else if (address.includes("PIASAU-PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
            else if (address.includes("PIASAU PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
            else if (address.includes("PIUNGAN") == true) { area = "TEMBURONG", kampong = "PIUNGAN" }
            else if (address.includes("PUNI") == true) { area = "TEMBURONG", kampong = "PUNI" }
            else if (address.includes("RATAIE") == true) { area = "TEMBURONG", kampong = "RATAIE" }
            else if (address.includes("REBADA") == true) { area = "TEMBURONG", kampong = "REBADA" }
            else if (address.includes("SEKUROP") == true) { area = "TEMBURONG", kampong = "SEKUROP" }
            else if (address.includes("SELANGAN") == true) { area = "TEMBURONG", kampong = "SELANGAN" }
            else if (address.includes("SELAPON") == true) { area = "TEMBURONG", kampong = "SELAPON" }
            else if (address.includes("SEMABAT") == true) { area = "TEMBURONG", kampong = "SEMABAT" }
            else if (address.includes("SEMAMAMNG") == true) { area = "TEMBURONG", kampong = "SEMAMANG" }
            else if (address.includes("SENUKOH") == true) { area = "TEMBURONG", kampong = "SENUKOH" }
            else if (address.includes("SERI TANJONG BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
            else if (address.includes("BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
            else if (address.includes("SIBULU") == true) { area = "TEMBURONG", kampong = "SIBULU" }
            else if (address.includes("SIBUT") == true) { area = "TEMBURONG", kampong = "SIBUT" }
            else if (address.includes("SIMBATANG BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
            else if (address.includes("SIMBATANG BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
            else if (address.includes("SUBOK") == true) { area = "TEMBURONG", kampong = "SUBOK" }
            else if (address.includes("SUMBILING") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
            else if (address.includes("SUMBILING BARU") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
            else if (address.includes("SUMBILING LAMA") == true) { area = "TEMBURONG", kampong = "SUMBILING LAMA" }
            else if (address.includes("SUNGAI RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
            else if (address.includes("SG RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
            else if (address.includes("SUNGAI SULOK") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
            else if (address.includes("SG SULOK ") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
            else if (address.includes("SUNGAI TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
            else if (address.includes("SG TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
            else if (address.includes("SUNGAI TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
            else if (address.includes("SG TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
            else if (address.includes("TANJONG BUNGAR") == true) { area = "TEMBURONG", kampong = "TANJONG BUNGAR" }
            else if (address.includes("TEMADA") == true) { area = "TEMBURONG", kampong = "TEMADA" }
            else if (address.includes("UJONG JALAN") == true) { area = "TEMBURONG", kampong = "UJONG JALAN" }
            else if (address.includes("BANGAR") == true) { area = "TEMBURONG", kampong = "BANGAR" }
            else if (address.includes("TEMBURONG") == true) { area = "TEMBURONG" }
            else { area = "N/A" }

            const finalArea = area;

            // Update Detrack Zone
            const detrackUpdateData = {
                do_number: order.doTrackingNumber,
                data: { zone: finalArea }
            };

            await updateDetrackStatusWithRetry(order.doTrackingNumber, apiKey, detrackUpdateData);

            // Update MongoDB ORDERS.area
            await ORDERS.findByIdAndUpdate(order._id, { area: finalArea });
            console.log(`MongoDB Area Updated for: ${order.doTrackingNumber} → ${finalArea}`);
        }

    } catch (error) {
        console.error('Error in empty area orders check:', error);
    }
}

setInterval(checkActiveDeliveriesStatus, 600000);
setInterval(checkStaleInfoReceivedJobs, 86400000);
setInterval(checkAndUpdateEmptyAreaOrders, 3600000);
checkActiveDeliveriesStatus();
checkStaleInfoReceivedJobs();
checkAndUpdateEmptyAreaOrders();

// --- Utility: normalize Mongo date field (string or {$date}) ---
function normalizeDate(raw) {
    if (!raw) return null;
    if (typeof raw === "string") return new Date(raw);
    if (typeof raw === "object" && raw.$date) return new Date(raw.$date);
    return new Date(raw); // fallback
}

function getLatestOutForDeliveryEntry(history, bruneiDateStr) {
    if (!Array.isArray(history)) return null;

    const entries = history
        .filter(
            h =>
                (h.statusHistory === "Out for Delivery" ||
                    h.statusHistory === "Self Collect") &&
                h.dateUpdated
        )
        .map(h => {
            const dt = normalizeDate(h.dateUpdated);
            if (!dt || isNaN(dt)) return null;

            // Convert to Brunei time
            const bruneiTime = new Date(dt.getTime() + 8 * 60 * 60 * 1000);

            // Convert to YYYY-MM-DD string
            const yyyy = bruneiTime.getFullYear();
            const mm = String(bruneiTime.getMonth() + 1).padStart(2, "0");
            const dd = String(bruneiTime.getDate()).padStart(2, "0");
            const dateStr = `${yyyy}-${mm}-${dd}`;

            return { ...h, _bruneiDateStr: dateStr, _normalizedDate: dt };
        })
        .filter(h => h && h._bruneiDateStr === bruneiDateStr);

    if (!entries.length) return null;

    return entries.reduce((a, b) =>
        a._normalizedDate > b._normalizedDate ? a : b
    );
}

//yes
app.post('/api/getDispatcherJobSummary', ensureAuthenticated, async (req, res) => {
    try {
        const { dispatcher, date } = req.body;
        if (!dispatcher || !date) {
            return res.status(400).json({ error: 'Dispatcher and date are required' });
        }

        // Fetch orders for the selected jobDate
        const orders = await ORDERS.find({ jobDate: date }).lean();

        const filtered = orders
            .map(o => {
                const latest = getLatestOutForDeliveryEntry(o.history, date);
                if (!latest) return null;
                if (dispatcher && latest.lastAssignedTo !== dispatcher) return null;
                return { ...o, latestOutForDelivery: latest };
            })
            .filter(Boolean);

        const totalOrders = filtered.length;

        const productCounts = filtered.reduce((acc, o) => {
            if (o.product) acc[o.product] = (acc[o.product] || 0) + 1;
            return acc;
        }, {});

        const areas = [...new Set(filtered.map(o => o.area).filter(Boolean))];

        res.json({ totalOrders, productCounts, areas });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch job summary' });
    }
});

app.post('/api/getEndOfDaySummary', async (req, res) => {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    try {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        // Find reports updated on that date
        const reports = await REPORTS.find({
            datetimeUpdated: { $gte: start, $lte: end }
        });

        // Process assignedDispatchers to exclude "- Deliver " jobs
        const processedReports = reports.map(report => {
            const filteredDispatchers = (report.assignedDispatchers || []).map(d => {
                const filteredJobs = (d.assignedJob || '')
                    .split('\n')
                    .map(j => j.trim())
                    .filter(j => j.length > 0 && !j.startsWith('- Deliver '));

                if (filteredJobs.length === 0) return null;

                return {
                    dispatcherName: d.dispatcherName,
                    assignedJob: filteredJobs.join('\n')
                };
            }).filter(Boolean); // remove null entries

            return {
                createdBy: report.createdBy,
                assignedDispatchers: filteredDispatchers
            };
        }).filter(r => r.assignedDispatchers.length > 0); // remove empty reports

        res.json({ success: true, reports: processedReports });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/saveReport', ensureAuthenticated, async (req, res) => {
    try {
        let { reportType, reportName, reportContent, assignedDispatchers, forceReplace } = req.body;

        if (!reportType || !reportContent || !reportName) {
            return res.json({ success: false, message: 'Missing data' });
        }

        // --- Filter out "Grand Total" or invalid rows before saving ---
        if (Array.isArray(assignedDispatchers)) {
            assignedDispatchers = assignedDispatchers.filter(d =>
                d &&
                typeof d === 'object' &&
                d.vehicle &&
                d.vehicle.toLowerCase().trim() !== 'grand total:' &&
                !d.vehicle.toLowerCase().includes('grand total') &&
                !d.dispatcherName?.toLowerCase().includes('grand total')
            );
        } else {
            assignedDispatchers = [];
        }

        // --- Extract date from reportName for duplicate checking ---
        const dateMatch = reportName.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
        if (!dateMatch) {
            return res.json({ success: false, message: 'Invalid report name format' });
        }

        const reportDateStr = dateMatch[1]; // e.g., "30.10.2025"

        // Convert dd.mm.yyyy to yyyy-mm-dd for database comparison
        const [day, month, year] = reportDateStr.split('.');
        const normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

        // --- Check for existing same-type report for the same date ---
        const existingReport = await REPORTS.findOne({
            reportType,
            reportName: { $regex: reportDateStr } // Look for reports with this date in the name
        });

        // --- If found and not replacing ---
        if (existingReport && !forceReplace) {
            return res.json({
                success: false,
                duplicate: true,
                message: `A ${reportType} for ${reportDateStr} already exists.`
            });
        }

        // --- If found and replacing ---
        if (existingReport && forceReplace) {
            existingReport.reportName = reportName;
            existingReport.reportContent = reportContent;
            existingReport.assignedDispatchers = assignedDispatchers;
            existingReport.createdBy = req.user.username || req.user.name || req.user.id || 'Unknown';
            existingReport.datetimeUpdated = new Date();
            await existingReport.save();
            return res.json({ success: true, replaced: true, message: 'Report replaced successfully.' });
        }

        // --- Create new report ---
        await REPORTS.create({
            reportType,
            reportName,
            reportContent,
            assignedDispatchers,
            createdBy: req.user.username || req.user.name || req.user.id || 'Unknown',
            datetimeUpdated: new Date()
        });

        res.json({ success: true, message: 'Report saved successfully.' });
    } catch (err) {
        console.error('Error saving report:', err);
        res.json({ success: false, message: err.message });
    }
});

// Report Generator page
app.get('/reportGenerator', ensureAuthenticated, async (req, res) => {
    try {
        const activeVehicles = await VEHICLE.find({ status: 'active' }).exec();
        res.render('reportGenerator', { user: req.user, vehicles: activeVehicles });
    } catch (err) {
        console.error('Error in /reportGenerator:', err);
        res.status(500).send("Error loading report generator page");
    }
});

//yes
app.post('/api/getMorningMileage', ensureAuthenticated, async (req, res) => {
    try {
        const { date } = req.body;
        if (!date) return res.json([]);

        // --- Fetch active vehicles ---
        const vehicles = await VEHICLE.find({ status: 'active' }).lean();
        const vehicleIds = vehicles.map(v => v._id);

        // --- Get latest mileage for each vehicle on or before selected date ---
        const selectedDateEnd = new Date(date);
        selectedDateEnd.setHours(23, 59, 59, 999);

        const latestMileages = await MILEAGELOGS.aggregate([
            {
                $match: {
                    vehicleId: { $in: vehicleIds },
                    date: { $lte: selectedDateEnd }
                }
            },
            { $sort: { date: -1 } },
            {
                $group: {
                    _id: "$vehicleId",
                    mileage: { $first: "$mileage" },
                    date: { $first: "$date" }
                }
            }
        ]);

        const mileageMap = {};
        latestMileages.forEach(m => {
            mileageMap[m._id.toString()] = m.mileage;
        });

        // --- Build result for all vehicles with mileage ---
        const result = vehicles
            .map(v => ({
                plate: v.plate,
                mileage: mileageMap[v._id.toString()] ?? null  // Use null for missing
            }))
            .filter(v => v.mileage !== null); // 🔹 Filter out vehicles without mileage

        // --- Sort descending mileage ---
        result.sort((a, b) => b.mileage - a.mileage);

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch mileage' });
    }
});

// --- Delivery Result Report ---
app.get('/api/delivery-result-report', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: "Missing date" });

        const start = new Date(date + "T00:00:00+08:00");
        const end = new Date(date + "T23:59:59+08:00");

        // 1. Parallelize database queries
        const [orders, reportDoc] = await Promise.all([
            ORDERS.find({ jobDate: date }).lean(),
            REPORTS.findOne({
                reportName: `Operation Morning Report ${new Date(date).toLocaleDateString("en-GB").replace(/\//g, ".")}`
            }).lean()
        ]);

        // 2. Build dispatcher map with proper name handling
        const dispatcherMap = {};
        const fullNameMap = {}; // Map individual names to full dispatcherName

        if (reportDoc?.assignedDispatchers) {
            reportDoc.assignedDispatchers.forEach(d => {
                const names = d.dispatcherName.split('/').map(n => n.trim());

                names.forEach(name => {
                    dispatcherMap[name] = {
                        vehicle: d.vehicle || "-",
                        area: d.area || "-",
                        fullName: d.dispatcherName // Store the full name
                    };
                    fullNameMap[name] = d.dispatcherName; // Map individual to full name
                });

                // Also map the full name itself
                dispatcherMap[d.dispatcherName] = {
                    vehicle: d.vehicle || "-",
                    area: d.area || "-",
                    fullName: d.dispatcherName
                };
            });
        }

        const staffMap = {};
        const allProducts = new Set();

        // 3. Process orders in batches for better memory management
        const batchSize = 100;
        for (let i = 0; i < orders.length; i += batchSize) {
            const batch = orders.slice(i, i + batchSize);

            for (const order of batch) {
                const product = order.product || "N/A";
                allProducts.add(product);

                // 4. Optimize history filtering and processing
                const histories = (order.history || [])
                    .filter(h => {
                        const d = new Date(h.dateUpdated);
                        return d >= start && d <= end;
                    });

                // 5. Use Map for better deduplication performance
                const perDay = new Map();

                histories.forEach(h => {
                    const d = new Date(h.dateUpdated);
                    const dateKey = d.toISOString().split('T')[0];

                    if (!perDay.has(dateKey)) {
                        perDay.set(dateKey, { current: null, final: null });
                    }

                    const existing = perDay.get(dateKey);
                    const isCurrent = h.statusHistory === "Out for Delivery" || h.statusHistory === "Self Collect";
                    const isFinal = h.statusHistory === "Completed" || h.statusHistory === "Failed Delivery";

                    if (isCurrent && (!existing.current || d > new Date(existing.current.dateUpdated))) {
                        existing.current = h;
                    } else if (isFinal && (!existing.final || d > new Date(existing.final.dateUpdated))) {
                        existing.final = h;
                    }
                });

                // 6. Process deduped histories more efficiently
                for (const { current, final } of perDay.values()) {
                    [current, final].forEach((h, index) => {
                        if (!h) return;

                        const staff = h.lastAssignedTo || "Unassigned";
                        if (!staffMap[staff]) {
                            staffMap[staff] = {
                                products: {},
                                totals: { current: 0, completed: 0, failed: 0 }
                            };
                        }

                        if (!staffMap[staff].products[product]) {
                            staffMap[staff].products[product] = { current: 0, completed: 0, failed: 0 };
                        }

                        const productData = staffMap[staff].products[product];
                        const totals = staffMap[staff].totals;

                        if (h.statusHistory === "Out for Delivery" || h.statusHistory === "Self Collect") {
                            productData.current++;
                            totals.current++;
                        } else if (h.statusHistory === "Completed") {
                            productData.completed++;
                            totals.completed++;
                        } else if (h.statusHistory === "Failed Delivery") {
                            productData.failed++;
                            totals.failed++;
                        }
                    });
                }
            }
        }

        // 7. Optimize products filtering
        const products = Array.from(allProducts).filter(p =>
            Object.values(staffMap).some(data =>
                Object.values(data.products[p] || {}).some(count => count > 0)
            )
        );

        // 8. Optimize results mapping
        const results = Object.entries(staffMap).map(([staff, data]) => {
            const productCounts = {};
            products.forEach(p => {
                productCounts[p] = data.products[p] || { current: 0, completed: 0, failed: 0 };
            });

            const { current, completed, failed } = data.totals;
            const total = current + completed + failed;
            const successRate = completed + failed > 0
                ? Math.round((completed / (completed + failed)) * 100)
                : 0;

            // Improved Vehicle & Area lookup with better name matching
            let vehicle = "-";
            let area = "-";
            let reportStaffName = staff;

            if (staff !== "Selfcollect") {
                // First try exact match
                if (dispatcherMap[staff]) {
                    vehicle = dispatcherMap[staff].vehicle;
                    area = dispatcherMap[staff].area;
                    reportStaffName = dispatcherMap[staff].fullName || staff;
                } else {
                    // Try partial matching for names like "Zakwan" in "Zakwan/Wafi"
                    const dispatcherEntry = Object.entries(dispatcherMap).find(([name]) => {
                        // Check if staff name is part of a compound name
                        if (name.includes('/') && name.includes(staff)) {
                            return true;
                        }
                        // Check if compound name contains staff name
                        if (staff.includes('/') && staff.includes(name)) {
                            return true;
                        }
                        return false;
                    });

                    if (dispatcherEntry) {
                        vehicle = dispatcherEntry[1].vehicle;
                        area = dispatcherEntry[1].area;
                        reportStaffName = dispatcherEntry[1].fullName || dispatcherEntry[0];
                    }
                }
            }

            return {
                staff: reportStaffName,
                vehicle,
                area,
                productCounts,
                totals: data.totals,
                total,
                successRate
            };
        });

        res.json({ products, results });
    } catch (err) {
        console.error('Delivery result report error:', err);
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/cod-bt-collected', async (req, res) => {
    try {
        const { date } = req.body;
        if (!date) return res.status(400).json({ error: 'Date is required (YYYY-MM-DD)' });

        const formatCurrency = (num) => `$ ${Number(num || 0).toFixed(2)}`;

        // Fetch completed orders for the date
        const orders = await ORDERS.find({ jobDate: date, currentStatus: "Completed" }).lean();

        // Fetch morning report to map staff names
        const reportDateFormatted = new Date(date).toLocaleDateString("en-GB").replace(/\//g, ".");
        const reportName = `Operation Morning Report ${reportDateFormatted}`;
        const reportDoc = await REPORTS.findOne({ reportName }).lean();

        // Build dispatcher map: single name -> full dispatcherName
        const dispatcherMap = {};
        if (reportDoc && Array.isArray(reportDoc.assignedDispatchers)) {
            reportDoc.assignedDispatchers.forEach(d => {
                const names = d.dispatcherName.split('/').map(n => n.trim());
                names.forEach(name => {
                    dispatcherMap[name] = d.dispatcherName;
                    // Also map the full name to itself for consistency
                    dispatcherMap[d.dispatcherName] = d.dispatcherName;
                });
            });
        }

        // Aggregate per product
        const productTotals = {};
        orders.forEach(o => {
            const amount = Number(o.totalPrice) || 0;
            if (amount <= 0) return;

            const pm = (o.paymentMethod || '').toLowerCase();
            if (!['cash', 'bank transfer (bibd)', 'bank transfer (baiduri)', 'bill payment (bibd)'].includes(pm)) return;

            const prod = o.product || 'N/A';
            if (!productTotals[prod]) productTotals[prod] = { cash: 0, bt: 0, total: 0 };

            if (pm === 'cash') productTotals[prod].cash += amount;
            else productTotals[prod].bt += amount;
            productTotals[prod].total += amount;
        });

        const products = Object.keys(productTotals).filter(p => productTotals[p].total > 0).sort();
        if (!products.length) return res.send('<p>No COD/BT data available for this date.</p>');

        // Aggregate per staff
        const staffMap = {};
        orders.forEach(o => {
            const amount = Number(o.totalPrice) || 0;
            if (amount <= 0) return;

            const pm = (o.paymentMethod || '').toLowerCase();
            if (!['cash', 'bank transfer (bibd)', 'bank transfer (baiduri)', 'bill payment (bibd)'].includes(pm)) return;

            let staff = o.assignedTo || "Unassigned";
            if (!staffMap[staff]) staffMap[staff] = { products: {}, totalAll: 0 };
            const prod = o.product || 'N/A';
            if (!products.includes(prod)) return;
            if (!staffMap[staff].products[prod]) staffMap[staff].products[prod] = { cash: 0, bt: 0, total: 0 };

            if (pm === 'cash') staffMap[staff].products[prod].cash += amount;
            else staffMap[staff].products[prod].bt += amount;
            staffMap[staff].products[prod].total += amount;
            staffMap[staff].totalAll += amount;
        });

        // Separate Selfcollect
        const selfcollect = staffMap['Selfcollect'];
        if (selfcollect) delete staffMap['Selfcollect'];

        // Total per product
        const totalByProduct = {};
        products.forEach(p => totalByProduct[p] = { total: 0, cash: 0, bt: 0 });
        Object.values(staffMap).forEach(staffData => {
            products.forEach(p => {
                const vals = staffData.products[p] || { total: 0, cash: 0, bt: 0 };
                totalByProduct[p].cash += vals.cash;
                totalByProduct[p].bt += vals.bt;
                totalByProduct[p].total += vals.total;
            });
        });

        // Build HTML
        let html = `<table class="table table-bordered">
<thead>
<tr style="background-color: lightblue; font-weight: bold;">
<th colspan="${1 + products.length * 3}" style="text-align:left;">3. COD/BT Collection</th>
</tr>
<tr>
<th rowspan="2">Staff/Product</th>
${products.map(p => `<th colspan="3">${p}</th>`).join('')}
</tr>
<tr>
${products.map(_ => `<th>Cash</th><th>BT</th><th>Total Amount</th>`).join('')}
</tr>
</thead>
<tbody>`;

        // Table body per staff
        Object.keys(staffMap).sort().forEach(staff => {
            const displayName = dispatcherMap[staff] || staff;
            html += `<tr><td>${displayName}</td>`;
            const data = staffMap[staff].products;
            products.forEach(p => {
                const vals = data[p] || { total: 0, cash: 0, bt: 0 };
                html += `<td>${formatCurrency(vals.cash)}</td><td>${formatCurrency(vals.bt)}</td><td>${formatCurrency(vals.total)}</td>`;
            });
            html += `</tr>`;
        });

        // Selfcollect row
        if (selfcollect) {
            html += `<tr><td>Selfcollect</td>`;
            products.forEach(p => {
                const vals = selfcollect.products[p] || { total: 0, cash: 0, bt: 0 };
                html += `<td>${formatCurrency(vals.cash)}</td><td>${formatCurrency(vals.bt)}</td><td>${formatCurrency(vals.total)}</td>`;
            });
            html += `</tr>`;
        }

        // Totals row
        html += `<tr style="font-weight:bold; background-color:#d4f4d4;"><td>Total</td>`;
        products.forEach(p => {
            const vals = totalByProduct[p];
            html += `<td>${formatCurrency(vals.cash)}</td><td>${formatCurrency(vals.bt)}</td><td>${formatCurrency(vals.total)}</td>`;
        });
        html += `</tr>`;

        const grandTotalCash = products.reduce((sum, p) => sum + totalByProduct[p].cash, 0);
        const grandTotalBT = products.reduce((sum, p) => sum + totalByProduct[p].bt, 0);
        const grandTotal = grandTotalCash + grandTotalBT;

        html += `<tr><td>Grand Total Cash</td><td colspan="${products.length * 3}"><b>${formatCurrency(grandTotalCash)}</b></td></tr>`;
        html += `<tr><td>Grand Total BT</td><td colspan="${products.length * 3}"><b>${formatCurrency(grandTotalBT)}</b></td></tr>`;
        html += `<tr><td>Grand Total Cash and BT</td><td colspan="${products.length * 3}"><b>${formatCurrency(grandTotal)}</b></td></tr>`;

        html += `</tbody></table>`;
        res.send(html);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/warehouseTableGenerate', async (req, res) => {
    try {
        const { date } = req.body;
        if (!date) return res.status(400).json({ error: 'Date is required (YYYY-MM-DD)' });

        const today = new Date(date + "T23:59:59+08:00");
        const maxDays = 30;
        const minDate = new Date(today);
        minDate.setDate(minDate.getDate() - maxDays);

        // Remove product filtering to include ALL products
        const warehouseOrders = await ORDERS.find({
            currentStatus: { $in: ["At Warehouse", "Return to Warehouse"] },
            warehouseEntryDateTime: { $exists: true, $ne: null }
        }).lean();

        console.log('Total warehouse orders found:', warehouseOrders.length);

        // Apply only the 30-day aging filter (client-side)
        const filteredWarehouseOrders = warehouseOrders.filter(o => {
            if (!o.warehouseEntryDateTime) return false;
            const entryDate = new Date(o.warehouseEntryDateTime);
            const diffDays = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));
            return diffDays <= maxDays && diffDays >= 0;
        });

        console.log('Filtered warehouse orders (30 days):', filteredWarehouseOrders.length);

        // Group by product
        const warehouseMap = {};
        filteredWarehouseOrders.forEach(o => {
            const prod = o.product || "N/A";
            if (!warehouseMap[prod]) warehouseMap[prod] = [];
            warehouseMap[prod].push(o);
        });

        console.log('Products found:', Object.keys(warehouseMap));

        const allAreas = ["JT", "G", "B", "TUTONG", "KB", "TEMBURONG"];
        let areasInTable = allAreas.filter(area =>
            filteredWarehouseOrders.some(o => area === "KB"
                ? o.area && (o.area.toUpperCase().includes("KB") || o.area.toUpperCase().includes("LUMUT") || o.area.toUpperCase().includes("SERIA"))
                : o.area === area)
        );
        if (filteredWarehouseOrders.some(o => o.area === "N/A")) areasInTable.push("N/A");

        let html = `<table id="warehouseTable" class="table table-bordered">
<thead>
<tr style="background-color: lightblue; font-weight: bold;">
<th colspan="${10 + areasInTable.length + 1}" style="text-align:left;">4. Warehouse</th>
</tr>
<tr>
<th rowspan="2">Product</th>
<th rowspan="2">AWB</th>
<th rowspan="2">Aging</th>
<th rowspan="2">Total Jobs</th>
<th rowspan="2">Completed</th>
<th colspan="3">In Store</th>
<th colspan="${areasInTable.length}">Area (In Store)</th>
<th colspan="2">Today's Job Result</th>
<th rowspan="2">Action</th>
</tr>
<tr>
<th>K1</th><th>K2</th><th>Total</th>
${areasInTable.map(a => `<th>${a}</th>`).join('')}
<th>Delivered</th><th>Returned</th>
</tr>
</thead>
<tbody>`;

        const awbProducts = ["mglobal", "ewe", "pdu"]; // These will show AWB breakdown
        const sortedProducts = Object.keys(warehouseMap).sort((a, b) => {
            const getMaxAging = prod => Math.max(...warehouseMap[prod].map(o => Math.floor((today - new Date(o.warehouseEntryDateTime)) / (1000 * 60 * 60 * 24))));
            return getMaxAging(b) - getMaxAging(a);
        });

        // For completed counts, we still need to filter by relevant AWB products
        const relevantProducts = ["mglobal", "pdu", "ewe"];
        const completedAggregation = await ORDERS.aggregate([
            {
                $match: {
                    currentStatus: "Completed",
                    product: { $in: relevantProducts.map(p => new RegExp(p, 'i')) }
                }
            },
            {
                $project: {
                    awbs: {
                        $filter: {
                            input: [
                                { $ifNull: [{ $trim: { input: "$mawbNo" } }, ""] },
                                { $ifNull: [{ $trim: { input: "$hawbNo" } }, ""] }
                            ],
                            as: "awb",
                            cond: { $ne: ["$$awb", ""] }
                        }
                    }
                }
            },
            { $unwind: "$awbs" },
            { $group: { _id: "$awbs", count: { $sum: 1 } } }
        ]);

        const completedCountsMap = {};
        completedAggregation.forEach(item => {
            completedCountsMap[item._id] = item.count;
        });

        // Process each product
        for (const prod of sortedProducts) {
            const ordersByProduct = warehouseMap[prod];
            const isAwbProduct = awbProducts.includes(prod.toLowerCase());
            let rowsData = [];

            if (isAwbProduct) {
                // AWB products (mglobal, ewe, pdu) - show AWB breakdown
                const mawbMap = {};
                ordersByProduct.forEach(o => {
                    const mawb = o.mawbNo || "-";
                    if (!mawbMap[mawb]) mawbMap[mawb] = [];
                    mawbMap[mawb].push(o);
                });

                const sortedMawb = Object.keys(mawbMap).sort((a, b) => {
                    const maxAging = arr => Math.max(...arr.map(o => Math.floor((today - new Date(o.warehouseEntryDateTime)) / (1000 * 60 * 60 * 24))));
                    return maxAging(mawbMap[b]) - maxAging(mawbMap[a]);
                });

                // Get total jobs per AWB
                const uniqueAwbs = sortedMawb.filter(m => m && m !== "-").map(m => m.trim());
                const totalCountsMap = {};

                if (uniqueAwbs.length > 0) {
                    const awbCounts = await ORDERS.aggregate([
                        {
                            $match: {
                                $or: [
                                    { mawbNo: { $in: uniqueAwbs } },
                                    { hawbNo: { $in: uniqueAwbs } }
                                ]
                            }
                        },
                        {
                            $project: {
                                awbNos: {
                                    $concatArrays: [
                                        [{ $ifNull: [{ $trim: { input: "$mawbNo" } }, ""] }],
                                        [{ $ifNull: [{ $trim: { input: "$hawbNo" } }, ""] }]
                                    ]
                                }
                            }
                        },
                        { $unwind: "$awbNos" },
                        { $match: { awbNos: { $in: uniqueAwbs } } },
                        { $group: { _id: "$awbNos", count: { $sum: 1 } } }
                    ]);

                    awbCounts.forEach(r => {
                        if (r._id) totalCountsMap[r._id] = r.count;
                    });
                }

                // Process each MAWB
                for (const mawb of sortedMawb) {
                    const ordersList = mawbMap[mawb];
                    const dates = ordersList.map(o => new Date(o.warehouseEntryDateTime).toISOString().split("T")[0]);
                    const freqMap = {};
                    dates.forEach(d => freqMap[d] = (freqMap[d] || 0) + 1);
                    const majorityDate = Object.keys(freqMap).reduce((a, b) => freqMap[a] > freqMap[b] ? a : b);
                    const aging = Math.floor((today - new Date(majorityDate)) / (1000 * 60 * 60 * 24));

                    const k1 = ordersList.filter(o => o.latestLocation === "Warehouse K1").length;
                    const k2 = ordersList.filter(o => o.latestLocation === "Warehouse K2").length;
                    const totalInStore = k1 + k2;

                    const areaCounts = {};
                    areasInTable.forEach(a => {
                        if (a === "KB") {
                            areaCounts[a] = ordersList.filter(o => {
                                if (!o.area) return false;
                                const areaNormalized = o.area.toUpperCase().replace(/\s/g, '');
                                return areaNormalized.includes("KB") || areaNormalized.includes("LUMUT") || areaNormalized.includes("SERIA");
                            }).length;
                        } else if (a === "N/A") {
                            areaCounts[a] = ordersList.filter(o => o.area && o.area.toUpperCase().includes("N/A")).length;
                        } else {
                            areaCounts[a] = ordersList.filter(o => o.area === a).length;
                        }
                    });

                    let totalJobs, completedJobs;
                    if (prod.toLowerCase() === "ewe" && mawb === "UNMANIFESTED") {
                        totalJobs = "-";
                        completedJobs = "-";
                    } else {
                        totalJobs = mawb === "-" ? ordersList.length : totalCountsMap[mawb.trim()] || 0;
                        completedJobs = (mawb && mawb !== "-") ? (completedCountsMap[mawb.trim()] || 0) : "-";
                    }

                    const delivered = await ORDERS.countDocuments({
                        product: prod,
                        mawbNo: mawb !== "-" ? mawb : { $exists: true },
                        jobDate: date,
                        currentStatus: "Completed"
                    });

                    const returned = ordersList.filter(o => o.currentStatus === "Return to Warehouse" && o.jobDate === date).length;

                    rowsData.push({ mawb, aging, totalJobs, completedJobs, k1, k2, totalInStore, areaCounts, delivered, returned });
                }

            } else {
                // NON-AWB products - show single row with aging range
                const entryDates = ordersByProduct.map(o => new Date(o.warehouseEntryDateTime));
                const agingDays = entryDates.map(d => Math.floor((today - d) / (1000 * 60 * 60 * 24)));
                const minDays = Math.min(...agingDays);
                const maxDays = Math.max(...agingDays);

                // Show range if different, single number if same
                const aging = minDays === maxDays ? `${minDays}` : `${minDays}-${maxDays}`;

                const k1 = ordersByProduct.filter(o => o.latestLocation === "Warehouse K1").length;
                const k2 = ordersByProduct.filter(o => o.latestLocation === "Warehouse K2").length;
                const totalInStore = k1 + k2;

                const areaCounts = {};
                areasInTable.forEach(a => {
                    if (a === "KB") {
                        areaCounts[a] = ordersByProduct.filter(o => {
                            if (!o.area) return false;
                            const areaNormalized = o.area.toUpperCase().replace(/\s/g, '');
                            return areaNormalized.includes("KB") || areaNormalized.includes("LUMUT") || areaNormalized.includes("SERIA");
                        }).length;
                    } else if (a === "N/A") {
                        areaCounts[a] = ordersByProduct.filter(o => o.area && o.area.toUpperCase().includes("N/A")).length;
                    } else {
                        areaCounts[a] = ordersByProduct.filter(o => o.area === a).length;
                    }
                });

                const delivered = await ORDERS.countDocuments({
                    product: prod,
                    jobDate: date,
                    currentStatus: "Completed"
                });

                const returned = ordersByProduct.filter(o => o.currentStatus === "Return to Warehouse" && o.jobDate === date).length;

                // Single row for non-AWB products
                rowsData.push({
                    mawb: "-",
                    aging,
                    totalJobs: ordersByProduct.length,
                    completedJobs: "-", // non-AWB products don't have completed counts
                    k1, k2, totalInStore, areaCounts, delivered, returned
                });
            }

            // Generate HTML rows
            if (rowsData.length > 0) {
                rowsData.forEach((row, index) => {
                    html += '<tr>';
                    if (index === 0) html += `<td rowspan="${rowsData.length}">${prod}</td>`;
                    html += `<td>${row.mawb}</td>
<td>${row.aging}</td>
<td>${row.totalJobs}</td>
<td>${row.completedJobs}</td>
<td>${row.k1}</td><td>${row.k2}</td><td>${row.totalInStore}</td>
${areasInTable.map(a => `<td>${row.areaCounts[a]}</td>`).join('')}
<td>${row.delivered}</td><td>${row.returned}</td>
<td><button class="btn btn-sm btn-danger removeWarehouseRowBtn">🗑️</button></td>`;
                    html += '</tr>';
                });
            }
        }

        // Add empty message if no data
        if (sortedProducts.length === 0) {
            html += `<tr><td colspan="${13 + areasInTable.length}" style="text-align: center;">No warehouse data found for the selected date range</td></tr>`;
        }

        html += `</tbody></table>`;
        res.send(html);

    } catch (err) {
        console.error('Error in warehouseTableGenerate:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================================================
// 🚗 Vehicle Report (Table 5)
// ==================================================
app.post('/api/vehicle-report', async (req, res) => {
    try {
        const { date } = req.body;
        if (!date) return res.status(400).send('Missing date');

        const start = new Date(date + "T00:00:00+08:00");
        const end = new Date(date + "T23:59:59+08:00");

        // 1️⃣ Fetch report data for that date
        const reports = await REPORTS.find({
            datetimeUpdated: { $gte: start, $lte: end }
        });

        // 2️⃣ Fetch all vehicle data
        const vehicles = await VEHICLE.find({});
        const vehicleMap = {};
        vehicles.forEach(v => {
            vehicleMap[v._id.toString()] = v.plate;
        });

        // 3️⃣ Build rows
        let rowsHTML = '';

        reports.forEach(r => {
            if (!r.assignedDispatchers || !Array.isArray(r.assignedDispatchers)) return;

            r.assignedDispatchers.forEach(d => {
                const vehicle = d.vehicle || '-';
                const dispatcher = d.dispatcherName || '-';
                const morningMileage = d.mileage || 0;   // Morning Mileage
                const eodMileage = '';                   // Start empty
                const mileageUsed = 0;                   // Will be calculated in frontend

                rowsHTML += `
          <tr>
            <td contenteditable="true">${vehicle}</td>
            <td contenteditable="true">${dispatcher}</td>
            <td><input type="number" class="morningMileage" value="${morningMileage}" readonly></td>
            <td><input type="number" class="eodMileage"></td>
            <td><input type="number" class="mileageUsed" value="${mileageUsed}" readonly></td>
            <td contenteditable="true">No</td>
            <td contenteditable="true"></td>
            <td contenteditable="true" class="paidAmount"></td>
            <td contenteditable="true"></td>
            <td contenteditable="true"></td> <!-- NEW: Refilled Fuel Mileage -->
            <td contenteditable="true"></td>
            <td><button class="btn btn-sm btn-danger removeRowBtn">🗑️</button></td>
          </tr>
        `;
            });
        });

        // 4️⃣ Return full HTML table
        const tableHTML = `
      <div style="margin-top:30px;">
        <table class="table table-bordered" id="vehicleReportTable">
          <thead>
            <tr style="background:lightblue;font-weight:bold;">
              <th colspan="12" style="text-align:left;">5. Vehicle Report</th>
            </tr>
            <tr>
              <th>Vehicle No.</th>
              <th>Dispatcher</th>
              <th>Morning Mileage (km)</th>
              <th>EOD Mileage (km)</th>
              <th>Mileage Used (km)</th>
              <th>Refilled Fuel?</th>
              <th>Receipt No.</th>
              <th>Paid Amount</th>
              <th>Refilled Amount</th>
              <th>Refilled Fuel Mileage</th> <!-- NEW COLUMN -->
              <th>Location</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${rowsHTML || '<tr><td colspan="12" class="text-center">No vehicle data found.</td></tr>'}</tbody>
        </table>

        <button id="addVehicleRowBtn" class="btn btn-primary btn-sm">➕ Add Row</button>
      </div>
    `;

        res.send(tableHTML);
    } catch (err) {
        console.error('Error generating vehicle report:', err);
        res.status(500).send('Error generating vehicle report');
    }
});

// COD/BT Collected API with date filtering and caching
app.get('/api/codbt-collected', async (req, res) => {
    try {
        const dateParam = req.query.date; // YYYY-MM-DD
        if (!dateParam) {
            return res.status(400).json({ error: 'Missing date parameter (YYYY-MM-DD).' });
        }

        const moment = require('moment');
        const formattedDateKey = moment(dateParam, 'YYYY-MM-DD').format('DD-MM-YYYY');

        // Check cache first
        const cached = codBtCache.get(formattedDateKey);
        if (cached) return res.json({ [formattedDateKey]: cached });

        // Fetch and group
        const codBtMap = await getCodBtMapForDate(dateParam);
        const mapData = codBtMap[formattedDateKey] || {};

        // Cache the data
        codBtCache.set(formattedDateKey, mapData);

        res.json({ [formattedDateKey]: mapData });
    } catch (err) {
        console.error('Error /api/codbt-collected:', err);
        res.status(500).json({ error: 'Failed to fetch COD/BT data.' });
    }
});

// 🔹 API endpoint
app.get('/api/new-orders/gr-website', async (req, res) => {
    try {
        const dateParam = req.query.date; // YYYY-MM-DD
        if (!dateParam) return res.status(400).json({ error: 'Missing date parameter' });

        const cacheKey = `grWebsite-${dateParam}`;
        const cachedData = grWebsiteCache.get(cacheKey);
        if (cachedData) return res.json(cachedData);

        const data = await fetchGrWebsiteOrders(dateParam);

        // Save to cache
        grWebsiteCache.set(cacheKey, data);

        res.json(data);
    } catch (error) {
        console.error('Error fetching GR Website new orders:', error);
        res.status(500).json({ error: 'Failed to fetch GR Website new orders.' });
    }
});

app.get('/api/completed-jobs', async (req, res) => {
    try {
        const moment = require('moment');
        const dateParam = req.query.date;
        if (!dateParam) return res.status(400).json({ error: 'Missing date parameter' });

        const startOfDay = moment(dateParam).startOf('day');
        const endOfDay = moment(dateParam).endOf('day');

        // Fetch all orders with failed histories
        const orders = await ORDERS.find({
            product: { $nin: [null, ""] },
            "history.statusHistory": { $in: ["Failed Delivery", "Failed Collection"] }
        }).lean();

        const failedJobs = [];

        orders.forEach(order => {
            order.history.forEach(h => {
                if (["Failed Delivery", "Failed Collection"].includes(h.statusHistory)) {
                    const dateUpdated = h.dateUpdated ? new Date(h.dateUpdated) : null;

                    // Only include failed if it happened on the selected date
                    if (
                        dateUpdated &&
                        moment(dateUpdated).isBetween(startOfDay, endOfDay, undefined, '[]') &&
                        h.lastAssignedTo && h.lastAssignedTo.trim() !== ""  // skip if null/empty
                    ) {

                        // Check if the same order has a Completed on the same date
                        const completedSameDay = order.history.some(hist =>
                            hist.statusHistory === "Completed" &&
                            hist.dateUpdated &&
                            moment(hist.dateUpdated).isBetween(startOfDay, endOfDay, undefined, '[]')
                        );

                        if (!completedSameDay) {
                            failedJobs.push({
                                doTrackingNumber: order.doTrackingNumber || '-',
                                product: order.product || '-',
                                jobMethod: order.jobMethod || '-',
                                assignedTo: h.lastAssignedTo || 'Unassigned',
                                reason: h.reason || h.statusHistory || '-'
                            });
                        }
                    }
                }
            });
        });

        // Completed and In Progress jobs still filtered by jobDate
        const completedJobs = await ORDERS.find({
            currentStatus: "Completed",
            jobDate: dateParam,
            product: { $nin: [null, ""] }
        }).lean();

        const inProgressJobs = await ORDERS.find({
            currentStatus: { $in: ["Out for Delivery", "Self Collect", "Drop Off"] },
            jobDate: dateParam,
            product: { $nin: [null, ""] }
        }).lean();

        const groupByDispatcher = (jobsArray) => {
            const map = {};
            jobsArray.forEach(job => {
                const dispatcher = job.assignedTo || 'Unassigned';
                if (!map[dispatcher]) map[dispatcher] = [];
                map[dispatcher].push(job);
            });
            return map;
        };

        const groupedCompleted = groupByDispatcher(completedJobs);
        const groupedInProgress = groupByDispatcher(inProgressJobs);
        const groupedFailed = groupByDispatcher(failedJobs);

        // Combine dispatchers
        const dispatchers = new Set([
            ...Object.keys(groupedCompleted),
            ...Object.keys(groupedInProgress),
            ...Object.keys(groupedFailed),
        ]);

        const result = {};
        dispatchers.forEach(dispatcher => {
            const completed = groupedCompleted[dispatcher] || [];
            const inProgress = groupedInProgress[dispatcher] || [];
            const failed = groupedFailed[dispatcher] || [];

            // Skip dispatcher if all counts are zero
            if (completed.length + inProgress.length + failed.length === 0) return;

            result[dispatcher] = {
                completed,
                inProgress,
                failed,
            };
        });

        return res.json(result);

    } catch (error) {
        console.error('Error fetching completed jobs:', error);
        res.status(500).json({ error: 'Failed to fetch completed jobs.' });
    }
});

// 🔹 Helper: fetch & group orders for a given date
async function fetchGrWebsiteOrders(dateParam) {
    // Put allowedProducts inside since it's only needed here
    const allowedProducts = [
        "pharmacymoh",
        "pharmacyjpmc",
        "pharmacyphc",
        "localdelivery",
        "cbsl"
    ];

    // Brunei timezone (UTC+8)
    const startOfDay = moment.tz(dateParam + ' 00:00:00', 'YYYY-MM-DD HH:mm:ss', 'Asia/Brunei').utc().format();
    const endOfDay = moment.tz(dateParam + ' 23:59:59', 'YYYY-MM-DD HH:mm:ss', 'Asia/Brunei').utc().format();

    // Only fetch orders where "Info Received" exists in history within the date range
    const orders = await ORDERS.find({
        product: { $in: allowedProducts },
        history: {
            $elemMatch: {
                statusHistory: "Info Received",
                dateUpdated: { $gte: startOfDay, $lte: endOfDay }
            }
        }
    }).lean();

    // Attach dateUpdated and orderTime
    orders.forEach(order => {
        const infoHistory = order.history.find(h =>
            h.statusHistory === "Info Received" &&
            h.dateUpdated >= startOfDay &&
            h.dateUpdated <= endOfDay
        );

        order.dateUpdated = infoHistory.dateUpdated;
        order.orderTime = moment(infoHistory.dateUpdated).tz('Asia/Brunei').format("h:mm a");
    });

    // Sort newest to oldest
    orders.sort((a, b) => new Date(b.dateUpdated) - new Date(a.dateUpdated));

    // Group by product
    const groupedByProduct = {};
    orders.forEach(order => {
        const product = order.product || 'Unknown';
        if (!groupedByProduct[product]) groupedByProduct[product] = [];
        groupedByProduct[product].push(order);
    });

    // Reorder by allowedProducts
    const orderedResult = {};
    allowedProducts.forEach(product => {
        if (groupedByProduct[product]) orderedResult[product] = groupedByProduct[product];
    });

    return orderedResult;
}

// Helper function for grouping COD/BT completed orders by date and dispatcher
async function getCodBtMapForDate(dateParam) {
    const moment = require('moment');
    const formattedDateKey = moment(dateParam, 'YYYY-MM-DD').format('DD-MM-YYYY');

    // Fetch completed orders with filtering
    const completedOrders = await ORDERS.find({
        currentStatus: "Completed",
        jobDate: dateParam,
        paymentMethod: { $ne: "NON COD" },
        product: { $nin: [null, ""] }
    }).lean();

    if (!completedOrders || completedOrders.length === 0) {
        return { [formattedDateKey]: {} };
    }

    const dispatcherMap = {};

    completedOrders.forEach(order => {
        const totalPrice = Number(order.totalPrice) || 0;
        if (totalPrice <= 0) return;

        const dispatcher = order.assignedTo || "Unassigned";
        const paymentMethod = order.paymentMethod || '';
        const jobMethod = order.jobMethod || '-';

        if (dispatcher === 'Selfcollect') {
            if (!dispatcherMap[dispatcher]) dispatcherMap[dispatcher] = { __statuses: {} };
            if (!dispatcherMap[dispatcher].__statuses[jobMethod]) {
                dispatcherMap[dispatcher].__statuses[jobMethod] = { total: 0, cash: 0, bt: 0, jobs: [] };
            }

            const group = dispatcherMap[dispatcher].__statuses[jobMethod];
            group.total += totalPrice;
            if (paymentMethod === "Cash") group.cash += totalPrice;
            else if (paymentMethod.includes("Bank Transfer") || paymentMethod.includes("Bill Payment")) group.bt += totalPrice;

            group.jobs.push({
                doTrackingNumber: order.doTrackingNumber || '-',
                product: order.product || '-',
                jobMethod,
                paymentMethod,
                totalPrice
            });

        } else {
            if (!dispatcherMap[dispatcher]) dispatcherMap[dispatcher] = { total: 0, cash: 0, bt: 0, jobs: [] };

            const group = dispatcherMap[dispatcher];
            group.total += totalPrice;
            if (paymentMethod === "Cash") group.cash += totalPrice;
            else if (paymentMethod.includes("Bank Transfer") || paymentMethod.includes("Bill Payment")) group.bt += totalPrice;

            group.jobs.push({
                doTrackingNumber: order.doTrackingNumber || '-',
                product: order.product || '-',
                jobMethod,
                paymentMethod,
                totalPrice
            });
        }
    });

    // Sort Selfcollect statuses (Self Collect first, Drop Off second)
    if (dispatcherMap['Selfcollect']) {
        const statuses = dispatcherMap['Selfcollect'].__statuses;
        const orderedStatuses = {};
        ['Self Collect', 'Drop Off'].forEach(status => {
            if (statuses[status]) orderedStatuses[status] = statuses[status];
        });
        Object.keys(statuses).forEach(status => {
            if (!orderedStatuses[status]) orderedStatuses[status] = statuses[status];
        });
        dispatcherMap['Selfcollect'].__statuses = orderedStatuses;
    }

    // Sort dispatchers (Selfcollect last)
    const orderedDispatcherMap = {};
    Object.keys(dispatcherMap).sort((a, b) => {
        if (a === 'Selfcollect') return 1;
        if (b === 'Selfcollect') return -1;
        return a.localeCompare(b);
    }).forEach(dispatcher => {
        orderedDispatcherMap[dispatcher] = dispatcherMap[dispatcher];
    });

    return { [formattedDateKey]: orderedDispatcherMap };
}

// Helper: build MongoDB query based on filters
function buildQuery(filters) {
    const query = {};

    // ===== Exact match fields (excluding tracking numbers) =====
    const exactFields = ['mawbNo', 'receiverPostalCode', 'icPassNum', 'patientNumber'];
    exactFields.forEach(field => {
        if (filters[field] && filters[field].trim() !== '') {
            query[field] = filters[field].trim();
        }
    });

    // ===== Go Rush & Original Tracking No. (multiple lines) =====
    ['doTrackingNumber', 'parcelTrackingNum'].forEach(field => {
        if (filters[field] && filters[field].trim() !== '') {
            const values = filters[field].split('\n').map(v => v.trim()).filter(v => v);
            if (values.length === 1) query[field] = values[0];
            else if (values.length > 1) query[field] = { $in: values };
        }
    });

    // ===== Partial / contains fields =====
    const partialFields = [
        'receiverAddress',
        'receiverName',
        'receiverPhoneNumber',
        'additionalPhoneNumber'
    ];
    partialFields.forEach(field => {
        if (filters[field] && filters[field].trim() !== '') {
            query[field] = { $regex: filters[field].trim(), $options: 'i' };
        }
    });

    // ===== Dropdown / multi-select exact match =====
    const multiFields = [
        'jobMethod',
        'product',
        'assignedTo',
        'area',
        'currentStatus',
        'latestReason',
        'paymentMethod',
        'latestLocation'
    ];
    multiFields.forEach(field => {
        if (filters[field]) {
            if (Array.isArray(filters[field]) && filters[field].length > 0) {
                query[field] = { $in: filters[field].map(v => v.trim()) };
            } else if (!Array.isArray(filters[field]) && filters[field].trim() !== '') {
                query[field] = filters[field].trim();
            }
        }
    });

    // ===== Date range filters =====
    if (filters.jobDateFrom || filters.jobDateTo) {
        query.jobDate = {};
        if (filters.jobDateFrom) query.jobDate.$gte = filters.jobDateFrom;
        if (filters.jobDateTo) query.jobDate.$lte = filters.jobDateTo;
    }

    if (filters.creationDateFrom || filters.creationDateTo) {
        query.creationDate = {};
        if (filters.creationDateFrom) query.creationDate.$gte = filters.creationDateFrom;
        if (filters.creationDateTo) query.creationDate.$lte = filters.creationDateTo;
    }

    return query;
}

// GET /searchJobs
app.get('/searchJobs', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        res.render('searchJobs', { moment: moment, user: req.user });
    } catch (err) {
        console.error('Render Search Jobs Error:', err);
        res.status(500).send('Failed to load Search Jobs page');
    }
});

// POST /searchJobs
app.post('/searchJobs', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const filters = req.body;
        const query = buildQuery(filters);

        const cacheKey = JSON.stringify(query);
        if (searchJobsCache.has(cacheKey)) {
            return res.json(searchJobsCache.get(cacheKey));
        }

        // Fetch from DB
        const orders = await ORDERS.find(query).sort({ _id: -1 }).lean();

        const today = new Date();

        // Flatten objects for DataTable and calculate Age
        const formattedOrders = orders.map(o => {
            let age = '';
            if (
                o.warehouseEntry === "Yes" &&
                o.currentStatus !== "Completed" &&
                o.warehouseEntryDateTime
            ) {
                const entryDate = new Date(o.warehouseEntryDateTime);
                const diffTime = today - entryDate; // milliseconds
                age = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // convert to days
            }

            // === Handling Charge Logic ===
            let handlingCharge = '';
            let weight = parseFloat(o.parcelWeight) || 0;
            let product = (o.product || '').toLowerCase();

            if (product.includes('mglobal')) {
                handlingCharge = (Math.round((2.5 + 0.25 * Math.max(0, weight - 3)) * 1000) / 1000).toFixed(3);
            } else if (product.includes('pdu')) {
                handlingCharge = (Math.round((2.8 + 0.25 * Math.max(0, weight - 3)) * 1000) / 1000).toFixed(3);

            } else if (product.includes('ewe') || product.includes('ewens')) {
                let charge2_8 = (Math.round((2.8 + 0.25 * Math.max(0, weight - 3)) * 1000) / 1000).toFixed(3);
                let charge3_5 = (Math.round((3.5 + 0.50 * Math.max(0, weight - 3)) * 1000) / 1000).toFixed(3);

                let firstChar = o.receiverPostalCode ? o.receiverPostalCode.charAt(0) : '';
                if (firstChar === 'B') {
                    handlingCharge = charge2_8;
                } else if (['K', 'T', 'P'].includes(firstChar)) {
                    handlingCharge = charge3_5;
                } else {
                    if (o.area && o.area !== 'N/A') {
                        if (['TEMBURONG', 'KB', 'KB / SERIA', 'LUMUT', 'TUTONG'].includes(o.area)) {
                            handlingCharge = charge3_5;
                        } else {
                            handlingCharge = charge2_8;
                        }
                    } else {
                        handlingCharge = `${charge2_8} or ${charge3_5}`;
                    }
                }
            }

            return {
                doTrackingNumber: o.doTrackingNumber || '',
                product: o.product || '',
                currentStatus: o.currentStatus || '',
                latestLocation: o.latestLocation || '',
                age: age,
                area: o.area || '',
                jobMethod: o.jobMethod || '',
                jobDate: o.jobDate || '',
                assignedTo: o.assignedTo || '',
                paymentMethod: o.paymentMethod || '',
                paymentAmount: o.paymentAmount || '',
                receiverName: o.receiverName || '',
                receiverAddress: o.receiverAddress || '',
                receiverPostalCode: o.receiverPostalCode || '',
                receiverPhoneNumber: o.receiverPhoneNumber || '',
                additionalPhoneNumber: o.additionalPhoneNumber || '',
                creationDate: o.creationDate || '',
                remarks: o.remarks || '',
                grRemark: o.grRemark || '',
                mawbNo: o.mawbNo || '',
                parcelTrackingNum: o.parcelTrackingNum || '',
                icPassNum: o.icPassNum || '',
                patientNumber: o.patientNumber || '',
                screenshotInvoice: o.screenshotInvoice || '',
                cargoPrice: o.cargoPrice || '',
                itemsDescription: o.items ? o.items.map(i => i.description || '').join(', ') : '',
                itemsQuantity: o.items ? o.items.map(i => i.quantity || '').join(', ') : '',
                parcelWeight: o.parcelWeight || '',
                noOfpackages: '1',
                handlingCharge: handlingCharge, // <-- only filled for pdu/ewe/mglobal
                attempt: o.attempt || '',
            };
        });

        searchJobsCache.set(cacheKey, formattedOrders);

        return res.json(formattedOrders);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server Error' });
    }
});

app.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const moment = require('moment');
        const now = moment();

        function generateLocation(order) {
            const { latestLocation, room, rackRowNum, area, jobMethod } = order;
            if (!latestLocation) return '-';
            let parts = [latestLocation];

            if (latestLocation === 'Warehouse K1') return parts.join(', ');

            if (latestLocation === 'Warehouse K2') {
                if (room === 'Room 1') {
                    if (room) parts.push(room);
                    if (rackRowNum) parts.push(`Row No.${rackRowNum}`);
                } else if (room === 'Medicine Room') {
                    if (room) parts.push(room);
                    if (jobMethod) parts.push(jobMethod);
                    if (rackRowNum) parts.push(`Row No.${rackRowNum}`);
                } else {
                    if (room) parts.push(room);
                    if (area) parts.push(area);
                    if (rackRowNum) parts.push(`Row No.${rackRowNum}`);
                }
            }
            return parts.join(', ');
        }

        const allOrders = await ORDERS.find(
            { currentStatus: { $nin: ["Completed", "Cancelled", "Disposed", "Out for Delivery", "Self Collect"] } },
            { product: 1, currentStatus: 1, warehouseEntry: 1, jobMethod: 1, warehouseEntryDateTime: 1, creationDate: 1, doTrackingNumber: 1, attempt: 1, latestReason: 1, area: 1, receiverName: 1, receiverPhoneNumber: 1, additionalPhoneNumber: 1, latestLocation: 1, remarks: 1, grRemark: 1, room: 1, rackRowNum: 1 }
        );

        const deliveryOrders = await ORDERS.find(
            { currentStatus: { $in: ["Out for Delivery", "Self Collect", "Drop Off"] } },
            { product: 1, jobDate: 1, assignedTo: 1, doTrackingNumber: 1, attempt: 1, receiverName: 1, receiverPhoneNumber: 1, grRemark: 1, area: 1, currentStatus: 1 }
        );

        const categorize = (orders, filterFn) => {
            const map = {};
            orders.forEach(order => {
                const { product, jobMethod, warehouseEntryDateTime, creationDate } = order;
                const method = jobMethod || 'Unknown';
                const refDate = warehouseEntryDateTime || creationDate;
                if (!refDate) return;
                const age = now.diff(moment(refDate), 'days');
                if (!filterFn(order, age)) return;
                if (!map[product]) map[product] = {};
                if (!map[product][method]) map[product][method] = [];
                map[product][method].push({
                    age,
                    doTrackingNumber: order.doTrackingNumber || '-',
                    attempt: order.attempt || '-',
                    latestReason: order.latestReason || '-',
                    area: order.area || '-',
                    receiverName: order.receiverName || '-',
                    receiverPhoneNumber: order.receiverPhoneNumber || '-',
                    additionalPhoneNumber: order.additionalPhoneNumber || '-',
                    latestLocation: order.latestLocation || '-',
                    remarks: order.remarks || '-',
                    grRemark: order.grRemark || '-',
                    location: generateLocation(order)
                });
            });
            for (const product in map) {
                for (const method in map[product]) {
                    map[product][method].sort((a, b) => b.age - a.age);
                }
            }
            return map;
        };

        const groupByCurrentLocation = (orders) => {
            const map = {};
            orders.forEach(order => {
                if (["At Warehouse", "Return to Warehouse"].includes(order.currentStatus)) {
                    const location = order.latestLocation || 'Unknown';
                    const product = order.product || 'Unknown';
                    const area = order.area || 'Unknown';

                    const refDate = order.warehouseEntryDateTime || order.creationDate;
                    const age = refDate ? now.diff(moment(refDate), 'days') : '-';

                    if (age === '-' || age >= 30) return;

                    if (!map[location]) map[location] = {};
                    if (!map[location][product]) map[location][product] = {};
                    if (!map[location][product][area]) map[location][product][area] = [];

                    map[location][product][area].push({
                        age,
                        doTrackingNumber: order.doTrackingNumber || '-',
                        attempt: order.attempt || '-',
                        latestReason: order.latestReason || '-',
                        area,
                        receiverName: order.receiverName || '-',
                        receiverPhoneNumber: order.receiverPhoneNumber || '-',
                        additionalPhoneNumber: order.additionalPhoneNumber || '-',
                        jobMethod: order.jobMethod || '-',
                        remarks: order.remarks || '-',
                        grRemark: order.grRemark || '-'
                    });
                }
            });

            for (const location in map) {
                for (const product in map[location]) {
                    for (const area in map[location][product]) {
                        map[location][product][area].sort((a, b) => b.age - a.age);
                    }
                }
            }

            return map;
        };

        const currentOrders = allOrders.filter(order =>
            ["At Warehouse", "Return to Warehouse"].includes(order.currentStatus) &&
            ["Warehouse K1", "Warehouse K2"].includes(order.latestLocation)
        );

        const currentMap = groupByCurrentLocation(currentOrders);

        const urgentMap = categorize(allOrders, (order, age) => {
            const { product, jobMethod, warehouseEntry, currentStatus } = order;
            const method = jobMethod || 'Unknown';
            if (["pharmacymoh", "pharmacyjpmc", "pharmacyphc"].includes(product)) {
                return warehouseEntry === "Yes" && ["At Warehouse", "Return to Warehouse"].includes(currentStatus) &&
                    ((method === "Standard" && age >= 3 && age <= 7) || (method === "Express" && age >= 1 && age <= 7));
            } else {
                return warehouseEntry === "Yes" && ["At Warehouse", "Return to Warehouse"].includes(currentStatus) && age >= 3 && age <= 14;
            }
        });

        const overdueMap = categorize(allOrders, (order, age) => {
            const { product } = order;
            if (["pharmacymoh", "pharmacyjpmc", "pharmacyphc"].includes(product)) return age > 7 && age < 30;
            return age > 14 && age < 30;
        });

        const archivedMap = categorize(allOrders, (order, age) => age >= 30);

        const maxAttemptMap = categorize(allOrders, (order, age) => order.attempt >= 3 && age < 30);

        const plannedSelfCollectMap = categorize(allOrders, (order, age) => {
            return ["At Warehouse", "Return to Warehouse"].includes(order.currentStatus) &&
                order.grRemark && order.grRemark.toLowerCase().includes("self collect") &&
                age <= 30;
        });

        // Group deliveries
        const deliveriesMap = (() => {
            const map = {};
            const assigneeAreas = {};

            deliveryOrders.forEach(order => {
                const date = order.jobDate ? moment(order.jobDate, 'YYYY-MM-DD').format("DD-MM-YYYY") : "Unknown Date";
                const assignee = order.assignedTo || "Unassigned";
                const product = order.product || "Unknown";
                const area = order.area || "Unknown";
                const currentStatus = order.currentStatus || "Unknown";

                if (!map[date]) map[date] = {};

                if (assignee === 'Selfcollect') {
                    // Handle Selfcollect differently
                    if (!map[date][assignee]) map[date][assignee] = { __statuses: {} };

                    if (!map[date][assignee].__statuses[currentStatus]) {
                        map[date][assignee].__statuses[currentStatus] = [];
                    }

                    map[date][assignee].__statuses[currentStatus].push({
                        doTrackingNumber: order.doTrackingNumber || '-',
                        receiverName: order.receiverName || '-',
                        receiverPhoneNumber: order.receiverPhoneNumber || '-',
                        grRemark: order.grRemark || '-'
                    });

                } else {
                    // Normal dispatchers grouped by area and product
                    if (!map[date][assignee]) map[date][assignee] = { __areas: new Set(), __products: {} };

                    map[date][assignee].__areas.add(area);

                    if (!map[date][assignee].__products[product]) {
                        map[date][assignee].__products[product] = [];
                    }

                    map[date][assignee].__products[product].push({
                        doTrackingNumber: order.doTrackingNumber || '-',
                        area: area,
                        receiverName: order.receiverName || '-',
                        receiverPhoneNumber: order.receiverPhoneNumber || '-',
                        grRemark: order.grRemark || '-'
                    });
                }
            });

            // Convert __areas Set to Array for frontend rendering
            Object.keys(map).forEach(date => {
                Object.keys(map[date]).forEach(assignee => {
                    if (assignee !== 'Selfcollect') {
                        map[date][assignee].__areas = Array.from(map[date][assignee].__areas);
                    }
                });

                // Ensure Selfcollect always placed last by ordering keys manually
                const ordered = {};
                Object.keys(map[date]).sort((a, b) => {
                    if (a === 'Selfcollect') return 1; // Move Selfcollect to bottom
                    if (b === 'Selfcollect') return -1;
                    return a.localeCompare(b);
                }).forEach(key => {
                    ordered[key] = map[date][key];
                });

                map[date] = ordered;
            });

            return map;
        })();

        res.render('dashboard', {
            currentMap,
            urgentMap,
            overdueMap,
            archivedMap,
            maxAttemptMap,
            deliveriesMap,
            plannedSelfCollectMap,
            moment,
            user: req.user,
            orders: []
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

// Optional: refresh route to clear urgent cache
app.get('/refresh-urgent', ensureAuthenticated, (req, res) => {
    urgentCache.del('urgentMap');
    res.redirect('/');
});

app.get('/login', ensureNotAuthenticated, (req, res) => {
    res.render('login', {
        errors: req.flash('error'),
        user: null
    });
});

app.post('/login', ensureNotAuthenticated, (req, res, next) => {
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureFlash: true
    })(req, res, next);
});

// Logout route
app.get('/logout', ensureAuthenticated, (req, res) => {
    req.logout((err) => { // Logout the user
        if (err) {
            console.error('Error logging out:', err);
            res.status(500).send('Internal Server Error');
        } else {
            req.session.destroy((err) => { // Destroy the session
                if (err) {
                    console.error('Error destroying session:', err);
                    res.status(500).send('Internal Server Error');
                } else {
                    res.redirect('/login'); // Redirect to login page after logout
                }
            });
        }
    });
});

// Restricting routes to "admin" role
app.get('/createUser', ensureAuthenticated, ensureAdmin, (req, res) => {
    res.render('createUser', { user: req.user });
});

app.post('/createUser', ensureAuthenticated, ensureAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;
    let errors = [];

    if (!name || !email || !password || !role) {
        errors.push({ msg: 'Please enter all fields' });
    }

    if (password.length < 6) {
        errors.push({ msg: 'Password must be at least 6 characters' });
    }

    if (errors.length > 0) {
        res.render('createUser', { errors, name, email, password, role });
    } else {
        try {
            let user = await USERS.findOne({ email: email });

            if (user) {
                errors.push({ msg: 'Email already exists' });
                res.render('createUser', { errors, name, email, password, role });
            } else {
                const newUser = new USERS({ name, email, password, role });

                bcrypt.genSalt(10, (err, salt) => {
                    bcrypt.hash(newUser.password, salt, (err, hash) => {
                        if (err) throw err;
                        newUser.password = hash;
                        newUser.save()
                            .then(user => {
                                req.flash('success_msg', 'You have now registered!');
                                res.redirect('/');
                            })
                            .catch(err => console.log(err));
                    });
                });
            }
        } catch (err) {
            console.error(err);
            res.status(500).send('Server error');
        }
    }
});

app.get('/mohsearch', ensureAuthenticated, ensureSearchMOHJob, (req, res) => {
    res.render('mohsearch', { moment: moment, user: req.user, orders: [], searchQuery: {} });
});

app.post('/mohsearch', ensureAuthenticated, ensureSearchMOHJob, async (req, res) => {
    try {
        const { patientNumber, icPassNum } = req.body;

        let query = { product: "pharmacymoh" };

        if (patientNumber) {
            query.patientNumber = new RegExp(patientNumber, 'i'); // Case-insensitive partial match
        }

        if (icPassNum) {
            query.icPassNum = new RegExp(icPassNum, 'i'); // Case-insensitive partial match
        }

        const orders = await ORDERS.find(query)
            .select([
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'area',
                'patientNumber',
                'icPassNum',
                'appointmentPlace',
                'receiverPhoneNumber',
                'additionalPhoneNumber',
                'deliveryTypeCode',
                'remarks',
                'dateTimeSubmission',
                'currentStatus',
                'latestReason',
                'lastUpdateDateTime',
                'lastUpdatedBy',
                'jobType',
                'jobMethod'
            ])
            .sort({ _id: -1 })
            .limit(1000);

        res.render('mohsearch', { moment: moment, user: req.user, orders, searchQuery: req.body });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

// Render the scanFMX page
app.get('/updateDelivery', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    processingResults.length = 0;
    res.render('updateDelivery', { user: req.user });
});

app.get('/podGenerator', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    // Render the form page with EJS
    res.render('podGenerator', { user: req.user });
});

app.get('/addressAreaCheck', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    res.render('addressAreaCheck', { user: req.user });
});

app.get('/successUpdate', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    res.render('successUpdate', { processingResults, user: req.user });
});

app.get('/listofWargaEmasOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const waorders = await WAORDERS.find({})
            .select([
                '_id',
                'icPictureFront',
                'icPictureBack',
                'dateTimeSubmission',
                'receiverPhoneNumber'
            ])
            .sort({ _id: -1 })
            .limit(3000);

        const totalRecords = waorders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofWargaEmasOrders', { waorders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyMOHOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "pharmacymoh"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'area',
                'patientNumber',
                'icPassNum',
                'appointmentPlace',
                'receiverPhoneNumber',
                'additionalPhoneNumber',
                'deliveryTypeCode',
                'remarks',
                'paymentMethod',
                'dateTimeSubmission',
                'membership',
                'pharmacyFormCreated',
                'sendOrderTo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'paymentAmount',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ _id: -1 })
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyMOHEXPOrders', ensureAuthenticated, ensureViewMOHJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "pharmacymoh" and "deliveryTypeCode" value "EXP"
        const orders = await ORDERS.find({ product: "pharmacymoh", deliveryTypeCode: "EXP" })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'area',
                'patientNumber',
                'icPassNum',
                'appointmentPlace',
                'receiverPhoneNumber',
                'additionalPhoneNumber',
                'deliveryTypeCode',
                'remarks',
                'paymentMethod',
                'dateTimeSubmission',
                'membership',
                'pharmacyFormCreated',
                'sendOrderTo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'paymentAmount',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ _id: -1 })
            .limit(1000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHEXPOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyMOHSTDOrders', ensureAuthenticated, ensureViewMOHJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "pharmacymoh" and "deliveryTypeCode" value "EXP"
        const orders = await ORDERS.find({ product: "pharmacymoh", deliveryTypeCode: "STD", sendOrderTo: "OPD" })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'area',
                'patientNumber',
                'icPassNum',
                'appointmentPlace',
                'receiverPhoneNumber',
                'additionalPhoneNumber',
                'deliveryTypeCode',
                'remarks',
                'paymentMethod',
                'dateTimeSubmission',
                'membership',
                'pharmacyFormCreated',
                'sendOrderTo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'paymentAmount',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ _id: -1 })
            .limit(1000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHSTDOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.post('/createPharmacyFormSuccess', ensureAuthenticated, ensureMOHForm, async (req, res) => {
    try {
        // Extract data from the form submission
        const { dateOfForm, batchChoice, b2Start, mohForm } = req.body;

        let sendOrderToQuery;
        let deliveryTypeCodeQuery;

        switch (mohForm) {
            case 'STD':
                sendOrderToQuery = 'OPD';
                deliveryTypeCodeQuery = 'STD';
                break;
            case 'EXP':
                sendOrderToQuery = 'OPD';
                deliveryTypeCodeQuery = 'EXP';
                break;
            case 'IMM':
                sendOrderToQuery = 'OPD';
                deliveryTypeCodeQuery = 'IMM';
                break;
            case 'TTG':
                sendOrderToQuery = 'PMMH';
                deliveryTypeCodeQuery = 'STD';
                break;
            case 'KB':
                sendOrderToQuery = 'SSBH';
                deliveryTypeCodeQuery = 'STD';
                break;
            default:
                sendOrderToQuery = null;
                deliveryTypeCodeQuery = null;
                break;
        }

        // Query the database to find orders with pharmacyFormCreated set to "No" and matching sendOrderTo and deliveryTypeCode
        const orders = await ORDERS.find({ pharmacyFormCreated: "No", sendOrderTo: sendOrderToQuery, deliveryTypeCode: deliveryTypeCodeQuery })
            .select([
                '_id',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'area',
                'patientNumber',
                'icPassNum',
                'appointmentPlace',
                'receiverPhoneNumber',
                'additionalPhoneNumber',
                'deliveryTypeCode',
                'remarks',
            ])
            .sort({ _id: -1 });

        // Render the "createPharmacyFormMOHSTDsuccess" page with the filtered data
        res.render('createPharmacyFormSuccess', {
            orders,
            dateOfForm: moment(dateOfForm).format('DD.MM.YY'),
            batchChoice,
            b2Start,
            mohForm: mohForm,
            user: req.user
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to create Pharmacy Form');
    }
});

app.get('/listofpharmacyMOHTTGOrders', ensureAuthenticated, ensureViewMOHJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "pharmacymoh" and "deliveryTypeCode" value "EXP"
        const orders = await ORDERS.find({ product: "pharmacymoh", deliveryTypeCode: "STD", sendOrderTo: "PMMH" })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'area',
                'patientNumber',
                'icPassNum',
                'appointmentPlace',
                'receiverPhoneNumber',
                'additionalPhoneNumber',
                'deliveryTypeCode',
                'remarks',
                'paymentMethod',
                'dateTimeSubmission',
                'membership',
                'pharmacyFormCreated',
                'sendOrderTo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'paymentAmount',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ _id: -1 });

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHTTGOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyMOHKBOrders', ensureAuthenticated, ensureViewMOHJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "pharmacymoh" and "deliveryTypeCode" value "EXP"
        const orders = await ORDERS.find({ product: "pharmacymoh", deliveryTypeCode: "STD", sendOrderTo: "SSBH" })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'area',
                'patientNumber',
                'icPassNum',
                'appointmentPlace',
                'receiverPhoneNumber',
                'additionalPhoneNumber',
                'deliveryTypeCode',
                'remarks',
                'paymentMethod',
                'dateTimeSubmission',
                'membership',
                'pharmacyFormCreated',
                'sendOrderTo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'paymentAmount',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ _id: -1 });

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHKBOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyMOHIMMOrders', ensureAuthenticated, ensureViewMOHJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "pharmacymoh" and "deliveryTypeCode" value "EXP"
        const orders = await ORDERS.find({ product: "pharmacymoh", deliveryTypeCode: "IMM" })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'area',
                'patientNumber',
                'icPassNum',
                'appointmentPlace',
                'receiverPhoneNumber',
                'additionalPhoneNumber',
                'deliveryTypeCode',
                'remarks',
                'paymentMethod',
                'dateTimeSubmission',
                'membership',
                'pharmacyFormCreated',
                'sendOrderTo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'paymentAmount',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ _id: -1 });

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHIMMOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyMOHForms', ensureAuthenticated, ensureMOHForm, async (req, res) => {
    try {
        // Use the new query syntax to find documents with selected fields
        const forms = await PharmacyFORM.find({})
            .select([
                '_id',
                'formName',
                'formDate',
                'batchNo',
                'startNo',
                'endNo',
                'creationDate',
                'mohForm',
                'numberOfForms',
                'formCreator'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the pods containing the selected fields
        res.render('listofpharmacyMOHForms', { forms, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch Pharmacy Form data');
    }
});

// Add a new route in your Express application
app.get('/formpharmacyDetail/:formId', ensureAuthenticated, ensureMOHForm, async (req, res) => {
    try {
        const form = await PharmacyFORM.findById(req.params.formId);

        if (!form) {
            return res.status(404).send('Form not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('formpharmacyDetail', { htmlContent: form.htmlContent, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch form data');
    }
});

// Route to render the edit page for a specific POD
app.get('/editPharmacyForm/:id', ensureAuthenticated, ensureMOHForm, (req, res) => {
    const formId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    PharmacyFORM.findById(formId)
        .then((form) => {
            if (!form) {
                return res.status(404).send('Form not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editPharmacyForm.ejs', { form, user: req.user });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to update the HTML content of a specific POD
app.post('/updatePharmacyForm/:id', ensureAuthenticated, ensureMOHForm, (req, res) => {
    const formId = req.params.id;
    const newHtmlContent = req.body.htmlContent;

    // Find the specific POD by ID
    PharmacyFORM.findByIdAndUpdate(formId, { htmlContent: newHtmlContent })
        .then((form) => {
            if (!form) {
                return res.status(404).send('Form not found');
            }

            // Successfully updated the HTML content
            res.status(200).send('Form data updated successfully');
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to update Form data');
        });
});

app.get('/deletePharmacyForm/:formId', ensureAuthenticated, ensureMOHForm, async (req, res) => {
    try {
        const formId = req.params.formId;

        // Use Mongoose to find and remove the document with the given ID
        const deletedForm = await PharmacyFORM.findByIdAndRemove(formId);

        if (deletedForm) {
            res.redirect('/listofpharmacyMOHForms'); // Redirect to the list view after deletion
        } else {
            res.status(404).send('Pharmacy Form not found');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to delete Pharmacy Form');
    }
});

app.get('/listofpharmacyPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const searchValue = req.query.search?.value?.trim();

        let query = {};

        if (searchValue) {
            // Use regex to search for tracking number inside htmlContent
            query = { htmlContent: new RegExp(searchValue, 'i') };
        }

        const pods = await PharmacyPOD.find(query)
            .select([
                '_id',
                'podName',
                'podDate',
                'podCreator',
                'deliveryDate',
                'area',
                'dispatcher',
                'creationDate',
                'rowCount'
            ])
            .sort({ _id: -1 });

        res.render('listofpharmacyPod', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch Pharmacy POD data');
    }
});

app.get('/api/listofpharmacyPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const draw = parseInt(req.query.draw) || 0;
        const start = parseInt(req.query.start) || 0;
        const length = parseInt(req.query.length) || 10;
        const searchValue = req.query.search?.value?.trim();
        const order = req.query.order?.[0];
        const columns = req.query.columns;

        // Build base query
        let query = {};

        if (searchValue) {
            const searchRegex = new RegExp(searchValue, 'i');
            query['$or'] = [
                { podName: searchRegex },
                { dispatcher: searchRegex },
                { area: searchRegex },
                { deliveryDate: searchRegex },
                { podCreator: searchRegex },
                { podDate: searchRegex },
                { htmlContent: searchRegex } // search inside htmlContent too
            ];
        }

        // Determine sorting
        let sort = {};
        if (order && columns) {
            const columnIndex = order.column;
            const sortColumn = columns[columnIndex].data;
            const sortDir = order.dir === 'desc' ? -1 : 1;
            sort[sortColumn] = sortDir;
        } else {
            sort = { _id: -1 }; // Default: latest first
        }

        // Query total counts
        const totalRecords = await PharmacyPOD.countDocuments({});
        const filteredRecords = await PharmacyPOD.countDocuments(query);

        const pods = await PharmacyPOD.find(query)
            .select([
                '_id',
                'podName',
                'podDate',
                'podCreator',
                'deliveryDate',
                'area',
                'dispatcher',
                'creationDate',
                'rowCount'
            ])
            .sort(sort)
            .skip(start)
            .limit(length);

        res.json({
            draw,
            recordsTotal: totalRecords,
            recordsFiltered: filteredRecords,
            data: pods
        });

    } catch (err) {
        console.error("Error in server-side POD list:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/listofldPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        // Use the new query syntax to find documents with selected fields
        const pods = await LDPOD.find({})
            .select([
                '_id',
                'podName',
                'podDate',
                'podCreator',
                'deliveryDate',
                'area',
                'dispatcher',
                'creationDate',
                'rowCount'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the pods containing the selected fields
        res.render('listofldPod', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch Local Delivery POD data');
    }
});

app.get('/api/listofldPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const draw = parseInt(req.query.draw) || 0;
        const start = parseInt(req.query.start) || 0;
        const length = parseInt(req.query.length) || 10;
        const searchValue = req.query.search?.value?.trim();
        const order = req.query.order?.[0];
        const columns = req.query.columns;

        let query = {};

        if (searchValue) {
            const regex = new RegExp(searchValue, 'i');
            query['$or'] = [
                { podName: regex },
                { dispatcher: regex },
                { area: regex },
                { deliveryDate: regex },
                { podCreator: regex },
                { podDate: regex },
                { htmlContent: regex } // for tracking number search
            ];
        }

        let sort = {};
        if (order && columns) {
            const colName = columns[order.column].data;
            const dir = order.dir === 'desc' ? -1 : 1;
            sort[colName] = dir;
        } else {
            sort = { _id: -1 };
        }

        const total = await LDPOD.countDocuments({});
        const filtered = await LDPOD.countDocuments(query);

        const pods = await LDPOD.find(query)
            .select([
                '_id',
                'podName',
                'podDate',
                'podCreator',
                'deliveryDate',
                'area',
                'dispatcher',
                'creationDate',
                'rowCount'
            ])
            .sort(sort)
            .skip(start)
            .limit(length);

        res.json({
            draw,
            recordsTotal: total,
            recordsFiltered: filtered,
            data: pods
        });

    } catch (error) {
        console.error("Error loading LD PODs:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/listofnoncodPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        // Use the new query syntax to find documents with selected fields
        const pods = await NONCODPOD.find({})
            .select([
                '_id',
                'podName',
                'podDate',
                'podCreator',
                'deliveryDate',
                'area',
                'dispatcher',
                'creationDate',
                'rowCount',
                'product'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the pods containing the selected fields
        res.render('listofnoncodPod', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch EWE/PDU/MGLOBAL POD data');
    }
});

app.get('/api/listofnoncodPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const draw = parseInt(req.query.draw) || 0;
        const start = parseInt(req.query.start) || 0;
        const length = parseInt(req.query.length) || 10;
        const searchValue = req.query.search?.value?.trim();
        const order = req.query.order?.[0];
        const columns = req.query.columns;

        let query = {};

        if (searchValue) {
            const regex = new RegExp(searchValue, 'i');
            query['$or'] = [
                { podName: regex },
                { product: regex },
                { dispatcher: regex },
                { area: regex },
                { deliveryDate: regex },
                { podCreator: regex },
                { podDate: regex },
                { htmlContent: regex }  // track by tracking number inside htmlContent
            ];
        }

        let sort = {};
        if (order && columns) {
            const colName = columns[order.column].data;
            const dir = order.dir === 'desc' ? -1 : 1;
            sort[colName] = dir;
        } else {
            sort = { _id: -1 };
        }

        const total = await NONCODPOD.countDocuments({});
        const filtered = await NONCODPOD.countDocuments(query);

        const pods = await NONCODPOD.find(query)
            .select([
                '_id',
                'podName',
                'podDate',
                'podCreator',
                'deliveryDate',
                'area',
                'dispatcher',
                'creationDate',
                'rowCount',
                'product'
            ])
            .sort(sort)
            .skip(start)
            .limit(length);

        res.json({
            draw,
            recordsTotal: total,
            recordsFiltered: filtered,
            data: pods
        });

    } catch (error) {
        console.error("Error loading NONCOD PODs:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/listofcbslPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        // Use the new query syntax to find documents with selected fields
        const pods = await CBSLPOD.find({})
            .select([
                '_id',
                'podName',
                'podDate',
                'podCreator',
                'deliveryDate',
                'area',
                'dispatcher',
                'creationDate',
                'rowCount'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the pods containing the selected fields
        res.render('listofcbslPod', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch FMX POD data');
    }
});

app.get('/api/listofcbslPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const draw = parseInt(req.query.draw) || 0;
        const start = parseInt(req.query.start) || 0;
        const length = parseInt(req.query.length) || 10;
        const searchValue = req.query.search?.value?.trim();
        const order = req.query.order?.[0];
        const columns = req.query.columns;

        let query = {};

        if (searchValue) {
            const regex = new RegExp(searchValue, 'i');
            query['$or'] = [
                { podName: regex },
                { dispatcher: regex },
                { area: regex },
                { deliveryDate: regex },
                { podCreator: regex },
                { podDate: regex },
                { htmlContent: regex } // for tracking number search
            ];
        }

        let sort = {};
        if (order && columns) {
            const colName = columns[order.column].data;
            const dir = order.dir === 'desc' ? -1 : 1;
            sort[colName] = dir;
        } else {
            sort = { _id: -1 };
        }

        const total = await CBSLPOD.countDocuments({});
        const filtered = await CBSLPOD.countDocuments(query);

        const pods = await CBSLPOD.find(query)
            .select([
                '_id',
                'podName',
                'podDate',
                'podCreator',
                'deliveryDate',
                'area',
                'dispatcher',
                'creationDate',
                'rowCount'
            ])
            .sort(sort)
            .skip(start)
            .limit(length);

        res.json({
            draw,
            recordsTotal: total,
            recordsFiltered: filtered,
            data: pods
        });

    } catch (error) {
        console.error("Error loading CBSL PODs:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add a new route in your Express application
app.get('/podpharmacyDetail/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const pod = await PharmacyPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podpharmacyDetail', { htmlContent: pod.htmlContent, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Add a new route in your Express application
app.get('/podldDetail/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const pod = await LDPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podldDetail', { htmlContent: pod.htmlContent, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Add a new route in your Express application
app.get('/podnoncodDetail/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const pod = await NONCODPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podnoncodDetail', { htmlContent: pod.htmlContent, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Add a new route in your Express application
app.get('/podcbslDetail/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const pod = await CBSLPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podcbslDetail', { htmlContent: pod.htmlContent, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Route to render the edit page for a specific POD
app.get('/editPharmacyPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    PharmacyPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editPharmacyPod.ejs', { pod, user: req.user });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to update the HTML content of a specific POD
app.post('/updatePharmacyPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;
    const newHtmlContent = req.body.htmlContent;

    // Find the specific POD by ID
    PharmacyPOD.findByIdAndUpdate(podId, { htmlContent: newHtmlContent })
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Successfully updated the HTML content
            res.status(200).send('POD data updated successfully');
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to update POD data');
        });
});

// Route to render the edit page for a specific POD
app.get('/editLdPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    LDPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editLdPod.ejs', { pod, user: req.user });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to update the HTML content of a specific POD
app.post('/updateLdPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;
    const newHtmlContent = req.body.htmlContent;

    // Find the specific POD by ID
    LDPOD.findByIdAndUpdate(podId, { htmlContent: newHtmlContent })
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Successfully updated the HTML content
            res.status(200).send('POD data updated successfully');
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to update POD data');
        });
});

// Route to render the edit page for a specific POD
app.get('/editNoncodPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    NONCODPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editNoncodPod.ejs', { pod, user: req.user });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to render the edit page for a specific POD
app.get('/editCbslPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    CBSLPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editCbslPod.ejs', { pod, user: req.user });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to update the HTML content of a specific POD
app.post('/updateNoncodPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;
    const newHtmlContent = req.body.htmlContent;

    // Find the specific POD by ID
    NONCODPOD.findByIdAndUpdate(podId, { htmlContent: newHtmlContent })
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Successfully updated the HTML content
            res.status(200).send('POD data updated successfully');
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to update POD data');
        });
});

// Route to update the HTML content of a specific POD
app.post('/updateCbslPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;
    const newHtmlContent = req.body.htmlContent;

    // Find the specific POD by ID
    CBSLPOD.findByIdAndUpdate(podId, { htmlContent: newHtmlContent })
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Successfully updated the HTML content
            res.status(200).send('POD data updated successfully');
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to update POD data');
        });
});

app.get('/deletePharmacyPod/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const podId = req.params.podId;

        // Use Mongoose to find and remove the document with the given ID
        const deletedPod = await PharmacyPOD.findByIdAndRemove(podId);

        if (deletedPod) {
            res.redirect('/listofpharmacyPOD'); // Redirect to the list view after deletion
        } else {
            res.status(404).send('Pharmacy POD not found');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to delete Pharmacy POD');
    }
});

app.get('/deleteLDPod/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const podId = req.params.podId;

        // Use Mongoose to find and remove the document with the given ID
        const deletedPod = await LDPOD.findByIdAndRemove(podId);

        if (deletedPod) {
            res.redirect('/listofldPod'); // Redirect to the list view after deletion
        } else {
            res.status(404).send('Local Delivery POD not found');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to delete Local Delivery POD');
    }
});

app.get('/deleteNONCODPod/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const podId = req.params.podId;

        // Use Mongoose to find and remove the document with the given ID
        const deletedPod = await NONCODPOD.findByIdAndRemove(podId);

        if (deletedPod) {
            res.redirect('/listofNoncodPod'); // Redirect to the list view after deletion
        } else {
            res.status(404).send('EWE/PDU/MGLOBAL POD not found');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to delete EWE/PDU/MGLOBAL POD');
    }
});

app.get('/deleteCBSLPod/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const podId = req.params.podId;

        // Use Mongoose to find and remove the document with the given ID
        const deletedPod = await CBSLPOD.findByIdAndRemove(podId);

        if (deletedPod) {
            res.redirect('/listofcbslPod'); // Redirect to the list view after deletion
        } else {
            res.status(404).send('FMX POD not found');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to delete FMX POD');
    }
});
// ...

// Add this route to handle the saving of the PharmacyFORM and updating ORDERS collection
app.post('/save-form', ensureAuthenticated, ensureMOHForm, (req, res) => {
    const { formName, formDate, batchNo, startNo, endNo, htmlContent, mohForm, numberOfForms } = req.body;

    const userNameCaps = req.user.name.toUpperCase()

    // Create a new document and save it to the MongoDB collection
    const newForm = new PharmacyFORM({
        formName: formName,
        formDate: formDate,
        batchNo: batchNo,
        startNo: startNo,
        endNo: endNo,
        htmlContent: htmlContent,
        creationDate: moment().format(),
        mohForm: mohForm,
        numberOfForms: numberOfForms,
        formCreator: userNameCaps,
    });

    newForm.save()
        .then(() => {
            // Use the trackingNumbers array here
            const trackingNumbers = req.body.trackingNumbers;

            // Update the ORDERS collection for each tracking number
            updateOrdersCollection(trackingNumbers)
                .then(() => {
                    res.status(200).send('Form data saved successfully');
                })
                .catch((err) => {
                    console.error('Error:', err);
                    res.status(500).send('Failed to save Form data');
                });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to save Form data');
        });
});

function updateOrdersCollection(trackingNumbers) {
    // Implement the logic to update the ORDERS collection for each tracking number
    // You can use Mongoose or your MongoDB driver to update the documents.
    // Iterate through the trackingNumbers array and update the matching documents.
    // Here's a simplified example using Mongoose:

    const promises = trackingNumbers.map((trackingNumber) => {
        return ORDERS.updateOne({ doTrackingNumber: trackingNumber }, { $set: { pharmacyFormCreated: 'Yes' } });
    });

    // Return a Promise that resolves when all updates are complete.
    return Promise.all(promises);
}

// Route to save POD data
app.post('/save-pod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const { podName, product, podDate, podCreator, deliveryDate, area, dispatcher, htmlContent, rowCount } = req.body;

    // Choose the appropriate model based on the collection
    let PodModel;
    switch (product) {
        case 'Pharmacy POD':
            PodModel = PharmacyPOD;
            break;
        case 'LD POD':
            PodModel = LDPOD;
            break;
        case 'CBSL POD':
            PodModel = CBSLPOD;
            break;
        case 'NONCOD POD':
            PodModel = NONCODPOD;
            break;
        default:
            return res.status(400).send('Invalid collection');
    }

    // Create a new document and save it to the MongoDB collection
    const newPod = new PodModel({
        podName: podName,
        product: product,
        podDate: podDate,
        podCreator: podCreator,
        deliveryDate: deliveryDate,
        area: area,
        dispatcher: dispatcher,
        rowCount: rowCount, // Add the rowCount here
        htmlContent: htmlContent,
        creationDate: moment().format()
    });

    newPod.save()
        .then(() => {
            res.status(200).send('POD data saved successfully');
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to save POD data');
        });
});

app.post('/generatePOD', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const { product, deliveryDate, areas, dispatchers, trackingNumbers, freelancerName } = req.body;

        let finalDispatcherName = (dispatchers.startsWith("FL"))
            ? `${dispatchers.toUpperCase()} ${freelancerName.toUpperCase()}`
            : dispatchers.toUpperCase();

        const userNameCaps = req.user.name.toUpperCase();

        let areasArray = [];
        if (typeof areas === 'string') {
            areasArray = areas.split(',').map((area) => area.trim());
        } else if (Array.isArray(areas)) {
            areasArray = areas.map((area) => area.trim());
        }

        const areasJoined = areasArray.join(', ');

        const trackingNumbersArray = trackingNumbers
            .trim()
            .split('\n')
            .map((id) => id.trim().toUpperCase());

        const uniqueTrackingNumbers = [...new Set(trackingNumbersArray)];

        const runSheetData = [];

        for (const trackingNumber of uniqueTrackingNumbers) {
            try {
                /* if (product === "MOH/JPMC/PHC Pharmacy") {
                    // Fetch from MongoDB
                    const order = await ORDERS.findOne({ doTrackingNumber: trackingNumber });

                    if (!order) {
                        console.warn(`Tracking number not found in DB: ${trackingNumber}`);
                        continue;
                    }

                    runSheetData.push({
                        trackingNumber,
                        deliverToCollectFrom: order.receiverName,
                        address: order.receiverAddress,
                        phoneNumber: order.receiverPhoneNumber,
                        jobType: order.jobType || '',
                        totalPrice: order.totalPrice || '',
                        paymentMode: order.paymentMethod || '',
                        remarks: order.remarks || '',
                    });

                } else { */
                // Fetch from Detrack API
                const apiKey = process.env.API_KEY;
                const response = await axios.get(
                    `https://app.detrack.com/api/v2/dn/jobs/show/?do_number=${trackingNumber}`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-KEY': apiKey,
                        },
                    }
                );

                const data = response.data.data;

                if (!data) {
                    console.warn(`No data returned from Detrack for: ${trackingNumber}`);
                    continue;
                }

                runSheetData.push({
                    trackingNumber,
                    deliverToCollectFrom: data.deliver_to_collect_from,
                    address: data.address,
                    phoneNumber: data.phone_number,
                    jobType: data.job_type || '',
                    totalPrice: data.total_price || '',
                    paymentMode: data.payment_mode || '',
                    remarks: data.remarks || '',
                });
                /* } */
            } catch (err) {
                console.error(`Error for tracking number ${trackingNumber}:`, err);
                // Continue with next tracking number
            }
        }

        res.render('podGeneratorSuccess', {
            podCreatedBy: userNameCaps,
            product,
            deliveryDate: moment(deliveryDate).format('DD.MM.YY'),
            areas: areasJoined,
            dispatchers: finalDispatcherName,
            trackingNumbers: runSheetData,
            podCreatedDate: moment().format('DD.MM.YY'),
            user: req.user
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/addressAreaCheck', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const customerAddresses = req.body.customerAddresses.split('\n');
    const result = [];

    for (const customerAddress of customerAddresses) {
        let area, kampong, address;

        address = customerAddress.trim(); // Initialize customerAddress

        address = address.toUpperCase();

        if (address.includes("MANGGIS") == true) { area = "B", kampong = "MANGGIS" }
        else if (address.includes("DELIMA") == true) { area = "B", kampong = "DELIMA" }
        else if (address.includes("ANGGREK DESA") == true) { area = "B", kampong = "ANGGREK DESA" }
        else if (address.includes("ANGGREK") == true) { area = "B", kampong = "ANGGREK DESA" }
        else if (address.includes("PULAIE") == true) { area = "B", kampong = "PULAIE" }
        else if (address.includes("LAMBAK") == true) { area = "B", kampong = "LAMBAK" }
        else if (address.includes("TERUNJING") == true) { area = "B", kampong = "TERUNJING" }
        else if (address.includes("MADANG") == true) { area = "B", kampong = "MADANG" }
        else if (address.includes("AIRPORT") == true) { area = "B", kampong = "AIRPORT" }
        else if (address.includes("ORANG KAYA BESAR IMAS") == true) { area = "B", kampong = "OKBI" }
        else if (address.includes("OKBI") == true) { area = "B", kampong = "OKBI" }
        else if (address.includes("SERUSOP") == true) { area = "B", kampong = "SERUSOP" }
        else if (address.includes("BURONG PINGAI") == true) { area = "B", kampong = "BURONG PINGAI" }
        else if (address.includes("SETIA NEGARA") == true) { area = "B", kampong = "SETIA NEGARA" }
        else if (address.includes("PASIR BERAKAS") == true) { area = "B", kampong = "PASIR BERAKAS" }
        else if (address.includes("MENTERI BESAR") == true) { area = "B", kampong = "MENTERI BESAR" }
        else if (address.includes("KEBANGSAAN LAMA") == true) { area = "B", kampong = "KEBANGSAAN LAMA" }
        else if (address.includes("BATU MARANG") == true) { area = "B", kampong = "BATU MARANG" }
        else if (address.includes("DATO GANDI") == true) { area = "B", kampong = "DATO GANDI" }
        else if (address.includes("KAPOK") == true) { area = "B", kampong = "KAPOK" }
        else if (address.includes("KOTA BATU") == true) { area = "B", kampong = "KOTA BATU" }
        else if (address.includes("MENTIRI") == true) { area = "B", kampong = "MENTIRI" }
        else if (address.includes("MERAGANG") == true) { area = "B", kampong = "MERAGANG" }
        else if (address.includes("PELAMBAIAN") == true) { area = "B", kampong = "PELAMBAIAN" }
        else if (address.includes("PINTU MALIM") == true) { area = "B", kampong = "PINTU MALIM" }
        else if (address.includes("SALAMBIGAR") == true) { area = "B", kampong = "SALAMBIGAR" }
        else if (address.includes("SALAR") == true) { area = "B", kampong = "SALAR" }
        else if (address.includes("SERASA") == true) { area = "B", kampong = "SERASA" }
        else if (address.includes("SERDANG") == true) { area = "B", kampong = "SERDANG" }
        else if (address.includes("SUNGAI BASAR") == true) { area = "B", kampong = "SUNGAI BASAR" }
        else if (address.includes("SG BASAR") == true) { area = "B", kampong = "SUNGAI BASAR" }
        else if (address.includes("SUNGAI BELUKUT") == true) { area = "B", kampong = "SUNGAI BELUKUT" }
        else if (address.includes("SG BELUKUT") == true) { area = "B", kampong = "SUNGAI BELUKUT" }
        else if (address.includes("SUNGAI HANCHING") == true) { area = "B", kampong = "SUNGAI HANCHING" }
        else if (address.includes("SG HANCHING") == true) { area = "B", kampong = "SUNGAI HANCHING" }
        else if (address.includes("SUNGAI TILONG") == true) { area = "B", kampong = "SUNGAI TILONG" }
        else if (address.includes("SG TILONG") == true) { area = "B", kampong = "SUNGAI TILONG" }
        else if (address.includes("SUBOK") == true) { area = "B", kampong = "SUBOK" }
        else if (address.includes("SUNGAI AKAR") == true) { area = "B", kampong = "SUNGAI AKAR" }
        else if (address.includes("SG AKAR") == true) { area = "B", kampong = "SUNGAI AKAR" }
        else if (address.includes("SUNGAI BULOH") == true) { area = "B", kampong = "SUNGAI BULOH" }
        else if (address.includes("SG BULOH") == true) { area = "B", kampong = "SUNGAI BULOH" }
        else if (address.includes("TANAH JAMBU") == true) { area = "B", kampong = "TANAH JAMBU" }
        else if (address.includes("SUNGAI OROK") == true) { area = "B", kampong = "SUNGAI OROK" }
        else if (address.includes("SG OROK") == true) { area = "B", kampong = "SUNGAI OROK" }
        else if (address.includes("KATOK") == true) { area = "G", kampong = "KATOK" }
        else if (address.includes("MATA-MATA") == true) { area = "G", kampong = "MATA-MATA" }
        else if (address.includes("MATA MATA") == true) { area = "G", kampong = "MATA-MATA" }
        else if (address.includes("RIMBA") == true) { area = "G", kampong = "RIMBA" }
        else if (address.includes("TUNGKU") == true) { area = "G", kampong = "TUNGKU" }
        else if (address.includes("UBD") == true) { area = "G", kampong = "UBD" }
        else if (address.includes("UNIVERSITI BRUNEI DARUSSALAM") == true) { area = "G", kampong = "UBD" }
        else if (address.includes("JIS") == true) { area = "G" }
        else if (address.includes("JERUDONG INTERNATIONAL SCHOOL") == true) { area = "G", kampong = "JIS" }
        else if (address.includes("BERANGAN") == true) { area = "G", kampong = "BERANGAN" }
        else if (address.includes("BERIBI") == true) { area = "G", kampong = "BERIBI" }
        else if (address.includes("KIULAP") == true) { area = "G", kampong = "KIULAP" }
        else if (address.includes("RIPAS") == true) { area = "G", kampong = "RIPAS" }
        else if (address.includes("RAJA ISTERI PENGIRAN ANAK SALLEHA") == true) { area = "G", kampong = "RIPAS" }
        else if (address.includes("KIARONG") == true) { area = "G", kampong = "KIARONG" }
        else if (address.includes("PUSAR ULAK") == true) { area = "G", kampong = "PUSAR ULAK" }
        else if (address.includes("KUMBANG PASANG") == true) { area = "G", kampong = "KUMBANG PASANG" }
        else if (address.includes("MENGLAIT") == true) { area = "G", kampong = "MENGLAIT" }
        else if (address.includes("MABOHAI") == true) { area = "G", kampong = "MABOHAI" }
        else if (address.includes("ONG SUM PING") == true) { area = "G", kampong = "ONG SUM PING" }
        else if (address.includes("GADONG") == true) { area = "G", kampong = "GADONG" }
        else if (address.includes("TASEK LAMA") == true) { area = "G", kampong = "TASEK LAMA" }
        else if (address.includes("BANDAR TOWN") == true) { area = "G", kampong = "BANDAR TOWN" }
        else if (address.includes("BATU SATU") == true) { area = "JT", kampong = "BATU SATU" }
        else if (address.includes("BENGKURONG") == true) { area = "JT", kampong = "BENGKURONG" }
        else if (address.includes("BUNUT") == true) { area = "JT", kampong = "BUNUT" }
        else if (address.includes("JALAN BABU RAJA") == true) { area = "JT", kampong = "JALAN BABU RAJA" }
        else if (address.includes("JALAN ISTANA") == true) { area = "JT", kampong = "JALAN ISTANA" }
        else if (address.includes("JUNJONGAN") == true) { area = "JT", kampong = "JUNJONGAN" }
        else if (address.includes("KASAT") == true) { area = "JT", kampong = "KASAT" }
        else if (address.includes("LUMAPAS") == true) { area = "JT", kampong = "LUMAPAS" }
        else if (address.includes("JALAN HALUS") == true) { area = "JT", kampong = "JALAN HALUS" }
        else if (address.includes("MADEWA") == true) { area = "JT", kampong = "MADEWA" }
        else if (address.includes("PUTAT") == true) { area = "JT", kampong = "PUTAT" }
        else if (address.includes("SINARUBAI") == true) { area = "JT", kampong = "SINARUBAI" }
        else if (address.includes("TASEK MERADUN") == true) { area = "JT", kampong = "TASEK MERADUN" }
        else if (address.includes("TELANAI") == true) { area = "JT", kampong = "TELANAI" }
        else if (address.includes("BAN 1") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BAN 2") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BAN 3") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BAN 4") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BAN 5") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BAN 6") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BATONG") == true) { area = "JT", kampong = "BATONG" }
        else if (address.includes("BATU AMPAR") == true) { area = "JT", kampong = "BATU AMPAR" }
        else if (address.includes("BEBATIK") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
        else if (address.includes("BEBULOH") == true) { area = "JT", kampong = "BEBULOH" }
        else if (address.includes("BEBATIK KILANAS") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
        else if (address.includes("KILANAS") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
        else if (address.includes("DADAP") == true) { area = "JT", kampong = "DADAP" }
        else if (address.includes("KUALA LURAH") == true) { area = "JT", kampong = "KUALA LURAH" }
        else if (address.includes("KULAPIS") == true) { area = "JT", kampong = "KULAPIS" }
        else if (address.includes("LIMAU MANIS") == true) { area = "JT", kampong = "LIMAU MANIS" }
        else if (address.includes("MASIN") == true) { area = "JT", kampong = "MASIN" }
        else if (address.includes("MULAUT") == true) { area = "JT", kampong = "MULAUT" }
        else if (address.includes("PANCHOR MURAI") == true) { area = "JT", kampong = "PANCHOR MURAI" }
        else if (address.includes("PANCHUR MURAI") == true) { area = "JT", kampong = "PANCHOR MURAI" }
        else if (address.includes("PANGKALAN BATU") == true) { area = "JT", kampong = "PANGKALAN BATU" }
        else if (address.includes("PASAI") == true) { area = "JT", kampong = "PASAI" }
        else if (address.includes("WASAN") == true) { area = "JT", kampong = "WASAN" }
        else if (address.includes("PARIT") == true) { area = "JT", kampong = "PARIT" }
        else if (address.includes("EMPIRE") == true) { area = "JT", kampong = "EMPIRE" }
        else if (address.includes("JANGSAK") == true) { area = "JT", kampong = "JANGSAK" }
        else if (address.includes("JERUDONG") == true) { area = "JT", kampong = "JERUDONG" }
        else if (address.includes("KATIMAHAR") == true) { area = "JT", kampong = "KATIMAHAR" }
        else if (address.includes("LUGU") == true) { area = "JT", kampong = "LUGU" }
        else if (address.includes("SENGKURONG") == true) { area = "JT", kampong = "SENGKURONG" }
        else if (address.includes("TANJONG NANGKA") == true) { area = "JT", kampong = "TANJONG NANGKA" }
        else if (address.includes("TANJONG BUNUT") == true) { area = "JT", kampong = "TANJONG BUNUT" }
        else if (address.includes("TANJUNG BUNUT") == true) { area = "JT", kampong = "TANJONG BUNUT" }
        else if (address.includes("SUNGAI TAMPOI") == true) { area = "JT", kampung = "SUNGAI TAMPOI" }
        else if (address.includes("SG TAMPOI") == true) { area = "JT", kampong = "SUNGAI TAMPOI" }
        else if (address.includes("MUARA") == true) { area = "B", kampong = "MUARA" }
        //TU
        else if (address.includes("SENGKARAI") == true) { area = "TUTONG", kampong = "SENGKARAI" }
        else if (address.includes("PANCHOR") == true) { area = "TUTONG", kampong = "PANCHOR" }
        else if (address.includes("PENABAI") == true) { area = "TUTONG", kampong = "PENABAI" }
        else if (address.includes("KUALA TUTONG") == true) { area = "TUTONG", kampong = "KUALA TUTONG" }
        else if (address.includes("PENANJONG") == true) { area = "TUTONG", kampong = "PENANJONG" }
        else if (address.includes("KERIAM") == true) { area = "TUTONG", kampong = "KERIAM" }
        else if (address.includes("BUKIT PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
        else if (address.includes("PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
        else if (address.includes("LUAGAN") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
        else if (address.includes("DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
        else if (address.includes("LUAGAN DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
        else if (address.includes("SINAUT") == true) { area = "TUTONG", kampong = "SINAUT" }
        else if (address.includes("SUNGAI KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
        else if (address.includes("KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
        else if (address.includes("SG KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
        else if (address.includes("KUPANG") == true) { area = "TUTONG", kampong = "KUPANG" }
        else if (address.includes("KIUDANG") == true) { area = "TUTONG", kampong = "KIUDANG" }
        else if (address.includes("PAD") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
        else if (address.includes("NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
        else if (address.includes("PAD NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
        else if (address.includes("BEKIAU") == true) { area = "TUTONG", kampong = "BEKIAU" }
        else if (address.includes("MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
        else if (address.includes("PENGKALAN MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
        else if (address.includes("BATANG MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
        else if (address.includes("MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
        else if (address.includes("KEBIA") == true) { area = "TUTONG", kampong = "KEBIA" }
        else if (address.includes("BIRAU") == true) { area = "TUTONG", kampong = "BIRAU" }
        else if (address.includes("LAMUNIN") == true) { area = "TUTONG", kampong = "LAMUNIN" }
        else if (address.includes("LAYONG") == true) { area = "TUTONG", kampong = "LAYONG" }
        else if (address.includes("MENENGAH") == true) { area = "TUTONG", kampong = "MENENGAH" }
        else if (address.includes("PANCHONG") == true) { area = "TUTONG", kampong = "PANCHONG" }
        else if (address.includes("PENAPAR") == true) { area = "TUTONG", kampong = "PANAPAR" }
        else if (address.includes("TANJONG MAYA") == true) { area = "TUTONG", kampong = "TANJONG MAYA" }
        else if (address.includes("MAYA") == true) { area = "TUTONG", kampong = "MAYA" }
        else if (address.includes("LUBOK") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
        else if (address.includes("PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
        else if (address.includes("LUBOK PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
        else if (address.includes("BUKIT UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
        else if (address.includes("UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
        else if (address.includes("RAMBAI") == true) { area = "TUTONG", kampong = "RAMBAI" }
        else if (address.includes("BENUTAN") == true) { area = "TUTONG", kampong = "BENUTAN" }
        else if (address.includes("MERIMBUN") == true) { area = "TUTONG", kampong = "MERIMBUN" }
        else if (address.includes("UKONG") == true) { area = "TUTONG", kampong = "UKONG" }
        else if (address.includes("LONG") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
        else if (address.includes("MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
        else if (address.includes("LONG MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
        else if (address.includes("TELISAI") == true) { area = "TUTONG", kampong = "TELISAI" }
        else if (address.includes("DANAU") == true) { area = "TUTONG", kampong = "DANAU" }
        else if (address.includes("BUKIT BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
        else if (address.includes("BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
        else if (address.includes("TUTONG") == true) { area = "TUTONG", kampong = "TUTONG" }
        //KB
        else if (address.includes("AGIS") == true) { area = "LUMUT", kampong = "AGIS" }
        else if (address.includes("ANDALAU") == true) { area = "LUMUT", kampong = "ANDALAU" }
        else if (address.includes("ANDUKI") == true) { area = "LUMUT", kampong = "ANDUKI" }
        else if (address.includes("APAK") == true) { area = "KB / SERIA", kampong = "APAK" }
        else if (address.includes("BADAS") == true) { area = "LUMUT", kampong = "BADAS" }
        else if (address.includes("BANG") == true) { area = "KB / SERIA", kampong = "BANG" }
        else if (address.includes("GARANG") == true) { area = "KB / SERIA", kampong = "GARANG" }
        else if (address.includes("PUKUL") == true) { area = "KB / SERIA", kampong = "PUKUL" }
        else if (address.includes("TAJUK") == true) { area = "KB / SERIA", kampong = "TAJUK" }
        else if (address.includes("BENGERANG") == true) { area = "KB / SERIA", kampong = "BENGERANG" }
        else if (address.includes("BIADONG") == true) { area = "KB / SERIA", kampong = "BIADONG" }
        else if (address.includes("ULU") == true) { area = "KB / SERIA", kampong = "ULU" }
        else if (address.includes("TENGAH") == true) { area = "KB / SERIA", kampong = "TENGAH" }
        else if (address.includes("BISUT") == true) { area = "KB / SERIA", kampong = "BISUT" }
        else if (address.includes("BUAU") == true) { area = "KB / SERIA", kampong = "BUAU" }
        else if (address.includes("KANDOL") == true) { area = "KB / SERIA", kampong = "KANDOL" }
        else if (address.includes("PUAN") == true) { area = "KB / SERIA", kampong = "PUAN" }
        else if (address.includes("TUDING") == true) { area = "LUMUT", kampong = "TUDING" }
        else if (address.includes("SAWAT") == true) { area = "KB / SERIA", kampong = "SAWAT" }
        else if (address.includes("SERAWONG") == true) { area = "KB / SERIA", kampong = "SERAWONG" }
        else if (address.includes("CHINA") == true) { area = "KB / SERIA", kampong = "CHINA" }
        else if (address.includes("DUGUN") == true) { area = "KB / SERIA", kampong = "DUGUN" }
        else if (address.includes("GATAS") == true) { area = "KB / SERIA", kampong = "GATAS" }
        else if (address.includes("JABANG") == true) { area = "KB / SERIA", kampong = "JABANG" }
        else if (address.includes("KAGU") == true) { area = "KB / SERIA", kampong = "KAGU" }
        else if (address.includes("KAJITAN") == true) { area = "KB / SERIA", kampong = "KAJITAN" }
        else if (address.includes("KELUYOH") == true) { area = "KB / SERIA", kampong = "KELUYOH" }
        else if (address.includes("KENAPOL") == true) { area = "KB / SERIA", kampong = "KENAPOL" }
        else if (address.includes("KUALA BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
        else if (address.includes("BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
        else if (address.includes("KUALA BELAIT") == true) { area = "KB", kampong = "KUALA BELAIT" }
        else if (address.includes("KUKUB") == true) { area = "KB / SERIA", kampong = "KUKUB" }
        else if (address.includes("LABI") == true) { area = "LUMUT", kampong = "LABI" }
        else if (address.includes("LAKANG") == true) { area = "KB / SERIA", kampong = "LAKANG" }
        else if (address.includes("LAONG ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
        else if (address.includes("ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
        else if (address.includes("LAONG") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
        else if (address.includes("LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
        else if (address.includes("SUNGAI LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
        else if (address.includes("SG LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
        else if (address.includes("LUMUT") == true) { area = "LUMUT", kampong = "LUMUT" }
        else if (address.includes("LORONG") == true) { area = "SERIA", kampong = "LORONG" }
        else if (address.includes("LORONG TENGAH") == true) { area = "SERIA", kampong = "LORONG TENGAH" }
        else if (address.includes("LORONG TIGA SELATAN") == true) { area = "SERIA", kampong = "LORONG TIGA SELATAN" }
        else if (address.includes("LILAS") == true) { area = "KB / SERIA", kampong = "LILAS" }
        else if (address.includes("LUBUK LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
        else if (address.includes("LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
        else if (address.includes("LUBUK TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
        else if (address.includes("TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
        else if (address.includes("MALA'AS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
        else if (address.includes("MALAAS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
        else if (address.includes("MALAYAN") == true) { area = "KB / SERIA", kampong = "MELAYAN" }
        else if (address.includes("MELAYU") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
        else if (address.includes("ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
        else if (address.includes("MELAYU ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
        else if (address.includes("MELILAS") == true) { area = "LUMUT", kampong = "MELILAS" }
        else if (address.includes("MENDARAM") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
        else if (address.includes("MENDARAM BESAR") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
        else if (address.includes("MENDARAM KECIL") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
        else if (address.includes("MERANGKING") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
        else if (address.includes("MERANGKING ULU") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
        else if (address.includes("MERANGKING HILIR") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
        else if (address.includes("MUMONG") == true) { area = "KB", kampong = "MUMONG" }
        else if (address.includes("PANDAN") == true) { area = "KB", kampong = "PANDAN" }
        else if (address.includes("PADANG") == true) { area = "KB", kampong = "PADANG" }
        else if (address.includes("PANAGA") == true) { area = "SERIA", kampong = "PANAGA" }
        else if (address.includes("PENGKALAN SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
        else if (address.includes("SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
        else if (address.includes("PENGALAYAN") == true) { area = "KB / SERIA", kampong = "PENGALAYAN" }
        else if (address.includes("PENYRAP") == true) { area = "KB / SERIA", kampong = "PENYRAP" }
        else if (address.includes("PERANGKONG") == true) { area = "KB / SERIA", kampong = "PERANGKONG" }
        else if (address.includes("PERUMPONG") == true) { area = "LUMUT", kampong = "PERUMPONG" }
        else if (address.includes("PESILIN") == true) { area = "KB / SERIA", kampong = "PESILIN" }
        else if (address.includes("PULAU APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
        else if (address.includes("APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
        else if (address.includes("RAMPAYOH") == true) { area = "KB / SERIA", kampong = "RAMPAYOH" }
        else if (address.includes("RATAN") == true) { area = "KB / SERIA", kampong = "RATAN" }
        else if (address.includes("SAUD") == true) { area = "KB / SERIA", kampong = "SAUD" }
        //else if (address.includes("SIMPANG") == true) {area = "KB / SERIA", kampong = "SIMPANG TIGA"}
        else if (address.includes("SIMPANG TIGA") == true) { area = "LUMUT", kampong = "SIMPANG TIGA" }
        else if (address.includes("SINGAP") == true) { area = "KB / SERIA", kampong = "SINGAP" }
        else if (address.includes("SUKANG") == true) { area = "KB / SERIA", kampong = "SUKANG" }
        else if (address.includes("BAKONG") == true) { area = "LUMUT", kampong = "BAKONG" }
        else if (address.includes("DAMIT") == true) { area = "KB / SERIA", kampong = "DAMIT" }
        else if (address.includes("BERA") == true) { area = "KB / SERIA", kampong = "BERA" }
        else if (address.includes("DUHON") == true) { area = "KB / SERIA", kampong = "DUHON" }
        else if (address.includes("GANA") == true) { area = "LUMUT", kampong = "GANA" }
        else if (address.includes("HILIR") == true) { area = "KB / SERIA", kampong = "HILIR" }
        else if (address.includes("KANG") == true) { area = "LUMUT", kampong = "KANG" }
        else if (address.includes("KURU") == true) { area = "LUMUT", kampong = "KURU" }
        else if (address.includes("LALIT") == true) { area = "LUMUT", kampong = "LALIT" }
        else if (address.includes("LUTONG") == true) { area = "KB / SERIA", kampong = "LUTONG" }
        else if (address.includes("MAU") == true) { area = "KB / SERIA", kampong = "MAU" }
        else if (address.includes("MELILIT") == true) { area = "KB / SERIA", kampong = "MELILIT" }
        else if (address.includes("PETAI") == true) { area = "KB / SERIA", kampong = "PETAI" }
        else if (address.includes("TALI") == true) { area = "LUMUT", kampong = "TALI" }
        else if (address.includes("TARING") == true) { area = "LUMUT", kampong = "TARING" }
        else if (address.includes("TERABAN") == true) { area = "KB", kampong = "TERABAN" }
        else if (address.includes("UBAR") == true) { area = "KB / SERIA", kampong = "UBAR" }
        else if (address.includes("TANAJOR") == true) { area = "KB / SERIA", kampong = "TANAJOR" }
        else if (address.includes("TANJONG RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
        else if (address.includes("RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
        else if (address.includes("TANJONG SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
        else if (address.includes("SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
        else if (address.includes("TAPANG LUPAK") == true) { area = "KB / SERIA", kampong = "TAPANG LUPAK" }
        else if (address.includes("TARAP") == true) { area = "KB / SERIA", kampong = "TARAP" }
        else if (address.includes("TEMPINAK") == true) { area = "KB / SERIA", kampong = "TEMPINAK" }
        else if (address.includes("TERAJA") == true) { area = "KB / SERIA", kampong = "TERAJA" }
        else if (address.includes("TERAWAN") == true) { area = "KB / SERIA", kampong = "TERAWAN" }
        else if (address.includes("TERUNAN") == true) { area = "KB / SERIA", kampong = "TERUNAN" }
        else if (address.includes("TUGONG") == true) { area = "KB / SERIA", kampong = "TUGONG" }
        else if (address.includes("TUNGULLIAN") == true) { area = "LUMUT", kampong = "TUNGULLIAN" }
        else if (address.includes("UBOK") == true) { area = "KB / SERIA", kampong = "UBOK" }
        else if (address.includes("BELAIT") == true) { area = "KB / SERIA", kampong = "BELAIT" }
        else if (address.includes("SERIA") == true) { area = "KB / SERIA", kampong = "BELAIT" }
        //TE
        else if (address.includes("AMO") == true) { area = "TEMBURONG", kampong = "AMO" }
        else if (address.includes("AYAM-AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
        else if (address.includes("AYAM AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
        else if (address.includes("BAKARUT") == true) { area = "TEMBURONG", kampong = "BAKARUT" }
        else if (address.includes("BATANG DURI") == true) { area = "TEMBURONG", kampong = "BATANG DURI" }
        else if (address.includes("BATANG TUAU") == true) { area = "TEMBURONG", kampong = "BATANG TUAU" }
        else if (address.includes("BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
        else if (address.includes("APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
        else if (address.includes("BATU BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
        else if (address.includes("BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
        else if (address.includes("BELABAN") == true) { area = "TEMBURONG", kampong = "BELABAN" }
        else if (address.includes("BELAIS") == true) { area = "TEMBURONG", kampong = "BELAIS" }
        else if (address.includes("BELINGOS") == true) { area = "TEMBURONG", kampong = "BELINGOS" }
        else if (address.includes("BIANG") == true) { area = "TEMBURONG", kampong = "BIANG" }
        else if (address.includes("BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
        else if (address.includes("BUDA BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
        else if (address.includes("BUDA-BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
        else if (address.includes("GADONG BARU") == true) { area = "TEMBURONG", kampong = "GADONG BARU" }
        else if (address.includes("KENUA") == true) { area = "TEMBURONG", kampong = "KENUA" }
        else if (address.includes("LABU ESTATE") == true) { area = "TEMBURONG", kampong = "LABU" }
        else if (address.includes("LABU") == true) { area = "TEMBURONG", kampong = "LABU" }
        else if (address.includes("LAGAU") == true) { area = "TEMBURONG", kampong = "LAGAU" }
        else if (address.includes("LAKIUN") == true) { area = "TEMBURONG", kampong = "LAKIUN" }
        else if (address.includes("LAMALING") == true) { area = "TEMBURONG", kampong = "LAMALING" }
        else if (address.includes("LEPONG") == true) { area = "TEMBURONG", kampong = "LEPONG" }
        else if (address.includes("LUAGAN") == true) { area = "TEMBURONG", kampong = "LUAGAN" }
        else if (address.includes("MANIUP") == true) { area = "TEMBURONG", kampong = "MANIUP" }
        else if (address.includes("MENENGAH") == true) { area = "TEMBURONG", kampong = "MENGENGAH" }
        else if (address.includes("NEGALANG") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
        else if (address.includes("NEGALANG ERING") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
        else if (address.includes("NEGALANG UNAT") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
        else if (address.includes("PARIT") == true) { area = "TEMBURONG", kampong = "PARIT" }
        else if (address.includes("PARIT BELAYANG") == true) { area = "TEMBURONG", kampong = "PARIT BELAYANG" }
        else if (address.includes("PAYAU") == true) { area = "TEMBURONG", kampong = "PAYAU" }
        else if (address.includes("PELIUNAN") == true) { area = "TEMBURONG", kampong = "PELIUNAN" }
        else if (address.includes("PERDAYAN") == true) { area = "TEMBURONG", kampong = "PERDAYAN" }
        else if (address.includes("PIASAU-PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
        else if (address.includes("PIASAU PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
        else if (address.includes("PIUNGAN") == true) { area = "TEMBURONG", kampong = "PIUNGAN" }
        else if (address.includes("PUNI") == true) { area = "TEMBURONG", kampong = "PUNI" }
        else if (address.includes("RATAIE") == true) { area = "TEMBURONG", kampong = "RATAIE" }
        else if (address.includes("REBADA") == true) { area = "TEMBURONG", kampong = "REBADA" }
        else if (address.includes("SEKUROP") == true) { area = "TEMBURONG", kampong = "SEKUROP" }
        else if (address.includes("SELANGAN") == true) { area = "TEMBURONG", kampong = "SELANGAN" }
        else if (address.includes("SELAPON") == true) { area = "TEMBURONG", kampong = "SELAPON" }
        else if (address.includes("SEMABAT") == true) { area = "TEMBURONG", kampong = "SEMABAT" }
        else if (address.includes("SEMAMAMNG") == true) { area = "TEMBURONG", kampong = "SEMAMANG" }
        else if (address.includes("SENUKOH") == true) { area = "TEMBURONG", kampong = "SENUKOH" }
        else if (address.includes("SERI TANJONG BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
        else if (address.includes("BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
        else if (address.includes("SIBULU") == true) { area = "TEMBURONG", kampong = "SIBULU" }
        else if (address.includes("SIBUT") == true) { area = "TEMBURONG", kampong = "SIBUT" }
        else if (address.includes("SIMBATANG BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
        else if (address.includes("SIMBATANG BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
        else if (address.includes("SUBOK") == true) { area = "TEMBURONG", kampong = "SUBOK" }
        else if (address.includes("SUMBILING") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
        else if (address.includes("SUMBILING BARU") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
        else if (address.includes("SUMBILING LAMA") == true) { area = "TEMBURONG", kampong = "SUMBILING LAMA" }
        else if (address.includes("SUNGAI RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
        else if (address.includes("SG RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
        else if (address.includes("SUNGAI SULOK") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
        else if (address.includes("SG SULOK ") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
        else if (address.includes("SUNGAI TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
        else if (address.includes("SG TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
        else if (address.includes("SUNGAI TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
        else if (address.includes("SG TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
        else if (address.includes("TANJONG BUNGAR") == true) { area = "TEMBURONG", kampong = "TANJONG BUNGAR" }
        else if (address.includes("TEMADA") == true) { area = "TEMBURONG", kampong = "TEMADA" }
        else if (address.includes("UJONG JALAN") == true) { area = "TEMBURONG", kampong = "UJONG JALAN" }
        else if (address.includes("BANGAR") == true) { area = "TEMBURONG", kampong = "BANGAR" }
        else if (address.includes("TEMBURONG") == true) { area = "TEMBURONG" }
        else { area = "N/A" }

        result.push({ customerAddress: address.trim(), area });
    }

    res.render('successAddressArea', { entries: result, user: req.user });
});

// Add token cache object at the top with your other caches
const gdexTokenCache = {
    token: null,
    expiry: null,
    env: null // Track which environment the token is for
};

// Add retry logic to getGDEXToken
async function getGDEXToken(retries = 3) {
    // Check if we have a valid cached token for current environment
    const now = Date.now();
    if (gdexTokenCache.token &&
        gdexTokenCache.expiry &&
        gdexTokenCache.env === GDEX_ENV &&
        now < gdexTokenCache.expiry) {
        console.log(`Using cached GDEX ${GDEX_ENV.toUpperCase()} token`);
        return gdexTokenCache.token;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Getting GDEX token (attempt ${attempt}/${retries})`);

            const credentials = {
                UsernameOrEmailAddress: gdexConfig.username,
                Password: gdexConfig.password
            };

            const response = await axios.post(gdexConfig.authUrl, credentials, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });

            if (response.data.success && response.data.result) {
                console.log(`✅ GDEX ${GDEX_ENV.toUpperCase()} Token obtained successfully`);

                // Cache the token (15 minutes = 900,000 milliseconds)
                // Use 13 minutes to be safe
                gdexTokenCache.token = response.data.result;
                gdexTokenCache.expiry = now + (13 * 60 * 1000); // 13 minutes to be safe
                gdexTokenCache.env = GDEX_ENV;

                return response.data.result;
            } else {
                console.error(`GDEX ${GDEX_ENV.toUpperCase()} Authentication failed:`, response.data.error);
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    continue;
                }
                return null;
            }
        } catch (error) {
            console.error(`Error getting GDEX ${GDEX_ENV.toUpperCase()} token (attempt ${attempt}):`, error.message);
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
            }
            return null;
        }
    }
}

// Fix the sendGDEXTrackingWebhook function
async function sendGDEXTrackingWebhook(consignmentID, statusCode, statusDescription, locationDescription, token, reasoncode = "", epod = "") {
    try {
        const trackingData = {
            consignmentno: consignmentID,
            statuscode: statusCode,
            statusdescription: statusDescription,
            statusdatetime: moment().format('YYYY-MM-DDTHH:mm:ss'),
            reasoncode: reasoncode, // Now accepts reasoncode
            locationdescription: locationDescription,
            epod: epod, // Now accepts epod
            deliverypartner: "gorush"
        };

        console.log(`Sending GDEX webhook for ${consignmentID}: ${statusCode} - ${statusDescription}`);

        const response = await axios.post(gdexConfig.trackingUrl, trackingData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            timeout: 10000
        });

        if (response.data.success) {
            console.log(`✅ GDEX ${GDEX_ENV.toUpperCase()} Tracking webhook ${statusCode} sent successfully for ${consignmentID}`);
            return true;
        } else {
            console.error(`❌ GDEX ${GDEX_ENV.toUpperCase()} Tracking webhook ${statusCode} failed for ${consignmentID}:`, response.data.error);
            return false;
        }
    } catch (error) {
        console.error(`🔥 Error sending GDEX ${GDEX_ENV.toUpperCase()} tracking webhook ${statusCode} for ${consignmentID}:`, error.message);
        if (error.response) {
            console.error(`🔥 Response data:`, error.response.data);
        }
        return false;
    }
}

// Update the updateGDEXStatus function to pass correct parameters
async function updateGDEXStatus(consignmentID, statusType, detrackData = null, statusCode = null, statusDescription = null, locationDescription = null, reasonCode = null, epod = null) {
    console.log(`=== Updating GDEX status (${statusType}) for: ${consignmentID} ===`);

    // Get token
    const token = await getGDEXToken();
    if (!token) {
        console.error(`❌ Failed to get GDEX token for ${consignmentID}`);
        return false;
    }

    if (statusType === 'warehouse') {
        return await updateGDEXWarehouseStatus(consignmentID, token);
    } else if (statusType === 'custom') {
        return await sendGDEXTrackingWebhook(
            consignmentID,
            statusCode,
            statusDescription,
            locationDescription,
            token
        );
    } else if (statusType === 'out_for_delivery') {
        return await sendGDEXTrackingWebhook(
            consignmentID,
            "AL2",
            "Out for Delivery",
            "Go Rush Driver",
            token
        );
    } else if (statusType === 'self_collect') {
        return await sendGDEXTrackingWebhook(
            consignmentID,
            "AL2",
            "Out for Delivery",
            "Go Rush Office",
            token
        );
    } else if (statusType === 'cancelled') {
        return await sendGDEXTrackingWebhook(
            consignmentID,
            "BA",
            "Shipper/HQ Instruction to Cancel Delivery",
            "Go Rush Warehouse",
            token
        );
    } else if (statusType === 'clear_job') {
        if (!detrackData) {
            console.error(`❌ No Detrack data provided for clear job: ${consignmentID}`);
            return false;
        }
        return await updateGDEXClearJob(consignmentID, detrackData, token);
    } else {
        console.error(`❌ Unknown GDEX status type: ${statusType}`);
        return false;
    }
}

// Update updateGDEXClearJob to use correct parameters
async function updateGDEXClearJob(consignmentID, detrackData, token) {
    try {
        console.log(`=== Processing GDEX clear job for: ${consignmentID} ===`);
        console.log(`Detrack status: ${detrackData.status}, reason: ${detrackData.reason}`);

        let statusCode, statusDescription, reasonCode, locationDescription, epod;

        // Check if job is completed or failed
        if (detrackData.status === 'completed') {
            // Completed delivery
            statusCode = "FD";
            statusDescription = "Delivered";
            reasonCode = "";
            locationDescription = detrackData.address || "Customer Address";
            epod = detrackData.photo_1_file_url || "";

            console.log(`GDEX: Sending FD (Delivered) status for ${consignmentID}`);

        } else if (detrackData.status === 'failed') {
            // Failed delivery - map reason to GDEX reason code
            statusCode = "DF";
            statusDescription = "Delivery Failed";
            reasonCode = mapDetrackReasonToGDEX(detrackData.reason);
            locationDescription = "Go Rush Warehouse";
            epod = "";

            console.log(`GDEX: Sending DF (Failed) status for ${consignmentID}, reason code: ${reasonCode}`);

        } else {
            console.error(`Unknown Detrack status for clear job: ${detrackData.status}`);
            return false;
        }

        // Use the updated sendGDEXTrackingWebhook with all parameters
        const success = await sendGDEXTrackingWebhook(
            consignmentID,
            statusCode,
            statusDescription,
            locationDescription,
            token,
            reasonCode,  // Pass reasoncode
            epod         // Pass epod
        );

        return success;

    } catch (error) {
        console.error(`🔥 Error in updateGDEXClearJob for ${consignmentID}:`, error.message);
        return false;
    }
}

// Add this function to map Detrack reasons to GDEX reason codes
function mapDetrackReasonToGDEX(detrackReason) {
    if (!detrackReason) return "AR"; // Default

    const reason = detrackReason.toLowerCase();

    // Map Detrack reasons to GDEX reason codes
    if (reason.includes("unattempted delivery")) {
        return "BM";
    } else if (reason.includes("reschedule delivery requested by customer") ||
        reason.includes("reschedule to self collect requested by customer")) {
        return "AG";
    } else if (reason.includes("reschedule to self collect requested by customer")) {
        return "AG";
    } else if (reason.includes("customer not available") ||
        reason.includes("cannot be contacted") ||
        reason.includes("customer declined delivery")) {
        return "AR";
    } else if (reason.includes("unable to locate address") ||
        reason.includes("incorrect address")) {
        return "BN";
    } else if (reason.includes("reschedule delivery requested by customer")) {
        return "BK";
    } else {
        // Default for other failure reasons
        return "AR";
    }
}

// Update updateGDEXWarehouseStatus to accept token parameter
async function updateGDEXWarehouseStatus(consignmentID, token) {
    console.log(`Starting 3-step GDEX warehouse updates for: ${consignmentID}`);

    const warehouseLocation = "Go Rush Warehouse";

    try {
        // Step 1: DT1 - Hub Inbound(B)
        console.log(`Step 1: Sending DT1 (Hub Inbound) for ${consignmentID}`);
        const step1Success = await sendGDEXTrackingWebhook(
            consignmentID,
            "DT1",
            "Hub Inbound",
            warehouseLocation,
            token
        );

        if (!step1Success) {
            console.error(`Failed at Step 1 (DT1) for ${consignmentID}`);
            return false;
        }

        // Small delay between steps
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 2: DT2 - Hub Outbound(H)
        console.log(`Step 2: Sending DT2 (Hub Outbound) for ${consignmentID}`);
        const step2Success = await sendGDEXTrackingWebhook(
            consignmentID,
            "DT2",
            "Hub Outbound",
            warehouseLocation,
            token
        );

        if (!step2Success) {
            console.error(`Failed at Step 2 (DT2) for ${consignmentID}`);
            return false;
        }

        // Small delay between steps
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 3: AL1 - Received by Branch(R)
        console.log(`Step 3: Sending AL1 (Received by Branch) for ${consignmentID}`);
        const step3Success = await sendGDEXTrackingWebhook(
            consignmentID,
            "AL1",
            "Received by Branch",
            warehouseLocation,
            token
        );

        if (!step3Success) {
            console.error(`Failed at Step 3 (AL1) for ${consignmentID}`);
            return false;
        }

        console.log(`✅ All 3 GDEX warehouse updates completed successfully for ${consignmentID}`);
        return true;

    } catch (error) {
        console.error(`Error in GDEX warehouse updates for ${consignmentID}:`, error.message);
        return false;
    }
}

async function updateDetrackStatus(consignmentID, apiKey, detrackUpdateDataAttempt, detrackUpdateData) {
    try {
        // First API Call: Increase Attempt
        const attemptResponse = await axios.post(
            'https://app.detrack.com/api/v2/dn/jobs/reattempt',
            detrackUpdateDataAttempt,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey
                }
            }
        );

        if (attemptResponse.status === 200) {
            console.log(`Attempt for Consignment ID: ${consignmentID} increased by 1`);
        } else {
            console.error(`Failed to increase attempt for Tracking Number: ${consignmentID}`);
            return;
        }

        // Small Delay to avoid API race condition
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay

        // Second API Call: Update Status
        let retries = 3;
        while (retries > 0) {
            try {
                const updateResponse = await axios.put(
                    'https://app.detrack.com/api/v2/dn/jobs/update',
                    detrackUpdateData,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-KEY': apiKey
                        }
                    }
                );

                if (updateResponse.status === 200) {
                    console.log(`Detrack Status Updated for Tracking Number: ${consignmentID}`);
                    break;
                } else {
                    throw new Error(`Status Code: ${updateResponse.status}`);
                }
            } catch (err) {
                retries--;
                console.error(`Error updating Detrack Status for ${consignmentID}. Retries left: ${retries}`);
                if (retries === 0) {
                    console.error(`Final failure for Detrack Status Update for ${consignmentID}`);
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 sec before retry
                }
            }
        }

    } catch (error) {
        console.error(`Unexpected error for Tracking Number: ${consignmentID}`, error.message);
    }
}

async function updateDetrackStatusWithRetry(consignmentID, apiKey, updateData, attempt = 1) {
    try {
        const response = await axios.put(
            'https://app.detrack.com/api/v2/dn/jobs/update',
            updateData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey
                }
            }
        );
        console.log(`[SUCCESS] Detrack Updated to "${updateData.data.status}" - Attempt ${attempt} - Tracking: ${consignmentID}`);
        return true;
    } catch (error) {
        console.error(`[FAIL] Attempt ${attempt} Failed - Status: "${updateData.data.status}" - Tracking: ${consignmentID} - Error: ${error.message}`);
        if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
            return updateDetrackStatusWithRetry(consignmentID, apiKey, updateData, attempt + 1);
        } else {
            console.error(`[FINAL FAIL] Unable to update Detrack Status: "${updateData.data.status}" - Tracking: ${consignmentID}`);
            return false;
        }
    }
}

async function increaseDetrackAttempt(consignmentID, apiKey, detrackUpdateDataAttempt, attempt = 1) {
    try {
        const response = await axios.post(
            'https://app.detrack.com/api/v2/dn/jobs/reattempt',
            detrackUpdateDataAttempt,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey
                }
            }
        );
        console.log(`Attempt increased by 1 for Consignment ID: ${consignmentID} (Attempt ${attempt})`);
        return true;
    } catch (error) {
        console.error(`Attempt ${attempt} to increase attempt failed for Tracking Number: ${consignmentID} - Error: ${error.message}`);
        if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // exponential backoff
            return increaseDetrackAttempt(consignmentID, apiKey, detrackUpdateDataAttempt, attempt + 1);
        } else {
            console.error(`Final failure to increase attempt for Tracking Number: ${consignmentID}`);
            return false;
        }
    }
}

// Handle form submission
app.post('/updateDelivery', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    let accessToken = null; // Initialize the accessToken variable

    const consignmentIDs = req.body.consignmentIDs.trim().split('\n').map((id) => id.trim().toUpperCase());

    const uniqueConsignmentIDs = new Set(); // Use a Set to automatically remove duplicates

    for (const consignmentID of consignmentIDs) {
        if (!consignmentID) continue;
        uniqueConsignmentIDs.add(consignmentID);
    }

    // Convert the Set back to an array (if needed)
    const uniqueConsignmentIDsArray = Array.from(uniqueConsignmentIDs);

    for (const consignmentID of uniqueConsignmentIDsArray) {
        try {
            var DetrackAPIrun = 0;
            var mongoDBrun = 0;
            var completeRun = 0;
            var ceCheck = 0;
            var warehouseEntryCheck = 0;
            var waOrderFailedDelivery = 0;
            var waOrderCompletedFeedback = 0;
            var product = '';
            var latestPODDate = "";
            var portalUpdate = "";
            var currentDetrackStatus = "";
            var detrackReason = "";
            var filter = "";
            var existingOrder = "";
            var newOrder = "";
            var update = "";
            var currentProduct = "";
            var warehouseEntryCheckDateTime = "";
            var completedCheckDateTime = "";
            var remarkSC = '';
            var maxAttempt = 0;
            var unattemptedTimes = 0;
            var itemsArray = []; // Array to hold items for the new order
            var itemsArrayDetrack = []; // Array to hold items for the new order
            var products = ""
            var tracker
            var sequence
            var checkProduct = 0;
            var address = '';
            var kampong = '';
            var area = '';
            var postalCode = 'N/A';
            var wrongPick = 0;
            var finalLDPrice = '';
            var lastMilestoneStatus = '';
            var finalPhoneNum = '';
            var finalArea = "";
            var GDEXAPIrun = 0;

            // Skip empty lines
            if (!consignmentID) continue;

            // Step 2: Make the first API GET request to fetch data from Detrack
            const response1 = await axios.get(`https://app.detrack.com/api/v2/dn/jobs/show/?do_number=${consignmentID}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey
                }
            });

            const data = response1.data;

            const counttaskhistory = data.data.milestones.length;

            // Check if data.data.phone_number is null or empty
            if (data.data.phone_number) {
                if (data.data.phone_number.length === 7) {
                    finalPhoneNum = "+673" + data.data.phone_number;
                } else if (data.data.phone_number.length === 10) {
                    finalPhoneNum = "+" + data.data.phone_number;
                } else {
                    finalPhoneNum = data.data.phone_number;
                }
            } else {
                // Handle the case where data.data.phone_number is null or empty
                finalPhoneNum = "No phone number provided";
            }

            for (let i = 0; i < counttaskhistory; i++) {
                if (data.data.milestones[i].status == 'completed') {
                    latestPODDate = data.data.milestones[i].pod_at;
                    completedCheckDateTime = data.data.milestones[i].created_at;
                }

                if ((data.data.milestones[i].status == 'at_warehouse') && (warehouseEntryCheck == 0)) {
                    warehouseEntryCheckDateTime = data.data.milestones[i].created_at;
                    warehouseEntryCheck = 1;
                }
            }

            lastMilestoneStatus = data.data.milestones[data.data.milestones.length - 1].status;

            if (data.data.postal_code != null) {
                postalCode = data.data.postal_code.toUpperCase()
            }

            product = data.data.group_name;

            if ((product == 'EWE') || (product == 'EWENS') || (product == 'KPTDP') || (product == 'PDU') || (product == 'PURE51') || (product == 'TEMU') || (product == 'MGLOBAL') || (product == 'GDEXT') || (product == 'GDEX')) {
                // Loop through each item in the data.data.items array and construct the items array
                for (let i = 0; i < data.data.items.length; i++) {
                    itemsArray.push({
                        quantity: data.data.items[i].quantity,
                        description: data.data.items[i].description,
                        totalItemPrice: data.data.total_price
                    });

                    itemsArrayDetrack.push({
                        quantity: data.data.items[i].quantity,
                        description: data.data.items[i].description,
                        sku: data.data.items[i].sku
                    });
                }
            }

            if (data.data.status == 'info_recv') {
                currentDetrackStatus = "Info Received"
            }

            if (data.data.status == 'on_hold') {
                currentDetrackStatus = "On Hold"
            }

            if (data.data.status == 'shipment_delay') {
                currentDetrackStatus = "Shipment delay"
            }

            if (data.data.status == 'custom_clearing') {
                currentDetrackStatus = "Custom Clearing"
            }

            if (data.data.status == 'at_warehouse') {
                currentDetrackStatus = "At Warehouse"
            }

            if (data.data.status == 'dispatched') {
                currentDetrackStatus = "In Progress/Out for Delivery/Out for Collection"
            }

            if (data.data.status == 'completed') {
                currentDetrackStatus = "Completed"
            }

            if (data.data.status == 'failed') {
                currentDetrackStatus = "Failed"
            }

            if (data.data.status == 'cancelled') {
                currentDetrackStatus = "Cancelled"
            }

            if (data.data.status == 'missing_parcel') {
                currentDetrackStatus = "Missing Parcel"
            }

            if (data.data.status == 'in_sorting_area') {
                currentDetrackStatus = "In Sorting Area"
            }

            if (req.body.statusCode == 'FA') {
                appliedStatus = "Attempt Fix"
            }

            if (req.body.statusCode == 'UW') {
                appliedStatus = "Update Weight"
            }

            if (req.body.statusCode == 'UP') {
                appliedStatus = "Update Price"
            }

            if (req.body.statusCode == 'UD') {
                appliedStatus = "Update Job Date"
            }

            if (req.body.statusCode == 'UAR') {
                appliedStatus = "Update Area"
            }

            if (req.body.statusCode == 'UAS') {
                appliedStatus = "Update Address"
            }

            if (req.body.statusCode == 'UPN') {
                appliedStatus = "Update Phone Number"
            }

            if (req.body.statusCode == 'URN') {
                appliedStatus = "Update Customer Name"
            }

            if (req.body.statusCode == 'UPC') {
                appliedStatus = "Update Postal Code"
            }

            if (req.body.statusCode == 'UAB') {
                appliedStatus = "Update AWB Number"
            }

            if (req.body.statusCode == 'UJM') {
                appliedStatus = "Update Job Method"
            }

            if (req.body.statusCode == 'UWL') {
                appliedStatus = "Update Warehouse"
            }

            if (req.body.statusCode == 'UGR') {
                appliedStatus = "Update Go Rush Remark"
            }

            if (req.body.statusCode == 'FCC') {
                appliedStatus = "Update Fail due to Customer not available / cannot be contacted"
            }

            if (req.body.statusCode == 'FSC') {
                appliedStatus = "Update Fail due to Reschedule to self collect requested by customer"
            }

            if (req.body.statusCode == 'FIA') {
                appliedStatus = "Update Fail due to Incorrect Address"
            }

            if (req.body.statusCode == 'IR') {
                appliedStatus = "Info Received"
            }

            if (req.body.statusCode == 'CP') {
                appliedStatus = "Custom Clearance in Progress"
            }

            if (req.body.statusCode == 'DC') {
                appliedStatus = "Detained by Customs"
            }

            if (req.body.statusCode == '38') {
                appliedStatus = "Custom Clearance Release"
            }

            if (req.body.statusCode == '12') {
                appliedStatus = "Item in Warehouse"
            }

            if (req.body.statusCode == '35') {
                appliedStatus = "Out for Delivery"
            }

            if (req.body.statusCode == 'SD') {
                appliedStatus = "Swap Dispatchers"
            }

            if (req.body.statusCode == 'NC') {
                appliedStatus = "Order Delivery Confirmation"
            }

            if (req.body.statusCode == 'CSSC') {
                appliedStatus = "Self Collect/Drop Off"
            }

            if (req.body.statusCode == 'CD') {
                appliedStatus = "Cancelled"
            }

            if (req.body.statusCode == 'AJ') {
                appliedStatus = "Return to Warehouse from Cancelled"
            }

            if (req.body.statusCode == 'AJN') {
                appliedStatus = "Reactivate Job with new tracking number"
            }

            if (req.body.statusCode == '47') {
                appliedStatus = "Dispose Parcel"
            }

            if (req.body.statusCode == 'SFJ') {
                appliedStatus = "Clear Job"
            }

            if ((req.body.statusCode == 'IR') || (req.body.statusCode == 'CP') || (req.body.statusCode == 'DC') || (req.body.statusCode == 38) || (req.body.statusCode == 35) || (req.body.statusCode == 'SD')
                || (req.body.statusCode == 'NC') || (req.body.statusCode == 'CSSC') || (req.body.statusCode == 'AJ') || (req.body.statusCode == 47)
                || (req.body.statusCode == 'SFJ') || (req.body.statusCode == 'FA') || (req.body.statusCode == 'AJN') || (req.body.statusCode == 'UW') || (req.body.statusCode == 'UP')
                || (req.body.statusCode == 'UD') || (req.body.statusCode == 'UAR') || (req.body.statusCode == 'UAS') || (req.body.statusCode == 'UPN')
                || (req.body.statusCode == 'URN') || (req.body.statusCode == 'UPC') || (req.body.statusCode == 'UAB') || (req.body.statusCode == 'UJM')
                || (req.body.statusCode == 'UWL') || (req.body.statusCode == 'UFM') || (req.body.statusCode == 'UGR')
                || (req.body.statusCode == 'FCC') || (req.body.statusCode == 'FSC') || (req.body.statusCode == 'FIA')) {

                filter = { doTrackingNumber: consignmentID };
                // Determine if there's an existing document in MongoDB
                existingOrder = await ORDERS.findOne({ doTrackingNumber: consignmentID });
            }

            if (req.body.statusCode == 'CD') {
                if ((product == 'CBSL') || (product == 'GRP')) {
                    if (data.data.status == 'info_recv') {
                        filter = { doTrackingNumber: data.data.tracking_number };
                        // Determine if there's an existing document in MongoDB
                        existingOrder = await ORDERS.findOne({ doTrackingNumber: data.data.tracking_number });
                    } else {
                        filter = { doTrackingNumber: consignmentID };
                        // Determine if there's an existing document in MongoDB
                        existingOrder = await ORDERS.findOne({ doTrackingNumber: consignmentID });
                    }
                } else {
                    filter = { doTrackingNumber: consignmentID };
                    // Determine if there's an existing document in MongoDB
                    existingOrder = await ORDERS.findOne({ doTrackingNumber: consignmentID });
                }
            }

            if (req.body.statusCode == 12) {
                if ((product == 'CBSL') || (product == 'GRP')) {
                    filter = { doTrackingNumber: data.data.tracking_number };
                    // Determine if there's an existing document in MongoDB
                    existingOrder = await ORDERS.findOne({ doTrackingNumber: data.data.tracking_number });
                } else {
                    filter = { doTrackingNumber: consignmentID };
                    // Determine if there's an existing document in MongoDB
                    existingOrder = await ORDERS.findOne({ doTrackingNumber: consignmentID });
                }
            }

            var option = { upsert: false, new: false };

            if (product == 'BB') {
                currentProduct = 'bb'
            }

            if (product == 'PURE51') {
                currentProduct = 'pure51'
            }

            if (product == 'CBSL') {
                currentProduct = 'cbsl'
            }

            if (product == 'FCAS') {
                currentProduct = 'fcas'
            }

            if (product == 'GRP') {
                currentProduct = 'grp'
            }

            if (product == 'JPMC') {
                currentProduct = 'pharmacyjpmc'
            }

            if (product == 'LD') {
                currentProduct = 'localdelivery'
            }

            if (product == 'MOH') {
                currentProduct = 'pharmacymoh'
            }

            if (product == 'PHC') {
                currentProduct = 'pharmacyphc'
            }

            if (product == 'LDJB') {
                currentProduct = 'localdeliveryjb'
            }

            if (product == 'ICARUS') {
                currentProduct = 'icarus'
            }

            if (product == 'EWE') {
                currentProduct = 'ewe'
            }

            if (product == 'EWENS') {
                currentProduct = 'ewens'
            }

            if (product == 'TEMU') {
                currentProduct = 'temu'
            }

            if (product == 'KPTDF') {
                currentProduct = 'kptdf'
            }

            if (product == 'KPTDP') {
                currentProduct = 'kptdp'
            }

            if (product == 'PDU') {
                currentProduct = 'pdu'
            }

            if (product == 'MGLOBAL') {
                currentProduct = 'mglobal'
            }

            if (product == 'GDEX') {
                currentProduct = 'gdex'
            }

            if (product == 'GDEXT') {
                currentProduct = 'gdext'
            }

            address = data.data.address.toUpperCase();

            if (address.includes("MANGGIS") == true) { area = "B", kampong = "MANGGIS" }
            else if (address.includes("DELIMA") == true) { area = "B", kampong = "DELIMA" }
            else if (address.includes("ANGGREK DESA") == true) { area = "B", kampong = "ANGGREK DESA" }
            else if (address.includes("ANGGREK") == true) { area = "B", kampong = "ANGGREK DESA" }
            else if (address.includes("PULAIE") == true) { area = "B", kampong = "PULAIE" }
            else if (address.includes("LAMBAK") == true) { area = "B", kampong = "LAMBAK" }
            else if (address.includes("TERUNJING") == true) { area = "B", kampong = "TERUNJING" }
            else if (address.includes("MADANG") == true) { area = "B", kampong = "MADANG" }
            else if (address.includes("AIRPORT") == true) { area = "B", kampong = "AIRPORT" }
            else if (address.includes("ORANG KAYA BESAR IMAS") == true) { area = "B", kampong = "OKBI" }
            else if (address.includes("OKBI") == true) { area = "B", kampong = "OKBI" }
            else if (address.includes("SERUSOP") == true) { area = "B", kampong = "SERUSOP" }
            else if (address.includes("BURONG PINGAI") == true) { area = "B", kampong = "BURONG PINGAI" }
            else if (address.includes("SETIA NEGARA") == true) { area = "B", kampong = "SETIA NEGARA" }
            else if (address.includes("PASIR BERAKAS") == true) { area = "B", kampong = "PASIR BERAKAS" }
            else if (address.includes("MENTERI BESAR") == true) { area = "B", kampong = "MENTERI BESAR" }
            else if (address.includes("KEBANGSAAN LAMA") == true) { area = "B", kampong = "KEBANGSAAN LAMA" }
            else if (address.includes("BATU MARANG") == true) { area = "B", kampong = "BATU MARANG" }
            else if (address.includes("DATO GANDI") == true) { area = "B", kampong = "DATO GANDI" }
            else if (address.includes("KAPOK") == true) { area = "B", kampong = "KAPOK" }
            else if (address.includes("KOTA BATU") == true) { area = "B", kampong = "KOTA BATU" }
            else if (address.includes("MENTIRI") == true) { area = "B", kampong = "MENTIRI" }
            else if (address.includes("MERAGANG") == true) { area = "B", kampong = "MERAGANG" }
            else if (address.includes("PELAMBAIAN") == true) { area = "B", kampong = "PELAMBAIAN" }
            else if (address.includes("PINTU MALIM") == true) { area = "B", kampong = "PINTU MALIM" }
            else if (address.includes("SALAMBIGAR") == true) { area = "B", kampong = "SALAMBIGAR" }
            else if (address.includes("SALAR") == true) { area = "B", kampong = "SALAR" }
            else if (address.includes("SERASA") == true) { area = "B", kampong = "SERASA" }
            else if (address.includes("SERDANG") == true) { area = "B", kampong = "SERDANG" }
            else if (address.includes("SUNGAI BASAR") == true) { area = "B", kampong = "SUNGAI BASAR" }
            else if (address.includes("SG BASAR") == true) { area = "B", kampong = "SUNGAI BASAR" }
            else if (address.includes("SUNGAI BELUKUT") == true) { area = "B", kampong = "SUNGAI BELUKUT" }
            else if (address.includes("SG BELUKUT") == true) { area = "B", kampong = "SUNGAI BELUKUT" }
            else if (address.includes("SUNGAI HANCHING") == true) { area = "B", kampong = "SUNGAI HANCHING" }
            else if (address.includes("SG HANCHING") == true) { area = "B", kampong = "SUNGAI HANCHING" }
            else if (address.includes("SUNGAI TILONG") == true) { area = "B", kampong = "SUNGAI TILONG" }
            else if (address.includes("SG TILONG") == true) { area = "B", kampong = "SUNGAI TILONG" }
            else if (address.includes("SUBOK") == true) { area = "B", kampong = "SUBOK" }
            else if (address.includes("SUNGAI AKAR") == true) { area = "B", kampong = "SUNGAI AKAR" }
            else if (address.includes("SG AKAR") == true) { area = "B", kampong = "SUNGAI AKAR" }
            else if (address.includes("SUNGAI BULOH") == true) { area = "B", kampong = "SUNGAI BULOH" }
            else if (address.includes("SG BULOH") == true) { area = "B", kampong = "SUNGAI BULOH" }
            else if (address.includes("TANAH JAMBU") == true) { area = "B", kampong = "TANAH JAMBU" }
            else if (address.includes("SUNGAI OROK") == true) { area = "B", kampong = "SUNGAI OROK" }
            else if (address.includes("SG OROK") == true) { area = "B", kampong = "SUNGAI OROK" }
            else if (address.includes("KATOK") == true) { area = "G", kampong = "KATOK" }
            else if (address.includes("MATA-MATA") == true) { area = "G", kampong = "MATA-MATA" }
            else if (address.includes("MATA MATA") == true) { area = "G", kampong = "MATA-MATA" }
            else if (address.includes("RIMBA") == true) { area = "G", kampong = "RIMBA" }
            else if (address.includes("TUNGKU") == true) { area = "G", kampong = "TUNGKU" }
            else if (address.includes("UBD") == true) { area = "G", kampong = "UBD" }
            else if (address.includes("UNIVERSITI BRUNEI DARUSSALAM") == true) { area = "G", kampong = "UBD" }
            else if (address.includes("JIS") == true) { area = "G" }
            else if (address.includes("JERUDONG INTERNATIONAL SCHOOL") == true) { area = "G", kampong = "JIS" }
            else if (address.includes("BERANGAN") == true) { area = "G", kampong = "BERANGAN" }
            else if (address.includes("BERIBI") == true) { area = "G", kampong = "BERIBI" }
            else if (address.includes("KIULAP") == true) { area = "G", kampong = "KIULAP" }
            else if (address.includes("RIPAS") == true) { area = "G", kampong = "RIPAS" }
            else if (address.includes("RAJA ISTERI PENGIRAN ANAK SALLEHA") == true) { area = "G", kampong = "RIPAS" }
            else if (address.includes("KIARONG") == true) { area = "G", kampong = "KIARONG" }
            else if (address.includes("PUSAR ULAK") == true) { area = "G", kampong = "PUSAR ULAK" }
            else if (address.includes("KUMBANG PASANG") == true) { area = "G", kampong = "KUMBANG PASANG" }
            else if (address.includes("MENGLAIT") == true) { area = "G", kampong = "MENGLAIT" }
            else if (address.includes("MABOHAI") == true) { area = "G", kampong = "MABOHAI" }
            else if (address.includes("ONG SUM PING") == true) { area = "G", kampong = "ONG SUM PING" }
            else if (address.includes("GADONG") == true) { area = "G", kampong = "GADONG" }
            else if (address.includes("TASEK LAMA") == true) { area = "G", kampong = "TASEK LAMA" }
            else if (address.includes("BANDAR TOWN") == true) { area = "G", kampong = "BANDAR TOWN" }
            else if (address.includes("BATU SATU") == true) { area = "JT", kampong = "BATU SATU" }
            else if (address.includes("BENGKURONG") == true) { area = "JT", kampong = "BENGKURONG" }
            else if (address.includes("BUNUT") == true) { area = "JT", kampong = "BUNUT" }
            else if (address.includes("JALAN BABU RAJA") == true) { area = "JT", kampong = "JALAN BABU RAJA" }
            else if (address.includes("JALAN ISTANA") == true) { area = "JT", kampong = "JALAN ISTANA" }
            else if (address.includes("JUNJONGAN") == true) { area = "JT", kampong = "JUNJONGAN" }
            else if (address.includes("KASAT") == true) { area = "JT", kampong = "KASAT" }
            else if (address.includes("LUMAPAS") == true) { area = "JT", kampong = "LUMAPAS" }
            else if (address.includes("JALAN HALUS") == true) { area = "JT", kampong = "JALAN HALUS" }
            else if (address.includes("MADEWA") == true) { area = "JT", kampong = "MADEWA" }
            else if (address.includes("PUTAT") == true) { area = "JT", kampong = "PUTAT" }
            else if (address.includes("SINARUBAI") == true) { area = "JT", kampong = "SINARUBAI" }
            else if (address.includes("TASEK MERADUN") == true) { area = "JT", kampong = "TASEK MERADUN" }
            else if (address.includes("TELANAI") == true) { area = "JT", kampong = "TELANAI" }
            else if (address.includes("BAN 1") == true) { area = "JT", kampong = "BAN" }
            else if (address.includes("BAN 2") == true) { area = "JT", kampong = "BAN" }
            else if (address.includes("BAN 3") == true) { area = "JT", kampong = "BAN" }
            else if (address.includes("BAN 4") == true) { area = "JT", kampong = "BAN" }
            else if (address.includes("BAN 5") == true) { area = "JT", kampong = "BAN" }
            else if (address.includes("BAN 6") == true) { area = "JT", kampong = "BAN" }
            else if (address.includes("BATONG") == true) { area = "JT", kampong = "BATONG" }
            else if (address.includes("BATU AMPAR") == true) { area = "JT", kampong = "BATU AMPAR" }
            else if (address.includes("BEBATIK") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
            else if (address.includes("BEBULOH") == true) { area = "JT", kampong = "BEBULOH" }
            else if (address.includes("BEBATIK KILANAS") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
            else if (address.includes("KILANAS") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
            else if (address.includes("DADAP") == true) { area = "JT", kampong = "DADAP" }
            else if (address.includes("KUALA LURAH") == true) { area = "JT", kampong = "KUALA LURAH" }
            else if (address.includes("KULAPIS") == true) { area = "JT", kampong = "KULAPIS" }
            else if (address.includes("LIMAU MANIS") == true) { area = "JT", kampong = "LIMAU MANIS" }
            else if (address.includes("MASIN") == true) { area = "JT", kampong = "MASIN" }
            else if (address.includes("MULAUT") == true) { area = "JT", kampong = "MULAUT" }
            else if (address.includes("PANCHOR MURAI") == true) { area = "JT", kampong = "PANCHOR MURAI" }
            else if (address.includes("PANCHUR MURAI") == true) { area = "JT", kampong = "PANCHOR MURAI" }
            else if (address.includes("PANGKALAN BATU") == true) { area = "JT", kampong = "PANGKALAN BATU" }
            else if (address.includes("PASAI") == true) { area = "JT", kampong = "PASAI" }
            else if (address.includes("WASAN") == true) { area = "JT", kampong = "WASAN" }
            else if (address.includes("PARIT") == true) { area = "JT", kampong = "PARIT" }
            else if (address.includes("EMPIRE") == true) { area = "JT", kampong = "EMPIRE" }
            else if (address.includes("JANGSAK") == true) { area = "JT", kampong = "JANGSAK" }
            else if (address.includes("JERUDONG") == true) { area = "JT", kampong = "JERUDONG" }
            else if (address.includes("KATIMAHAR") == true) { area = "JT", kampong = "KATIMAHAR" }
            else if (address.includes("LUGU") == true) { area = "JT", kampong = "LUGU" }
            else if (address.includes("SENGKURONG") == true) { area = "JT", kampong = "SENGKURONG" }
            else if (address.includes("TANJONG NANGKA") == true) { area = "JT", kampong = "TANJONG NANGKA" }
            else if (address.includes("TANJONG BUNUT") == true) { area = "JT", kampong = "TANJONG BUNUT" }
            else if (address.includes("TANJUNG BUNUT") == true) { area = "JT", kampong = "TANJONG BUNUT" }
            else if (address.includes("SUNGAI TAMPOI") == true) { area = "JT", kampung = "SUNGAI TAMPOI" }
            else if (address.includes("SG TAMPOI") == true) { area = "JT", kampong = "SUNGAI TAMPOI" }
            else if (address.includes("MUARA") == true) { area = "B", kampong = "MUARA" }
            //TU
            else if (address.includes("SENGKARAI") == true) { area = "TUTONG", kampong = "SENGKARAI" }
            else if (address.includes("PANCHOR") == true) { area = "TUTONG", kampong = "PANCHOR" }
            else if (address.includes("PENABAI") == true) { area = "TUTONG", kampong = "PENABAI" }
            else if (address.includes("KUALA TUTONG") == true) { area = "TUTONG", kampong = "KUALA TUTONG" }
            else if (address.includes("PENANJONG") == true) { area = "TUTONG", kampong = "PENANJONG" }
            else if (address.includes("KERIAM") == true) { area = "TUTONG", kampong = "KERIAM" }
            else if (address.includes("BUKIT PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
            else if (address.includes("PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
            else if (address.includes("LUAGAN") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
            else if (address.includes("DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
            else if (address.includes("LUAGAN DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
            else if (address.includes("SINAUT") == true) { area = "TUTONG", kampong = "SINAUT" }
            else if (address.includes("SUNGAI KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
            else if (address.includes("KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
            else if (address.includes("SG KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
            else if (address.includes("KUPANG") == true) { area = "TUTONG", kampong = "KUPANG" }
            else if (address.includes("KIUDANG") == true) { area = "TUTONG", kampong = "KIUDANG" }
            else if (address.includes("PAD") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
            else if (address.includes("NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
            else if (address.includes("PAD NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
            else if (address.includes("BEKIAU") == true) { area = "TUTONG", kampong = "BEKIAU" }
            else if (address.includes("MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
            else if (address.includes("PENGKALAN MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
            else if (address.includes("BATANG MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
            else if (address.includes("MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
            else if (address.includes("KEBIA") == true) { area = "TUTONG", kampong = "KEBIA" }
            else if (address.includes("BIRAU") == true) { area = "TUTONG", kampong = "BIRAU" }
            else if (address.includes("LAMUNIN") == true) { area = "TUTONG", kampong = "LAMUNIN" }
            else if (address.includes("LAYONG") == true) { area = "TUTONG", kampong = "LAYONG" }
            else if (address.includes("MENENGAH") == true) { area = "TUTONG", kampong = "MENENGAH" }
            else if (address.includes("PANCHONG") == true) { area = "TUTONG", kampong = "PANCHONG" }
            else if (address.includes("PENAPAR") == true) { area = "TUTONG", kampong = "PANAPAR" }
            else if (address.includes("TANJONG MAYA") == true) { area = "TUTONG", kampong = "TANJONG MAYA" }
            else if (address.includes("MAYA") == true) { area = "TUTONG", kampong = "MAYA" }
            else if (address.includes("LUBOK") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
            else if (address.includes("PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
            else if (address.includes("LUBOK PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
            else if (address.includes("BUKIT UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
            else if (address.includes("UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
            else if (address.includes("RAMBAI") == true) { area = "TUTONG", kampong = "RAMBAI" }
            else if (address.includes("BENUTAN") == true) { area = "TUTONG", kampong = "BENUTAN" }
            else if (address.includes("MERIMBUN") == true) { area = "TUTONG", kampong = "MERIMBUN" }
            else if (address.includes("UKONG") == true) { area = "TUTONG", kampong = "UKONG" }
            else if (address.includes("LONG") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
            else if (address.includes("MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
            else if (address.includes("LONG MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
            else if (address.includes("TELISAI") == true) { area = "TUTONG", kampong = "TELISAI" }
            else if (address.includes("DANAU") == true) { area = "TUTONG", kampong = "DANAU" }
            else if (address.includes("BUKIT BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
            else if (address.includes("BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
            else if (address.includes("TUTONG") == true) { area = "TUTONG", kampong = "TUTONG" }
            //KB
            else if (address.includes("AGIS") == true) { area = "LUMUT", kampong = "AGIS" }
            else if (address.includes("ANDALAU") == true) { area = "LUMUT", kampong = "ANDALAU" }
            else if (address.includes("ANDUKI") == true) { area = "LUMUT", kampong = "ANDUKI" }
            else if (address.includes("APAK") == true) { area = "KB / SERIA", kampong = "APAK" }
            else if (address.includes("BADAS") == true) { area = "LUMUT", kampong = "BADAS" }
            else if (address.includes("BANG") == true) { area = "KB / SERIA", kampong = "BANG" }
            else if (address.includes("GARANG") == true) { area = "KB / SERIA", kampong = "GARANG" }
            else if (address.includes("PUKUL") == true) { area = "KB / SERIA", kampong = "PUKUL" }
            else if (address.includes("TAJUK") == true) { area = "KB / SERIA", kampong = "TAJUK" }
            else if (address.includes("BENGERANG") == true) { area = "KB / SERIA", kampong = "BENGERANG" }
            else if (address.includes("BIADONG") == true) { area = "KB / SERIA", kampong = "BIADONG" }
            else if (address.includes("ULU") == true) { area = "KB / SERIA", kampong = "ULU" }
            else if (address.includes("TENGAH") == true) { area = "KB / SERIA", kampong = "TENGAH" }
            else if (address.includes("BISUT") == true) { area = "KB / SERIA", kampong = "BISUT" }
            else if (address.includes("BUAU") == true) { area = "KB / SERIA", kampong = "BUAU" }
            else if (address.includes("KANDOL") == true) { area = "KB / SERIA", kampong = "KANDOL" }
            else if (address.includes("PUAN") == true) { area = "KB / SERIA", kampong = "PUAN" }
            else if (address.includes("TUDING") == true) { area = "LUMUT", kampong = "TUDING" }
            else if (address.includes("SAWAT") == true) { area = "KB / SERIA", kampong = "SAWAT" }
            else if (address.includes("SERAWONG") == true) { area = "KB / SERIA", kampong = "SERAWONG" }
            else if (address.includes("CHINA") == true) { area = "KB / SERIA", kampong = "CHINA" }
            else if (address.includes("DUGUN") == true) { area = "KB / SERIA", kampong = "DUGUN" }
            else if (address.includes("GATAS") == true) { area = "KB / SERIA", kampong = "GATAS" }
            else if (address.includes("JABANG") == true) { area = "KB / SERIA", kampong = "JABANG" }
            else if (address.includes("KAGU") == true) { area = "KB / SERIA", kampong = "KAGU" }
            else if (address.includes("KAJITAN") == true) { area = "KB / SERIA", kampong = "KAJITAN" }
            else if (address.includes("KELUYOH") == true) { area = "KB / SERIA", kampong = "KELUYOH" }
            else if (address.includes("KENAPOL") == true) { area = "KB / SERIA", kampong = "KENAPOL" }
            else if (address.includes("KUALA BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
            else if (address.includes("BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
            else if (address.includes("KUALA BELAIT") == true) { area = "KB", kampong = "KUALA BELAIT" }
            else if (address.includes("KUKUB") == true) { area = "KB / SERIA", kampong = "KUKUB" }
            else if (address.includes("LABI") == true) { area = "LUMUT", kampong = "LABI" }
            else if (address.includes("LAKANG") == true) { area = "KB / SERIA", kampong = "LAKANG" }
            else if (address.includes("LAONG ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
            else if (address.includes("ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
            else if (address.includes("LAONG") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
            else if (address.includes("LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
            else if (address.includes("SUNGAI LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
            else if (address.includes("SG LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
            else if (address.includes("LUMUT") == true) { area = "LUMUT", kampong = "LUMUT" }
            else if (address.includes("LORONG") == true) { area = "SERIA", kampong = "LORONG" }
            else if (address.includes("LORONG TENGAH") == true) { area = "SERIA", kampong = "LORONG TENGAH" }
            else if (address.includes("LORONG TIGA SELATAN") == true) { area = "SERIA", kampong = "LORONG TIGA SELATAN" }
            else if (address.includes("LILAS") == true) { area = "KB / SERIA", kampong = "LILAS" }
            else if (address.includes("LUBUK LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
            else if (address.includes("LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
            else if (address.includes("LUBUK TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
            else if (address.includes("TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
            else if (address.includes("MALA'AS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
            else if (address.includes("MALAAS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
            else if (address.includes("MALAYAN") == true) { area = "KB / SERIA", kampong = "MELAYAN" }
            else if (address.includes("MELAYU") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
            else if (address.includes("ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
            else if (address.includes("MELAYU ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
            else if (address.includes("MELILAS") == true) { area = "LUMUT", kampong = "MELILAS" }
            else if (address.includes("MENDARAM") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
            else if (address.includes("MENDARAM BESAR") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
            else if (address.includes("MENDARAM KECIL") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
            else if (address.includes("MERANGKING") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
            else if (address.includes("MERANGKING ULU") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
            else if (address.includes("MERANGKING HILIR") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
            else if (address.includes("MUMONG") == true) { area = "KB", kampong = "MUMONG" }
            else if (address.includes("PANDAN") == true) { area = "KB", kampong = "PANDAN" }
            else if (address.includes("PADANG") == true) { area = "KB", kampong = "PADANG" }
            else if (address.includes("PANAGA") == true) { area = "SERIA", kampong = "PANAGA" }
            else if (address.includes("PENGKALAN SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
            else if (address.includes("SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
            else if (address.includes("PENGALAYAN") == true) { area = "KB / SERIA", kampong = "PENGALAYAN" }
            else if (address.includes("PENYRAP") == true) { area = "KB / SERIA", kampong = "PENYRAP" }
            else if (address.includes("PERANGKONG") == true) { area = "KB / SERIA", kampong = "PERANGKONG" }
            else if (address.includes("PERUMPONG") == true) { area = "LUMUT", kampong = "PERUMPONG" }
            else if (address.includes("PESILIN") == true) { area = "KB / SERIA", kampong = "PESILIN" }
            else if (address.includes("PULAU APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
            else if (address.includes("APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
            else if (address.includes("RAMPAYOH") == true) { area = "KB / SERIA", kampong = "RAMPAYOH" }
            else if (address.includes("RATAN") == true) { area = "KB / SERIA", kampong = "RATAN" }
            else if (address.includes("SAUD") == true) { area = "KB / SERIA", kampong = "SAUD" }
            //else if (address.includes("SIMPANG") == true) {area = "KB / SERIA", kampong = "SIMPANG TIGA"}
            else if (address.includes("SIMPANG TIGA") == true) { area = "LUMUT", kampong = "SIMPANG TIGA" }
            else if (address.includes("SINGAP") == true) { area = "KB / SERIA", kampong = "SINGAP" }
            else if (address.includes("SUKANG") == true) { area = "KB / SERIA", kampong = "SUKANG" }
            else if (address.includes("BAKONG") == true) { area = "LUMUT", kampong = "BAKONG" }
            else if (address.includes("DAMIT") == true) { area = "KB / SERIA", kampong = "DAMIT" }
            else if (address.includes("BERA") == true) { area = "KB / SERIA", kampong = "BERA" }
            else if (address.includes("DUHON") == true) { area = "KB / SERIA", kampong = "DUHON" }
            else if (address.includes("GANA") == true) { area = "LUMUT", kampong = "GANA" }
            else if (address.includes("HILIR") == true) { area = "KB / SERIA", kampong = "HILIR" }
            else if (address.includes("KANG") == true) { area = "LUMUT", kampong = "KANG" }
            else if (address.includes("KURU") == true) { area = "LUMUT", kampong = "KURU" }
            else if (address.includes("LALIT") == true) { area = "LUMUT", kampong = "LALIT" }
            else if (address.includes("LUTONG") == true) { area = "KB / SERIA", kampong = "LUTONG" }
            else if (address.includes("MAU") == true) { area = "KB / SERIA", kampong = "MAU" }
            else if (address.includes("MELILIT") == true) { area = "KB / SERIA", kampong = "MELILIT" }
            else if (address.includes("PETAI") == true) { area = "KB / SERIA", kampong = "PETAI" }
            else if (address.includes("TALI") == true) { area = "LUMUT", kampong = "TALI" }
            else if (address.includes("TARING") == true) { area = "LUMUT", kampong = "TARING" }
            else if (address.includes("TERABAN") == true) { area = "KB", kampong = "TERABAN" }
            else if (address.includes("UBAR") == true) { area = "KB / SERIA", kampong = "UBAR" }
            else if (address.includes("TANAJOR") == true) { area = "KB / SERIA", kampong = "TANAJOR" }
            else if (address.includes("TANJONG RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
            else if (address.includes("RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
            else if (address.includes("TANJONG SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
            else if (address.includes("SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
            else if (address.includes("TAPANG LUPAK") == true) { area = "KB / SERIA", kampong = "TAPANG LUPAK" }
            else if (address.includes("TARAP") == true) { area = "KB / SERIA", kampong = "TARAP" }
            else if (address.includes("TEMPINAK") == true) { area = "KB / SERIA", kampong = "TEMPINAK" }
            else if (address.includes("TERAJA") == true) { area = "KB / SERIA", kampong = "TERAJA" }
            else if (address.includes("TERAWAN") == true) { area = "KB / SERIA", kampong = "TERAWAN" }
            else if (address.includes("TERUNAN") == true) { area = "KB / SERIA", kampong = "TERUNAN" }
            else if (address.includes("TUGONG") == true) { area = "KB / SERIA", kampong = "TUGONG" }
            else if (address.includes("TUNGULLIAN") == true) { area = "LUMUT", kampong = "TUNGULLIAN" }
            else if (address.includes("UBOK") == true) { area = "KB / SERIA", kampong = "UBOK" }
            else if (address.includes("BELAIT") == true) { area = "KB / SERIA", kampong = "BELAIT" }
            else if (address.includes("SERIA") == true) { area = "KB / SERIA", kampong = "BELAIT" }
            //TE
            else if (address.includes("AMO") == true) { area = "TEMBURONG", kampong = "AMO" }
            else if (address.includes("AYAM-AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
            else if (address.includes("AYAM AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
            else if (address.includes("BAKARUT") == true) { area = "TEMBURONG", kampong = "BAKARUT" }
            else if (address.includes("BATANG DURI") == true) { area = "TEMBURONG", kampong = "BATANG DURI" }
            else if (address.includes("BATANG TUAU") == true) { area = "TEMBURONG", kampong = "BATANG TUAU" }
            else if (address.includes("BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
            else if (address.includes("APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
            else if (address.includes("BATU BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
            else if (address.includes("BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
            else if (address.includes("BELABAN") == true) { area = "TEMBURONG", kampong = "BELABAN" }
            else if (address.includes("BELAIS") == true) { area = "TEMBURONG", kampong = "BELAIS" }
            else if (address.includes("BELINGOS") == true) { area = "TEMBURONG", kampong = "BELINGOS" }
            else if (address.includes("BIANG") == true) { area = "TEMBURONG", kampong = "BIANG" }
            else if (address.includes("BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
            else if (address.includes("BUDA BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
            else if (address.includes("BUDA-BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
            else if (address.includes("GADONG BARU") == true) { area = "TEMBURONG", kampong = "GADONG BARU" }
            else if (address.includes("KENUA") == true) { area = "TEMBURONG", kampong = "KENUA" }
            else if (address.includes("LABU ESTATE") == true) { area = "TEMBURONG", kampong = "LABU" }
            else if (address.includes("LABU") == true) { area = "TEMBURONG", kampong = "LABU" }
            else if (address.includes("LAGAU") == true) { area = "TEMBURONG", kampong = "LAGAU" }
            else if (address.includes("LAKIUN") == true) { area = "TEMBURONG", kampong = "LAKIUN" }
            else if (address.includes("LAMALING") == true) { area = "TEMBURONG", kampong = "LAMALING" }
            else if (address.includes("LEPONG") == true) { area = "TEMBURONG", kampong = "LEPONG" }
            else if (address.includes("LUAGAN") == true) { area = "TEMBURONG", kampong = "LUAGAN" }
            else if (address.includes("MANIUP") == true) { area = "TEMBURONG", kampong = "MANIUP" }
            else if (address.includes("MENENGAH") == true) { area = "TEMBURONG", kampong = "MENGENGAH" }
            else if (address.includes("NEGALANG") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
            else if (address.includes("NEGALANG ERING") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
            else if (address.includes("NEGALANG UNAT") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
            else if (address.includes("PARIT") == true) { area = "TEMBURONG", kampong = "PARIT" }
            else if (address.includes("PARIT BELAYANG") == true) { area = "TEMBURONG", kampong = "PARIT BELAYANG" }
            else if (address.includes("PAYAU") == true) { area = "TEMBURONG", kampong = "PAYAU" }
            else if (address.includes("PELIUNAN") == true) { area = "TEMBURONG", kampong = "PELIUNAN" }
            else if (address.includes("PERDAYAN") == true) { area = "TEMBURONG", kampong = "PERDAYAN" }
            else if (address.includes("PIASAU-PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
            else if (address.includes("PIASAU PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
            else if (address.includes("PIUNGAN") == true) { area = "TEMBURONG", kampong = "PIUNGAN" }
            else if (address.includes("PUNI") == true) { area = "TEMBURONG", kampong = "PUNI" }
            else if (address.includes("RATAIE") == true) { area = "TEMBURONG", kampong = "RATAIE" }
            else if (address.includes("REBADA") == true) { area = "TEMBURONG", kampong = "REBADA" }
            else if (address.includes("SEKUROP") == true) { area = "TEMBURONG", kampong = "SEKUROP" }
            else if (address.includes("SELANGAN") == true) { area = "TEMBURONG", kampong = "SELANGAN" }
            else if (address.includes("SELAPON") == true) { area = "TEMBURONG", kampong = "SELAPON" }
            else if (address.includes("SEMABAT") == true) { area = "TEMBURONG", kampong = "SEMABAT" }
            else if (address.includes("SEMAMAMNG") == true) { area = "TEMBURONG", kampong = "SEMAMANG" }
            else if (address.includes("SENUKOH") == true) { area = "TEMBURONG", kampong = "SENUKOH" }
            else if (address.includes("SERI TANJONG BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
            else if (address.includes("BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
            else if (address.includes("SIBULU") == true) { area = "TEMBURONG", kampong = "SIBULU" }
            else if (address.includes("SIBUT") == true) { area = "TEMBURONG", kampong = "SIBUT" }
            else if (address.includes("SIMBATANG BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
            else if (address.includes("SIMBATANG BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
            else if (address.includes("SUBOK") == true) { area = "TEMBURONG", kampong = "SUBOK" }
            else if (address.includes("SUMBILING") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
            else if (address.includes("SUMBILING BARU") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
            else if (address.includes("SUMBILING LAMA") == true) { area = "TEMBURONG", kampong = "SUMBILING LAMA" }
            else if (address.includes("SUNGAI RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
            else if (address.includes("SG RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
            else if (address.includes("SUNGAI SULOK") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
            else if (address.includes("SG SULOK ") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
            else if (address.includes("SUNGAI TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
            else if (address.includes("SG TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
            else if (address.includes("SUNGAI TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
            else if (address.includes("SG TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
            else if (address.includes("TANJONG BUNGAR") == true) { area = "TEMBURONG", kampong = "TANJONG BUNGAR" }
            else if (address.includes("TEMADA") == true) { area = "TEMBURONG", kampong = "TEMADA" }
            else if (address.includes("UJONG JALAN") == true) { area = "TEMBURONG", kampong = "UJONG JALAN" }
            else if (address.includes("BANGAR") == true) { area = "TEMBURONG", kampong = "BANGAR" }
            else if (address.includes("TEMBURONG") == true) { area = "TEMBURONG" }
            else { area = "N/A" }

            if (data.data.zone != null) {
                finalArea = data.data.zone;
            } else {
                finalArea = area;
            }

            if (req.body.statusCode == 'FA') {
                /* update = {
                    area: finalArea
                }

                var detrackUpdateData = {
                    do_number: consignmentID,
                    data: {
                        zone: finalArea // Use the calculated dStatus
                    }
                };

                mongoDBrun = 2;
                DetrackAPIrun = 1; */

                /* update = {
                    product: "ewe"
                }

                mongoDBrun = 2; */

                /* newOrder = new ORDERS({
                    area: area,
                    items: itemsArray, // Use the dynamically created items array
                    attempt: data.data.attempt,
                    history: [{
                        statusHistory: "At Warehouse",
                        dateUpdated: moment().format(),
                        updatedBy: req.user.name,
                        lastAssignedTo: "N/A",
                        reason: "N/A",
                        lastLocation: req.body.warehouse,
                    }],
                    lastAssignedTo: "N/A",
                    latestLocation: req.body.warehouse,
                    product: currentProduct,
                    assignedTo: "N/A",
                    senderName: data.data.job_owner,
                    totalPrice: data.data.total_price,
                    receiverName: data.data.deliver_to_collect_from,
                    trackingLink: data.data.tracking_link,
                    currentStatus: "At Warehouse",
                    paymentMethod: data.data.payment_mode,
                    warehouseEntry: "Yes",
                    warehouseEntryDateTime: moment().format(),
                    receiverAddress: data.data.address,
                    receiverPhoneNumber: finalPhoneNum,
                    doTrackingNumber: consignmentID,
                    remarks: data.data.remarks,
                    latestReason: "N/A",
                    lastUpdateDateTime: moment().format(),
                    creationDate: data.data.created_at,
                    jobDate: "N/A",
                    flightDate: data.data.job_received_date,
                    mawbNo: data.data.run_number,
                    lastUpdatedBy: req.user.name,
                    parcelWeight: data.data.weight,
                    receiverPostalCode: postalCode,
                    jobType: data.data.type,
                    jobMethod: data.data.job_type,
                }); */

                /* update = {
                    currentStatus: "Return to Warehouse",
                    lastUpdateDateTime: moment().format(),
                    instructions: "Failed delivery due to Safwan MC",
                    assignedTo: "N/A",
                    latestReason: "Failed delivery due to Safwan MC",
                    attempt: data.data.attempt,
                    $push: {
                        history: {
                            statusHistory: "Failed Delivery",
                            dateUpdated: moment().format(),
                            updatedBy:  req.user.name,
                            lastAssignedTo: data.data.assign_to,
                            reason: "Failed delivery due to Safwan MC",
                        },
                        history: {
                            statusHistory: "Return to Warehouse",
                            dateUpdated: moment().format(),
                            updatedBy:  req.user.name,
                            lastAssignedTo: "N/A",
                            reason: "N/A",
                        }
                    }
                }
    
                var detrackUpdateData = {
                    do_number: consignmentID,
                    data: {
                        status: "at_warehouse" // Use the calculated dStatus
                    }
                };
    
                if (data.data.payment_mode == null) {
                    if ((data.data.total_price == null) || (data.data.total_price == 0)) {
                        if ((data.data.payment_amount == null) || (data.data.payment_amount == 0)) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    payment_mode: "NON COD",
                                    total_price: 0,
                                    payment_amount: 0
                                }
                            };
    
                            update = {
                                paymentMethod: "NON COD",
                                totalPrice: 0
                            }
    
                        } else {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    payment_mode: "COD",
                                    total_price: data.data.payment_amount,
                                }
                            };
    
                            update = {
                                paymentMethod: "COD",
                                totalPrice: data.data.payment_amount
                            }
                        }
                    } else {
                        if ((data.data.payment_amount == null) || (data.data.payment_amount == 0)) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    payment_mode: "BT",
                                    payment_amount: 0
                                }
                            };
    
                            update = {
                                paymentMethod: "BT",
                            }
                        } else {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    payment_mode: "COD"
                                }
                            };
    
                            update = {
                                paymentMethod: "COD",
                            }
                        }
                    }
    
                } else if (((data.data.payment_mode.includes("BT")) && (data.data.payment_mode.includes("CASH")))
                    || ((data.data.payment_mode.includes("BT")) && (data.data.payment_mode.includes("Cash")))
                    || ((data.data.payment_mode.includes("BT")) && (data.data.payment_mode.includes("COD")))) {
    
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            payment_mode: "COD, BT",
                        }
                    };
    
                    update = {
                        paymentMethod: "COD, BT",
                    }
    
                } else if (data.data.payment_mode.includes("Bill")) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            payment_mode: "BT",
                        }
                    };
    
                    update = {
                        paymentMethod: "BT",
                    }
    
                } else if ((data.data.payment_mode == "Cash") || (data.data.payment_mode == "CASH") || (data.data.payment_mode == "COD")) {
                    if ((data.data.total_price == null) || (data.data.total_price == 0)) {
                        if ((data.data.payment_amount == null) || (data.data.payment_amount == 0)) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    payment_mode: "NON COD",
                                    total_price: 0,
                                    payment_amount: 0
                                }
                            };
    
                            update = {
                                paymentMethod: "NON COD",
                                totalPrice: 0
                            }
                        } else {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    payment_mode: "COD",
                                    total_price: data.data.payment_amount,
                                }
                            };
    
                            update = {
                                paymentMethod: "COD",
                                totalPrice: data.data.payment_amount
                            }
                        }
                    }
    
                } else if (data.data.payment_mode == "BT") {
                    if ((data.data.total_price == null) || (data.data.total_price == 0)) {
                        if ((data.data.payment_amount == null) || (data.data.payment_amount == 0)) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    payment_mode: "NON COD",
                                    total_price: 0,
                                    payment_amount: 0
                                }
                            };
    
                            update = {
                                paymentMethod: "NON COD",
                                totalPrice: 0
                            }
                        } else {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    payment_mode: "COD",
                                    total_price: data.data.payment_amount,
                                }
                            };
    
                            update = {
                                paymentMethod: "COD",
                                totalPrice: data.data.payment_amount
                            }
                        }
                    } else {
                        if ((data.data.payment_amount == null) || (data.data.payment_amount == 0)) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    payment_mode: "BT",
                                    payment_amount: 0
                                }
                            };
    
                            update = {
                                paymentMethod: "BT",
                            }
                        } else {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    payment_mode: "COD"
                                }
                            };
    
                            update = {
                                paymentMethod: "COD",
                            }
                        }
                    }
                } */

                /* var detrackUpdateData = {
                    do_number: consignmentID,
                    data: {
                        zone: area,
                    }
                };

                update = {
                    area: area
                } */

                /* update = {
                    paymentMethod: "Cash",
                    totalPrice: data.data.payment_amount,
                    paymentAmount: data.data.payment_amount,
                } */

                var detrackUpdateData = {
                    do_number: consignmentID,
                    data: {
                        status: "custom_clearing",
                        updated_at: "2025-11-21T09:20:08.773+08:00",
                        milestones: [
                            {
                                "status": "custom_clearing",
                                "assign_to": null,
                                "reason": null,
                                "pod_at": "2025-11-21T09:20:08.773+08:00",
                                "created_at": "2025-11-21T09:20:08.773+08:00",
                                "user_name": "IT Support"
                            }
                        ]
                        /* total_price: data.data.payment_amount,
                        payment_mode: "Cash" */
                    }
                };

                /* mongoDBrun = 2; */

                DetrackAPIrun = 1;

                portalUpdate = "Portal updated for missing data. ";
                appliedStatus = "Missing data update"

                completeRun = 1;
            }

            /* if ((req.body.statusCode == 'IR') && (data.data.status == 'info_recv')) {
                if (existingOrder === null) {
                    if (product == 'TEMU') {
                        if (data.data.type == 'Collection') {
                            newOrder = new ORDERS({
                                area: area,
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Info Received",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastLocation: "Customer",
                                }],
                                latestLocation: "Customer",
                                product: currentProduct,
                                senderName: "TEMU",
                                totalPrice: 0,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Info Received",
                                paymentMethod: "NON COD",
                                warehouseEntry: "No",
                                warehouseEntryDateTime: "N/A",
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                lastUpdatedBy: req.user.name,
                                receiverPostalCode: postalCode,
                                jobType: data.data.type,
                                jobMethod: data.data.job_type,
                            });

                            portalUpdate = "Order/job added. Portal status updated to Info Received. ";

                            mongoDBrun = 1;
                            completeRun = 1;
                        }
                    }
                }
            } */

            if ((req.body.statusCode == 'CP') && (data.data.status == 'info_recv') && (data.data.run_number != null)) {
                if ((product == 'PDU') || (product == 'MGLOBAL') || (product == 'EWE') || (product == 'GDEX') || (product == 'GDEXT')) {
                    update = {
                        currentStatus: "Custom Clearing",
                        lastUpdateDateTime: moment().format(),
                        latestLocation: "Brunei Customs",
                        lastUpdatedBy: req.user.name,
                        $push: {
                            history: {
                                statusHistory: "Custom Clearing",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastLocation: "Brunei Customs",
                            }
                        }
                    }

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "on_hold"
                        }
                    };

                    portalUpdate = "Portal and Detrack status updated to Custom Clearing. ";

                    if ((product == 'GDEX') || (product == 'GDEXT')) {
                        GDEXAPIrun = 1;
                    }

                    mongoDBrun = 2;
                    DetrackAPIrun = 1;
                    completeRun = 1;
                }
            }

            if (req.body.statusCode == 12) {
                if (data.data.run_number != null) {
                    if ((data.data.status == 'on_hold') && (product == 'PDU')) { //From On Hold to Custom Clearance to At Warehouse to In Sorting Area
                        update = {
                            currentStatus: "At Warehouse",
                            lastUpdateDateTime: moment().format(),
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: moment().format(),
                            latestLocation: req.body.warehouse,
                            lastUpdatedBy: req.user.name,
                            $push: {
                                history: {
                                    $each: [
                                        {
                                            statusHistory: "Custom Clearance Release",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastLocation: "Brunei Customs",
                                        },
                                        {
                                            statusHistory: "At Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastLocation: req.body.warehouse,
                                        }
                                    ]
                                }
                            }
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "", // Use the calculated dStatus
                                zone: finalArea,
                            }
                        };

                        mongoDBrun = 2;
                        DetrackAPIrun = 8;
                        completeRun = 1;

                        portalUpdate = "Portal and Detrack status updated to Custom Clearing, then At Warehouse and finally at Sorting Area. ";
                    }

                    if ((data.data.status == 'on_hold') && ((product == 'EWE') || (product == 'MGLOBAL'))) { //From On Hold to At Warehouse to In Sorting Area
                        update = {
                            currentStatus: "At Warehouse",
                            lastUpdateDateTime: moment().format(),
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: moment().format(),
                            latestLocation: req.body.warehouse,
                            lastUpdatedBy: req.user.name,
                            $push: {
                                history: {
                                    $each: [
                                        {
                                            statusHistory: "Custom Clearance Release",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastLocation: "Brunei Customs",
                                        },
                                        {
                                            statusHistory: "At Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastLocation: req.body.warehouse,
                                        }
                                    ]
                                }
                            }
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "", // Use the calculated dStatus
                                zone: finalArea,
                            }
                        };

                        mongoDBrun = 2;
                        DetrackAPIrun = 4;
                        completeRun = 1;

                        portalUpdate = "Portal and Detrack status updated to Custom Clearing, then At Warehouse and finally at Sorting Area. ";
                    }

                    if ((data.data.status == 'info_recv') && (product == 'PDU')) { //From Info Received to On Hold to Custom Clearance to At Warehouse to In Sorting Area
                        update = {
                            currentStatus: "At Warehouse",
                            lastUpdateDateTime: moment().format(),
                            latestLocation: req.body.warehouse,
                            lastUpdatedBy: req.user.name,
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: moment().format(),
                            $push: {
                                history: {
                                    $each: [
                                        {
                                            statusHistory: "Custom Clearing",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastLocation: "Brunei Customs",
                                        },
                                        {
                                            statusHistory: "At Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastLocation: req.body.warehouse,
                                        }
                                    ]
                                }
                            }
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "", // Use the calculated dStatus
                                zone: finalArea,
                            }
                        };

                        mongoDBrun = 2;
                        DetrackAPIrun = 10;
                        completeRun = 1;

                        portalUpdate = "Portal and Detrack status updated to Custom Clearing, then At Warehouse and finally at Sorting Area. ";
                    }

                    if ((data.data.status == 'info_recv') && ((product == 'EWE') || (product == 'MGLOBAL'))) { //From Info Received to Custom Clearance to At Warehouse to In Sorting Area
                        update = {
                            currentStatus: "At Warehouse",
                            lastUpdateDateTime: moment().format(),
                            latestLocation: req.body.warehouse,
                            lastUpdatedBy: req.user.name,
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: moment().format(),
                            $push: {
                                history: {
                                    $each: [
                                        {
                                            statusHistory: "Custom Clearing",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastLocation: "Brunei Customs",
                                        },
                                        {
                                            statusHistory: "At Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastLocation: req.body.warehouse,
                                        }
                                    ]
                                }
                            }
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "", // Use the calculated dStatus
                                zone: finalArea,
                            }
                        };

                        mongoDBrun = 2;
                        DetrackAPIrun = 8;
                        completeRun = 1;

                        portalUpdate = "Portal and Detrack status updated to Custom Clearing, then At Warehouse and finally at Sorting Area. ";
                    }

                    if (((data.data.status == 'info_recv') || (data.data.status == 'on_hold')) && ((product == 'GDEX') || (product == 'GDEXT'))) {
                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: finalArea,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "At Warehouse",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastLocation: req.body.warehouse,
                                }],
                                latestLocation: req.body.warehouse,
                                product: currentProduct,
                                senderName: "GDEX",
                                totalPrice: data.data.total_price,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Custom Clearing",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: moment().format(),
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: finalPhoneNum,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                lastUpdatedBy: req.user.name,
                                receiverPostalCode: postalCode,
                                jobType: data.data.type,
                                jobMethod: "Standard",
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number
                            });

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "", // Use the calculated dStatus
                                }
                            };

                            portalUpdate = "Portal status updated to At Warehouse. Detrack status updated to In Sorting Area. ";

                            mongoDBrun = 1;
                            DetrackAPIrun = 9;
                            GDEXAPIrun = 2;
                            completeRun = 1;
                        } else {
                            update = {
                                area: finalArea,
                                currentStatus: "At Warehouse",
                                lastUpdateDateTime: moment().format(),
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: moment().format(),
                                latestLocation: req.body.warehouse,
                                lastUpdatedBy: req.user.name,
                                $push: {
                                    history: {
                                        statusHistory: "At Warehouse",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastLocation: req.body.warehouse,
                                    }
                                }
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "", // Use the calculated dStatus
                                }
                            };

                            portalUpdate = "Portal status updated to At Warehouse. Detrack status updated to In Sorting Area. ";

                            mongoDBrun = 2;
                            DetrackAPIrun = 9;
                            GDEXAPIrun = 2;
                            completeRun = 1;
                        }
                    }
                }

                if ((data.data.status == 'info_recv') && (product == 'CBSL')) {
                    update = {
                        area: finalArea,
                        currentStatus: "At Warehouse",
                        lastUpdateDateTime: moment().format(),
                        warehouseEntry: "Yes",
                        warehouseEntryDateTime: moment().format(),
                        attempt: data.data.attempt,
                        latestLocation: req.body.warehouse,
                        lastUpdatedBy: req.user.name,
                        $push: {
                            history: {
                                statusHistory: "At Warehouse",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastLocation: req.body.warehouse,
                            }
                        }
                    }

                    mongoDBrun = 2;

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "", // Use the calculated dStatus
                            do_number: data.data.tracking_number,
                            tracking_number: consignmentID,
                            zone: finalArea,
                        }
                    };

                    var detrackUpdateData2 = {
                        do_number: data.data.tracking_number,
                        data: {
                            status: "", // Use the calculated dStatus
                        }
                    };

                    portalUpdate = "Portal status updated to At Warehouse. Detrack status updated to At Warehouse then Sorting Area. ";

                    DetrackAPIrun = 5;
                    completeRun = 1;
                }

                if ((data.data.status == 'info_recv') && (product == 'KPTDP')) {
                    if (existingOrder === null) {
                        newOrder = new ORDERS({
                            area: finalArea,
                            items: itemsArray, // Use the dynamically created items array
                            attempt: data.data.attempt,
                            history: [{
                                statusHistory: "At Warehouse",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastLocation: req.body.warehouse,
                            }],
                            latestLocation: req.body.warehouse,
                            product: currentProduct,
                            senderName: "KPT",
                            totalPrice: data.data.total_price,
                            receiverName: data.data.deliver_to_collect_from,
                            trackingLink: data.data.tracking_link,
                            currentStatus: "At Warehouse",
                            paymentMethod: "NON COD",
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: moment().format(),
                            receiverAddress: data.data.address,
                            receiverPhoneNumber: finalPhoneNum,
                            doTrackingNumber: consignmentID,
                            parcelTrackingNum: data.data.tracking_number,
                            remarks: data.data.remarks,
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            lastUpdatedBy: req.user.name,
                            receiverPostalCode: postalCode,
                            jobType: data.data.type,
                            jobMethod: data.data.job_type,
                        });

                        mongoDBrun = 1;

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "", // Use the calculated dStatus
                                phone_number: finalPhoneNum,
                                zone: finalArea,
                            }
                        };

                        portalUpdate = "Portal status updated to At Warehouse. Detrack status updated to In Sorting Area. ";

                        DetrackAPIrun = 4;
                        completeRun = 1;
                    }
                }

                if ((data.data.status == 'info_recv') && (product != 'GRP') && (product != 'CBSL') && (product != 'TEMU') && (product != 'PDU') && (product != 'KPTDP') && (product != 'MGLOBAL') && (product != 'EWE') && (product != 'GDEXT') && (product != 'GDEX')) {
                    if (existingOrder === null) {
                        newOrder = new ORDERS({
                            area: finalArea,
                            items: [{
                                quantity: data.data.items[0].quantity,
                                description: data.data.items[0].description,
                                totalItemPrice: data.data.total_price
                            }],
                            attempt: data.data.attempt,
                            history: [{
                                statusHistory: "At Warehouse",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastLocation: req.body.warehouse,
                            }],
                            latestLocation: req.body.warehouse,
                            product: currentProduct,
                            senderName: data.data.job_owner,
                            totalPrice: data.data.total_price,
                            receiverName: data.data.deliver_to_collect_from,
                            trackingLink: data.data.tracking_link,
                            currentStatus: "At Warehouse",
                            paymentMethod: data.data.payment_mode,
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: moment().format(),
                            receiverAddress: data.data.address,
                            receiverPhoneNumber: finalPhoneNum,
                            doTrackingNumber: consignmentID,
                            remarks: data.data.remarks,
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            lastUpdatedBy: req.user.name,
                            receiverPostalCode: postalCode,
                            jobType: data.data.type,
                            jobMethod: data.data.job_type,
                        });

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "", // Use the calculated dStatus
                                phone_number: finalPhoneNum,
                                zone: finalArea,
                            }
                        };

                        portalUpdate = "Portal status updated to At Warehouse. Detrack status updated to In Sorting Area. ";

                        mongoDBrun = 1;
                        DetrackAPIrun = 4;
                        completeRun = 1;
                        /* } */

                    } else {
                        update = {
                            area: finalArea,
                            currentStatus: "At Warehouse",
                            lastUpdateDateTime: moment().format(),
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: moment().format(),
                            latestLocation: req.body.warehouse,
                            lastUpdatedBy: req.user.name,
                            $push: {
                                history: {
                                    statusHistory: "At Warehouse",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastLocation: req.body.warehouse,
                                }
                            }
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "", // Use the calculated dStatus
                                phone_number: finalPhoneNum,
                                zone: finalArea,
                            }
                        };

                        portalUpdate = "Portal status updated to At Warehouse. Detrack status updated to In Sorting Area. ";

                        mongoDBrun = 2;
                        DetrackAPIrun = 4;
                        completeRun = 1;
                    }
                }
            }

            if (req.body.statusCode == 35) {
                if ((data.data.type == 'Collection') && ((data.data.status == 'info_recv') || (lastMilestoneStatus == 'failed'))) {
                    if (existingOrder === null) {
                        if ((req.body.dispatchers == "FL1") || (req.body.dispatchers == "FL2") || (req.body.dispatchers == "FL3") || (req.body.dispatchers == "FL4") || (req.body.dispatchers == "FL5")) {
                            newOrder = new ORDERS({
                                area: finalArea,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Out for Collection",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                    lastLocation: "Customer",
                                }],
                                latestLocation: "Customer",
                                product: currentProduct,
                                assignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                senderName: data.data.job_owner,
                                totalPrice: 0,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Out for Collection",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "No",
                                warehouseEntryDateTime: "N/A",
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: req.body.assignDate,
                                lastUpdatedBy: req.user.name,
                                receiverPostalCode: postalCode,
                                jobType: data.data.type,
                                jobMethod: data.data.job_type,
                            });

                            mongoDBrun = 1;

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: req.body.assignDate, // Get the Assign Date from the form
                                    assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                    status: "dispatched",
                                    zone: finalArea,
                                }
                            };

                            portalUpdate = "Portal and Detrack status updated to Out for Collection assigned to " + req.body.dispatchers + " " + req.body.freelancerName + ". ";

                        } else {
                            newOrder = new ORDERS({
                                area: finalArea,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Out for Collection",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: req.body.dispatchers,
                                    lastLocation: "Customer",
                                }],
                                latestLocation: "Customer",
                                product: currentProduct,
                                assignedTo: req.body.dispatchers,
                                senderName: data.data.job_owner,
                                totalPrice: 0,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Out for Collection",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "No",
                                warehouseEntryDateTime: "N/A",
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: req.body.assignDate,
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                lastUpdatedBy: req.user.name,
                                parcelWeight: data.data.weight,
                                receiverPostalCode: postalCode,
                                jobType: data.data.type,
                                jobMethod: data.data.job_type,
                            });

                            mongoDBrun = 1;

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: req.body.assignDate, // Get the Assign Date from the form
                                    assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                    status: "dispatched",
                                    zone: finalArea,
                                }
                            };

                            portalUpdate = "Portal and Detrack status updated to Out for Collection assigned to " + req.body.dispatchers + ". ";
                        }

                        appliedStatus = "Out for Collection"

                        DetrackAPIrun = 1;
                        completeRun = 1;
                    } else {
                        if ((req.body.dispatchers == "FL1") || (req.body.dispatchers == "FL2") || (req.body.dispatchers == "FL3") || (req.body.dispatchers == "FL4") || (req.body.dispatchers == "FL5")) {
                            update = {
                                area: finalArea,
                                currentStatus: "Out for Collection",
                                lastUpdateDateTime: moment().format(),
                                instructions: data.data.remarks,
                                assignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                attempt: data.data.attempt,
                                jobDate: req.body.assignDate,
                                latestLocation: "Customer",
                                lastUpdatedBy: req.user.name,
                                $push: {
                                    history: {
                                        statusHistory: "Out for Collection",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                        lastLocation: "Customer",
                                    }
                                }
                            }

                            mongoDBrun = 2;

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: req.body.assignDate, // Get the Assign Date from the form
                                    assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                    status: "dispatched",
                                    zone: finalArea,
                                }
                            };

                            portalUpdate = "Portal and Detrack status updated to Out for Collection assigned to " + req.body.dispatchers + " " + req.body.freelancerName + ". ";

                        } else {
                            update = {
                                area: finalArea,
                                currentStatus: "Out for Collection",
                                lastUpdateDateTime: moment().format(),
                                instructions: data.data.remarks,
                                assignedTo: req.body.dispatchers,
                                attempt: data.data.attempt,
                                jobDate: req.body.assignDate,
                                latestLocation: "Customer",
                                lastUpdatedBy: req.user.name,
                                $push: {
                                    history: {
                                        statusHistory: "Out for Collection",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: req.body.dispatchers,
                                        lastLocation: "Customer",
                                    }
                                }
                            }

                            mongoDBrun = 2;

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: req.body.assignDate, // Get the Assign Date from the form
                                    assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                    status: "dispatched",
                                    zone: finalArea,
                                }
                            };

                            portalUpdate = "Portal and Detrack status updated to Out for Collection assigned to " + req.body.dispatchers + ". ";
                        }

                        appliedStatus = "Out for Collection"

                        DetrackAPIrun = 1;
                        completeRun = 1;
                    }
                }

                if (((data.data.type == 'Delivery') && (data.data.status == 'at_warehouse')) || ((data.data.type == 'Delivery') && (data.data.status == 'in_sorting_area'))) {
                    if ((req.body.dispatchers == "FL1") || (req.body.dispatchers == "FL2") || (req.body.dispatchers == "FL3") || (req.body.dispatchers == "FL4") || (req.body.dispatchers == "FL5")) {
                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: finalArea,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Out for Delivery",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                    reason: detrackReason,
                                    lastLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                }],
                                latestLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                product: currentProduct,
                                assignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Out for Delivery",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: finalPhoneNum,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                latestReason: detrackReason,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: req.body.assignDate,
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                lastUpdatedBy: req.user.name,
                                parcelWeight: data.data.weight,
                                receiverPostalCode: postalCode,
                                jobType: data.data.type,
                                jobMethod: data.data.job_type,
                            });

                            mongoDBrun = 1;
                        } else {
                            if ((data.data.payment_mode == "COD") && (currentProduct == "ewe")) {
                                update = {
                                    area: finalArea,
                                    currentStatus: "Out for Delivery",
                                    lastUpdateDateTime: moment().format(),
                                    instructions: data.data.remarks,
                                    assignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                    attempt: data.data.attempt,
                                    jobDate: req.body.assignDate,
                                    latestLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                    lastUpdatedBy: req.user.name,
                                    paymentMethod: "Cash",
                                    totalPrice: data.data.payment_amount,
                                    paymentAmount: data.data.payment_amount,
                                    $push: {
                                        history: {
                                            statusHistory: "Out for Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                            lastLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                        }
                                    }
                                }
                                mongoDBrun = 2;

                            } else {
                                update = {
                                    area: finalArea,
                                    currentStatus: "Out for Delivery",
                                    lastUpdateDateTime: moment().format(),
                                    instructions: data.data.remarks,
                                    assignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                    attempt: data.data.attempt,
                                    jobDate: req.body.assignDate,
                                    latestLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                    lastUpdatedBy: req.user.name,
                                    $push: {
                                        history: {
                                            statusHistory: "Out for Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                            lastLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                        }
                                    }
                                }
                                mongoDBrun = 2;
                            }
                        }

                        if ((data.data.payment_mode == "COD") && (currentProduct == "ewe")) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: req.body.assignDate, // Get the Assign Date from the form
                                    assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                    status: "dispatched",
                                    zone: finalArea,
                                    total_price: data.data.payment_amount,
                                    payment_mode: "Cash"
                                }
                            };
                        } else {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: req.body.assignDate, // Get the Assign Date from the form
                                    assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                    status: "dispatched",
                                    zone: finalArea,
                                }
                            };
                        }
                        portalUpdate = "Portal and Detrack status updated to Out for Delivery assigned to " + req.body.dispatchers + " " + req.body.freelancerName + ". ";

                    } else {
                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: finalArea,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Out for Delivery",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: req.body.dispatchers,
                                    reason: detrackReason,
                                    lastLocation: req.body.dispatchers,
                                }],
                                latestLocation: req.body.dispatchers,
                                product: currentProduct,
                                assignedTo: req.body.dispatchers,
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Out for Delivery",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: finalPhoneNum,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                latestReason: detrackReason,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: req.body.assignDate,
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                lastUpdatedBy: req.user.name,
                                parcelWeight: data.data.weight,
                                receiverPostalCode: postalCode,
                                jobType: data.data.type,
                                jobMethod: data.data.job_type,
                            });

                            mongoDBrun = 1;
                        } else {
                            if ((data.data.payment_mode == "COD") && (currentProduct == "ewe")) {
                                update = {
                                    area: finalArea,
                                    currentStatus: "Out for Delivery",
                                    lastUpdateDateTime: moment().format(),
                                    instructions: data.data.remarks,
                                    assignedTo: req.body.dispatchers,
                                    attempt: data.data.attempt,
                                    jobDate: req.body.assignDate,
                                    latestLocation: req.body.dispatchers,
                                    lastUpdatedBy: req.user.name,
                                    paymentMethod: "Cash",
                                    totalPrice: data.data.payment_amount,
                                    paymentAmount: data.data.payment_amount,
                                    $push: {
                                        history: {
                                            statusHistory: "Out for Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: req.body.dispatchers,
                                            reason: "N/A",
                                            lastLocation: req.body.dispatchers,
                                        }
                                    }
                                }

                                mongoDBrun = 2;
                            } else {
                                update = {
                                    area: finalArea,
                                    currentStatus: "Out for Delivery",
                                    lastUpdateDateTime: moment().format(),
                                    instructions: data.data.remarks,
                                    assignedTo: req.body.dispatchers,
                                    attempt: data.data.attempt,
                                    jobDate: req.body.assignDate,
                                    latestLocation: req.body.dispatchers,
                                    lastUpdatedBy: req.user.name,
                                    $push: {
                                        history: {
                                            statusHistory: "Out for Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: req.body.dispatchers,
                                            reason: "N/A",
                                            lastLocation: req.body.dispatchers,
                                        }
                                    }
                                }

                                mongoDBrun = 2;
                            }
                        }

                        if ((data.data.payment_mode == "COD") && (currentProduct == "ewe")) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: req.body.assignDate, // Get the Assign Date from the form
                                    assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                    status: "dispatched",
                                    zone: finalArea,
                                    total_price: data.data.payment_amount,
                                    payment_mode: "Cash"
                                }
                            };
                        } else {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: req.body.assignDate, // Get the Assign Date from the form
                                    assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                    status: "dispatched",
                                    zone: finalArea,
                                }
                            };
                        }
                        portalUpdate = "Portal and Detrack status updated to Out for Delivery assigned to " + req.body.dispatchers + ". ";
                    }

                    if ((product == 'GDEX') || (product == 'GDEXT')) {
                        GDEXAPIrun = 3;
                    }

                    appliedStatus = "Out for Delivery"

                    DetrackAPIrun = 1;
                    completeRun = 1;
                }
            }

            if (req.body.statusCode == 'SD') {
                if (data.data.status == 'dispatched') {
                    if (data.data.type == 'Collection') {
                        if ((req.body.dispatchers == "FL1") || (req.body.dispatchers == "FL2") || (req.body.dispatchers == "FL3") || (req.body.dispatchers == "FL4") || (req.body.dispatchers == "FL5")) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                assignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                jobDate: req.body.assignDate,
                                lastUpdatedBy: req.user.name,
                                latestReason: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
                                $push: {
                                    history: {
                                        statusHistory: "Out for Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                        reason: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
                                    }
                                }
                            }

                            mongoDBrun = 2;

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: req.body.assignDate, // Get the Assign Date from the form
                                    assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                }
                            };

                            portalUpdate = "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".";

                            DetrackAPIrun = 1;
                            completeRun = 1;

                        } else {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                assignedTo: req.body.dispatchers,
                                jobDate: req.body.assignDate,
                                lastUpdatedBy: req.user.name,
                                latestReason: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
                                $push: {
                                    history: {
                                        statusHistory: "Out for Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: req.body.dispatchers,
                                        reason: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
                                    }
                                }
                            }

                            mongoDBrun = 2;

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: req.body.assignDate, // Get the Assign Date from the form
                                    assign_to: req.body.dispatchers
                                }
                            };

                            portalUpdate = "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ".";

                            DetrackAPIrun = 1;
                            completeRun = 1;
                        }
                    } else {
                        if ((req.body.dispatchers == "FL1") || (req.body.dispatchers == "FL2") || (req.body.dispatchers == "FL3") || (req.body.dispatchers == "FL4") || (req.body.dispatchers == "FL5")) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                assignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                jobDate: req.body.assignDate,
                                lastUpdatedBy: req.user.name,
                                latestReason: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
                                $push: {
                                    history: {
                                        statusHistory: "Out for Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                        reason: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
                                    }
                                }
                            }

                            mongoDBrun = 2;

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: req.body.assignDate, // Get the Assign Date from the form
                                    assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                }
                            };

                            portalUpdate = "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".";

                            DetrackAPIrun = 1;
                            completeRun = 1;

                        } else {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                assignedTo: req.body.dispatchers,
                                jobDate: req.body.assignDate,
                                latestLocation: req.body.dispatchers,
                                lastUpdatedBy: req.user.name,
                                latestReason: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
                                $push: {
                                    history: {
                                        statusHistory: "Out for Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: req.body.dispatchers,
                                        reason: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
                                    }
                                }
                            }

                            mongoDBrun = 2;

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: req.body.assignDate, // Get the Assign Date from the form
                                    assign_to: req.body.dispatchers
                                }
                            };

                            portalUpdate = "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ".";

                            DetrackAPIrun = 1;
                            completeRun = 1;
                        }
                    }
                }
            }

            if (req.body.statusCode == 'SFJ') {
                if (data.data.status == 'failed') {
                    if (data.data.type == 'Collection') {
                        if (data.data.reason == "Unattempted Collection") {
                            if (existingOrder === null) {
                                newOrder = new ORDERS({
                                    area: finalArea,
                                    items: itemsArray, // Use the dynamically created items array
                                    attempt: data.data.attempt,
                                    history: [{
                                        statusHistory: "Failed Collection",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: data.data.reason,
                                        lastLocation: "Customer",
                                    }],
                                    latestLocation: "Customer",
                                    product: currentProduct,
                                    assignedTo: "N/A",
                                    senderName: data.data.job_owner,
                                    totalPrice: 0,
                                    receiverName: data.data.deliver_to_collect_from,
                                    trackingLink: data.data.tracking_link,
                                    currentStatus: "Failed Collection",
                                    paymentMethod: data.data.payment_mode,
                                    warehouseEntry: "No",
                                    warehouseEntryDateTime: "N/A",
                                    receiverAddress: data.data.address,
                                    receiverPhoneNumber: data.data.phone_number,
                                    doTrackingNumber: consignmentID,
                                    remarks: data.data.remarks,
                                    latestReason: data.data.reason,
                                    lastUpdateDateTime: moment().format(),
                                    creationDate: data.data.created_at,
                                    jobDate: req.body.assignDate,
                                    flightDate: data.data.job_received_date,
                                    mawbNo: data.data.run_number,
                                    lastUpdatedBy: req.user.name,
                                    parcelWeight: data.data.weight,
                                    receiverPostalCode: postalCode,
                                    jobType: data.data.type,
                                    jobMethod: data.data.job_type,
                                });

                                mongoDBrun = 1;
                            } else {
                                update = {
                                    currentStatus: "Failed Collection",
                                    lastUpdateDateTime: moment().format(),
                                    assignedTo: "N/A",
                                    latestReason: data.data.reason,
                                    attempt: data.data.attempt,
                                    latestLocation: "Customer",
                                    lastUpdatedBy: req.user.name,
                                    $push: {
                                        history: {
                                            statusHistory: "Failed Collection",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: data.data.reason,
                                            lastLocation: "Customer",
                                        }
                                    }
                                }

                                mongoDBrun = 2;
                            }
                        } else {
                            if (existingOrder === null) {
                                newOrder = new ORDERS({
                                    area: finalArea,
                                    items: itemsArray, // Use the dynamically created items array
                                    attempt: data.data.attempt + 1,
                                    history: [{
                                        statusHistory: "Failed Collection",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: data.data.reason,
                                        lastLocation: "Customer",
                                    }],
                                    latestLocation: "Customer",
                                    product: currentProduct,
                                    assignedTo: "N/A",
                                    senderName: data.data.job_owner,
                                    totalPrice: 0,
                                    receiverName: data.data.deliver_to_collect_from,
                                    trackingLink: data.data.tracking_link,
                                    currentStatus: "Failed Collection",
                                    paymentMethod: data.data.payment_mode,
                                    warehouseEntry: "No",
                                    warehouseEntryDateTime: "N/A",
                                    receiverAddress: data.data.address,
                                    receiverPhoneNumber: data.data.phone_number,
                                    doTrackingNumber: consignmentID,
                                    remarks: data.data.remarks,
                                    latestReason: data.data.reason,
                                    lastUpdateDateTime: moment().format(),
                                    creationDate: data.data.created_at,
                                    jobDate: req.body.assignDate,
                                    flightDate: data.data.job_received_date,
                                    mawbNo: data.data.run_number,
                                    lastUpdatedBy: req.user.name,
                                    parcelWeight: data.data.weight,
                                    receiverPostalCode: postalCode,
                                    jobType: data.data.type,
                                    jobMethod: data.data.job_type,
                                });

                                mongoDBrun = 1;
                                completeRun = 1;
                            } else {
                                update = {
                                    currentStatus: "Failed Collection",
                                    lastUpdateDateTime: moment().format(),
                                    assignedTo: "N/A",
                                    latestReason: data.data.reason,
                                    attempt: data.data.attempt + 1,
                                    latestLocation: "Customer",
                                    lastUpdatedBy: req.user.name,
                                    $push: {
                                        history: {
                                            statusHistory: "Failed Collection",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: data.data.reason,
                                            lastLocation: "Customer",
                                        }
                                    }
                                }

                                mongoDBrun = 2;
                                completeRun = 1;
                            }

                            var detrackUpdateDataAttempt = {
                                data: {
                                    do_number: consignmentID,
                                }
                            };

                            DetrackAPIrun = 3;
                        }

                        appliedStatus = "Failed Collection"
                        portalUpdate = "Portal updated to Failed Collection. ";
                    } else {
                        if (data.data.reason == "Unattempted Delivery") {
                            update = {
                                currentStatus: "Return to Warehouse",
                                lastUpdateDateTime: moment().format(),
                                assignedTo: "N/A",
                                latestReason: data.data.reason,
                                attempt: data.data.attempt,
                                latestLocation: req.body.warehouse,
                                lastUpdatedBy: req.user.name,
                                $push: {
                                    history: {
                                        $each: [
                                            {
                                                statusHistory: "Failed Delivery",
                                                dateUpdated: moment().format(),
                                                updatedBy: req.user.name,
                                                lastAssignedTo: data.data.assign_to,
                                                reason: data.data.reason,
                                                lastLocation: data.data.assign_to,
                                            },
                                            {
                                                statusHistory: "Return to Warehouse",
                                                dateUpdated: moment().format(),
                                                updatedBy: req.user.name,
                                                lastLocation: req.body.warehouse,
                                            }
                                        ]
                                    }
                                }
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "at_warehouse" // Use the calculated dStatus
                                }
                            };

                            if ((product == 'GDEX') || (product == 'GDEXT')) {
                                GDEXAPIrun = 6
                            }

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;
                            completeRun = 1;
                            appliedStatus = "Failed Delivery, Return to Warehouse"
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";

                            /* if (data.data.phone_number != null) {
                                waOrderFailedDelivery = 5;
                            } */
                        } else if (data.data.reason == "Reschedule to self collect requested by customer") {
                            update = {
                                currentStatus: "Return to Warehouse",
                                lastUpdateDateTime: moment().format(),
                                assignedTo: "N/A",
                                latestReason: "Reschedule to self collect requested by customer",
                                attempt: data.data.attempt + 1,
                                latestLocation: req.body.warehouse,
                                lastUpdatedBy: req.user.name,
                                grRemark: "Reschedule to self collect requested by customer",
                                $push: {
                                    history: {
                                        $each: [
                                            {
                                                statusHistory: "Failed Delivery",
                                                dateUpdated: moment().format(),
                                                updatedBy: req.user.name,
                                                lastAssignedTo: data.data.assign_to,
                                                reason: "Reschedule to self collect requested by customer",
                                                lastLocation: data.data.assign_to,
                                            },
                                            {
                                                statusHistory: "Return to Warehouse",
                                                dateUpdated: moment().format(),
                                                updatedBy: req.user.name,
                                                lastLocation: req.body.warehouse,
                                            }
                                        ]
                                    }
                                }
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "at_warehouse" // Use the calculated dStatus
                                }
                            };

                            var detrackUpdateDataAttempt = {
                                data: {
                                    do_number: consignmentID,
                                }
                            };

                            if ((product == 'GDEX') || (product == 'GDEXT')) {
                                GDEXAPIrun = 6
                            }

                            DetrackAPIrun = 2;
                            mongoDBrun = 2;
                            completeRun = 1;
                            appliedStatus = "Failed Delivery, Return to Warehouse"
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";

                        } else {
                            update = {
                                currentStatus: "Return to Warehouse",
                                lastUpdateDateTime: moment().format(),
                                assignedTo: "N/A",
                                latestReason: data.data.reason,
                                attempt: data.data.attempt + 1,
                                latestLocation: req.body.warehouse,
                                lastUpdatedBy: req.user.name,
                                $push: {
                                    history: {
                                        $each: [
                                            {
                                                statusHistory: "Failed Delivery",
                                                dateUpdated: moment().format(),
                                                updatedBy: req.user.name,
                                                lastAssignedTo: data.data.assign_to,
                                                reason: data.data.reason,
                                                lastLocation: data.data.assign_to,
                                            },
                                            {
                                                statusHistory: "Return to Warehouse",
                                                dateUpdated: moment().format(),
                                                updatedBy: req.user.name,
                                                lastLocation: req.body.warehouse,
                                            }
                                        ]
                                    }
                                }
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "at_warehouse" // Use the calculated dStatus
                                }
                            };

                            var detrackUpdateDataAttempt = {
                                data: {
                                    do_number: consignmentID,
                                }
                            };

                            if ((product == 'GDEX') || (product == 'GDEXT')) {
                                GDEXAPIrun = 6
                            }

                            DetrackAPIrun = 2;
                            mongoDBrun = 2;
                            completeRun = 1;
                            appliedStatus = "Failed Delivery, Return to Warehouse"
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        }
                    }
                }

                if (data.data.status == 'completed') {
                    if (data.data.type == 'Collection') {
                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: finalArea,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Completed",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to,
                                    lastLocation: req.body.warehouse,
                                }],
                                latestLocation: req.body.warehouse,
                                product: currentProduct,
                                assignedTo: data.data.assign_to,
                                senderName: data.data.job_owner,
                                totalPrice: 0,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Completed",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                latestReason: data.data.reason,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: req.body.assignDate,
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                lastUpdatedBy: req.user.name,
                                parcelWeight: data.data.weight,
                                receiverPostalCode: postalCode,
                                jobType: data.data.type,
                                jobMethod: data.data.job_type,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                currentStatus: "Completed",
                                lastUpdateDateTime: moment().format(),
                                latestLocation: req.body.warehouse,
                                lastUpdatedBy: req.user.name,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                assignedTo: data.data.assign_to,
                                $push: {
                                    history: {
                                        statusHistory: "Completed",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        lastLocation: req.body.warehouse,
                                    }
                                }
                            }

                            mongoDBrun = 2;
                        }
                    } else {
                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: finalArea,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Completed",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to,
                                    lastLocation: "Customer",
                                }],
                                latestLocation: "Customer",
                                product: currentProduct,
                                assignedTo: data.data.assign_to,
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Completed",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: moment().format(),
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: data.data.date,
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                lastUpdatedBy: req.user.name,
                                parcelWeight: data.data.weight,
                                receiverPostalCode: postalCode,
                                jobType: data.data.type,
                                jobMethod: data.data.job_type,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                currentStatus: "Completed",
                                lastUpdateDateTime: moment().format(),
                                latestLocation: "Customer",
                                lastUpdatedBy: req.user.name,
                                assignedTo: data.data.assign_to,
                                $push: {
                                    history: {
                                        statusHistory: "Completed",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        lastLocation: "Customer",
                                    }
                                }
                            }

                            mongoDBrun = 2;
                        }
                    }

                    if ((product == 'GDEX') || (product == 'GDEXT')) {
                        GDEXAPIrun = 6
                    }

                    appliedStatus = "Completed"
                    completeRun = 1;

                    portalUpdate = "Portal status updated to Completed. ";
                }
            }

            if (req.body.statusCode == 'CSSC') {
                if ((data.data.type == 'Collection') && ((data.data.status == 'info_recv') || (lastMilestoneStatus == 'failed'))) {
                    if (existingOrder === null) {
                        newOrder = new ORDERS({
                            area: finalArea,
                            items: itemsArray, // Use the dynamically created items array
                            attempt: data.data.attempt,
                            history: [{
                                statusHistory: "Drop Off",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastAssignedTo: "Selfcollect",
                                lastLocation: "Customer",
                            }],
                            latestLocation: "Customer",
                            product: currentProduct,
                            assignedTo: "Selfcollect",
                            senderName: data.data.job_owner,
                            totalPrice: 0,
                            receiverName: data.data.deliver_to_collect_from,
                            trackingLink: data.data.tracking_link,
                            currentStatus: "Drop Off",
                            paymentMethod: data.data.payment_mode,
                            warehouseEntry: "No",
                            warehouseEntryDateTime: "N/A",
                            receiverAddress: data.data.address,
                            receiverPhoneNumber: data.data.phone_number,
                            doTrackingNumber: consignmentID,
                            remarks: data.data.remarks,
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            jobDate: req.body.assignDate,
                            flightDate: data.data.job_received_date,
                            mawbNo: data.data.run_number,
                            lastUpdatedBy: req.user.name,
                            parcelWeight: data.data.weight,
                            receiverPostalCode: postalCode,
                            jobType: data.data.type,
                            jobMethod: data.data.job_type,
                        });

                        mongoDBrun = 1;

                    } else {
                        update = {
                            currentStatus: "Drop Off",
                            lastUpdateDateTime: moment().format(),
                            instructions: data.data.remarks,
                            assignedTo: "Selfcollect",
                            jobDate: req.body.assignDate,
                            latestLocation: "Customer",
                            lastUpdatedBy: req.user.name,
                            jobMethod: "Drop Off",
                            $push: {
                                history: {
                                    statusHistory: "Drop Off",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: "Selfcollect",
                                    reason: "N/A",
                                    lastLocation: "Customer",
                                }
                            }
                        }

                        mongoDBrun = 2;

                    }

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            date: req.body.assignDate, // Get the Assign Date from the form
                            assign_to: "Selfcollect", // Get the selected dispatcher from the form
                            status: "dispatched", // Use the calculated dStatus
                            job_type: "Drop Off",
                            zone: finalArea,
                        }
                    };

                    portalUpdate = "Portal and Detrack status updated for Drop Off. ";
                    appliedStatus = "Drop Off"

                    DetrackAPIrun = 1;
                    completeRun = 1;
                } else {
                    if ((data.data.status == 'at_warehouse') || (data.data.status == 'in_sorting_area')) {
                        if ((product == 'MOH') || (product == 'JPMC') || (product == 'PHC')) {
                            update = {
                                currentStatus: "Self Collect",
                                lastUpdateDateTime: moment().format(),
                                instructions: data.data.remarks,
                                assignedTo: "Selfcollect",
                                jobDate: req.body.assignDate,
                                latestLocation: "Go Rush Office",
                                lastUpdatedBy: req.user.name,
                                jobMethod: "Self Collect",
                                $push: {
                                    history: {
                                        statusHistory: "Self Collect",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: "Selfcollect",
                                        lastLocation: "Go Rush Office",
                                    }
                                }
                            }

                            if (data.data.payment_mode == "Cash") {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        date: req.body.assignDate, // Get the Assign Date from the form
                                        assign_to: "Selfcollect", // Get the selected dispatcher from the form
                                        job_type: req.body.jobMethod,
                                        status: "dispatched", // Use the calculated dStatus
                                        total_price: 4,
                                        payment_amount: 4,
                                    }
                                };
                            } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        date: req.body.assignDate, // Get the Assign Date from the form
                                        assign_to: "Selfcollect", // Get the selected dispatcher from the form
                                        job_type: req.body.jobMethod,
                                        status: "dispatched", // Use the calculated dStatus
                                        total_price: 4,
                                        payment_amount: 0,
                                    }
                                };
                            }
                        } else {
                            if ((data.data.payment_mode == "COD") && (currentProduct == "ewe")) {
                                update = {
                                    currentStatus: "Self Collect",
                                    lastUpdateDateTime: moment().format(),
                                    instructions: data.data.remarks,
                                    assignedTo: "Selfcollect",
                                    jobDate: req.body.assignDate,
                                    latestLocation: "Go Rush Office",
                                    lastUpdatedBy: req.user.name,
                                    jobMethod: "Self Collect",
                                    paymentMethod: "Cash",
                                    totalPrice: data.data.payment_amount,
                                    paymentAmount: data.data.payment_amount,
                                    $push: {
                                        history: {
                                            statusHistory: "Self Collect",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: "Selfcollect",
                                            lastLocation: "Go Rush Office",
                                        }
                                    }
                                }

                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        date: req.body.assignDate, // Get the Assign Date from the form
                                        assign_to: "Selfcollect", // Get the selected dispatcher from the form
                                        status: "dispatched", // Use the calculated dStatus
                                        job_type: "Self Collect",
                                        total_price: data.data.payment_amount,
                                        payment_mode: "Cash"
                                    }
                                };
                            } else {
                                update = {
                                    currentStatus: "Self Collect",
                                    lastUpdateDateTime: moment().format(),
                                    instructions: data.data.remarks,
                                    assignedTo: "Selfcollect",
                                    jobDate: req.body.assignDate,
                                    latestLocation: "Go Rush Office",
                                    lastUpdatedBy: req.user.name,
                                    jobMethod: "Self Collect",
                                    $push: {
                                        history: {
                                            statusHistory: "Self Collect",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: "Selfcollect",
                                            lastLocation: "Go Rush Office",
                                        }
                                    }
                                }

                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        date: req.body.assignDate, // Get the Assign Date from the form
                                        assign_to: "Selfcollect", // Get the selected dispatcher from the form
                                        status: "dispatched", // Use the calculated dStatus
                                        job_type: "Self Collect"
                                    }
                                };
                            }
                        }

                        if ((product == 'GDEX') || (product == 'GDEXT')) {
                            GDEXAPIrun = 4;
                        }

                        portalUpdate = "Portal and Detrack status updated for Self Collect. ";
                        appliedStatus = "Self Collect"

                        mongoDBrun = 2;
                        DetrackAPIrun = 1;
                        completeRun = 1;
                    }
                }
            }

            if ((req.body.statusCode == 'CD') && (data.data.status != 'completed')) {
                detrackReason = "Cancelled";

                if (product == 'MOH') {
                    update = {
                        currentStatus: "Cancelled",
                        lastUpdateDateTime: moment().format(),
                        instructions: data.data.remarks,
                        assignedTo: "N/A",
                        latestReason: detrackReason,
                        latestLocation: req.body.warehouse,
                        lastUpdatedBy: req.user.name,
                        pharmacyFormCreated: "Yes",
                        $push: {
                            history: {
                                statusHistory: "Cancelled",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Cancelled Delivery",
                                lastLocation: req.body.warehouse,
                            }
                        }
                    }
                } else {
                    update = {
                        currentStatus: "Cancelled",
                        lastUpdateDateTime: moment().format(),
                        instructions: data.data.remarks,
                        assignedTo: "N/A",
                        latestReason: detrackReason,
                        latestLocation: req.body.warehouse,
                        lastUpdatedBy: req.user.name,
                        $push: {
                            history: {
                                statusHistory: "Cancelled",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Cancelled Delivery",
                                lastLocation: req.body.warehouse,
                            }
                        }
                    }
                }

                if ((product == 'CBSL') && (data.data.status == 'info_recv')) {
                    var detrackUpdateData = {
                        do_number: data.data.tracking_number,
                        data: {
                            status: "cancelled",
                            date: moment().format('YYYY-MM-DD'),
                        }
                    };
                } else {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "cancelled",
                            date: moment().format('YYYY-MM-DD'),
                        }
                    };
                }

                if ((product == 'GDEX') || (product == 'GDEXT')) {
                    GDEXAPIrun = 5;
                }

                portalUpdate = "Portal and Detrack status updated to Cancelled. ";

                mongoDBrun = 2
                DetrackAPIrun = 7;
                completeRun = 1;
            }

            if ((req.body.statusCode == 'AJ') && (data.data.status == 'cancelled')) {
                portalUpdate = "Portal and Detrack status updated to Return to Warehouse from Cancelled. ";

                if (product == 'MOH') {
                    update = {
                        currentStatus: "Return to Warehouse",
                        lastUpdateDateTime: moment().format(),
                        instructions: data.data.remarks,
                        assignedTo: "N/A",
                        latestReason: detrackReason,
                        latestLocation: req.body.warehouse,
                        lastUpdatedBy: req.user.name,
                        pharmacyFormCreated: "No",
                        $push: {
                            history: {
                                statusHistory: "Return to Warehouse",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: detrackReason,
                                lastLocation: req.body.warehouse,
                            }
                        }
                    }
                } else {
                    update = {
                        currentStatus: "Return to Warehouse",
                        lastUpdateDateTime: moment().format(),
                        instructions: data.data.remarks,
                        assignedTo: "N/A",
                        latestReason: detrackReason,
                        latestLocation: req.body.warehouse,
                        lastUpdatedBy: req.user.name,
                        $push: {
                            history: {
                                statusHistory: "Return to Warehouse",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: detrackReason,
                                lastLocation: req.body.warehouse,
                            }
                        }
                    }
                }

                mongoDBrun = 2;

                var detrackUpdateData = {
                    do_number: consignmentID,
                    data: {
                        status: "at_warehouse",
                    }
                };

                DetrackAPIrun = 1;
                completeRun = 1;
            }


            if ((req.body.statusCode == 47) && (data.data.status == 'cancelled')) {
                portalUpdate = "Portal and Detrack status updated to Disposed. ";

                update = {
                    currentStatus: "Disposed",
                    lastUpdateDateTime: moment().format(),
                    assignedTo: "N/A",
                    latestReason: detrackReason,
                    latestLocation: "Disposed",
                    lastUpdatedBy: req.user.name,
                    $push: {
                        history: {
                            statusHistory: "Disposed",
                            dateUpdated: moment().format(),
                            updatedBy: req.user.name,
                            reason: detrackReason,
                            lastLocation: "Disposed",
                        }
                    }
                }

                mongoDBrun = 2;

                var detrackUpdateData = {
                    do_number: consignmentID,
                    data: {
                        status: "disposed",
                    }
                };

                DetrackAPIrun = 1;
                completeRun = 1;
            }

            if (req.body.statusCode == 'UW') {
                if (data.data.weight != null) {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        parcelWeight: req.body.weight,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Weight updated from " + data.data.weight + " kg to " + req.body.weight + " kg.",
                            }
                        }
                    }
                } else {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        parcelWeight: req.body.weight,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Weight updated to " + req.body.weight + " kg.",
                            }
                        }
                    }
                }

                var detrackUpdateData = {
                    do_number: consignmentID,
                    data: {
                        weight: req.body.weight,
                    }
                };

                portalUpdate = "Portal and Detrack weight updated. ";

                DetrackAPIrun = 1;
                mongoDBrun = 2;

                completeRun = 1;
            }

            if (req.body.statusCode == 'UP') {
                if (req.body.paymentMethod == 'NON COD') {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        paymentMethod: req.body.paymentMethod,
                        totalPrice: 0,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Payment method updated to " + req.body.paymentMethod + ".",
                            }
                        }
                    }

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            payment_mode: "NON COD",
                            total_price: 0,
                            payment_amount: 0
                        }
                    };

                } else {
                    if (req.body.paymentMethod == 'Cash') {
                        update = {
                            lastUpdateDateTime: moment().format(),
                            paymentMethod: req.body.paymentMethod,
                            totalPrice: req.body.price,
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Payment method updated to " + req.body.paymentMethod + ", price updated to $" + req.body.price,
                                }
                            }
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                payment_mode: req.body.paymentMethod,
                                total_price: req.body.price,
                                payment_amount: req.body.price
                            }
                        };
                    } else {
                        update = {
                            lastUpdateDateTime: moment().format(),
                            paymentMethod: req.body.paymentMethod,
                            totalPrice: req.body.price,
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Payment method updated to " + req.body.paymentMethod + ", price updated to $" + req.body.price,
                                }
                            }
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                payment_mode: req.body.paymentMethod,
                                total_price: req.body.price,
                                payment_amount: 0
                            }
                        };
                    }
                }

                portalUpdate = "Portal and Detrack payment method and price updated. ";

                DetrackAPIrun = 1;
                mongoDBrun = 2;

                completeRun = 1;
            }

            if (req.body.statusCode == 'UAR') {
                if (data.data.zone != null) {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        area: req.body.area,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Area updated from " + data.data.zone + " to " + req.body.area + ".",
                            }
                        }
                    }
                } else {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        area: req.body.area,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Area updated to " + req.body.area + ".",
                            }
                        }
                    }
                }

                var detrackUpdateData = {
                    do_number: consignmentID,
                    data: {
                        zone: req.body.area,
                    }
                };

                portalUpdate = "Portal and Detrack area updated. ";

                DetrackAPIrun = 1;
                mongoDBrun = 2;

                completeRun = 1;
            }

            if (req.body.statusCode == 'UAS') {
                if (data.data.address != null) {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        receiverAddress: req.body.address,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Address updated from " + data.data.address + " to " + req.body.address + ".",
                            }
                        }
                    }
                } else {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        receiverAddress: req.body.address,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Address updated to " + req.body.address + ".",
                            }
                        }
                    }
                }

                var detrackUpdateData = {
                    do_number: consignmentID,
                    data: {
                        address: req.body.address,
                    }
                };

                portalUpdate = "Portal and Detrack address updated. ";

                DetrackAPIrun = 1;
                mongoDBrun = 2;

                completeRun = 1;
            }

            if (req.body.statusCode == 'UPN') {
                if (data.data.phone_number != null) {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        receiverPhoneNumber: req.body.phoneNum,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Phone number updated from " + data.data.phone_number + " to " + req.body.phoneNum + ".",
                            }
                        }
                    }
                } else {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        receiverPhoneNumber: req.body.phoneNum,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Phone number updated to " + req.body.phoneNum + ".",
                            }
                        }
                    }
                }

                var detrackUpdateData = {
                    do_number: consignmentID,
                    data: {
                        phone_number: "+" + req.body.phoneNum,
                    }
                };

                portalUpdate = "Portal and Detrack phone number updated. ";

                DetrackAPIrun = 1;
                mongoDBrun = 2;

                completeRun = 1;
            }

            if (req.body.statusCode == 'URN') {
                if (data.data.deliver_to_collect_from != null) {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        receiverName: req.body.name,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Customer Name updated from " + data.data.deliver_to_collect_from + " to " + req.body.name + ".",
                            }
                        }
                    }
                } else {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        receiverName: req.body.name,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Customer Name updated to " + req.body.name + ".",
                            }
                        }
                    }
                }

                var detrackUpdateData = {
                    do_number: consignmentID,
                    data: {
                        deliver_to_collect_from: req.body.name,
                    }
                };

                portalUpdate = "Portal and Detrack Customer Name updated. ";

                DetrackAPIrun = 1;
                mongoDBrun = 2;

                completeRun = 1;
            }

            if (req.body.statusCode == 'UD') {
                if (data.data.date != null) {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        jobDate: req.body.assignDate,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Job Date updated from " + data.data.date + " to " + req.body.assignDate + ".",
                            }
                        }
                    }
                } else {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        jobDate: req.body.assignDate,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Job Date updated to " + req.body.assignDate + ".",
                            }
                        }
                    }
                }

                var detrackUpdateData = {
                    do_number: consignmentID,
                    data: {
                        date: req.body.assignDate,
                    }
                };

                portalUpdate = "Portal and Detrack Job Date updated. ";

                DetrackAPIrun = 1;
                mongoDBrun = 2;

                completeRun = 1;
            }

            if (req.body.statusCode == 'UPC') {
                if (data.data.postal_code != null) {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        receiverPostalCode: req.body.postalCode,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Postal Code updated from " + data.data.postal_code + " to " + req.body.postalCode + ".",
                            }
                        }
                    }
                } else {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        receiverPostalCode: req.body.postalCode,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Postal Code updated to " + req.body.postalCode + ".",
                            }
                        }
                    }
                }

                var detrackUpdateData = {
                    do_number: consignmentID,
                    data: {
                        postal_code: req.body.postalCode,
                    }
                };

                portalUpdate = "Portal and Detrack Postal Code updated. ";

                DetrackAPIrun = 1;
                mongoDBrun = 2;

                completeRun = 1;
            }

            if (req.body.statusCode == 'UAB') {
                if ((product == 'PDU') || (product == 'MGLOBAL') || (product == 'EWE') || (product == 'GDEX') || (product == 'GDEXT')) {
                    if (existingOrder === null) {
                        if ((data.data.payment_mode == "COD") && (product == 'EWE')) {
                            newOrder = new ORDERS({
                                area: finalArea,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Info Received",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastLocation: "Origin",
                                }],
                                latestLocation: "Origin",
                                product: currentProduct,
                                senderName: data.data.job_owner,
                                totalPrice: data.data.payment_amount,
                                paymentAmount: data.data.payment_amount,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Info Received",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "No",
                                warehouseEntryDateTime: "N/A",
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: finalPhoneNum,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                lastUpdatedBy: req.user.name,
                                receiverPostalCode: postalCode,
                                jobType: data.data.type,
                                jobMethod: "Standard",
                                flightDate: data.data.job_received_date,
                                mawbNo: req.body.awbNum
                            });

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    run_number: req.body.awbNum,
                                    zone: finalArea,
                                    total_price: data.data.payment_amount,
                                    payment_mode: "Cash"
                                }
                            };

                            portalUpdate = "Portal and Detrack AWB number updated. ";
                            DetrackAPIrun = 1;
                            mongoDBrun = 1;
                            completeRun = 1;
                        } else if ((product == 'EWE') || data.data.payment_mode != "COD") {
                            newOrder = new ORDERS({
                                area: finalArea,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Info Received",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastLocation: "Origin",
                                }],
                                latestLocation: "Origin",
                                product: currentProduct,
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                paymentAmount: data.data.total_price,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Info Received",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "No",
                                warehouseEntryDateTime: "N/A",
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: finalPhoneNum,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                lastUpdatedBy: req.user.name,
                                receiverPostalCode: postalCode,
                                jobType: data.data.type,
                                jobMethod: "Standard",
                                flightDate: data.data.job_received_date,
                                mawbNo: req.body.awbNum
                            });

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    run_number: req.body.awbNum,
                                    zone: finalArea
                                }
                            };

                            portalUpdate = "Portal and Detrack AWB number updated. ";
                            DetrackAPIrun = 1;
                            mongoDBrun = 1;
                            completeRun = 1;

                        } else if (product == 'MGLOBAL') {
                            newOrder = new ORDERS({
                                area: finalArea,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Info Received",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastLocation: "Origin",
                                }],
                                latestLocation: "Origin",
                                product: currentProduct,
                                senderName: "MGLOBAL",
                                totalPrice: 0,
                                paymentAmount: 0,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Info Received",
                                paymentMethod: "NON COD",
                                warehouseEntry: "No",
                                warehouseEntryDateTime: "N/A",
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: finalPhoneNum,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                lastUpdatedBy: req.user.name,
                                receiverPostalCode: postalCode,
                                jobType: data.data.type,
                                jobMethod: "Standard",
                                flightDate: data.data.job_received_date,
                                mawbNo: req.body.awbNum
                            });

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    run_number: req.body.awbNum,
                                    zone: finalArea,
                                    phone_number: finalPhoneNum,
                                    job_type: "Standard",
                                    payment_mode: "NON COD",
                                    total_price: 0,
                                    payment_amount: 0,
                                    job_owner: "MGLOBAL"
                                }
                            };

                            portalUpdate = "Portal and Detrack AWB number updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 1;
                            completeRun = 1;
                        } else if (product == 'PDU') {
                            newOrder = new ORDERS({
                                area: finalArea,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Info Received",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastLocation: "Origin",
                                }],
                                latestLocation: "Origin",
                                product: currentProduct,
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                paymentAmount: data.data.payment_amount,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Info Received",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "No",
                                warehouseEntryDateTime: "N/A",
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: finalPhoneNum,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                lastUpdatedBy: req.user.name,
                                receiverPostalCode: postalCode,
                                jobType: data.data.type,
                                jobMethod: "Standard",
                                flightDate: data.data.job_received_date,
                                mawbNo: req.body.awbNum
                            });

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    run_number: req.body.awbNum,
                                    zone: finalArea,
                                    phone_number: finalPhoneNum,
                                    job_owner: "PDU"
                                }
                            };

                            portalUpdate = "Portal and Detrack AWB number updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 1;
                            completeRun = 1;
                        } else {
                            newOrder = new ORDERS({
                                area: finalArea,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Info Received",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastLocation: "Origin",
                                }],
                                latestLocation: "Origin",
                                product: currentProduct,
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Info Received",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "No",
                                warehouseEntryDateTime: "N/A",
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: finalPhoneNum,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                lastUpdatedBy: req.user.name,
                                receiverPostalCode: postalCode,
                                jobType: data.data.type,
                                jobMethod: "Standard",
                                flightDate: data.data.job_received_date,
                                mawbNo: req.body.awbNum
                            });

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    run_number: req.body.awbNum,
                                }
                            };

                            portalUpdate = "Portal and Detrack AWB number updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 1;
                            completeRun = 1;
                        }
                    } else {
                        if (data.data.run_number != null) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                mawbNo: req.body.awbNum,
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "AWB number updated from " + data.data.run_number + " to " + req.body.awbNum + ".",
                                    }
                                }
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    run_number: req.body.awbNum,
                                }
                            };

                            portalUpdate = "Portal and Detrack AWB number updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;
                            completeRun = 1;
                        } else {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                mawbNo: req.body.awbNum,
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "AWB number updated to " + req.body.awbNum + ".",
                                    }
                                }
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    run_number: req.body.awbNum,
                                }
                            };

                            portalUpdate = "Portal and Detrack AWB number updated. ";
                            DetrackAPIrun = 1;
                            mongoDBrun = 2;
                            completeRun = 1;
                        }
                    }
                }
            }

            if (req.body.statusCode == 'UJM') {
                if (product == 'CBSL') {
                    if (req.body.jobMethod == "Drop Off") {
                        if ((data.data.address.includes("Brunei Muara")) || (data.data.address.includes("brunei-muara"))) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                totalPrice: 4,
                                paymentAmount: 4,
                                jobMethod: req.body.jobMethod,
                                items: [{
                                    totalItemPrice: 4
                                }],
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }

                            if (data.data.payment_mode == "Cash") {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 4,
                                        payment_amount: 4,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 4,
                                        payment_amount: 0,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else {
                                wrongPick = 1;
                            }
                        }
                        if (((data.data.address.includes("Tutong")) || (data.data.address.includes("tutong")))
                            && (!data.data.address.includes("Brunei Muara")) && (!data.data.address.includes("brunei-muara"))) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                totalPrice: 6,
                                paymentAmount: 6,
                                jobMethod: req.body.jobMethod,
                                items: [{
                                    totalItemPrice: 6
                                }],
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }
                            if (data.data.payment_mode == "Cash") {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 6,
                                        payment_amount: 6,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 6,
                                        payment_amount: 0,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else {
                                wrongPick = 1;
                            }
                        }
                        if ((data.data.address.includes("Belait")) || (data.data.address.includes("belait"))) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                totalPrice: 8,
                                paymentAmount: 8,
                                jobMethod: req.body.jobMethod,
                                items: [{
                                    totalItemPrice: 8
                                }],
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }
                            if (data.data.payment_mode == "Cash") {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 8,
                                        payment_amount: 8,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 8,
                                        payment_amount: 0,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else {
                                wrongPick = 1;
                            }
                        }
                        if ((data.data.address.includes("Temburong")) || (data.data.address.includes("temburong"))) {
                            wrongPick = 1;
                        }
                    } else if ((req.body.jobMethod == "Self Collect") || (req.body.jobMethod == "Pickup")) {
                        update = {
                            lastUpdateDateTime: moment().format(),
                            totalPrice: 0,
                            paymentAmount: 0,
                            jobMethod: req.body.jobMethod,
                            items: [{
                                totalItemPrice: 0
                            }],
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                }
                            }
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                job_type: req.body.jobMethod,
                                total_price: 0,
                                payment_amount: 0,
                            }
                        };

                        portalUpdate = "Portal and Detrack Job Method updated. ";

                        DetrackAPIrun = 1;
                        mongoDBrun = 2;

                        completeRun = 1;
                    } else {
                        wrongPick = 1;
                    }
                }

                if (product == 'JPMC') {
                    if (req.body.jobMethod == "Standard") {
                        if ((data.data.address.includes("Brunei Muara")) || (data.data.address.includes("brunei-muara"))) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                totalPrice: 4,
                                paymentAmount: 4,
                                jobMethod: req.body.jobMethod,
                                deliveryTypeCode: "STD",
                                items: [{
                                    totalItemPrice: 4
                                }],
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }

                            if (data.data.payment_mode == "Cash") {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 4,
                                        payment_amount: 4,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 4,
                                        payment_amount: 0,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else {
                                wrongPick = 1;
                            }
                        }

                        if (((data.data.address.includes("Tutong")) || (data.data.address.includes("tutong")))
                            && (!data.data.address.includes("Brunei Muara")) && (!data.data.address.includes("brunei-muara"))) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                totalPrice: 8,
                                paymentAmount: 8,
                                jobMethod: req.body.jobMethod,
                                deliveryTypeCode: "STD",
                                items: [{
                                    totalItemPrice: 8
                                }],
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }
                            if (data.data.payment_mode == "Cash") {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 8,
                                        payment_amount: 8,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 8,
                                        payment_amount: 0,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else {
                                wrongPick = 1;
                            }

                        }
                        if ((data.data.address.includes("Belait")) || (data.data.address.includes("belait"))) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                totalPrice: 8,
                                paymentAmount: 8,
                                jobMethod: req.body.jobMethod,
                                deliveryTypeCode: "STD",
                                items: [{
                                    totalItemPrice: 8
                                }],
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }
                            if (data.data.payment_mode == "Cash") {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 8,
                                        payment_amount: 8,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 8,
                                        payment_amount: 0,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else {
                                wrongPick = 1;
                            }
                        }
                        if ((data.data.address.includes("Temburong")) || (data.data.address.includes("temburong"))) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                totalPrice: 11,
                                paymentAmount: 11,
                                jobMethod: req.body.jobMethod,
                                deliveryTypeCode: "STD",
                                items: [{
                                    totalItemPrice: 11
                                }],
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }
                            if (data.data.payment_mode == "Cash") {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 11,
                                        payment_amount: 11,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 11,
                                        payment_amount: 0,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else {
                                wrongPick = 1;
                            }
                        }
                    } else if (req.body.jobMethod == "Express") {
                        if ((data.data.address.includes("Brunei Muara")) || (data.data.address.includes("brunei-muara"))) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                totalPrice: 5.5,
                                paymentAmount: 5.5,
                                jobMethod: req.body.jobMethod,
                                deliveryTypeCode: "EXP",
                                items: [{
                                    totalItemPrice: 5.5
                                }],
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }

                            if (data.data.payment_mode == "Cash") {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 5.5,
                                        payment_amount: 5.5,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 5.5,
                                        payment_amount: 0,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else {
                                wrongPick = 1;
                            }
                        }
                    } else if ((req.body.jobMethod == "Self Collect") || (req.body.jobMethod == "Pickup")) {
                        update = {
                            lastUpdateDateTime: moment().format(),
                            totalPrice: 4,
                            paymentAmount: 4,
                            jobMethod: req.body.jobMethod,
                            deliveryTypeCode: "STD",
                            items: [{
                                totalItemPrice: 4
                            }],
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                }
                            }
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                job_type: req.body.jobMethod,
                                total_price: 4,
                                payment_amount: 4,
                            }
                        };

                        portalUpdate = "Portal and Detrack Job Method updated. ";

                        DetrackAPIrun = 1;
                        mongoDBrun = 2;

                        completeRun = 1;
                    } else {
                        wrongPick = 1;
                    }
                }

                if (product == 'LD') {
                    if ((req.body.jobMethod == "Standard Brunei Muara") || (req.body.jobMethod == "Standard Brunei-Muara")) {
                        if (data.data.weight <= 3) {
                            finalLDPrice = (5).toFixed(2)
                        } else {
                            finalLDPrice = Number(((document.getElementById("productweight").value) - 3) + 5).toFixed(2)
                        }

                        update = {
                            lastUpdateDateTime: moment().format(),
                            totalPrice: finalLDPrice,
                            paymentAmount: finalLDPrice,
                            jobMethod: req.body.jobMethod,
                            items: [{
                                totalItemPrice: finalLDPrice
                            }],
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                }
                            }
                        }

                        if (data.data.payment_mode == "Cash") {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: finalLDPrice,
                                    payment_amount: finalLDPrice,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;

                        } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: finalLDPrice,
                                    payment_amount: 0,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;
                        } else {
                            wrongPick = 1;
                        }

                    } else if (req.body.jobMethod == "Standard Tutong") {
                        if (data.data.weight <= 3) {
                            finalLDPrice = (8).toFixed(2)
                        } else {
                            finalLDPrice = Number(((document.getElementById("productweight").value) - 3) + 8).toFixed(2)
                        }

                        update = {
                            lastUpdateDateTime: moment().format(),
                            totalPrice: finalLDPrice,
                            paymentAmount: finalLDPrice,
                            jobMethod: req.body.jobMethod,
                            items: [{
                                totalItemPrice: finalLDPrice
                            }],
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                }
                            }
                        }

                        if (data.data.payment_mode == "Cash") {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: finalLDPrice,
                                    payment_amount: finalLDPrice,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;

                        } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: finalLDPrice,
                                    payment_amount: 0,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;
                        } else {
                            wrongPick = 1;
                        }


                    } else if ((req.body.jobMethod == "Standard Belait") || (req.body.jobMethod == "Standard Temburong")) {
                        if (data.data.weight <= 3) {
                            finalLDPrice = (15).toFixed(2)
                        } else {
                            finalLDPrice = Number(((document.getElementById("productweight").value) - 3) + 15).toFixed(2)
                        }

                        update = {
                            lastUpdateDateTime: moment().format(),
                            totalPrice: finalLDPrice,
                            paymentAmount: finalLDPrice,
                            jobMethod: req.body.jobMethod,
                            items: [{
                                totalItemPrice: finalLDPrice
                            }],
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                }
                            }
                        }

                        if (data.data.payment_mode == "Cash") {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: finalLDPrice,
                                    payment_amount: finalLDPrice,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;

                        } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: finalLDPrice,
                                    payment_amount: 0,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;
                        } else {
                            wrongPick = 1;
                        }

                    } else if ((req.body.jobMethod == "Express Brunei Muara") || (req.body.jobMethod == "Express Brunei-Muara")) {
                        if (data.data.weight <= 3) {
                            finalLDPrice = (7).toFixed(2)
                        } else {
                            finalLDPrice = Number(((document.getElementById("productweight").value) - 3) + 7).toFixed(2)
                        }

                        update = {
                            lastUpdateDateTime: moment().format(),
                            totalPrice: finalLDPrice,
                            paymentAmount: finalLDPrice,
                            jobMethod: req.body.jobMethod,
                            items: [{
                                totalItemPrice: finalLDPrice
                            }],
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                }
                            }
                        }

                        if (data.data.payment_mode == "Cash") {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: finalLDPrice,
                                    payment_amount: finalLDPrice,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;

                        } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: finalLDPrice,
                                    payment_amount: 0,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;
                        } else {
                            wrongPick = 1;
                        }

                    } else if ((req.body.jobMethod == "Drop off Brunei Muara") || (req.body.jobMethod == "Drop off Brunei-Muara")) {
                        if (data.data.weight <= 3) {
                            finalLDPrice = (4).toFixed(2)
                        } else {
                            finalLDPrice = Number(((document.getElementById("productweight").value) - 3) + 4).toFixed(2)
                        }

                        update = {
                            lastUpdateDateTime: moment().format(),
                            totalPrice: finalLDPrice,
                            paymentAmount: finalLDPrice,
                            jobMethod: req.body.jobMethod,
                            items: [{
                                totalItemPrice: finalLDPrice
                            }],
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                }
                            }
                        }

                        if (data.data.payment_mode == "Cash") {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: finalLDPrice,
                                    payment_amount: finalLDPrice,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;

                        } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: finalLDPrice,
                                    payment_amount: 0,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;
                        } else {
                            wrongPick = 1;
                        }

                    } else if (req.body.jobMethod == "Drop off Tutong") {
                        if (data.data.weight <= 3) {
                            finalLDPrice = (6).toFixed(2)
                        } else {
                            finalLDPrice = Number(((document.getElementById("productweight").value) - 3) + 6).toFixed(2)
                        }

                        update = {
                            lastUpdateDateTime: moment().format(),
                            totalPrice: finalLDPrice,
                            paymentAmount: finalLDPrice,
                            jobMethod: req.body.jobMethod,
                            items: [{
                                totalItemPrice: finalLDPrice
                            }],
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                }
                            }
                        }

                        if (data.data.payment_mode == "Cash") {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: finalLDPrice,
                                    payment_amount: finalLDPrice,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;

                        } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: finalLDPrice,
                                    payment_amount: 0,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;
                        } else {
                            wrongPick = 1;
                        }

                    } else if (req.body.jobMethod == "Drop off Belait") {
                        if (data.data.weight <= 3) {
                            finalLDPrice = (8).toFixed(2)
                        } else {
                            finalLDPrice = Number(((document.getElementById("productweight").value) - 3) + 8).toFixed(2)
                        }

                        update = {
                            lastUpdateDateTime: moment().format(),
                            totalPrice: finalLDPrice,
                            paymentAmount: finalLDPrice,
                            jobMethod: req.body.jobMethod,
                            items: [{
                                totalItemPrice: finalLDPrice
                            }],
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                }
                            }
                        }

                        if (data.data.payment_mode == "Cash") {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: finalLDPrice,
                                    payment_amount: finalLDPrice,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;

                        } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: finalLDPrice,
                                    payment_amount: 0,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;
                        } else {
                            wrongPick = 1;
                        }
                    } else {
                        wrongPick = 1;
                    }
                }

                if (product == 'MOH') {
                    if (req.body.jobMethod == "Standard") {
                        update = {
                            lastUpdateDateTime: moment().format(),
                            totalPrice: 4,
                            paymentAmount: 4,
                            jobMethod: req.body.jobMethod,
                            deliveryTypeCode: "STD",
                            items: [{
                                totalItemPrice: 4
                            }],
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                }
                            }
                        }

                        if (data.data.payment_mode == "Cash") {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: 4,
                                    payment_amount: 4,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;
                        } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: 4,
                                    payment_amount: 0,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;
                        } else {
                            wrongPick = 1;
                        }
                    } else if (req.body.jobMethod == "Express") {
                        if ((data.data.address.includes("Brunei Muara")) || (data.data.address.includes("brunei-muara"))) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                totalPrice: 5.5,
                                paymentAmount: 5.5,
                                jobMethod: req.body.jobMethod,
                                deliveryTypeCode: "EXP",
                                items: [{
                                    totalItemPrice: 5.5
                                }],
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }

                            if (data.data.payment_mode == "Cash") {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 5.5,
                                        payment_amount: 5.5,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 5.5,
                                        payment_amount: 0,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else {
                                wrongPick = 1;
                            }
                        }
                    } else if (req.body.jobMethod == "Immediate") {
                        if ((data.data.address.includes("Brunei Muara")) || (data.data.address.includes("brunei-muara"))) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                totalPrice: 20,
                                paymentAmount: 20,
                                jobMethod: req.body.jobMethod,
                                deliveryTypeCode: "IMM",
                                items: [{
                                    totalItemPrice: 20
                                }],
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }

                            if (data.data.payment_mode == "Cash") {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 20,
                                        payment_amount: 20,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 20,
                                        payment_amount: 0,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else {
                                wrongPick = 1;
                            }
                        }
                    } else if ((req.body.jobMethod == "Self Collect") || (req.body.jobMethod == "Pickup")) {
                        update = {
                            lastUpdateDateTime: moment().format(),
                            totalPrice: 4,
                            paymentAmount: 4,
                            jobMethod: req.body.jobMethod,
                            deliveryTypeCode: "STD",
                            items: [{
                                totalItemPrice: 4
                            }],
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                }
                            }
                        }

                        if (data.data.payment_mode == "Cash") {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: 4,
                                    payment_amount: 4,
                                }
                            };
                        } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                    total_price: 4,
                                    payment_amount: 0,
                                }
                            };
                        }

                        portalUpdate = "Portal and Detrack Job Method updated. ";

                        DetrackAPIrun = 1;
                        mongoDBrun = 2;

                        completeRun = 1;
                    } else {
                        wrongPick = 1;
                    }
                }

                if (product == 'PHC') {
                    if (req.body.jobMethod == "Standard") {
                        if ((data.data.address.includes("Brunei Muara")) || (data.data.address.includes("brunei-muara"))) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                totalPrice: 7,
                                paymentAmount: 7,
                                jobMethod: req.body.jobMethod,
                                deliveryTypeCode: "STD",
                                items: [{
                                    totalItemPrice: 7
                                }],
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }

                            if (data.data.payment_mode == "Cash") {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 7,
                                        payment_amount: 7,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 7,
                                        payment_amount: 0,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else {
                                wrongPick = 1;
                            }
                        }

                        if (((data.data.address.includes("Tutong")) || (data.data.address.includes("tutong")))
                            && (!data.data.address.includes("Brunei Muara")) && (!data.data.address.includes("brunei-muara"))) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                totalPrice: 5,
                                paymentAmount: 5,
                                jobMethod: req.body.jobMethod,
                                deliveryTypeCode: "STD",
                                items: [{
                                    totalItemPrice: 5
                                }],
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }
                            if (data.data.payment_mode == "Cash") {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 5,
                                        payment_amount: 5,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 5,
                                        payment_amount: 0,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else {
                                wrongPick = 1;
                            }

                        }
                        if ((data.data.address.includes("Belait")) || (data.data.address.includes("belait"))) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                totalPrice: 3,
                                paymentAmount: 3,
                                jobMethod: req.body.jobMethod,
                                deliveryTypeCode: "STD",
                                items: [{
                                    totalItemPrice: 3
                                }],
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }
                            if (data.data.payment_mode == "Cash") {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 3,
                                        payment_amount: 3,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 3,
                                        payment_amount: 0,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else {
                                wrongPick = 1;
                            }
                        }
                        if ((data.data.address.includes("Temburong")) || (data.data.address.includes("temburong"))) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                totalPrice: 10,
                                paymentAmount: 10,
                                jobMethod: req.body.jobMethod,
                                deliveryTypeCode: "STD",
                                items: [{
                                    totalItemPrice: 10
                                }],
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }
                            if (data.data.payment_mode == "Cash") {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 10,
                                        payment_amount: 10,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else if ((data.data.payment_mode.includes("Bank")) || (data.data.payment_mode.includes("Bill"))) {
                                var detrackUpdateData = {
                                    do_number: consignmentID,
                                    data: {
                                        job_type: req.body.jobMethod,
                                        total_price: 10,
                                        payment_amount: 0,
                                    }
                                };

                                portalUpdate = "Portal and Detrack Job Method updated. ";

                                DetrackAPIrun = 1;
                                mongoDBrun = 2;

                                completeRun = 1;
                            } else {
                                wrongPick = 1;
                            }
                        } else {
                            wrongPick = 1;
                        }
                    } else {
                        wrongPick = 1;
                    }
                }

                if (product == 'EWENS') {
                    if (req.body.jobMethod == "Standard") {
                        update = {
                            lastUpdateDateTime: moment().format(),
                            jobMethod: req.body.jobMethod,
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                }
                            }
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                job_type: req.body.jobMethod,
                            }
                        };

                        portalUpdate = "Portal and Detrack Job Method updated. ";

                        DetrackAPIrun = 1;
                        mongoDBrun = 2;

                        completeRun = 1;

                    } else if ((req.body.jobMethod == "Self Collect") || (req.body.jobMethod == "Pickup")) {
                        update = {
                            lastUpdateDateTime: moment().format(),
                            jobMethod: req.body.jobMethod,
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                }
                            }
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                job_type: req.body.jobMethod,
                            }
                        };

                        portalUpdate = "Portal and Detrack Job Method updated. ";

                        DetrackAPIrun = 1;
                        mongoDBrun = 2;

                        completeRun = 1;
                    } else {
                        wrongPick = 1;
                    }
                }

                if (product == 'TEMU') {
                    if (data.data.type == "Delivery") {
                        if (req.body.jobMethod == "Standard") {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                jobMethod: req.body.jobMethod,
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;

                        } else if ((req.body.jobMethod == "Self Collect") || (req.body.jobMethod == "Pickup")) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                jobMethod: req.body.jobMethod,
                                $push: {
                                    history: {
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        reason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                    }
                                }
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    job_type: req.body.jobMethod,
                                }
                            };

                            portalUpdate = "Portal and Detrack Job Method updated. ";

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;

                            completeRun = 1;
                        } else {
                            wrongPick = 1;
                        }
                    } else {
                        wrongPick = 1;
                    }
                }
            }

            if (req.body.statusCode == 'UWL') {
                if (((data.data.type == 'Delivery') && (data.data.status == 'at_warehouse')) || ((data.data.type == 'Delivery') && (data.data.status == 'in_sorting_area'))) {
                    if (req.body.warehouse == "Warehouse K1") {
                        update = {
                            lastUpdateDateTime: moment().format(),
                            latestLocation: req.body.warehouse,
                            room: "Open Space",
                            rackRowNum: "N/A",
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Warehouse location updated to " + req.body.warehouse + ".",
                                }
                            }
                        }

                        portalUpdate = "Warehouse location updated. ";

                        mongoDBrun = 2;

                        completeRun = 1;
                    }

                    if (req.body.warehouse == "Warehouse K2") {
                        update = {
                            lastUpdateDateTime: moment().format(),
                            latestLocation: req.body.warehouse,
                            room: req.body.k2room,
                            rackRowNum: req.body.k2row,
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Warehouse location updated to " + req.body.warehouse + ".",
                                }
                            }
                        }

                        portalUpdate = "Warehouse location updated. ";

                        mongoDBrun = 2;

                        completeRun = 1;
                    }
                }
            }

            if (req.body.statusCode == 'UGR') {
                update = {
                    lastUpdateDateTime: moment().format(),
                    grRemark: req.body.grRemark,
                    $push: {
                        history: {
                            dateUpdated: moment().format(),
                            updatedBy: req.user.name,
                            reason: "Go Rush Remark updated as " + req.body.grRemark + ".",
                        }
                    }
                }

                var detrackUpdateData = {
                    do_number: consignmentID,
                    data: {
                        instructions: req.body.grRemark
                    }
                };

                portalUpdate = "Go Rush Remark updated in Portal and Detrack. ";

                mongoDBrun = 2;
                DetrackAPIrun = 1;

                completeRun = 1;
            }

            if (req.body.statusCode == 'FCC') {
                if (product == 'MGLOBAL') {
                    if ((data.data.status == 'at_warehouse') || (data.data.status == 'in_sorting_area')) {
                        update = {
                            currentStatus: "At Warehouse",
                            lastUpdateDateTime: moment().format(),
                            latestReason: "Customer not available / cannot be contacted",
                            grRemark: "Customer not available / cannot be contacted",
                            lastUpdatedBy: req.user.name,
                            $push: {
                                history: {
                                    $each: [
                                        {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            reason: "Customer not available / cannot be contacted"
                                        },
                                        {
                                            statusHistory: "At Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                        }
                                    ]
                                }
                            }
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "failed", // Use the calculated dStatus
                                assign_to: "FL1",
                                reason: "Customer not available / cannot be contacted",
                                pod_time: moment().format("hh:mm A")
                            }
                        };

                        var detrackUpdateData2 = {
                            do_number: consignmentID,
                            data: {
                                status: "at_warehouse",
                                assign_to: ""
                            }
                        };

                        portalUpdate = "Detrack and Portal updated for Fail due to Customer not available / cannot be contacted";

                        mongoDBrun = 2;
                        DetrackAPIrun = 6;

                        completeRun = 1;
                    }
                }
            }

            if (req.body.statusCode == 'FSC') {
                if (product == 'MGLOBAL') {
                    if ((data.data.status == 'at_warehouse') || (data.data.status == 'in_sorting_area')) {
                        update = {
                            currentStatus: "At Warehouse",
                            lastUpdateDateTime: moment().format(),
                            latestReason: "Reschedule to self collect requested by customer",
                            grRemark: "Reschedule to self collect requested by customer",
                            lastUpdatedBy: req.user.name,
                            $push: {
                                history: {
                                    $each: [
                                        {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            reason: "Reschedule to self collect requested by customer"
                                        },
                                        {
                                            statusHistory: "At Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                        }
                                    ]
                                }
                            }
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "failed", // Use the calculated dStatus
                                assign_to: "FL1",
                                reason: "Reschedule to self collect requested by customer",
                                pod_time: moment().format("hh:mm A")
                            }
                        };

                        var detrackUpdateData2 = {
                            do_number: consignmentID,
                            data: {
                                status: "at_warehouse",
                                assign_to: ""
                            }
                        };

                        portalUpdate = "Detrack and Portal updated for Reschedule to self collect requested by customer";

                        mongoDBrun = 2;
                        DetrackAPIrun = 6;

                        completeRun = 1;
                    }
                }
            }

            if (req.body.statusCode == 'FIA') {
                if (product == 'MGLOBAL') {
                    if ((data.data.status == 'at_warehouse') || (data.data.status == 'in_sorting_area')) {
                        update = {
                            currentStatus: "At Warehouse",
                            lastUpdateDateTime: moment().format(),
                            latestReason: "Incorrect Address",
                            grRemark: "Incorrect Address",
                            lastUpdatedBy: req.user.name,
                            $push: {
                                history: {
                                    $each: [
                                        {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            reason: "Incorrect Address"
                                        },
                                        {
                                            statusHistory: "At Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                        }
                                    ]
                                }
                            }
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "failed", // Use the calculated dStatus
                                assign_to: "FL1",
                                reason: "Incorrect Address",
                                pod_time: moment().format("hh:mm A")
                            }
                        };

                        var detrackUpdateData2 = {
                            do_number: consignmentID,
                            data: {
                                status: "at_warehouse",
                                assign_to: ""
                            }
                        };

                        portalUpdate = "Detrack and Portal updated for Fail due to Incorrect Address";

                        mongoDBrun = 2;
                        DetrackAPIrun = 6;

                        completeRun = 1;
                    }
                }
            }

            if (completeRun == 0) {
                ceCheck = 1;
            }

            if (mongoDBrun == 1) {
                // Save the new document to the database using promises
                newOrder.save()
                    .then(savedOrder => {
                        console.log('New order saved successfully:', savedOrder);
                    })
                    .catch(err => {
                        console.error('Error saving new order:', err);
                    });
            }

            if (mongoDBrun == 2) {
                const result = await ORDERS.findOneAndUpdate(filter, update, option);
                if (result) {
                    console.log(`MongoDB Updated for Tracking Number: ${consignmentID}`);
                } else {
                    console.error(`MongoDB Update Failed for Tracking Number: ${consignmentID}`);
                }
            }

            if (DetrackAPIrun == 1) {
                await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData);
            } else {
                console.log(`DetrackAPIrun is not 1; skipping update for Tracking: ${consignmentID}`);
            }

            if (DetrackAPIrun == 2) {
                await updateDetrackStatus(consignmentID, apiKey, detrackUpdateDataAttempt, detrackUpdateData);
            }

            if (DetrackAPIrun == 3) {
                await increaseDetrackAttempt(consignmentID, apiKey, detrackUpdateDataAttempt);
            } else {
                console.log(`DetrackAPIrun is not 3; skipping attempt increase for Tracking Number: ${consignmentID}`);
            }

            if (DetrackAPIrun == 4) {
                console.log(`Starting Detrack update sequence (at_warehouse → in_sorting_area) for Tracking: ${consignmentID}`);

                // Step 1: at_warehouse
                detrackUpdateData.data.status = "at_warehouse";
                const firstSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData);

                if (firstSuccess) {
                    // Step 2: in_sorting_area (immediate - no delay needed)
                    detrackUpdateData.data.status = "in_sorting_area";
                    const secondSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData);

                    if (secondSuccess) {
                        console.log(`[COMPLETE] Both Detrack updates succeeded for Tracking: ${consignmentID}`);
                    } else {
                        console.error(`[ERROR] Second update (in_sorting_area) failed for Tracking: ${consignmentID}`);
                    }
                } else {
                    console.error(`[ERROR] First update (at_warehouse) failed for Tracking: ${consignmentID}. Second update skipped.`);
                }
            } else {
                console.log(`DetrackAPIrun is not 4; skipping updates for Tracking: ${consignmentID}`);
            }

            if (DetrackAPIrun == 5) {
                console.log(`Starting Detrack Update Sequence (At Warehouse → In Sorting Area) for Tracking: ${consignmentID}`);

                // First update: at_warehouse
                detrackUpdateData.data.status = "at_warehouse";
                const firstUpdateSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData);

                if (firstUpdateSuccess) {
                    // Prepare second update: in_sorting_area
                    detrackUpdateData2.data.status = "in_sorting_area";
                    const secondUpdateSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData2);

                    if (secondUpdateSuccess) {
                        console.log(`[COMPLETE] Both Detrack updates succeeded for Tracking Number: ${consignmentID}`);
                    } else {
                        console.error(`[ERROR] Second update (in_sorting_area) failed for Tracking Number: ${consignmentID}`);
                    }
                } else {
                    console.error(`[ERROR] First update (at_warehouse) failed for Tracking Number: ${consignmentID}. Second update skipped.`);
                }
            } else {
                console.log(`DetrackAPIrun is not 5. Skipping Detrack updates for Tracking Number: ${consignmentID}`);
            }

            if (DetrackAPIrun == 6) {
                console.log(`Starting Detrack Update Sequence for Tracking Number: ${consignmentID}`);

                const firstUpdateSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData);

                if (firstUpdateSuccess) {
                    const secondUpdateSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData2);

                    if (secondUpdateSuccess) {
                        console.log(`[COMPLETE] Both Detrack updates succeeded for Tracking Number: ${consignmentID}`);
                    } else {
                        console.error(`[ERROR] Second update (at_warehouse) failed for Tracking Number: ${consignmentID}`);
                    }
                } else {
                    console.error(`[ERROR] First update (failed delivery) failed for Tracking Number: ${consignmentID}. Second update skipped.`);
                }
            } else {
                console.log(`DetrackAPIrun is not 6. Skipping Detrack updates for Tracking Number: ${consignmentID}`);
            }

            if (DetrackAPIrun == 7) {
                console.log(`Starting Detrack Update Sequence (Date → Cancelled Status) for Tracking: ${consignmentID}`);

                // Step 1: Update Date only
                const updateDateData = {
                    do_number: consignmentID,
                    data: {
                        date: moment().format('YYYY-MM-DD')
                    }
                };

                const dateUpdateSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, updateDateData);

                if (dateUpdateSuccess) {
                    console.log(`[STEP 1 SUCCESS] Date updated for Tracking: ${consignmentID}`);

                    // Step 2: Update Status to "cancelled"
                    const updateStatusData = {
                        do_number: consignmentID,
                        data: {
                            status: "cancelled"
                        }
                    };

                    const statusUpdateSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, updateStatusData);

                    if (statusUpdateSuccess) {
                        console.log(`[COMPLETE] Date and Cancelled Status both updated for Tracking: ${consignmentID}`);
                    } else {
                        console.error(`[ERROR] Failed to update Status to "cancelled" for Tracking: ${consignmentID}`);
                    }
                } else {
                    console.error(`[ERROR] Failed to update Date for Tracking: ${consignmentID}. Status update skipped.`);
                }
            } else {
                console.log(`DetrackAPIrun is not 7; skipping Detrack update sequence for Tracking: ${consignmentID}`);
            }

            if (DetrackAPIrun == 8) {
                console.log(`Starting Detrack Update Sequence (custom_clearing → at_warehouse → in_sorting_area) for Tracking: ${consignmentID}`);

                // Step 1: custom_clearing
                detrackUpdateData.data.status = "custom_clearing";
                const firstSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData);

                if (firstSuccess) {
                    // Step 2: at_warehouse
                    // TODO: Add 30-minute delay if needed in the future
                    // console.log(`Waiting 30 minutes before at_warehouse update for ${consignmentID}`);
                    // await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000)); // 30 minutes

                    detrackUpdateData.data.status = "at_warehouse";
                    const secondSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData);

                    if (secondSuccess) {
                        // Step 3: in_sorting_area
                        detrackUpdateData.data.status = "in_sorting_area";
                        const thirdSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData);

                        if (thirdSuccess) {
                            console.log(`[COMPLETE] All three Detrack updates succeeded for Tracking: ${consignmentID}`);
                        } else {
                            console.error(`[ERROR] Third update (in_sorting_area) failed for Tracking: ${consignmentID}`);
                        }
                    } else {
                        console.error(`[ERROR] Second update (at_warehouse) failed for Tracking: ${consignmentID}. Third update skipped.`);
                    }
                } else {
                    console.error(`[ERROR] First update (custom_clearing) failed for Tracking: ${consignmentID}. Remaining updates skipped.`);
                }
            } else {
                console.log(`DetrackAPIrun is not 8; skipping updates for Tracking: ${consignmentID}`);
            }

            if (DetrackAPIrun == 10) {
                console.log(`Starting Detrack Update Sequence (on_hold → custom_clearing → at_warehouse → in_sorting_area) for Tracking: ${consignmentID}`);

                // Step 1: on_hold
                detrackUpdateData.data.status = "on_hold";
                const firstSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData);

                if (firstSuccess) {
                    // Step 2: custom_clearing
                    detrackUpdateData.data.status = "custom_clearing";
                    const secondSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData);

                    if (secondSuccess) {
                        // Step 3: at_warehouse
                        // TODO: Add 30-minute delay if needed in the future
                        // console.log(`Waiting 30 minutes before at_warehouse update for ${consignmentID}`);
                        // await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000)); // 30 minutes

                        detrackUpdateData.data.status = "at_warehouse";
                        const thirdSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData);

                        if (thirdSuccess) {
                            // Step 4: in_sorting_area
                            detrackUpdateData.data.status = "in_sorting_area";
                            const fourthSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData);

                            if (fourthSuccess) {
                                console.log(`[COMPLETE] All four Detrack updates succeeded for Tracking: ${consignmentID}`);
                            } else {
                                console.error(`[ERROR] Fourth update (in_sorting_area) failed for Tracking: ${consignmentID}`);
                            }
                        } else {
                            console.error(`[ERROR] Third update (at_warehouse) failed for Tracking: ${consignmentID}. Fourth update skipped.`);
                        }
                    } else {
                        console.error(`[ERROR] Second update (custom_clearing) failed for Tracking: ${consignmentID}. Remaining updates skipped.`);
                    }
                } else {
                    console.error(`[ERROR] First update (on_hold) failed for Tracking: ${consignmentID}. Remaining updates skipped.`);
                }
            } else {
                console.log(`DetrackAPIrun is not 10; skipping 4-step updates for Tracking: ${consignmentID}`);
            }

            // Update your GDEXAPIrun handler:
            if (GDEXAPIrun == 1) {
                console.log(`Starting GDEX Custom Clearing update for Tracking: ${consignmentID}`);

                const gdexSuccess = await updateGDEXStatus(
                    consignmentID,
                    'custom',
                    "AQ",
                    "Pending Custom Declaration",
                    "Brunei Customs"
                );

                if (gdexSuccess) {
                    console.log(`[COMPLETE] GDEX Custom Clearing update succeeded for Tracking: ${consignmentID}`);
                } else {
                    console.error(`[ERROR] GDEX Custom Clearing update failed for Tracking: ${consignmentID}`);
                }
            }

            if (GDEXAPIrun == 2) {
                console.log(`Starting GDEX 3-step warehouse updates for Tracking: ${consignmentID}`);

                const gdexSuccess = await updateGDEXStatus(
                    consignmentID,
                    'warehouse'
                );

                if (gdexSuccess) {
                    console.log(`[COMPLETE] GDEX 3-step warehouse updates succeeded for Tracking: ${consignmentID}`);
                } else {
                    console.error(`[ERROR] GDEX 3-step warehouse updates failed for Tracking: ${consignmentID}`);
                }
            }

            if (GDEXAPIrun == 3) {
                console.log(`Starting GDEX Out for Delivery update for Tracking: ${consignmentID}`);

                const gdexSuccess = await updateGDEXStatus(
                    consignmentID,
                    'out_for_delivery'
                );

                if (gdexSuccess) {
                    console.log(`[COMPLETE] GDEX Out for Delivery update succeeded for Tracking: ${consignmentID}`);
                } else {
                    console.error(`[ERROR] GDEX Out for Delivery update failed for Tracking: ${consignmentID}`);
                }
            }

            if (GDEXAPIrun == 4) {
                console.log(`Starting GDEX Self Collect update for Tracking: ${consignmentID}`);

                const gdexSuccess = await updateGDEXStatus(
                    consignmentID,
                    'self_collect'
                );

                if (gdexSuccess) {
                    console.log(`[COMPLETE] GDEX Self Collect update succeeded for Tracking: ${consignmentID}`);
                } else {
                    console.error(`[ERROR] GDEX Self Collect update failed for Tracking: ${consignmentID}`);
                }
            }

            if (GDEXAPIrun == 5) {
                console.log(`Starting GDEX Cancelled Job update for Tracking: ${consignmentID}`);

                // Check if job is already completed
                if (data.data.status === 'completed') {
                    console.error(`[SKIP] Cannot cancel already completed job: ${consignmentID}`);
                    // You might want to add an error message to processingResults
                    processingResults.push({
                        consignmentID,
                        status: `Error: Cannot cancel already completed GDEX job: ${consignmentID}`,
                    });
                    return; // Skip GDEX API call
                }

                const gdexSuccess = await updateGDEXStatus(
                    consignmentID,
                    'cancelled'
                );

                if (gdexSuccess) {
                    console.log(`[COMPLETE] GDEX Cancelled Job update succeeded for Tracking: ${consignmentID}`);
                } else {
                    console.error(`[ERROR] GDEX Cancelled Job update failed for Tracking: ${consignmentID}`);
                    // Consider adding retry logic here
                }
            }

            // In your main route where you check GDEXAPIrun == 6:
            if (GDEXAPIrun == 6) {
                console.log(`Starting GDEX Clear Job update for Tracking: ${consignmentID}`);

                // Pass the Detrack data object (data.data from your API response)
                const gdexSuccess = await updateGDEXStatus(
                    consignmentID,
                    'clear_job',
                    data.data  // This is the Detrack job data from: const data = response1.data;
                );

                if (gdexSuccess) {
                    console.log(`[COMPLETE] GDEX Clear Job update succeeded for Tracking: ${consignmentID}`);
                } else {
                    console.error(`[ERROR] GDEX Clear Job update failed for Tracking: ${consignmentID}`);
                }
            }

            if (waOrderFailedDelivery == 5) {
                let a = data.data.deliver_to_collect_from;
                let b = consignmentID;
                let c = data.data.tracking_link;
                let phoneNumber = data.data.phone_number;

                const createOrUpdateUrl = `https://api.respond.io/v2/contact/create_or_update/phone:${phoneNumber}`;
                const createOrUpdateAuthToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTA3Niwic3BhY2VJZCI6MTkyNzEzLCJvcmdJZCI6MTkyODMzLCJ0eXBlIjoiYXBpIiwiaWF0IjoxNzAyMDIxMTM4fQ.cpPpGcK8DLyyI2HUSHDcEkIcY8JzGD7DT-ogbZK5UFU';
                const createOrUpdateRequestBody = {
                    "firstName": a,
                    "phone": phoneNumber
                };

                const apiUrl = `https://api.respond.io/v2/contact/phone:${phoneNumber}/message`;
                const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTA3Niwic3BhY2VJZCI6MTkyNzEzLCJvcmdJZCI6MTkyODMzLCJ0eXBlIjoiYXBpIiwiaWF0IjoxNzAyMDIxMTM4fQ.cpPpGcK8DLyyI2HUSHDcEkIcY8JzGD7DT-ogbZK5UFU';
                const requestBody =
                {
                    "message": {
                        "type": "whatsapp_template",
                        "template": {
                            "name": "order_failed_delivery",
                            "components": [
                                {
                                    "type": "header",
                                    "format": "text",
                                    "text": "Failed Delivery"
                                },
                                {
                                    "text": `Hello ${a},\n\nWe apologize for the order with tracking number ${b} not delivered today due to insufficient time.\n\nWe are committed to ensuring your order will be delivered on the next business day.\n\nYour tracking number can be tracked on www.gorushbn.com or through this link below:\n\n${c}\n\nFor reschedule delivery trip to Tutong, Belait and Temburong or any further inquiries, please reach us via WhatsApp at *2332065* or call us at our hotline *2353259*.`,
                                    "type": "body",
                                    "parameters": [
                                        {
                                            "text": a,
                                            "type": "text"
                                        },
                                        {
                                            "text": b,
                                            "type": "text"
                                        },
                                        {
                                            "text": c,
                                            "type": "text"
                                        }
                                    ]
                                },
                                {
                                    "text": "Go Rush Express",
                                    "type": "footer"
                                }
                            ],
                            "languageCode": "en"
                        }
                    },
                    "channelId": 209602
                }

                // Make the API call to create or update contact information
                axios.post(createOrUpdateUrl, createOrUpdateRequestBody, {
                    headers: {
                        'Authorization': `Bearer ${createOrUpdateAuthToken}`,
                        'Content-Type': 'application/json'
                    }
                })
                    .then(response => {
                        console.log('Contact information created or updated successfully:', response.data);

                        // Introduce a delay of 10 seconds before proceeding with the next API call
                        setTimeout(() => {
                            axios.post(apiUrl, requestBody, {
                                headers: {
                                    'Authorization': `Bearer ${authToken}`,
                                    'Content-Type': 'application/json'
                                }
                            })
                                .then(response => {
                                    console.log('Message sent successfully:', response.data);
                                })
                                .catch(error => {
                                    console.error('Error sending message:', error.response.data);
                                });
                        }, 10000); // 10 seconds delay
                    })
                    .catch(error => {
                        console.error('Error creating or updating contact information:', error.response.data);
                    });
            }

            if (waOrderCompletedFeedback == 5) {
                let a = data.data.deliver_to_collect_from;
                let b = consignmentID;
                let c = data.data.tracking_link;
                let phoneNumber = data.data.phone_number;

                const createOrUpdateUrl = `https://api.respond.io/v2/contact/create_or_update/phone:${phoneNumber}`;
                const createOrUpdateAuthToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTA3Niwic3BhY2VJZCI6MTkyNzEzLCJvcmdJZCI6MTkyODMzLCJ0eXBlIjoiYXBpIiwiaWF0IjoxNzAyMDIxMTM4fQ.cpPpGcK8DLyyI2HUSHDcEkIcY8JzGD7DT-ogbZK5UFU';
                const createOrUpdateRequestBody = {
                    "firstName": a,
                    "phone": phoneNumber
                };

                const apiUrl = `https://api.respond.io/v2/contact/phone:${phoneNumber}/message`;
                const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTA3Niwic3BhY2VJZCI6MTkyNzEzLCJvcmdJZCI6MTkyODMzLCJ0eXBlIjoiYXBpIiwiaWF0IjoxNzAyMDIxMTM4fQ.cpPpGcK8DLyyI2HUSHDcEkIcY8JzGD7DT-ogbZK5UFU';
                const requestBody =
                {
                    "message": {
                        "type": "whatsapp_template",
                        "template": {
                            "name": "order_completed_feedback",
                            "components": [
                                {
                                    "type": "header",
                                    "format": "text",
                                    "text": "Order Completed"
                                },
                                {
                                    "text": `Hello ${a},\n\nWe are thankful for selecting us as your delivery service for the order with tracking number ${b}.\n\nWe kindly request a moment of your time to rate and provide comments on our service by clicking the link below:\n\n${c}\n\nYour cooperation and feedback are highly valued as they contribute to our continuous improvement efforts.\n\nHave a pleasant day ahead!`,
                                    "type": "body",
                                    "parameters": [
                                        {
                                            "text": a,
                                            "type": "text"
                                        },
                                        {
                                            "text": b,
                                            "type": "text"
                                        },
                                        {
                                            "text": c,
                                            "type": "text"
                                        }
                                    ]
                                },
                                {
                                    "text": "Go Rush Express",
                                    "type": "footer"
                                }
                            ],
                            "languageCode": "en"
                        }
                    },
                    "channelId": 209602
                }

                // Make the API call to create or update contact information
                axios.post(createOrUpdateUrl, createOrUpdateRequestBody, {
                    headers: {
                        'Authorization': `Bearer ${createOrUpdateAuthToken}`,
                        'Content-Type': 'application/json'
                    }
                })
                    .then(response => {
                        console.log('Contact information created or updated successfully:', response.data);

                        // Introduce a delay of 10 seconds before proceeding with the next API call
                        setTimeout(() => {
                            axios.post(apiUrl, requestBody, {
                                headers: {
                                    'Authorization': `Bearer ${authToken}`,
                                    'Content-Type': 'application/json'
                                }
                            })
                                .then(response => {
                                    console.log('Message sent successfully:', response.data);
                                })
                                .catch(error => {
                                    console.error('Error sending message:', error.response.data);
                                });
                        }, 10000); // 10 seconds delay
                    })
                    .catch(error => {
                        console.error('Error creating or updating contact information:', error.response.data);
                    });
            }

            if (ceCheck == 0) {
                // If processing is successful, add a success message to the results array
                processingResults.push({
                    consignmentID,
                    status: portalUpdate,
                });
            }
            else if ((ceCheck == 0) && (maxAttempt == 1)) {
                processingResults.push({
                    consignmentID,
                    status: `Error: Tracking Number have reached the max attempts. Please check with manager for next decision.`,
                });
            }
            else if ((ceCheck == 0) && (maxAttempt == 2)) {
                processingResults.push({
                    consignmentID,
                    status: `Error: Tracking Number have reached the max attempts for collection. Only drop off will be accepted.`,
                });
            }
            else if ((ceCheck == 0) && (wrongPick == 1)) {
                processingResults.push({
                    consignmentID,
                    status: `Error: Your selection earlier is not available for the product type of the Tracking Number.`,
                });
            }
            else {
                processingResults.push({
                    consignmentID,
                    status: `Error: Tracking Number is not updated properly according to flow. The current Detrack status is ${currentDetrackStatus} and the status code applied is ${appliedStatus}`,
                });
            }

        } catch (error) {
            // Handle error
            if (error.message.includes(500)) {
                processingResults.push({
                    consignmentID,
                    status: 'Error: FMX Consignment Number does not exist or already completed',
                });
            }
            if (error.message.includes(404)) {
                processingResults.push({
                    consignmentID,
                    status: 'Error: Tracking Number does not exist in Detrack',
                });
            }
            continue; // Move to the next consignmentID
        }
    }
    res.redirect('/successUpdate'); // Redirect to the successUpdate page test
});

app.post('/reorder', ensureAuthenticated, async (req, res) => {
    try {
        const { trackingNumber, jobMethod, paymentMethod, remarks } = req.body;

        if ((jobMethod == "Standard") || (jobMethod == "Self Collect")) {
            var deliveryTypeCode = "STD";
            var startDate = moment().add(2, 'days').format('YYYY-MM-DD');  // 2 days from now
        } else if (jobMethod == "Express") {
            var deliveryTypeCode = "EXP";
            var startDate = moment().add(1, 'day').format('YYYY-MM-DD');   // 1 day from now
        } else if (jobMethod == "Immediate") {
            var deliveryTypeCode = "IMM";
            var startDate = moment().format('YYYY-MM-DD');                 // Today
        }

        // Check if the tracking number exists
        const order = await ORDERS.findOne({ doTrackingNumber: trackingNumber });

        if (!order) {
            return res.json({ success: false, message: 'Order not found' });
        }

        // Prepare data for Make (formerly Integromat)
        const makeData = {
            area: order.area,
            icNum: order.icNum,
            items: [
                {
                    quantity: 1,
                    description: "Medicine",
                    totalItemPrice: getPrice(jobMethod)
                }
            ],
            remarks,
            passport: order.passport,
            attempt: 1,
            jobType: order.jobType,
            product: order.product,
            icPassNum: order.icPassNum,
            jobMethod,
            startDate,  // Use the calculated start date based on jobMethod
            jobDate: "N/A",
            totalPrice: getPrice(jobMethod),
            dateOfBirth: order.dateOfBirth,
            sendOrderTo: order.sendOrderTo,
            creationDate: moment().format('YYYY-MM-DD'),
            receiverName: order.receiverName,
            trackingLink: "N/A",
            currentStatus: "Info Received",
            patientNumber: order.patientNumber,
            payingPatient: order.payingPatient,
            paymentamount: getPrice(jobMethod),
            paymentMethod,
            receiverEmail: order.receiverEmail,
            warehouseEntry: "No",
            receiverAddress: order.receiverAddress,
            appointmentPlace: order.appointmentPlace,
            deliveryTypeCode,
            dateTimeSubmission: moment().utcOffset('+08:00').format('DD-MM-YYYY hh:mm a'),
            lastUpdateDateTime: moment().utcOffset('+08:00'),
            receiverPostalCode: order.receiverPostalCode,
            appointmentDistrict: order.appointmentDistrict,
            pharmacyFormCreated: "No",
            receiverPhoneNumber: order.receiverPhoneNumber,
            additionalPhoneNumber: order.additionalPhoneNumber,
            warehouseEntryDateTime: "N/A"
        };

        // Replace with your actual Make webhook URL
        const makeWebhookUrl = 'https://hook.eu1.make.com/akvb1wvtd9qpe3uku983aso4ipzec2op';

        // Make the request to Make using axios
        const response = await axios.post(makeWebhookUrl, makeData, {
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (response.status === 200) {
            return res.json({ success: true, message: 'Order is submitted' });
        } else {
            return res.json({ success: false, message: 'Failed to submit to Make' });
        }
    } catch (error) {
        console.error('Error processing reorder:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

function getPrice(jobMethod) {
    switch (jobMethod) {
        case 'Standard': return 4;
        case 'Express': return 5.5;
        case 'Immediate': return 20;
        case 'Self Collect': return 4;
        default: return 0;
    }
}

const queue = [];
let isProcessing = false;

// Watch for new order inserts
orderWatch.on('change', async (change) => {
    if (change.operationType === "insert") {
        queue.push(change);
        if (!isProcessing) {
            processQueue();
        }
    }
});

async function processQueue() {
    isProcessing = true;

    while (queue.length > 0) {
        const currentChange = queue.shift();
        await handleOrderChange(currentChange);
    }

    isProcessing = false;
}

async function checkNonCodArea(order, trackingNumber) {
    try {
        let address = order.area ? order.area.toUpperCase() : "N/A";
        let finalArea = "";

        address = data.data.address.toUpperCase();

        if (address.includes("MANGGIS") == true) { area = "B", kampong = "MANGGIS" }
        else if (address.includes("DELIMA") == true) { area = "B", kampong = "DELIMA" }
        else if (address.includes("ANGGREK DESA") == true) { area = "B", kampong = "ANGGREK DESA" }
        else if (address.includes("ANGGREK") == true) { area = "B", kampong = "ANGGREK DESA" }
        else if (address.includes("PULAIE") == true) { area = "B", kampong = "PULAIE" }
        else if (address.includes("LAMBAK") == true) { area = "B", kampong = "LAMBAK" }
        else if (address.includes("TERUNJING") == true) { area = "B", kampong = "TERUNJING" }
        else if (address.includes("MADANG") == true) { area = "B", kampong = "MADANG" }
        else if (address.includes("AIRPORT") == true) { area = "B", kampong = "AIRPORT" }
        else if (address.includes("ORANG KAYA BESAR IMAS") == true) { area = "B", kampong = "OKBI" }
        else if (address.includes("OKBI") == true) { area = "B", kampong = "OKBI" }
        else if (address.includes("SERUSOP") == true) { area = "B", kampong = "SERUSOP" }
        else if (address.includes("BURONG PINGAI") == true) { area = "B", kampong = "BURONG PINGAI" }
        else if (address.includes("SETIA NEGARA") == true) { area = "B", kampong = "SETIA NEGARA" }
        else if (address.includes("PASIR BERAKAS") == true) { area = "B", kampong = "PASIR BERAKAS" }
        else if (address.includes("MENTERI BESAR") == true) { area = "B", kampong = "MENTERI BESAR" }
        else if (address.includes("KEBANGSAAN LAMA") == true) { area = "B", kampong = "KEBANGSAAN LAMA" }
        else if (address.includes("BATU MARANG") == true) { area = "B", kampong = "BATU MARANG" }
        else if (address.includes("DATO GANDI") == true) { area = "B", kampong = "DATO GANDI" }
        else if (address.includes("KAPOK") == true) { area = "B", kampong = "KAPOK" }
        else if (address.includes("KOTA BATU") == true) { area = "B", kampong = "KOTA BATU" }
        else if (address.includes("MENTIRI") == true) { area = "B", kampong = "MENTIRI" }
        else if (address.includes("MERAGANG") == true) { area = "B", kampong = "MERAGANG" }
        else if (address.includes("PELAMBAIAN") == true) { area = "B", kampong = "PELAMBAIAN" }
        else if (address.includes("PINTU MALIM") == true) { area = "B", kampong = "PINTU MALIM" }
        else if (address.includes("SALAMBIGAR") == true) { area = "B", kampong = "SALAMBIGAR" }
        else if (address.includes("SALAR") == true) { area = "B", kampong = "SALAR" }
        else if (address.includes("SERASA") == true) { area = "B", kampong = "SERASA" }
        else if (address.includes("SERDANG") == true) { area = "B", kampong = "SERDANG" }
        else if (address.includes("SUNGAI BASAR") == true) { area = "B", kampong = "SUNGAI BASAR" }
        else if (address.includes("SG BASAR") == true) { area = "B", kampong = "SUNGAI BASAR" }
        else if (address.includes("SUNGAI BELUKUT") == true) { area = "B", kampong = "SUNGAI BELUKUT" }
        else if (address.includes("SG BELUKUT") == true) { area = "B", kampong = "SUNGAI BELUKUT" }
        else if (address.includes("SUNGAI HANCHING") == true) { area = "B", kampong = "SUNGAI HANCHING" }
        else if (address.includes("SG HANCHING") == true) { area = "B", kampong = "SUNGAI HANCHING" }
        else if (address.includes("SUNGAI TILONG") == true) { area = "B", kampong = "SUNGAI TILONG" }
        else if (address.includes("SG TILONG") == true) { area = "B", kampong = "SUNGAI TILONG" }
        else if (address.includes("SUBOK") == true) { area = "B", kampong = "SUBOK" }
        else if (address.includes("SUNGAI AKAR") == true) { area = "B", kampong = "SUNGAI AKAR" }
        else if (address.includes("SG AKAR") == true) { area = "B", kampong = "SUNGAI AKAR" }
        else if (address.includes("SUNGAI BULOH") == true) { area = "B", kampong = "SUNGAI BULOH" }
        else if (address.includes("SG BULOH") == true) { area = "B", kampong = "SUNGAI BULOH" }
        else if (address.includes("TANAH JAMBU") == true) { area = "B", kampong = "TANAH JAMBU" }
        else if (address.includes("SUNGAI OROK") == true) { area = "B", kampong = "SUNGAI OROK" }
        else if (address.includes("SG OROK") == true) { area = "B", kampong = "SUNGAI OROK" }
        else if (address.includes("KATOK") == true) { area = "G", kampong = "KATOK" }
        else if (address.includes("MATA-MATA") == true) { area = "G", kampong = "MATA-MATA" }
        else if (address.includes("MATA MATA") == true) { area = "G", kampong = "MATA-MATA" }
        else if (address.includes("RIMBA") == true) { area = "G", kampong = "RIMBA" }
        else if (address.includes("TUNGKU") == true) { area = "G", kampong = "TUNGKU" }
        else if (address.includes("UBD") == true) { area = "G", kampong = "UBD" }
        else if (address.includes("UNIVERSITI BRUNEI DARUSSALAM") == true) { area = "G", kampong = "UBD" }
        else if (address.includes("JIS") == true) { area = "G" }
        else if (address.includes("JERUDONG INTERNATIONAL SCHOOL") == true) { area = "G", kampong = "JIS" }
        else if (address.includes("BERANGAN") == true) { area = "G", kampong = "BERANGAN" }
        else if (address.includes("BERIBI") == true) { area = "G", kampong = "BERIBI" }
        else if (address.includes("KIULAP") == true) { area = "G", kampong = "KIULAP" }
        else if (address.includes("RIPAS") == true) { area = "G", kampong = "RIPAS" }
        else if (address.includes("RAJA ISTERI PENGIRAN ANAK SALLEHA") == true) { area = "G", kampong = "RIPAS" }
        else if (address.includes("KIARONG") == true) { area = "G", kampong = "KIARONG" }
        else if (address.includes("PUSAR ULAK") == true) { area = "G", kampong = "PUSAR ULAK" }
        else if (address.includes("KUMBANG PASANG") == true) { area = "G", kampong = "KUMBANG PASANG" }
        else if (address.includes("MENGLAIT") == true) { area = "G", kampong = "MENGLAIT" }
        else if (address.includes("MABOHAI") == true) { area = "G", kampong = "MABOHAI" }
        else if (address.includes("ONG SUM PING") == true) { area = "G", kampong = "ONG SUM PING" }
        else if (address.includes("GADONG") == true) { area = "G", kampong = "GADONG" }
        else if (address.includes("TASEK LAMA") == true) { area = "G", kampong = "TASEK LAMA" }
        else if (address.includes("BANDAR TOWN") == true) { area = "G", kampong = "BANDAR TOWN" }
        else if (address.includes("BATU SATU") == true) { area = "JT", kampong = "BATU SATU" }
        else if (address.includes("BENGKURONG") == true) { area = "JT", kampong = "BENGKURONG" }
        else if (address.includes("BUNUT") == true) { area = "JT", kampong = "BUNUT" }
        else if (address.includes("JALAN BABU RAJA") == true) { area = "JT", kampong = "JALAN BABU RAJA" }
        else if (address.includes("JALAN ISTANA") == true) { area = "JT", kampong = "JALAN ISTANA" }
        else if (address.includes("JUNJONGAN") == true) { area = "JT", kampong = "JUNJONGAN" }
        else if (address.includes("KASAT") == true) { area = "JT", kampong = "KASAT" }
        else if (address.includes("LUMAPAS") == true) { area = "JT", kampong = "LUMAPAS" }
        else if (address.includes("JALAN HALUS") == true) { area = "JT", kampong = "JALAN HALUS" }
        else if (address.includes("MADEWA") == true) { area = "JT", kampong = "MADEWA" }
        else if (address.includes("PUTAT") == true) { area = "JT", kampong = "PUTAT" }
        else if (address.includes("SINARUBAI") == true) { area = "JT", kampong = "SINARUBAI" }
        else if (address.includes("TASEK MERADUN") == true) { area = "JT", kampong = "TASEK MERADUN" }
        else if (address.includes("TELANAI") == true) { area = "JT", kampong = "TELANAI" }
        else if (address.includes("BAN 1") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BAN 2") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BAN 3") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BAN 4") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BAN 5") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BAN 6") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BATONG") == true) { area = "JT", kampong = "BATONG" }
        else if (address.includes("BATU AMPAR") == true) { area = "JT", kampong = "BATU AMPAR" }
        else if (address.includes("BEBATIK") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
        else if (address.includes("BEBULOH") == true) { area = "JT", kampong = "BEBULOH" }
        else if (address.includes("BEBATIK KILANAS") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
        else if (address.includes("KILANAS") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
        else if (address.includes("DADAP") == true) { area = "JT", kampong = "DADAP" }
        else if (address.includes("KUALA LURAH") == true) { area = "JT", kampong = "KUALA LURAH" }
        else if (address.includes("KULAPIS") == true) { area = "JT", kampong = "KULAPIS" }
        else if (address.includes("LIMAU MANIS") == true) { area = "JT", kampong = "LIMAU MANIS" }
        else if (address.includes("MASIN") == true) { area = "JT", kampong = "MASIN" }
        else if (address.includes("MULAUT") == true) { area = "JT", kampong = "MULAUT" }
        else if (address.includes("PANCHOR MURAI") == true) { area = "JT", kampong = "PANCHOR MURAI" }
        else if (address.includes("PANCHUR MURAI") == true) { area = "JT", kampong = "PANCHOR MURAI" }
        else if (address.includes("PANGKALAN BATU") == true) { area = "JT", kampong = "PANGKALAN BATU" }
        else if (address.includes("PASAI") == true) { area = "JT", kampong = "PASAI" }
        else if (address.includes("WASAN") == true) { area = "JT", kampong = "WASAN" }
        else if (address.includes("PARIT") == true) { area = "JT", kampong = "PARIT" }
        else if (address.includes("EMPIRE") == true) { area = "JT", kampong = "EMPIRE" }
        else if (address.includes("JANGSAK") == true) { area = "JT", kampong = "JANGSAK" }
        else if (address.includes("JERUDONG") == true) { area = "JT", kampong = "JERUDONG" }
        else if (address.includes("KATIMAHAR") == true) { area = "JT", kampong = "KATIMAHAR" }
        else if (address.includes("LUGU") == true) { area = "JT", kampong = "LUGU" }
        else if (address.includes("SENGKURONG") == true) { area = "JT", kampong = "SENGKURONG" }
        else if (address.includes("TANJONG NANGKA") == true) { area = "JT", kampong = "TANJONG NANGKA" }
        else if (address.includes("TANJONG BUNUT") == true) { area = "JT", kampong = "TANJONG BUNUT" }
        else if (address.includes("TANJUNG BUNUT") == true) { area = "JT", kampong = "TANJONG BUNUT" }
        else if (address.includes("SUNGAI TAMPOI") == true) { area = "JT", kampung = "SUNGAI TAMPOI" }
        else if (address.includes("SG TAMPOI") == true) { area = "JT", kampong = "SUNGAI TAMPOI" }
        else if (address.includes("MUARA") == true) { area = "B", kampong = "MUARA" }
        //TU
        else if (address.includes("SENGKARAI") == true) { area = "TUTONG", kampong = "SENGKARAI" }
        else if (address.includes("PANCHOR") == true) { area = "TUTONG", kampong = "PANCHOR" }
        else if (address.includes("PENABAI") == true) { area = "TUTONG", kampong = "PENABAI" }
        else if (address.includes("KUALA TUTONG") == true) { area = "TUTONG", kampong = "KUALA TUTONG" }
        else if (address.includes("PENANJONG") == true) { area = "TUTONG", kampong = "PENANJONG" }
        else if (address.includes("KERIAM") == true) { area = "TUTONG", kampong = "KERIAM" }
        else if (address.includes("BUKIT PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
        else if (address.includes("PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
        else if (address.includes("LUAGAN") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
        else if (address.includes("DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
        else if (address.includes("LUAGAN DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
        else if (address.includes("SINAUT") == true) { area = "TUTONG", kampong = "SINAUT" }
        else if (address.includes("SUNGAI KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
        else if (address.includes("KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
        else if (address.includes("SG KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
        else if (address.includes("KUPANG") == true) { area = "TUTONG", kampong = "KUPANG" }
        else if (address.includes("KIUDANG") == true) { area = "TUTONG", kampong = "KIUDANG" }
        else if (address.includes("PAD") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
        else if (address.includes("NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
        else if (address.includes("PAD NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
        else if (address.includes("BEKIAU") == true) { area = "TUTONG", kampong = "BEKIAU" }
        else if (address.includes("MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
        else if (address.includes("PENGKALAN MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
        else if (address.includes("BATANG MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
        else if (address.includes("MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
        else if (address.includes("KEBIA") == true) { area = "TUTONG", kampong = "KEBIA" }
        else if (address.includes("BIRAU") == true) { area = "TUTONG", kampong = "BIRAU" }
        else if (address.includes("LAMUNIN") == true) { area = "TUTONG", kampong = "LAMUNIN" }
        else if (address.includes("LAYONG") == true) { area = "TUTONG", kampong = "LAYONG" }
        else if (address.includes("MENENGAH") == true) { area = "TUTONG", kampong = "MENENGAH" }
        else if (address.includes("PANCHONG") == true) { area = "TUTONG", kampong = "PANCHONG" }
        else if (address.includes("PENAPAR") == true) { area = "TUTONG", kampong = "PANAPAR" }
        else if (address.includes("TANJONG MAYA") == true) { area = "TUTONG", kampong = "TANJONG MAYA" }
        else if (address.includes("MAYA") == true) { area = "TUTONG", kampong = "MAYA" }
        else if (address.includes("LUBOK") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
        else if (address.includes("PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
        else if (address.includes("LUBOK PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
        else if (address.includes("BUKIT UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
        else if (address.includes("UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
        else if (address.includes("RAMBAI") == true) { area = "TUTONG", kampong = "RAMBAI" }
        else if (address.includes("BENUTAN") == true) { area = "TUTONG", kampong = "BENUTAN" }
        else if (address.includes("MERIMBUN") == true) { area = "TUTONG", kampong = "MERIMBUN" }
        else if (address.includes("UKONG") == true) { area = "TUTONG", kampong = "UKONG" }
        else if (address.includes("LONG") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
        else if (address.includes("MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
        else if (address.includes("LONG MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
        else if (address.includes("TELISAI") == true) { area = "TUTONG", kampong = "TELISAI" }
        else if (address.includes("DANAU") == true) { area = "TUTONG", kampong = "DANAU" }
        else if (address.includes("BUKIT BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
        else if (address.includes("BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
        else if (address.includes("TUTONG") == true) { area = "TUTONG", kampong = "TUTONG" }
        //KB
        else if (address.includes("AGIS") == true) { area = "LUMUT", kampong = "AGIS" }
        else if (address.includes("ANDALAU") == true) { area = "LUMUT", kampong = "ANDALAU" }
        else if (address.includes("ANDUKI") == true) { area = "LUMUT", kampong = "ANDUKI" }
        else if (address.includes("APAK") == true) { area = "KB / SERIA", kampong = "APAK" }
        else if (address.includes("BADAS") == true) { area = "LUMUT", kampong = "BADAS" }
        else if (address.includes("BANG") == true) { area = "KB / SERIA", kampong = "BANG" }
        else if (address.includes("GARANG") == true) { area = "KB / SERIA", kampong = "GARANG" }
        else if (address.includes("PUKUL") == true) { area = "KB / SERIA", kampong = "PUKUL" }
        else if (address.includes("TAJUK") == true) { area = "KB / SERIA", kampong = "TAJUK" }
        else if (address.includes("BENGERANG") == true) { area = "KB / SERIA", kampong = "BENGERANG" }
        else if (address.includes("BIADONG") == true) { area = "KB / SERIA", kampong = "BIADONG" }
        else if (address.includes("ULU") == true) { area = "KB / SERIA", kampong = "ULU" }
        else if (address.includes("TENGAH") == true) { area = "KB / SERIA", kampong = "TENGAH" }
        else if (address.includes("BISUT") == true) { area = "KB / SERIA", kampong = "BISUT" }
        else if (address.includes("BUAU") == true) { area = "KB / SERIA", kampong = "BUAU" }
        else if (address.includes("KANDOL") == true) { area = "KB / SERIA", kampong = "KANDOL" }
        else if (address.includes("PUAN") == true) { area = "KB / SERIA", kampong = "PUAN" }
        else if (address.includes("TUDING") == true) { area = "LUMUT", kampong = "TUDING" }
        else if (address.includes("SAWAT") == true) { area = "KB / SERIA", kampong = "SAWAT" }
        else if (address.includes("SERAWONG") == true) { area = "KB / SERIA", kampong = "SERAWONG" }
        else if (address.includes("CHINA") == true) { area = "KB / SERIA", kampong = "CHINA" }
        else if (address.includes("DUGUN") == true) { area = "KB / SERIA", kampong = "DUGUN" }
        else if (address.includes("GATAS") == true) { area = "KB / SERIA", kampong = "GATAS" }
        else if (address.includes("JABANG") == true) { area = "KB / SERIA", kampong = "JABANG" }
        else if (address.includes("KAGU") == true) { area = "KB / SERIA", kampong = "KAGU" }
        else if (address.includes("KAJITAN") == true) { area = "KB / SERIA", kampong = "KAJITAN" }
        else if (address.includes("KELUYOH") == true) { area = "KB / SERIA", kampong = "KELUYOH" }
        else if (address.includes("KENAPOL") == true) { area = "KB / SERIA", kampong = "KENAPOL" }
        else if (address.includes("KUALA BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
        else if (address.includes("BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
        else if (address.includes("KUALA BELAIT") == true) { area = "KB", kampong = "KUALA BELAIT" }
        else if (address.includes("KUKUB") == true) { area = "KB / SERIA", kampong = "KUKUB" }
        else if (address.includes("LABI") == true) { area = "LUMUT", kampong = "LABI" }
        else if (address.includes("LAKANG") == true) { area = "KB / SERIA", kampong = "LAKANG" }
        else if (address.includes("LAONG ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
        else if (address.includes("ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
        else if (address.includes("LAONG") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
        else if (address.includes("LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
        else if (address.includes("SUNGAI LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
        else if (address.includes("SG LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
        else if (address.includes("LUMUT") == true) { area = "LUMUT", kampong = "LUMUT" }
        else if (address.includes("LORONG") == true) { area = "SERIA", kampong = "LORONG" }
        else if (address.includes("LORONG TENGAH") == true) { area = "SERIA", kampong = "LORONG TENGAH" }
        else if (address.includes("LORONG TIGA SELATAN") == true) { area = "SERIA", kampong = "LORONG TIGA SELATAN" }
        else if (address.includes("LILAS") == true) { area = "KB / SERIA", kampong = "LILAS" }
        else if (address.includes("LUBUK LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
        else if (address.includes("LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
        else if (address.includes("LUBUK TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
        else if (address.includes("TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
        else if (address.includes("MALA'AS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
        else if (address.includes("MALAAS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
        else if (address.includes("MALAYAN") == true) { area = "KB / SERIA", kampong = "MELAYAN" }
        else if (address.includes("MELAYU") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
        else if (address.includes("ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
        else if (address.includes("MELAYU ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
        else if (address.includes("MELILAS") == true) { area = "LUMUT", kampong = "MELILAS" }
        else if (address.includes("MENDARAM") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
        else if (address.includes("MENDARAM BESAR") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
        else if (address.includes("MENDARAM KECIL") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
        else if (address.includes("MERANGKING") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
        else if (address.includes("MERANGKING ULU") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
        else if (address.includes("MERANGKING HILIR") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
        else if (address.includes("MUMONG") == true) { area = "KB", kampong = "MUMONG" }
        else if (address.includes("PANDAN") == true) { area = "KB", kampong = "PANDAN" }
        else if (address.includes("PADANG") == true) { area = "KB", kampong = "PADANG" }
        else if (address.includes("PANAGA") == true) { area = "SERIA", kampong = "PANAGA" }
        else if (address.includes("PENGKALAN SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
        else if (address.includes("SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
        else if (address.includes("PENGALAYAN") == true) { area = "KB / SERIA", kampong = "PENGALAYAN" }
        else if (address.includes("PENYRAP") == true) { area = "KB / SERIA", kampong = "PENYRAP" }
        else if (address.includes("PERANGKONG") == true) { area = "KB / SERIA", kampong = "PERANGKONG" }
        else if (address.includes("PERUMPONG") == true) { area = "LUMUT", kampong = "PERUMPONG" }
        else if (address.includes("PESILIN") == true) { area = "KB / SERIA", kampong = "PESILIN" }
        else if (address.includes("PULAU APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
        else if (address.includes("APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
        else if (address.includes("RAMPAYOH") == true) { area = "KB / SERIA", kampong = "RAMPAYOH" }
        else if (address.includes("RATAN") == true) { area = "KB / SERIA", kampong = "RATAN" }
        else if (address.includes("SAUD") == true) { area = "KB / SERIA", kampong = "SAUD" }
        //else if (address.includes("SIMPANG") == true) {area = "KB / SERIA", kampong = "SIMPANG TIGA"}
        else if (address.includes("SIMPANG TIGA") == true) { area = "LUMUT", kampong = "SIMPANG TIGA" }
        else if (address.includes("SINGAP") == true) { area = "KB / SERIA", kampong = "SINGAP" }
        else if (address.includes("SUKANG") == true) { area = "KB / SERIA", kampong = "SUKANG" }
        else if (address.includes("BAKONG") == true) { area = "LUMUT", kampong = "BAKONG" }
        else if (address.includes("DAMIT") == true) { area = "KB / SERIA", kampong = "DAMIT" }
        else if (address.includes("BERA") == true) { area = "KB / SERIA", kampong = "BERA" }
        else if (address.includes("DUHON") == true) { area = "KB / SERIA", kampong = "DUHON" }
        else if (address.includes("GANA") == true) { area = "LUMUT", kampong = "GANA" }
        else if (address.includes("HILIR") == true) { area = "KB / SERIA", kampong = "HILIR" }
        else if (address.includes("KANG") == true) { area = "LUMUT", kampong = "KANG" }
        else if (address.includes("KURU") == true) { area = "LUMUT", kampong = "KURU" }
        else if (address.includes("LALIT") == true) { area = "LUMUT", kampong = "LALIT" }
        else if (address.includes("LUTONG") == true) { area = "KB / SERIA", kampong = "LUTONG" }
        else if (address.includes("MAU") == true) { area = "KB / SERIA", kampong = "MAU" }
        else if (address.includes("MELILIT") == true) { area = "KB / SERIA", kampong = "MELILIT" }
        else if (address.includes("PETAI") == true) { area = "KB / SERIA", kampong = "PETAI" }
        else if (address.includes("TALI") == true) { area = "LUMUT", kampong = "TALI" }
        else if (address.includes("TARING") == true) { area = "LUMUT", kampong = "TARING" }
        else if (address.includes("TERABAN") == true) { area = "KB", kampong = "TERABAN" }
        else if (address.includes("UBAR") == true) { area = "KB / SERIA", kampong = "UBAR" }
        else if (address.includes("TANAJOR") == true) { area = "KB / SERIA", kampong = "TANAJOR" }
        else if (address.includes("TANJONG RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
        else if (address.includes("RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
        else if (address.includes("TANJONG SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
        else if (address.includes("SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
        else if (address.includes("TAPANG LUPAK") == true) { area = "KB / SERIA", kampong = "TAPANG LUPAK" }
        else if (address.includes("TEMPINAK") == true) { area = "KB / SERIA", kampong = "TEMPINAK" }
        else if (address.includes("TERAJA") == true) { area = "KB / SERIA", kampong = "TERAJA" }
        else if (address.includes("TERAWAN") == true) { area = "KB / SERIA", kampong = "TERAWAN" }
        else if (address.includes("TERUNAN") == true) { area = "KB / SERIA", kampong = "TERUNAN" }
        else if (address.includes("TUGONG") == true) { area = "KB / SERIA", kampong = "TUGONG" }
        else if (address.includes("TUNGULLIAN") == true) { area = "LUMUT", kampong = "TUNGULLIAN" }
        else if (address.includes("UBOK") == true) { area = "KB / SERIA", kampong = "UBOK" }
        else if (address.includes("BELAIT") == true) { area = "KB / SERIA", kampong = "BELAIT" }
        else if (address.includes("SERIA") == true) { area = "KB / SERIA", kampong = "BELAIT" }
        //TE
        else if (address.includes("AMO") == true) { area = "TEMBURONG", kampong = "AMO" }
        else if (address.includes("AYAM-AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
        else if (address.includes("AYAM AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
        else if (address.includes("BAKARUT") == true) { area = "TEMBURONG", kampong = "BAKARUT" }
        else if (address.includes("BATANG DURI") == true) { area = "TEMBURONG", kampong = "BATANG DURI" }
        else if (address.includes("BATANG TUAU") == true) { area = "TEMBURONG", kampong = "BATANG TUAU" }
        else if (address.includes("BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
        else if (address.includes("APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
        else if (address.includes("BATU BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
        else if (address.includes("BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
        else if (address.includes("BELABAN") == true) { area = "TEMBURONG", kampong = "BELABAN" }
        else if (address.includes("BELAIS") == true) { area = "TEMBURONG", kampong = "BELAIS" }
        else if (address.includes("BELINGOS") == true) { area = "TEMBURONG", kampong = "BELINGOS" }
        else if (address.includes("BIANG") == true) { area = "TEMBURONG", kampong = "BIANG" }
        else if (address.includes("BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
        else if (address.includes("BUDA BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
        else if (address.includes("BUDA-BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
        else if (address.includes("GADONG BARU") == true) { area = "TEMBURONG", kampong = "GADONG BARU" }
        else if (address.includes("KENUA") == true) { area = "TEMBURONG", kampong = "KENUA" }
        else if (address.includes("LABU ESTATE") == true) { area = "TEMBURONG", kampong = "LABU" }
        else if (address.includes("LABU") == true) { area = "TEMBURONG", kampong = "LABU" }
        else if (address.includes("LAGAU") == true) { area = "TEMBURONG", kampong = "LAGAU" }
        else if (address.includes("LAKIUN") == true) { area = "TEMBURONG", kampong = "LAKIUN" }
        else if (address.includes("LAMALING") == true) { area = "TEMBURONG", kampong = "LAMALING" }
        else if (address.includes("LEPONG") == true) { area = "TEMBURONG", kampong = "LEPONG" }
        else if (address.includes("LUAGAN") == true) { area = "TEMBURONG", kampong = "LUAGAN" }
        else if (address.includes("MANIUP") == true) { area = "TEMBURONG", kampong = "MANIUP" }
        else if (address.includes("MENENGAH") == true) { area = "TEMBURONG", kampong = "MENGENGAH" }
        else if (address.includes("NEGALANG") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
        else if (address.includes("NEGALANG ERING") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
        else if (address.includes("NEGALANG UNAT") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
        else if (address.includes("PARIT") == true) { area = "TEMBURONG", kampong = "PARIT" }
        else if (address.includes("PARIT BELAYANG") == true) { area = "TEMBURONG", kampong = "PARIT BELAYANG" }
        else if (address.includes("PAYAU") == true) { area = "TEMBURONG", kampong = "PAYAU" }
        else if (address.includes("PELIUNAN") == true) { area = "TEMBURONG", kampong = "PELIUNAN" }
        else if (address.includes("PERDAYAN") == true) { area = "TEMBURONG", kampong = "PERDAYAN" }
        else if (address.includes("PIASAU-PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
        else if (address.includes("PIASAU PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
        else if (address.includes("PIUNGAN") == true) { area = "TEMBURONG", kampong = "PIUNGAN" }
        else if (address.includes("PUNI") == true) { area = "TEMBURONG", kampong = "PUNI" }
        else if (address.includes("RATAIE") == true) { area = "TEMBURONG", kampong = "RATAIE" }
        else if (address.includes("REBADA") == true) { area = "TEMBURONG", kampong = "REBADA" }
        else if (address.includes("SEKUROP") == true) { area = "TEMBURONG", kampong = "SEKUROP" }
        else if (address.includes("SELANGAN") == true) { area = "TEMBURONG", kampong = "SELANGAN" }
        else if (address.includes("SELAPON") == true) { area = "TEMBURONG", kampong = "SELAPON" }
        else if (address.includes("SEMABAT") == true) { area = "TEMBURONG", kampong = "SEMABAT" }
        else if (address.includes("SEMAMAMNG") == true) { area = "TEMBURONG", kampong = "SEMAMANG" }
        else if (address.includes("SENUKOH") == true) { area = "TEMBURONG", kampong = "SENUKOH" }
        else if (address.includes("SERI TANJONG BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
        else if (address.includes("BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
        else if (address.includes("SIBULU") == true) { area = "TEMBURONG", kampong = "SIBULU" }
        else if (address.includes("SIBUT") == true) { area = "TEMBURONG", kampong = "SIBUT" }
        else if (address.includes("SIMBATANG BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
        else if (address.includes("SIMBATANG BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
        else if (address.includes("SUBOK") == true) { area = "TEMBURONG", kampong = "SUBOK" }
        else if (address.includes("SUMBILING") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
        else if (address.includes("SUMBILING BARU") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
        else if (address.includes("SUMBILING LAMA") == true) { area = "TEMBURONG", kampong = "SUMBILING LAMA" }
        else if (address.includes("SUNGAI RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
        else if (address.includes("SG RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
        else if (address.includes("SUNGAI SULOK") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
        else if (address.includes("SG SULOK ") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
        else if (address.includes("SUNGAI TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
        else if (address.includes("SG TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
        else if (address.includes("SUNGAI TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
        else if (address.includes("SG TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
        else if (address.includes("TANJONG BUNGAR") == true) { area = "TEMBURONG", kampong = "TANJONG BUNGAR" }
        else if (address.includes("TEMADA") == true) { area = "TEMBURONG", kampong = "TEMADA" }
        else if (address.includes("UJONG JALAN") == true) { area = "TEMBURONG", kampong = "UJONG JALAN" }
        else if (address.includes("BANGAR") == true) { area = "TEMBURONG", kampong = "BANGAR" }
        else if (address.includes("TEMBURONG") == true) { area = "TEMBURONG" }
        else { area = "N/A" }

        finalArea = area;

        // Update Detrack with finalArea
        const detrackUpdateData = {
            do_number: trackingNumber,
            data: {
                zone: finalArea
            }
        };

        await axios.post(
            'https://app.detrack.com/api/v2/dn/jobs/update',
            detrackUpdateData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey // Replace with actual key
                }
            }
        );

        // Update MongoDB (ORDERS.area)
        await ORDERS.findByIdAndUpdate(order._id, { area: finalArea });

        console.log(`Area updated to ${finalArea} for tracking number ${trackingNumber}`);
    } catch (error) {
        console.error('Error in checkNonCodArea:', error.response?.data || error.message);
    }
}

async function handleOrderChange(change) {
    try {
        // ✅ Get the inserted order directly by its ID
        const orderId = change.documentKey._id;
        const order = await ORDERS.findById(orderId);

        if (!order || !order.product || order.product.length === 0) return;

        const product = order.product;

        if (product === "kptdp") return; // Skip kptdp orders

        // ✅ Special handling for TEMU
        if (product === "temu") {
            const finalPhoneNum = cleanPhoneNumber(order.receiverPhoneNumber);
            const whatsappName = order.receiverName;
            const tracker = order.doTrackingNumber; // use existing one (already in DB)

            if (shouldSendWhatsApp(product, finalPhoneNum)) {
                try {
                    await sendWhatsAppMessageTemu(finalPhoneNum, whatsappName);
                    console.log(`✅ WhatsApp TEMU sent for tracker ${tracker}`);
                } catch (err) {
                    console.error(`❌ Failed to send TEMU WhatsApp for ${tracker}:`, err);
                }
            }
            return; // stop here for TEMU (no tracker generation)
        }

        // ✅ Other products (generate tracker)
        let counterField = "";
        let suffix = "";
        let prefix = "";
        let tracker = "";

        if (product.includes("pharmacy")) {
            counterField = "pharmacy";
            suffix = "GR2";
            if (product === "pharmacymoh") prefix = "MH";
            else if (product === "pharmacyjpmc") prefix = "JP";
            else if (product === "pharmacyphc") prefix = "PN";
            else prefix = "PH"; // fallback
        } else if (product === "localdelivery") {
            counterField = "localdelivery";
            suffix = "GR3";
            prefix = "LD";
        } else if (product === "grp") {
            counterField = "grp";
            suffix = "GR4";
            prefix = "GP";
        } else if (product === "cbsl") {
            counterField = "cbsl";
            suffix = "GR5";
            prefix = "CB";
        } else {
            return; // Skip unknown products
        }

        // Generate unique tracker number
        const sequence = await incrementAndGetCounter(counterField);
        tracker = generateTracker(sequence, suffix, prefix);

        // Save both doTrackingNumber and sequence in ORDERS
        await ORDERS.findByIdAndUpdate(order._id, { doTrackingNumber: tracker, sequence: sequence });

        // Special check for non-COD
        if (["ewe", "pdu", "mglobal"].includes(product)) {
            await checkNonCodArea(order, tracker);
        }

        const finalPhoneNum = cleanPhoneNumber(order.receiverPhoneNumber);
        const whatsappName = order.receiverName;

        if (shouldSendWhatsApp(product, finalPhoneNum)) {
            try {
                await sendWhatsAppMessage(finalPhoneNum, whatsappName, tracker);
                console.log(`✅ WhatsApp sent for ${product} tracker ${tracker}`);
            } catch (err) {
                console.error(`❌ Failed to send WhatsApp for ${product} tracker ${tracker}:`, err);
            }
        }

    } catch (err) {
        console.error('Error processing order change:', err);
    }
}

async function incrementAndGetCounter(field) {
    const result = await ORDERCOUNTER.findOneAndUpdate(
        { _id: COUNTER_ID },
        { $inc: { [field]: 1 } },
        { new: true, upsert: true }
    );
    return result[field];
}

function cleanPhoneNumber(rawPhoneNumber) {
    if (!rawPhoneNumber) return "N/A";
    let cleanedNumber = rawPhoneNumber.trim().replace(/\D/g, "");
    if (/^\d{7}$/.test(cleanedNumber)) return "+673" + cleanedNumber;
    if (/^673\d{7}$/.test(cleanedNumber)) return "+" + cleanedNumber;
    if (/^\+673\d{7}$/.test(rawPhoneNumber)) return rawPhoneNumber;
    return "N/A";
}

function shouldSendWhatsApp(product, phoneNumber) {
    const skipProducts = [
        "fmx", "bb", "fcas", "icarus", "ewe", "ewens",
        "kptdf", "pdu", "pure51", "mglobal", "kptdp", "gdext", "gdext"
    ];
    return !skipProducts.includes(product) && phoneNumber !== "N/A";
}

function generateTracker(sequence, suffix, prefix) {
    const padded = sequence.toString().padStart(8, '0');
    return `${suffix}${padded}${prefix}`;
}

async function sendWhatsAppMessage(finalPhoneNum, name, trackingNumber) {
    try {
        await axios.post(
            'https://hook.eu1.make.com/2rzk6t84td2261kh33zhdvfi98yggmhy',
            {
                phone: finalPhoneNum,
                name: name,
                trackingNumber: trackingNumber
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-make-apikey': '2969421:27114c524def4cc4c85530d8b8018f9b' // Replace with your real key
                }
            }
        );
    } catch (error) {
        console.error('Error sending WhatsApp:', error.response?.data || error.message);
    }
}

async function sendWhatsAppMessageTemu(finalPhoneNum, name) {
    try {
        await axios.post(
            'https://hook.eu1.make.com/wg47enwth61lf3ch4x6ihdr53b8treql',
            {
                phone: finalPhoneNum,
                name: name,
                messageTemplate: "temureturnupdate"
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-make-apikey': '2969421:27114c524def4cc4c85530d8b8018f9b'
                }
            }
        );
    } catch (error) {
        console.error('Error sending WhatsApp (Temu):', error.response?.data || error.message);
        // important: don't throw, just swallow error so queue continues
    }
}

// New WhatsApp sending function for Return Temu
async function sendWhatsAppMessageTemplate(formattedPhoneNum, name, messageTemplate) {
    try {
        await axios.post(
            'https://hook.eu1.make.com/wg47enwth61lf3ch4x6ihdr53b8treql',
            {
                phone: formattedPhoneNum,
                name: name,
                messageTemplate: messageTemplate
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-make-apikey': '2969421:27114c524def4cc4c85530d8b8018f9b'
                }
            }
        );
        console.log(`Sent WhatsApp message to ${name} (${formattedPhoneNum})`);
    } catch (error) {
        console.error('Error sending WhatsApp message:', error.response?.data || error.message);
    }
}

// Render EJS page for broadcast
app.get('/broadcast', ensureAuthenticated, (req, res) => {
    res.render('sendWAMessageTemplate');
});

// Upload route using memoryStorage multer
app.post('/upload', upload.single('file'), async (req, res) => {
    const messageTemplate = req.body.messageTemplate;

    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        for (const row of data) {
            let excelPhone = row['Customer Phone Number'];
            const name = row['Customer Name'];

            // Clean up phone number (remove spaces, dashes, etc.)
            if (excelPhone) {
                excelPhone = excelPhone.toString().replace(/\D/g, ''); // keep only digits
            }

            let formattedPhoneNum;

            // Apply original logic
            if (excelPhone) {
                if (excelPhone.length === 7) {
                    formattedPhoneNum = "+673" + excelPhone;
                } else if (excelPhone.length === 10) {
                    formattedPhoneNum = "+" + excelPhone;
                } else {
                    formattedPhoneNum = excelPhone;
                }
            } else {
                formattedPhoneNum = "No phone number provided";
            }

            if (formattedPhoneNum !== "No phone number provided" && name) {
                await sendWhatsAppMessageTemplate(formattedPhoneNum, name, messageTemplate);
            }
        }

        res.send('WhatsApp messages sent successfully.');
    } catch (err) {
        res.status(500).send('Error processing file: ' + err.message);
    }
});

// ==================================================
// 🔐 API Key Authentication Middleware
// ==================================================

const authenticateGDEX = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'] || req.query.apiKey;

    // Get valid API key from environment variables
    const validApiKey = process.env.GDEX_API_KEY;

    // If no API key is configured, allow all requests (for development)
    if (!validApiKey) {
        console.warn('⚠️  GDEX_API_KEY not configured in environment - allowing all requests');
        return next();
    }

    // Check if API key is provided
    if (!apiKey) {
        console.error('❌ Missing API key:', {
            ip: req.ip,
            path: req.path,
            timestamp: new Date().toISOString()
        });
        return res.status(401).json({
            status: 'error',
            message: 'Missing API key',
            code: 'UNAUTHORIZED'
        });
    }

    // Extract key if it's in Bearer format
    const extractedKey = apiKey.startsWith('Bearer ') ? apiKey.slice(7) : apiKey;

    // Validate API key
    if (extractedKey !== validApiKey) {
        console.error('❌ Invalid API key:', {
            ip: req.ip,
            path: req.path,
            timestamp: new Date().toISOString()
        });
        return res.status(401).json({
            status: 'error',
            message: 'Invalid API key',
            code: 'UNAUTHORIZED'
        });
    }

    // API key is valid, proceed to route
    console.log('✅ API key validated:', {
        ip: req.ip,
        path: req.path,
        timestamp: new Date().toISOString()
    });
    next();
};

// ==================================================
// 📮 GDEX to Detrack API Routes (Protected)
// ==================================================

// Apply authentication to all GDEX routes
app.use('/api/gdex', authenticateGDEX);

// ==================================================
// 📮 GDEX to Detrack Proxy API
// ==================================================

app.post('/api/gdex/sendorderrequest', async (req, res) => {
    try {
        console.log('📦 GDEX Order Received for Go Rush:', {
            consignmentno: req.body.consignmentno,
            timestamp: new Date().toISOString()
        });

        // Validate required fields with individual messages
        const requiredFields = {
            'consignmentno': 'Consignment number',
            'pieces': 'Pieces count',
            'weight': 'Weight',
            'consigneename': 'Consignee name',
            'consigneeaddress1': 'Consignee address line 1',
            'consigneecontact': 'Consignee contact number',
            'productdesc': 'Product description'
        };

        const missingFields = [];

        // Check each field individually
        if (!req.body.consignmentno) missingFields.push('consignmentno');
        if (!req.body.pieces) missingFields.push('pieces');
        if (!req.body.weight) missingFields.push('weight');
        if (!req.body.consigneename) missingFields.push('consigneename');
        if (!req.body.consigneeaddress1) missingFields.push('consigneeaddress1');
        if (!req.body.consigneecontact) missingFields.push('consigneecontact');
        if (!req.body.productdesc) missingFields.push('productdesc');

        // Return error if any fields are missing
        if (missingFields.length > 0) {
            const missingFieldNames = missingFields.map(field => requiredFields[field]);
            const errorMessage = `Missing required field${missingFields.length > 1 ? 's' : ''}: ${missingFieldNames.join(', ')}`;

            console.error('❌ GDEX Order Validation Failed:', {
                consignmentno: req.body.consignmentno || 'Unknown',
                missing_fields: missingFields,
                timestamp: new Date().toISOString()
            });

            return res.status(400).json({
                status: 'error',
                message: errorMessage,
                missing_fields: missingFields,
                consignmentno: req.body.consignmentno || 'Unknown'
            });
        }

        // Transform phone number format
        const formattedPhone = formatPhoneNumber(req.body.consigneecontact, req.body.country);

        // Build complete address
        const completeAddress = buildCompleteAddress(req.body);

        const address = completeAddress.toUpperCase();
        let finalArea = ""
        let area = "N/A";
        let kampong = "";

        if (address.includes("MANGGIS") == true) { area = "B", kampong = "MANGGIS" }
        else if (address.includes("DELIMA") == true) { area = "B", kampong = "DELIMA" }
        else if (address.includes("ANGGREK DESA") == true) { area = "B", kampong = "ANGGREK DESA" }
        else if (address.includes("ANGGREK") == true) { area = "B", kampong = "ANGGREK DESA" }
        else if (address.includes("PULAIE") == true) { area = "B", kampong = "PULAIE" }
        else if (address.includes("LAMBAK") == true) { area = "B", kampong = "LAMBAK" }
        else if (address.includes("TERUNJING") == true) { area = "B", kampong = "TERUNJING" }
        else if (address.includes("MADANG") == true) { area = "B", kampong = "MADANG" }
        else if (address.includes("AIRPORT") == true) { area = "B", kampong = "AIRPORT" }
        else if (address.includes("ORANG KAYA BESAR IMAS") == true) { area = "B", kampong = "OKBI" }
        else if (address.includes("OKBI") == true) { area = "B", kampong = "OKBI" }
        else if (address.includes("SERUSOP") == true) { area = "B", kampong = "SERUSOP" }
        else if (address.includes("BURONG PINGAI") == true) { area = "B", kampong = "BURONG PINGAI" }
        else if (address.includes("SETIA NEGARA") == true) { area = "B", kampong = "SETIA NEGARA" }
        else if (address.includes("PASIR BERAKAS") == true) { area = "B", kampong = "PASIR BERAKAS" }
        else if (address.includes("MENTERI BESAR") == true) { area = "B", kampong = "MENTERI BESAR" }
        else if (address.includes("KEBANGSAAN LAMA") == true) { area = "B", kampong = "KEBANGSAAN LAMA" }
        else if (address.includes("BATU MARANG") == true) { area = "B", kampong = "BATU MARANG" }
        else if (address.includes("DATO GANDI") == true) { area = "B", kampong = "DATO GANDI" }
        else if (address.includes("KAPOK") == true) { area = "B", kampong = "KAPOK" }
        else if (address.includes("KOTA BATU") == true) { area = "B", kampong = "KOTA BATU" }
        else if (address.includes("MENTIRI") == true) { area = "B", kampong = "MENTIRI" }
        else if (address.includes("MERAGANG") == true) { area = "B", kampong = "MERAGANG" }
        else if (address.includes("PELAMBAIAN") == true) { area = "B", kampong = "PELAMBAIAN" }
        else if (address.includes("PINTU MALIM") == true) { area = "B", kampong = "PINTU MALIM" }
        else if (address.includes("SALAMBIGAR") == true) { area = "B", kampong = "SALAMBIGAR" }
        else if (address.includes("SALAR") == true) { area = "B", kampong = "SALAR" }
        else if (address.includes("SERASA") == true) { area = "B", kampong = "SERASA" }
        else if (address.includes("SERDANG") == true) { area = "B", kampong = "SERDANG" }
        else if (address.includes("SUNGAI BASAR") == true) { area = "B", kampong = "SUNGAI BASAR" }
        else if (address.includes("SG BASAR") == true) { area = "B", kampong = "SUNGAI BASAR" }
        else if (address.includes("SUNGAI BELUKUT") == true) { area = "B", kampong = "SUNGAI BELUKUT" }
        else if (address.includes("SG BELUKUT") == true) { area = "B", kampong = "SUNGAI BELUKUT" }
        else if (address.includes("SUNGAI HANCHING") == true) { area = "B", kampong = "SUNGAI HANCHING" }
        else if (address.includes("SG HANCHING") == true) { area = "B", kampong = "SUNGAI HANCHING" }
        else if (address.includes("SUNGAI TILONG") == true) { area = "B", kampong = "SUNGAI TILONG" }
        else if (address.includes("SG TILONG") == true) { area = "B", kampong = "SUNGAI TILONG" }
        else if (address.includes("SUBOK") == true) { area = "B", kampong = "SUBOK" }
        else if (address.includes("SUNGAI AKAR") == true) { area = "B", kampong = "SUNGAI AKAR" }
        else if (address.includes("SG AKAR") == true) { area = "B", kampong = "SUNGAI AKAR" }
        else if (address.includes("SUNGAI BULOH") == true) { area = "B", kampong = "SUNGAI BULOH" }
        else if (address.includes("SG BULOH") == true) { area = "B", kampong = "SUNGAI BULOH" }
        else if (address.includes("TANAH JAMBU") == true) { area = "B", kampong = "TANAH JAMBU" }
        else if (address.includes("SUNGAI OROK") == true) { area = "B", kampong = "SUNGAI OROK" }
        else if (address.includes("SG OROK") == true) { area = "B", kampong = "SUNGAI OROK" }
        else if (address.includes("KATOK") == true) { area = "G", kampong = "KATOK" }
        else if (address.includes("MATA-MATA") == true) { area = "G", kampong = "MATA-MATA" }
        else if (address.includes("MATA MATA") == true) { area = "G", kampong = "MATA-MATA" }
        else if (address.includes("RIMBA") == true) { area = "G", kampong = "RIMBA" }
        else if (address.includes("TUNGKU") == true) { area = "G", kampong = "TUNGKU" }
        else if (address.includes("UBD") == true) { area = "G", kampong = "UBD" }
        else if (address.includes("UNIVERSITI BRUNEI DARUSSALAM") == true) { area = "G", kampong = "UBD" }
        else if (address.includes("JIS") == true) { area = "G" }
        else if (address.includes("JERUDONG INTERNATIONAL SCHOOL") == true) { area = "G", kampong = "JIS" }
        else if (address.includes("BERANGAN") == true) { area = "G", kampong = "BERANGAN" }
        else if (address.includes("BERIBI") == true) { area = "G", kampong = "BERIBI" }
        else if (address.includes("KIULAP") == true) { area = "G", kampong = "KIULAP" }
        else if (address.includes("RIPAS") == true) { area = "G", kampong = "RIPAS" }
        else if (address.includes("RAJA ISTERI PENGIRAN ANAK SALLEHA") == true) { area = "G", kampong = "RIPAS" }
        else if (address.includes("KIARONG") == true) { area = "G", kampong = "KIARONG" }
        else if (address.includes("PUSAR ULAK") == true) { area = "G", kampong = "PUSAR ULAK" }
        else if (address.includes("KUMBANG PASANG") == true) { area = "G", kampong = "KUMBANG PASANG" }
        else if (address.includes("MENGLAIT") == true) { area = "G", kampong = "MENGLAIT" }
        else if (address.includes("MABOHAI") == true) { area = "G", kampong = "MABOHAI" }
        else if (address.includes("ONG SUM PING") == true) { area = "G", kampong = "ONG SUM PING" }
        else if (address.includes("GADONG") == true) { area = "G", kampong = "GADONG" }
        else if (address.includes("TASEK LAMA") == true) { area = "G", kampong = "TASEK LAMA" }
        else if (address.includes("BANDAR TOWN") == true) { area = "G", kampong = "BANDAR TOWN" }
        else if (address.includes("BATU SATU") == true) { area = "JT", kampong = "BATU SATU" }
        else if (address.includes("BENGKURONG") == true) { area = "JT", kampong = "BENGKURONG" }
        else if (address.includes("BUNUT") == true) { area = "JT", kampong = "BUNUT" }
        else if (address.includes("JALAN BABU RAJA") == true) { area = "JT", kampong = "JALAN BABU RAJA" }
        else if (address.includes("JALAN ISTANA") == true) { area = "JT", kampong = "JALAN ISTANA" }
        else if (address.includes("JUNJONGAN") == true) { area = "JT", kampong = "JUNJONGAN" }
        else if (address.includes("KASAT") == true) { area = "JT", kampong = "KASAT" }
        else if (address.includes("LUMAPAS") == true) { area = "JT", kampong = "LUMAPAS" }
        else if (address.includes("JALAN HALUS") == true) { area = "JT", kampong = "JALAN HALUS" }
        else if (address.includes("MADEWA") == true) { area = "JT", kampong = "MADEWA" }
        else if (address.includes("PUTAT") == true) { area = "JT", kampong = "PUTAT" }
        else if (address.includes("SINARUBAI") == true) { area = "JT", kampong = "SINARUBAI" }
        else if (address.includes("TASEK MERADUN") == true) { area = "JT", kampong = "TASEK MERADUN" }
        else if (address.includes("TELANAI") == true) { area = "JT", kampong = "TELANAI" }
        else if (address.includes("BAN 1") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BAN 2") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BAN 3") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BAN 4") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BAN 5") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BAN 6") == true) { area = "JT", kampong = "BAN" }
        else if (address.includes("BATONG") == true) { area = "JT", kampong = "BATONG" }
        else if (address.includes("BATU AMPAR") == true) { area = "JT", kampong = "BATU AMPAR" }
        else if (address.includes("BEBATIK") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
        else if (address.includes("BEBULOH") == true) { area = "JT", kampong = "BEBULOH" }
        else if (address.includes("BEBATIK KILANAS") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
        else if (address.includes("KILANAS") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
        else if (address.includes("DADAP") == true) { area = "JT", kampong = "DADAP" }
        else if (address.includes("KUALA LURAH") == true) { area = "JT", kampong = "KUALA LURAH" }
        else if (address.includes("KULAPIS") == true) { area = "JT", kampong = "KULAPIS" }
        else if (address.includes("LIMAU MANIS") == true) { area = "JT", kampong = "LIMAU MANIS" }
        else if (address.includes("MASIN") == true) { area = "JT", kampong = "MASIN" }
        else if (address.includes("MULAUT") == true) { area = "JT", kampong = "MULAUT" }
        else if (address.includes("PANCHOR MURAI") == true) { area = "JT", kampong = "PANCHOR MURAI" }
        else if (address.includes("PANCHUR MURAI") == true) { area = "JT", kampong = "PANCHOR MURAI" }
        else if (address.includes("PANGKALAN BATU") == true) { area = "JT", kampong = "PANGKALAN BATU" }
        else if (address.includes("PASAI") == true) { area = "JT", kampong = "PASAI" }
        else if (address.includes("WASAN") == true) { area = "JT", kampong = "WASAN" }
        else if (address.includes("PARIT") == true) { area = "JT", kampong = "PARIT" }
        else if (address.includes("EMPIRE") == true) { area = "JT", kampong = "EMPIRE" }
        else if (address.includes("JANGSAK") == true) { area = "JT", kampong = "JANGSAK" }
        else if (address.includes("JERUDONG") == true) { area = "JT", kampong = "JERUDONG" }
        else if (address.includes("KATIMAHAR") == true) { area = "JT", kampong = "KATIMAHAR" }
        else if (address.includes("LUGU") == true) { area = "JT", kampong = "LUGU" }
        else if (address.includes("SENGKURONG") == true) { area = "JT", kampong = "SENGKURONG" }
        else if (address.includes("TANJONG NANGKA") == true) { area = "JT", kampong = "TANJONG NANGKA" }
        else if (address.includes("TANJONG BUNUT") == true) { area = "JT", kampong = "TANJONG BUNUT" }
        else if (address.includes("TANJUNG BUNUT") == true) { area = "JT", kampong = "TANJONG BUNUT" }
        else if (address.includes("SUNGAI TAMPOI") == true) { area = "JT", kampung = "SUNGAI TAMPOI" }
        else if (address.includes("SG TAMPOI") == true) { area = "JT", kampong = "SUNGAI TAMPOI" }
        else if (address.includes("MUARA") == true) { area = "B", kampong = "MUARA" }
        //TU
        else if (address.includes("SENGKARAI") == true) { area = "TUTONG", kampong = "SENGKARAI" }
        else if (address.includes("PANCHOR") == true) { area = "TUTONG", kampong = "PANCHOR" }
        else if (address.includes("PENABAI") == true) { area = "TUTONG", kampong = "PENABAI" }
        else if (address.includes("KUALA TUTONG") == true) { area = "TUTONG", kampong = "KUALA TUTONG" }
        else if (address.includes("PENANJONG") == true) { area = "TUTONG", kampong = "PENANJONG" }
        else if (address.includes("KERIAM") == true) { area = "TUTONG", kampong = "KERIAM" }
        else if (address.includes("BUKIT PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
        else if (address.includes("PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
        else if (address.includes("LUAGAN") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
        else if (address.includes("DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
        else if (address.includes("LUAGAN DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
        else if (address.includes("SINAUT") == true) { area = "TUTONG", kampong = "SINAUT" }
        else if (address.includes("SUNGAI KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
        else if (address.includes("KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
        else if (address.includes("SG KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
        else if (address.includes("KUPANG") == true) { area = "TUTONG", kampong = "KUPANG" }
        else if (address.includes("KIUDANG") == true) { area = "TUTONG", kampong = "KIUDANG" }
        else if (address.includes("PAD") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
        else if (address.includes("NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
        else if (address.includes("PAD NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
        else if (address.includes("BEKIAU") == true) { area = "TUTONG", kampong = "BEKIAU" }
        else if (address.includes("MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
        else if (address.includes("PENGKALAN MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
        else if (address.includes("BATANG MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
        else if (address.includes("MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
        else if (address.includes("KEBIA") == true) { area = "TUTONG", kampong = "KEBIA" }
        else if (address.includes("BIRAU") == true) { area = "TUTONG", kampong = "BIRAU" }
        else if (address.includes("LAMUNIN") == true) { area = "TUTONG", kampong = "LAMUNIN" }
        else if (address.includes("LAYONG") == true) { area = "TUTONG", kampong = "LAYONG" }
        else if (address.includes("MENENGAH") == true) { area = "TUTONG", kampong = "MENENGAH" }
        else if (address.includes("PANCHONG") == true) { area = "TUTONG", kampong = "PANCHONG" }
        else if (address.includes("PENAPAR") == true) { area = "TUTONG", kampong = "PANAPAR" }
        else if (address.includes("TANJONG MAYA") == true) { area = "TUTONG", kampong = "TANJONG MAYA" }
        else if (address.includes("MAYA") == true) { area = "TUTONG", kampong = "MAYA" }
        else if (address.includes("LUBOK") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
        else if (address.includes("PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
        else if (address.includes("LUBOK PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
        else if (address.includes("BUKIT UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
        else if (address.includes("UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
        else if (address.includes("RAMBAI") == true) { area = "TUTONG", kampong = "RAMBAI" }
        else if (address.includes("BENUTAN") == true) { area = "TUTONG", kampong = "BENUTAN" }
        else if (address.includes("MERIMBUN") == true) { area = "TUTONG", kampong = "MERIMBUN" }
        else if (address.includes("UKONG") == true) { area = "TUTONG", kampong = "UKONG" }
        else if (address.includes("LONG") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
        else if (address.includes("MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
        else if (address.includes("LONG MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
        else if (address.includes("TELISAI") == true) { area = "TUTONG", kampong = "TELISAI" }
        else if (address.includes("DANAU") == true) { area = "TUTONG", kampong = "DANAU" }
        else if (address.includes("BUKIT BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
        else if (address.includes("BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
        else if (address.includes("TUTONG") == true) { area = "TUTONG", kampong = "TUTONG" }
        //KB
        else if (address.includes("AGIS") == true) { area = "LUMUT", kampong = "AGIS" }
        else if (address.includes("ANDALAU") == true) { area = "LUMUT", kampong = "ANDALAU" }
        else if (address.includes("ANDUKI") == true) { area = "LUMUT", kampong = "ANDUKI" }
        else if (address.includes("APAK") == true) { area = "KB / SERIA", kampong = "APAK" }
        else if (address.includes("BADAS") == true) { area = "LUMUT", kampong = "BADAS" }
        else if (address.includes("BANG") == true) { area = "KB / SERIA", kampong = "BANG" }
        else if (address.includes("GARANG") == true) { area = "KB / SERIA", kampong = "GARANG" }
        else if (address.includes("PUKUL") == true) { area = "KB / SERIA", kampong = "PUKUL" }
        else if (address.includes("TAJUK") == true) { area = "KB / SERIA", kampong = "TAJUK" }
        else if (address.includes("BENGERANG") == true) { area = "KB / SERIA", kampong = "BENGERANG" }
        else if (address.includes("BIADONG") == true) { area = "KB / SERIA", kampong = "BIADONG" }
        else if (address.includes("ULU") == true) { area = "KB / SERIA", kampong = "ULU" }
        else if (address.includes("TENGAH") == true) { area = "KB / SERIA", kampong = "TENGAH" }
        else if (address.includes("BISUT") == true) { area = "KB / SERIA", kampong = "BISUT" }
        else if (address.includes("BUAU") == true) { area = "KB / SERIA", kampong = "BUAU" }
        else if (address.includes("KANDOL") == true) { area = "KB / SERIA", kampong = "KANDOL" }
        else if (address.includes("PUAN") == true) { area = "KB / SERIA", kampong = "PUAN" }
        else if (address.includes("TUDING") == true) { area = "LUMUT", kampong = "TUDING" }
        else if (address.includes("SAWAT") == true) { area = "KB / SERIA", kampong = "SAWAT" }
        else if (address.includes("SERAWONG") == true) { area = "KB / SERIA", kampong = "SERAWONG" }
        else if (address.includes("CHINA") == true) { area = "KB / SERIA", kampong = "CHINA" }
        else if (address.includes("DUGUN") == true) { area = "KB / SERIA", kampong = "DUGUN" }
        else if (address.includes("GATAS") == true) { area = "KB / SERIA", kampong = "GATAS" }
        else if (address.includes("JABANG") == true) { area = "KB / SERIA", kampong = "JABANG" }
        else if (address.includes("KAGU") == true) { area = "KB / SERIA", kampong = "KAGU" }
        else if (address.includes("KAJITAN") == true) { area = "KB / SERIA", kampong = "KAJITAN" }
        else if (address.includes("KELUYOH") == true) { area = "KB / SERIA", kampong = "KELUYOH" }
        else if (address.includes("KENAPOL") == true) { area = "KB / SERIA", kampong = "KENAPOL" }
        else if (address.includes("KUALA BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
        else if (address.includes("BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
        else if (address.includes("KUALA BELAIT") == true) { area = "KB", kampong = "KUALA BELAIT" }
        else if (address.includes("KUKUB") == true) { area = "KB / SERIA", kampong = "KUKUB" }
        else if (address.includes("LABI") == true) { area = "LUMUT", kampong = "LABI" }
        else if (address.includes("LAKANG") == true) { area = "KB / SERIA", kampong = "LAKANG" }
        else if (address.includes("LAONG ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
        else if (address.includes("ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
        else if (address.includes("LAONG") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
        else if (address.includes("LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
        else if (address.includes("SUNGAI LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
        else if (address.includes("SG LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
        else if (address.includes("LUMUT") == true) { area = "LUMUT", kampong = "LUMUT" }
        else if (address.includes("LORONG") == true) { area = "SERIA", kampong = "LORONG" }
        else if (address.includes("LORONG TENGAH") == true) { area = "SERIA", kampong = "LORONG TENGAH" }
        else if (address.includes("LORONG TIGA SELATAN") == true) { area = "SERIA", kampong = "LORONG TIGA SELATAN" }
        else if (address.includes("LILAS") == true) { area = "KB / SERIA", kampong = "LILAS" }
        else if (address.includes("LUBUK LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
        else if (address.includes("LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
        else if (address.includes("LUBUK TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
        else if (address.includes("TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
        else if (address.includes("MALA'AS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
        else if (address.includes("MALAAS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
        else if (address.includes("MALAYAN") == true) { area = "KB / SERIA", kampong = "MELAYAN" }
        else if (address.includes("MELAYU") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
        else if (address.includes("ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
        else if (address.includes("MELAYU ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
        else if (address.includes("MELILAS") == true) { area = "LUMUT", kampong = "MELILAS" }
        else if (address.includes("MENDARAM") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
        else if (address.includes("MENDARAM BESAR") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
        else if (address.includes("MENDARAM KECIL") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
        else if (address.includes("MERANGKING") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
        else if (address.includes("MERANGKING ULU") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
        else if (address.includes("MERANGKING HILIR") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
        else if (address.includes("MUMONG") == true) { area = "KB", kampong = "MUMONG" }
        else if (address.includes("PANDAN") == true) { area = "KB", kampong = "PANDAN" }
        else if (address.includes("PADANG") == true) { area = "KB", kampong = "PADANG" }
        else if (address.includes("PANAGA") == true) { area = "SERIA", kampong = "PANAGA" }
        else if (address.includes("PENGKALAN SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
        else if (address.includes("SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
        else if (address.includes("PENGALAYAN") == true) { area = "KB / SERIA", kampong = "PENGALAYAN" }
        else if (address.includes("PENYRAP") == true) { area = "KB / SERIA", kampong = "PENYRAP" }
        else if (address.includes("PERANGKONG") == true) { area = "KB / SERIA", kampong = "PERANGKONG" }
        else if (address.includes("PERUMPONG") == true) { area = "LUMUT", kampong = "PERUMPONG" }
        else if (address.includes("PESILIN") == true) { area = "KB / SERIA", kampong = "PESILIN" }
        else if (address.includes("PULAU APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
        else if (address.includes("APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
        else if (address.includes("RAMPAYOH") == true) { area = "KB / SERIA", kampong = "RAMPAYOH" }
        else if (address.includes("RATAN") == true) { area = "KB / SERIA", kampong = "RATAN" }
        else if (address.includes("SAUD") == true) { area = "KB / SERIA", kampong = "SAUD" }
        //else if (address.includes("SIMPANG") == true) {area = "KB / SERIA", kampong = "SIMPANG TIGA"}
        else if (address.includes("SIMPANG TIGA") == true) { area = "LUMUT", kampong = "SIMPANG TIGA" }
        else if (address.includes("SINGAP") == true) { area = "KB / SERIA", kampong = "SINGAP" }
        else if (address.includes("SUKANG") == true) { area = "KB / SERIA", kampong = "SUKANG" }
        else if (address.includes("BAKONG") == true) { area = "LUMUT", kampong = "BAKONG" }
        else if (address.includes("DAMIT") == true) { area = "KB / SERIA", kampong = "DAMIT" }
        else if (address.includes("BERA") == true) { area = "KB / SERIA", kampong = "BERA" }
        else if (address.includes("DUHON") == true) { area = "KB / SERIA", kampong = "DUHON" }
        else if (address.includes("GANA") == true) { area = "LUMUT", kampong = "GANA" }
        else if (address.includes("HILIR") == true) { area = "KB / SERIA", kampong = "HILIR" }
        else if (address.includes("KANG") == true) { area = "LUMUT", kampong = "KANG" }
        else if (address.includes("KURU") == true) { area = "LUMUT", kampong = "KURU" }
        else if (address.includes("LALIT") == true) { area = "LUMUT", kampong = "LALIT" }
        else if (address.includes("LUTONG") == true) { area = "KB / SERIA", kampong = "LUTONG" }
        else if (address.includes("MAU") == true) { area = "KB / SERIA", kampong = "MAU" }
        else if (address.includes("MELILIT") == true) { area = "KB / SERIA", kampong = "MELILIT" }
        else if (address.includes("PETAI") == true) { area = "KB / SERIA", kampong = "PETAI" }
        else if (address.includes("TALI") == true) { area = "LUMUT", kampong = "TALI" }
        else if (address.includes("TARING") == true) { area = "LUMUT", kampong = "TARING" }
        else if (address.includes("TERABAN") == true) { area = "KB", kampong = "TERABAN" }
        else if (address.includes("UBAR") == true) { area = "KB / SERIA", kampong = "UBAR" }
        else if (address.includes("TANAJOR") == true) { area = "KB / SERIA", kampong = "TANAJOR" }
        else if (address.includes("TANJONG RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
        else if (address.includes("RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
        else if (address.includes("TANJONG SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
        else if (address.includes("SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
        else if (address.includes("TAPANG LUPAK") == true) { area = "KB / SERIA", kampong = "TAPANG LUPAK" }
        else if (address.includes("TARAP") == true) { area = "KB / SERIA", kampong = "TARAP" }
        else if (address.includes("TEMPINAK") == true) { area = "KB / SERIA", kampong = "TEMPINAK" }
        else if (address.includes("TERAJA") == true) { area = "KB / SERIA", kampong = "TERAJA" }
        else if (address.includes("TERAWAN") == true) { area = "KB / SERIA", kampong = "TERAWAN" }
        else if (address.includes("TERUNAN") == true) { area = "KB / SERIA", kampong = "TERUNAN" }
        else if (address.includes("TUGONG") == true) { area = "KB / SERIA", kampong = "TUGONG" }
        else if (address.includes("TUNGULLIAN") == true) { area = "LUMUT", kampong = "TUNGULLIAN" }
        else if (address.includes("UBOK") == true) { area = "KB / SERIA", kampong = "UBOK" }
        else if (address.includes("BELAIT") == true) { area = "KB / SERIA", kampong = "BELAIT" }
        else if (address.includes("SERIA") == true) { area = "KB / SERIA", kampong = "BELAIT" }
        //TE
        else if (address.includes("AMO") == true) { area = "TEMBURONG", kampong = "AMO" }
        else if (address.includes("AYAM-AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
        else if (address.includes("AYAM AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
        else if (address.includes("BAKARUT") == true) { area = "TEMBURONG", kampong = "BAKARUT" }
        else if (address.includes("BATANG DURI") == true) { area = "TEMBURONG", kampong = "BATANG DURI" }
        else if (address.includes("BATANG TUAU") == true) { area = "TEMBURONG", kampong = "BATANG TUAU" }
        else if (address.includes("BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
        else if (address.includes("APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
        else if (address.includes("BATU BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
        else if (address.includes("BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
        else if (address.includes("BELABAN") == true) { area = "TEMBURONG", kampong = "BELABAN" }
        else if (address.includes("BELAIS") == true) { area = "TEMBURONG", kampong = "BELAIS" }
        else if (address.includes("BELINGOS") == true) { area = "TEMBURONG", kampong = "BELINGOS" }
        else if (address.includes("BIANG") == true) { area = "TEMBURONG", kampong = "BIANG" }
        else if (address.includes("BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
        else if (address.includes("BUDA BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
        else if (address.includes("BUDA-BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
        else if (address.includes("GADONG BARU") == true) { area = "TEMBURONG", kampong = "GADONG BARU" }
        else if (address.includes("KENUA") == true) { area = "TEMBURONG", kampong = "KENUA" }
        else if (address.includes("LABU ESTATE") == true) { area = "TEMBURONG", kampong = "LABU" }
        else if (address.includes("LABU") == true) { area = "TEMBURONG", kampong = "LABU" }
        else if (address.includes("LAGAU") == true) { area = "TEMBURONG", kampong = "LAGAU" }
        else if (address.includes("LAKIUN") == true) { area = "TEMBURONG", kampong = "LAKIUN" }
        else if (address.includes("LAMALING") == true) { area = "TEMBURONG", kampong = "LAMALING" }
        else if (address.includes("LEPONG") == true) { area = "TEMBURONG", kampong = "LEPONG" }
        else if (address.includes("LUAGAN") == true) { area = "TEMBURONG", kampong = "LUAGAN" }
        else if (address.includes("MANIUP") == true) { area = "TEMBURONG", kampong = "MANIUP" }
        else if (address.includes("MENENGAH") == true) { area = "TEMBURONG", kampong = "MENGENGAH" }
        else if (address.includes("NEGALANG") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
        else if (address.includes("NEGALANG ERING") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
        else if (address.includes("NEGALANG UNAT") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
        else if (address.includes("PARIT") == true) { area = "TEMBURONG", kampong = "PARIT" }
        else if (address.includes("PARIT BELAYANG") == true) { area = "TEMBURONG", kampong = "PARIT BELAYANG" }
        else if (address.includes("PAYAU") == true) { area = "TEMBURONG", kampong = "PAYAU" }
        else if (address.includes("PELIUNAN") == true) { area = "TEMBURONG", kampong = "PELIUNAN" }
        else if (address.includes("PERDAYAN") == true) { area = "TEMBURONG", kampong = "PERDAYAN" }
        else if (address.includes("PIASAU-PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
        else if (address.includes("PIASAU PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
        else if (address.includes("PIUNGAN") == true) { area = "TEMBURONG", kampong = "PIUNGAN" }
        else if (address.includes("PUNI") == true) { area = "TEMBURONG", kampong = "PUNI" }
        else if (address.includes("RATAIE") == true) { area = "TEMBURONG", kampong = "RATAIE" }
        else if (address.includes("REBADA") == true) { area = "TEMBURONG", kampong = "REBADA" }
        else if (address.includes("SEKUROP") == true) { area = "TEMBURONG", kampong = "SEKUROP" }
        else if (address.includes("SELANGAN") == true) { area = "TEMBURONG", kampong = "SELANGAN" }
        else if (address.includes("SELAPON") == true) { area = "TEMBURONG", kampong = "SELAPON" }
        else if (address.includes("SEMABAT") == true) { area = "TEMBURONG", kampong = "SEMABAT" }
        else if (address.includes("SEMAMAMNG") == true) { area = "TEMBURONG", kampong = "SEMAMANG" }
        else if (address.includes("SENUKOH") == true) { area = "TEMBURONG", kampong = "SENUKOH" }
        else if (address.includes("SERI TANJONG BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
        else if (address.includes("BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
        else if (address.includes("SIBULU") == true) { area = "TEMBURONG", kampong = "SIBULU" }
        else if (address.includes("SIBUT") == true) { area = "TEMBURONG", kampong = "SIBUT" }
        else if (address.includes("SIMBATANG BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
        else if (address.includes("SIMBATANG BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
        else if (address.includes("SUBOK") == true) { area = "TEMBURONG", kampong = "SUBOK" }
        else if (address.includes("SUMBILING") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
        else if (address.includes("SUMBILING BARU") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
        else if (address.includes("SUMBILING LAMA") == true) { area = "TEMBURONG", kampong = "SUMBILING LAMA" }
        else if (address.includes("SUNGAI RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
        else if (address.includes("SG RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
        else if (address.includes("SUNGAI SULOK") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
        else if (address.includes("SG SULOK ") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
        else if (address.includes("SUNGAI TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
        else if (address.includes("SG TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
        else if (address.includes("SUNGAI TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
        else if (address.includes("SG TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
        else if (address.includes("TANJONG BUNGAR") == true) { area = "TEMBURONG", kampong = "TANJONG BUNGAR" }
        else if (address.includes("TEMADA") == true) { area = "TEMBURONG", kampong = "TEMADA" }
        else if (address.includes("UJONG JALAN") == true) { area = "TEMBURONG", kampong = "UJONG JALAN" }
        else if (address.includes("BANGAR") == true) { area = "TEMBURONG", kampong = "BANGAR" }
        else if (address.includes("TEMBURONG") == true) { area = "TEMBURONG" }
        else { area = "N/A" }

        finalArea = area;

        // Transform GDEX format to Detrack format
        const detrackJob = {
            "data": {  // ← WRAP EVERYTHING IN "data" OBJECT
                "type": "Delivery",
                "do_number": req.body.consignmentno,
                "date": moment().format('YYYY-MM-DD'),
                "status": "info_recv",
                "tracking_number": req.body.consignmentno,
                "job_type": "Standard",
                "address": completeAddress,
                "postal_code": req.body.consigneepostcode || '',
                "city": req.body.consigneetown || '',
                "state": req.body.consigneestate || '',
                "country": req.body.consigneecountry || '',
                "deliver_to_collect_from": req.body.consigneename,
                "job_owner": "GDEX" || '',
                "phone_number": formattedPhone,
                "zone": finalArea,
                "payment_mode": req.body.product === '00008' ? "Cash" : "NON COD",
                "payment_amount": req.body.product === '00008' ? parseFloat(req.body.codpayment) || 0 : 0,
                "total_price": req.body.product === '00008' ? parseFloat(req.body.codpayment) || 0 : 0,
                "group_name": "GDEXT",
                "weight": parseFloat(req.body.weight) || 0,
                "parcel_width": parseFloat(req.body.width) || 0,
                "parcel_length": parseFloat(req.body.length) || 0,
                "parcel_height": parseFloat(req.body.height) || 0,
                "items": [
                    {
                        "description": req.body.productdesc || 'General Goods',
                        "quantity": parseInt(req.body.pieces) || 1,
                        "weight": parseFloat(req.body.weight) || 0
                    }
                ]
            }
        };

        // Send to Detrack API - CORRECTED VERSION
        const detrackResponse = await axios.post(
            'https://app.detrack.com/api/v2/dn/jobs',  // Full endpoint URL
            detrackJob,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': process.env.API_KEY  // Correct environment variable
                }
            }
        );

        console.log('✅ Successfully sent to Go Rush:', {
            consignmentno: req.body.consignmentno,
            timestamp: new Date().toISOString()
        });

        // Return success to GDEX
        res.status(200).json({
            status: 'success',
            message: 'Order forwarded to Go Rush successfully',
            consignmentno: req.body.consignmentno,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        const errorData = error.response?.data;

        // Detect duplicate consignment number
        const isDuplicateError =
            errorData?.errors?.[0]?.message?.toLowerCase().includes('already exists') ||
            errorData?.message?.toLowerCase().includes('already exists') ||
            errorData?.error?.toLowerCase().includes('duplicate') ||
            errorData?.errors?.[0]?.message?.toLowerCase().includes('duplicate') ||
            error.response?.status === 422; // Detrack often uses 422 for duplicates

        if (isDuplicateError) {
            // ✅ MULTIPLE VISIBLE LOGS
            console.log('='.repeat(50));
            console.log('🔄 DUPLICATE ORDER DETECTED');
            console.log('📦 Consignment No:', req.body.consignmentno);
            console.log('⏰ Time:', new Date().toISOString());
            console.log('💡 Action: Skipped duplicate');
            console.log('='.repeat(50));

            // Detailed log
            console.log('📋 Duplicate details:', {
                consignmentno: req.body.consignmentno,
                detrackError: errorData,
                timestamp: new Date().toISOString()
            });

            return res.status(200).json({
                status: 'success',
                message: 'Order already exists in system - skipped duplicate',
                consignmentno: req.body.consignmentno,
                code: 'DUPLICATE_SKIPPED',
                timestamp: new Date().toISOString()
            });
        }

        // Log other errors
        console.error('❌ GDEX to Go Rush Error:', {
            consignmentno: req.body.consignmentno,
            error: error.response?.data || error.message,
            timestamp: new Date().toISOString()
        });

        res.status(500).json({
            status: 'error',
            message: 'Failed to forward order to Go Rush',
            consignmentno: req.body.consignmentno,
            error: process.env.NODE_ENV === 'development' ? error.message : 'Forwarding failed',
            timestamp: new Date().toISOString()
        });
    }
});

// ==================================================
// 🛠 Helper Functions
// ==================================================

// Format Brunei phone numbers only
function formatPhoneNumber(phone, country) {
    if (!phone) return '';

    let cleanedPhone = phone.toString().replace(/\D/g, '');

    // Only process Brunei numbers
    if (country !== 'BRN') {
        return cleanedPhone; // Return as-is for non-Brunei numbers
    }

    // Brunei country code
    const bruneiCountryCode = '673';

    // Remove existing country code if present
    if (cleanedPhone.startsWith(bruneiCountryCode)) {
        cleanedPhone = cleanedPhone.substring(bruneiCountryCode.length);
    }

    // Handle Brunei phone number formats:
    // - Sometimes 7 digits (without country code)
    // - Sometimes 10 digits (with country code but no + sign)

    if (cleanedPhone.length === 7) {
        // 7-digit Brunei number: add country code
        return `+${bruneiCountryCode}${cleanedPhone}`;
    } else if (cleanedPhone.length === 10 && cleanedPhone.startsWith('673')) {
        // 10-digit number starting with 673: add + prefix
        return `+${cleanedPhone}`;
    } else if (cleanedPhone.length === 11 && cleanedPhone.startsWith('673')) {
        // Already formatted with +673
        return `+${cleanedPhone}`;
    } else {
        // Return as-is for other formats
        return cleanedPhone;
    }
}

// Build complete address from multiple fields
function buildCompleteAddress(gdexData) {
    const addressParts = [
        gdexData.consigneeaddress1,
        gdexData.consigneeaddress2,
        gdexData.consigneeaddress3,
        gdexData.consigneetown,
        gdexData.consigneestate,
        gdexData.consigneecountry,
        gdexData.consigneepostcode
    ];

    // Filter out empty parts and join with commas
    return addressParts.filter(part => part && part.trim() !== '').join(', ');
}

// Health check (public - no auth required)
app.get('/api/gdex/sendorderrequest/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'GDEX to Detrack proxy is healthy',
        timestamp: new Date().toISOString(),
        database: mainConn.readyState === 1 ? 'connected' : 'disconnected',
        authentication: process.env.GDEX_API_KEY ? 'enabled' : 'disabled'
    });
});

// ==================================================
// 🔄 Update Job Routes
// ==================================================

// ==================================================
// 🔄 Background Job Processing
// ==================================================

// In-memory store for background jobs (use Redis in production)
const backgroundJobs = new Map();

// Generate unique job ID
function generateJobId() {
    return 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Optimized background job processor with batch processing
async function processUpdateJobInBackground(jobId, jobData) {
    const { updateCode, mawbNum, trackingNumbers, updateMethod, req } = jobData;

    const results = {
        successful: [],
        failed: [],
        updatedCount: 0,
        notUpdatedCount: 0,
        status: 'processing',
        total: trackingNumbers.length,
        processed: 0,
        startTime: Date.now()
    };

    // Update job status to processing
    backgroundJobs.set(jobId, { ...results, status: 'processing' });

    try {
        // Process in batches to optimize performance
        const BATCH_SIZE = 10; // Process 10 items in parallel
        const totalBatches = Math.ceil(trackingNumbers.length / BATCH_SIZE);

        console.log(`Starting batch processing for ${trackingNumbers.length} items in ${totalBatches} batches`);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const start = batchIndex * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, trackingNumbers.length);
            const batch = trackingNumbers.slice(start, end);

            console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} items)`);

            // Process the batch
            const batchResults = await processBatch(batch, updateCode, mawbNum, req);

            // Merge batch results
            results.successful.push(...batchResults.successful);
            results.failed.push(...batchResults.failed);
            results.updatedCount += batchResults.updatedCount;
            results.notUpdatedCount += batchResults.notUpdatedCount;
            results.processed = start + batch.length;

            // Update job progress
            backgroundJobs.set(jobId, {
                ...results,
                status: 'processing',
                currentBatch: batchIndex + 1,
                totalBatches: totalBatches,
                batchSize: BATCH_SIZE
            });

            // Small delay between batches to avoid rate limiting
            if (batchIndex < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Calculate total processing time
        results.processingTime = Date.now() - results.startTime;
        results.status = 'completed';

        console.log(`Job ${jobId} completed in ${results.processingTime}ms: ${results.updatedCount} successful, ${results.notUpdatedCount} failed`);
        backgroundJobs.set(jobId, results);

    } catch (error) {
        console.error('Background job error:', error);
        results.status = 'failed';
        results.error = error.message;
        results.processingTime = Date.now() - results.startTime;
        backgroundJobs.set(jobId, results);
    }
}

// Serve the update job page
app.get('/updateJob'/* , ensureAuthenticated */, (req, res) => {
    res.render('updateJob', { user: req.user });
});

app.post('/updateJob', async (req, res) => {
    try {
        const { updateCode, mawbNum, trackingNumbers, updateMethod } = req.body;

        // Input validation
        if (!updateCode) {
            return res.status(400).json({ error: 'Update code is required' });
        }

        if (!trackingNumbers || trackingNumbers.length === 0) {
            return res.status(400).json({ error: 'Tracking numbers are required' });
        }

        // Clean and validate tracking numbers
        const cleanTrackingNumbers = trackingNumbers
            .map(num => num.trim())
            .filter(num => num !== '');

        const uniqueTrackingNumbers = [...new Set(cleanTrackingNumbers)];

        // Enforce limits
        const MAX_BULK_ITEMS = 3000; // Increased limit
        if (uniqueTrackingNumbers.length > MAX_BULK_ITEMS) {
            return res.status(400).json({ 
                error: 'Too many tracking numbers', 
                message: `Maximum ${MAX_BULK_ITEMS} items allowed. Use chunked processing for larger batches.`,
                maxAllowed: MAX_BULK_ITEMS
            });
        }

        // For MAWB updates, require MAWB number
        if (updateCode === 'UAN' && (!mawbNum || mawbNum.trim() === '')) {
            return res.status(400).json({ error: 'MAWB Number is required for this update' });
        }

        // Generate job ID and respond IMMEDIATELY (most important fix!)
        const jobId = generateJobId();
        
        // Store initial job status
        backgroundJobs.set(jobId, {
            status: 'queued',
            total: uniqueTrackingNumbers.length,
            processed: 0,
            successful: [],
            failed: [],
            updatedCount: 0,
            notUpdatedCount: 0
        });

        // SEND RESPONSE NOW - don't wait for processing to start
        res.json({
            jobId: jobId,
            status: 'queued',
            message: 'Job accepted and queued for processing',
            totalJobs: uniqueTrackingNumbers.length,
            estimatedTime: uniqueTrackingNumbers.length > 500 ? 
                `Approx ${Math.ceil(uniqueTrackingNumbers.length / 200)} minutes` : 
                'Less than 1 minute'
        });

        // Start processing AFTER response is sent (non-blocking)
        setTimeout(() => {
            processUpdateJobInBackground(jobId, {
                updateCode,
                mawbNum,
                trackingNumbers: uniqueTrackingNumbers,
                updateMethod,
                req
            });
        }, 100); // Small delay to ensure response is sent

    } catch (error) {
        console.error('Error in update job route:', error);
        // Only send error if headers not sent yet
        if (!res.headersSent) {
            res.status(500).json({ error: 'Server error', message: error.message });
        }
    }
});

// New route to check job status
app.get('/updateJob/status/:jobId', (req, res) => {
    const jobId = req.params.jobId;
    const job = backgroundJobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
});

// ==================================================
// 🔧 Update Processing Functions
// ==================================================

// UAN - MAWB Number Update
async function processMAWBUpdate(trackingNumber, mawbNum, req) {
    try {
        const jobExists = await checkJobExists(trackingNumber);
        if (!jobExists) {
            console.log(`❌ Job ${trackingNumber} not found in Detrack`);
            return false;
        }

        return await updateJobMAWB(trackingNumber, mawbNum, req);
    } catch (error) {
        console.error(`Error in MAWB update for ${trackingNumber}:`, error);
        return false;
    }
}

// Replace the existing updateJobMAWB function with this:
async function updateJobMAWB(trackingNumber, mawbNum, req) {
    try {
        // First get the current job details to calculate the fields
        const jobData = await getJobDetails(trackingNumber);

        if (!jobData) {
            console.log(`❌ No job data found for ${trackingNumber}`);
            return false;
        }

        // Calculate the additional fields using your comprehensive helper functions
        const finalArea = getAreaFromAddress(jobData.address);
        const finalPhoneNum = processPhoneNumber(jobData.phone_number);
        const finalAdditionalPhoneNum = processPhoneNumber(jobData.other_phone_numbers);

        console.log(`Calculated fields for ${trackingNumber}:`);
        console.log(`- Area: ${finalArea}`);
        console.log(`- Phone: ${finalPhoneNum}`);
        console.log(`- Additional Phone: ${finalAdditionalPhoneNum}`);

        // Update data with all fields
        const updateData = {
            do_number: trackingNumber,
            data: {
                run_number: mawbNum,
                zone: finalArea,
                phone_number: finalPhoneNum,
                other_phone_numbers: finalAdditionalPhoneNum
            }
        };

        console.log(`Updating ${trackingNumber} with MAWB: ${mawbNum}`);

        try {
            const response = await axios.put(
                'https://app.detrack.com/api/v2/dn/jobs/update',
                updateData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': apiKey
                    },
                    timeout: 10000 // 10 second timeout
                }
            );

            let updateSuccessful = false;

            if (response.data.success === true) {
                updateSuccessful = true;
                console.log(`✅ Detrack update successful - success: true`);
            } else if (response.data.status === 'success') {
                updateSuccessful = true;
                console.log(`✅ Detrack update successful - status: success`);
            } else if (response.status === 200) {
                // For 200 status, verify the update actually worked
                console.log(`⚠️ Got 200 status, verifying update...`);

                try {
                    // Wait a moment for update to propagate
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    const verifiedJob = await getJobDetails(trackingNumber);
                    if (verifiedJob && verifiedJob.run_number === mawbNum) {
                        updateSuccessful = true;
                        console.log(`✅ Detrack update verified - run_number updated to ${mawbNum}`);
                    } else {
                        console.log(`❌ Detrack update failed - run_number is "${verifiedJob?.run_number}", expected "${mawbNum}"`);
                        updateSuccessful = false;
                    }
                } catch (verifyError) {
                    console.log(`❌ Could not verify update:`, verifyError.message);
                    updateSuccessful = false;
                }
            }

            if (updateSuccessful) {
                console.log(`✅ Successfully updated ${trackingNumber} in Detrack`);

                // Now update/create in ORDERS collection
                try {
                    await updateOrCreateOrder(trackingNumber, mawbNum, req, jobData);
                    console.log(`✅ Successfully processed ORDERS for ${trackingNumber}`);
                    return true;
                } catch (orderError) {
                    console.error(`❌ Error updating ORDERS for ${trackingNumber}:`, orderError.message);
                    // Still return true since Detrack update was successful
                    return true;
                }
            } else {
                console.log(`❌ Detrack update failed for ${trackingNumber}`);
                return false;
            }

        } catch (apiError) {
            if (apiError.code === 'ECONNABORTED') {
                console.error(`❌ Timeout updating ${trackingNumber} in Detrack`);
            } else {
                console.error(`❌ API error updating ${trackingNumber}:`, apiError.message);
            }
            return false;
        }

    } catch (error) {
        console.error(`❌ Error preparing update for ${trackingNumber}:`, error);
        return false;
    }
}

// Other update functions (implement as needed)
async function processOnHoldUpdate(trackingNumber, req) {
    try {
        console.log(`Processing On Hold for: ${trackingNumber}`);
        // Add your specific Detrack API call for on hold status
        return await updateDetrackJobStatus(trackingNumber, 'on_hold');
    } catch (error) {
        console.error(`Error in On Hold update for ${trackingNumber}:`, error);
        return false;
    }
}

async function processItemInWarehouseUpdate(trackingNumber, req) {
    try {
        console.log(`Processing Item in Warehouse for: ${trackingNumber}`);
        // Add your specific Detrack API call for warehouse status
        return await updateDetrackJobStatus(trackingNumber, 'in_warehouse');
    } catch (error) {
        console.error(`Error in Warehouse update for ${trackingNumber}:`, error);
        return false;
    }
}

async function processOutForDeliveryUpdate(trackingNumber, req) {
    try {
        console.log(`Processing Out for Delivery for: ${trackingNumber}`);
        // Add your specific Detrack API call for OFD status
        return await updateDetrackJobStatus(trackingNumber, 'out_for_delivery');
    } catch (error) {
        console.error(`Error in OFD update for ${trackingNumber}:`, error);
        return false;
    }
}

async function processSelfCollectUpdate(trackingNumber, req) {
    try {
        console.log(`Processing Self Collect for: ${trackingNumber}`);
        // Add your specific Detrack API call for self collect
        return await updateDetrackJobStatus(trackingNumber, 'self_collect');
    } catch (error) {
        console.error(`Error in Self Collect update for ${trackingNumber}:`, error);
        return false;
    }
}

async function processClearJobUpdate(trackingNumber, req) {
    try {
        console.log(`Processing Clear Job for: ${trackingNumber}`);
        // Add your specific Detrack API call for clearing job
        return await updateDetrackJobStatus(trackingNumber, 'completed');
    } catch (error) {
        console.error(`Error in Clear Job update for ${trackingNumber}:`, error);
        return false;
    }
}

async function processGenericUpdate(trackingNumber, updateCode, req, mawbNum) {
    try {
        console.log(`Processing ${updateCode} for: ${trackingNumber}`);
        // Generic processor - implement logic based on updateCode
        console.log(`⚠️ No specific implementation for ${updateCode} yet`);
        return false;
    } catch (error) {
        console.error(`Error in ${updateCode} update for ${trackingNumber}:`, error);
        return false;
    }
}

// Replace the existing checkJobExists function with this:
async function checkJobExists(trackingNumber) {
    try {
        const response = await axios.get(
            `https://app.detrack.com/api/v2/dn/jobs/show/?do_number=${trackingNumber}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey
                },
                timeout: 8000, // 8 second timeout
                validateStatus: function (status) {
                    return status >= 200 && status < 500; // Resolve for all status codes < 500
                }
            }
        );

        console.log(`Check Job ${trackingNumber} - Status:`, response.status);

        const data = response.data;

        // Multiple ways to check if job exists based on Detrack API response
        if (response.status === 200) {
            // Check different possible response structures
            if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                return true;
            } else if (data.jobs && Array.isArray(data.jobs) && data.jobs.length > 0) {
                return true;
            } else if (data.success && data.data) {
                return true;
            } else if (data.data && data.data.do_number) {
                // Single job object response
                return true;
            } else {
                console.log(`Job ${trackingNumber} not found in response data`);
                return false;
            }
        } else if (response.status === 404) {
            console.log(`Job ${trackingNumber} not found (404)`);
            return false;
        } else {
            // Other status codes
            console.log(`Unexpected status code ${response.status} for ${trackingNumber}`);
            return false;
        }
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.error(`Timeout checking job ${trackingNumber}:`, error.message);
        } else {
            console.error(`Error checking job ${trackingNumber}:`, error.message);
        }
        return false;
    }
}

// Function to update or create order in ORDERS collection
async function updateOrCreateOrder(trackingNumber, mawbNum, req, jobData) {
    return new Promise(async (resolve, reject) => {
        try {
            // Check if order already exists
            const existingOrder = await ORDERS.findOne({ doTrackingNumber: trackingNumber });

            if (existingOrder) {
                // Update existing order - only mawbNo field
                await ORDERS.updateOne(
                    { doTrackingNumber: trackingNumber },
                    { $set: { mawbNo: mawbNum } }
                );
                console.log(`Updated MAWB for existing order: ${trackingNumber}`);
            } else {
                // Create new order with the jobData we already have
                await createNewOrder(jobData, trackingNumber, mawbNum, req);
                console.log(`Created new order: ${trackingNumber}`);
            }

            resolve(true);
        } catch (error) {
            reject(error);
        }
    });
}

// Replace the existing getJobDetails function with this:
async function getJobDetails(trackingNumber) {
    try {
        const response = await axios.get(
            `https://app.detrack.com/api/v2/dn/jobs/show/?do_number=${trackingNumber}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey
                },
                timeout: 8000, // 8 second timeout
                validateStatus: function (status) {
                    return status >= 200 && status < 500;
                }
            }
        );

        console.log(`Get Job Details ${trackingNumber} - Status:`, response.status);

        if (response.status !== 200) {
            console.log(`Failed to get job details: ${response.status}`);
            return null;
        }

        const data = response.data;
        console.log(`Get Job Details ${trackingNumber} - Response structure:`, Object.keys(data));

        // Handle different response structures
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            console.log(`Found job in data array`);
            return data.data[0];
        } else if (data.data && typeof data.data === 'object' && data.data.do_number) {
            console.log(`Found job in data object`);
            return data.data;
        } else if (data.do_number) {
            console.log(`Found job as direct object`);
            return data;
        } else if (data.jobs && Array.isArray(data.jobs) && data.jobs.length > 0) {
            console.log(`Found job in jobs array`);
            return data.jobs[0];
        } else {
            console.log(`No job data found in response`);
            return null;
        }
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.error(`Timeout getting job details ${trackingNumber}:`, error.message);
        } else {
            console.error(`Error getting job details ${trackingNumber}:`, error.message);
        }
        throw error;
    }
}

// Function to create new order
async function createNewOrder(jobData, trackingNumber, mawbNum, req) {
    // Process items array
    const itemsArray = [];
    if (jobData.items && Array.isArray(jobData.items)) {
        for (let i = 0; i < jobData.items.length; i++) {
            itemsArray.push({
                quantity: jobData.items[i].quantity || 0,
                description: jobData.items[i].description || '',
                totalItemPrice: jobData.total_price || jobData.payment_amount || 0
            });
        }
    }

    // Process area from address
    const finalArea = getAreaFromAddress(jobData.address);

    // Process product
    const { currentProduct, senderName } = getProductInfo(jobData.group_name, jobData.job_owner);

    // Process phone numbers
    const finalPhoneNum = processPhoneNumber(jobData.phone_number);
    const finalAdditionalPhoneNum = processPhoneNumber(jobData.other_phone_numbers);

    // Process postal code
    const postalCode = jobData.postal_code ? jobData.postal_code.toUpperCase() : '';

    // Determine payment method
    const totalAmount = jobData.total_price || jobData.payment_amount || 0;
    const paymentMethod = totalAmount > 0 ? 'Cash' : 'NON COD';

    // Create new order
    const newOrder = new ORDERS({
        area: finalArea,
        items: itemsArray,
        attempt: jobData.attempt || 1,
        history: [{
            statusHistory: "Info Received",
            dateUpdated: moment().format(),
            updatedBy: req.user.name,
            lastLocation: "Origin",
        }],
        latestLocation: "Origin",
        product: currentProduct,
        senderName: senderName,
        totalPrice: totalAmount,
        paymentAmount: totalAmount,
        receiverName: jobData.deliver_to_collect_from || '',
        trackingLink: jobData.tracking_link || '',
        currentStatus: "Info Received",
        paymentMethod: paymentMethod,
        warehouseEntry: "No",
        warehouseEntryDateTime: "N/A",
        receiverAddress: jobData.address || '',
        receiverPhoneNumber: finalPhoneNum,
        additionalPhoneNumber: finalAdditionalPhoneNum,
        doTrackingNumber: trackingNumber,
        remarks: jobData.remarks || '',
        lastUpdateDateTime: moment().format(),
        creationDate: jobData.created_at || moment().format(),
        lastUpdatedBy: req.user.name,
        receiverPostalCode: postalCode,
        jobType: jobData.type || 'Delivery',
        jobMethod: "Standard",
        flightDate: jobData.job_received_date || '',
        mawbNo: mawbNum,
        parcelWeight: jobData.weight || 0
    });

    await newOrder.save();
}

// Helper function to get area from address
function getAreaFromAddress(address) {
    if (!address) return 'N/A';

    const upperAddress = address.toUpperCase();
    let area = 'N/A';
    let kampong = '';

    if (upperAddress.includes("MANGGIS") == true) { area = "B", kampong = "MANGGIS" }
    else if (upperAddress.includes("DELIMA") == true) { area = "B", kampong = "DELIMA" }
    else if (upperAddress.includes("ANGGREK DESA") == true) { area = "B", kampong = "ANGGREK DESA" }
    else if (upperAddress.includes("ANGGREK") == true) { area = "B", kampong = "ANGGREK DESA" }
    else if (upperAddress.includes("PULAIE") == true) { area = "B", kampong = "PULAIE" }
    else if (upperAddress.includes("LAMBAK") == true) { area = "B", kampong = "LAMBAK" }
    else if (upperAddress.includes("TERUNJING") == true) { area = "B", kampong = "TERUNJING" }
    else if (upperAddress.includes("MADANG") == true) { area = "B", kampong = "MADANG" }
    else if (upperAddress.includes("AIRPORT") == true) { area = "B", kampong = "AIRPORT" }
    else if (upperAddress.includes("ORANG KAYA BESAR IMAS") == true) { area = "B", kampong = "OKBI" }
    else if (upperAddress.includes("OKBI") == true) { area = "B", kampong = "OKBI" }
    else if (upperAddress.includes("SERUSOP") == true) { area = "B", kampong = "SERUSOP" }
    else if (upperAddress.includes("BURONG PINGAI") == true) { area = "B", kampong = "BURONG PINGAI" }
    else if (upperAddress.includes("SETIA NEGARA") == true) { area = "B", kampong = "SETIA NEGARA" }
    else if (upperAddress.includes("PASIR BERAKAS") == true) { area = "B", kampong = "PASIR BERAKAS" }
    else if (upperAddress.includes("MENTERI BESAR") == true) { area = "B", kampong = "MENTERI BESAR" }
    else if (upperAddress.includes("KEBANGSAAN LAMA") == true) { area = "B", kampong = "KEBANGSAAN LAMA" }
    else if (upperAddress.includes("BATU MARANG") == true) { area = "B", kampong = "BATU MARANG" }
    else if (upperAddress.includes("DATO GANDI") == true) { area = "B", kampong = "DATO GANDI" }
    else if (upperAddress.includes("KAPOK") == true) { area = "B", kampong = "KAPOK" }
    else if (upperAddress.includes("KOTA BATU") == true) { area = "B", kampong = "KOTA BATU" }
    else if (upperAddress.includes("MENTIRI") == true) { area = "B", kampong = "MENTIRI" }
    else if (upperAddress.includes("MERAGANG") == true) { area = "B", kampong = "MERAGANG" }
    else if (upperAddress.includes("PELAMBAIAN") == true) { area = "B", kampong = "PELAMBAIAN" }
    else if (upperAddress.includes("PINTU MALIM") == true) { area = "B", kampong = "PINTU MALIM" }
    else if (upperAddress.includes("SALAMBIGAR") == true) { area = "B", kampong = "SALAMBIGAR" }
    else if (upperAddress.includes("SALAR") == true) { area = "B", kampong = "SALAR" }
    else if (upperAddress.includes("SERASA") == true) { area = "B", kampong = "SERASA" }
    else if (upperAddress.includes("SERDANG") == true) { area = "B", kampong = "SERDANG" }
    else if (upperAddress.includes("SUNGAI BASAR") == true) { area = "B", kampong = "SUNGAI BASAR" }
    else if (upperAddress.includes("SG BASAR") == true) { area = "B", kampong = "SUNGAI BASAR" }
    else if (upperAddress.includes("SUNGAI BELUKUT") == true) { area = "B", kampong = "SUNGAI BELUKUT" }
    else if (upperAddress.includes("SG BELUKUT") == true) { area = "B", kampong = "SUNGAI BELUKUT" }
    else if (upperAddress.includes("SUNGAI HANCHING") == true) { area = "B", kampong = "SUNGAI HANCHING" }
    else if (upperAddress.includes("SG HANCHING") == true) { area = "B", kampong = "SUNGAI HANCHING" }
    else if (upperAddress.includes("SUNGAI TILONG") == true) { area = "B", kampong = "SUNGAI TILONG" }
    else if (upperAddress.includes("SG TILONG") == true) { area = "B", kampong = "SUNGAI TILONG" }
    else if (upperAddress.includes("SUBOK") == true) { area = "B", kampong = "SUBOK" }
    else if (upperAddress.includes("SUNGAI AKAR") == true) { area = "B", kampong = "SUNGAI AKAR" }
    else if (upperAddress.includes("SG AKAR") == true) { area = "B", kampong = "SUNGAI AKAR" }
    else if (upperAddress.includes("SUNGAI BULOH") == true) { area = "B", kampong = "SUNGAI BULOH" }
    else if (upperAddress.includes("SG BULOH") == true) { area = "B", kampong = "SUNGAI BULOH" }
    else if (upperAddress.includes("TANAH JAMBU") == true) { area = "B", kampong = "TANAH JAMBU" }
    else if (upperAddress.includes("SUNGAI OROK") == true) { area = "B", kampong = "SUNGAI OROK" }
    else if (upperAddress.includes("SG OROK") == true) { area = "B", kampong = "SUNGAI OROK" }
    else if (upperAddress.includes("KATOK") == true) { area = "G", kampong = "KATOK" }
    else if (upperAddress.includes("MATA-MATA") == true) { area = "G", kampong = "MATA-MATA" }
    else if (upperAddress.includes("MATA MATA") == true) { area = "G", kampong = "MATA-MATA" }
    else if (upperAddress.includes("RIMBA") == true) { area = "G", kampong = "RIMBA" }
    else if (upperAddress.includes("TUNGKU") == true) { area = "G", kampong = "TUNGKU" }
    else if (upperAddress.includes("UBD") == true) { area = "G", kampong = "UBD" }
    else if (upperAddress.includes("UNIVERSITI BRUNEI DARUSSALAM") == true) { area = "G", kampong = "UBD" }
    else if (upperAddress.includes("JIS") == true) { area = "G" }
    else if (upperAddress.includes("JERUDONG INTERNATIONAL SCHOOL") == true) { area = "G", kampong = "JIS" }
    else if (upperAddress.includes("BERANGAN") == true) { area = "G", kampong = "BERANGAN" }
    else if (upperAddress.includes("BERIBI") == true) { area = "G", kampong = "BERIBI" }
    else if (upperAddress.includes("KIULAP") == true) { area = "G", kampong = "KIULAP" }
    else if (upperAddress.includes("RIPAS") == true) { area = "G", kampong = "RIPAS" }
    else if (upperAddress.includes("RAJA ISTERI PENGIRAN ANAK SALLEHA") == true) { area = "G", kampong = "RIPAS" }
    else if (upperAddress.includes("KIARONG") == true) { area = "G", kampong = "KIARONG" }
    else if (upperAddress.includes("PUSAR ULAK") == true) { area = "G", kampong = "PUSAR ULAK" }
    else if (upperAddress.includes("KUMBANG PASANG") == true) { area = "G", kampong = "KUMBANG PASANG" }
    else if (upperAddress.includes("MENGLAIT") == true) { area = "G", kampong = "MENGLAIT" }
    else if (upperAddress.includes("MABOHAI") == true) { area = "G", kampong = "MABOHAI" }
    else if (upperAddress.includes("ONG SUM PING") == true) { area = "G", kampong = "ONG SUM PING" }
    else if (upperAddress.includes("GADONG") == true) { area = "G", kampong = "GADONG" }
    else if (upperAddress.includes("TASEK LAMA") == true) { area = "G", kampong = "TASEK LAMA" }
    else if (upperAddress.includes("BANDAR TOWN") == true) { area = "G", kampong = "BANDAR TOWN" }
    else if (upperAddress.includes("BATU SATU") == true) { area = "JT", kampong = "BATU SATU" }
    else if (upperAddress.includes("BENGKURONG") == true) { area = "JT", kampong = "BENGKURONG" }
    else if (upperAddress.includes("BUNUT") == true) { area = "JT", kampong = "BUNUT" }
    else if (upperAddress.includes("JALAN BABU RAJA") == true) { area = "JT", kampong = "JALAN BABU RAJA" }
    else if (upperAddress.includes("JALAN ISTANA") == true) { area = "JT", kampong = "JALAN ISTANA" }
    else if (upperAddress.includes("JUNJONGAN") == true) { area = "JT", kampong = "JUNJONGAN" }
    else if (upperAddress.includes("KASAT") == true) { area = "JT", kampong = "KASAT" }
    else if (upperAddress.includes("LUMAPAS") == true) { area = "JT", kampong = "LUMAPAS" }
    else if (upperAddress.includes("JALAN HALUS") == true) { area = "JT", kampong = "JALAN HALUS" }
    else if (upperAddress.includes("MADEWA") == true) { area = "JT", kampong = "MADEWA" }
    else if (upperAddress.includes("PUTAT") == true) { area = "JT", kampong = "PUTAT" }
    else if (upperAddress.includes("SINARUBAI") == true) { area = "JT", kampong = "SINARUBAI" }
    else if (upperAddress.includes("TASEK MERADUN") == true) { area = "JT", kampong = "TASEK MERADUN" }
    else if (upperAddress.includes("TELANAI") == true) { area = "JT", kampong = "TELANAI" }
    else if (upperAddress.includes("BAN 1") == true) { area = "JT", kampong = "BAN" }
    else if (upperAddress.includes("BAN 2") == true) { area = "JT", kampong = "BAN" }
    else if (upperAddress.includes("BAN 3") == true) { area = "JT", kampong = "BAN" }
    else if (upperAddress.includes("BAN 4") == true) { area = "JT", kampong = "BAN" }
    else if (upperAddress.includes("BAN 5") == true) { area = "JT", kampong = "BAN" }
    else if (upperAddress.includes("BAN 6") == true) { area = "JT", kampong = "BAN" }
    else if (upperAddress.includes("BATONG") == true) { area = "JT", kampong = "BATONG" }
    else if (upperAddress.includes("BATU AMPAR") == true) { area = "JT", kampong = "BATU AMPAR" }
    else if (upperAddress.includes("BEBATIK") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
    else if (upperAddress.includes("BEBULOH") == true) { area = "JT", kampong = "BEBULOH" }
    else if (upperAddress.includes("BEBATIK KILANAS") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
    else if (upperAddress.includes("KILANAS") == true) { area = "JT", kampong = "BEBATIK KILANAS" }
    else if (upperAddress.includes("DADAP") == true) { area = "JT", kampong = "DADAP" }
    else if (upperAddress.includes("KUALA LURAH") == true) { area = "JT", kampong = "KUALA LURAH" }
    else if (upperAddress.includes("KULAPIS") == true) { area = "JT", kampong = "KULAPIS" }
    else if (upperAddress.includes("LIMAU MANIS") == true) { area = "JT", kampong = "LIMAU MANIS" }
    else if (upperAddress.includes("MASIN") == true) { area = "JT", kampong = "MASIN" }
    else if (upperAddress.includes("MULAUT") == true) { area = "JT", kampong = "MULAUT" }
    else if (upperAddress.includes("PANCHOR MURAI") == true) { area = "JT", kampong = "PANCHOR MURAI" }
    else if (upperAddress.includes("PANCHUR MURAI") == true) { area = "JT", kampong = "PANCHOR MURAI" }
    else if (upperAddress.includes("PANGKALAN BATU") == true) { area = "JT", kampong = "PANGKALAN BATU" }
    else if (upperAddress.includes("PASAI") == true) { area = "JT", kampong = "PASAI" }
    else if (upperAddress.includes("WASAN") == true) { area = "JT", kampong = "WASAN" }
    else if (upperAddress.includes("PARIT") == true) { area = "JT", kampong = "PARIT" }
    else if (upperAddress.includes("EMPIRE") == true) { area = "JT", kampong = "EMPIRE" }
    else if (upperAddress.includes("JANGSAK") == true) { area = "JT", kampong = "JANGSAK" }
    else if (upperAddress.includes("JERUDONG") == true) { area = "JT", kampong = "JERUDONG" }
    else if (upperAddress.includes("KATIMAHAR") == true) { area = "JT", kampong = "KATIMAHAR" }
    else if (upperAddress.includes("LUGU") == true) { area = "JT", kampong = "LUGU" }
    else if (upperAddress.includes("SENGKURONG") == true) { area = "JT", kampong = "SENGKURONG" }
    else if (upperAddress.includes("TANJONG NANGKA") == true) { area = "JT", kampong = "TANJONG NANGKA" }
    else if (upperAddress.includes("TANJONG BUNUT") == true) { area = "JT", kampong = "TANJONG BUNUT" }
    else if (upperAddress.includes("TANJUNG BUNUT") == true) { area = "JT", kampong = "TANJONG BUNUT" }
    else if (upperAddress.includes("SUNGAI TAMPOI") == true) { area = "JT", kampung = "SUNGAI TAMPOI" }
    else if (upperAddress.includes("SG TAMPOI") == true) { area = "JT", kampong = "SUNGAI TAMPOI" }
    else if (upperAddress.includes("MUARA") == true) { area = "B", kampong = "MUARA" }
    //TU
    else if (upperAddress.includes("SENGKARAI") == true) { area = "TUTONG", kampong = "SENGKARAI" }
    else if (upperAddress.includes("PANCHOR") == true) { area = "TUTONG", kampong = "PANCHOR" }
    else if (upperAddress.includes("PENABAI") == true) { area = "TUTONG", kampong = "PENABAI" }
    else if (upperAddress.includes("KUALA TUTONG") == true) { area = "TUTONG", kampong = "KUALA TUTONG" }
    else if (upperAddress.includes("PENANJONG") == true) { area = "TUTONG", kampong = "PENANJONG" }
    else if (upperAddress.includes("KERIAM") == true) { area = "TUTONG", kampong = "KERIAM" }
    else if (upperAddress.includes("BUKIT PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
    else if (upperAddress.includes("PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
    else if (upperAddress.includes("LUAGAN") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
    else if (upperAddress.includes("DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
    else if (upperAddress.includes("LUAGAN DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
    else if (upperAddress.includes("SINAUT") == true) { area = "TUTONG", kampong = "SINAUT" }
    else if (upperAddress.includes("SUNGAI KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
    else if (upperAddress.includes("KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
    else if (upperAddress.includes("SG KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
    else if (upperAddress.includes("KUPANG") == true) { area = "TUTONG", kampong = "KUPANG" }
    else if (upperAddress.includes("KIUDANG") == true) { area = "TUTONG", kampong = "KIUDANG" }
    else if (upperAddress.includes("PAD") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
    else if (upperAddress.includes("NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
    else if (upperAddress.includes("PAD NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
    else if (upperAddress.includes("BEKIAU") == true) { area = "TUTONG", kampong = "BEKIAU" }
    else if (upperAddress.includes("MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
    else if (upperAddress.includes("PENGKALAN MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
    else if (upperAddress.includes("BATANG MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
    else if (upperAddress.includes("MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
    else if (upperAddress.includes("KEBIA") == true) { area = "TUTONG", kampong = "KEBIA" }
    else if (upperAddress.includes("BIRAU") == true) { area = "TUTONG", kampong = "BIRAU" }
    else if (upperAddress.includes("LAMUNIN") == true) { area = "TUTONG", kampong = "LAMUNIN" }
    else if (upperAddress.includes("LAYONG") == true) { area = "TUTONG", kampong = "LAYONG" }
    else if (upperAddress.includes("MENENGAH") == true) { area = "TUTONG", kampong = "MENENGAH" }
    else if (upperAddress.includes("PANCHONG") == true) { area = "TUTONG", kampong = "PANCHONG" }
    else if (upperAddress.includes("PENAPAR") == true) { area = "TUTONG", kampong = "PANAPAR" }
    else if (upperAddress.includes("TANJONG MAYA") == true) { area = "TUTONG", kampong = "TANJONG MAYA" }
    else if (upperAddress.includes("MAYA") == true) { area = "TUTONG", kampong = "MAYA" }
    else if (upperAddress.includes("LUBOK") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
    else if (upperAddress.includes("PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
    else if (upperAddress.includes("LUBOK PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
    else if (upperAddress.includes("BUKIT UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
    else if (upperAddress.includes("UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
    else if (upperAddress.includes("RAMBAI") == true) { area = "TUTONG", kampong = "RAMBAI" }
    else if (upperAddress.includes("BENUTAN") == true) { area = "TUTONG", kampong = "BENUTAN" }
    else if (upperAddress.includes("MERIMBUN") == true) { area = "TUTONG", kampong = "MERIMBUN" }
    else if (upperAddress.includes("UKONG") == true) { area = "TUTONG", kampong = "UKONG" }
    else if (upperAddress.includes("LONG") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
    else if (upperAddress.includes("MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
    else if (upperAddress.includes("LONG MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
    else if (upperAddress.includes("TELISAI") == true) { area = "TUTONG", kampong = "TELISAI" }
    else if (upperAddress.includes("DANAU") == true) { area = "TUTONG", kampong = "DANAU" }
    else if (upperAddress.includes("BUKIT BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
    else if (upperAddress.includes("BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
    else if (upperAddress.includes("TUTONG") == true) { area = "TUTONG", kampong = "TUTONG" }
    //KB
    else if (upperAddress.includes("AGIS") == true) { area = "LUMUT", kampong = "AGIS" }
    else if (upperAddress.includes("ANDALAU") == true) { area = "LUMUT", kampong = "ANDALAU" }
    else if (upperAddress.includes("ANDUKI") == true) { area = "LUMUT", kampong = "ANDUKI" }
    else if (upperAddress.includes("APAK") == true) { area = "KB / SERIA", kampong = "APAK" }
    else if (upperAddress.includes("BADAS") == true) { area = "LUMUT", kampong = "BADAS" }
    else if (upperAddress.includes("BANG") == true) { area = "KB / SERIA", kampong = "BANG" }
    else if (upperAddress.includes("GARANG") == true) { area = "KB / SERIA", kampong = "GARANG" }
    else if (upperAddress.includes("PUKUL") == true) { area = "KB / SERIA", kampong = "PUKUL" }
    else if (upperAddress.includes("TAJUK") == true) { area = "KB / SERIA", kampong = "TAJUK" }
    else if (upperAddress.includes("BENGERANG") == true) { area = "KB / SERIA", kampong = "BENGERANG" }
    else if (upperAddress.includes("BIADONG") == true) { area = "KB / SERIA", kampong = "BIADONG" }
    else if (upperAddress.includes("ULU") == true) { area = "KB / SERIA", kampong = "ULU" }
    else if (upperAddress.includes("TENGAH") == true) { area = "KB / SERIA", kampong = "TENGAH" }
    else if (upperAddress.includes("BISUT") == true) { area = "KB / SERIA", kampong = "BISUT" }
    else if (upperAddress.includes("BUAU") == true) { area = "KB / SERIA", kampong = "BUAU" }
    else if (upperAddress.includes("KANDOL") == true) { area = "KB / SERIA", kampong = "KANDOL" }
    else if (upperAddress.includes("PUAN") == true) { area = "KB / SERIA", kampong = "PUAN" }
    else if (upperAddress.includes("TUDING") == true) { area = "LUMUT", kampong = "TUDING" }
    else if (upperAddress.includes("SAWAT") == true) { area = "KB / SERIA", kampong = "SAWAT" }
    else if (upperAddress.includes("SERAWONG") == true) { area = "KB / SERIA", kampong = "SERAWONG" }
    else if (upperAddress.includes("CHINA") == true) { area = "KB / SERIA", kampong = "CHINA" }
    else if (upperAddress.includes("DUGUN") == true) { area = "KB / SERIA", kampong = "DUGUN" }
    else if (upperAddress.includes("GATAS") == true) { area = "KB / SERIA", kampong = "GATAS" }
    else if (upperAddress.includes("JABANG") == true) { area = "KB / SERIA", kampong = "JABANG" }
    else if (upperAddress.includes("KAGU") == true) { area = "KB / SERIA", kampong = "KAGU" }
    else if (upperAddress.includes("KAJITAN") == true) { area = "KB / SERIA", kampong = "KAJITAN" }
    else if (upperAddress.includes("KELUYOH") == true) { area = "KB / SERIA", kampong = "KELUYOH" }
    else if (upperAddress.includes("KENAPOL") == true) { area = "KB / SERIA", kampong = "KENAPOL" }
    else if (upperAddress.includes("KUALA BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
    else if (upperAddress.includes("BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
    else if (upperAddress.includes("KUALA BELAIT") == true) { area = "KB", kampong = "KUALA BELAIT" }
    else if (upperAddress.includes("KUKUB") == true) { area = "KB / SERIA", kampong = "KUKUB" }
    else if (upperAddress.includes("LABI") == true) { area = "LUMUT", kampong = "LABI" }
    else if (upperAddress.includes("LAKANG") == true) { area = "KB / SERIA", kampong = "LAKANG" }
    else if (upperAddress.includes("LAONG ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
    else if (upperAddress.includes("ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
    else if (upperAddress.includes("LAONG") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
    else if (upperAddress.includes("LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
    else if (upperAddress.includes("SUNGAI LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
    else if (upperAddress.includes("SG LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
    else if (upperAddress.includes("LUMUT") == true) { area = "LUMUT", kampong = "LUMUT" }
    else if (upperAddress.includes("LORONG") == true) { area = "SERIA", kampong = "LORONG" }
    else if (upperAddress.includes("LORONG TENGAH") == true) { area = "SERIA", kampong = "LORONG TENGAH" }
    else if (upperAddress.includes("LORONG TIGA SELATAN") == true) { area = "SERIA", kampong = "LORONG TIGA SELATAN" }
    else if (upperAddress.includes("LILAS") == true) { area = "KB / SERIA", kampong = "LILAS" }
    else if (upperAddress.includes("LUBUK LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
    else if (upperAddress.includes("LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
    else if (upperAddress.includes("LUBUK TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
    else if (upperAddress.includes("TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
    else if (upperAddress.includes("MALA'AS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
    else if (upperAddress.includes("MALAAS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
    else if (upperAddress.includes("MALAYAN") == true) { area = "KB / SERIA", kampong = "MELAYAN" }
    else if (upperAddress.includes("MELAYU") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
    else if (upperAddress.includes("ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
    else if (upperAddress.includes("MELAYU ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
    else if (upperAddress.includes("MELILAS") == true) { area = "LUMUT", kampong = "MELILAS" }
    else if (upperAddress.includes("MENDARAM") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
    else if (upperAddress.includes("MENDARAM BESAR") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
    else if (upperAddress.includes("MENDARAM KECIL") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
    else if (upperAddress.includes("MERANGKING") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
    else if (upperAddress.includes("MERANGKING ULU") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
    else if (upperAddress.includes("MERANGKING HILIR") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
    else if (upperAddress.includes("MUMONG") == true) { area = "KB", kampong = "MUMONG" }
    else if (upperAddress.includes("PANDAN") == true) { area = "KB", kampong = "PANDAN" }
    else if (upperAddress.includes("PADANG") == true) { area = "KB", kampong = "PADANG" }
    else if (upperAddress.includes("PANAGA") == true) { area = "SERIA", kampong = "PANAGA" }
    else if (upperAddress.includes("PENGKALAN SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
    else if (upperAddress.includes("SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
    else if (upperAddress.includes("PENGALAYAN") == true) { area = "KB / SERIA", kampong = "PENGALAYAN" }
    else if (upperAddress.includes("PENYRAP") == true) { area = "KB / SERIA", kampong = "PENYRAP" }
    else if (upperAddress.includes("PERANGKONG") == true) { area = "KB / SERIA", kampong = "PERANGKONG" }
    else if (upperAddress.includes("PERUMPONG") == true) { area = "LUMUT", kampong = "PERUMPONG" }
    else if (upperAddress.includes("PESILIN") == true) { area = "KB / SERIA", kampong = "PESILIN" }
    else if (upperAddress.includes("PULAU APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
    else if (upperAddress.includes("APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
    else if (upperAddress.includes("RAMPAYOH") == true) { area = "KB / SERIA", kampong = "RAMPAYOH" }
    else if (upperAddress.includes("RATAN") == true) { area = "KB / SERIA", kampong = "RATAN" }
    else if (upperAddress.includes("SAUD") == true) { area = "KB / SERIA", kampong = "SAUD" }
    //else if (upperAddress.includes("SIMPANG") == true) {area = "KB / SERIA", kampong = "SIMPANG TIGA"}
    else if (upperAddress.includes("SIMPANG TIGA") == true) { area = "LUMUT", kampong = "SIMPANG TIGA" }
    else if (upperAddress.includes("SINGAP") == true) { area = "KB / SERIA", kampong = "SINGAP" }
    else if (upperAddress.includes("SUKANG") == true) { area = "KB / SERIA", kampong = "SUKANG" }
    else if (upperAddress.includes("BAKONG") == true) { area = "LUMUT", kampong = "BAKONG" }
    else if (upperAddress.includes("DAMIT") == true) { area = "KB / SERIA", kampong = "DAMIT" }
    else if (upperAddress.includes("BERA") == true) { area = "KB / SERIA", kampong = "BERA" }
    else if (upperAddress.includes("DUHON") == true) { area = "KB / SERIA", kampong = "DUHON" }
    else if (upperAddress.includes("GANA") == true) { area = "LUMUT", kampong = "GANA" }
    else if (upperAddress.includes("HILIR") == true) { area = "KB / SERIA", kampong = "HILIR" }
    else if (upperAddress.includes("KANG") == true) { area = "LUMUT", kampong = "KANG" }
    else if (upperAddress.includes("KURU") == true) { area = "LUMUT", kampong = "KURU" }
    else if (upperAddress.includes("LALIT") == true) { area = "LUMUT", kampong = "LALIT" }
    else if (upperAddress.includes("LUTONG") == true) { area = "KB / SERIA", kampong = "LUTONG" }
    else if (upperAddress.includes("MAU") == true) { area = "KB / SERIA", kampong = "MAU" }
    else if (upperAddress.includes("MELILIT") == true) { area = "KB / SERIA", kampong = "MELILIT" }
    else if (upperAddress.includes("PETAI") == true) { area = "KB / SERIA", kampong = "PETAI" }
    else if (upperAddress.includes("TALI") == true) { area = "LUMUT", kampong = "TALI" }
    else if (upperAddress.includes("TARING") == true) { area = "LUMUT", kampong = "TARING" }
    else if (upperAddress.includes("TERABAN") == true) { area = "KB", kampong = "TERABAN" }
    else if (upperAddress.includes("UBAR") == true) { area = "KB / SERIA", kampong = "UBAR" }
    else if (upperAddress.includes("TANAJOR") == true) { area = "KB / SERIA", kampong = "TANAJOR" }
    else if (upperAddress.includes("TANJONG RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
    else if (upperAddress.includes("RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
    else if (upperAddress.includes("TANJONG SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
    else if (upperAddress.includes("SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
    else if (upperAddress.includes("TAPANG LUPAK") == true) { area = "KB / SERIA", kampong = "TAPANG LUPAK" }
    else if (upperAddress.includes("TARAP") == true) { area = "KB / SERIA", kampong = "TARAP" }
    else if (upperAddress.includes("TEMPINAK") == true) { area = "KB / SERIA", kampong = "TEMPINAK" }
    else if (upperAddress.includes("TERAJA") == true) { area = "KB / SERIA", kampong = "TERAJA" }
    else if (upperAddress.includes("TERAWAN") == true) { area = "KB / SERIA", kampong = "TERAWAN" }
    else if (upperAddress.includes("TERUNAN") == true) { area = "KB / SERIA", kampong = "TERUNAN" }
    else if (upperAddress.includes("TUGONG") == true) { area = "KB / SERIA", kampong = "TUGONG" }
    else if (upperAddress.includes("TUNGULLIAN") == true) { area = "LUMUT", kampong = "TUNGULLIAN" }
    else if (upperAddress.includes("UBOK") == true) { area = "KB / SERIA", kampong = "UBOK" }
    else if (upperAddress.includes("BELAIT") == true) { area = "KB / SERIA", kampong = "BELAIT" }
    else if (upperAddress.includes("SERIA") == true) { area = "KB / SERIA", kampong = "BELAIT" }
    //TE
    else if (upperAddress.includes("AMO") == true) { area = "TEMBURONG", kampong = "AMO" }
    else if (upperAddress.includes("AYAM-AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
    else if (upperAddress.includes("AYAM AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
    else if (upperAddress.includes("BAKARUT") == true) { area = "TEMBURONG", kampong = "BAKARUT" }
    else if (upperAddress.includes("BATANG DURI") == true) { area = "TEMBURONG", kampong = "BATANG DURI" }
    else if (upperAddress.includes("BATANG TUAU") == true) { area = "TEMBURONG", kampong = "BATANG TUAU" }
    else if (upperAddress.includes("BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
    else if (upperAddress.includes("APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
    else if (upperAddress.includes("BATU BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
    else if (upperAddress.includes("BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
    else if (upperAddress.includes("BELABAN") == true) { area = "TEMBURONG", kampong = "BELABAN" }
    else if (upperAddress.includes("BELAIS") == true) { area = "TEMBURONG", kampong = "BELAIS" }
    else if (upperAddress.includes("BELINGOS") == true) { area = "TEMBURONG", kampong = "BELINGOS" }
    else if (upperAddress.includes("BIANG") == true) { area = "TEMBURONG", kampong = "BIANG" }
    else if (upperAddress.includes("BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
    else if (upperAddress.includes("BUDA BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
    else if (upperAddress.includes("BUDA-BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
    else if (upperAddress.includes("GADONG BARU") == true) { area = "TEMBURONG", kampong = "GADONG BARU" }
    else if (upperAddress.includes("KENUA") == true) { area = "TEMBURONG", kampong = "KENUA" }
    else if (upperAddress.includes("LABU ESTATE") == true) { area = "TEMBURONG", kampong = "LABU" }
    else if (upperAddress.includes("LABU") == true) { area = "TEMBURONG", kampong = "LABU" }
    else if (upperAddress.includes("LAGAU") == true) { area = "TEMBURONG", kampong = "LAGAU" }
    else if (upperAddress.includes("LAKIUN") == true) { area = "TEMBURONG", kampong = "LAKIUN" }
    else if (upperAddress.includes("LAMALING") == true) { area = "TEMBURONG", kampong = "LAMALING" }
    else if (upperAddress.includes("LEPONG") == true) { area = "TEMBURONG", kampong = "LEPONG" }
    else if (upperAddress.includes("LUAGAN") == true) { area = "TEMBURONG", kampong = "LUAGAN" }
    else if (upperAddress.includes("MANIUP") == true) { area = "TEMBURONG", kampong = "MANIUP" }
    else if (upperAddress.includes("MENENGAH") == true) { area = "TEMBURONG", kampong = "MENGENGAH" }
    else if (upperAddress.includes("NEGALANG") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
    else if (upperAddress.includes("NEGALANG ERING") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
    else if (upperAddress.includes("NEGALANG UNAT") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
    else if (upperAddress.includes("PARIT") == true) { area = "TEMBURONG", kampong = "PARIT" }
    else if (upperAddress.includes("PARIT BELAYANG") == true) { area = "TEMBURONG", kampong = "PARIT BELAYANG" }
    else if (upperAddress.includes("PAYAU") == true) { area = "TEMBURONG", kampong = "PAYAU" }
    else if (upperAddress.includes("PELIUNAN") == true) { area = "TEMBURONG", kampong = "PELIUNAN" }
    else if (upperAddress.includes("PERDAYAN") == true) { area = "TEMBURONG", kampong = "PERDAYAN" }
    else if (upperAddress.includes("PIASAU-PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
    else if (upperAddress.includes("PIASAU PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
    else if (upperAddress.includes("PIUNGAN") == true) { area = "TEMBURONG", kampong = "PIUNGAN" }
    else if (upperAddress.includes("PUNI") == true) { area = "TEMBURONG", kampong = "PUNI" }
    else if (upperAddress.includes("RATAIE") == true) { area = "TEMBURONG", kampong = "RATAIE" }
    else if (upperAddress.includes("REBADA") == true) { area = "TEMBURONG", kampong = "REBADA" }
    else if (upperAddress.includes("SEKUROP") == true) { area = "TEMBURONG", kampong = "SEKUROP" }
    else if (upperAddress.includes("SELANGAN") == true) { area = "TEMBURONG", kampong = "SELANGAN" }
    else if (upperAddress.includes("SELAPON") == true) { area = "TEMBURONG", kampong = "SELAPON" }
    else if (upperAddress.includes("SEMABAT") == true) { area = "TEMBURONG", kampong = "SEMABAT" }
    else if (upperAddress.includes("SEMAMAMNG") == true) { area = "TEMBURONG", kampong = "SEMAMANG" }
    else if (upperAddress.includes("SENUKOH") == true) { area = "TEMBURONG", kampong = "SENUKOH" }
    else if (upperAddress.includes("SERI TANJONG BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
    else if (upperAddress.includes("BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
    else if (upperAddress.includes("SIBULU") == true) { area = "TEMBURONG", kampong = "SIBULU" }
    else if (upperAddress.includes("SIBUT") == true) { area = "TEMBURONG", kampong = "SIBUT" }
    else if (upperAddress.includes("SIMBATANG BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
    else if (upperAddress.includes("SIMBATANG BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
    else if (upperAddress.includes("SUBOK") == true) { area = "TEMBURONG", kampong = "SUBOK" }
    else if (upperAddress.includes("SUMBILING") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
    else if (upperAddress.includes("SUMBILING BARU") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
    else if (upperAddress.includes("SUMBILING LAMA") == true) { area = "TEMBURONG", kampong = "SUMBILING LAMA" }
    else if (upperAddress.includes("SUNGAI RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
    else if (upperAddress.includes("SG RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
    else if (upperAddress.includes("SUNGAI SULOK") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
    else if (upperAddress.includes("SG SULOK ") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
    else if (upperAddress.includes("SUNGAI TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
    else if (upperAddress.includes("SG TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
    else if (upperAddress.includes("SUNGAI TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
    else if (upperAddress.includes("SG TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
    else if (upperAddress.includes("TANJONG BUNGAR") == true) { area = "TEMBURONG", kampong = "TANJONG BUNGAR" }
    else if (upperAddress.includes("TEMADA") == true) { area = "TEMBURONG", kampong = "TEMADA" }
    else if (upperAddress.includes("UJONG JALAN") == true) { area = "TEMBURONG", kampong = "UJONG JALAN" }
    else if (upperAddress.includes("BANGAR") == true) { area = "TEMBURONG", kampong = "BANGAR" }
    else if (upperAddress.includes("TEMBURONG") == true) { area = "TEMBURONG" }
    else { area = "N/A" }

    return area;
}

// Helper function to get product info
function getProductInfo(groupName, jobOwner) {
    let currentProduct = '';
    let senderName = '';

    const product = groupName || '';

    if (product === 'PURE51') {
        currentProduct = 'pure51';
    } else if (product === 'CBSL') {
        currentProduct = 'cbsl';
    } else if (product === 'JPMC') {
        currentProduct = 'pharmacyjpmc';
    } else if (product === 'LD') {
        currentProduct = 'localdelivery';
    } else if (product === 'MOH') {
        currentProduct = 'pharmacymoh';
    } else if (product === 'PHC') {
        currentProduct = 'pharmacyphc';
    } else if (product === 'ICARUS') {
        currentProduct = 'icarus';
    } else if (product === 'EWE') {
        currentProduct = 'ewe';
        senderName = "EWE";
    } else if (product === 'KPTDP') {
        currentProduct = 'kptdp';
    } else if (product === 'PDU') {
        currentProduct = 'pdu';
        senderName = "SYPOST";
    } else if (product === 'MGLOBAL') {
        currentProduct = 'mglobal';
        senderName = "MGLOBAL";
    } else if (product === 'GDEX' || product === 'GDEXT') {
        currentProduct = product.toLowerCase();
        senderName = jobOwner || '';
    }

    return { currentProduct, senderName };
}

// Helper function to process phone numbers
function processPhoneNumber(phoneNumber) {
    if (!phoneNumber) {
        return "";
    }

    // Remove any spaces or special characters
    const cleanNumber = phoneNumber.toString().replace(/\D/g, '');

    if (cleanNumber.length === 7) {
        return "+673" + cleanNumber;
    } else if (cleanNumber.length === 10 && cleanNumber.startsWith('673')) {
        return "+" + cleanNumber;
    } else if (cleanNumber.length === 11 && cleanNumber.startsWith('673')) {
        return "+" + cleanNumber;
    } else {
        return phoneNumber; // Return original if format doesn't match
    }
}

// Generic function to update Detrack job status (placeholder - implement based on your needs)
async function updateDetrackJobStatus(trackingNumber, status) {
    return new Promise((resolve, reject) => {
        // TODO: Implement actual Detrack API call for status updates
        console.log(`Would update ${trackingNumber} to status: ${status}`);

        // Temporary - return true for testing
        // In production, make actual API call to Detrack
        setTimeout(() => {
            resolve(true); // Change this to actual API call result
        }, 500);
    });
}

// ==================================================
// 🔧 Batch Processing Utilities
// ==================================================

// Helper function to process single tracking number
async function processSingleTrackingNumber(trackingNumber, updateCode, mawbNum, req) {
    const cleanTrackingNumber = trackingNumber.trim();

    if (!cleanTrackingNumber) {
        return { success: false, error: 'Empty tracking number' };
    }

    try {
        let processSuccess = false;
        let message = '';

        switch (updateCode) {
            case 'UAN':
                processSuccess = await processMAWBUpdate(cleanTrackingNumber, mawbNum, req);
                message = processSuccess ? `MAWB Number updated to ${mawbNum}` : 'MAWB update failed';
                break;
            case 'CCH':
                processSuccess = await processOnHoldUpdate(cleanTrackingNumber, req);
                message = processSuccess ? 'Job put on hold' : 'On hold update failed';
                break;
            case 'IIW':
                processSuccess = await processItemInWarehouseUpdate(cleanTrackingNumber, req);
                message = processSuccess ? 'Item marked in warehouse' : 'Warehouse update failed';
                break;
            case 'OFD':
                processSuccess = await processOutForDeliveryUpdate(cleanTrackingNumber, req);
                message = processSuccess ? 'Marked as out for delivery' : 'OFD update failed';
                break;
            case 'OSC':
                processSuccess = await processSelfCollectUpdate(cleanTrackingNumber, req);
                message = processSuccess ? 'Marked for self collect' : 'Self collect update failed';
                break;
            case 'SFJ':
                processSuccess = await processClearJobUpdate(cleanTrackingNumber, req);
                message = processSuccess ? 'Job cleared' : 'Clear job failed';
                break;
            default:
                processSuccess = await processGenericUpdate(cleanTrackingNumber, updateCode, req, mawbNum);
                message = processSuccess ? `Updated with ${updateCode}` : `${updateCode} update failed`;
        }

        return { success: processSuccess, message };

    } catch (error) {
        console.error(`Error processing ${cleanTrackingNumber}:`, error);
        return { success: false, error: error.message };
    }
}

// Function to process a batch of tracking numbers in parallel
async function processBatch(batch, updateCode, mawbNum, req) {
    // Process all items in the batch in parallel
    const batchPromises = batch.map(trackingNumber =>
        processSingleTrackingNumber(trackingNumber, updateCode, mawbNum, req)
    );

    // Wait for all promises to settle (both fulfilled and rejected)
    const batchResults = await Promise.allSettled(batchPromises);

    // Process results
    const results = {
        successful: [],
        failed: [],
        updatedCount: 0,
        notUpdatedCount: 0
    };

    batchResults.forEach((result, index) => {
        const trackingNumber = batch[index];

        if (result.status === 'fulfilled' && result.value.success) {
            results.successful.push({
                trackingNumber: trackingNumber,
                result: result.value.message || `Successfully updated with ${updateCode}`
            });
            results.updatedCount++;
        } else {
            const errorMsg = result.status === 'rejected'
                ? result.reason.message
                : (result.value?.error || 'Update failed');

            results.failed.push({
                trackingNumber: trackingNumber,
                result: 'Error: ' + errorMsg
            });
            results.notUpdatedCount++;
        }
    });

    return results;
}

// ==================================================
// ⏱ Heroku Timeout Handling
// ==================================================

// Add timeout handling for Heroku's 30-second limit
app.use((req, res, next) => {
    // Set a timeout of 25 seconds (leaves 5 seconds for Heroku to respond)
    req.setTimeout(25000, () => {
        if (!res.headersSent) {
            console.log(`Request timeout for ${req.method} ${req.url}`);
        }
    });

    res.setTimeout(25000, () => {
        if (!res.headersSent) {
            res.status(503).json({
                error: 'Request timeout',
                message: 'Processing took too long. Please try with fewer items or use background processing.'
            });
        }
    });

    next();
});

// ==================================================
// 🧹 Job Cleanup (Memory Management)
// ==================================================

// Clean up old completed jobs (keep last 50 jobs max)
function cleanupOldJobs() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const maxJobs = 50; // Keep max 50 jobs in memory

    let jobsArray = Array.from(backgroundJobs.entries());

    if (jobsArray.length > maxJobs) {
        // Sort by timestamp (jobId contains timestamp)
        jobsArray.sort((a, b) => {
            const timeA = parseInt(a[0].split('_')[1]) || 0;
            const timeB = parseInt(b[0].split('_')[1]) || 0;
            return timeB - timeA; // Newest first
        });

        // Remove oldest jobs
        const jobsToKeep = jobsArray.slice(0, maxJobs);
        backgroundJobs.clear();
        jobsToKeep.forEach(([key, value]) => backgroundJobs.set(key, value));
    }

    // Remove jobs older than maxAge
    jobsArray.forEach(([jobId, jobData]) => {
        if (jobData.startTime && (now - jobData.startTime) > maxAge) {
            backgroundJobs.delete(jobId);
            console.log(`Cleaned up old job: ${jobId}`);
        }
    });
}

// Run cleanup every 5 minutes
setInterval(cleanupOldJobs, 5 * 60 * 1000);

// ==================================================
// 🔄 Chunk Processing Route
// ==================================================

// Special route for chunk processing (immediate response)
app.post('/updateJob/chunk', async (req, res) => {
    try {
        const { updateCode, mawbNum, trackingNumbers, chunkIndex } = req.body;

        // Basic validation
        if (!updateCode || !trackingNumbers || trackingNumbers.length === 0) {
            return res.status(400).json({ error: 'Invalid chunk data' });
        }

        // Clean and validate
        const cleanTrackingNumbers = trackingNumbers
            .map(num => num.trim())
            .filter(num => num !== '');

        const uniqueTrackingNumbers = [...new Set(cleanTrackingNumbers)];

        if (uniqueTrackingNumbers.length === 0) {
            return res.status(400).json({ error: 'No valid tracking numbers in chunk' });
        }

        // For MAWB updates, validate MAWB number
        if (updateCode === 'UAN' && (!mawbNum || mawbNum.trim() === '')) {
            return res.status(400).json({ error: 'MAWB Number is required for this update' });
        }

        // Generate job ID and respond IMMEDIATELY
        const jobId = generateJobId();
        
        // Initial job status
        backgroundJobs.set(jobId, {
            status: 'queued',
            total: uniqueTrackingNumbers.length,
            processed: 0,
            successful: [],
            failed: [],
            updatedCount: 0,
            notUpdatedCount: 0,
            chunkIndex: chunkIndex || 0
        });

        // Send immediate response
        res.json({
            jobId: jobId,
            status: 'queued',
            message: `Chunk ${chunkIndex ? chunkIndex + 1 : 1} processing started`,
            totalJobs: uniqueTrackingNumbers.length,
            chunkSize: uniqueTrackingNumbers.length
        });

        // Start processing in background (after response is sent)
        setTimeout(() => {
            processChunkInBackground(jobId, {
                updateCode,
                mawbNum,
                trackingNumbers: uniqueTrackingNumbers,
                req
            });
        }, 100);

    } catch (error) {
        console.error('Chunk route error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Chunk processing failed', message: error.message });
        }
    }
});

// Optimized chunk processor
async function processChunkInBackground(jobId, jobData) {
    const { updateCode, mawbNum, trackingNumbers, req } = jobData;

    const results = {
        successful: [],
        failed: [],
        updatedCount: 0,
        notUpdatedCount: 0,
        status: 'processing',
        total: trackingNumbers.length,
        processed: 0,
        startTime: Date.now()
    };

    backgroundJobs.set(jobId, { ...results, status: 'processing' });

    try {
        // Process in smaller batches within chunk
        const BATCH_SIZE = 10;
        const totalBatches = Math.ceil(trackingNumbers.length / BATCH_SIZE);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const start = batchIndex * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, trackingNumbers.length);
            const batch = trackingNumbers.slice(start, end);

            // Process batch in parallel
            const batchPromises = batch.map(trackingNumber => 
                processSingleTrackingNumber(trackingNumber, updateCode, mawbNum, req)
            );

            const batchResults = await Promise.allSettled(batchPromises);
            
            // Update results
            batchResults.forEach((result, index) => {
                const trackingNumber = batch[index];
                results.processed++;

                if (result.status === 'fulfilled' && result.value.success) {
                    results.successful.push({
                        trackingNumber: trackingNumber,
                        result: result.value.message || `Successfully updated with ${updateCode}`
                    });
                    results.updatedCount++;
                } else {
                    const errorMsg = result.status === 'rejected' 
                        ? result.reason.message 
                        : (result.value?.error || 'Update failed');
                    
                    results.failed.push({
                        trackingNumber: trackingNumber,
                        result: 'Error: ' + errorMsg
                    });
                    results.notUpdatedCount++;
                }
            });

            // Update job progress
            backgroundJobs.set(jobId, { ...results, status: 'processing' });

            // Small delay between batches
            if (batchIndex < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        // Mark chunk as completed
        results.status = 'completed';
        results.processingTime = Date.now() - results.startTime;
        console.log(`Chunk ${jobId} completed in ${results.processingTime}ms`);
        backgroundJobs.set(jobId, results);

    } catch (error) {
        console.error('Chunk processing error:', error);
        results.status = 'failed';
        results.error = error.message;
        backgroundJobs.set(jobId, results);
    }
}

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});