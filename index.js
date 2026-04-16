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
const expressLayouts = require('express-ejs-layouts');
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
const sharp = require('sharp');
const csv = require('csv-parser');

// ==================================================
// 📧 Email Configuration & Functions
// ==================================================
const nodemailer = require('nodemailer');

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
const UnifiedPOD = mainConn.model('UnifiedPOD', require('./models/UnifiedPOD'));

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
    if (req.isAuthenticated() && (req.user.role === 'warehouse' || req.user.role === 'finance' || req.user.role === 'cs' || req.user.role === 'dispatcher' || req.user.role === 'manager' || req.user.role === 'admin')) {
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
        const thirtyDaysAgo = moment().subtract(60, 'days').format('YYYY-MM-DD');

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

// ==================================================
// 🔍 CHECK ACTIVE DELIVERIES STATUS - Automated job that runs every 10 minutes
// ==================================================
async function checkActiveDeliveriesStatus() {
    try {
        // Set Brunei time explicitly
        const bruneiNow = moment().utcOffset(8); // Brunei is UTC+8
        const bruneiTimeString = bruneiNow.format('YYYY-MM-DDTHH:mm:ss');
        const todayDateStr = bruneiNow.format('YYYY-MM-DD');

        // Find GDEX/GDEXT orders that are active in MongoDB
        const gdexActiveOrders = await ORDERS.find(
            {
                currentStatus: { $in: ["Out for Delivery", "Self Collect"] },
                product: { $in: ['gdex', 'gdext'] } // Only GDEX/GDEXT products
            },
            {
                doTrackingNumber: 1,
                currentStatus: 1,
                assignedTo: 1,
                product: 1
            }
        );

        console.log(`🔍 Checking ${gdexActiveOrders.length} active GDEX/GDEXT deliveries...`);

        for (let order of gdexActiveOrders) {
            const { doTrackingNumber: trackingNumber, currentStatus, assignedTo, product } = order;

            if (!trackingNumber) {
                console.log(`⚠️ Skipping: No tracking number`);
                continue;
            }

            try {
                // Step 1: Get FRESH data from Detrack
                const response = await axios.get(`https://app.detrack.com/api/v2/dn/jobs/show/`, {
                    params: { do_number: trackingNumber },
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': 'd4dfab3975765c8ffa920d9a0c6bda0c12d17a35a946d337'
                    }
                });

                const data = response.data;

                // Extract Detrack completion time
                let detrackCompletedTime = null;
                let completionDateStr = null;

                if (data.data.completed_time) {
                    // Convert Detrack time to Brunei time
                    detrackCompletedTime = moment(data.data.completed_time).utcOffset(8);
                    completionDateStr = detrackCompletedTime.format('YYYY-MM-DD');
                }

                // Check if job is completed in Detrack
                const isCompleted = data.data.status?.toLowerCase() === 'completed';

                if (!isCompleted) {
                    console.log(`⏭️ GDEX order ${trackingNumber} not completed in Detrack (status: ${data.data.status}), skipping.`);
                    continue;
                }

                console.log(`\n🚨🚨🚨 PROCESSING GDEX ORDER: ${trackingNumber}, Product: ${product}`);
                console.log(`   REQUIREMENT: Download FRESH 3 PODs, compress, convert to Base64, ALL must succeed`);

                // ========== UPDATED: Get completed timestamp from updated_at field ==========
                const completedTimestamp = data.data.updated_at;
                const formattedTimestamp = moment(completedTimestamp).utcOffset(8).format('YYYY-MM-DDTHH:mm:ss');

                // ========== UPDATED: Determine location based on assign_to ==========
                let latestLocation = '';
                if (data.data.assign_to === 'Selfcollect') {
                    latestLocation = 'Go Rush Kiulap Office';
                } else {
                    latestLocation = data.data.address || 'Customer Address';
                }

                console.log(`   📅 Using completed timestamp: ${formattedTimestamp}`);
                console.log(`   📍 Using location: ${latestLocation}`);

                // Verify completion happened today in Brunei time (optional - you can remove this if you want to process all)
                let shouldProcess = true;
                if (detrackCompletedTime) {
                    if (completionDateStr === todayDateStr) {
                        console.log(`   ✅ GDEX order completed TODAY: ${detrackCompletedTime.format('YYYY-MM-DDTHH:mm:ss')}`);
                    } else {
                        console.log(`   ⏭️ GDEX order completed on ${completionDateStr}, not today. Skipping.`);
                        shouldProcess = false;
                    }
                }

                if (!shouldProcess) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }

                // ========== CRITICAL: ALL-OR-NOTHING FRESH GDEX PROCESSING ==========
                // Validate ALL 3 photo URLs are present BEFORE processing
                const photo1 = data.data.photo_1_file_url;
                const photo2 = data.data.photo_2_file_url;
                const photo3 = data.data.photo_3_file_url;

                if (!photo1 || !photo2 || !photo3) {
                    console.error(`❌❌❌ CANNOT PROCESS GDEX ORDER ${trackingNumber}: Missing required POD URLs`);
                    console.error(`   Photo 1: ${photo1 ? 'PRESENT' : 'MISSING'}`);
                    console.error(`   Photo 2: ${photo2 ? 'PRESENT' : 'MISSING'}`);
                    console.error(`   Photo 3: ${photo3 ? 'PRESENT' : 'MISSING'}`);

                    // Log this failure for manual intervention
                    await ORDERS.findOneAndUpdate(
                        { doTrackingNumber: trackingNumber },
                        {
                            $set: {
                                podSource: 'gdrex_missing_pods',
                                latestReason: `Missing PODs: ${!photo1 ? '1,' : ''}${!photo2 ? '2,' : ''}${!photo3 ? '3' : ''}`.replace(/,$/, '')
                            }
                        },
                        { upsert: false }
                    );

                    continue; // Skip this order entirely
                }

                // Create detrackData with ALL FRESH photo URLs
                const detrackData = {
                    status: data.data.status,
                    reason: data.data.reason || '',
                    address: data.data.address,
                    assign_to: data.data.assign_to,
                    photo_1_file_url: photo1,
                    photo_2_file_url: photo2,
                    photo_3_file_url: photo3,
                    podAlreadyConverted: false,
                    completed_time: formattedTimestamp
                };

                let allPODsSuccess = false;
                let savedPODs = [];
                let gdexApiSuccess = false;

                try {
                    // Step 1: Download FRESH and save ALL 3 PODs to database (ALL-OR-NOTHING)
                    console.log(`\n   📥 DOWNLOADING FRESH ALL 3 PODs for ${trackingNumber}...`);
                    savedPODs = await saveAllPODsToDatabase(trackingNumber, detrackData, 3); // 3 retries max

                    if (savedPODs.length === 3) {
                        allPODsSuccess = true;
                        console.log(`   ✅ SUCCESS: All 3 PODs downloaded FRESH, compressed, and converted to Base64`);
                        console.log(`   POD 1: ${savedPODs[0].length} chars`);
                        console.log(`   POD 2: ${savedPODs[1].length} chars`);
                        console.log(`   POD 3: ${savedPODs[2].length} chars`);
                    } else {
                        throw new Error(`Expected 3 PODs, got ${savedPODs.length}`);
                    }

                } catch (podError) {
                    console.error(`   ❌❌❌ ALL-OR-NOTHING POD PROCESS FAILED: ${podError.message}`);
                    console.error(`   GDEX order ${trackingNumber} will NOT be processed due to POD failure`);
                    continue;
                }

                // Step 2: Send to GDEX API with FRESH Base64 PODs
                if (allPODsSuccess) {
                    console.log(`\n   🚀 Sending GDEX clear job update with FRESH 3 PODs: ${trackingNumber}`);
                    const gdexToken = await getGDEXToken();

                    if (gdexToken) {
                        // ========== UPDATED: Create GDEX tracking data with formatted timestamp and location ==========
                        const gdexTrackingData = {
                            consignmentno: trackingNumber,
                            statuscode: "FD",
                            statusdescription: "Delivered",
                            statusdatetime: formattedTimestamp,  // Using formatted timestamp from updated_at
                            reasoncode: "",
                            locationdescription: latestLocation,  // Based on assign_to
                            epod: savedPODs,
                            deliverypartner: "gorush",
                            returnflag: false
                        };

                        // Send to GDEX using your enhanced function
                        const result = await sendGDEXTrackingWebhookWithData(trackingNumber, gdexTrackingData, gdexToken);

                        if (result && result.success === true) {
                            gdexApiSuccess = true;
                            console.log(`   ✅ GDEX API call successful for ${trackingNumber}`);
                        } else {
                            console.error(`   ❌ GDEX API call failed for ${trackingNumber}`);
                            console.error(`   Error: ${result?.error || 'Unknown error'}`);
                            // DON'T UPDATE MongoDB if GDEX API fails
                            continue;
                        }
                    } else {
                        console.error(`   ❌ Failed to get GDEX token for ${trackingNumber}`);
                        continue;
                    }
                }

                // Step 3: Update MongoDB only if GDEX API succeeded
                if (allPODsSuccess && gdexApiSuccess) {
                    console.log(`\n   📝 Updating MongoDB status for GDEX order: ${trackingNumber}`);

                    // ========== UPDATED: MongoDB update with formatted timestamp and location ==========
                    const update = {
                        currentStatus: "Completed",
                        lastUpdateDateTime: formattedTimestamp,  // Using formatted timestamp
                        latestLocation: latestLocation,  // Based on assign_to
                        lastUpdatedBy: "System",
                        assignedTo: data.data.assign_to || assignedTo || '-',
                        detrackCompletedTime: formattedTimestamp,
                        $push: {
                            history: {
                                statusHistory: "Completed",
                                dateUpdated: formattedTimestamp,  // Using formatted timestamp
                                updatedBy: "System",
                                lastAssignedTo: data.data.assign_to || assignedTo || '-',
                                lastLocation: latestLocation,  // Based on assign_to
                                detrackCompletedTime: formattedTimestamp
                            }
                        }
                    };

                    await ORDERS.findOneAndUpdate(
                        { doTrackingNumber: trackingNumber },
                        update,
                        { upsert: false }
                    );
                    console.log(`   ✅ MongoDB updated for GDEX order ${trackingNumber}`);
                    console.log(`\n🎉🎉🎉 GDEX ORDER ${trackingNumber} FULLY PROCESSED WITH FRESH 3 PODs AND GDEX API SUCCESS`);
                } else {
                    console.log(`   ⏭️ MongoDB NOT updated for ${trackingNumber} - GDEX API failed or PODs missing`);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (apiError) {
                console.error(`❌ Error checking tracking ${trackingNumber}:`, apiError.response?.data || apiError.message);
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // ========== PROCESS NON-GDEX PRODUCTS SEPARATELY ==========
        const nonGdexActiveOrders = await ORDERS.find(
            {
                currentStatus: { $in: ["Out for Delivery", "Self Collect"] },
                product: { $nin: ['gdex', 'gdext'] } // Exclude GDEX/GDEXT
            },
            {
                doTrackingNumber: 1,
                currentStatus: 1,
                assignedTo: 1,
                product: 1
            }
        );

        console.log(`🔍 Checking ${nonGdexActiveOrders.length} active non-GDEX deliveries...`);

        for (let order of nonGdexActiveOrders) {
            const { doTrackingNumber: trackingNumber, currentStatus, assignedTo, product } = order;

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

                // Check if job is completed in Detrack
                const isCompleted = data.data.status?.toLowerCase() === 'completed';

                if (isCompleted) {
                    console.log(`\n✅ Processing non-GDEX completed order: ${trackingNumber}, Product: ${product}`);

                    // ========== UPDATED: Get completed timestamp for non-GDEX ==========
                    const completedTimestamp = data.data.updated_at;
                    const formattedTimestamp = moment(completedTimestamp).utcOffset(8).format('YYYY-MM-DDTHH:mm:ss');

                    // ========== UPDATED: Determine location for non-GDEX ==========
                    let latestLocation = '';
                    if (data.data.assign_to === 'Selfcollect') {
                        latestLocation = 'Go Rush Kiulap Office';
                    } else if (data.data.type === 'Collection') {
                        latestLocation = 'Warehouse';
                    } else {
                        latestLocation = 'Customer';
                    }

                    let update = {};

                    if (data.data.type === 'Collection') {
                        // Collection completed
                        update = {
                            currentStatus: "Completed",
                            lastUpdateDateTime: formattedTimestamp,  // Using formatted timestamp
                            latestLocation: latestLocation,
                            lastUpdatedBy: "System",
                            assignedTo: data.data.assign_to || assignedTo || '-',
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: formattedTimestamp,  // Using formatted timestamp
                            $push: {
                                history: {
                                    statusHistory: "Completed",
                                    dateUpdated: formattedTimestamp,  // Using formatted timestamp
                                    updatedBy: "System",
                                    lastAssignedTo: data.data.assign_to || assignedTo || '-',
                                    lastLocation: latestLocation,
                                }
                            }
                        };
                    } else {
                        // Delivery completed
                        update = {
                            currentStatus: "Completed",
                            lastUpdateDateTime: formattedTimestamp,  // Using formatted timestamp
                            latestLocation: latestLocation,
                            lastUpdatedBy: "System",
                            assignedTo: data.data.assign_to || assignedTo || '-',
                            $push: {
                                history: {
                                    statusHistory: "Completed",
                                    dateUpdated: formattedTimestamp,  // Using formatted timestamp
                                    updatedBy: "System",
                                    lastAssignedTo: data.data.assign_to || assignedTo || '-',
                                    lastLocation: latestLocation,
                                }
                            }
                        };
                    }

                    // Download single POD if available (for non-GDEX)
                    if (data.data.photo_1_file_url) {
                        console.log(`📸 Downloading POD for non-GDEX order ${trackingNumber}...`);
                        try {
                            const podBase64 = await downloadAndConvertToBase64(data.data.photo_1_file_url, trackingNumber);
                            if (podBase64) {
                                update.podBase64 = podBase64;
                                update.podUpdated = formattedTimestamp;  // Using formatted timestamp
                                update.podSource = 'detrack';
                                update.podCompressed = true;
                                console.log(`✅ POD saved for non-GDEX order`);
                            }
                        } catch (podError) {
                            console.log(`⚠️ Could not download POD: ${podError.message}`);
                        }
                    }

                    await ORDERS.findOneAndUpdate(
                        { doTrackingNumber: trackingNumber },
                        update,
                        { upsert: false }
                    );

                    console.log(`✅ Non-GDEX order ${trackingNumber} updated to Completed with timestamp: ${formattedTimestamp}`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    console.log(`⏭️ Non-GDEX order ${trackingNumber} still active (${data.data.status}), skipping.`);
                }

            } catch (apiError) {
                console.error(`❌ Error checking tracking ${trackingNumber}:`, apiError.response?.data || apiError.message);
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

    } catch (error) {
        console.error('Watcher encountered an error:', error);
    }
}

setInterval(checkActiveDeliveriesStatus, 600000);
setInterval(checkStaleInfoReceivedJobs, 86400000);
checkActiveDeliveriesStatus();
checkStaleInfoReceivedJobs();

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

app.get('/api/delivery-result-report', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: "Missing date" });

        const start = new Date(date + "T00:00:00+08:00");
        const end = new Date(date + "T23:59:59+08:00");

        // For Operation End of Day Report - only show these staff
        const operationStaff = [
            "Ghafar", "Sowdeq", "Leo", "Hairol",
            "Hamidin", "Wafi", "Edey", "Zura", "Selfcollect"
        ];

        // 1. Parallelize database queries
        const [orders, reportDoc] = await Promise.all([
            ORDERS.find({ jobDate: date }).lean(),
            REPORTS.findOne({
                reportName: `Operation Morning Report ${new Date(date).toLocaleDateString("en-GB").replace(/\//g, ".")}`
            }).lean()
        ]);

        // 2. Build dispatcher map with proper name handling
        const dispatcherMap = {};
        const fullNameMap = {};

        if (reportDoc?.assignedDispatchers) {
            reportDoc.assignedDispatchers.forEach(d => {
                const names = d.dispatcherName.split('/').map(n => n.trim());

                names.forEach(name => {
                    dispatcherMap[name] = {
                        vehicle: d.vehicle || "-",
                        area: d.area || "-",
                        fullName: d.dispatcherName
                    };
                    fullNameMap[name] = d.dispatcherName;
                });

                dispatcherMap[d.dispatcherName] = {
                    vehicle: d.vehicle || "-",
                    area: d.area || "-",
                    fullName: d.dispatcherName
                };
            });
        }

        const staffMap = {};
        const allProducts = new Set();

        // 3. Process orders
        for (const order of orders) {
            const product = order.product || "N/A";
            allProducts.add(product);

            const histories = (order.history || [])
                .filter(h => {
                    const d = new Date(h.dateUpdated);
                    return d >= start && d <= end;
                });

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

            for (const { current, final } of perDay.values()) {
                [current, final].forEach((h, index) => {
                    if (!h) return;

                    const staff = h.lastAssignedTo || "Unassigned";

                    // ========== FILTER: Only include operation staff ==========
                    // Check if staff name (or any part of compound name) is in operationStaff list
                    const staffNames = staff.split('/').map(n => n.trim());
                    const hasAllowedStaff = staffNames.some(name =>
                        operationStaff.includes(name)
                    );

                    // Skip if not an operation staff member
                    if (!hasAllowedStaff) return;

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

        const products = Array.from(allProducts).filter(p =>
            Object.values(staffMap).some(data =>
                Object.values(data.products[p] || {}).some(count => count > 0)
            )
        );

        const results = Object.entries(staffMap)
            .map(([staff, data]) => {
                const productCounts = {};
                products.forEach(p => {
                    productCounts[p] = data.products[p] || { current: 0, completed: 0, failed: 0 };
                });

                const { current, completed, failed } = data.totals;
                const total = current + completed + failed;
                const successRate = completed + failed > 0
                    ? Math.round((completed / (completed + failed)) * 100)
                    : 0;

                let vehicle = "-";
                let area = "-";
                let reportStaffName = staff;

                if (staff !== "Selfcollect") {
                    if (dispatcherMap[staff]) {
                        vehicle = dispatcherMap[staff].vehicle;
                        area = dispatcherMap[staff].area;
                        reportStaffName = dispatcherMap[staff].fullName || staff;
                    } else {
                        const dispatcherEntry = Object.entries(dispatcherMap).find(([name]) => {
                            if (name.includes('/') && name.includes(staff)) return true;
                            if (staff.includes('/') && staff.includes(name)) return true;
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
            })
            .filter(result => {
                if (result.staff === "Selfcollect") return true;
                const staffNames = result.staff.split('/').map(n => n.trim());
                return staffNames.some(name => operationStaff.includes(name));
            })
            .sort((a, b) => {
                if (a.staff === "Selfcollect") return 1;
                if (b.staff === "Selfcollect") return -1;
                return a.staff.localeCompare(b.staff);
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

        console.log('=== Starting Warehouse Report Generation ===');
        console.log('Requested date:', date);

        // Parse the selected date correctly (Brunei timezone)
        const selectedDate = new Date(date + "T00:00:00+08:00");
        const today = new Date(date + "T23:59:59+08:00");
        const maxDays = 30;

        console.log('Selected date object:', selectedDate);
        console.log('Today end of day:', today);

        // Step 1: Get ALL warehouse orders first (no date filtering yet)
        const allWarehouseOrders = await ORDERS.find({
            currentStatus: { $in: ["At Warehouse", "Return to Warehouse"] },
            warehouseEntryDateTime: { $exists: true, $ne: null }
        }).lean();

        console.log(`Total warehouse orders found: ${allWarehouseOrders.length}`);

        if (allWarehouseOrders.length === 0) {
            return res.send(`
                <div style="padding: 20px; border: 1px solid #ccc; margin: 20px; background: #f9f9f9;">
                    <h3>No Warehouse Data Found</h3>
                    <p><strong>Selected Date:</strong> ${date}</p>
                    <p><strong>Total orders with warehouse status:</strong> 0</p>
                    <p><strong>Reason:</strong> No orders have status "At Warehouse" or "Return to Warehouse" in the database.</p>
                </div>
            `);
        }

        // Debug: Show sample of warehouseEntryDateTime values
        console.log('Sample warehouseEntryDateTime values:');
        allWarehouseOrders.slice(0, 5).forEach(order => {
            console.log(`- Order ${order._id}: ${order.warehouseEntryDateTime} (type: ${typeof order.warehouseEntryDateTime})`);
        });

        // Step 2: Filter by valid date and calculate aging
        const validWarehouseOrders = [];

        for (const order of allWarehouseOrders) {
            let entryDate = null;

            // Handle different possible formats of warehouseEntryDateTime
            if (order.warehouseEntryDateTime) {
                if (order.warehouseEntryDateTime instanceof Date) {
                    entryDate = order.warehouseEntryDateTime;
                } else if (typeof order.warehouseEntryDateTime === 'string') {
                    // Try to parse string date
                    entryDate = new Date(order.warehouseEntryDateTime);
                    if (isNaN(entryDate.getTime())) {
                        console.log(`Invalid date string for order ${order._id}: ${order.warehouseEntryDateTime}`);
                        continue;
                    }
                } else if (typeof order.warehouseEntryDateTime === 'number') {
                    entryDate = new Date(order.warehouseEntryDateTime);
                } else {
                    console.log(`Unknown date type for order ${order._id}: ${typeof order.warehouseEntryDateTime}`);
                    continue;
                }
            }

            if (!entryDate || isNaN(entryDate.getTime())) {
                console.log(`No valid date for order ${order._id}`);
                continue;
            }

            // Calculate days difference
            const diffTime = today - entryDate;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            console.log(`Order ${order._id}: Entry date = ${entryDate}, Days ago = ${diffDays}`);

            // Include if within range (0 to maxDays)
            if (diffDays >= 0 && diffDays <= maxDays) {
                validWarehouseOrders.push(order);
                console.log(`  -> Included in report (${diffDays} days)`);
            } else {
                console.log(`  -> Excluded (${diffDays} days, outside 0-${maxDays} range)`);
            }
        }

        console.log(`Valid warehouse orders after date filtering: ${validWarehouseOrders.length}`);

        if (validWarehouseOrders.length === 0) {
            return res.send(`
                <div style="padding: 20px; border: 1px solid #ccc; margin: 20px; background: #f9f9f9;">
                    <h3>No Warehouse Data Found for Selected Date Range</h3>
                    <p><strong>Selected Date:</strong> ${date}</p>
                    <p><strong>Total warehouse orders:</strong> ${allWarehouseOrders.length}</p>
                    <p><strong>Orders after 30-day aging filter:</strong> ${validWarehouseOrders.length}</p>
                    <p><strong>Note:</strong> Orders older than 30 days are filtered out. Try selecting a more recent date.</p>
                    <h4>Sample of excluded orders (first 5):</h4>
                    <ul>
                        ${allWarehouseOrders.slice(0, 5).map(order => {
                let dateStr = order.warehouseEntryDateTime;
                if (dateStr instanceof Date) dateStr = dateStr.toISOString();
                return `<li>Product: ${order.product || 'N/A'}, AWB: ${order.mawbNo || '-'}, Date: ${dateStr}</li>`;
            }).join('')}
                    </ul>
                </div>
            `);
        }

        // Continue with the rest of the processing (same as before)
        const allAreas = ["JT", "G", "B", "TUTONG", "KB", "TEMBURONG", "N/A"];
        const awbProducts = ["mglobal", "ewe", "pdu", "gdex", "gdext"];

        // Get all AWBs for total jobs calculation
        const allAwbs = [...new Set(validWarehouseOrders
            .filter(order => awbProducts.includes((order.product || "").toLowerCase()))
            .map(order => order.mawbNo)
            .filter(mawb => mawb && mawb !== "-"))];

        console.log(`AWBs found for total jobs calculation: ${allAwbs.length}`);

        // Get total counts for each AWB (all statuses)
        let totalJobsMap = new Map();
        if (allAwbs.length > 0) {
            const totalJobsAgg = await ORDERS.aggregate([
                {
                    $match: {
                        $or: [
                            { mawbNo: { $in: allAwbs } },
                            { hawbNo: { $in: allAwbs } }
                        ]
                    }
                },
                {
                    $project: {
                        awbNos: {
                            $setUnion: [
                                [{ $ifNull: ["$mawbNo", ""] }],
                                [{ $ifNull: ["$hawbNo", ""] }]
                            ]
                        }
                    }
                },
                { $unwind: "$awbNos" },
                {
                    $match: {
                        awbNos: { $ne: "", $in: allAwbs }
                    }
                },
                {
                    $group: {
                        _id: "$awbNos",
                        count: { $sum: 1 }
                    }
                }
            ]);

            totalJobsMap = new Map(totalJobsAgg.map(item => [item._id, item.count]));
            console.log(`Total jobs map created for ${totalJobsMap.size} AWBs`);
        }

        // Get completed counts
        let completedCountsMap = new Map();
        if (allAwbs.length > 0) {
            const completedAgg = await ORDERS.aggregate([
                {
                    $match: {
                        currentStatus: "Completed",
                        $or: [
                            { mawbNo: { $in: allAwbs } },
                            { hawbNo: { $in: allAwbs } }
                        ]
                    }
                },
                {
                    $project: {
                        awbNos: {
                            $setUnion: [
                                [{ $ifNull: ["$mawbNo", ""] }],
                                [{ $ifNull: ["$hawbNo", ""] }]
                            ]
                        }
                    }
                },
                { $unwind: "$awbNos" },
                {
                    $match: {
                        awbNos: { $ne: "", $in: allAwbs }
                    }
                },
                {
                    $group: {
                        _id: "$awbNos",
                        count: { $sum: 1 }
                    }
                }
            ]);

            completedCountsMap = new Map(completedAgg.map(item => [item._id, item.count]));
        }

        // Get delivered counts for today
        const deliveredAgg = await ORDERS.aggregate([
            {
                $match: {
                    jobDate: date,
                    currentStatus: "Completed"
                }
            },
            {
                $group: {
                    _id: {
                        product: { $ifNull: ["$product", "N/A"] },
                        mawbNo: { $ifNull: ["$mawbNo", "-"] }
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        const deliveredMap = new Map();
        deliveredAgg.forEach(item => {
            const key = `${item._id.product}|${item._id.mawbNo}`;
            deliveredMap.set(key, item.count);
        });

        // Group warehouse orders by product and AWB
        const productMap = new Map();

        validWarehouseOrders.forEach(order => {
            const product = order.product || "N/A";
            const mawb = order.mawbNo || "-";
            const key = `${product}|${mawb}`;

            if (!productMap.has(key)) {
                let totalJobs = 0;
                if (awbProducts.includes(product.toLowerCase()) && mawb !== "-") {
                    totalJobs = totalJobsMap.get(mawb) || 0;
                }

                productMap.set(key, {
                    product,
                    mawb,
                    totalJobs: totalJobs,
                    warehouseCount: 0,
                    orders: [],
                    k1: 0,
                    k2: 0,
                    returned: 0,
                    areaCounts: Object.fromEntries(allAreas.map(a => [a, 0])),
                    dates: []
                });
            }

            const group = productMap.get(key);
            group.orders.push(order);
            group.warehouseCount++;

            if (!awbProducts.includes(product.toLowerCase())) {
                group.totalJobs = group.warehouseCount;
            }

            if (order.warehouseEntryDateTime) {
                let entryDate;
                if (order.warehouseEntryDateTime instanceof Date) {
                    entryDate = order.warehouseEntryDateTime;
                } else {
                    entryDate = new Date(order.warehouseEntryDateTime);
                }
                if (!isNaN(entryDate.getTime())) {
                    group.dates.push(entryDate);
                }
            }

            // Count locations
            if (order.latestLocation === "Warehouse K1") group.k1++;
            if (order.latestLocation === "Warehouse K2") group.k2++;
            if (order.currentStatus === "Return to Warehouse" && order.jobDate === date) group.returned++;

            // Count areas
            const area = order.area || "N/A";
            if (area === "KB") {
                group.areaCounts["KB"]++;
            } else if (allAreas.includes(area)) {
                group.areaCounts[area]++;
            } else if (area === "N/A") {
                group.areaCounts["N/A"]++;
            }
        });

        // Calculate aging and sort
        const productGroups = new Map();

        for (const [key, group] of productMap) {
            const validDates = group.dates.filter(d => !isNaN(d.getTime()));
            let maxAging = 0;
            let minAging = 0;
            let agingDisplay = "N/A";

            if (validDates.length > 0) {
                const minDate = new Date(Math.min(...validDates));
                const maxDate = new Date(Math.max(...validDates));
                minAging = Math.floor((today - maxDate) / (1000 * 60 * 60 * 24));
                maxAging = Math.floor((today - minDate) / (1000 * 60 * 60 * 24));
                agingDisplay = minAging === maxAging ? `${minAging}` : `${minAging}-${maxAging}`;
            }

            group.maxAging = maxAging;
            group.minAging = minAging;
            group.agingDisplay = agingDisplay;

            if (!productGroups.has(group.product)) {
                productGroups.set(group.product, []);
            }
            productGroups.get(group.product).push(group);
        }

        // Sort groups within each product by maxAging
        for (const [product, groups] of productGroups) {
            groups.sort((a, b) => b.maxAging - a.maxAging);
        }

        // Build HTML
        let html = `<table id="warehouseTable" class="table table-bordered" style="width:100%">
<thead>
<tr style="background-color: lightblue; font-weight: bold;">
<th colspan="${10 + allAreas.length + 1}" style="text-align:left;">4. Warehouse</th>
</tr>
<tr>
<th rowspan="2">Product</th>
<th rowspan="2">AWB</th>
<th rowspan="2">Aging (Days)</th>
<th rowspan="2">Total Jobs</th>
<th rowspan="2">Completed</th>
<th colspan="3">In Store</th>
<th colspan="${allAreas.length}">Area (In Store)</th>
<th colspan="2">Today's Job Result</th>
<th rowspan="2">Action</th>
</tr>
<tr>
<th>K1</th><th>K2</th><th>Total</th>
${allAreas.map(a => `<th>${a}</th>`).join('')}
<th>Delivered</th><th>Returned</th>
</tr>
</thead>
<tbody>`;

        const sortedProducts = Array.from(productGroups.keys()).sort((a, b) => {
            const aIsAwb = awbProducts.includes(a.toLowerCase());
            const bIsAwb = awbProducts.includes(b.toLowerCase());
            if (aIsAwb && !bIsAwb) return -1;
            if (!aIsAwb && bIsAwb) return 1;

            const aMaxAging = Math.max(...productGroups.get(a).map(g => g.maxAging));
            const bMaxAging = Math.max(...productGroups.get(b).map(g => g.maxAging));
            return bMaxAging - aMaxAging;
        });

        for (const product of sortedProducts) {
            const groups = productGroups.get(product);
            const totalRows = groups.length;
            let rowIndex = 0;

            for (const group of groups) {
                let completedJobs = "-";
                if (awbProducts.includes(product.toLowerCase()) && group.mawb !== "-") {
                    completedJobs = completedCountsMap.get(group.mawb) || 0;
                }

                const totalInStore = group.k1 + group.k2;
                const deliveredKey = `${product}|${group.mawb}`;
                const delivered = deliveredMap.get(deliveredKey) || 0;

                html += `<tr>`;

                if (rowIndex === 0) {
                    html += `<td rowspan="${totalRows}">${escapeHtml(product)}</td>`;
                }

                html += `
                    <td>${escapeHtml(group.mawb)}</td>
                    <td>${group.agingDisplay}</td>
                    <td>${group.totalJobs}</td>
                    <td>${completedJobs}</td>
                    <td>${group.k1}</td>
                    <td>${group.k2}</td>
                    <td>${totalInStore}</td>
                    ${allAreas.map(area => `<td>${group.areaCounts[area] || 0}</td>`).join('')}
                    <td>${delivered}</td>
                    <td>${group.returned}</td>
                    <td><button class="btn btn-sm btn-danger removeWarehouseRowBtn">🗑️</button></td>
                </tr>`;

                rowIndex++;
            }
        }

        html += `</tbody></table>`;

        console.log(`Report generated successfully with ${productMap.size} product/AWB groups`);
        res.setTimeout(60000);
        res.send(html);

    } catch (err) {
        console.error('Error in warehouseTableGenerate:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Add this helper function at the top of your file
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

app.post('/api/vehicle-report', async (req, res) => {
    try {
        const { date } = req.body;
        if (!date) return res.status(400).send('Missing date');

        const start = new Date(date + "T00:00:00+08:00");
        const end = new Date(date + "T23:59:59+08:00");

        // Define allowed staff/driver/dispatcher names
        const allowedStaff = [
            "Ghafar", "Sowdeq", "Leo", "Hairol",
            "Hamidin", "Wafi", "Edey", "Zura"
        ];

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

        // 3️⃣ Build rows - filter by allowed staff
        let rowsHTML = '';

        reports.forEach(r => {
            if (!r.assignedDispatchers || !Array.isArray(r.assignedDispatchers)) return;

            r.assignedDispatchers.forEach(d => {
                // Check if dispatcher name (or any part of compound name) is in allowed list
                const dispatcherNames = d.dispatcherName.split('/').map(n => n.trim());
                const hasAllowedDispatcher = dispatcherNames.some(name =>
                    allowedStaff.includes(name)
                );

                // Skip if no allowed dispatcher found
                if (!hasAllowedDispatcher) return;

                const vehicle = d.vehicle || '-';
                const dispatcher = d.dispatcherName || '-';
                const morningMileage = d.mileage || 0;
                const eodMileage = '';
                const mileageUsed = 0;

                rowsHTML += `
            <tr>
                <td contenteditable="true">${escapeHtml(vehicle)}</td>
                <td contenteditable="true">${escapeHtml(dispatcher)}</td>
                <td><input type="number" class="morningMileage" value="${morningMileage}" readonly></td>
                <td><input type="number" class="eodMileage"></td>
                <td><input type="number" class="mileageUsed" value="${mileageUsed}" readonly></td>
                <td contenteditable="true">No</td>
                <td contenteditable="true"></td>
                <td contenteditable="true" class="paidAmount"></td>
                <td contenteditable="true"></td>
                <td contenteditable="true"></td>
                <td contenteditable="true"></td>
                <td><button class="btn btn-sm btn-danger removeRowBtn">🗑️</button></td>
            </tr>
                `;
            });
        });

        // If no rows were added, show message
        if (!rowsHTML) {
            rowsHTML = '<tr><td colspan="12" class="text-center">No vehicle data found for allowed staff/drivers</td></tr>';
        }

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
              <th>Refilled Fuel Mileage</th>
              <th>Location</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
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

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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

app.get('/api/freelancer-delivery-result-report', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: "Missing date" });

        console.log(`Fetching freelancer report for date: ${date}`);

        // Excluded names (won't be shown in freelancer report)
        const excludedNames = [
            "Ghafar", "Sowdeq", "Leo", "Hairol",
            "Hamidin", "Wafi", "Edey", "Zura", "Selfcollect"
        ];

        // Fetch completed orders for the selected date directly
        const orders = await ORDERS.find({
            jobDate: date,
            currentStatus: "Completed"
        }).lean();

        console.log(`Found ${orders.length} completed orders for date ${date}`);

        // Log first few orders to see structure
        if (orders.length > 0) {
            console.log('Sample order:', {
                assignedTo: orders[0].assignedTo,
                product: orders[0].product,
                jobDate: orders[0].jobDate,
                currentStatus: orders[0].currentStatus
            });
        }

        // Fetch morning report for area mapping
        const reportDateFormatted = new Date(date).toLocaleDateString("en-GB").replace(/\//g, ".");
        const reportName = `Operation Morning Report ${reportDateFormatted}`;
        const reportDoc = await REPORTS.findOne({ reportName }).lean();

        // Build dispatcher map for area information
        const dispatcherMap = {};
        if (reportDoc?.assignedDispatchers) {
            reportDoc.assignedDispatchers.forEach(d => {
                const names = d.dispatcherName.split('/').map(n => n.trim());
                names.forEach(name => {
                    dispatcherMap[name] = {
                        area: d.area || "-",
                        fullName: d.dispatcherName
                    };
                });
                dispatcherMap[d.dispatcherName] = {
                    area: d.area || "-",
                    fullName: d.dispatcherName
                };
            });
        }

        console.log('Dispatcher map keys:', Object.keys(dispatcherMap));

        // Group orders by freelancer and product
        const freelancerMap = {};
        const allProducts = new Set();

        for (const order of orders) {
            const product = order.product || "N/A";
            allProducts.add(product);

            // Get the assigned freelancer
            let freelancer = order.assignedTo || "Unassigned";

            console.log(`Processing order - Freelancer: ${freelancer}, Product: ${product}`);

            // Check if this order should be excluded (operation staff)
            const isExcluded = excludedNames.some(excluded =>
                freelancer.includes(excluded)
            );

            // Skip excluded freelancers
            if (isExcluded) {
                console.log(`Skipping excluded freelancer: ${freelancer}`);
                continue;
            }

            // Skip if freelancer is "Unassigned" or empty
            if (freelancer === "Unassigned" || !freelancer || freelancer.trim() === "") {
                console.log(`Skipping unassigned order`);
                continue;
            }

            // Initialize freelancer in map
            if (!freelancerMap[freelancer]) {
                freelancerMap[freelancer] = {
                    products: {},
                    totalCompleted: 0
                };
            }

            // Initialize product count
            if (!freelancerMap[freelancer].products[product]) {
                freelancerMap[freelancer].products[product] = 0;
            }

            // Increment count
            freelancerMap[freelancer].products[product]++;
            freelancerMap[freelancer].totalCompleted++;

            console.log(`Added to ${freelancer} - ${product} count: ${freelancerMap[freelancer].products[product]}`);
        }

        console.log('Freelancer map after processing:', Object.keys(freelancerMap));

        // Get list of products that actually have data
        const products = Array.from(allProducts).filter(p =>
            Object.values(freelancerMap).some(data =>
                data.products[p] > 0
            )
        ).sort();

        console.log('Products with data:', products);

        // Build results array
        const results = Object.entries(freelancerMap)
            .map(([freelancer, data]) => {
                const productCounts = {};
                // Include ALL products that exist in the report, not just ones with data
                products.forEach(p => {
                    productCounts[p] = data.products[p] || 0;
                });

                // Get area from dispatcher map
                let area = "-";
                if (freelancer !== "Selfcollect" && dispatcherMap[freelancer]) {
                    area = dispatcherMap[freelancer].area;
                } else if (freelancer !== "Selfcollect") {
                    // Try to find if this freelancer exists in dispatcher map as part of compound name
                    const dispatcherEntry = Object.entries(dispatcherMap).find(([name]) =>
                        name.includes(freelancer) || freelancer.includes(name)
                    );
                    if (dispatcherEntry) {
                        area = dispatcherEntry[1].area;
                    }
                }

                return {
                    staff: freelancer,
                    area: area,
                    productCounts: productCounts,
                    totalCompleted: data.totalCompleted
                };
            })
            .filter(result => result.totalCompleted > 0) // Only show freelancers with completed jobs
            .sort((a, b) => a.staff.localeCompare(b.staff));

        console.log(`Returning ${results.length} freelancers with completed jobs`);

        res.json({ products, results });

    } catch (err) {
        console.error('Freelancer delivery result report error:', err);
        res.status(500).json({ error: "Server error: " + err.message });
    }
});

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

            // GDEX/GDEXT Handling Charge
            if (product.includes('gdex') || product.includes('gdext')) {
                if (weight >= 25.01 && weight <= 30.0) {
                    handlingCharge = '12.65';
                } else if (weight >= 20.01 && weight <= 25.0) {
                    handlingCharge = '12.00';
                } else if (weight >= 15.01 && weight <= 20.0) {
                    handlingCharge = '9.30';
                } else if (weight >= 10.01 && weight <= 15.0) {
                    handlingCharge = '7.30';
                } else if (weight >= 5.01 && weight <= 10.0) {
                    handlingCharge = '5.85';
                } else if (weight >= 4.01 && weight <= 5.0) {
                    handlingCharge = '4.55';
                } else if (weight >= 3.01 && weight <= 4.0) {
                    handlingCharge = '3.90';
                } else if (weight >= 2.01 && weight <= 3.0) {
                    handlingCharge = '3.25';
                } else if (weight >= 1.01 && weight <= 2.0) {
                    handlingCharge = '3.25';
                } else if (weight >= 0.01 && weight <= 1.0) {
                    handlingCharge = '2.65';
                } else if (weight > 30.0) {
                    // For weights above 30kg, use the clearance rate
                    handlingCharge = (0.95 * weight).toFixed(2);
                }
            }
            // Mglobal Products
            else if (product.includes('mglobal')) {
                handlingCharge = (Math.round((2.5 + 0.25 * Math.max(0, weight - 3)) * 1000) / 1000).toFixed(3);
            }
            // PDU Products
            else if (product.includes('pdu')) {
                handlingCharge = (Math.round((2.8 + 0.25 * Math.max(0, weight - 3)) * 1000) / 1000).toFixed(3);
            }
            // EWE/EWENS Products
            else if (product.includes('ewe') || product.includes('ewens')) {
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
                handlingCharge: handlingCharge,
                attempt: o.attempt || '',
                warehouseEntryDateTime: o.warehouseEntryDateTime || '',
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

// ==================================================
// 👥 User Management Routes
// ==================================================

// List all users (Admin only) - with role-based sorting
app.get('/listUser', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        // Define role priority order
        const rolePriority = {
            'admin': 1,
            'manager': 2,
            'finance': 3,
            'cs': 4,
            'warehouse': 5,
            'dispatcher': 6,
            'freelancer': 7,
            'moh': 8
        };

        // Get all users and sort by role priority
        const users = await USERS.find({}).sort({ date: -1 });

        // Sort users by role priority
        users.sort((a, b) => {
            const priorityA = rolePriority[a.role] || 999;
            const priorityB = rolePriority[b.role] || 999;
            return priorityA - priorityB;
        });

        // Only get flash message if it exists and is not empty
        let success_msg = req.flash('success_msg');
        let error_msg = req.flash('error_msg');

        // Check if success_msg is an array and get the first non-empty value
        if (success_msg && Array.isArray(success_msg)) {
            success_msg = success_msg.find(msg => msg && msg.trim() !== '') || null;
        } else if (success_msg === '') {
            success_msg = null;
        }

        // Check if error_msg is an array and get the first non-empty value
        if (error_msg && Array.isArray(error_msg)) {
            error_msg = error_msg.find(msg => msg && msg.trim() !== '') || null;
        } else if (error_msg === '') {
            error_msg = null;
        }

        res.render('listUser', {
            users: users,
            user: req.user,
            success_msg: success_msg,
            error_msg: error_msg
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading users');
        res.redirect('/');
    }
});

// GET route for update user - Handle both userId and MongoDB _id
app.get('/updateUser/:identifier', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const identifier = req.params.identifier;
        console.log('Editing user with identifier:', identifier);

        let userToEdit;

        // Check if identifier is MongoDB ObjectId format (24 hex chars)
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);

        if (isObjectId) {
            // Search by MongoDB _id
            userToEdit = await USERS.findById(identifier);
        } else {
            // Search by userId (GR000001 format)
            userToEdit = await USERS.findOne({ userId: identifier });
        }

        if (!userToEdit) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/listUser');
        }

        // Generate userId if it doesn't exist
        if (!userToEdit.userId) {
            const lastUser = await USERS.findOne({ userId: { $exists: true, $ne: null } }).sort({ userId: -1 });
            let lastNum = 0;
            if (lastUser && lastUser.userId) {
                const match = lastUser.userId.match(/GR(\d+)/);
                if (match) lastNum = parseInt(match[1]);
            }
            userToEdit.userId = `GR${String(lastNum + 1).padStart(6, '0')}`;
            await userToEdit.save();
            console.log(`Generated userId ${userToEdit.userId} for user ${userToEdit.name}`);
        }

        res.render('updateUser', {
            editUser: userToEdit,
            user: req.user,
            errors: req.flash('error')
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading user: ' + err.message);
        res.redirect('/listUser');
    }
});

// Update user POST route with user ID editing support
app.post('/updateUser/:identifier', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const identifier = req.params.identifier;
        const {
            role, fullName, name, email, password, icNum, jobPosition, status,
            profilePicture, qrcodeVerify, userId, removeProfilePicture, removeQrcode
        } = req.body;
        let errors = [];

        // Validation
        if (!name || !role || !jobPosition || !status) {
            errors.push({ msg: 'Please fill all required fields' });
        }

        if (role !== 'freelancer' && role !== 'dispatcher') {
            if (!email || email === '') {
                errors.push({ msg: 'Email is required for this role' });
            }
            if (password && password.length < 6) {
                errors.push({ msg: 'Password must be at least 6 characters' });
            }
        }

        if (errors.length > 0) {
            req.flash('error', errors);
            return res.redirect(`/updateUser/${identifier}`);
        }

        // Find existing user
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
        let existingUser;

        if (isObjectId) {
            existingUser = await USERS.findById(identifier);
        } else {
            existingUser = await USERS.findOne({ userId: identifier });
        }

        if (!existingUser) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/listUser');
        }

        // Check if userId is being changed and validate uniqueness
        let finalUserId = existingUser.userId;
        if (userId && userId !== existingUser.userId) {
            // Validate userId format (GRxxxxxx or FLxxxxxx)
            const userIdPattern = /^(GR|FL)\d{6}$/;
            if (!userIdPattern.test(userId)) {
                errors.push({ msg: 'User ID must be in format GRxxxxxx or FLxxxxxx (where x is a number)' });
                req.flash('error', errors);
                return res.redirect(`/updateUser/${identifier}`);
            }

            // Check if userId already exists
            const userIdExists = await USERS.findOne({
                userId: userId,
                _id: { $ne: existingUser._id }
            });

            if (userIdExists) {
                errors.push({ msg: 'User ID already exists. Please choose a different one.' });
                req.flash('error', errors);
                return res.redirect(`/updateUser/${identifier}`);
            }

            finalUserId = userId;
        }

        // Prepare update data
        let updateData = {
            role,
            fullName: fullName || '',
            name,
            icNum: icNum || '',
            jobPosition,
            status,
            userId: finalUserId
        };

        // Handle profile picture
        if (removeProfilePicture === '1') {
            updateData.profilePicture = '';
        } else if (profilePicture && profilePicture !== '') {
            updateData.profilePicture = profilePicture;
        }

        // Handle QR code
        if (removeQrcode === '1') {
            updateData.qrcodeVerify = '';
        } else if (qrcodeVerify && qrcodeVerify !== '') {
            updateData.qrcodeVerify = qrcodeVerify;
        }

        // Handle email based on role
        if (role !== 'freelancer' && role !== 'dispatcher') {
            // For regular roles, email is required
            if (email && email !== '') {
                // Check if email is taken by another user
                const emailExists = await USERS.findOne({
                    email: email,
                    _id: { $ne: existingUser._id }
                });
                if (emailExists) {
                    errors.push({ msg: 'Email already exists' });
                    req.flash('error', errors);
                    return res.redirect(`/updateUser/${identifier}`);
                }
                updateData.email = email;
            } else {
                errors.push({ msg: 'Email is required for this role' });
                req.flash('error', errors);
                return res.redirect(`/updateUser/${identifier}`);
            }
        } else {
            // For freelancer/dispatcher, remove email field if it exists
            updateData.$unset = { email: 1 };
        }

        // Update password if provided
        if (password && password.length >= 6) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        // Perform update
        if (isObjectId) {
            await USERS.findByIdAndUpdate(existingUser._id, updateData);
        } else {
            await USERS.findOneAndUpdate({ userId: identifier }, updateData);
        }

        req.flash('success_msg', 'User updated successfully');
        res.redirect('/listUser');

    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error updating user: ' + err.message);
        res.redirect(`/updateUser/${req.params.identifier}`);
    }
});

// Updated DELETE route to handle both formats
app.delete('/deleteUser/:identifier', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const identifier = req.params.identifier;
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);

        if (isObjectId) {
            await USERS.findByIdAndDelete(identifier);
        } else {
            await USERS.findOneAndDelete({ userId: identifier });
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error deleting user' });
    }
});

// Public digital ID view
app.get('/verify/:userId', async (req, res) => {
    try {
        const user = await USERS.findOne({ userId: req.params.userId });

        if (!user) {
            return res.status(404).send('User not found');
        }

        let statusType = 'unauthorized';
        let statusText = 'Not Affiliated with Go Rush';
        let statusIcon = 'fa-times-circle';
        let position = user.jobPosition || 'Staff';
        let positionHtml = null;
        let contactHtml = null;
        let needTimer = false;
        let assuranceText = '';

        // Check if user is active
        if (user.status === 'Active') {
            // Check for freelancer
            if (user.role === 'freelancer') {
                // Check if freelancer has job today
                const today = moment().tz('Asia/Brunei').format('YYYY-MM-DD');
                const hasJobToday = await ORDERS.findOne({
                    jobDate: today,
                    $or: [
                        { assignedTo: user.name },
                        { lastAssignedTo: user.name }
                    ]
                });

                if (hasJobToday) {
                    statusType = 'authorized';
                    statusText = 'Authorized Digital ID';
                    statusIcon = 'fa-check-circle';
                    positionHtml = `Freelancer for <span id="timer" class="timer">Loading...</span>`;
                    needTimer = true;
                    assuranceText = 'For assurance, please contact Go Rush Manager:';
                    contactHtml = `
                        <a href="tel:+6738334988" class="contact-link">
                            <i class="fas fa-phone"></i> Call
                        </a>
                        <a href="sms:+6738334988" class="contact-link">
                            <i class="fas fa-sms"></i> SMS
                        </a>
                        <a href="https://wa.me/6738334988" class="contact-link">
                            <i class="fab fa-whatsapp"></i> WhatsApp
                        </a>
                    `;
                } else {
                    statusType = 'expired';
                    statusText = 'Inactive Freelancer';
                    statusIcon = 'fa-clock';
                    position = 'Inactive Freelancer';
                    assuranceText = 'For assurance, please contact Go Rush Manager:';
                    contactHtml = `
                        <a href="tel:+6738334988" class="contact-link">
                            <i class="fas fa-phone"></i> Call
                        </a>
                        <a href="sms:+6738334988" class="contact-link">
                            <i class="fas fa-sms"></i> SMS
                        </a>
                        <a href="https://wa.me/6738334988" class="contact-link">
                            <i class="fab fa-whatsapp"></i> WhatsApp
                        </a>
                    `;
                }
            } else if (user.role === 'dispatcher') {
                statusType = 'authorized';
                statusText = 'Authorized Digital ID';
                statusIcon = 'fa-check-circle';
                assuranceText = 'For assurance, please contact Go Rush Manager:';
                contactHtml = `
                    <a href="tel:+6738334988" class="contact-link">
                        <i class="fas fa-phone"></i> Call
                    </a>
                    <a href="sms:+6738334988" class="contact-link">
                        <i class="fas fa-sms"></i> SMS
                    </a>
                    <a href="https://wa.me/6738334988" class="contact-link">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </a>
                `;
            } else {
                statusType = 'authorized';
                statusText = 'Authorized Digital ID';
                statusIcon = 'fa-check-circle';
                assuranceText = 'For assurance, please contact Go Rush HR:';
                contactHtml = `
                    <a href="tel:+6738740189" class="contact-link">
                        <i class="fas fa-phone"></i> Call
                    </a>
                    <a href="sms:+6738740189" class="contact-link">
                        <i class="fas fa-sms"></i> SMS
                    </a>
                    <a href="https://wa.me/6738740189" class="contact-link">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </a>
                `;
            }
        } else {
            // Inactive user
            if (user.role === 'freelancer' || user.role === 'dispatcher') {
                assuranceText = 'For assurance, please contact Go Rush Manager:';
                contactHtml = `
                    <a href="tel:+6738334988" class="contact-link">
                        <i class="fas fa-phone"></i> Call
                    </a>
                    <a href="sms:+6738334988" class="contact-link">
                        <i class="fas fa-sms"></i> SMS
                    </a>
                    <a href="https://wa.me/6738334988" class="contact-link">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </a>
                `;
            } else {
                assuranceText = 'For assurance, please contact Go Rush HR:';
                contactHtml = `
                    <a href="tel:+6738740189" class="contact-link">
                        <i class="fas fa-phone"></i> Call
                    </a>
                    <a href="sms:+6738740189" class="contact-link">
                        <i class="fas fa-sms"></i> SMS
                    </a>
                    <a href="https://wa.me/6738740189" class="contact-link">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </a>
                `;
            }
        }

        res.render('userview', {
            user: user,
            statusType: statusType,
            statusText: statusText,
            statusIcon: statusIcon,
            position: position,
            positionHtml: positionHtml,
            contactHtml: contactHtml,
            assuranceText: assuranceText,
            needTimer: needTimer
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading digital ID');
    }
});

// Update createUser POST route
app.post('/createUser', ensureAuthenticated, ensureAdmin, async (req, res) => {
    const { role, fullName, name, email, password, icNum, jobPosition, status, profilePicture } = req.body;
    let errors = [];

    console.log('Create User Request Body:', req.body);

    // Validation
    if (!name || !role || !jobPosition || !status) {
        errors.push({ msg: 'Please enter all required fields' });
    }

    if (role !== 'freelancer' && role !== 'dispatcher') {
        if (!email || email === '') {
            errors.push({ msg: 'Email is required for this role' });
        }
        if (!password || password.length < 6) {
            errors.push({ msg: 'Password must be at least 6 characters' });
        }
    }

    if (errors.length > 0) {
        return res.render('createUser', { errors, user: req.user });
    }

    try {
        // For freelancer/dispatcher, don't include email field at all
        let userData = {
            fullName: fullName || '',
            name: name,
            role: role,
            icNum: icNum || '',
            jobPosition: jobPosition,
            status: status,
            profilePicture: profilePicture || '',
            qrcodeVerify: ''
        };

        // Only add email for non-freelancer/dispatcher roles
        if (role !== 'freelancer' && role !== 'dispatcher') {
            userData.email = email;

            // Check if email exists
            let existingUser = await USERS.findOne({ email: email });
            if (existingUser) {
                errors.push({ msg: 'Email already exists' });
                return res.render('createUser', { errors, user: req.user });
            }

            // Add password for regular roles
            if (password && password.length >= 6) {
                const salt = await bcrypt.genSalt(10);
                userData.password = await bcrypt.hash(password, salt);
            }
        } else {
            // For freelancer/dispatcher, set a placeholder password
            const salt = await bcrypt.genSalt(10);
            userData.password = await bcrypt.hash('changeme123', salt);
        }

        const newUser = new USERS(userData);

        // Generate userId based on role (before saving)
        const prefix = (role === 'freelancer') ? 'FL' : 'GR';

        // Find the highest userId with the same prefix
        const lastUser = await USERS.findOne({
            userId: { $regex: `^${prefix}`, $exists: true, $ne: null, $ne: '' }
        }).sort({ userId: -1 });

        let lastNum = 0;
        if (lastUser && lastUser.userId) {
            const match = lastUser.userId.match(new RegExp(`${prefix}(\\d+)`));
            if (match) {
                lastNum = parseInt(match[1]);
            }
        }

        const newNumber = lastNum + 1;
        newUser.userId = `${prefix}${String(newNumber).padStart(6, '0')}`;

        // Save user
        await newUser.save();

        console.log('User created successfully:', newUser.userId);
        req.flash('success_msg', `User created successfully! User ID: ${newUser.userId}`);
        res.redirect('/listUser');

    } catch (err) {
        console.error('Detailed error creating user:', err);

        // Check for specific MongoDB errors
        if (err.code === 11000) {
            if (err.keyPattern && err.keyPattern.email) {
                errors.push({ msg: 'Email already exists' });
            } else if (err.keyPattern && err.keyPattern.userId) {
                errors.push({ msg: 'User ID conflict. Please try again.' });
            } else {
                errors.push({ msg: 'Duplicate entry error' });
            }
        } else if (err.name === 'ValidationError') {
            for (let field in err.errors) {
                errors.push({ msg: err.errors[field].message });
            }
        } else {
            errors.push({ msg: 'Server error creating user: ' + err.message });
        }

        res.render('createUser', { errors, user: req.user });
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

async function sendGDEXTrackingWebhook(consignmentID, statusCode, statusDescription, locationDescription, token, reasoncode = "", epod = "", returnflag = false) {
    try {
        // epod should be an array of Base64 strings
        let epodArray = [];

        if (Array.isArray(epod)) {
            epodArray = epod;
        } else if (typeof epod === 'string' && epod.length > 0) {
            // If it's a comma-separated string, convert to array
            epodArray = epod.split(',');
        }
        // else: empty array

        const trackingData = {
            consignmentno: consignmentID,
            statuscode: statusCode,
            statusdescription: statusDescription,
            statusdatetime: moment().utcOffset(8).format('YYYY-MM-DDTHH:mm:ss'),
            reasoncode: reasoncode,
            locationdescription: locationDescription,
            epod: epodArray, // ARRAY of Base64 strings
            deliverypartner: "gorush",
            returnflag: returnflag
        };

        console.log(`Sending GDEX webhook for ${consignmentID}: ${statusCode} - ${statusDescription}`);
        console.log(`POD format: ${epodArray.length > 0 ? 'Array with ' + epodArray.length + ' images' : 'Empty array'}`);
        console.log(`Return flag: ${returnflag ? 'TRUE (return goods)' : 'FALSE (normal delivery)'}`);

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
            console.error(`🔥 Request body sent:`, JSON.stringify(error.config?.data).substring(0, 500));
        }
        return false;
    }
}

// Enhanced helper function with full request/response logging
async function sendGDEXTrackingWebhookWithData(consignmentID, trackingData, token) {
    try {
        // ========== LOG FULL REQUEST ==========
        console.log(`\n📤 ===== COMPLETE REQUEST TO GDEX =====`);
        console.log(`URL: ${gdexConfig.trackingUrl}`);
        console.log(`Method: POST`);
        console.log(`Headers:`, JSON.stringify({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token.substring(0, 20)}...` // Truncate for security
        }, null, 2));
        console.log(`Body:`, JSON.stringify(trackingData, null, 2));
        console.log(`========================================\n`);

        console.log(`📡 Sending GDEX webhook for ${consignmentID}: ${trackingData.statuscode} - ${trackingData.statusdescription}`);

        const response = await axios.post(gdexConfig.trackingUrl, trackingData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            timeout: 15000  // Increase timeout to 15 seconds
        });

        // ========== LOG FULL RESPONSE ==========
        console.log(`\n📥 ===== COMPLETE RESPONSE FROM GDEX =====`);
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`Headers:`, JSON.stringify(response.headers, null, 2));
        console.log(`Body:`, JSON.stringify(response.data, null, 2));
        console.log(`==========================================\n`);

        if (response.data && response.data.success === true) {
            console.log(`✅ GDEX ${GDEX_ENV.toUpperCase()} webhook ${trackingData.statuscode} sent successfully`);
            return { success: true, error: null, response: response.data };
        } else {
            const errorMsg = response.data?.error || 'Unknown GDEX error';
            console.error(`❌ GDEX webhook failed:`, errorMsg);
            return {
                success: false,
                error: errorMsg,
                details: response.data,
                fullRequest: trackingData,
                fullResponse: {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    data: response.data
                }
            };
        }
    } catch (error) {
        // ========== LOG FULL ERROR DETAILS ==========
        console.error(`\n🔥 ===== COMPLETE ERROR DETAILS =====`);
        console.error(`Error message: ${error.message}`);

        if (error.response) {
            // The request was made and the server responded with a status code outside of 2xx
            console.error(`📌 RESPONSE STATUS: ${error.response.status} ${error.response.statusText}`);
            console.error(`📌 RESPONSE HEADERS:`, JSON.stringify(error.response.headers, null, 2));
            console.error(`📌 RESPONSE DATA:`, JSON.stringify(error.response.data, null, 2));

            // Try to extract any hidden error codes or messages
            let detailedError = `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`;

            // Check for common error formats
            if (error.response.data) {
                if (error.response.data.error) {
                    detailedError += ` | Error: ${error.response.data.error}`;
                }
                if (error.response.data.message) {
                    detailedError += ` | Message: ${error.response.data.message}`;
                }
                if (error.response.data.error_description) {
                    detailedError += ` | Description: ${error.response.data.error_description}`;
                }
                if (error.response.data.code) {
                    detailedError += ` | Code: ${error.response.data.code}`;
                }
                if (error.response.data.errors) {
                    detailedError += ` | Validation: ${JSON.stringify(error.response.data.errors)}`;
                }
            }

            console.error(`=====================================\n`);

            return {
                success: false,
                error: detailedError,
                statusCode: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers,
                data: error.response.data,
                fullRequest: trackingData,
                fullResponse: {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    headers: error.response.headers,
                    data: error.response.data
                }
            };

        } else if (error.request) {
            // The request was made but no response was received
            console.error(`📌 NO RESPONSE RECEIVED - Request that was sent:`);
            console.error(error.request);
            console.error(`=====================================\n`);
            return {
                success: false,
                error: 'No response from GDEX server (network error)',
                request: error.request,
                fullRequest: trackingData
            };
        } else {
            // Something happened in setting up the request
            console.error(`📌 REQUEST SETUP ERROR:`, error.message);
            console.error(`=====================================\n`);
            return {
                success: false,
                error: error.message,
                fullRequest: trackingData
            };
        }
    }
}

async function updateGDEXStatus(consignmentID, statusType, detrackData = null, statusCode = null, statusDescription = null, locationDescription = null, reasonCode = null, epod = null, returnflag = false) {
    console.log(`=== Updating GDEX status (${statusType}) for: ${consignmentID} ===`);

    // Get token
    const token = await getGDEXToken();
    if (!token) {
        console.error(`❌ Failed to get GDEX token for ${consignmentID}`);
        return false;
    }

    if (statusType === 'warehouse') {
        return await sendGDEXTrackingWebhook(
            consignmentID,
            "DT1",
            "Hub Inbound",
            "Go Rush Warehouse",
            token,
            "",
            "",
            returnflag
        );
    }
    else if (statusType === 'branch_received') {  // AL1 only - keep this
        return await sendGDEXTrackingWebhook(
            consignmentID,
            "AL1",
            "Received by Branch",
            "Go Rush Warehouse",
            token,
            "",
            "",
            returnflag
        );
    }
    // ========== COMMENT OUT OR REMOVE DT2 ==========
    // else if (statusType === 'hub_outbound') {
    //     return await sendGDEXTrackingWebhook(
    //         consignmentID,
    //         "DT2",
    //         "Hub Outbound",
    //         "Go Rush Warehouse",
    //         token,
    //         "",
    //         "",
    //         returnflag
    //     );
    // }
    // ========== END REMOVAL ==========
    else if (statusType === 'custom') {
        if (!statusCode || !statusDescription || !locationDescription) {
            console.error('Missing required parameters for custom GDEX update');
            return false;
        }
        return await sendGDEXTrackingWebhook(
            consignmentID,
            statusCode,
            statusDescription,
            locationDescription,
            token,
            reasonCode || "",
            epod || "",
            returnflag
        );
    } else if (statusType === 'out_for_delivery') {
        return await sendGDEXTrackingWebhook(
            consignmentID,
            "AL2",
            "Out for Delivery",
            "Go Rush Driver",
            token,
            "",
            "",
            returnflag
        );
    } else if (statusType === 'self_collect') {
        return await sendGDEXTrackingWebhook(
            consignmentID,
            "AL2",
            "Out for Delivery",
            "Go Rush Office",
            token,
            "",
            "",
            returnflag
        );
    } else if (statusType === 'cancelled') {
        return await sendGDEXTrackingWebhook(
            consignmentID,
            "BA",
            "Shipper/HQ Instruction to Cancel Delivery",
            "Go Rush Warehouse",
            token,
            "",
            "",
            returnflag
        );
    } else if (statusType === 'clear_job') {
        if (!detrackData) {
            console.error(`❌ No Detrack data provided for clear job: ${consignmentID}`);
            return false;
        }
        return await updateGDEXClearJob(consignmentID, detrackData, token, returnflag);
    } else {
        console.error(`❌ Unknown GDEX status type: ${statusType}`);
        return false;
    }
}

// ==================================================
// 📸 Base64 Image Functions
// ==================================================
// Replace the downloadAndConvertToBase64Immediate function with this more robust version:

// ==================================================
// 📸 Multi-POD Download Functions (GDEX) - ALL OR NOTHING
// ==================================================

async function downloadAndConvertToBase64Immediate(imageUrl, consignmentID, imageNumber, maxRetries = 3) {
    console.log(`   🚨 POD ${imageNumber} download for ${consignmentID}`);
    console.log(`   Original URL: ${imageUrl}`);

    // If URL is invalid or empty, throw immediately
    if (!imageUrl || !imageUrl.startsWith('http')) {
        throw new Error(`Invalid URL for POD ${imageNumber}: ${imageUrl}`);
    }

    for (let retry = 0; retry <= maxRetries; retry++) {
        console.log(`     📥 Attempt ${retry + 1}/${maxRetries + 1}`);

        try {
            // Try direct download first
            console.log(`       Downloading from: ${imageUrl.substring(0, 80)}...`);

            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'X-API-KEY': apiKey,
                    'Accept': 'image/*',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 15000 // Longer timeout
            });

            if (!response.data || response.data.length === 0) {
                throw new Error('Empty response data');
            }

            console.log(`       ✅ Downloaded: ${response.data.length} bytes`);

            const base64Image = await compressAndConvertToBase64(response.data);

            // CRITICAL: Validate it's actually Base64
            if (!base64Image || base64Image.length < 100) {
                throw new Error(`Base64 too short: ${base64Image?.length || 0} chars`);
            }

            if (base64Image.startsWith('http')) {
                throw new Error(`Base64 starts with http (wrong data)`);
            }

            console.log(`       ✅ Base64: ${base64Image.length} chars`);
            console.log(`       ✅ Preview: ${base64Image.substring(0, 30)}...`);
            return base64Image;

        } catch (downloadError) {
            console.error(`       ❌ Download attempt ${retry + 1} failed: ${downloadError.message}`);

            // Try to get fresh URL from Detrack API
            try {
                console.log(`       🔄 Getting fresh URL from Detrack API...`);
                const refreshResponse = await axios.get(
                    `https://app.detrack.com/api/v2/dn/jobs/show/?do_number=${consignmentID}`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-KEY': apiKey
                        },
                        timeout: 5000
                    }
                );

                // Get the correct photo URL based on image number
                let photoField = '';
                switch (imageNumber) {
                    case 1: photoField = 'photo_1_file_url'; break;
                    case 2: photoField = 'photo_2_file_url'; break;
                    case 3: photoField = 'photo_3_file_url'; break;
                }

                if (refreshResponse.data.data?.[photoField]) {
                    const freshUrl = refreshResponse.data.data[photoField];
                    console.log(`       🔄 Got fresh URL for retry: ${freshUrl.substring(0, 80)}...`);

                    // Update imageUrl for next retry attempt
                    imageUrl = freshUrl;
                }
            } catch (apiError) {
                console.log(`       ⚠️ Could not get fresh URL: ${apiError.message}`);
            }

            // If last retry, throw error
            if (retry === maxRetries) {
                throw new Error(`POD ${imageNumber}: Failed after ${maxRetries + 1} attempts. Last error: ${downloadError.message}`);
            }

            // Wait before next retry
            const delay = Math.min(3000 * Math.pow(2, retry), 30000);
            console.log(`       ⏳ Waiting ${delay}ms before next retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error(`POD ${imageNumber}: All attempts failed`);
}

async function downloadAndConvertToBase64Immediate(imageUrl, consignmentID, imageNumber, maxRetries = 3) {
    console.log(`   🚨 POD ${imageNumber} download for ${consignmentID}`);
    console.log(`   Original URL: ${imageUrl}`);

    // If URL is invalid or empty, throw immediately
    if (!imageUrl || !imageUrl.startsWith('http')) {
        throw new Error(`Invalid URL for POD ${imageNumber}: ${imageUrl}`);
    }

    for (let retry = 0; retry <= maxRetries; retry++) {
        console.log(`     📥 Attempt ${retry + 1}/${maxRetries + 1}`);

        try {
            // Try direct download first
            console.log(`       Downloading from: ${imageUrl.substring(0, 80)}...`);

            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'X-API-KEY': apiKey,
                    'Accept': 'image/*',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 15000 // Longer timeout
            });

            if (!response.data || response.data.length === 0) {
                throw new Error('Empty response data');
            }

            console.log(`       ✅ Downloaded: ${response.data.length} bytes`);

            const base64Image = await compressAndConvertToBase64(response.data);

            // CRITICAL: Validate it's actually Base64
            if (!base64Image || base64Image.length < 100) {
                throw new Error(`Base64 too short: ${base64Image?.length || 0} chars`);
            }

            if (base64Image.startsWith('http')) {
                throw new Error(`Base64 starts with http (wrong data)`);
            }

            console.log(`       ✅ Base64: ${base64Image.length} chars`);
            console.log(`       ✅ Preview: ${base64Image.substring(0, 30)}...`);
            return base64Image;

        } catch (downloadError) {
            console.error(`       ❌ Download attempt ${retry + 1} failed: ${downloadError.message}`);

            // Try to get fresh URL from Detrack API
            try {
                console.log(`       🔄 Getting fresh URL from Detrack API...`);
                const refreshResponse = await axios.get(
                    `https://app.detrack.com/api/v2/dn/jobs/show/?do_number=${consignmentID}`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-KEY': apiKey
                        },
                        timeout: 5000
                    }
                );

                // Get the correct photo URL based on image number
                let photoField = '';
                switch (imageNumber) {
                    case 1: photoField = 'photo_1_file_url'; break;
                    case 2: photoField = 'photo_2_file_url'; break;
                    case 3: photoField = 'photo_3_file_url'; break;
                }

                if (refreshResponse.data.data?.[photoField]) {
                    const freshUrl = refreshResponse.data.data[photoField];
                    console.log(`       🔄 Got fresh URL for retry: ${freshUrl.substring(0, 80)}...`);

                    // Update imageUrl for next retry attempt
                    imageUrl = freshUrl;
                }
            } catch (apiError) {
                console.log(`       ⚠️ Could not get fresh URL: ${apiError.message}`);
            }

            // If last retry, throw error
            if (retry === maxRetries) {
                throw new Error(`POD ${imageNumber}: Failed after ${maxRetries + 1} attempts. Last error: ${downloadError.message}`);
            }

            // Wait before next retry
            const delay = Math.min(3000 * Math.pow(2, retry), 30000);
            console.log(`       ⏳ Waiting ${delay}ms before next retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error(`POD ${imageNumber}: All attempts failed`);
}

async function downloadAllPODsForGDEX(consignmentID, detrackData, maxRetries = 3) {
    console.log(`📸 Starting ALL-OR-NOTHING multi-POD download for ${consignmentID}`);

    const requiredImages = 3;
    const podImages = [];

    const imagesToDownload = [
        { number: 1, url: detrackData.photo_1_file_url },
        { number: 2, url: detrackData.photo_2_file_url },
        { number: 3, url: detrackData.photo_3_file_url }
    ];

    // Validate URLs before starting
    for (const image of imagesToDownload) {
        if (!image.url || !image.url.startsWith('http')) {
            throw new Error(`Missing or invalid URL for POD ${image.number}`);
        }
    }

    console.log(`✅ All 3 POD URLs available, starting download...`);

    // Download sequentially with all-or-nothing
    for (const image of imagesToDownload) {
        try {
            console.log(`\n   ===== DOWNLOADING POD ${image.number} =====`);

            const base64Image = await downloadAndConvertToBase64Immediate(
                image.url,
                consignmentID,
                image.number,
                maxRetries
            );

            // EXTRA VALIDATION
            if (!base64Image || base64Image.length < 100 || base64Image.startsWith('http')) {
                throw new Error(`Invalid Base64 result for POD ${image.number}`);
            }

            podImages.push(base64Image);
            console.log(`   ✅ POD ${image.number}: SUCCESS (${base64Image.length} chars)`);

        } catch (error) {
            console.error(`   ❌ POD ${image.number}: CRITICAL FAILURE - ${error.message}`);

            // ABORT ALL downloads if one fails
            throw new Error(`ABORTING: POD ${image.number} failed. All-or-nothing requirement violated. Error: ${error.message}`);
        }
    }

    if (podImages.length !== requiredImages) {
        throw new Error(`Download incomplete. Expected ${requiredImages} PODs, got ${podImages.length}`);
    }

    console.log(`\n🎉 SUCCESS: All ${podImages.length}/${requiredImages} PODs downloaded successfully!`);
    return podImages;
}

async function saveAllPODsToDatabase(consignmentID, detrackData, maxRetries = 3) {
    try {
        console.log(`💾 Attempting to save ALL 3 PODs to database for ${consignmentID}`);
        console.log(`   ALL-OR-NOTHING: All 3 must succeed or transaction is rolled back`);

        let podImages = [];
        let finalSuccess = false;

        // Try the full process with retries
        for (let processRetry = 0; processRetry <= maxRetries; processRetry++) {
            console.log(`\n   === PROCESS ATTEMPT ${processRetry + 1}/${maxRetries + 1} ===`);

            try {
                // Step 1: Download ALL 3 PODs (all-or-nothing)
                podImages = await downloadAllPODsForGDEX(consignmentID, detrackData, 2); // 2 retries per image

                // Step 2: Prepare database update (all-or-nothing)
                const updateObj = {
                    podUpdated: new Date().toISOString(),
                    podSource: 'detrack_all_three',
                    podCompressed: true,
                    podBase64: podImages[0],
                    podBase64_2: podImages[1],
                    podBase64_3: podImages[2]
                };

                // Step 3: Save to database (with transaction-like behavior)
                console.log(`   💾 Saving ALL 3 PODs to database...`);

                let dbSuccess = false;
                for (let dbRetry = 0; dbRetry <= 2; dbRetry++) {
                    try {
                        const result = await ORDERS.findOneAndUpdate(
                            { doTrackingNumber: consignmentID },
                            { $set: updateObj },
                            { upsert: false, new: true }
                        );

                        if (result) {
                            // Verify the save worked by reading back
                            const savedOrder = await ORDERS.findOne({
                                doTrackingNumber: consignmentID
                            }).select('podBase64 podBase64_2 podBase64_3');

                            if (savedOrder &&
                                savedOrder.podBase64 &&
                                savedOrder.podBase64_2 &&
                                savedOrder.podBase64_3 &&
                                savedOrder.podBase64.length > 100 &&
                                savedOrder.podBase64_2.length > 100 &&
                                savedOrder.podBase64_3.length > 100) {

                                dbSuccess = true;
                                console.log(`   ✅ ALL 3 PODs saved to database for ${consignmentID}`);
                                console.log(`   POD 1 length: ${savedOrder.podBase64.length} chars`);
                                console.log(`   POD 2 length: ${savedOrder.podBase64_2.length} chars`);
                                console.log(`   POD 3 length: ${savedOrder.podBase64_3.length} chars`);
                                break;
                            } else {
                                console.log(`   ❌ Database save verification failed - PODs too short or missing`);
                                console.log(`   POD 1: ${savedOrder?.podBase64?.length || 0} chars`);
                                console.log(`   POD 2: ${savedOrder?.podBase64_2?.length || 0} chars`);
                                console.log(`   POD 3: ${savedOrder?.podBase64_3?.length || 0} chars`);
                                throw new Error('Database save verification failed');
                            }
                        }
                    } catch (dbError) {
                        console.log(`   ❌ Database save attempt ${dbRetry + 1}/3 failed: ${dbError.message}`);
                        if (dbRetry < 2) {
                            await new Promise(resolve => setTimeout(resolve, 1000 * (dbRetry + 1)));
                        }
                    }
                }

                if (!dbSuccess) {
                    throw new Error('Failed to save PODs to database after all retries');
                }

                finalSuccess = true;
                console.log(`\n🎉 COMPLETE SUCCESS: All 3 PODs processed and saved for ${consignmentID}`);
                break; // Exit process retry loop on success

            } catch (processError) {
                console.error(`   ❌ Process attempt ${processRetry + 1} failed: ${processError.message}`);

                // Clean up partial data if this was the last attempt
                if (processRetry === maxRetries) {
                    console.log(`   🧹 Cleaning up any partial data for ${consignmentID}`);
                    try {
                        await ORDERS.findOneAndUpdate(
                            { doTrackingNumber: consignmentID },
                            {
                                $set: {
                                    podUpdated: null,
                                    podSource: 'failed_all_or_nothing'
                                },
                                $unset: {
                                    podBase64: "",
                                    podBase64_2: "",
                                    podBase64_3: ""
                                }
                            },
                            { upsert: false }
                        );
                        console.log(`   ✅ Cleaned up partial POD data`);
                    } catch (cleanupError) {
                        console.log(`   ⚠️ Cleanup failed: ${cleanupError.message}`);
                    }

                    throw new Error(`ALL-OR-NOTHING FAILED: Could not complete POD processing after ${maxRetries + 1} attempts. ${processError.message}`);
                }

                // Wait before next process attempt
                const delay = Math.min(5000 * Math.pow(2, processRetry), 30000); // Max 30 seconds
                console.log(`   ⏳ Waiting ${delay}ms before next process attempt...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        if (finalSuccess) {
            return podImages;
        } else {
            throw new Error('Process failed without reaching success state');
        }

    } catch (error) {
        console.error(`❌ ALL-OR-NOTHING FAILED for ${consignmentID}:`, error.message);
        throw error; // Re-throw to indicate complete failure
    }
}

async function compressAndConvertToBase64(imageBuffer) {
    try {
        const originalSize = imageBuffer.length;
        console.log(`📊 Original: ${originalSize} bytes`);

        // Try compression with sharp
        try {
            const metadata = await sharp(imageBuffer).metadata();

            imageBuffer = await sharp(imageBuffer)
                .resize(800, 800, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({
                    quality: 60,
                    mozjpeg: true,
                    progressive: true
                })
                .toBuffer();

            console.log(`✅ Compressed: ${imageBuffer.length} bytes`);
        } catch (sharpError) {
            console.log(`⚠️ Compression skipped: ${sharpError.message}`);
        }

        const base64Image = imageBuffer.toString('base64');
        console.log(`✅ Base64: ${base64Image.length} chars`);

        return base64Image;

    } catch (error) {
        console.error(`Compression failed:`, error.message);
        // Return uncompressed as fallback
        return imageBuffer.toString('base64');
    }
}

async function downloadAndConvertToBase64(imageUrl, consignmentID = null) {
    try {
        console.log(`📥 Downloading POD image...`);

        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            headers: {
                'X-API-KEY': apiKey,
                'Accept': 'image/*'
            },
            timeout: 10000 // Shorter timeout
        });

        let imageBuffer = Buffer.from(response.data);
        const originalSize = imageBuffer.length;
        console.log(`📊 Original image size: ${originalSize} bytes (${(originalSize / 1024).toFixed(1)} KB)`);

        // Step 2: Try to compress using sharp
        try {
            // Step 3: Get image metadata
            const metadata = await sharp(imageBuffer).metadata();
            console.log(`📐 Image dimensions: ${metadata.width}px × ${metadata.height}px`);
            console.log(`🎨 Format: ${metadata.format?.toUpperCase() || 'Unknown'}`);

            // Step 4: Apply compression based on image type
            if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
                console.log(`⚙️ Compressing JPEG image...`);
                imageBuffer = await sharp(imageBuffer)
                    .resize(800, 800, { // Maximum dimensions
                        fit: 'inside',
                        withoutEnlargement: true // Don't enlarge small images
                    })
                    .jpeg({
                        quality: 60, // Balanced quality (60%)
                        mozjpeg: true, // Better compression algorithm
                        progressive: true, // Progressive loading
                        chromaSubsampling: '4:2:0' // Color compression
                    })
                    .toBuffer();

            } else if (metadata.format === 'png') {
                console.log(`⚙️ Converting PNG to JPEG for better compression...`);
                imageBuffer = await sharp(imageBuffer)
                    .resize(800, 800, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({
                        quality: 60,
                        mozjpeg: true,
                        progressive: true
                    })
                    .toBuffer();

            } else {
                // For other formats (gif, webp, etc.)
                console.log(`⚙️ Converting ${metadata.format?.toUpperCase()} to compressed JPEG...`);
                imageBuffer = await sharp(imageBuffer)
                    .resize(800, 800, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({
                        quality: 65, // Slightly better quality for unknown formats
                        mozjpeg: true,
                        progressive: true
                    })
                    .toBuffer();
            }

            // Step 5: Calculate compression results
            const compressedSize = imageBuffer.length;
            const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
            console.log(`✅ Compression complete:`);
            console.log(`   Before: ${originalSize} bytes (${(originalSize / 1024).toFixed(1)} KB)`);
            console.log(`   After:  ${compressedSize} bytes (${(compressedSize / 1024).toFixed(1)} KB)`);
            console.log(`   Reduction: ${compressionRatio}% smaller`);

        } catch (sharpError) {
            // Step 6: Fallback if sharp fails
            console.log(`⚠️ Sharp compression failed: ${sharpError.message}`);
            console.log(`⚠️ Using original image without compression`);
            // Continue with original image buffer
        }

        // Step 7: Convert to Base64
        const base64Image = imageBuffer.toString('base64');

        // Step 8: Log final results
        console.log(`📊 Final Base64 statistics:`);
        console.log(`   Characters: ${base64Image.length}`);
        console.log(`   Approx. size in JSON: ~${Math.round(base64Image.length * 1.1)} bytes`);
        console.log(`   Approx. size in KB: ~${(base64Image.length / 1024).toFixed(1)} KB`);

        // Step 9: Check if Base64 is too large
        if (base64Image.length > 100000) { // > 100K characters
            console.log(`⚠️ Warning: Base64 still large (${base64Image.length} chars)`);
            console.log(`⚠️ GDEX API might reject this size`);
        } else if (base64Image.length > 50000) { // > 50K characters
            console.log(`ℹ️ Base64 size: ${base64Image.length} chars - Should be acceptable`);
        } else {
            console.log(`✅ Base64 size: ${base64Image.length} chars - Good!`);
        }

        return base64Image;

    } catch (error) {
        if (error.response?.status === 404) {
            console.log(`⚠️ Image URL expired (404)`);

            // If we have consignmentID, try to get fresh data
            if (consignmentID) {
                console.log(`🔄 Attempting to get fresh image URL for ${consignmentID}`);

                try {
                    // Quick re-fetch
                    const freshResponse = await axios.get(
                        `https://app.detrack.com/api/v2/dn/jobs/show/?do_number=${consignmentID}`,
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-KEY': apiKey
                            },
                            timeout: 5000
                        }
                    );

                    if (freshResponse.data.data?.photo_1_file_url) {
                        console.log(`✅ Got fresh URL, downloading...`);
                        // Recursively call with fresh URL
                        return await downloadAndConvertToBase64(
                            freshResponse.data.data.photo_1_file_url,
                            null // Don't retry again
                        );
                    }
                } catch (refreshError) {
                    console.log(`❌ Could not get fresh URL:`, refreshError.message);
                }
            }
        }

        console.error(`❌ Failed to download image:`, error.message);
        return null;
    }
}

async function updateGDEXClearJob(consignmentID, detrackData, token, returnflag = false) {
    try {
        console.log(`=== Processing GDEX clear job for: ${consignmentID} ===`);
        console.log(`Detrack status: ${detrackData?.status}`);

        let statusCode, statusDescription, reasonCode, locationDescription, epodArray = [];

        // Check if job is completed or failed
        if (detrackData.status === 'completed') {
            statusCode = "FD";
            statusDescription = "Delivered";
            reasonCode = "";
            locationDescription = detrackData.address || "Customer Address";

            console.log(`📸 Processing PODs for GDEX completed job ${consignmentID}`);

            // Check if we already have Base64 PODs in detrackData (from SFJ or checkActiveDeliveriesStatus)
            if (detrackData.podAlreadyConverted === true &&
                detrackData.photo_1_file_url &&
                detrackData.photo_2_file_url &&
                detrackData.photo_3_file_url &&
                !detrackData.photo_1_file_url.startsWith('http') &&
                !detrackData.photo_2_file_url.startsWith('http') &&
                !detrackData.photo_3_file_url.startsWith('http')) {

                console.log(`✅ Using provided FRESH Base64 PODs (already downloaded and converted)`);
                epodArray = [
                    detrackData.photo_1_file_url,
                    detrackData.photo_2_file_url,
                    detrackData.photo_3_file_url
                ];

            } else {
                // If called from other contexts without Base64, get FRESH from Detrack
                console.log(`🔄 Getting FRESH POD URLs from Detrack API...`);

                try {
                    const freshResponse = await axios.get(
                        `https://app.detrack.com/api/v2/dn/jobs/show/?do_number=${consignmentID}`,
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-KEY': apiKey
                            },
                            timeout: 8000
                        }
                    );

                    const freshData = freshResponse.data.data;

                    if (freshData.photo_1_file_url && freshData.photo_2_file_url && freshData.photo_3_file_url) {
                        console.log(`✅ Got FRESH URLs from Detrack API`);

                        // Create fresh detrackData with URLs
                        const freshDetrackData = {
                            status: detrackData.status,
                            reason: detrackData.reason || '',
                            address: detrackData.address,
                            photo_1_file_url: freshData.photo_1_file_url,
                            photo_2_file_url: freshData.photo_2_file_url,
                            photo_3_file_url: freshData.photo_3_file_url,
                            podAlreadyConverted: false
                        };

                        // Download ALL PODs FRESH with retries
                        console.log(`📥 Downloading ALL 3 PODs from FRESH URLs with retries...`);
                        const savedPODs = await saveAllPODsToDatabase(consignmentID, freshDetrackData, 3);

                        if (savedPODs.length === 3) {
                            epodArray = savedPODs;
                            console.log(`✅ Fresh download successful! All 3 PODs converted to Base64`);
                        } else {
                            throw new Error(`Expected 3 PODs, got ${savedPODs.length}`);
                        }

                    } else {
                        console.error(`❌ Missing POD URLs in fresh Detrack data`);
                        return false;
                    }

                } catch (apiError) {
                    console.error(`❌ Failed to get fresh Detrack data: ${apiError.message}`);
                    return false;
                }
            }

            console.log(`📤 Sending FD (Delivered) with ${epodArray.filter(p => p && p.length > 0).length}/3 valid PODs`);

        } else if (detrackData.status === 'failed') {
            // ========== FAILED DELIVERIES WITH REASON CODE MAPPING ==========
            statusCode = "DF";
            statusDescription = "Delivery Failed";

            // Map Detrack reason to GDEX reason code
            const failReason = detrackData.reason || "";
            console.log(`📝 Mapping Detrack reason: "${failReason}" to GDEX reason code`);

            // Reason code mapping based on your requirements
            const reasonCodeMap = {
                "Unattempted Delivery": "BM",
                "Reschedule delivery requested by customer": "BK",
                "Reschedule to self collect requested by customer": "AG",
                "Cash/Duty Not Ready": "BM",
                "Customer not available / cannot be contacted": "AR",
                "No Such Person": "AW",
                "Customer declined delivery": "BM",
                "Unable to Locate Address": "BM",
                "Incorrect Address": "BM",
                "Access not allowed (OFFICE & GUARD HOUSE)": "AA",
                "Shipment Under Investigation": "AB",
                "Receiver Address Under Renovation": "AC",
                "Receiver Shifted": "AE",
                "Redirection Request by Shipper / Receiver": "AF",
                "Non-Service Area (NSA)": "AN",
                "Refusal to Accept – Damaged Shipment": "AS",
                "Refusal to Accept – Receiver Not Known at Address": "AW",
                "Refusal to Acknowledge POD / DO": "AX",
                "Receiver Not Present - Sorry Card Dropped": "AZ",
                "Natural Disaster / Pandemic": "BF",
                "Road Closure": "BG",
                "Refusal to Accept – Invalid / cancel Order": "BJ",
                "Consignee request for postponed delivery": "BL",
                "Shipper/HQ Instruction to Cancel Delivery": "BA"
            };

            // Get the mapped reason code or default to empty string
            reasonCode = reasonCodeMap[failReason] || detrackData.gdexFailReason || "";

            if (reasonCode) {
                console.log(`✅ Mapped to reason code: ${reasonCode}`);
            } else {
                console.log(`⚠️ No mapping found for reason: "${failReason}"`);
                // Fallback to the passed gdexFailReason if available
                reasonCode = detrackData.gdexFailReason || "";
                if (reasonCode) {
                    console.log(`Using fallback reason code: ${reasonCode}`);
                }
            }

            locationDescription = "Go Rush Warehouse";
            epodArray = []; // Empty array for failures

            console.log(`📤 Sending DF (Failed) for ${consignmentID} with reason code: ${reasonCode}`);
            // ========== END FAILED SECTION ==========

        } else {
            console.error(`Unknown Detrack status for clear job: ${detrackData.status}`);
            return false;
        }

        // Validate all PODs are Base64 and valid (only for completed jobs)
        if (detrackData.status === 'completed') {
            const invalidPODs = epodArray.filter(pod =>
                !pod || pod.length < 100 || pod.startsWith('http')
            );

            if (invalidPODs.length > 0) {
                console.error(`❌ Invalid PODs found: ${invalidPODs.length}`);
                // If any POD is invalid, don't send to GDEX
                return false;
            }
        }

        // Prepare tracking data
        const trackingData = {
            consignmentno: consignmentID,
            statuscode: statusCode,
            statusdescription: statusDescription,
            statusdatetime: moment().utcOffset(8).format('YYYY-MM-DDTHH:mm:ss'),
            reasoncode: reasonCode,
            locationdescription: locationDescription,
            epod: epodArray,
            deliverypartner: "gorush",
            returnflag: returnflag
        };

        console.log(`Sending GDEX webhook for ${consignmentID}: ${statusCode} - ${statusDescription}`);
        console.log(`Reason code: ${reasonCode}`);

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
        console.error(`🔥 Error in updateGDEXClearJob for ${consignmentID}:`, error.message);
        if (error.response) {
            console.error(`🔥 Response data:`, error.response.data);
        }
        return false;
    }
}

app.get('/api/pod/:trackingNumber/:imageIndex?', ensureAuthenticated, async (req, res) => {
    try {
        const order = await ORDERS.findOne({
            doTrackingNumber: req.params.trackingNumber.toUpperCase()
        });

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const imageIndex = req.params.imageIndex ? parseInt(req.params.imageIndex) : 1;
        let base64Image = null;

        // Select which image to return
        if (imageIndex === 1 && order.podBase64) {
            base64Image = order.podBase64;
        } else if (imageIndex === 2 && order.podBase64_2) {
            base64Image = order.podBase64_2;
        } else if (imageIndex === 3 && order.podBase64_3) {
            base64Image = order.podBase64_3;
        } else {
            return res.status(404).send(`POD image ${imageIndex} not found`);
        }

        // Convert Base64 back to image
        const imgBuffer = Buffer.from(base64Image, 'base64');

        // Set appropriate content type
        res.set('Content-Type', 'image/jpeg');
        res.set('Content-Length', imgBuffer.length);
        res.send(imgBuffer);

    } catch (error) {
        console.error('POD viewer error:', error);
        res.status(500).send('Server error');
    }
});

// Secure POD image viewer
app.get('/admin/pod/:trackingNumber', ensureAuthenticated, async (req, res) => {
    try {
        const order = await ORDERS.findOne({
            doTrackingNumber: req.params.trackingNumber.toUpperCase()
        });

        if (!order) {
            return res.status(404).send('Order not found');
        }

        if (!order.podImg1) {
            return res.status(404).send('POD image not available');
        }

        // Check user permissions
        if (!['cs', 'manager', 'admin', 'finance'].includes(req.user.role)) {
            return res.status(403).send('Access denied');
        }

        // Serve the Base64 image
        const matches = order.podImg1.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
            res.set('Content-Type', matches[1]);
            res.send(Buffer.from(matches[2], 'base64'));
        } else {
            // Fallback: redirect to Cloudinary URL if available
            if (order.podUrl) {
                res.redirect(order.podUrl);
            } else {
                res.status(404).send('POD format error');
            }
        }

    } catch (error) {
        console.error('POD viewer error:', error);
        res.status(500).send('Server error');
    }
});

// Periodic cleanup of expired Detrack URLs
setInterval(async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const orders = await ORDERS.find({
        product: { $in: ['gdex', 'gdext'] },
        currentStatus: 'Completed',
        podUrl: { $exists: false },
        podError: { $exists: false },
        lastUpdateDateTime: { $gte: oneHourAgo.toISOString() }
    }).limit(10);

    console.log(`[CLEANUP] Found ${orders.length} GDEX orders without POD backup`);

    for (const order of orders) {
        // Try to reprocess if we missed the initial upload
        console.log(`[CLEANUP] Retrying POD for ${order.doTrackingNumber}`);
    }
}, 3600000); // Run every hour

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

            // ===================================================================
            // 🚨 ALWAYS CREATE detrackData FOR ALL JOBS
            // ===================================================================
            let podBase64 = null;
            let detrackData = null;

            // Get product early for decision making
            product = data.data.group_name;

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

            if (req.body.statusCode == 'SFJA') {
                appliedStatus = "Attempt Fix Complete"
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

            if (req.body.statusCode == 'FSJ') {
                appliedStatus = "Fix Stuck Job"
            }

            else if (req.body.statusCode == 'FAR') {
                appliedStatus = "Update Fail due to Customer not available / cannot be contacted"
                failReasonDescription = "Customer not available / cannot be contacted"
                gdexFailReason = "AR";
            } else if (req.body.statusCode == 'FAB') {
                appliedStatus = "Update Fail due to Shipment Under Investigation"
                failReasonDescription = "Shipment Under Investigation"
                gdexFailReason = "AB";
            } else if (req.body.statusCode == 'FAF') {
                appliedStatus = "Update Fail due to Redirection Request by Shipper / Receiver"
                failReasonDescription = "Redirection Request by Shipper / Receiver"
                gdexFailReason = "AF";
            } else if (req.body.statusCode == 'FAG') {
                appliedStatus = "Update Fail due to Customer Request for Collection at GDEX Office (OC)"
                failReasonDescription = "Customer Request for Collection at GDEX Office (OC)"
                gdexFailReason = "AG";
            } else if (req.body.statusCode == 'FAN') {
                appliedStatus = "Update Fail due to Non-Service Area (NSA)"
                failReasonDescription = "Non-Service Area (NSA)"
                gdexFailReason = "AN";
            } else if (req.body.statusCode == 'FBA') {
                appliedStatus = "Update Fail due to Shipper/HQ Instruction to Cancel Delivery"
                failReasonDescription = "Shipper/HQ Instruction to Cancel Delivery"
                gdexFailReason = "BA";
            } else if (req.body.statusCode == 'RSAL2') {
                appliedStatus = "Return to Shipper"
            }

            if (req.body.statusCode == 'H3') {
                appliedStatus = "On Hold - Oversized Shipment"
                holdReasonDescription = "Oversized Shipment"
                gdexHoldReason = "H3";
            }

            if (req.body.statusCode == 'H10') {
                appliedStatus = "On Hold - Consignee Office Closed"
                holdReasonDescription = "Consignee Office Closed"
                gdexHoldReason = "H10";
            }

            if (req.body.statusCode == 'H17') {
                appliedStatus = "On Hold - Damage Shipment"
                holdReasonDescription = "Damage Shipment"
                gdexHoldReason = "H17";
            }

            if (req.body.statusCode == 'H32') {
                appliedStatus = "On Hold - AWB not clear"
                holdReasonDescription = "AWB not clear"
                gdexHoldReason = "H32";
            }

            if ((req.body.statusCode == 'IR') || (req.body.statusCode == 'CP') || (req.body.statusCode == 'DC') || (req.body.statusCode == 38) || (req.body.statusCode == 35) || (req.body.statusCode == 'SD')
                || (req.body.statusCode == 'NC') || (req.body.statusCode == 'CSSC') || (req.body.statusCode == 'AJ') || (req.body.statusCode == 47)
                || (req.body.statusCode == 'SFJ') || (req.body.statusCode == 'FA') || (req.body.statusCode == 'AJN') || (req.body.statusCode == 'UW') || (req.body.statusCode == 'UP')
                || (req.body.statusCode == 'UD') || (req.body.statusCode == 'UAR') || (req.body.statusCode == 'UAS') || (req.body.statusCode == 'UPN')
                || (req.body.statusCode == 'URN') || (req.body.statusCode == 'UPC') || (req.body.statusCode == 'UAB') || (req.body.statusCode == 'UJM')
                || (req.body.statusCode == 'UWL') || (req.body.statusCode == 'UFM') || (req.body.statusCode == 'UGR')
                || (req.body.statusCode == 'FCC') || (req.body.statusCode == 'FSC') || (req.body.statusCode == 'FIA')
                || (req.body.statusCode == 'FH10') || (req.body.statusCode == 'FBA') || (req.body.statusCode == 'FH3')
                || (req.body.statusCode == 'FAB') || (req.body.statusCode == 'FAF') || (req.body.statusCode == 'FAG') || (req.body.statusCode == 'FAN')
                || (req.body.statusCode == 'RSAL2') || (req.body.statusCode == 'H3') || (req.body.statusCode == 'H10')
                || (req.body.statusCode == 'H17') || (req.body.statusCode == 'H32') || (req.body.statusCode == 'SFJA')
                || (req.body.statusCode == 'FAR') || (req.body.statusCode == 'FSJ')) {

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

            // ==================================================
            // 🚨 FIX JOB HANDLER - Reprocess ALL GDEX milestones to GDEX API
            // (Skips completed status - send separately via SFJ)
            // ==================================================
            if (req.body.statusCode == 'FA') {
                // MongoDB Updatedata.data.assign_to
                update = {
                    paymentMethod: data.data.payment_mode,
                    totalPrice: data.data.total_price,
                    paymentAmount: data.data.payment_amount,
                };

                // GDEX API Update (will be handled by GDEXAPIrun = 7)
                portalUpdate = `Fix wrong updated jobs `;

                mongoDBrun = 2;
                completeRun = 1;
                /* console.log(`\n🔄 === FIX JOB: Reprocessing ALL milestones for ${consignmentID} ===`);
                console.log(`Product: ${product}, Current Detrack Status: ${data.data.status}`);

                // Only process GDEX/GDEXT products
                if (product !== 'GDEX' && product !== 'GDEXT') {
                    console.log(`❌ Product ${product} is not GDEX/GDEXT - skipping`);
                    processingResults.push({
                        consignmentID,
                        status: `Error: Fix Job only available for GDEX/GDEXT products. This is ${product}`,
                    });
                    continue;
                }

                try {
                    // Get GDEX token
                    const token = await getGDEXToken();
                    if (!token) {
                        console.error(`❌ Failed to get GDEX token for ${consignmentID}`);
                        processingResults.push({
                            consignmentID,
                            status: `Error: Failed to get GDEX token`,
                        });
                        continue;
                    }

                    // Get all milestones from Detrack
                    const milestones = data.data.milestones || [];
                    console.log(`📊 Found ${milestones.length} total milestones in Detrack`);

                    // Track which statuses we've already sent
                    const sentStatuses = new Set();
                    let firstCompletedFound = false;
                    let lastStatus = '';
                    let gdexUpdatesSent = 0;

                    // Sort milestones by created_at (ascending)
                    const sortedMilestones = [...milestones].sort((a, b) =>
                        new Date(a.created_at) - new Date(b.created_at)
                    );

                    // Process each milestone in chronological order
                    for (const milestone of sortedMilestones) {
                        const status = milestone.status;
                        const created_at = milestone.created_at;

                        // Skip if we've already found the first completed status
                        if (firstCompletedFound) {
                            console.log(`⏭️ Stopping: Already found first completed at ${firstCompletedFound}`);
                            break;
                        }

                        // Skip if not a status we care about
                        const validStatuses = ['on_hold', 'in_sorting_area', 'at_warehouse', 'out_for_delivery', 'failed', 'completed'];
                        if (!validStatuses.includes(status)) {
                            console.log(`⏭️ Skipping milestone: ${status} (not in GDEX flow)`);
                            continue;
                        }

                        // Skip duplicate statuses (GDEX doesn't want multiple AL2s after failures)
                        if (status === lastStatus && status !== 'failed') {
                            console.log(`⏭️ Skipping duplicate ${status} - already sent`);
                            continue;
                        }

                        console.log(`\n📌 Processing milestone: ${status} at ${created_at}`);

                        let trackingData = null;

                        // ===== ON HOLD =====
                        if (status === 'on_hold') {
                            trackingData = {
                                consignmentno: consignmentID,
                                statuscode: "K",
                                statusdescription: "Hold",
                                statusdatetime: moment(created_at).utcOffset(8).format('YYYY-MM-DDTHH:mm:ss'),
                                reasoncode: "H27", // Brunei Customs
                                locationdescription: "Brunei Customs",
                                epod: [],
                                deliverypartner: "gorush",
                                returnflag: false
                            };
                            console.log(`📤 Sending ON HOLD (K) with reason H27`);
                        }

                        // ===== IN SORTING AREA =====
                        else if (status === 'in_sorting_area') {
                            console.log(`⏭️ Skipping IN SORTING AREA milestone - DT1/DT2 no longer sent to GDEX`);
                            lastStatus = status;
                            continue; // Skip this milestone completely
                        }

                        // ===== AT WAREHOUSE (FIRST ONLY) =====
                        else if (status === 'at_warehouse') {
                            // Check if this is the first at_warehouse
                            const isFirstAtWarehouse = milestones.findIndex(m => m.status === 'at_warehouse') ===
                                milestones.findIndex(m => m.created_at === created_at);

                            if (!isFirstAtWarehouse) {
                                console.log(`⏭️ Skipping subsequent at_warehouse - only first is sent to GDEX`);
                                lastStatus = status;
                                continue;
                            }

                            trackingData = {
                                consignmentno: consignmentID,
                                statuscode: "AL1",
                                statusdescription: "Received by Branch",
                                statusdatetime: moment(created_at).utcOffset(8).format('YYYY-MM-DDTHH:mm:ss'),
                                reasoncode: "",
                                locationdescription: "Go Rush Warehouse",
                                epod: [],
                                deliverypartner: "gorush",
                                returnflag: false
                            };
                            console.log(`📤 Sending AT WAREHOUSE - AL1 (Received by Branch)`);
                        }

                        // ===== OUT FOR DELIVERY =====
                        else if (status === 'out_for_delivery') {
                            trackingData = {
                                consignmentno: consignmentID,
                                statuscode: "AL2",
                                statusdescription: "Out for Delivery",
                                statusdatetime: moment(created_at).utcOffset(8).format('YYYY-MM-DDTHH:mm:ss'),
                                reasoncode: "",
                                locationdescription: "Go Rush Driver",
                                epod: [],
                                deliverypartner: "gorush",
                                returnflag: false
                            };
                            console.log(`📤 Sending OUT FOR DELIVERY - AL2`);
                        }

                        // ===== FAILED =====
                        else if (status === 'failed') {
                            const failReason = milestone.reason || "";

                            // Map reason to GDEX code
                            const reasonCodeMap = {
                                "Unattempted Delivery": "BM",
                                "Reschedule delivery requested by customer": "BK",
                                "Reschedule to self collect requested by customer": "AG",
                                "Cash/Duty Not Ready": "BM",
                                "Customer not available / cannot be contacted": "AR",
                                "No Such Person": "AW",
                                "Customer declined delivery": "BM",
                                "Unable to Locate Address": "BM",
                                "Incorrect Address": "BM",
                                "Access not allowed (OFFICE & GUARD HOUSE)": "AA",
                                "Shipment Under Investigation": "AB",
                                "Receiver Address Under Renovation": "AC",
                                "Receiver Shifted": "AE",
                                "Redirection Request by Shipper / Receiver": "AF",
                                "Non-Service Area (NSA)": "AN",
                                "Refusal to Accept – Damaged Shipment": "AS",
                                "Refusal to Accept – Receiver Not Known at Address": "AW",
                                "Refusal to Acknowledge POD / DO": "AX",
                                "Receiver Not Present - Sorry Card Dropped": "AZ",
                                "Natural Disaster / Pandemic": "BF",
                                "Road Closure": "BG",
                                "Refusal to Accept – Invalid / cancel Order": "BJ",
                                "Consignee request for postponed delivery": "BL",
                                "Shipper/HQ Instruction to Cancel Delivery": "BA"
                            };

                            const reasonCode = reasonCodeMap[failReason] || "";
                            console.log(`📝 Fail reason: "${failReason}" → Code: ${reasonCode || 'UNMAPPED'}`);

                            trackingData = {
                                consignmentno: consignmentID,
                                statuscode: "DF",
                                statusdescription: "Delivery Failed",
                                statusdatetime: moment(created_at).utcOffset(8).format('YYYY-MM-DDTHH:mm:ss'),
                                reasoncode: reasonCode,
                                locationdescription: "Go Rush Warehouse",
                                epod: [],
                                deliverypartner: "gorush",
                                returnflag: false
                            };
                        }

                        // ===== COMPLETED =====
                        else if (status === 'completed') {
                            console.log(`🎯 FOUND COMPLETED milestone at ${created_at}`);
                            console.log(`⏭️ Stopping: First completed found - will NOT send to GDEX (send separately via SFJ)`);

                            // Set flag to stop processing further milestones
                            firstCompletedFound = created_at;

                            // DO NOT send any tracking data to GDEX for completed
                            // Just break out of the loop
                            break; // Exit the loop immediately
                        }

                        // Send the tracking data if we created it (for non-completed statuses)
                        if (trackingData) {
                            const result = await sendGDEXTrackingWebhookWithData(consignmentID, trackingData, token);
                            if (result.success) {
                                gdexUpdatesSent++;
                                console.log(`✅ Successfully sent ${status} to GDEX`);
                            } else {
                                console.error(`❌ Failed to send ${status} to GDEX:`, result.error);

                                // Add detailed error to processing results
                                const errorMsg = `❌ Failed to send ${status}: ${result.error}`;
                                processingResults.push({
                                    consignmentID,
                                    status: errorMsg,
                                });

                                // Break if it's a critical error (optional)
                                if (result.statusCode === 401 || result.statusCode === 403) {
                                    console.error(`🔴 Authentication error - stopping further updates for this tracking`);
                                    break;
                                }
                            }

                            // Small delay between updates
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }

                        lastStatus = status;
                    }

                    // Summary
                    console.log(`\n🎉 === FIX JOB COMPLETE for ${consignmentID} ===`);
                    console.log(`✅ Sent ${gdexUpdatesSent} GDEX updates (excluding completed)`);
                    console.log(`🛑 Stopped at first completed: ${firstCompletedFound || 'No completed found'}`);

                    let statusMessage = `✅ Fix Job: Reprocessed ${gdexUpdatesSent} GDEX updates.`;
                    if (firstCompletedFound) {
                        statusMessage += ` Found completed at ${moment(firstCompletedFound).format('YYYY-MM-DD HH:mm:ss')} (send separately via SFJ)`;
                    } else {
                        statusMessage += ` No completed milestone found.`;
                    }

                    processingResults.push({
                        consignmentID,
                        status: statusMessage,
                    });

                } catch (error) {
                    console.error(`🔥 Fix Job error for ${consignmentID}:`, error.message);
                    processingResults.push({
                        consignmentID,
                        status: `Error: Fix Job failed - ${error.message}`,
                    });
                }

                continue; // Skip rest of the update delivery logic for this tracking number */
            }

            // ==================================================
            // 🚨 COMPLETE JOB HANDLER - Send FD status with PODs for completed GDEX/GDEXT
            // ==================================================
            if (req.body.statusCode == 'SFJA') {
                console.log(`\n🎯 === COMPLETE JOB: Processing completed GDEX delivery for ${consignmentID} ===`);
                console.log(`Product: ${product}, Detrack Status: ${data.data.status}`);

                // Only process GDEX/GDEXT products
                if (product !== 'GDEX' && product !== 'GDEXT') {
                    console.log(`❌ Product ${product} is not GDEX/GDEXT - skipping`);
                    processingResults.push({
                        consignmentID,
                        status: `Error: Complete Job only available for GDEX/GDEXT products. This is ${product}`,
                    });
                    continue;
                }

                // Check if job is completed in Detrack
                if (data.data.status !== 'completed') {
                    console.log(`❌ Job is not completed. Current status: ${data.data.status}`);
                    processingResults.push({
                        consignmentID,
                        status: `Error: Job must be 'completed' in Detrack. Current status: ${data.data.status}`,
                    });
                    continue;
                }

                try {
                    // Get GDEX token
                    const token = await getGDEXToken();
                    if (!token) {
                        console.error(`❌ Failed to get GDEX token for ${consignmentID}`);
                        processingResults.push({
                            consignmentID,
                            status: `Error: Failed to get GDEX token`,
                        });
                        continue;
                    }

                    // Get completion timestamp from updated_at field (not milestones)
                    const completedTimestamp = data.data.updated_at;
                    console.log(`📅 Using completed timestamp: ${completedTimestamp}`);

                    // Check if all 3 POD URLs exist
                    const photo1 = data.data.photo_1_file_url;
                    const photo2 = data.data.photo_2_file_url;
                    const photo3 = data.data.photo_3_file_url;

                    if (!photo1 || !photo2 || !photo3) {
                        console.error(`❌ Missing POD URLs:`);
                        console.error(`   Photo 1: ${photo1 ? 'PRESENT' : 'MISSING'}`);
                        console.error(`   Photo 2: ${photo2 ? 'PRESENT' : 'MISSING'}`);
                        console.error(`   Photo 3: ${photo3 ? 'PRESENT' : 'MISSING'}`);

                        processingResults.push({
                            consignmentID,
                            status: `Error: Missing POD images. Required: 3, Found: ${[photo1, photo2, photo3].filter(Boolean).length}`,
                        });
                        continue;
                    }

                    console.log(`✅ All 3 POD URLs found, downloading and converting with retries...`);

                    // Download and convert all 3 PODs with retries
                    let epodArray = [];
                    let podSuccess = true;

                    try {
                        // Download each POD with up to 3 retries
                        const pod1 = await downloadAndConvertToBase64Immediate(photo1, consignmentID, 1, 3);
                        const pod2 = await downloadAndConvertToBase64Immediate(photo2, consignmentID, 2, 3);
                        const pod3 = await downloadAndConvertToBase64Immediate(photo3, consignmentID, 3, 3);

                        if (pod1 && pod2 && pod3) {
                            epodArray = [pod1, pod2, pod3];
                            console.log(`✅ All 3 PODs downloaded and converted successfully`);
                            console.log(`   POD 1: ${pod1.length} chars`);
                            console.log(`   POD 2: ${pod2.length} chars`);
                            console.log(`   POD 3: ${pod3.length} chars`);
                        } else {
                            podSuccess = false;
                            console.error(`❌ Failed to download all PODs`);
                        }
                    } catch (podError) {
                        podSuccess = false;
                        console.error(`❌ POD download failed: ${podError.message}`);
                    }

                    if (!podSuccess) {
                        processingResults.push({
                            consignmentID,
                            status: `Error: Failed to download POD images after retries`,
                        });
                        continue;
                    }

                    // Prepare tracking data for GDEX - matching their exact format
                    const trackingData = {
                        consignmentno: consignmentID,
                        statuscode: "FD",
                        returnflag: false,  // Notice: no quotes around false
                        statusdescription: "Delivered",
                        statusdatetime: moment(completedTimestamp).utcOffset(8).format('YYYY-MM-DDTHH:mm:ss'),
                        reasoncode: "",
                        locationdescription: data.data.address || "Customer Address",
                        epod: epodArray,  // Array of Base64 strings
                        deliverypartner: "gorush"  // You're using "gorush" not "ABCEXPRESS"
                    };

                    // ===== OPTIONAL DEBUG: See exact payload =====
                    console.log(`\n📦 PAYLOAD being sent to GDEX:`);
                    console.log(JSON.stringify({
                        ...trackingData,
                        epod: trackingData.epod.map((p, i) => `[POD${i + 1}: ${p.length} chars]`)
                    }, null, 2));
                    // ===========================================

                    console.log(`📤 Sending COMPLETED - FD to GDEX`);
                    console.log(`   Status datetime: ${trackingData.statusdatetime}`);
                    console.log(`   Location: ${trackingData.locationdescription}`);
                    console.log(`   PODs: ${epodArray.length}/3`);

                    // ========== UPDATED SENDING SECTION ==========
                    // Send to GDEX - get the RESULT object
                    const result = await sendGDEXTrackingWebhookWithData(consignmentID, trackingData, token);

                    // Check the SUCCESS property of the result
                    if (result && result.success === true) {
                        console.log(`✅ COMPLETE JOB successful for ${consignmentID}`);
                        processingResults.push({
                            consignmentID,
                            status: `✅ Complete Job: FD sent to GDEX with 3 PODs`,
                        });
                    } else {
                        console.error(`❌ COMPLETE JOB failed for ${consignmentID}:`, result?.error || 'Unknown error');

                        // Add detailed error message based on error type
                        let errorMsg = `❌ Complete Job Failed`;
                        if (result?.timeout) {
                            errorMsg = `❌ Complete Job Failed - GDEX timeout (server slow)`;
                        } else if (result?.error) {
                            // Truncate very long error messages
                            const errorText = result.error.length > 100 ? result.error.substring(0, 100) + '...' : result.error;
                            errorMsg = `❌ Complete Job Failed: ${errorText}`;
                        } else {
                            errorMsg = `❌ Complete Job Failed - Unknown error (no response from GDEX)`;
                        }

                        processingResults.push({
                            consignmentID,
                            status: errorMsg,
                        });

                        // Log full error details for debugging
                        if (result?.details) {
                            console.error(`📝 Full error details:`, JSON.stringify(result.details));
                        }
                    }
                    // ========== END UPDATED SECTION ==========

                } catch (error) {
                    console.error(`🔥 Complete Job error for ${consignmentID}:`, error.message);
                    processingResults.push({
                        consignmentID,
                        status: `Error: Complete Job failed - ${error.message}`,
                    });
                }

                continue; // Skip rest of the update delivery logic for this tracking number
            }

            if ((req.body.statusCode == 'H3' || req.body.statusCode == 'H10' || req.body.statusCode == 'H17' || req.body.statusCode == 'H32')
                && (product == 'GDEX' || product == 'GDEXT')) {

                console.log(`🚨 Processing GDEX On Hold: ${consignmentID} - Reason: ${holdReasonDescription}`);

                // MongoDB Update
                update = {
                    currentStatus: "On Hold",
                    lastUpdateDateTime: moment().format(),
                    latestLocation: "K2 Warehouse",
                    lastUpdatedBy: req.user.name,
                    latestReason: holdReasonDescription,
                    $push: {
                        history: {
                            statusHistory: "On Hold",
                            dateUpdated: moment().format(),
                            updatedBy: req.user.name,
                            lastLocation: "K2 Warehouse",
                            reason: holdReasonDescription,
                        }
                    }
                };

                // Detrack Update
                var detrackUpdateData = {
                    do_number: consignmentID,
                    data: {
                        status: "on_hold"
                    }
                };

                // GDEX API Update (will be handled by GDEXAPIrun = 7)
                portalUpdate = `Portal status updated to On Hold (${holdReasonDescription}). Detrack status updated to on_hold. `;

                mongoDBrun = 2;
                DetrackAPIrun = 1;
                GDEXAPIrun = 7; // New GDEX API run code for Hold updates
                completeRun = 1;
            }

            if (req.body.statusCode == 35) {
                if (((data.data.type == 'Delivery') && ((data.data.status == 'at_warehouse') || (data.data.status == 'in_sorting_area')))
                    || ((data.data.type == 'Delivery') && (data.data.status == 'on_hold') && ((currentProduct == "gdex") || (currentProduct == "gdext")))) {
                    if ((req.body.dispatchers == "FL1") || (req.body.dispatchers == "FL2") || (req.body.dispatchers == "FL3") || (req.body.dispatchers == "FL4") || (req.body.dispatchers == "FL5")) {
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

            // ==================================================
            // 🚨 FIX STUCK JOBS HANDLER - FSJ
            // ==================================================
            if (req.body.statusCode == 'FSJ') {
                console.log(`\n🔄 === FIX STUCK JOB (FSJ) for ${consignmentID} ===`);
                console.log(`Current Detrack Status: ${data.data.status}`);
                console.log(`Job Owner: ${data.data.job_owner}`);

                let shouldProcess = false;
                let updateReason = '';
                let updateDetrackOnly = false; // For dispatched jobs, only update date, not status

                // Get today's date in Brunei timezone (UTC+8)
                const todayBrunei = moment().utcOffset(8);
                const todayFormatted = todayBrunei.format('YYYY-MM-DD');

                console.log(`📅 Today's date (Brunei timezone UTC+8): ${todayFormatted}`);

                // Check conditions based on current status
                if (data.data.status === 'failed') {
                    // Check if job_owner is GDEX or GDEXT
                    const jobOwner = data.data.job_owner || '';
                    const isValidJobOwner = (jobOwner === 'GDEX' || jobOwner === 'GDEXT');

                    if (!isValidJobOwner) {
                        console.log(`❌ Condition NOT met: Job owner is "${jobOwner}", must be GDEX or GDEXT for failed jobs`);
                        processingResults.push({
                            consignmentID,
                            status: `Error: Failed job requires job_owner to be GDEX or GDEXT. Current job_owner: ${jobOwner}`,
                        });
                        continue;
                    }

                    // Count available photos
                    const photo1 = data.data.photo_1_file_url;
                    const photo2 = data.data.photo_2_file_url;
                    const photo3 = data.data.photo_3_file_url;
                    const availablePhotos = [photo1, photo2, photo3].filter(url => url && url.startsWith('http'));
                    const photoCount = availablePhotos.length;

                    console.log(`📸 Failed job - Available photos: ${photoCount}/3`);
                    console.log(`✅ Job owner check passed: ${jobOwner}`);

                    // FIX: If there are 0 photos, apply the fix (reset to dispatched)
                    if (photoCount === 0) {
                        shouldProcess = true;
                        updateDetrackOnly = false;
                        updateReason = `Failed job with 0 photos - reset to Out for Delivery (Job Owner: ${jobOwner})`;
                        console.log(`✅ Condition met: Has 0 photos - applying fix to reset to dispatched`);
                    } else {
                        console.log(`ℹ️ Job has ${photoCount} photo(s) - no fix needed (already has photos)`);
                        processingResults.push({
                            consignmentID,
                            status: `Info: Failed job already has ${photoCount} photo(s). No fix needed.`,
                        });
                        continue;
                    }

                } else if (data.data.status === 'completed') {
                    // Check if job_owner is GDEX or GDEXT
                    const jobOwner = data.data.job_owner || '';
                    const isValidJobOwner = (jobOwner === 'GDEX' || jobOwner === 'GDEXT');

                    if (!isValidJobOwner) {
                        console.log(`❌ Condition NOT met: Job owner is "${jobOwner}", must be GDEX or GDEXT for completed jobs`);
                        processingResults.push({
                            consignmentID,
                            status: `Error: Completed job requires job_owner to be GDEX or GDEXT. Current job_owner: ${jobOwner}`,
                        });
                        continue;
                    }

                    // Count available photos
                    const photo1 = data.data.photo_1_file_url;
                    const photo2 = data.data.photo_2_file_url;
                    const photo3 = data.data.photo_3_file_url;
                    const availablePhotos = [photo1, photo2, photo3].filter(url => url && url.startsWith('http'));
                    const photoCount = availablePhotos.length;

                    console.log(`📸 Completed job - Available photos: ${photoCount}/3`);
                    console.log(`✅ Job owner check passed: ${jobOwner}`);

                    // FIX: If NOT all 3 photos (missing any), apply the fix (reset to dispatched)
                    if (photoCount !== 3) {
                        shouldProcess = true;
                        updateDetrackOnly = false;
                        updateReason = `Completed job with only ${photoCount}/3 photos - reset to Out for Delivery (Job Owner: ${jobOwner})`;
                        console.log(`✅ Condition met: Missing photos (${photoCount}/3) - applying fix to reset to dispatched`);
                    } else {
                        console.log(`ℹ️ Job has all 3 photos - no fix needed`);
                        processingResults.push({
                            consignmentID,
                            status: `Info: Completed job already has all 3 photos. No fix needed.`,
                        });
                        continue;
                    }

                } else if (data.data.status === 'dispatched') {
                    // Dispatched jobs - ANY job_owner is allowed
                    const jobOwner = data.data.job_owner || 'Unknown';

                    // Get the job date from Detrack (format: YYYY-MM-DD)
                    const jobDate = data.data.date;

                    // Parse dates for comparison (using Brunei timezone for consistency)
                    const jobDateObj = moment.tz(jobDate, 'YYYY-MM-DD', 'Asia/Brunei');
                    const todayObj = moment.tz('Asia/Brunei').startOf('day');

                    console.log(`📅 Dispatched job - Job date: ${jobDate}, Today (Brunei): ${todayFormatted}`);
                    console.log(`ℹ️ Job owner: ${jobOwner} (any owner allowed for dispatched jobs)`);

                    // Check if job date exists and is before today (Brunei timezone)
                    if (jobDate && jobDateObj.isBefore(todayObj, 'day')) {
                        shouldProcess = true;
                        updateDetrackOnly = true; // Only update date, keep status as dispatched
                        updateReason = `Dispatched job with date ${jobDate} (before today) - updated date to ${todayFormatted} (Job Owner: ${jobOwner})`;
                        console.log(`✅ Condition met: Job date ${jobDate} is before today - updating date only`);
                    } else if (jobDate && jobDateObj.isSame(todayObj, 'day')) {
                        console.log(`ℹ️ Job date ${jobDate} is today - no fix needed`);
                        processingResults.push({
                            consignmentID,
                            status: `Info: Dispatched job date is today (${jobDate}). No fix needed.`,
                        });
                        continue;
                    } else if (jobDate && jobDateObj.isAfter(todayObj, 'day')) {
                        console.log(`ℹ️ Job date ${jobDate} is in the future - no fix needed`);
                        processingResults.push({
                            consignmentID,
                            status: `Info: Dispatched job date (${jobDate}) is in the future. No fix needed.`,
                        });
                        continue;
                    } else {
                        console.log(`❌ No valid job date found or date format issue`);
                        processingResults.push({
                            consignmentID,
                            status: `Error: No valid job date found for dispatched job.`,
                        });
                        continue;
                    }

                } else {
                    console.log(`❌ Status ${data.data.status} is not eligible for FSJ fix`);
                    processingResults.push({
                        consignmentID,
                        status: `Error: FSJ only works for 'failed', 'completed', or 'dispatched' status. Current status: ${data.data.status}`,
                    });
                    continue;
                }

                // Process the fix if conditions are met
                if (shouldProcess) {
                    try {
                        console.log(`📤 Processing FSJ fix for ${consignmentID}...`);

                        // Prepare Detrack update data
                        let detrackUpdateData;
                        if (updateDetrackOnly) {
                            // For dispatched jobs: only update date, keep status as dispatched
                            detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: todayFormatted,
                                }
                            };
                            console.log(`📝 Detrack update: Only updating date to ${todayFormatted} (status remains dispatched)`);
                        } else {
                            // For failed/completed jobs: update date AND status to dispatched
                            detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: todayFormatted,
                                    status: "dispatched",
                                }
                            };
                            console.log(`📝 Detrack update: Updating date to ${todayFormatted} AND status to dispatched`);
                        }

                        // Prepare MongoDB update data (using Brunei timezone)
                        const update = {
                            lastUpdateDateTime: moment().utcOffset(8).format(),
                            jobDate: todayFormatted,
                            lastUpdatedBy: req.user.name,
                            $push: {
                                history: {
                                    statusHistory: "Out for Delivery",
                                    dateUpdated: moment().utcOffset(8).format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to || "Unassigned",
                                    lastLocation: data.data.assign_to || "Unknown",
                                    reason: updateReason,
                                }
                            }
                        };

                        // Update MongoDB
                        const filter = { doTrackingNumber: consignmentID };
                        const option = { upsert: false, new: false };

                        const mongoResult = await ORDERS.findOneAndUpdate(filter, update, option);
                        if (mongoResult) {
                            console.log(`✅ MongoDB updated for ${consignmentID} - Job date set to ${todayFormatted}`);
                            mongoDBrun = 2;
                        } else {
                            console.error(`❌ MongoDB update failed for ${consignmentID}`);
                        }

                        // Update Detrack
                        const detrackSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData);
                        if (detrackSuccess) {
                            if (updateDetrackOnly) {
                                console.log(`✅ Detrack updated for ${consignmentID} - Date updated to ${todayFormatted}`);
                            } else {
                                console.log(`✅ Detrack updated for ${consignmentID} - Status: dispatched, Date: ${todayFormatted}`);
                            }
                            DetrackAPIrun = 1;
                        } else {
                            console.error(`❌ Detrack update failed for ${consignmentID}`);
                        }

                        completeRun = 1;

                        // Add success message
                        processingResults.push({
                            consignmentID,
                            status: `✅ Fix Stuck Job successful! ${updateReason}`,
                        });

                        console.log(`🎉 FSJ fix completed for ${consignmentID}`);

                    } catch (error) {
                        console.error(`🔥 FSJ fix error for ${consignmentID}:`, error.message);
                        processingResults.push({
                            consignmentID,
                            status: `Error: FSJ fix failed - ${error.message}`,
                        });
                    }

                    continue; // Skip the rest of the update delivery logic
                }
            }

            if (req.body.statusCode == 'SFJ') {
                // Check current MongoDB status first
                if (existingOrder) {
                    const mongoStatus = existingOrder.currentStatus;

                    // Only allow if current status is "Out for Delivery" or "Self Collect" and not "Completed"
                    if (!["Out for Delivery", "Self Collect"].includes(mongoStatus)) {
                        processingResults.push({
                            consignmentID,
                            status: `Error: Cannot clear job. Current status is "${mongoStatus}". Only "Out for Delivery" or "Self Collect" jobs can be cleared.`,
                        });
                        continue;
                    }

                    if (mongoStatus === "Completed") {
                        processingResults.push({
                            consignmentID,
                            status: `Error: Job is already completed. No update needed.`,
                        });
                        continue;
                    }
                }

                // In the SFJ section where data.data.status === 'failed'
                if (data.data.status === 'failed') {
                    // ========== UPDATED: Handle failed deliveries with photos for GDEX/GDEXT ==========

                    const failedTimestamp = data.data.updated_at;
                    const failedformattedTimestamp = moment(failedTimestamp).utcOffset(8).format('YYYY-MM-DDTHH:mm:ss');

                    // Check if this is a GDEX/GDEXT product
                    const isGdexProduct = (product == 'GDEX' || product == 'GDEXT');

                    // For GDEX products, we need to handle photos
                    if (isGdexProduct) {
                        console.log(`🚨 MANUAL GDEX FAILED JOB: ${consignmentID}`);
                        console.log(`   Reason: ${data.data.reason}`);

                        // CRITICAL: Check if AT LEAST 1 POD is available in FRESH Detrack data
                        const photo1 = data.data.photo_1_file_url;
                        const photo2 = data.data.photo_2_file_url;
                        const photo3 = data.data.photo_3_file_url;

                        // Count available photos
                        const availablePhotos = [photo1, photo2, photo3].filter(url => url && url.startsWith('http'));
                        const photoCount = availablePhotos.length;

                        console.log(`   📸 Available photos: ${photoCount}/3`);

                        if (photoCount === 0) {
                            processingResults.push({
                                consignmentID,
                                status: `Error: GDEX failed order requires at least 1 POD image. No photos available.`,
                            });
                            continue; // Skip this order entirely
                        }

                        // Create detrackData with available photo URLs
                        const detrackData = {
                            status: data.data.status,
                            reason: data.data.reason || '',
                            address: data.data.address,
                            assign_to: data.data.assign_to,
                            photo_1_file_url: photo1,
                            photo_2_file_url: photo2,
                            photo_3_file_url: photo3,
                            podAlreadyConverted: false,
                            failed_time: moment().format() // Add failed timestamp
                        };

                        try {
                            // Step 1: Download AVAILABLE PODs from Detrack with retries (minimum 1 required)
                            console.log(`📥 DOWNLOADING ${photoCount} POD(s) from Detrack with retries...`);

                            // Custom function to download only available PODs (minimum 1 required)
                            const savedPODs = await downloadAvailablePODsForGDEXFailed(
                                consignmentID,
                                detrackData,
                                photoCount,  // Pass the count of expected photos
                                3            // 3 retries max
                            );

                            if (savedPODs.length === 0) {
                                throw new Error(`Failed to download any PODs after retries`);
                            }

                            console.log(`✅ ${savedPODs.length}/${photoCount} PODs downloaded successfully`);
                            savedPODs.forEach((pod, index) => {
                                console.log(`   POD ${index + 1}: ${pod.length} chars`);
                            });

                            // Step 2: Send to GDEX API with EPOF field (for failed deliveries)
                            console.log(`🚀 Sending GDEX failed job update with ${savedPODs.length} POD(s)...`);
                            const token = await getGDEXToken();

                            if (token) {
                                // Map the fail reason to GDEX code
                                const reasonCodeMap = {
                                    "Unattempted Delivery": "BM",
                                    "Reschedule delivery requested by customer": "BK",
                                    "Reschedule to self collect requested by customer": "AG",
                                    "Cash/Duty Not Ready": "BM",
                                    "Customer not available / cannot be contacted": "AR",
                                    "No Such Person": "AW",
                                    "Customer declined delivery": "BM",
                                    "Unable to Locate Address": "BM",
                                    "Incorrect Address": "BM",
                                    "Access not allowed (OFFICE & GUARD HOUSE)": "AA",
                                    "Shipment Under Investigation": "AB",
                                    "Receiver Address Under Renovation": "AC",
                                    "Receiver Shifted": "AE",
                                    "Redirection Request by Shipper / Receiver": "AF",
                                    "Non-Service Area (NSA)": "AN",
                                    "Refusal to Accept – Damaged Shipment": "AS",
                                    "Refusal to Accept – Receiver Not Known at Address": "AW",
                                    "Refusal to Acknowledge POD / DO": "AX",
                                    "Receiver Not Present - Sorry Card Dropped": "AZ",
                                    "Natural Disaster / Pandemic": "BF",
                                    "Road Closure": "BG",
                                    "Refusal to Accept – Invalid / cancel Order": "BJ",
                                    "Consignee request for postponed delivery": "BL",
                                    "Shipper/HQ Instruction to Cancel Delivery": "BA"
                                };

                                const reasonCode = reasonCodeMap[data.data.reason] || "";
                                console.log(`📝 Mapped reason: "${data.data.reason}" → Code: ${reasonCode || 'UNMAPPED'}`);

                                // Create GDEX tracking data with EPOF field for failed deliveries
                                const gdexTrackingData = {
                                    consignmentno: consignmentID,
                                    statuscode: "DF",
                                    statusdescription: "Delivery Failed",
                                    statusdatetime: failedformattedTimestamp,
                                    reasoncode: reasonCode,
                                    locationdescription: "Go Rush Warehouse",
                                    epod: [],                    // Empty for failed deliveries
                                    epof: savedPODs,              // Use epof for failed delivery photos
                                    deliverypartner: "gorush",
                                    returnflag: false
                                };

                                console.log(`   📤 Using EPOF field with ${savedPODs.length} photo(s) for failed delivery`);

                                // Send to GDEX using your enhanced function
                                const result = await sendGDEXTrackingWebhookWithData(consignmentID, gdexTrackingData, token);

                                if (result && result.success === true) {
                                    console.log(`✅ GDEX API call successful with ${savedPODs.length} failed delivery POD(s)`);

                                    // Step 3: Update MongoDB only if GDEX API succeeded
                                    // Determine location based on assign_to
                                    let latestLocation = '';
                                    if (data.data.assign_to === 'Selfcollect') {
                                        latestLocation = 'Go Rush Kiulap Office';
                                    } else {
                                        latestLocation = data.data.address || 'Customer Address';
                                    }

                                    const update = {
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
                                                        lastLocation: latestLocation,
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
                                    };

                                    // Add grRemark for specific cases
                                    if (data.data.reason == "Reschedule to self collect requested by customer") {
                                        update.grRemark = "Reschedule to self collect requested by customer";
                                    }

                                    // Save the PODs to MongoDB based on how many we have
                                    if (savedPODs.length >= 1) update.podBase64 = savedPODs[0];
                                    if (savedPODs.length >= 2) update.podBase64_2 = savedPODs[1];
                                    if (savedPODs.length >= 3) update.podBase64_3 = savedPODs[2];

                                    update.podUpdated = moment().format();
                                    update.podSource = 'detrack_failed';
                                    update.podCompressed = true;

                                    await ORDERS.findOneAndUpdate(
                                        { doTrackingNumber: consignmentID },
                                        update,
                                        { upsert: false }
                                    );

                                    mongoDBrun = 2;
                                    completeRun = 1;

                                    // Update Detrack status
                                    var detrackUpdateData = {
                                        do_number: consignmentID,
                                        data: {
                                            status: "at_warehouse"
                                        }
                                    };

                                    if (data.data.reason == "Unattempted Delivery") {
                                        DetrackAPIrun = 1;  // Just update to at_warehouse
                                    } else {
                                        // Need to increment attempt first
                                        var detrackUpdateDataAttempt = {
                                            data: {
                                                do_number: consignmentID,
                                            }
                                        };
                                        DetrackAPIrun = 2;  // Increment attempt + update to at_warehouse
                                    }

                                    processingResults.push({
                                        consignmentID,
                                        status: `✅ Success: GDEX failed order processed with ${savedPODs.length}/3 photos. GDEX API updated with EPOF. Reason: ${data.data.reason}`,
                                    });

                                } else {
                                    console.error(`❌ GDEX API call failed for ${consignmentID}`);
                                    processingResults.push({
                                        consignmentID,
                                        status: `Error: GDEX API call failed. MongoDB not updated. ${result?.error || ''}`,
                                    });
                                }
                            } else {
                                throw new Error('Failed to get GDEX token');
                            }

                        } catch (gdexError) {
                            console.error(`❌ GDEX failed job processing error: ${gdexError.message}`);
                            processingResults.push({
                                consignmentID,
                                status: `Error: GDEX failed job processing failed - ${gdexError.message}`,
                            });
                            continue;
                        }

                    } else {
                        // ========== NON-GDEX PRODUCTS (keep existing logic) ==========
                        if (data.data.reason == "Unattempted Delivery") {
                            // Keep existing non-GDEX failed delivery logic here
                            // [Your existing code for non-GDEX products]

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
                                    status: "at_warehouse"
                                }
                            };

                            DetrackAPIrun = 1;
                            mongoDBrun = 2;
                            completeRun = 1;
                            appliedStatus = "Failed Delivery, Return to Warehouse"
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";

                        } else if (data.data.reason == "Reschedule to self collect requested by customer") {
                            // Keep existing non-GDEX failed delivery logic here
                            // [Your existing code for non-GDEX products]

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
                                    status: "at_warehouse"
                                }
                            };

                            var detrackUpdateDataAttempt = {
                                data: {
                                    do_number: consignmentID,
                                }
                            };

                            DetrackAPIrun = 2;
                            mongoDBrun = 2;
                            completeRun = 1;
                            appliedStatus = "Failed Delivery, Return to Warehouse"
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";

                        } else {
                            // Keep existing non-GDEX failed delivery logic here
                            // [Your existing code for non-GDEX products]

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
                                    status: "at_warehouse"
                                }
                            };

                            var detrackUpdateDataAttempt = {
                                data: {
                                    do_number: consignmentID,
                                }
                            };

                            DetrackAPIrun = 2;
                            mongoDBrun = 2;
                            completeRun = 1;
                            appliedStatus = "Failed Delivery, Return to Warehouse"
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        }

                        // For non-GDEX, just add success message (no photo handling)
                        processingResults.push({
                            consignmentID,
                            status: `✅ Success: Non-GDEX failed order processed. Reason: ${data.data.reason}`,
                        });
                    }
                }

                // In the SFJ section where data.data.status === 'completed'
                if (data.data.status === 'completed') {
                    // ========== UPDATED CODE WITH YOUR REQUIREMENTS ==========

                    // Get completed timestamp from Detrack
                    const completedTimestamp = data.data.updated_at;
                    const formattedTimestamp = moment(completedTimestamp).utcOffset(8).format('YYYY-MM-DDTHH:mm:ss');

                    // Determine location based on assign_to
                    let latestLocation = '';
                    if (data.data.assign_to === 'Selfcollect') {
                        latestLocation = 'Go Rush Kiulap Office';
                    } else {
                        latestLocation = data.data.address || 'Customer Address';
                    }

                    // ========== GDEX/GDEXT SPECIAL HANDLING ==========
                    if ((product == 'GDEX') || (product == 'GDEXT')) {
                        console.log(`🚨 MANUAL GDEX CLEAR JOB: ${consignmentID}`);

                        // CRITICAL: Check if ALL 3 PODs are available in FRESH Detrack data
                        const photo1 = data.data.photo_1_file_url;
                        const photo2 = data.data.photo_2_file_url;
                        const photo3 = data.data.photo_3_file_url;

                        if (!photo1 || !photo2 || !photo3) {
                            processingResults.push({
                                consignmentID,
                                status: `Error: GDEX order requires all 3 POD images. Missing: ${!photo1 ? 'Photo1,' : ''}${!photo2 ? 'Photo2,' : ''}${!photo3 ? 'Photo3' : ''}`.replace(/,$/, ''),
                            });
                            continue;
                        }

                        // Create detrackData with ALL FRESH photo URLs
                        const detrackData = {
                            status: data.data.status,
                            reason: data.data.reason || '',
                            address: data.data.address,
                            assign_to: data.data.assign_to,
                            photo_1_file_url: photo1,
                            photo_2_file_url: photo2,
                            photo_3_file_url: photo3,
                            podAlreadyConverted: false,
                            completed_time: formattedTimestamp
                        };

                        try {
                            // Step 1: Download FRESH ALL 3 PODs from Detrack with retries
                            console.log(`📥 DOWNLOADING FRESH ALL 3 PODs from Detrack with retries...`);
                            const savedPODs = await saveAllPODsToDatabase(consignmentID, detrackData, 3);

                            if (savedPODs.length !== 3) {
                                throw new Error(`Expected 3 PODs, got ${savedPODs.length}`);
                            }

                            console.log(`✅ All 3 PODs downloaded FRESH, compressed, and converted to Base64`);
                            console.log(`   POD 1: ${savedPODs[0].length} chars`);
                            console.log(`   POD 2: ${savedPODs[1].length} chars`);
                            console.log(`   POD 3: ${savedPODs[2].length} chars`);

                            // Step 2: Send to GDEX API with FRESH Base64 PODs
                            console.log(`🚀 Sending GDEX clear job update with FRESH PODs...`);
                            const token = await getGDEXToken();

                            if (token) {
                                // Create GDEX tracking data with updated location
                                const gdexTrackingData = {
                                    consignmentno: consignmentID,
                                    statuscode: "FD",
                                    statusdescription: "Delivered",
                                    statusdatetime: formattedTimestamp,
                                    reasoncode: "",
                                    locationdescription: latestLocation,
                                    epod: savedPODs,
                                    deliverypartner: "gorush",
                                    returnflag: false
                                };

                                // Send to GDEX using your enhanced function
                                const result = await sendGDEXTrackingWebhookWithData(consignmentID, gdexTrackingData, token);

                                if (result && result.success === true) {
                                    console.log(`✅ GDEX API call successful with FRESH PODs`);

                                    // Step 3: Update MongoDB only if GDEX API succeeded
                                    const update = {
                                        currentStatus: "Completed",
                                        lastUpdateDateTime: formattedTimestamp,
                                        latestLocation: latestLocation,
                                        lastUpdatedBy: req.user.name,
                                        assignedTo: data.data.assign_to,
                                        $push: {
                                            history: {
                                                statusHistory: "Completed",
                                                dateUpdated: formattedTimestamp,
                                                updatedBy: req.user.name,
                                                lastAssignedTo: data.data.assign_to,
                                                lastLocation: latestLocation,
                                            }
                                        }
                                    };

                                    await ORDERS.findOneAndUpdate(
                                        { doTrackingNumber: consignmentID },
                                        update,
                                        { upsert: false }
                                    );

                                    mongoDBrun = 2;
                                    completeRun = 1;

                                    processingResults.push({
                                        consignmentID,
                                        status: `✅ Success: GDEX order cleared with FRESH 3 PODs and GDEX API updated. Location: ${latestLocation}`,
                                    });

                                } else {
                                    console.error(`❌ GDEX API call failed for ${consignmentID}`);
                                    processingResults.push({
                                        consignmentID,
                                        status: `Error: GDEX API call failed. MongoDB not updated. ${result?.error || ''}`,
                                    });
                                }
                            } else {
                                throw new Error('Failed to get GDEX token');
                            }

                        } catch (gdexError) {
                            console.error(`❌ GDEX manual clear job failed: ${gdexError.message}`);
                            processingResults.push({
                                consignmentID,
                                status: `Error: GDEX clear job failed - ${gdexError.message}`,
                            });
                            continue;
                        }

                    } else {
                        // ========== NON-GDEX PRODUCTS ==========
                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: finalArea,
                                items: itemsArray,
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Completed",
                                    dateUpdated: formattedTimestamp,
                                    updatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to,
                                    lastLocation: latestLocation,
                                }],
                                latestLocation: latestLocation,
                                product: currentProduct,
                                assignedTo: data.data.assign_to,
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Completed",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: formattedTimestamp,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                lastUpdateDateTime: formattedTimestamp,
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
                            completeRun = 1;
                        } else {
                            const update = {
                                currentStatus: "Completed",
                                lastUpdateDateTime: formattedTimestamp,
                                latestLocation: latestLocation,
                                lastUpdatedBy: req.user.name,
                                assignedTo: data.data.assign_to,
                                $push: {
                                    history: {
                                        statusHistory: "Completed",
                                        dateUpdated: formattedTimestamp,
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        lastLocation: latestLocation,
                                    }
                                }
                            };

                            await ORDERS.findOneAndUpdate(
                                { doTrackingNumber: consignmentID },
                                update,
                                { upsert: false }
                            );

                            mongoDBrun = 2;
                            completeRun = 1;
                        }

                        // Download single POD if available (for non-GDEX)
                        if (data.data.photo_1_file_url) {
                            console.log(`📸 Downloading POD for non-GDEX order ${consignmentID}...`);
                            try {
                                const podBase64 = await downloadAndConvertToBase64(data.data.photo_1_file_url, consignmentID);
                                if (podBase64) {
                                    await ORDERS.findOneAndUpdate(
                                        { doTrackingNumber: consignmentID },
                                        {
                                            $set: {
                                                podBase64: podBase64,
                                                podUpdated: formattedTimestamp,
                                                podSource: 'detrack',
                                                podCompressed: true
                                            }
                                        }
                                    );
                                    console.log(`✅ POD saved for non-GDEX order`);
                                }
                            } catch (podError) {
                                console.log(`⚠️ Could not download POD: ${podError.message}`);
                            }
                        }

                        processingResults.push({
                            consignmentID,
                            status: `✅ Success: Non-GDEX order cleared. Location: ${latestLocation}`,
                        });
                    }

                    appliedStatus = "Completed";
                    completeRun = 1;
                    portalUpdate = "Portal status updated to Completed. ";
                }
            }

            if (req.body.statusCode == 'CSSC') {
                if (((data.data.status == 'at_warehouse') || (data.data.status == 'in_sorting_area'))
                    || ((data.data.type == 'Delivery') && (data.data.status == 'on_hold') && ((currentProduct == "gdex") || (currentProduct == "gdext")))) {
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

            if (req.body.statusCode == 'RSAL2') {
                if ((product == 'GDEX') || (product == 'GDEXT')) {
                    // Check if job is in correct status for return
                    if ((data.data.status == 'at_warehouse') || (data.data.status == 'in_sorting_area') || (data.data.status == 'on_hold')) {

                        // MongoDB update for return status
                        update = {
                            currentStatus: "Return",
                            lastUpdateDateTime: moment().format(),
                            latestLocation: "Warehouse K2",
                            lastUpdatedBy: req.user.name,
                            $push: {
                                history: {
                                    statusHistory: "Return",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastLocation: "Warehouse K2",
                                }
                            }
                        };

                        // Detrack update for return status
                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "return"
                            }
                        };

                        portalUpdate = "Detrack and Portal updated to Return status";

                        // Set GDEXAPIrun = 8 for Return to Shipper
                        GDEXAPIrun = 8;

                        mongoDBrun = 2;
                        DetrackAPIrun = 1;  // Update Detrack to "return" status
                        completeRun = 1;
                    } else {
                        // Job not in correct status for return
                        processingResults.push({
                            consignmentID,
                            status: `Error: GDEX job must be "at_warehouse", "in_sorting_area", "failed", or "info_recv" to mark as return. Current status: ${data.data.status}`,
                        });
                        continue;
                    }
                } else {
                    // Not GDEX/GDEXT product
                    processingResults.push({
                        consignmentID,
                        status: `Error: RSAL2 (Return to Shipper) only available for GDEX/GDEXT products. This is ${product}`,
                    });
                    continue;
                }
            }

            if ((req.body.statusCode == 'CD') && (data.data.status != 'completed') && (product != 'GDEX') & (product != 'GDEXT')) {
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
                    if (data.data.run_number != null) {
                        update = {
                            mawbNo: req.body.awbNum,
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
                                assign_to: "Selfcollect",
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
                                assign_to: "Selfcollect",
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
                                assign_to: "Selfcollect",
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

            // Update the condition to include only FAB, FAF, FAG, FAN, FBA:
            if ((req.body.statusCode == 'FAB') || (req.body.statusCode == 'FAF') ||
                (req.body.statusCode == 'FAG') || (req.body.statusCode == 'FAN') ||
                (req.body.statusCode == 'FBA') || (req.body.statusCode == 'FAR')) {

                if ((product == 'GDEX') || (product == 'GDEXT')) {
                    if ((data.data.status == 'at_warehouse') || (data.data.status == 'in_sorting_area')) {
                        update = {
                            currentStatus: "At Warehouse",
                            lastUpdateDateTime: moment().format(),
                            latestReason: failReasonDescription,
                            grRemark: failReasonDescription,
                            lastUpdatedBy: req.user.name,
                            $push: {
                                history: {
                                    $each: [
                                        {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            reason: failReasonDescription
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
                                status: "failed",
                                assign_to: "Selfcollect",
                                reason: failReasonDescription,
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

                        portalUpdate = "Detrack and Portal updated";

                        // Store the GDEX fail reason for later use in GDEXAPIrun = 9
                        // We don't need to set detrackData here since we're using GDEXAPIrun = 9

                        // Use GDEXAPIrun = 9 for GDEX fail with AL2 first
                        GDEXAPIrun = 9;

                        mongoDBrun = 2;
                        DetrackAPIrun = 6;
                        completeRun = 1;
                    } else {
                        // Job not in correct status
                        processingResults.push({
                            consignmentID,
                            status: `Error: GDEX job must be "at_warehouse" or "in_sorting_area" to mark as failed. Current status: ${data.data.status}`,
                        });
                        continue;
                    }
                } else {
                    // Not GDEX/GDEXT product
                    processingResults.push({
                        consignmentID,
                        status: `Error: GDEX fail reason updates only available for GDEX/GDEXT products. This is ${product}`,
                    });
                    continue;
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

            /* if (GDEXAPIrun == 5) {
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
            } */

            // In the GDEXAPIrun == 6 section, add product check:
            if (GDEXAPIrun == 6) {
                // Only call GDEX API for GDEX/GDEXT products
                if (product === 'GDEX' || product === 'GDEXT') {
                    console.log(`=== Processing GDEX clear job for: ${consignmentID} ===`);

                    // Get token and call updateGDEXClearJob
                    const token = await getGDEXToken();
                    if (token) {
                        const gdexSuccess = await updateGDEXClearJob(consignmentID, detrackData, token);
                        if (gdexSuccess) {
                            console.log(`✅ GDEX clear job completed with ALL 3 PODs for ${consignmentID}`);
                        } else {
                            console.error(`❌ GDEX API call failed for ${consignmentID}`);
                        }
                    } else {
                        console.error(`❌ Failed to get GDEX token for ${consignmentID}`);
                    }
                } else {
                    console.log(`⚠️ Skipping GDEX API for non-GDEX product: ${product}`);
                    GDEXAPIrun = 0; // Don't call GDEX API
                }
            }

            if (GDEXAPIrun == 7) {
                console.log(`🚨 Starting GDEX On Hold update for Tracking: ${consignmentID}`);
                console.log(`   Reason Code: ${gdexHoldReason}, Description: ${holdReasonDescription}`);

                try {
                    // Get GDEX token
                    const token = await getGDEXToken();
                    if (!token) {
                        console.error(`❌ Failed to get GDEX token for ${consignmentID}`);

                        const existingIndex = processingResults.findIndex(r => r.consignmentID === consignmentID);
                        if (existingIndex !== -1) {
                            processingResults[existingIndex].status += " Error: Failed to get GDEX token.";
                        }
                        return;
                    }

                    // Send Hold status to GDEX
                    const gdexSuccess = await sendGDEXTrackingWebhook(
                        consignmentID,
                        "K",                          // statuscode: "K" for Hold
                        "Hold",                       // statusdescription: fixed as "Hold"
                        "Go Rush Warehouse",          // locationdescription: fixed
                        token,
                        gdexHoldReason,               // reasoncode: H3, H10, H17, or H32
                        "",                           // epod: empty
                        false                         // returnflag: false
                    );

                    if (gdexSuccess) {
                        console.log(`✅ GDEX Hold update succeeded for Tracking: ${consignmentID} (Reason: ${gdexHoldReason})`);

                        // Update processing result
                        const existingIndex = processingResults.findIndex(r => r.consignmentID === consignmentID);
                        if (existingIndex !== -1) {
                            processingResults[existingIndex].status += ` GDEX: Hold (${gdexHoldReason}) sent successfully.`;
                        }
                    } else {
                        console.error(`❌ GDEX Hold update failed for Tracking: ${consignmentID}`);

                        const existingIndex = processingResults.findIndex(r => r.consignmentID === consignmentID);
                        if (existingIndex !== -1) {
                            processingResults[existingIndex].status += " Error: Failed to send Hold status to GDEX.";
                        }
                    }

                } catch (error) {
                    console.error(`🔥 Error in GDEX Hold update for ${consignmentID}:`, error.message);

                    const existingIndex = processingResults.findIndex(r => r.consignmentID === consignmentID);
                    if (existingIndex !== -1) {
                        processingResults[existingIndex].status += ` GDEX Error: ${error.message}`;
                    } else {
                        processingResults.push({
                            consignmentID,
                            status: `GDEX Error: ${error.message}`,
                        });
                    }
                }
            }

            if (GDEXAPIrun == 8) {
                console.log(`🔄 Processing GDEX Return to Shipper for Tracking: ${consignmentID}`);

                const gdexSuccess = await updateGDEXStatus(
                    consignmentID,
                    'custom',
                    null,               // detrackData not needed
                    "AL2",              // statusCode
                    "Out for Delivery", // statusDescription
                    "Go Rush Warehouse",// locationDescription
                    "",                 // reasonCode (empty)
                    "",                 // epod (empty)
                    true                // returnflag = true (CRITICAL for returns!)
                );

                if (gdexSuccess) {
                    console.log(`✅ GDEX Return to Shipper update succeeded for Tracking: ${consignmentID}`);
                } else {
                    console.error(`❌ GDEX Return to Shipper update failed for Tracking: ${consignmentID}`);
                }
            }

            if (GDEXAPIrun == 9) {
                console.log(`\n🔄 === Processing GDEX Fail with AL2 First: ${consignmentID} ===`);
                console.log(`   Reason: ${failReasonDescription} (Code: ${gdexFailReason})`);

                try {
                    // Step 1: Get GDEX token
                    const token = await getGDEXToken();
                    if (!token) {
                        console.error(`❌ Failed to get GDEX token for ${consignmentID}`);
                        const existingIndex = processingResults.findIndex(r => r.consignmentID === consignmentID);
                        if (existingIndex !== -1) {
                            processingResults[existingIndex].status += " Error: Failed to get GDEX token.";
                        }
                        return;
                    }

                    // Step 2: Send AL2 (Out for Delivery) first
                    console.log(`📤 Step 1: Sending AL2 (Out for Delivery) to GDEX`);

                    const al2Success = await sendGDEXTrackingWebhook(
                        consignmentID,
                        "AL2",
                        "Out for Delivery",
                        "Go Rush Warehouse",
                        token,
                        "",
                        "",
                        false
                    );

                    if (!al2Success) {
                        console.error(`❌ Step 1 Failed: Could not send AL2 to GDEX`);
                        const existingIndex = processingResults.findIndex(r => r.consignmentID === consignmentID);
                        if (existingIndex !== -1) {
                            processingResults[existingIndex].status += " Error: Failed to send AL2 to GDEX.";
                        }
                        return;
                    }

                    console.log(`✅ Step 1 Success: AL2 sent to GDEX`);
                    console.log(`⏳ Waiting 2 seconds before sending fail status...`);

                    // Step 3: Wait 2 seconds before sending fail status
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Step 4: Send the DF (Failed) status with specific reason code
                    console.log(`📤 Step 2: Sending DF (Failed) with reason code ${gdexFailReason}`);

                    // Create detrackData for the clear job
                    const failDetrackData = {
                        status: 'failed',
                        reason: failReasonDescription,
                        address: data.data.address,
                        gdexFailReason: gdexFailReason  // AB, AF, AG, AN, or BA
                    };

                    // Use updateGDEXClearJob which will now send DF with the specific reason code
                    const failSuccess = await updateGDEXClearJob(consignmentID, failDetrackData, token, false);

                    if (failSuccess) {
                        console.log(`✅ Step 2 Success: DF with reason ${gdexFailReason} sent to GDEX`);
                        console.log(`🎉 GDEX fail update completed successfully!`);

                        const existingIndex = processingResults.findIndex(r => r.consignmentID === consignmentID);
                        if (existingIndex !== -1) {
                            processingResults[existingIndex].status += " GDEX: AL2 → DF sent successfully.";
                        }
                    } else {
                        console.error(`❌ Step 2 Failed: Could not send DF status to GDEX`);
                        const existingIndex = processingResults.findIndex(r => r.consignmentID === consignmentID);
                        if (existingIndex !== -1) {
                            processingResults[existingIndex].status += " Error: Failed to send fail status to GDEX.";
                        }
                    }

                } catch (error) {
                    console.error(`🔥 Error in GDEX fail with AL2 first for ${consignmentID}:`, error.message);
                    const existingIndex = processingResults.findIndex(r => r.consignmentID === consignmentID);
                    if (existingIndex !== -1) {
                        processingResults[existingIndex].status += ` GDEX Error: ${error.message}`;
                    } else {
                        processingResults.push({
                            consignmentID,
                            status: `GDEX Error: ${error.message}`,
                        });
                    }
                }

                console.log(`=== Completed GDEX Fail Processing for: ${consignmentID} ===\n`);
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
// 🩺 Health Checks
// ==================================================

// UAT Health check
app.get('/api/gdex/sendorderrequest/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'GDEX UAT to Detrack proxy is healthy',
        environment: 'UAT',
        timestamp: new Date().toISOString(),
        authentication: process.env.GDEX_API_KEY_UAT ? 'enabled' : 'disabled'
    });
});

// LIVE Health check
app.get('/api/gdex/sendorders/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'GDEX LIVE to Detrack proxy is healthy',
        environment: 'LIVE',
        timestamp: new Date().toISOString(),
        authentication: process.env.GDEX_API_KEY_LIVE ? 'enabled' : 'disabled'
    });
});

// ==================================================
// 🔐 API Key Authentication Middlewares
// ==================================================

// UAT/TESTING Authentication Middleware
const authenticateGDEXUAT = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'] || req.query.apiKey;

    // Get UAT API key from environment variables
    const validApiKey = process.env.GDEX_API_KEY_UAT;

    // If no API key is configured, allow all requests (for development)
    if (!validApiKey) {
        console.warn('⚠️  GDEX_API_KEY_UAT not configured in environment - allowing all requests');
        return next();
    }

    // Check if API key is provided
    if (!apiKey) {
        console.error('❌ Missing API key (UAT):', {
            ip: req.ip,
            path: req.path,
            timestamp: new Date().toISOString()
        });
        // ✅ UPDATED: Return GDEX expected format
        return res.status(401).json({
            "success": false,
            "error": {
                "code": 401,
                "message": "Missing API key"
            }
        });
    }

    // Extract key if it's in Bearer format
    const extractedKey = apiKey.startsWith('Bearer ') ? apiKey.slice(7) : apiKey;

    // Validate API key
    if (extractedKey !== validApiKey) {
        console.error('❌ Invalid API key (UAT):', {
            ip: req.ip,
            path: req.path,
            timestamp: new Date().toISOString()
        });
        // ✅ UPDATED: Return GDEX expected format
        return res.status(401).json({
            "success": false,
            "error": {
                "code": 401,
                "message": "Invalid API key"
            }
        });
    }

    // API key is valid, proceed to route
    console.log('✅ UAT API key validated:', {
        ip: req.ip,
        path: req.path,
        timestamp: new Date().toISOString()
    });
    next();
};

// LIVE Authentication Middleware
const authenticateGDEXLIVE = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'] || req.query.apiKey;

    // Get LIVE API key from environment variables
    const validApiKey = process.env.GDEX_API_KEY_LIVE;

    // If no API key is configured, deny access
    if (!validApiKey) {
        console.error('❌ GDEX_API_KEY_LIVE not configured in environment');
        // ✅ UPDATED: Return GDEX expected format
        return res.status(500).json({
            "success": false,
            "error": {
                "code": 500,
                "message": "Live API key not configured"
            }
        });
    }

    // Check if API key is provided
    if (!apiKey) {
        console.error('❌ Missing API key (LIVE):', {
            ip: req.ip,
            path: req.path,
            timestamp: new Date().toISOString()
        });
        // ✅ UPDATED: Return GDEX expected format
        return res.status(401).json({
            "success": false,
            "error": {
                "code": 401,
                "message": "Missing API key"
            }
        });
    }

    // Extract key if it's in Bearer format
    const extractedKey = apiKey.startsWith('Bearer ') ? apiKey.slice(7) : apiKey;

    // Validate API key
    if (extractedKey !== validApiKey) {
        console.error('❌ Invalid API key (LIVE):', {
            ip: req.ip,
            path: req.path,
            timestamp: new Date().toISOString()
        });
        // ✅ UPDATED: Return GDEX expected format
        return res.status(401).json({
            "success": false,
            "error": {
                "code": 401,
                "message": "Invalid API key"
            }
        });
    }

    // API key is valid, proceed to route
    console.log('✅ LIVE API key validated:', {
        ip: req.ip,
        path: req.path,
        timestamp: new Date().toISOString()
    });
    next();
};

// ==================================================
// 📮 GDEX to Detrack API Routes
// ==================================================

// Apply UAT authentication to UAT routes
app.use('/api/gdex/sendorderrequest', authenticateGDEXUAT);

// Apply LIVE authentication to LIVE routes
app.use('/api/gdex/sendorders', authenticateGDEXLIVE);

// ==================================================
// 📮 GDEX UAT/TESTING Proxy API
// ==================================================

app.post('/api/gdex/sendorderrequest', async (req, res) => {
    try {
        console.log('📦 [UAT] GDEX Order Received for Go Rush:', {
            consignmentno: req.body.consignmentno,
            environment: 'UAT',
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

            console.error('❌ [UAT] GDEX Order Validation Failed:', {
                consignmentno: req.body.consignmentno || 'Unknown',
                missing_fields: missingFields,
                environment: 'UAT',
                timestamp: new Date().toISOString()
            });

            // ✅ UPDATED: Return GDEX expected format for validation errors
            return res.status(400).json({
                "success": false,
                "error": {
                    "code": 400,
                    "message": errorMessage
                }
            });
        }

        // Process the order with UAT configuration
        await processGDEXOrder(req.body, 'UAT', res);

    } catch (error) {
        console.error('❌ [UAT] GDEX to Go Rush Error:', {
            consignmentno: req.body?.consignmentno,
            error: error.message,
            environment: 'UAT',
            timestamp: new Date().toISOString()
        });

        // ✅ UPDATED: Return GDEX expected format for unhandled errors
        res.status(500).json({
            "success": false,
            "error": {
                "code": 500,
                "message": `Internal server error: ${error.message}`
            }
        });
    }
});

// ==================================================
// 📮 GDEX LIVE Proxy API
// ==================================================

app.post('/api/gdex/sendorders', async (req, res) => {
    try {
        console.log('📦 [LIVE] GDEX Order Received for Go Rush:', {
            consignmentno: req.body.consignmentno,
            environment: 'LIVE',
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

            console.error('❌ [LIVE] GDEX Order Validation Failed:', {
                consignmentno: req.body.consignmentno || 'Unknown',
                missing_fields: missingFields,
                environment: 'LIVE',
                timestamp: new Date().toISOString()
            });

            // ✅ UPDATED: Return GDEX expected format for validation errors
            return res.status(400).json({
                "success": false,
                "error": {
                    "code": 400,
                    "message": errorMessage
                }
            });
        }

        // Process the order with LIVE configuration
        await processGDEXOrder(req.body, 'LIVE', res);

    } catch (error) {
        console.error('❌ [LIVE] GDEX to Go Rush Error:', {
            consignmentno: req.body?.consignmentno,
            error: error.message,
            environment: 'LIVE',
            timestamp: new Date().toISOString()
        });

        // ✅ UPDATED: Return GDEX expected format for unhandled errors
        res.status(500).json({
            "success": false,
            "error": {
                "code": 500,
                "message": `Internal server error: ${error.message}`
            }
        });
    }
});

// ==================================================
// 🛠 Shared Order Processing Function
// ==================================================

async function processGDEXOrder(orderData, environment, res) {
    try {
        console.log(`🔍 Checking if consignment exists in Detrack: ${orderData.consignmentno}`);

        // ===========================================
        // STEP 1: CHECK IF ORDER ALREADY EXISTS IN DETRACK
        // ===========================================
        try {
            const checkResponse = await axios.get(
                `https://app.detrack.com/api/v2/dn/jobs/show/?do_number=${orderData.consignmentno}`,
                {
                    headers: {
                        'X-API-KEY': process.env.API_KEY
                    }
                }
            );

            // If we get here, job exists (200 response)
            console.log(`⚠️ Consignment ${orderData.consignmentno} already exists in Detrack`);

            // ✅ RETURN GDEX DUPLICATE FORMAT
            return res.status(200).json({
                "success": false,
                "error": {
                    "code": 0,
                    "message": `Duplicate CN: ${orderData.consignmentno}`
                }
            });

        } catch (checkError) {
            // If 404 - job doesn't exist (this is what we want)
            if (checkError.response?.status === 404) {
                console.log(`✅ Consignment ${orderData.consignmentno} not found in Detrack - proceeding`);
            } else {
                // Other errors (network, auth, etc.)
                console.error(`❌ Error checking consignment in Detrack:`, {
                    consignmentno: orderData.consignmentno,
                    error: checkError.message,
                    status: checkError.response?.status
                });
                // Continue anyway - let Detrack handle duplicate on creation
            }
        }

        // ===========================================
        // STEP 2: PREPARE ORDER DATA
        // ===========================================
        // Transform phone number format
        const formattedPhone = formatPhoneNumber(orderData.consigneecontact, orderData.country);

        // Build complete address
        const completeAddress = buildCompleteAddress(orderData);

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

        // Determine group name based on environment
        const groupName = environment === 'UAT' ? 'GDEXT' : 'GDEX';

        // Transform GDEX format to Detrack format
        const detrackJob = {
            "data": {
                "type": "Delivery",
                "do_number": orderData.consignmentno,
                "date": moment().format('YYYY-MM-DD'),
                "status": "info_recv",
                "tracking_number": orderData.consignmentno,
                "job_type": "Standard",
                "address": completeAddress,
                "postal_code": orderData.consigneepostcode || '',
                "city": orderData.consigneetown || '',
                "state": orderData.consigneestate || '',
                "country": orderData.consigneecountry || '',
                "deliver_to_collect_from": orderData.consigneename,
                "job_owner": "GDEX",
                "phone_number": formattedPhone,
                "zone": finalArea,
                "payment_mode": orderData.product === '00008' ? "Cash" : "NON COD",
                "payment_amount": orderData.product === '00008' ? parseFloat(orderData.codpayment) || 0 : 0,
                "total_price": orderData.product === '00008' ? parseFloat(orderData.codpayment) || 0 : 0,
                "group_name": groupName,  // This changes based on environment
                "weight": parseFloat(orderData.weight) || 0,
                "parcel_width": parseFloat(orderData.width) || 0,
                "parcel_length": parseFloat(orderData.length) || 0,
                "parcel_height": parseFloat(orderData.height) || 0,
                "items": [
                    {
                        "description": orderData.productdesc || 'General Goods',
                        "quantity": parseInt(orderData.pieces) || 1,
                        "weight": parseFloat(orderData.weight) || 0
                    }
                ]
            }
        };

        // Send to Detrack API
        const detrackResponse = await axios.post(
            'https://app.detrack.com/api/v2/dn/jobs',
            detrackJob,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': process.env.API_KEY
                }
            }
        );

        console.log(`✅ Successfully sent to Go Rush (${environment}):`, {
            consignmentno: orderData.consignmentno,
            group_name: groupName,
            environment: environment,
            timestamp: new Date().toISOString()
        });

        // ✅ UPDATED: Return GDEX expected format for SUCCESS
        res.status(200).json({
            "success": true,
            "error": null
        });

    } catch (error) {
        const errorData = error.response?.data;

        console.error(`❌ Error creating order in Detrack (${environment}):`, {
            consignmentno: orderData.consignmentno,
            status: error.response?.status,
            error: error.message,
            environment: environment
        });

        // Handle Detrack creation errors
        if (error.response?.status === 422 || error.response?.status === 400) {
            // Detrack validation/duplicate error on creation
            const errorMessage = errorData?.errors?.[0]?.message ||
                errorData?.message ||
                "Validation failed in Detrack";

            // Check if it's a duplicate error
            if (errorMessage.toLowerCase().includes('duplicate') ||
                errorMessage.toLowerCase().includes('already exists')) {
                return res.status(200).json({
                    "success": false,
                    "error": {
                        "code": 0,
                        "message": `Duplicate CN: ${orderData.consignmentno}`
                    }
                });
            }

            // Other validation errors
            return res.status(200).json({
                "success": false,
                "error": {
                    "code": 400,
                    "message": `Detrack validation error: ${errorMessage}`
                }
            });
        }

        // Other errors
        res.status(200).json({
            "success": false,
            "error": {
                "code": 500,
                "message": `Detrack error: ${error.message || 'Unknown error'}`
            }
        });
    }
}

// ==================================================
// 🛠 Helper Functions (Keep as is)
// ==================================================

// Format Brunei phone numbers only
function formatPhoneNumber(phone, country) {
    if (!phone) return '';

    let cleanedPhone = phone.toString().replace(/\D/g, '');

    // Only process Brunei numbers
    if (country !== 'BRN') {
        return cleanedPhone;
    }

    const bruneiCountryCode = '673';

    if (cleanedPhone.startsWith(bruneiCountryCode)) {
        cleanedPhone = cleanedPhone.substring(bruneiCountryCode.length);
    }

    if (cleanedPhone.length === 7) {
        return `+${bruneiCountryCode}${cleanedPhone}`;
    } else if (cleanedPhone.length === 10 && cleanedPhone.startsWith('673')) {
        return `+${cleanedPhone}`;
    } else if (cleanedPhone.length === 11 && cleanedPhone.startsWith('673')) {
        return `+${cleanedPhone}`;
    } else {
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

    return addressParts.filter(part => part && part.trim() !== '').join(', ');
}

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

// Serve the update job page
app.get('/updateJob', ensureAuthenticated, (req, res) => {
    res.render('updateJob', { user: req.user });
});

app.post('/updateJob', async (req, res) => {
    try {
        const { updateCode, mawbNum, warehouse, trackingNumbers, updateMethod } = req.body;

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

        // ONE-BY-ONE PROCESSING
        if (updateMethod === 'onebyone' && uniqueTrackingNumbers.length === 1) {
            try {
                const trackingNumber = uniqueTrackingNumbers[0];

                console.log(`Processing one-by-one ${updateCode} for ${trackingNumber}`);

                let result;
                switch (updateCode) {
                    case 'UAN':
                        const uanResult = await processMAWBUpdate(trackingNumber, mawbNum, req);
                        result = {
                            success: uanResult,
                            message: uanResult ? `MAWB Number updated to ${mawbNum}` : 'MAWB update failed'
                        };
                        break;
                    case 'UWP':  // NEW UWP CASE
                        // For one-by-one, we'll need postalCode and parcelWeight from somewhere
                        // This would need a different UI for single updates
                        // For now, we can return an error or implement a different approach
                        result = {
                            success: false,
                            message: 'One-by-one UWP updates not supported yet. Please use Excel upload.'
                        };
                        break;
                    case 'CCH':
                        const cchResult = await processOnHoldUpdate(trackingNumber, req);
                        result = {
                            success: cchResult,
                            message: cchResult ? 'Job put on hold' : 'On hold update failed'
                        };
                        break;
                    case 'H9':
                    case 'H18':
                    case 'H19':
                    case 'H27':
                    case 'H31':
                        const gdexHoldResult = await processGDEXHoldUpdate(trackingNumber, updateCode, req);
                        result = {
                            success: gdexHoldResult.success,
                            message: gdexHoldResult.message || 'GDEX Hold update failed'
                        };
                        break;
                    case 'IIW':
                        result = await processItemInWarehouseUpdate(trackingNumber, warehouse, req);
                        break;
                    case 'UMN':
                        const umnResult = await processUMNUpdate(trackingNumber, mawbNum, req);
                        result = {
                            success: umnResult,
                            message: umnResult ? `MAWB Number updated to ${mawbNum}` : 'UMN update failed'
                        };
                        break;
                    default:
                        result = { success: false, message: `Unsupported update code: ${updateCode}` };
                }

                const results = {
                    successful: result.success && !result.delayed ? [{
                        trackingNumber: trackingNumber,
                        result: result.message,
                        status: result.success ? "Updated" : "Failed"
                    }] : [],
                    failed: !result.success && !result.delayed ? [{
                        trackingNumber: trackingNumber,
                        result: result.message,
                        status: "Failed"
                    }] : [],
                    delayed: result.delayed ? [{
                        trackingNumber: trackingNumber,
                        result: result.message,
                        product: result.delayedInfo?.product,
                        scheduledTime: result.delayedInfo?.scheduledTime,
                        currentStatus: result.delayedInfo?.currentStatus,
                        status: "Queued (30 min)"
                    }] : [],
                    updatedCount: result.success && !result.delayed ? 1 : 0,
                    failedCount: !result.success && !result.delayed ? 1 : 0,
                    delayedCount: result.delayed ? 1 : 0
                };

                console.log(`One-by-one result:`, results);
                return res.json(results);

            } catch (error) {
                console.error('Error in one-by-one processing:', error);
                return res.json({
                    successful: [],
                    failed: [{
                        trackingNumber: uniqueTrackingNumbers[0],
                        result: 'Error: ' + error.message,
                        status: "Error"
                    }],
                    delayed: [],
                    updatedCount: 0,
                    failedCount: 1,
                    delayedCount: 0
                });
            }
        }

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
            delayed: [],
            duplicate: [], // Make sure this array exists
            updatedCount: 0,
            failedCount: 0,
            delayedCount: 0,
            duplicateCount: 0 // Make sure this count exists
        });

        // Send immediate response
        res.json({
            jobId: jobId,
            status: 'queued',
            message: 'Job accepted and queued for processing',
            totalJobs: uniqueTrackingNumbers.length
        });

        // Start processing in background
        setTimeout(() => {
            processJobsInBackground(jobId, {
                updateCode,
                mawbNum,
                warehouse,
                trackingNumbers: uniqueTrackingNumbers,
                req
            }, {
                batchSize: 10,
                batchDelay: 500
            });
        }, 100);

    } catch (error) {
        console.error('Error in update job route:', error);
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
// ⚡ SIMPLE OPTIMIZED IIW PROCESSING
// ==================================================

// Simple cache for job details
const simpleJobCache = new Map();

// Optimized batch processing for IIW
async function processSimpleIIWBatch(trackingNumbers, warehouse, req, mawbNum = null) {
    console.log(`⚡ Processing ${trackingNumbers.length} items in optimized batch`);

    const results = {
        successful: [],
        failed: [],
        delayed: [],
        duplicate: [],
        updatedCount: 0,
        failedCount: 0,
        delayedCount: 0,
        duplicateCount: 0
    };

    try {
        // Process items in batches of 5 (for API limits)
        const BATCH_SIZE = 5;

        for (let i = 0; i < trackingNumbers.length; i += BATCH_SIZE) {
            const batch = trackingNumbers.slice(i, i + BATCH_SIZE);
            console.log(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(trackingNumbers.length / BATCH_SIZE)}`);

            // Process batch items in parallel
            const batchPromises = batch.map(trackingNumber =>
                processSingleIIWItem(trackingNumber, warehouse, req, mawbNum)
            );

            const batchResults = await Promise.allSettled(batchPromises);

            // Process batch results
            batchResults.forEach((result, index) => {
                const trackingNumber = batch[index];

                if (result.status === 'fulfilled' && result.value) {
                    const itemResult = result.value;

                    if (itemResult.success) {
                        results.successful.push({
                            trackingNumber: trackingNumber,
                            result: itemResult.message,
                            customerName: itemResult.customerName || 'Unknown',
                            area: itemResult.area || 'N/A',
                            warehouse: warehouse,
                            product: itemResult.product || 'Unknown',
                            status: "Updated"
                        });
                        results.updatedCount++;
                    } else if (itemResult.delayed) {
                        results.delayed.push({
                            trackingNumber: trackingNumber,
                            result: itemResult.message,
                            status: "Delayed"
                        });
                        results.delayedCount++;
                    } else {
                        results.failed.push({
                            trackingNumber: trackingNumber,
                            result: itemResult.message || 'Failed',
                            status: "Failed"
                        });
                        results.failedCount++;
                    }
                } else {
                    results.failed.push({
                        trackingNumber: trackingNumber,
                        result: 'Processing error',
                        status: "Error"
                    });
                    results.failedCount++;
                }
            });

            // Small delay between batches
            if (i + BATCH_SIZE < trackingNumbers.length) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        // Simple grouping by customer name
        if (results.successful.length > 0) {
            results.groupedByCustomer = groupByCustomerSimple(results.successful);
        }

        console.log(`✅ Batch complete: ${results.updatedCount} updated, ${results.failedCount} failed`);

    } catch (error) {
        console.error('Batch processing error:', error);
        results.error = error.message;
    }

    return results;
}

// Process single IIW item (optimized)
async function processSingleIIWItem(trackingNumber, warehouse, req, mawbNum = null) {
    try {
        // Check cache first
        const cacheKey = `job_${trackingNumber}`;
        let jobData = simpleJobCache.get(cacheKey);

        if (!jobData) {
            jobData = await getJobDetails(trackingNumber);
            if (jobData) {
                // Cache for 10 seconds
                simpleJobCache.set(cacheKey, jobData);
                setTimeout(() => simpleJobCache.delete(cacheKey), 10000);
            }
        }

        if (!jobData) {
            return { success: false, message: 'Job not found' };
        }

        // Call existing processing logic but skip initial fetch
        const result = await processItemInWarehouseUpdate(trackingNumber, warehouse, req, mawbNum);
        return result;

    } catch (error) {
        console.error(`Error processing ${trackingNumber}:`, error.message);
        return { success: false, message: 'Error: ' + error.message };
    }
}

// Simple customer grouping
function groupByCustomerSimple(items) {
    const groups = {};

    items.forEach(item => {
        const customerName = item.customerName || 'Unknown';

        if (!groups[customerName]) {
            groups[customerName] = {
                customerName: customerName,
                trackingNumbers: [],
                count: 0,
                areas: new Set(),
                products: new Set()
            };
        }

        groups[customerName].trackingNumbers.push(item.trackingNumber);
        groups[customerName].count++;
        if (item.area) groups[customerName].areas.add(item.area);
        if (item.product) groups[customerName].products.add(item.product);
    });

    // Convert to array and format
    return Object.values(groups).map(group => ({
        customerName: group.customerName,
        trackingNumbers: group.trackingNumbers,
        count: group.count,
        areas: Array.from(group.areas),
        products: Array.from(group.products),
        areasString: Array.from(group.areas).join(', '),
        productsString: Array.from(group.products).join(', ')
    }));
}

// New endpoint for optimized processing
app.post('/updateJob/optimizedIIW', ensureAuthenticated, async (req, res) => {
    try {
        const { warehouse, trackingNumbers, mawbNum } = req.body;

        if (!warehouse) {
            return res.status(400).json({ error: 'Warehouse is required' });
        }

        if (!trackingNumbers || trackingNumbers.length === 0) {
            return res.status(400).json({ error: 'Tracking numbers are required' });
        }

        // Clean input
        const cleanTrackingNumbers = trackingNumbers
            .map(num => num.trim())
            .filter(num => num !== '');

        const uniqueTrackingNumbers = [...new Set(cleanTrackingNumbers)];

        if (uniqueTrackingNumbers.length === 0) {
            return res.status(400).json({ error: 'No valid tracking numbers' });
        }

        // Generate job ID
        const jobId = generateJobId();

        // Store job
        backgroundJobs.set(jobId, {
            status: 'queued',
            total: uniqueTrackingNumbers.length,
            processed: 0,
            startTime: Date.now()
        });

        // Immediate response
        res.json({
            jobId: jobId,
            status: 'queued',
            message: `Processing ${uniqueTrackingNumbers.length} items`,
            total: uniqueTrackingNumbers.length
        });

        // Process in background
        setTimeout(async () => {
            try {
                const results = await processSimpleIIWBatch(uniqueTrackingNumbers, warehouse, req, mawbNum);

                // Update job
                backgroundJobs.set(jobId, {
                    ...results,
                    status: 'completed',
                    completedAt: Date.now()
                });

            } catch (error) {
                console.error(`Job ${jobId} error:`, error);
                backgroundJobs.set(jobId, {
                    status: 'failed',
                    error: error.message,
                    failedAt: Date.now()
                });
            }
        }, 100);

    } catch (error) {
        console.error('Optimized IIW error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Server error', message: error.message });
        }
    }
});

function createDetrackUpdateData(trackingNumber, mawbNum, product, jobData, isIIW = false) {
    // Calculate common fields
    const finalArea = getAreaFromAddress(jobData.address);
    const finalPhoneNum = processPhoneNumber(jobData.phone_number);
    const finalAdditionalPhoneNum = processPhoneNumber(jobData.other_phone_numbers);

    console.log(`📝 Creating Detrack update data for:`);
    console.log(`   Tracking: ${trackingNumber}`);
    console.log(`   MAWB: ${mawbNum}`);
    console.log(`   Product: ${product}`);
    console.log(`   Is IIW: ${isIIW}`);

    // Base update data - same structure for all products
    const updateData = {
        do_number: trackingNumber,
        data: {
            run_number: mawbNum,
            zone: finalArea,
            phone_number: finalPhoneNum,
            other_phone_numbers: finalAdditionalPhoneNum,
            job_type: "Standard",
            job_owner: product.toUpperCase()
        }
    };

    // Set defaults for IIW updates
    if (isIIW) {
        updateData.data.payment_mode = "NON COD";
        updateData.data.total_price = 0;
        updateData.data.payment_amount = 0;
    }
    // For UAN updates, determine based on product
    else {
        console.log(`💰 Payment rules for product: ${product}`);
        switch (product) {
            case 'ewe':
                if (jobData.payment_mode === "COD") {
                    updateData.data.payment_mode = "Cash";
                    updateData.data.total_price = jobData.payment_amount || 0;
                    updateData.data.payment_amount = jobData.payment_amount || 0;
                } else {
                    updateData.data.payment_mode = "NON COD";
                    updateData.data.total_price = 0;
                    updateData.data.payment_amount = 0;
                }
                break;

            case 'pdu':
            case 'mglobal':
            case 'gdex':
            case 'gdext':
            default:
                updateData.data.payment_mode = "NON COD";
                updateData.data.total_price = 0;
                updateData.data.payment_amount = 0;
                break;
        }
    }

    // Special case: PDU job_owner should be "PDU" not "PDU"
    if (product === 'pdu') {
        updateData.data.job_owner = "PDU";
    }

    // Special case: MGLOBAL job_owner should be "MGLOBAL"
    if (product === 'mglobal') {
        updateData.data.job_owner = "MGLOBAL";
    }

    console.log(`✅ Created Detrack update data with job_owner: ${updateData.data.job_owner}`);
    return updateData;
}

// ==================================================
// 📁 Excel Upload Route for UAN (Excel/CSV)
// ==================================================

// Serve the Excel upload page
app.get('/updateJob/excelUpload', ensureAuthenticated, (req, res) => {
    res.render('updateJobExcel', { user: req.user });
});

app.post('/updateJob/excelUpload', ensureAuthenticated, upload.single('excelFile'), async (req, res) => {
    try {
        console.log('📥 Excel upload request received');

        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded',
                message: 'Please select a file to upload'
            });
        }

        // Get MAWB from form data
        const mawbNum = req.body.mawbNum;
        if (!mawbNum || mawbNum.trim() === '') {
            return res.status(400).json({
                error: 'MAWB Number required',
                message: 'MAWB Number is required for Excel upload'
            });
        }

        console.log(`📦 Processing Excel for MAWB: ${mawbNum}`);

        const file = req.file;
        console.log(`📁 File: ${file.originalname}, ${file.size} bytes`);

        // Parse file
        let data = [];
        const fileExt = file.originalname.split('.').pop().toLowerCase();

        if (fileExt === 'csv') {
            data = await parseCSVBuffer(file.buffer);
        } else if (fileExt === 'xlsx' || fileExt === 'xls') {
            data = await parseExcelBuffer(file.buffer);
        } else {
            return res.status(400).json({
                error: 'Unsupported file type',
                message: 'Please upload Excel (.xlsx, .xls) or CSV (.csv) files only'
            });
        }

        console.log(`📈 Parsed ${data.length} rows from file`);

        if (data.length === 0) {
            return res.status(400).json({
                error: 'Empty file',
                message: 'The file contains no data'
            });
        }

        // Check for required column
        const firstRow = data[0];
        const headers = Object.keys(firstRow);

        if (!headers.includes('Tracking Number')) {
            return res.status(400).json({
                error: 'Missing required column',
                message: 'File must contain "Tracking Number" column',
                found: headers
            });
        }

        // Process data - ONLY tracking numbers now
        const trackingNumbers = [];
        const additionalData = [];

        data.forEach((row, index) => {
            const trackingNumber = row['Tracking Number']?.toString().trim();
            const postalCode = row['Postal Code']?.toString().trim();
            const parcelWeight = row['Parcel Weight']?.toString().trim();

            if (trackingNumber) {
                trackingNumbers.push(trackingNumber);
                additionalData.push({
                    trackingNumber,
                    postalCode: postalCode || null,
                    parcelWeight: parcelWeight || null,
                    rowNumber: index + 1
                });
            }
        });

        if (trackingNumbers.length === 0) {
            return res.status(400).json({
                error: 'No valid data',
                message: 'No valid tracking numbers found in the file'
            });
        }

        console.log(`✅ Found ${trackingNumbers.length} valid tracking numbers for MAWB: ${mawbNum}`);

        // Generate job ID
        const jobId = generateJobId();

        // Store job data
        backgroundJobs.set(jobId, {
            status: 'queued',
            total: trackingNumbers.length,
            processed: 0,
            successful: [],
            failed: [],
            updatedCount: 0,
            failedCount: 0,
            startTime: Date.now(),
            uploadType: 'excel',
            mawbNum: mawbNum.trim(),
            data: additionalData,
            fileName: file.originalname,
            retryCount: 0 // Add retry tracking
        });

        console.log(`✅ Job created: ${jobId} with ${trackingNumbers.length} records for MAWB: ${mawbNum}`);

        // Send immediate response
        res.json({
            jobId: jobId,
            status: 'queued',
            message: `File uploaded successfully. Processing ${trackingNumbers.length} tracking numbers for MAWB: ${mawbNum}`,
            totalJobs: trackingNumbers.length,
            mawbNum: mawbNum,
            fileName: file.originalname
        });

        // Start background processing with retry logic
        setTimeout(() => {
            processExcelUploadWithRetry(jobId, mawbNum.trim(), additionalData, req);
        }, 100);

    } catch (error) {
        console.error('❌ Excel upload error:', error);
        res.status(500).json({
            error: 'File processing failed',
            message: error.message
        });
    }
});

// ==================================================
// 📊 File Parsing Helper Functions
// ==================================================

function parseExcelBuffer(buffer) {
    try {
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        return xlsx.utils.sheet_to_json(worksheet);
    } catch (error) {
        console.error('Error parsing Excel:', error);
        throw new Error('Failed to parse Excel file. Please check the file format.');
    }
}

function parseCSVBuffer(buffer) {
    return new Promise((resolve, reject) => {
        const results = [];
        const stream = require('stream');
        const bufferStream = new stream.PassThrough();
        bufferStream.end(buffer);

        bufferStream
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => {
                console.error('Error parsing CSV:', error);
                reject(new Error('Failed to parse CSV file. Please check the file format.'));
            });
    });
}

// Add this function near other helper functions
function getGDEXHoldReasonDetails(reasonCode) {
    const reasonMap = {
        'H9': {
            code: 'H9',
            description: 'Reject By Airport',
            gdexStatusCode: 'K',
            gdexStatusDescription: 'Hold',
            locationDescription: 'Brunei Customs'
        },
        'H18': {
            code: 'H18',
            description: 'DG Shipment',
            gdexStatusCode: 'K',
            gdexStatusDescription: 'Hold',
            locationDescription: 'Brunei Customs'
        },
        'H19': {
            code: 'H19',
            description: 'Prohibited Shipment',
            gdexStatusCode: 'K',
            gdexStatusDescription: 'Hold',
            locationDescription: 'Brunei Customs'
        },
        'H27': {
            code: 'H27',
            description: 'Pending Custom Declaration',
            gdexStatusCode: 'K',
            gdexStatusDescription: 'Hold',
            locationDescription: 'Brunei Customs'
        },
        'H31': {
            code: 'H31',
            description: 'Shipment rejected/confiscated by customs',
            gdexStatusCode: 'K',
            gdexStatusDescription: 'Hold',
            locationDescription: 'Brunei Customs'
        }
    };

    return reasonMap[reasonCode] || {
        code: reasonCode,
        description: 'Hold',
        gdexStatusCode: 'K',
        gdexStatusDescription: 'Hold',
        locationDescription: 'Brunei Customs'
    };
}

async function processGDEXHoldUpdate(trackingNumber, holdCode, req) {
    try {
        console.log(`🔍 Starting GDEX Hold update for ${trackingNumber} with code ${holdCode}`);

        // Get reason details
        const reasonDetails = getGDEXHoldReasonDetails(holdCode);

        // 1. Check if job exists in Detrack
        const jobExists = await checkJobExists(trackingNumber);
        console.log(`📊 Job exists check for ${trackingNumber}: ${jobExists}`);

        if (!jobExists) {
            console.log(`❌ Job ${trackingNumber} not found in Detrack`);
            return { success: false, message: 'Job not found in Detrack' };
        }

        // 2. Get job details from Detrack
        const jobData = await getJobDetails(trackingNumber);
        if (!jobData) {
            console.log(`❌ Could not get job details for ${trackingNumber}`);
            return { success: false, message: 'Could not get job details' };
        }

        console.log(`📋 Job details for ${trackingNumber}:`, {
            status: jobData.status,
            run_number: jobData.run_number,
            group_name: jobData.group_name,
            job_owner: jobData.job_owner
        });

        // 3. Check conditions: status must be 'info_recv' and run_number must not be null
        if (jobData.status !== 'info_recv' && jobData.status !== 'info_received') {
            console.log(`❌ Job status is not 'info_recv' or 'info_received' for ${trackingNumber}`);
            return {
                success: false,
                message: `Job status is "${jobData.status}", must be "info_recv" or "info_received"`
            };
        }

        if (!jobData.run_number || jobData.run_number.trim() === '') {
            console.log(`❌ Job run_number is null or empty for ${trackingNumber}`);
            return {
                success: false,
                message: 'Job run_number (MAWB) is required for GDEX Hold update'
            };
        }

        // 4. Check product type - MUST be GDEX/GDEXT only
        const { currentProduct } = getProductInfo(jobData.group_name, jobData.job_owner);
        const gdexProducts = ['gdex', 'gdext'];

        if (!currentProduct || !gdexProducts.includes(currentProduct.toLowerCase())) {
            console.log(`❌ Product "${currentProduct}" not allowed for GDEX Hold update. Only GDEX/GDEXT allowed.`);
            return {
                success: false,
                message: `Product "${currentProduct}" not allowed. Use GDEX Hold flow for GDEX/GDEXT products only.`
            };
        }

        console.log(`✅ Product "${currentProduct}" allowed for GDEX Hold update`);

        // 5. Update MongoDB
        const mongoSuccess = await updateMongoForGDEXHold(trackingNumber, currentProduct, req, reasonDetails);
        if (!mongoSuccess) {
            console.log(`❌ MongoDB update failed for ${trackingNumber}`);
            return { success: false, message: 'MongoDB update failed' };
        }

        // 6. Update Detrack
        const detrackSuccess = await updateDetrackForOnHold(trackingNumber);
        if (!detrackSuccess) {
            console.log(`❌ Detrack update failed for ${trackingNumber}`);
            return { success: false, message: 'Detrack update failed' };
        }

        // 7. Update GDEX with new status code "K" and specific reason code
        const gdexSuccess = await updateGDEXForGDEXHold(trackingNumber, reasonDetails);
        if (!gdexSuccess) {
            console.log(`⚠️ GDEX update failed for ${trackingNumber}, but other updates succeeded`);
            // Continue with success as MongoDB and Detrack succeeded
        }

        console.log(`✅ All GDEX Hold updates completed successfully for ${trackingNumber} with reason: ${reasonDetails.description}`);
        return {
            success: true,
            message: `GDEX Hold: ${reasonDetails.description}`
        };

    } catch (error) {
        console.error(`❌ Error in GDEX Hold update for ${trackingNumber}:`, error);
        return { success: false, message: 'Error: ' + error.message };
    }
}

async function updateMongoForGDEXHold(trackingNumber, product, req, reasonDetails) {
    try {
        const order = await ORDERS.findOne({ doTrackingNumber: trackingNumber });

        if (!order) {
            console.log(`📦 Order not found in MongoDB for ${trackingNumber}`);
            return false;
        }

        console.log(`📦 Updating existing order for ${trackingNumber}`);
        console.log(`   - Current Status: ${order.currentStatus}`);
        console.log(`   - Product: ${order.product}`);
        console.log(`   - Reason: ${reasonDetails.description}`);

        // Create the update object as per your requirements
        const updateOperations = {
            $set: {
                currentStatus: "On Hold",                       // Changed to "On Hold"
                lastUpdateDateTime: moment().format(),
                latestLocation: "Brunei Customs",
                lastUpdatedBy: req.user.name,
                latestReason: reasonDetails.description         // e.g., "Reject By Airport"
            },
            $push: {
                history: {
                    statusHistory: "On Hold",                   // Changed to "On Hold"
                    dateUpdated: moment().format(),
                    updatedBy: req.user.name,
                    lastLocation: "Brunei Customs",
                    reason: reasonDetails.description           // e.g., "Reject By Airport"
                }
            }
        };

        console.log('📝 MongoDB Update Operations:');
        console.log(JSON.stringify(updateOperations, null, 2));

        const result = await ORDERS.updateOne(
            { doTrackingNumber: trackingNumber },
            updateOperations
        );

        console.log(`✅ MongoDB update result for ${trackingNumber}:`, result);

        if (result.modifiedCount > 0) {
            console.log(`✅ MongoDB updated for GDEX Hold: ${trackingNumber}`);
            return true;
        } else {
            console.log(`⚠️ No document modified for ${trackingNumber}`);
            return false;
        }

    } catch (error) {
        console.error(`❌ MongoDB update error for ${trackingNumber}:`, error);
        return false;
    }
}

async function updateGDEXForGDEXHold(trackingNumber, reasonDetails) {
    try {
        console.log(`🔄 Sending GDEX update for Hold (Status K) with reason ${reasonDetails.code}: ${trackingNumber}`);

        const gdexSuccess = await updateGDEXStatus(
            trackingNumber,
            'custom',
            null,                           // detrackData not needed
            reasonDetails.gdexStatusCode,   // "K" (not "AQ")
            reasonDetails.gdexStatusDescription, // "Hold" (fixed)
            reasonDetails.locationDescription, // "Brunei Customs" (fixed)
            reasonDetails.code,             // reasoncode: H9, H18, H19, H27, H31
            "",                             // epod (empty)
            false                           // returnflag = false
        );

        if (gdexSuccess) {
            console.log(`✅ GDEX Hold update sent for ${trackingNumber} (Status: K, Reason: ${reasonDetails.code})`);
        } else {
            console.log(`❌ GDEX Hold update failed for ${trackingNumber}`);
        }

        return gdexSuccess;

    } catch (error) {
        console.error(`❌ GDEX Hold update error for ${trackingNumber}:`, error);
        return false;
    }
}

// ==================================================
// 🔧 Updated UAN Processing with Additional Fields
// ==================================================

async function updateOrCreateOrderWithAdditionalFields(trackingNumber, mawbNum, postalCode, parcelWeight, jobData, req, product) {
    try {
        const existingOrder = await ORDERS.findOne({ doTrackingNumber: trackingNumber });

        const updateFields = {
            mawbNo: mawbNum,
            lastUpdateDateTime: moment().format(),
            lastUpdatedBy: req.user.name
        };

        // Add postal code if provided
        if (postalCode) {
            updateFields.receiverPostalCode = postalCode.toUpperCase();
        }

        // Add parcel weight if provided
        if (parcelWeight) {
            updateFields.parcelWeight = parseFloat(parcelWeight) || 0;
        }

        if (existingOrder) {
            // Update existing order
            await ORDERS.updateOne(
                { doTrackingNumber: trackingNumber },
                { $set: updateFields }
            );
            console.log(`✅ Updated existing order with additional fields`);
        } else {
            // Create new order with product-specific rules (existing function)
            const success = await createNewOrderWithRules(jobData, trackingNumber, mawbNum, req, product);

            // Update the newly created order with additional fields
            if (success && (postalCode || parcelWeight)) {
                await ORDERS.updateOne(
                    { doTrackingNumber: trackingNumber },
                    { $set: updateFields }
                );
                console.log(`✅ Updated newly created order with additional fields`);
            }
            return success;
        }

        return true;

    } catch (error) {
        console.error(`❌ Error updating order with additional fields:`, error);
        return false;
    }
}

// ==================================================
// 🔄 UMN Processing Function (Manual Entry)
// ==================================================

async function processUMNUpdate(trackingNumber, mawbNum, req) {
    try {
        console.log(`\n🔄 ========== UMN UPDATE (Manual) ==========`);
        console.log(`📋 Tracking: ${trackingNumber}`);
        console.log(`📦 MAWB: ${mawbNum}`);

        // Check if order exists in MongoDB
        const existingOrder = await ORDERS.findOne({ doTrackingNumber: trackingNumber });

        if (!existingOrder) {
            console.log(`❌ Order ${trackingNumber} not found in MongoDB. Use UAN (Excel) to create new orders first.`);
            return false;
        }

        // Check if product is allowed for UMN updates
        const allowedProducts = ['mglobal', 'pdu', 'ewe', 'gdex', 'gdext'];
        if (!allowedProducts.includes(existingOrder.product)) {
            console.log(`❌ Product "${existingOrder.product}" not allowed for UMN update`);
            return false;
        }

        console.log(`✅ Product "${existingOrder.product}" allowed for UMN update`);

        // Get current job details from Detrack
        const jobData = await getJobDetails(trackingNumber);
        if (!jobData) {
            console.log(`❌ Job ${trackingNumber} not found in Detrack`);
            return false;
        }

        // Update MongoDB
        await ORDERS.updateOne(
            { doTrackingNumber: trackingNumber },
            {
                $set: {
                    mawbNo: mawbNum,
                    lastUpdateDateTime: moment().format(),
                    lastUpdatedBy: req.user.name
                }
            }
        );

        console.log(`✅ MongoDB updated`);

        // Update Detrack
        const updateData = createDetrackUpdateData(trackingNumber, mawbNum, existingOrder.product, jobData, false);

        const detrackResult = await sendDetrackUpdate(trackingNumber, updateData, mawbNum);

        console.log(`\n📊 FINAL RESULT:`);
        console.log(`   ├── MongoDB: ✅ Updated existing order`);
        console.log(`   ├── Detrack: ${detrackResult ? '✅ Success' : '❌ Failed'}`);
        console.log(`   └── Product: ${existingOrder.product.toUpperCase()}`);

        console.log(`\n🏁 ========== UMN UPDATE COMPLETE ==========\n`);

        return detrackResult;

    } catch (error) {
        console.error(`\n🔥 ERROR in UMN update:`, error);
        return false;
    }
}

// ==================================================
// 🔧 Update Processing Functions
// ==================================================

// Simplify processMAWBUpdate using the unified function
async function processMAWBUpdate(trackingNumber, mawbNum, req) {
    try {
        console.log(`\n📦 ========== STARTING MAWB UPDATE ==========`);
        console.log(`📋 Tracking: ${trackingNumber}`);
        console.log(`📦 MAWB: ${mawbNum}`);
        console.log(`👤 User: ${req.user.name}`);

        const jobExists = await checkJobExists(trackingNumber);
        console.log(`🔍 Job exists in Detrack: ${jobExists}`);

        if (!jobExists) {
            console.log(`❌ Job ${trackingNumber} not found in Detrack`);
            return false;
        }

        const jobData = await getJobDetails(trackingNumber);
        if (!jobData) {
            console.log(`❌ Could not get job details for ${trackingNumber}`);
            return false;
        }

        console.log(`\n📊 JOB DETAILS:`);
        console.log(`   ├── Status: ${jobData.status}`);
        console.log(`   ├── Run Number: ${jobData.run_number}`);
        console.log(`   ├── Group Name: ${jobData.group_name}`);
        console.log(`   ├── Job Owner: ${jobData.job_owner}`);
        console.log(`   ├── Payment Mode: ${jobData.payment_mode}`);
        console.log(`   └── Payment Amount: ${jobData.payment_amount}`);

        // Get product info
        const { currentProduct, senderName } = getProductInfo(jobData.group_name, jobData.job_owner);
        console.log(`\n🏷️  PRODUCT: ${currentProduct.toUpperCase()}`);

        // Validate product for UAN
        const allowedProducts = ['ewe', 'pdu', 'mglobal', 'gdex', 'gdext'];
        if (!allowedProducts.includes(currentProduct)) {
            console.log(`\n❌ PRODUCT NOT ALLOWED: ${currentProduct}`);
            console.log(`   └── Allowed: ${allowedProducts.join(', ')}`);
            return false;
        }

        // Check if order exists in MongoDB
        const existingOrder = await ORDERS.findOne({ doTrackingNumber: trackingNumber });

        if (existingOrder) {
            console.log(`\n📦 UPDATING EXISTING ORDER`);
            console.log(`   ├── Current MAWB: ${existingOrder.mawbNo || 'Empty'}`);
            console.log(`   └── Setting to: ${mawbNum}`);

            await ORDERS.updateOne(
                { doTrackingNumber: trackingNumber },
                { $set: { mawbNo: mawbNum } }
            );
            console.log(`✅ MongoDB updated`);
        } else {
            console.log(`\n🆕 CREATING NEW ORDER`);
            const success = await createNewOrderWithRules(jobData, trackingNumber, mawbNum, req, currentProduct);
            if (!success) return false;
        }

        // Create unified Detrack update
        console.log(`\n🔄 PREPARING DETRACK UPDATE:`);
        const updateData = createDetrackUpdateData(trackingNumber, mawbNum, currentProduct, jobData, false);

        console.log(`📤 Detrack Payload:`);
        console.log(JSON.stringify(updateData, null, 2));

        // Send Detrack update
        const detrackResult = await sendDetrackUpdate(trackingNumber, updateData, mawbNum);

        console.log(`\n📊 FINAL RESULT:`);
        console.log(`   ├── MongoDB: ✅ ${existingOrder ? 'Updated' : 'Created'}`);
        console.log(`   ├── Detrack: ${detrackResult ? '✅ Success' : '❌ Failed'}`);
        console.log(`   └── Product: ${currentProduct.toUpperCase()}`);

        console.log(`\n🏁 ========== MAWB UPDATE COMPLETE ==========\n`);

        return detrackResult;

    } catch (error) {
        console.error(`\n🔥 ERROR in MAWB update:`, error);
        return false;
    }
}

async function processCBSLFirstScan(trackingNumber, warehouse, req) {
    try {
        console.log(`\n🔄 ========== CBSL FIRST SCAN (Corrected Logic) ==========`);
        console.log(`📱 Scanned (do_number/parcelTrackingNum): ${trackingNumber}`);
        console.log(`🏪 Warehouse: ${warehouse}`);
        console.log(`👤 User: ${req.user.name}`);

        // Step 1: Look up in Detrack using do_number parameter (scanned number is do_number)
        console.log(`\n🔍 Step 1: Looking up in Detrack as do_number...`);
        let jobData;
        try {
            const response = await axios.get(
                `https://app.detrack.com/api/v2/dn/jobs/show/?do_number=${trackingNumber}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': apiKey
                    },
                    timeout: 10000
                }
            );

            if (response.data.data && response.data.data.do_number) {
                jobData = response.data.data;
                console.log(`✅ Found CBSL job in Detrack:`);
                console.log(`   - do_number (from Detrack): ${jobData.do_number}`);
                console.log(`   - tracking_number (from Detrack): ${jobData.tracking_number}`);
                console.log(`   - group_name: ${jobData.group_name}`);
                console.log(`   - status: ${jobData.status}`);

                // Validate it's CBSL
                if (!jobData.group_name || jobData.group_name.toLowerCase() !== 'cbsl') {
                    console.log(`❌ Not a CBSL job (group_name: ${jobData.group_name || 'unknown'})`);
                    return {
                        success: false,
                        message: `Not a CBSL job (${jobData.group_name || 'unknown'})`
                    };
                }
            } else {
                console.log(`❌ CBSL job not found in Detrack`);
                return {
                    success: false,
                    message: 'CBSL job not found in Detrack'
                };
            }
        } catch (error) {
            console.log(`❌ Detrack lookup failed:`, error.message);
            if (error.response?.status === 404) {
                return {
                    success: false,
                    message: 'CBSL job not found (404) - Make sure do_number is correct'
                };
            }
            return {
                success: false,
                message: 'Detrack lookup failed: ' + error.message
            };
        }

        // Step 2: Check if already in MongoDB (by parcelTrackingNum = scanned number)
        console.log(`\n📦 Step 2: Checking MongoDB by parcelTrackingNum...`);
        const existingOrder = await ORDERS.findOne({
            parcelTrackingNum: trackingNumber
        });

        if (existingOrder) {
            console.log(`✅ Order exists in MongoDB (parcelTrackingNum = scanned number):`);
            console.log(`   - _id: ${existingOrder._id}`);
            console.log(`   - doTrackingNumber: ${existingOrder.doTrackingNumber}`);
            console.log(`   - parcelTrackingNum: ${existingOrder.parcelTrackingNum}`);
            console.log(`   - warehouseEntry: ${existingOrder.warehouseEntry}`);
            console.log(`   - currentStatus: ${existingOrder.currentStatus}`);
            console.log(`   - product: ${existingOrder.product}`);

            if (existingOrder.warehouseEntry === "Yes") {
                console.log(`⚠️ Already scanned at warehouse`);
                return {
                    success: false,
                    message: 'Already scanned at warehouse',
                    alreadyScanned: true
                };
            }

            // Verify CBSL product
            if (existingOrder.product !== 'cbsl') {
                console.log(`⚠️ MongoDB product is "${existingOrder.product}", not "cbsl"`);
            }
        } else {
            console.log(`📝 Order not found by parcelTrackingNum, will create new entry`);

            // Also check by doTrackingNumber just in case
            const byDoTracking = await ORDERS.findOne({
                doTrackingNumber: trackingNumber
            });
            if (byDoTracking) {
                console.log(`ℹ️ Found by doTrackingNumber instead:`);
                console.log(`   - parcelTrackingNum: ${byDoTracking.parcelTrackingNum}`);
                console.log(`   - product: ${byDoTracking.product}`);
            }
        }

        // Step 3: Update or create in MongoDB
        console.log(`\n💾 Step 3: Updating MongoDB using parcelTrackingNum = scanned number...`);

        const updateData = {
            $set: {
                currentStatus: "At Warehouse",
                lastUpdateDateTime: moment().format(),
                warehouseEntry: "Yes",
                warehouseEntryDateTime: moment().format(),
                latestLocation: warehouse,
                lastUpdatedBy: req.user.name,
                // CBSL mapping:
                product: 'cbsl',
                senderName: 'CBSL',
                area: getAreaFromAddress(jobData.address),
                receiverName: jobData.deliver_to_collect_from || '',
                receiverAddress: jobData.address || '',
                receiverPhoneNumber: processPhoneNumber(jobData.phone_number),
                additionalPhoneNumber: processPhoneNumber(jobData.other_phone_numbers),
                creationDate: jobData.created_at || moment().format(),
                receiverPostalCode: jobData.postal_code ? jobData.postal_code.toUpperCase() : '',
                jobType: jobData.type || 'Delivery',
                jobMethod: "Standard",
                flightDate: jobData.job_received_date || '',
                mawbNo: jobData.run_number || '',
                parcelWeight: jobData.weight || 0,
                totalPrice: 0,
                paymentAmount: 0,
                paymentMethod: "NON COD",
                attempt: jobData.attempt || 1,
                remarks: jobData.remarks || '',
                trackingLink: jobData.tracking_link || ''
            },
            $push: {
                history: {
                    statusHistory: "At Warehouse",
                    dateUpdated: moment().format(),
                    updatedBy: req.user.name,
                    lastLocation: warehouse,
                }
            }
        };

        // Add items array
        const itemsArray = [];
        if (jobData.items && Array.isArray(jobData.items)) {
            jobData.items.forEach((item) => {
                itemsArray.push({
                    quantity: item.quantity || 0,
                    description: item.description || '',
                    totalItemPrice: 0
                });
            });
        }
        updateData.$set.items = itemsArray;

        const mongoResult = await ORDERS.updateOne(
            { parcelTrackingNum: trackingNumber }, // Match by parcelTrackingNum = scanned number
            updateData,
            { upsert: true }
        );

        console.log(`✅ MongoDB ${mongoResult.upsertedCount > 0 ? 'created' : 'updated'}:`);
        console.log(`   - Matched by parcelTrackingNum: ${mongoResult.matchedCount}`);
        console.log(`   - Modified: ${mongoResult.modifiedCount}`);
        console.log(`   - Upserted: ${mongoResult.upsertedCount}`);

        if (mongoResult.upsertedId) {
            console.log(`   - New document ID: ${mongoResult.upsertedId}`);
        }

        // Step 4: Update Detrack with SWAP logic
        console.log(`\n🔄 Step 4: Updating Detrack (with swap logic)...`);

        // CBSL needs both at_warehouse and in_sorting_area
        // First update: at_warehouse
        console.log(`📤 First update: at_warehouse`);

        const detrackUpdateData1 = {
            do_number: trackingNumber, // Scanned number (do_number)
            data: {
                status: "at_warehouse",
                // SWAP: tracking_number becomes do_number, do_number becomes tracking_number
                do_number: jobData.tracking_number, // Use tracking_number from Detrack
                tracking_number: trackingNumber // Scanned number becomes tracking_number
            }
        };

        console.log(`📤 Detrack payload 1 (at_warehouse):`);
        console.log(JSON.stringify(detrackUpdateData1, null, 2));

        let detrackSuccess1 = false;
        try {
            const detrackResponse1 = await axios.put(
                'https://app.detrack.com/api/v2/dn/jobs/update',
                detrackUpdateData1,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': apiKey
                    },
                    timeout: 10000
                }
            );

            console.log(`📥 Detrack response 1 status: ${detrackResponse1.status}`);
            detrackSuccess1 = detrackResponse1.data.success === true ||
                detrackResponse1.data.status === 'success' ||
                detrackResponse1.status === 200;

            if (detrackSuccess1) {
                console.log(`✅ Detrack at_warehouse update successful`);
            } else {
                console.log(`❌ Detrack at_warehouse update failed:`, JSON.stringify(detrackResponse1.data, null, 2));
            }
        } catch (detrackError1) {
            console.error(`❌ Detrack at_warehouse API error:`, detrackError1.message);
            if (detrackError1.response) {
                console.error(`❌ Response data:`, JSON.stringify(detrackError1.response.data, null, 2));
            }
        }

        // Second update: in_sorting_area (after short delay)
        console.log(`\n⏳ Waiting 1 second before in_sorting_area update...`);
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log(`📤 Second update: in_sorting_area`);

        const detrackUpdateData2 = {
            do_number: jobData.tracking_number, // Scanned number (do_number)
            data: {
                status: "in_sorting_area"
            }
        };

        console.log(`📤 Detrack payload 2 (in_sorting_area):`);
        console.log(JSON.stringify(detrackUpdateData2, null, 2));

        let detrackSuccess2 = false;
        try {
            const detrackResponse2 = await axios.put(
                'https://app.detrack.com/api/v2/dn/jobs/update',
                detrackUpdateData2,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': apiKey
                    },
                    timeout: 10000
                }
            );

            console.log(`📥 Detrack response 2 status: ${detrackResponse2.status}`);
            detrackSuccess2 = detrackResponse2.data.success === true ||
                detrackResponse2.data.status === 'success' ||
                detrackResponse2.status === 200;

            if (detrackSuccess2) {
                console.log(`✅ Detrack in_sorting_area update successful`);
            } else {
                console.log(`❌ Detrack in_sorting_area update failed:`, JSON.stringify(detrackResponse2.data, null, 2));
            }
        } catch (detrackError2) {
            console.error(`❌ Detrack in_sorting_area API error:`, detrackError2.message);
            if (detrackError2.response) {
                console.error(`❌ Response data:`, JSON.stringify(detrackError2.response.data, null, 2));
            }
        }

        const detrackSuccess = detrackSuccess1 && detrackSuccess2;

        if (detrackSuccess) {
            console.log(`\n✅ All Detrack updates successful`);
        } else {
            console.log(`\n⚠️ Some Detrack updates may have failed`);
        }

        console.log(`\n🏁 ========== CBSL SCAN COMPLETE ==========\n`);

        return {
            success: true,
            message: `CBSL item scanned at ${warehouse}`,
            customerName: jobData.deliver_to_collect_from || 'Unknown',
            area: getAreaFromAddress(jobData.address),
            isNewOrder: mongoResult.upsertedCount > 0,
            detrackUpdates: {
                at_warehouse: detrackSuccess1,
                in_sorting_area: detrackSuccess2
            },
            cbslInfo: {
                scannedNumber: trackingNumber,
                detrack_do_number: jobData.do_number,
                detrack_tracking_number: jobData.tracking_number,
                mongo_doTrackingNumber: trackingNumber,
                mongo_parcelTrackingNum: trackingNumber
            }
        };

    } catch (error) {
        console.error(`\n🔥 ERROR in CBSL processing:`, error);
        console.error(error.stack);
        return {
            success: false,
            message: 'Error: ' + error.message
        };
    }
}

// ==================================================
// 🔍 MAWB Validation Routes
// ==================================================

// Validate MAWB number before processing
app.post('/updateJob/validateMAWB', ensureAuthenticated, async (req, res) => {
    try {
        const { mawbNum } = req.body;

        if (!mawbNum || mawbNum.trim() === '') {
            return res.json({
                exists: false,
                message: 'MAWB number is empty'
            });
        }

        console.log(`🔍 Validating MAWB: ${mawbNum}`);

        // Find all orders with this MAWB number
        const orders = await ORDERS.find({
            mawbNo: mawbNum.trim().toUpperCase(),
            product: { $in: ['ewe', 'pdu', 'mglobal', 'gdex', 'gdext'] } // Only allowed products
        }).select('doTrackingNumber warehouseEntry currentStatus product');

        if (!orders || orders.length === 0) {
            return res.json({
                exists: false,
                message: 'No orders found with this MAWB number'
            });
        }

        // Calculate stats
        const totalJobs = orders.length;
        const scannedJobs = orders.filter(order => order.warehouseEntry === "Yes").length;
        const unscannedJobs = totalJobs - scannedJobs;

        // Get tracking numbers for this MAWB
        const trackingNumbers = orders.map(order => order.doTrackingNumber);

        res.json({
            exists: true,
            mawbNum: mawbNum.trim().toUpperCase(),
            totalJobs,
            scannedJobs,
            unscannedJobs,
            trackingNumbers,
            orders: orders.map(order => ({
                trackingNumber: order.doTrackingNumber,
                warehouseEntry: order.warehouseEntry || 'No',
                currentStatus: order.currentStatus || 'Unknown',
                product: order.product || 'Unknown'
            }))
        });

    } catch (error) {
        console.error('Error validating MAWB:', error);
        res.status(500).json({
            error: 'Validation failed',
            message: error.message
        });
    }
});

// Check if tracking number belongs to a specific MAWB
app.post('/updateJob/checkTrackingForMAWB', ensureAuthenticated, async (req, res) => {
    try {
        const { trackingNumber, mawbNum } = req.body;

        if (!trackingNumber || !mawbNum) {
            return res.status(400).json({
                error: 'Tracking number and MAWB number are required'
            });
        }

        const order = await ORDERS.findOne({
            doTrackingNumber: trackingNumber.trim(),
            mawbNo: mawbNum.trim().toUpperCase()
        }).select('warehouseEntry currentStatus product mawbNo');

        if (!order) {
            return res.json({
                belongsToMAWB: false,
                message: 'Tracking number does not belong to this MAWB group'
            });
        }

        res.json({
            belongsToMAWB: true,
            warehouseEntry: order.warehouseEntry || 'No',
            currentStatus: order.currentStatus || 'Unknown',
            product: order.product || 'Unknown',
            mawbNo: order.mawbNo
        });

    } catch (error) {
        console.error('Error checking tracking for MAWB:', error);
        res.status(500).json({
            error: 'Check failed',
            message: error.message
        });
    }
});

// ==================================================
// 🔍 Get MAWBs with Unscanned Counts (Only if unscanned > 0)
// ==================================================

app.get('/updateJob/recentMAWBs', ensureAuthenticated, async (req, res) => {
    try {
        console.log('🔍 Fetching MAWBs with unscanned counts...');

        // Get date 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Aggregate to get MAWB stats - only show MAWBs with unscanned jobs
        // Update the unscannedJobs calculation in the aggregation
        // Update the aggregation pipeline in /updateJob/recentMAWBs route
        const mawbStats = await ORDERS.aggregate([
            {
                $match: {
                    mawbNo: {
                        $exists: true,
                        $ne: '',
                        $nin: [null, '', 'N/A', 'NA']
                    },
                    lastUpdateDateTime: { $gte: thirtyDaysAgo.toISOString() },
                    product: {
                        $in: ['pdu', 'mglobal', 'ewe', 'gdex', 'gdext']
                    },
                    // ADD: Filter for jobs that need scanning
                    $or: [
                        { currentStatus: "Info Received" },
                        { currentStatus: "Custom Clearing" },
                        {
                            $and: [
                                { currentStatus: "On Hold" },
                                { warehouseEntry: "No" }
                            ]
                        }
                    ]
                }
            },
            {
                $group: {
                    _id: '$mawbNo',
                    totalJobs: { $sum: 1 },
                    // NEW LOGIC: Count by status categories
                    infoReceivedJobs: {
                        $sum: {
                            $cond: [{ $eq: ['$currentStatus', 'Info Received'] }, 1, 0]
                        }
                    },
                    customClearingJobs: {
                        $sum: {
                            $cond: [{ $eq: ['$currentStatus', 'Custom Clearing'] }, 1, 0]
                        }
                    },
                    onHoldUnscannedJobs: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$currentStatus', 'On Hold'] },
                                        { $eq: ['$warehouseEntry', 'No'] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    atWarehouseJobs: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$warehouseEntry', 'Yes'] },
                                        { $eq: ['$currentStatus', 'At Warehouse'] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    inSortingAreaJobs: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$warehouseEntry', 'Yes'] },
                                        { $eq: ['$currentStatus', 'In Sorting Area'] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    onHoldScannedJobs: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$currentStatus', 'On Hold'] },
                                        { $eq: ['$warehouseEntry', 'Yes'] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    latestUpdate: { $max: '$lastUpdateDateTime' },
                    product: { $first: '$product' },
                    sampleTracking: { $first: '$doTrackingNumber' }
                }
            },
            {
                // Calculate unscanned jobs
                $addFields: {
                    unscannedJobs: {
                        $add: [
                            '$infoReceivedJobs',
                            '$customClearingJobs',
                            '$onHoldUnscannedJobs'
                        ]
                    },
                    scannedJobs: {
                        $add: [
                            '$atWarehouseJobs',
                            '$inSortingAreaJobs',
                            '$onHoldScannedJobs'
                        ]
                    }
                }
            },
            {
                // Only include MAWBs with unscanned jobs
                $match: {
                    unscannedJobs: { $gt: 0 }
                }
            },
            {
                $project: {
                    mawbNo: '$_id',
                    totalJobs: 1,
                    unscannedJobs: 1,
                    scannedJobs: 1,
                    // Detailed breakdown for frontend
                    statusBreakdown: {
                        infoReceived: '$infoReceivedJobs',
                        customClearing: '$customClearingJobs',
                        onHoldUnscanned: '$onHoldUnscannedJobs',
                        atWarehouse: '$atWarehouseJobs',
                        inSortingArea: '$inSortingAreaJobs',
                        onHoldScanned: '$onHoldScannedJobs'
                    },
                    atWarehouseJobs: 1,
                    latestUpdate: 1,
                    product: 1,
                    sampleTracking: 1,
                    percentageUnscanned: {
                        $multiply: [
                            { $divide: ['$unscannedJobs', '$totalJobs'] },
                            100
                        ]
                    },
                    percentageScanned: {
                        $multiply: [
                            { $divide: ['$scannedJobs', '$totalJobs'] },
                            100
                        ]
                    }
                }
            },
            {
                $sort: {
                    unscannedJobs: -1,
                    latestUpdate: -1
                }
            },
            { $limit: 100 }
        ]);

        console.log(`📊 Found ${mawbStats.length} MAWBs with unscanned jobs`);

        if (mawbStats.length > 0) {
            console.log('Sample MAWBs:');
            mawbStats.slice(0, 5).forEach(mawb => {
                console.log(`   ${mawb.mawbNo}: ${mawb.unscannedJobs}/${mawb.totalJobs} Unscanned (${mawb.product})`);
            });
        }

        // Format for frontend
        // Format for frontend
        const formattedMAWBs = mawbStats.map(mawb => ({
            mawbNo: mawb.mawbNo,
            totalJobs: mawb.totalJobs,
            unscannedJobs: mawb.unscannedJobs,
            scannedJobs: mawb.scannedJobs || 0,
            atWarehouseJobs: mawb.atWarehouseJobs || 0,
            otherJobs: mawb.otherJobs || 0,
            product: mawb.product,
            sampleTracking: mawb.sampleTracking,
            lastUpdated: formatDateForDisplay(mawb.latestUpdate),
            percentageUnscanned: Math.round(mawb.percentageUnscanned || 0),
            percentageScanned: Math.round(mawb.percentageScanned || 0),
            // ADD status breakdown
            statusBreakdown: mawb.statusBreakdown || {
                infoReceived: 0,
                customClearing: 0,
                onHoldUnscanned: 0,
                atWarehouse: 0,
                inSortingArea: 0,
                onHoldScanned: 0
            }
        }));

        res.json({
            success: true,
            count: formattedMAWBs.length,
            mawbs: formattedMAWBs,
            summary: {
                totalMAWBs: formattedMAWBs.length,
                totalUnscannedJobs: formattedMAWBs.reduce((sum, m) => sum + m.unscannedJobs, 0),
                totalScannedJobs: formattedMAWBs.reduce((sum, m) => sum + m.scannedJobs, 0),
                totalAllJobs: formattedMAWBs.reduce((sum, m) => sum + m.totalJobs, 0)
            }
        });

    } catch (error) {
        console.error('❌ Error getting MAWBs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load MAWB numbers',
            message: error.message
        });
    }
});

// Helper function to format date
function formatDateForDisplay(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString || 'Unknown';
    }
}

// Simplify createNewOrderWithRules using consistent structure
async function createNewOrderWithRules(jobData, trackingNumber, mawbNum, req, product) {
    try {
        console.log(`\n🆕 CREATING ORDER FOR: ${product.toUpperCase()}`);

        // Process items array
        const itemsArray = [];
        if (jobData.items && Array.isArray(jobData.items)) {
            jobData.items.forEach((item, index) => {
                itemsArray.push({
                    quantity: item.quantity || 0,
                    description: item.description || '',
                    totalItemPrice: jobData.total_price || jobData.payment_amount || 0
                });
            });
        }

        // Calculate fields
        const finalArea = getAreaFromAddress(jobData.address);
        const finalPhoneNum = processPhoneNumber(jobData.phone_number);
        const finalAdditionalPhoneNum = processPhoneNumber(jobData.other_phone_numbers);
        const postalCode = jobData.postal_code ? jobData.postal_code.toUpperCase() : '';

        // Determine payment details based on product
        let paymentMethod = 'NON COD';
        let totalPrice = 0;
        let paymentAmount = 0;
        let senderName = product.toUpperCase();

        if (product === 'ewe' && jobData.payment_mode === "COD") {
            paymentMethod = "Cash";
            totalPrice = jobData.payment_amount || 0;
            paymentAmount = jobData.payment_amount || 0;
            senderName = jobData.job_owner || "EWE";
        } else if (product === 'ewe') {
            paymentMethod = "NON COD";
            totalPrice = jobData.total_price || 0;
            paymentAmount = 0;
            senderName = jobData.job_owner || "EWE";
        } else if (product === 'pdu') {
            senderName = jobData.job_owner || "PDU";
            totalPrice = jobData.total_price || 0;
            paymentAmount = jobData.payment_amount || 0;
            paymentMethod = jobData.payment_mode || 'NON COD';
        } else if (product === 'mglobal') {
            senderName = "MGLOBAL";
        } else if (product === 'gdex' || product === 'gdext') {
            senderName = jobData.job_owner || product.toUpperCase();
            totalPrice = jobData.total_price || 0;
            paymentAmount = jobData.payment_amount || 0;
            paymentMethod = jobData.payment_mode || 'NON COD';
        }

        console.log(`💰 PAYMENT DETAILS:`);
        console.log(`   ├── Method: ${paymentMethod}`);
        console.log(`   ├── Total Price: ${totalPrice}`);
        console.log(`   ├── Payment Amount: ${paymentAmount}`);
        console.log(`   └── Sender: ${senderName}`);

        // Create MongoDB order with consistent structure
        const mongoOrder = new ORDERS({
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
            product: product,
            senderName: senderName,
            totalPrice: totalPrice,
            paymentAmount: paymentAmount,
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

        // Save to MongoDB
        console.log(`💾 SAVING TO MONGODB...`);
        await mongoOrder.save();
        console.log(`✅ MongoDB order created`);

        return true;

    } catch (error) {
        console.error(`\n🔥 ERROR creating order:`, error);
        return false;
    }
}

async function createIIWOrderWithRules(jobData, trackingNumber, warehouse, req, product) {
    try {
        console.log(`\n🆕 CREATING IIW ORDER FOR: ${product.toUpperCase()}`);

        // Process items array
        const itemsArray = [];
        if (jobData.items && Array.isArray(jobData.items)) {
            jobData.items.forEach((item) => {
                itemsArray.push({
                    quantity: item.quantity || 0,
                    description: item.description || '',
                    totalItemPrice: jobData.total_price || jobData.payment_amount || 0
                });
            });
        }

        // Calculate fields
        const finalArea = getAreaFromAddress(jobData.address);
        const finalPhoneNum = processPhoneNumber(jobData.phone_number);
        const finalAdditionalPhoneNum = processPhoneNumber(jobData.other_phone_numbers);
        const postalCode = jobData.postal_code ? jobData.postal_code.toUpperCase() : '';

        // ========== UPDATED: PAYMENT LOGIC FOR PURE51, ICARUS, KPTDP ==========
        let paymentMethod = "NON COD";
        let totalPrice = 0;
        let paymentAmount = 0;
        let senderName = product.toUpperCase();

        // Category B products: pure51, icarus, kptdp
        const categoryBProducts = ['pure51', 'icarus', 'kptdp'];

        if (categoryBProducts.includes(product.toLowerCase())) {
            // Use payment_mode from Detrack (if available)
            if (jobData.payment_mode) {
                paymentMethod = jobData.payment_mode;
                console.log(`   💰 Using payment_mode from Detrack: ${paymentMethod}`);
            }

            // Priority: total_price first, then payment_amount, then 0
            if (jobData.total_price && parseFloat(jobData.total_price) > 0) {
                totalPrice = parseFloat(jobData.total_price);
                paymentAmount = parseFloat(jobData.total_price);
                console.log(`   💰 Using total_price: ${totalPrice}`);
            } else if (jobData.payment_amount && parseFloat(jobData.payment_amount) > 0) {
                totalPrice = parseFloat(jobData.payment_amount);
                paymentAmount = parseFloat(jobData.payment_amount);
                console.log(`   💰 Using payment_amount: ${paymentAmount}`);
            } else {
                totalPrice = 0;
                paymentAmount = 0;
                console.log(`   💰 No payment amount found, using 0`);
            }
        } else {
            // Original logic for other products (PDU, EWE, MGLOBAL, GDEX, etc.)
            if (product === 'pdu') {
                senderName = jobData.job_owner || "PDU";
                totalPrice = jobData.total_price || 0;
                paymentAmount = jobData.payment_amount || 0;
                paymentMethod = jobData.payment_mode || 'NON COD';
            } else if (product === 'mglobal') {
                senderName = "MGLOBAL";
                totalPrice = 0;
                paymentAmount = 0;
                paymentMethod = "NON COD";
            } else if (product === 'ewe') {
                senderName = jobData.job_owner || "EWE";
                if (jobData.payment_mode === "COD") {
                    paymentMethod = "Cash";
                    totalPrice = jobData.payment_amount || 0;
                    paymentAmount = jobData.payment_amount || 0;
                } else {
                    paymentMethod = "NON COD";
                    totalPrice = 0;
                    paymentAmount = 0;
                }
            } else if (product === 'gdex' || product === 'gdext') {
                senderName = jobData.job_owner || product.toUpperCase();
                totalPrice = jobData.total_price || 0;
                paymentAmount = jobData.payment_amount || 0;
                paymentMethod = jobData.payment_mode || 'NON COD';
            } else {
                // Default for other products
                totalPrice = 0;
                paymentAmount = 0;
                paymentMethod = "NON COD";
            }
        }

        console.log(`💰 FINAL PAYMENT DETAILS FOR ${product.toUpperCase()}:`);
        console.log(`   ├── Method: ${paymentMethod}`);
        console.log(`   ├── Total Price: ${totalPrice}`);
        console.log(`   ├── Payment Amount: ${paymentAmount}`);
        console.log(`   └── Sender: ${senderName}`);

        // Create MongoDB order (NO changes to Detrack updates)
        const mongoOrder = new ORDERS({
            area: finalArea,
            items: itemsArray,
            attempt: jobData.attempt || 1,
            history: [{
                statusHistory: "At Warehouse",
                dateUpdated: moment().format(),
                updatedBy: req.user.name,
                lastLocation: warehouse,
            }],
            latestLocation: warehouse,
            product: product,
            senderName: senderName,
            totalPrice: totalPrice,
            paymentAmount: paymentAmount,
            receiverName: jobData.deliver_to_collect_from || '',
            trackingLink: jobData.tracking_link || '',
            currentStatus: "At Warehouse",
            paymentMethod: paymentMethod,
            warehouseEntry: "Yes",
            warehouseEntryDateTime: moment().format(),
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
            mawbNo: jobData.run_number || '',
            parcelWeight: jobData.weight || 0
        });

        // Save to MongoDB
        console.log(`💾 SAVING IIW ORDER TO MONGODB...`);
        await mongoOrder.save();
        console.log(`✅ MongoDB IIW order created for ${product.toUpperCase()}`);

        // ========== KEEP DETRACK UPDATES EXACTLY THE SAME ==========
        // Category B products: pure51, icarus, kptdp - use same simple status updates
        const categoryBProductsForDetrack = ['pure51', 'icarus', 'kptdp'];

        if (categoryBProductsForDetrack.includes(product.toLowerCase())) {
            console.log(`\n🔄 CATEGORY B PRODUCT (${product.toUpperCase()}) - SIMPLE DETRACK STATUS UPDATES (UNCHANGED)`);

            let allUpdatesSuccessful = true;

            // Step 1: Update to at_warehouse (SAME AS BEFORE)
            console.log(`📤 Step 1: Updating Detrack to "at_warehouse"...`);
            const updateData1 = {
                do_number: trackingNumber,
                data: {
                    status: "at_warehouse"
                }
            };

            console.log('Payload:', JSON.stringify(updateData1, null, 2));

            try {
                const response1 = await axios.put(
                    'https://app.detrack.com/api/v2/dn/jobs/update',
                    updateData1,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-KEY': apiKey
                        },
                        timeout: 10000
                    }
                );

                const success1 = response1.data.success === true ||
                    response1.data.status === 'success' ||
                    response1.status === 200;

                if (success1) {
                    console.log(`✅ Step 1: Detrack updated to "at_warehouse"`);
                } else {
                    console.log(`❌ Step 1: Detrack update failed:`, response1.data);
                    allUpdatesSuccessful = false;
                }
            } catch (error) {
                console.error(`❌ Step 1 API error:`, error.message);
                allUpdatesSuccessful = false;
            }

            // Small delay between updates
            console.log(`⏳ Waiting 1 second before second update...`);
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Step 2: Update to in_sorting_area (SAME AS BEFORE)
            console.log(`📤 Step 2: Updating Detrack to "in_sorting_area"...`);
            const updateData2 = {
                do_number: trackingNumber,
                data: {
                    status: "in_sorting_area"
                }
            };

            console.log('Payload:', JSON.stringify(updateData2, null, 2));

            try {
                const response2 = await axios.put(
                    'https://app.detrack.com/api/v2/dn/jobs/update',
                    updateData2,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-KEY': apiKey
                        },
                        timeout: 10000
                    }
                );

                const success2 = response2.data.success === true ||
                    response2.data.status === 'success' ||
                    response2.status === 200;

                if (success2) {
                    console.log(`✅ Step 2: Detrack updated to "in_sorting_area"`);
                } else {
                    console.log(`❌ Step 2: Detrack update failed:`, response2.data);
                    allUpdatesSuccessful = false;
                }
            } catch (error) {
                console.error(`❌ Step 2 API error:`, error.message);
                allUpdatesSuccessful = false;
            }

            console.log(`\n📊 DETRACK UPDATE SUMMARY FOR ${product.toUpperCase()}:`);
            console.log(`   MongoDB: ✅ Created successfully with payment: ${paymentMethod} ${paymentAmount}`);
            console.log(`   Detrack: ${allUpdatesSuccessful ? '✅ Both updates successful' : '⚠️ Some updates failed'}`);

            if (allUpdatesSuccessful) {
                return {
                    success: true,
                    message: `${product.toUpperCase()} item scanned at ${warehouse}`,
                    isNewOrder: true,
                    customerName: jobData.deliver_to_collect_from || 'Unknown',
                    area: finalArea,
                    paymentMethod: paymentMethod,
                    paymentAmount: paymentAmount
                };
            } else {
                return {
                    success: false,
                    message: 'Some Detrack updates failed',
                    isNewOrder: true
                };
            }

        } else {
            // For other products (PDU, EWE, etc.) use original logic (UNCHANGED)
            console.log(`\n🔄 PREPARING DETRACK UPDATE FOR ${product.toUpperCase()}:`);
            const updateData = createDetrackUpdateData(trackingNumber, jobData.run_number || '', product, jobData, true);

            console.log('📤 Detrack Payload:', JSON.stringify(updateData, null, 2));

            const detrackResult = await sendDetrackUpdate(trackingNumber, updateData, jobData.run_number || '');

            console.log(`📊 DETRACK UPDATE RESULT: ${detrackResult ? '✅ Success' : '❌ Failed'}`);

            if (detrackResult) {
                return {
                    success: true,
                    message: `Item marked as at warehouse (${warehouse})`,
                    isNewOrder: true,
                    customerName: jobData.deliver_to_collect_from || 'Unknown',
                    area: finalArea
                };
            } else {
                return {
                    success: false,
                    message: 'Detrack update failed',
                    isNewOrder: true
                };
            }
        }

    } catch (error) {
        console.error(`\n🔥 ERROR creating IIW order:`, error);
        return {
            success: false,
            message: 'Error creating order: ' + error.message
        };
    }
}

async function sendDetrackUpdate(trackingNumber, updateData, mawbNum) {
    try {
        console.log(`Updating ${trackingNumber} with MAWB: ${mawbNum}`);
        console.log('Detrack update data:', JSON.stringify(updateData, null, 2));

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
            return true;
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
}

// In index.js, find the processOnHoldUpdate function and update it:
async function processOnHoldUpdate(trackingNumber, req) {
    try {
        console.log(`🔍 Starting On Hold update for ${trackingNumber}`);

        // 1. Check if job exists in Detrack
        const jobExists = await checkJobExists(trackingNumber);
        if (!jobExists) {
            console.log(`❌ Job ${trackingNumber} not found in Detrack`);
            return {
                success: false,
                message: 'Job not found in Detrack',
                code: 'DETRACK_NOT_FOUND'
            };
        }

        // 2. Get job details from Detrack
        const jobData = await getJobDetails(trackingNumber);
        if (!jobData) {
            console.log(`❌ Could not get job details for ${trackingNumber}`);
            return {
                success: false,
                message: 'Could not get job details',
                code: 'DETRACK_NO_DETAILS'
            };
        }

        console.log(`📋 Job details for ${trackingNumber}:`, {
            status: jobData.status,
            run_number: jobData.run_number,
            group_name: jobData.group_name,
            job_owner: jobData.job_owner
        });

        // 3. Check conditions: status must be 'info_recv' or 'info_received'
        if (jobData.status !== 'info_recv' && jobData.status !== 'info_received') {
            console.log(`❌ Job status is not 'info_recv' or 'info_received' for ${trackingNumber}`);
            return {
                success: false,
                message: `Job status is "${jobData.status}", must be "info_recv" or "info_received"`,
                code: 'INVALID_STATUS'
            };
        }

        // 4. Check if run_number (MAWB) exists
        if (!jobData.run_number || jobData.run_number.trim() === '') {
            console.log(`❌ Job run_number is null or empty for ${trackingNumber}`);
            return {
                success: false,
                message: 'Job run_number (MAWB) is required for On Hold update',
                code: 'MAWB_REQUIRED'
            };
        }

        // 5. Determine product type
        const { currentProduct } = getProductInfo(jobData.group_name, jobData.job_owner);
        const product = currentProduct.toLowerCase();
        const allowedProducts = ['pdu', 'mglobal', 'ewe'];

        // 6. Check if product is allowed
        if (!allowedProducts.includes(product)) {
            console.log(`❌ Product "${product}" not allowed for On Hold update`);
            return {
                success: false,
                message: `Product "${product.toUpperCase()}" not allowed. Only PDU, MGLOBAL, EWE allowed.`,
                code: 'PRODUCT_NOT_ALLOWED'
            };
        }

        // 7. CRITICAL: Check if order exists in MongoDB (MUST EXIST)
        const existingOrder = await ORDERS.findOne({
            doTrackingNumber: trackingNumber,
            product: product // Ensure product matches
        });

        if (!existingOrder) {
            console.log(`❌ Order ${trackingNumber} not found in MongoDB for product ${product}`);
            return {
                success: false,
                message: `Order not found. ${product.toUpperCase()} orders must be created via UAN (Excel) first.`,
                code: 'ORDER_NOT_FOUND',
                shouldUseUAN: true
            };
        }

        // 8. Check if already on hold
        if (existingOrder.currentStatus === "Custom Clearing" ||
            existingOrder.currentStatus === "On Hold") {
            console.log(`⚠️ Order ${trackingNumber} is already on hold`);
            return {
                success: false,
                message: 'Order is already on hold',
                code: 'ALREADY_ON_HOLD',
                alreadyOnHold: true
            };
        }

        // 9. Update MongoDB (existing logic - updateMongoForOnHold)
        const mongoSuccess = await updateMongoForOnHold(trackingNumber, product, req);
        if (!mongoSuccess) {
            console.log(`❌ MongoDB update failed for ${trackingNumber}`);
            return {
                success: false,
                message: 'MongoDB update failed',
                code: 'MONGO_FAILED'
            };
        }

        // 10. Update Detrack (existing logic - updateDetrackForOnHold)
        const detrackSuccess = await updateDetrackForOnHold(trackingNumber);
        if (!detrackSuccess) {
            console.log(`❌ Detrack update failed for ${trackingNumber}`);
            return {
                success: false,
                message: 'Detrack update failed',
                code: 'DETRACK_FAILED'
            };
        }

        console.log(`✅ All On Hold updates completed successfully for ${trackingNumber}`);
        return {
            success: true,
            message: 'Job put on hold (Custom Clearing)',
            product: product.toUpperCase(),
            mawbNum: jobData.run_number,
            isNewOrder: false // Always false for CCH
        };

    } catch (error) {
        console.error(`❌ Error in On Hold update for ${trackingNumber}:`, error);
        return {
            success: false,
            message: 'Error: ' + error.message,
            code: 'PROCESSING_ERROR'
        };
    }
}

async function updateMongoForOnHold(trackingNumber, product, req) {
    try {
        const order = await ORDERS.findOne({ doTrackingNumber: trackingNumber });

        if (!order) {
            console.log(`📦 Order not found in MongoDB for ${trackingNumber}, creating new entry...`);
            const jobData = await getJobDetails(trackingNumber);
            if (!jobData) {
                console.log(`❌ Cannot create order: no job data for ${trackingNumber}`);
                return false;
            }
            const newOrder = await createOrderWithOnHoldStatus(jobData, trackingNumber, product, req);
            return newOrder !== null;
        }

        // Log current history for debugging
        console.log(`Current history for ${trackingNumber}:`, JSON.stringify(order.history, null, 2));

        // Create the update object
        const updateOperations = {
            $set: {
                currentStatus: "Custom Clearing",
                lastUpdateDateTime: new Date().toISOString(), // Use Date instead of moment if possible
                latestLocation: "Brunei Customs",
                lastUpdatedBy: req.user.name
            }
        };

        // Only push to history if it exists as an array
        if (Array.isArray(order.history)) {
            updateOperations.$push = {
                history: {
                    statusHistory: "Custom Clearing",
                    dateUpdated: new Date().toISOString(),
                    updatedBy: req.user.name,
                    lastLocation: "Brunei Customs"
                }
            };
        } else {
            // If history doesn't exist, set it as a new array
            updateOperations.$set.history = [{
                statusHistory: "Custom Clearing",
                dateUpdated: new Date().toISOString(),
                updatedBy: req.user.name,
                lastLocation: "Brunei Customs"
            }];
        }

        // Log what we're trying to update
        console.log('Update operations:', JSON.stringify(updateOperations, null, 2));

        const result = await ORDERS.updateOne(
            { doTrackingNumber: trackingNumber },
            updateOperations
        );

        console.log(`✅ MongoDB update result for ${trackingNumber}:`, result);

        if (result.modifiedCount > 0) {
            console.log(`✅ MongoDB updated for On Hold: ${trackingNumber}`);
            return true;
        } else {
            console.log(`⚠️ No document modified for ${trackingNumber}`);
            return false;
        }

    } catch (error) {
        console.error(`❌ MongoDB update error for ${trackingNumber}:`, error);
        return false;
    }
}

// Create new order with On Hold status
async function createOrderWithOnHoldStatus(jobData, trackingNumber, product, req) {
    try {
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

        // Process phone numbers
        const finalPhoneNum = processPhoneNumber(jobData.phone_number);
        const finalAdditionalPhoneNum = processPhoneNumber(jobData.other_phone_numbers);

        // Process postal code
        const postalCode = jobData.postal_code ? jobData.postal_code.toUpperCase() : '';

        // Create new order
        const newOrder = new ORDERS({
            area: finalArea,
            items: itemsArray,
            attempt: jobData.attempt || 1,
            history: [{
                statusHistory: "Custom Clearing",
                dateUpdated: moment().format(),
                updatedBy: req.user.name,
                lastLocation: "Brunei Customs",
            }],
            latestLocation: "Brunei Customs",
            product: product.toLowerCase(),
            senderName: jobData.job_owner || product,
            totalPrice: jobData.total_price || 0,
            paymentAmount: jobData.payment_amount || 0,
            receiverName: jobData.deliver_to_collect_from || '',
            trackingLink: jobData.tracking_link || '',
            currentStatus: "Custom Clearing",
            paymentMethod: jobData.payment_mode || 'NON COD',
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
            mawbNo: jobData.run_number || '',
            parcelWeight: jobData.weight || 0
        });

        await newOrder.save();
        console.log(`✅ Created new order with On Hold status for ${trackingNumber}`);
        return newOrder;

    } catch (error) {
        console.error(`❌ Error creating order for ${trackingNumber}:`, error);
        return null;
    }
}

// Detrack Update Function for On Hold
async function updateDetrackForOnHold(trackingNumber) {
    try {
        const detrackUpdateData = {
            do_number: trackingNumber,
            data: {
                status: "on_hold"
            }
        };

        console.log(`🔄 Updating Detrack to on_hold for ${trackingNumber}`);

        const response = await axios.put(
            'https://app.detrack.com/api/v2/dn/jobs/update',
            detrackUpdateData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey
                },
                timeout: 10000
            }
        );

        if (response.data.success === true || response.data.status === 'success' || response.status === 200) {
            console.log(`✅ Detrack updated to on_hold for ${trackingNumber}`);
            return true;
        } else {
            console.log(`❌ Detrack update failed for ${trackingNumber}:`, response.data);
            return false;
        }

    } catch (error) {
        console.error(`❌ Detrack API error for ${trackingNumber}:`, error.message);
        return false;
    }
}

async function processItemInWarehouseUpdate(trackingNumber, warehouse, req, mawbNum = null) {
    try {
        console.log(`🔍 Starting Item in Warehouse update for ${trackingNumber} at ${warehouse}`);

        // ========== 0. SPECIAL HANDLING FOR CBSL ==========
        // First, try to identify if this is CBSL by checking Detrack
        console.log(`🔄 Checking if ${trackingNumber} is CBSL...`);

        try {
            // Try as tracking_number first (CBSL first scan)
            const cbslResponse = await axios.get(
                `https://app.detrack.com/api/v2/dn/jobs/show/?tracking_number=${trackingNumber}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': apiKey
                    },
                    timeout: 5000
                }
            );

            if (cbslResponse.data.data && cbslResponse.data.data.group_name === 'cbsl') {
                console.log(`✅ Identified as CBSL first scan`);
                return await processCBSLFirstScan(trackingNumber, warehouse, req);
            }
        } catch (cbslError) {
            // Not CBSL or not found, continue with normal flow
            console.log(`ℹ️ Not CBSL or not found as tracking_number: ${cbslError.message}`);
        }

        // ========== 1. FIRST CHECK JOB EXISTS ==========
        const jobExists = await checkJobExists(trackingNumber);
        if (!jobExists) {
            return {
                success: false,
                message: 'Job not found in Detrack',
                code: 'DETRACK_NOT_FOUND'
            };
        }

        const jobData = await getJobDetails(trackingNumber);
        if (!jobData) {
            return {
                success: false,
                message: 'Could not get job details',
                code: 'DETRACK_NO_DETAILS'
            };
        }

        console.log(`📋 Job details for ${trackingNumber}:`, {
            status: jobData.status,
            run_number: jobData.run_number,
            group_name: jobData.group_name,
            job_owner: jobData.job_owner
        });

        // ========== CRITICAL FIX: USE run_number AS MAWB IF NOT PROVIDED ==========
        // If mawbNum is empty but job has run_number, use run_number as MAWB
        if ((!mawbNum || mawbNum.trim() === '') && jobData.run_number && jobData.run_number.trim() !== '') {
            mawbNum = jobData.run_number.trim();
            console.log(`✅ Using job's run_number as MAWB: ${mawbNum}`);
        }

        // ========== 2. GET PRODUCT INFO ==========
        const { currentProduct, senderName } = getProductInfo(jobData.group_name, jobData.job_owner);
        const product = currentProduct.toLowerCase();
        const normalizedStatus = jobData.status ? jobData.status.toLowerCase() : '';
        console.log(`📦 Detected product: ${product}, status: ${normalizedStatus}`);

        // ========== 2A. VALIDATE ON_HOLD FOR NON-MAWB PRODUCTS ==========
        const mawbProducts = ['pdu', 'mglobal', 'ewe', 'gdex', 'gdext'];

        // ========== 2A. IF CBSL DETECTED IN NORMAL FLOW ==========
        if (product === 'cbsl') {
            console.log(`🔄 CBSL detected in normal flow, using first-scan logic`);
            return await processCBSLFirstScan(trackingNumber, warehouse, req);
        }

        // Validate: Non-MAWB products should not have on_hold status
        if (normalizedStatus === 'on_hold' && !mawbProducts.includes(product)) {
            return {
                success: false,
                message: `Product "${product}" cannot have "on_hold" status. Only MAWB products (PDU, MGLOBAL, EWE, GDEX, GDEXT) can be on hold.`,
                product: product,
                code: 'INVALID_ON_HOLD_NON_MAWB'
            };
        }

        // ========== 2B. VALIDATE DETRACK STATUS ==========
        const validDetrackStatuses = ['info_recv', 'on_hold'];
        if (!validDetrackStatuses.includes(normalizedStatus)) {
            return {
                success: false,
                message: `Invalid Detrack status: "${jobData.status}". Must be "info_recv" or "on_hold"`,
                product: product,
                code: 'INVALID_DETRACK_STATUS'
            };
        }

        // ========== 3. CHECK EXISTING ORDER ==========
        let existingOrder;
        if (product === 'cbsl') {
            // CBSL: Check both fields since we might have stored it differently
            existingOrder = await ORDERS.findOne({
                $or: [
                    { parcelTrackingNum: trackingNumber.trim() },
                    { doTrackingNumber: trackingNumber.trim() }
                ]
            }).select('mawbNo warehouseEntry currentStatus product senderName doTrackingNumber parcelTrackingNum');
        } else {
            // All other products: Use doTrackingNumber as before
            existingOrder = await ORDERS.findOne({
                doTrackingNumber: trackingNumber.trim()
            }).select('mawbNo warehouseEntry currentStatus product senderName');
        }

        // ========== 4. PRODUCT CATEGORIES ==========
        const mustExistProducts = [
            'cbsl', 'pharmacymoh', 'pharmacyjpmc', 'pharmacyphc',
            'localdelivery', 'pdu', 'mglobal', 'ewe', 'gdex', 'gdext'
        ];

        const canCreateProducts = ['pure51', 'icarus', 'kptdp'];
        // mawbProducts already defined above

        // ========== 5. VALIDATION CHECKS ==========

        // A. MUST-EXIST products validation
        if (mustExistProducts.includes(product)) {
            if (!existingOrder) {
                return {
                    success: false,
                    message: `${product.toUpperCase()} order must exist before IIW update`,
                    product: product,
                    code: 'ORDER_MUST_EXIST',
                    shouldExist: true
                };
            }
        }

        // B. Check if already at warehouse (for ALL products)
        if (existingOrder && existingOrder.warehouseEntry === "Yes") {
            return {
                success: false,
                message: 'Order already scanned (warehouseEntry: Yes)',
                product: product,
                alreadyAtWarehouse: true,
                code: 'ALREADY_SCANNED'
            };
        }

        // C. MAWB-REQUIRED products validation - UPDATED LOGIC
        if (mawbProducts.includes(product)) {
            // MAWB-REQUIRED product: MUST have MAWB
            if (!mawbNum || mawbNum.trim() === '') {
                // Check if we have run_number as fallback
                if (jobData.run_number && jobData.run_number.trim() !== '') {
                    mawbNum = jobData.run_number.trim();
                    console.log(`🔄 Using job's run_number as MAWB: ${mawbNum}`);
                } else {
                    return {
                        success: false,
                        message: `${product.toUpperCase()} requires MAWB number`,
                        product: product,
                        mawbRequired: true,
                        code: 'MAWB_REQUIRED'
                    };
                }
            }

            // Validate tracking belongs to this MAWB
            if (existingOrder && existingOrder.mawbNo &&
                existingOrder.mawbNo.toUpperCase() !== mawbNum.trim().toUpperCase()) {
                return {
                    success: false,
                    message: `Order belongs to MAWB "${existingOrder.mawbNo}", not "${mawbNum}"`,
                    product: product,
                    mawbMismatch: true,
                    orderMAWB: existingOrder.mawbNo,
                    code: 'MAWB_MISMATCH'
                };
            }
        }

        // D. Non-MAWB product with MAWB selected → REJECT
        if (!mawbProducts.includes(product) && mawbNum && mawbNum.trim() !== '') {
            return {
                success: false,
                message: `${product.toUpperCase()} cannot have MAWB number`,
                product: product,
                invalidMawb: true,
                code: 'INVALID_MAWB'
            };
        }

        // ========== 6. PROCESS BASED ON PRODUCT TYPE ==========

        // A. Can-create products (pure51, icarus, kptdp)
        if (canCreateProducts.includes(product)) {
            if (!existingOrder && normalizedStatus === 'info_recv') {
                console.log(`🔄 Creating new order for ${product} from info_recv`);
                return await createIIWOrderWithRules(jobData, trackingNumber, warehouse, req, product);
            } else if (existingOrder) {
                console.log(`📦 Updating existing ${product} order`);
                // Process as existing order
            } else {
                return {
                    success: false,
                    message: `${product.toUpperCase()} can only be created from "info_recv" status`,
                    code: 'CAN_CREATE_ONLY_FROM_INFO_RECV'
                };
            }
        }

        // B. Other non-MAWB products (grp, temu, random international)
        if (!mustExistProducts.includes(product) &&
            !canCreateProducts.includes(product)) {

            if (normalizedStatus === 'info_recv') {
                if (!existingOrder) {
                    console.log(`🔄 Creating new order for non-MAWB product: ${product}`);
                    return await createIIWOrderWithRules(jobData, trackingNumber, warehouse, req, product);
                } else {
                    console.log(`📦 Updating existing non-MAWB product: ${product}`);
                    // Process as existing order
                }
            } else if (normalizedStatus === 'on_hold' && !existingOrder) {
                return {
                    success: false,
                    message: `${product.toUpperCase()} order should already exist for "on_hold" status`,
                    code: 'ORDER_MISSING_FOR_ON_HOLD'
                };
            }
        }

        // C. All other cases (must-exist products, existing orders)
        const hasMAWB = jobData.run_number && jobData.run_number.trim() !== '';
        const result = await processWarehouseUpdateLogic(trackingNumber, warehouse, jobData, product, req, hasMAWB);

        // Add MAWB to result if available
        if (mawbNum && mawbNum.trim() !== '') {
            result.mawbNum = mawbNum.trim().toUpperCase();
            result.mawbValidation = 'valid';
        }

        return result;

    } catch (error) {
        console.error(`❌ Error in Item in Warehouse update for ${trackingNumber}:`, error);
        return { success: false, message: 'Error: ' + error.message, code: 'PROCESSING_ERROR' };
    }
}

// Show MAWB alert
function showMAWBAlert(message, isSuccess) {
    const alertClass = isSuccess ? 'alert-success' : 'alert-danger';

    // Remove any existing alert
    const existingAlert = document.querySelector('.mawb-alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertClass} alert-dismissible fade show mawb-alert`;
    alertDiv.innerHTML = `
        <strong>${isSuccess ? '✅' : '⚠️'} MAWB Validation:</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // Insert after the MAWB input
    const mawbContainer = document.getElementById('mawbNumContainer');
    if (mawbContainer) {
        mawbContainer.appendChild(alertDiv);
    }

    // Auto-remove after 5 seconds for success messages
    if (isSuccess) {
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

// Update processWarehouseUpdateLogic to include jobData for CBSL
async function processWarehouseUpdateLogic(trackingNumber, warehouse, jobData, product, req, hasMAWB) {
    const currentStatus = jobData.status;
    const normalizedStatus = currentStatus ? currentStatus.toLowerCase() : '';

    console.log(`🔄 Processing warehouse update for ${trackingNumber}: status=${normalizedStatus}, product=${product}, hasMAWB=${hasMAWB}`);

    // Check if job requires 30-minute delay
    const requiresDelay = checkIfRequiresDelay(normalizedStatus, product);

    if (requiresDelay) {
        console.log(`⏰ Job ${trackingNumber} requires 30-minute delay (${product})`);
        const result = await handleDelayedWarehouseUpdate(trackingNumber, warehouse, jobData, product, req, hasMAWB);
        // Add customer details to the result
        if (result && typeof result === 'object') {
            result.customerName = jobData.deliver_to_collect_from || 'Unknown';
            result.area = getAreaFromAddress(jobData.address);
        }
        return result;
    } else {
        console.log(`⚡ Job ${trackingNumber} can be updated immediately`);
        const result = await handleImmediateWarehouseUpdate(trackingNumber, warehouse, jobData, product, req, hasMAWB);
        // Add customer details to the result
        if (result && typeof result === 'object') {
            result.customerName = jobData.deliver_to_collect_from || 'Unknown';
            result.area = getAreaFromAddress(jobData.address);
        }
        return result;
    }
}

async function handleImmediateWarehouseUpdate(trackingNumber, warehouse, jobData, product, req, hasMAWB) {
    try {
        console.log(`⚡ Starting immediate warehouse update for ${trackingNumber} (${product})`);

        // Check if order exists
        const existingOrder = await ORDERS.findOne({ doTrackingNumber: trackingNumber });

        // REMOVED: DT1 GDEX update - No longer sending DT1

        // 1. Update MongoDB
        const mongoSuccess = await updateMongoForWarehouse(trackingNumber, warehouse, jobData, product, req, hasMAWB);

        if (!mongoSuccess) {
            console.log(`❌ MongoDB immediate update failed for ${trackingNumber}`);
            return { success: false, message: 'MongoDB update failed' };
        }

        console.log(`✅ MongoDB updated for ${trackingNumber}`);

        // 2. Execute Detrack updates (these will trigger AL1)
        const detrackResults = await executeDetrackUpdates(
            trackingNumber,
            product,
            jobData.status,
            req,
            warehouse,
            false, // Not delayed
            jobData, // Pass jobData
            !existingOrder // Pass isNewOrder = true if no existing order
        );

        const detrackSuccess = detrackResults.some(result => result.success);

        if (!detrackSuccess) {
            console.log(`❌ Detrack update failed for ${trackingNumber}`);
            return {
                success: false,
                message: 'Detrack update failed'
                // REMOVED: gdexDt1Sent property
            };
        }

        console.log(`✅ Detrack updates executed for ${trackingNumber}`);

        // Note: AL1 is now triggered INSIDE executeDetrackUpdates
        // when status changes to at_warehouse

        return {
            success: true,
            message: `Item marked as at warehouse (${warehouse})`,
            customerName: jobData.deliver_to_collect_from || 'Unknown',
            area: getAreaFromAddress(jobData.address),
            isNewOrder: !existingOrder,
            // REMOVED: gdexUpdates object with dt1 status
        };

    } catch (error) {
        console.error(`❌ Error in immediate warehouse update for ${trackingNumber}:`, error);
        return { success: false, message: 'Error in warehouse update: ' + error.message };
    }
}

// Update checkIfRequiresDelay to only check the 4 specific conditions
function checkIfRequiresDelay(currentStatus, product) {
    console.log(`Checking delay: status=${currentStatus}, product=${product}`);

    const normalizedStatus = currentStatus ? currentStatus.toLowerCase() : '';
    const normalizedProduct = product ? product.toLowerCase() : '';

    // Only these 4 specific conditions require delay
    if (
        (normalizedStatus === 'on_hold' && normalizedProduct === 'pdu') ||
        (normalizedStatus === 'on_hold' && (normalizedProduct === 'ewe' || normalizedProduct === 'mglobal')) ||
        (normalizedStatus === 'info_recv' && normalizedProduct === 'pdu') ||
        (normalizedStatus === 'info_recv' && (normalizedProduct === 'ewe' || normalizedProduct === 'mglobal'))
    ) {
        console.log(`✅ 30-minute delay required for ${product} from ${currentStatus}`);
        return true;
    }

    console.log(`❌ No delay required for ${product} from ${currentStatus}`);
    return false;
}

// Update handleDelayedWarehouseUpdate function - 30 minutes for production
async function handleDelayedWarehouseUpdate(trackingNumber, warehouse, jobData, product, req, hasMAWB) {
    try {
        console.log(`⏰ Starting delayed warehouse update for ${trackingNumber} (${product})`);

        // Get the sequence to know what immediate updates will happen
        const sequence = getDetrackUpdateSequence(product, jobData.status, false);

        // Execute IMMEDIATE Detrack updates if any
        let immediateResults = [];
        if (sequence.immediate && sequence.immediate.length > 0) {
            const detrackResponse = await executeDetrackUpdates(
                trackingNumber,
                product,
                jobData.status,
                req,
                warehouse,
                false, // Not delayed execution
                jobData
            );

            if (detrackResponse && Array.isArray(detrackResponse)) {
                immediateResults = detrackResponse;
                const successfulCount = immediateResults.filter(r => r && r.success).length;
                console.log(`✅ Immediate Detrack updates completed: ${successfulCount} successful`);
            } else {
                console.log(`⚠️ Immediate Detrack updates returned non-array response`);
            }
        }

        // 1. Update MongoDB immediately with queued status
        const mongoSuccess = await updateMongoWithQueuedStatus(trackingNumber, warehouse, jobData, product, req, hasMAWB);

        if (!mongoSuccess) {
            console.log(`❌ MongoDB queued update failed for ${trackingNumber}`);
            return { success: false, message: 'Failed to queue job in MongoDB' };
        }

        console.log(`✅ MongoDB queued for ${trackingNumber}`);

        // 2. Schedule Detrack update for 30 minutes later
        const delayedJobId = await scheduleDetrackUpdate(trackingNumber, warehouse, jobData, product, req);

        if (!delayedJobId) {
            console.log(`❌ Failed to schedule delayed update for ${trackingNumber}`);
            return { success: false, message: 'Failed to schedule delayed update' };
        }

        console.log(`⏰ Scheduled delayed Detrack update for ${trackingNumber} (jobId: ${delayedJobId})`);

        // Create message based on sequence
        let immediateMessage = '';
        if (sequence.immediate && sequence.immediate.length > 0) {
            immediateMessage = `Immediate updates: ${sequence.immediate.join(', ')}. `;
        }

        // Update the console log in handleDelayedWarehouseUpdate
        return {
            success: true,
            delayed: true,
            message: `${immediateMessage}Queued for warehouse update in 30 minutes (${product})`,
            customerName: jobData.deliver_to_collect_from || 'Unknown',
            area: getAreaFromAddress(jobData.address),
            delayedInfo: {
                product: product,
                scheduledTime: moment().add(30, 'minutes').format('HH:mm'),
                jobId: delayedJobId,
                currentStatus: mapDetrackStatus(jobData.status),
                immediateUpdates: sequence.immediate || [],
                delayedUpdates: sequence.delayedUpdates || [],
                finalUpdates: sequence.final || []
            }
        };

    } catch (error) {
        console.error(`❌ Error in handleDelayedWarehouseUpdate for ${trackingNumber}:`, error);
        return { success: false, message: 'Error scheduling delayed update: ' + error.message };
    }
}

// ==================================================
// 📊 MongoDB Update Functions
// ==================================================

// Update updateMongoWithQueuedStatus function - Don't add history for queued
async function updateMongoWithQueuedStatus(trackingNumber, warehouse, jobData, product, req, hasMAWB) {
    try {
        const existingOrder = await ORDERS.findOne({ doTrackingNumber: trackingNumber });
        const now = moment().format();

        if (!existingOrder && !hasMAWB) {
            // Create new order without history
            return await createOrderWithQueuedStatus(trackingNumber, warehouse, jobData, product, req);
        }

        // Update existing order without adding history
        const update = {
            $set: {
                currentStatus: "Queued for Warehouse",
                lastUpdateDateTime: now,
                warehouseEntry: "No",
                latestLocation: "Scheduled for Processing",
                lastUpdatedBy: req.user.name,
                queueStatus: "delayed",
                queueScheduledTime: moment().add(30, 'minutes').format(),
            }
        };

        const result = await ORDERS.updateOne(
            { doTrackingNumber: trackingNumber },
            update
        );

        return result.modifiedCount > 0 || result.upsertedCount > 0;

    } catch (error) {
        console.error(`❌ MongoDB queued update error for ${trackingNumber}:`, error);
        return false;
    }
}

// Update createOrderWithQueuedStatus function - Remove queued history
async function createOrderWithQueuedStatus(trackingNumber, warehouse, jobData, product, req) {
    try {
        const { currentProduct, senderName } = getProductInfo(jobData.group_name, jobData.job_owner);

        // Process items array
        const itemsArray = processItemsArray(jobData.items, jobData.total_price);

        // Process area from address
        const finalArea = getAreaFromAddress(jobData.address);

        // Process phone numbers
        const finalPhoneNum = processPhoneNumber(jobData.phone_number);
        const finalAdditionalPhoneNum = processPhoneNumber(jobData.other_phone_numbers);

        // Process postal code
        const postalCode = jobData.postal_code ? jobData.postal_code.toUpperCase() : '';

        // Determine payment method
        const totalAmount = jobData.total_price || jobData.payment_amount || 0;
        const paymentMethod = totalAmount > 0 ? 'Cash' : 'NON COD';

        // Create order WITHOUT queued history - will get "At Warehouse" when actually processed
        const newOrder = new ORDERS({
            area: finalArea,
            items: itemsArray,
            attempt: jobData.attempt || 1,
            history: [], // Empty history for now
            latestLocation: "Scheduled for Processing",
            product: currentProduct,
            senderName: senderName,
            totalPrice: totalAmount,
            paymentAmount: totalAmount,
            receiverName: jobData.deliver_to_collect_from || '',
            trackingLink: jobData.tracking_link || '',
            currentStatus: "Queued for Warehouse",
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
            mawbNo: jobData.run_number || '',
            parcelWeight: jobData.weight || 0,
            queueStatus: "delayed",
            queueScheduledTime: moment().add(30, 'minutes').format(), // CHANGED to 30 minutes
            queueNote: "30-minute delay" // CHANGED
        });

        await newOrder.save();
        console.log(`✅ Created queued order for ${trackingNumber} (30 min delay)`); // CHANGED
        return true;

    } catch (error) {
        console.error(`❌ Error creating queued order for ${trackingNumber}:`, error);
        return false;
    }
}

// Update updateMongoForWarehouse function - Always push "At Warehouse"
async function updateMongoForWarehouse(trackingNumber, warehouse, jobData, product, req, hasMAWB) {
    try {
        const existingOrder = await ORDERS.findOne({ doTrackingNumber: trackingNumber });
        const now = moment().format();

        if (!existingOrder && !hasMAWB) {
            // Create new order with "At Warehouse" history
            return await createOrderWithWarehouseStatus(trackingNumber, warehouse, jobData, product, req);
        }

        // Update existing order - Always push "At Warehouse" history
        const update = {
            $set: {
                currentStatus: "At Warehouse",
                lastUpdateDateTime: now,
                warehouseEntry: "Yes",
                warehouseEntryDateTime: now,
                latestLocation: warehouse,
                lastUpdatedBy: req.user.name
            },
            $push: {
                history: {
                    statusHistory: "At Warehouse",
                    dateUpdated: now,
                    updatedBy: req.user.name,
                    lastLocation: warehouse,
                }
            }
        };

        const result = await ORDERS.updateOne(
            { doTrackingNumber: trackingNumber },
            update
        );

        return result.modifiedCount > 0;

    } catch (error) {
        console.error(`❌ MongoDB immediate update error for ${trackingNumber}:`, error);
        return false;
    }
}

// Update createOrderWithWarehouseStatus function - Always start with "At Warehouse"
async function createOrderWithWarehouseStatus(trackingNumber, warehouse, jobData, product, req) {
    try {
        const { currentProduct, senderName } = getProductInfo(jobData.group_name, jobData.job_owner);

        // Process items array
        const itemsArray = processItemsArray(jobData.items, jobData.total_price);

        // Process area from address
        const finalArea = getAreaFromAddress(jobData.address);

        // Process phone numbers
        const finalPhoneNum = processPhoneNumber(jobData.phone_number);
        const finalAdditionalPhoneNum = processPhoneNumber(jobData.other_phone_numbers);

        // Process postal code
        const postalCode = jobData.postal_code ? jobData.postal_code.toUpperCase() : '';

        // Determine payment method
        const totalAmount = jobData.total_price || jobData.payment_amount || 0;
        const paymentMethod = totalAmount > 0 ? 'Cash' : 'NON COD';

        // Create new order - ALWAYS start with "At Warehouse" history
        const newOrder = new ORDERS({
            area: finalArea,
            items: itemsArray,
            attempt: jobData.attempt || 1,
            history: [{
                statusHistory: "At Warehouse",
                dateUpdated: moment().format(),
                updatedBy: req.user.name,
                lastLocation: warehouse,
            }],
            latestLocation: warehouse,
            product: currentProduct,
            senderName: senderName,
            totalPrice: totalAmount,
            paymentAmount: totalAmount,
            receiverName: jobData.deliver_to_collect_from || '',
            trackingLink: jobData.tracking_link || '',
            currentStatus: "At Warehouse",
            paymentMethod: paymentMethod,
            warehouseEntry: "Yes",
            warehouseEntryDateTime: moment().format(),
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
            mawbNo: jobData.run_number || '',
            parcelWeight: jobData.weight || 0
        });

        await newOrder.save();
        console.log(`✅ Created new order with "At Warehouse" status for ${trackingNumber}`);
        return true;

    } catch (error) {
        console.error(`❌ Error creating warehouse order for ${trackingNumber}:`, error);
        return false;
    }
}

// Process items array helper
function processItemsArray(items, totalPrice) {
    const itemsArray = [];
    if (items && Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
            itemsArray.push({
                quantity: items[i].quantity || 0,
                description: items[i].description || '',
                totalItemPrice: totalPrice || 0
            });
        }
    } else if (items && items.quantity && items.description) {
        // Single item object
        itemsArray.push({
            quantity: items.quantity || 0,
            description: items.description || '',
            totalItemPrice: totalPrice || 0
        });
    }
    return itemsArray;
}

// ==================================================
// 🔄 Detrack Update Functions
// ==================================================

function getDetrackUpdateSequence(product, currentStatus, isDelayedExecution = false) {
    const normalizedStatus = currentStatus ? currentStatus.toLowerCase() : '';
    const normalizedProduct = product ? product.toLowerCase() : '';

    console.log(`Detrack sequence check: product=${normalizedProduct}, status=${normalizedStatus}, isDelayed=${isDelayedExecution}`);

    // Define product categories
    const mawbProducts = ['pdu', 'mglobal', 'ewe', 'gdex', 'gdext'];
    const mustExistProducts = ['cbsl', 'pharmacymoh', 'pharmacyjpmc', 'pharmacyphc', 'localdelivery'];
    const canCreateProducts = ['pure51', 'icarus', 'kptdp'];

    // ========== MAWB-REQUIRED PRODUCTS ==========
    if (mawbProducts.includes(normalizedProduct)) {
        // 1. PDU from on_hold
        if (normalizedStatus === 'on_hold' && normalizedProduct === 'pdu') {
            if (!isDelayedExecution) {
                return {
                    immediate: ['custom_clearing'],
                    delayed: true,
                    delayedUpdates: ['at_warehouse'],
                    final: ['in_sorting_area']
                };
            } else {
                return {
                    immediate: ['at_warehouse'],
                    delayed: false,
                    delayedUpdates: [],
                    final: ['in_sorting_area']
                };
            }
        }

        // 2. EWE/MGLOBAL from on_hold
        if (normalizedStatus === 'on_hold' && (normalizedProduct === 'ewe' || normalizedProduct === 'mglobal')) {
            if (!isDelayedExecution) {
                return {
                    immediate: [],
                    delayed: true,
                    delayedUpdates: ['at_warehouse'],
                    final: ['in_sorting_area']
                };
            } else {
                return {
                    immediate: ['at_warehouse'],
                    delayed: false,
                    delayedUpdates: [],
                    final: ['in_sorting_area']
                };
            }
        }

        // 3. PDU from info_recv
        if (normalizedStatus === 'info_recv' && normalizedProduct === 'pdu') {
            if (!isDelayedExecution) {
                return {
                    immediate: ['on_hold', 'custom_clearing'],
                    delayed: true,
                    delayedUpdates: ['at_warehouse'],
                    final: ['in_sorting_area']
                };
            } else {
                return {
                    immediate: ['at_warehouse'],
                    delayed: false,
                    delayedUpdates: [],
                    final: ['in_sorting_area']
                };
            }
        }

        // 4. EWE/MGLOBAL from info_recv
        if (normalizedStatus === 'info_recv' && (normalizedProduct === 'ewe' || normalizedProduct === 'mglobal')) {
            if (!isDelayedExecution) {
                return {
                    immediate: ['custom_clearing'],
                    delayed: true,
                    delayedUpdates: ['at_warehouse'],
                    final: ['in_sorting_area']
                };
            } else {
                return {
                    immediate: ['at_warehouse'],
                    delayed: false,
                    delayedUpdates: [],
                    final: ['in_sorting_area']
                };
            }
        }

        // 5. GDEX/GDEXT from EITHER info_recv OR on_hold - CORRECTED!
        if ((normalizedStatus === 'info_recv' || normalizedStatus === 'on_hold') &&
            (normalizedProduct === 'gdex' || normalizedProduct === 'gdext')) {
            // GDEX/GDEXT: in_sorting_area → at_warehouse (SAME for both statuses)
            return {
                immediate: ['in_sorting_area', 'at_warehouse'],
                delayed: false,
                delayedUpdates: [],
                final: []
            };
        }
    }

    // ========== MUST-EXIST NON-MAWB PRODUCTS ==========
    else if (mustExistProducts.includes(normalizedProduct)) {
        // 6. CBSL - info_recv only
        if (normalizedProduct === 'cbsl' && normalizedStatus === 'info_recv') {
            return {
                immediate: ['at_warehouse', 'in_sorting_area'],
                delayed: false,
                delayedUpdates: [],
                final: []
            };
        }

        // 7. Other must-exist products (pharmacies, localdelivery) - info_recv only
        if (normalizedStatus === 'info_recv') {
            return {
                immediate: ['at_warehouse', 'in_sorting_area'],
                delayed: false,
                delayedUpdates: [],
                final: []
            };
        }

        // REJECT on_hold for non-MAWB products
        if (normalizedStatus === 'on_hold') {
            console.error(`❌ INVALID: ${normalizedProduct} should not have on_hold status`);
            return {
                immediate: [],
                delayed: false,
                delayedUpdates: [],
                final: []
            };
        }
    }

    // ========== CAN-CREATE PRODUCTS ==========
    else if (canCreateProducts.includes(normalizedProduct)) {
        // 8. pure51, icarus, kptdp from info_recv - NO on_hold
        if (normalizedStatus === 'info_recv') {
            return {
                immediate: ['at_warehouse', 'in_sorting_area'],
                delayed: false,
                delayedUpdates: [],
                final: []
            };
        }

        // REJECT on_hold for can-create products
        if (normalizedStatus === 'on_hold') {
            console.error(`❌ INVALID: ${normalizedProduct} should not have on_hold status`);
            return {
                immediate: [],
                delayed: false,
                delayedUpdates: [],
                final: []
            };
        }
    }

    // ========== OTHER NON-MAWB PRODUCTS ==========
    else {
        // 9. Other products ONLY from info_recv status - NO on_hold
        if (normalizedStatus === 'info_recv') {
            return {
                immediate: ['at_warehouse', 'in_sorting_area'],
                delayed: false,
                delayedUpdates: [],
                final: []
            };
        }

        // REJECT on_hold for any other non-MAWB products
        if (normalizedStatus === 'on_hold') {
            console.error(`❌ INVALID: ${normalizedProduct} should not have on_hold status`);
            return {
                immediate: [],
                delayed: false,
                delayedUpdates: [],
                final: []
            };
        }
    }

    // ========== DEFAULT FALLBACK ==========
    console.warn(`⚠️ No Detrack sequence defined for product=${normalizedProduct}, status=${normalizedStatus}`);

    return {
        immediate: [],
        delayed: false,
        delayedUpdates: [],
        final: []
    };
}

// ==================================================
// 🔄 Execute Detrack Updates with GDEX Integration
// ==================================================

async function executeDetrackUpdates(trackingNumber, product, currentStatus, req, warehouse, isDelayedExecution = false, jobData = null, isNewOrder = false) {
    try {
        console.log(`\n🔄 EXECUTING DETRACK UPDATES:`);
        console.log(`   ├── Tracking: ${trackingNumber}`);
        console.log(`   ├── Product: ${product}`);
        console.log(`   ├── Status: ${currentStatus}`);
        console.log(`   ├── New Order: ${isNewOrder}`);
        console.log(`   └── Delayed: ${isDelayedExecution}`);

        // Check if this is a NEW order created during IIW update
        if (isNewOrder && !isDelayedExecution) {
            console.log(`📦 NEW ORDER DETECTED - USING CONSISTENT UPDATE STRUCTURE`);

            const updateData = createDetrackUpdateData(trackingNumber, jobData.run_number || '', product, jobData, true);

            console.log(`📤 Detrack Payload (consistent structure):`);
            console.log(JSON.stringify(updateData, null, 2));

            const response = await axios.put(
                'https://app.detrack.com/api/v2/dn/jobs/update',
                updateData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': apiKey
                    },
                    timeout: 10000
                }
            );

            const success = response.data.success === true || response.data.status === 'success' || response.status === 200;

            if (success) {
                console.log(`✅ Consistent Detrack update successful for new order`);
                return [{ status: 'at_warehouse', success: true, consistent: true }];
            } else {
                console.log(`❌ Consistent Detrack update failed`);
                return [{ status: 'at_warehouse', success: false, consistent: true }];
            }
        }

        // For existing orders OR delayed updates, use original sequence logic
        console.log(`📦 EXISTING ORDER OR DELAYED - USING ORIGINAL SEQUENCE LOGIC`);

        const sequence = getDetrackUpdateSequence(product, currentStatus, isDelayedExecution);
        console.log(`Sequence:`, sequence);

        // FIX: Ensure sequence properties are arrays
        if (!sequence.immediate) sequence.immediate = [];
        if (!sequence.delayedUpdates) sequence.delayedUpdates = [];
        if (!sequence.final) sequence.final = [];

        let results = [];

        // ========== UPDATED: Only AL1 for GDEX products ==========
        const isGDEX = (product === 'gdex' || product === 'gdext');

        // Execute immediate updates with GDEX integration
        for (const status of sequence.immediate) {
            // 1. Update Detrack
            const success = await updateDetrackStatusSingle(
                trackingNumber,
                status,
                product,
                req,
                warehouse,
                false, // isCBSL
                null   // cbslTrackingNumber
            );
            results.push({ status: status, success: success, immediate: true });

            if (success) {
                console.log(`✅ Immediate Detrack update to ${status} for ${trackingNumber}`);

                // 2. If GDEX product, send AL1 (Received by Branch) ONLY - NO DT2
                if (isGDEX) {
                    console.log(`📤 Sending GDEX AL1 (Received by Branch) for ${trackingNumber}`);
                    const gdexSuccess = await updateGDEXStatus(trackingNumber, 'branch_received', jobData);
                    results.push({ status: 'AL1', success: gdexSuccess, gdex: true });

                    // Small delay after GDEX update
                    await new Promise(resolve => setTimeout(resolve, 500));
                    break; // Exit loop after sending AL1 (only send once)
                }
            }
        }

        // Execute final updates (only if we're doing delayed execution or no delay needed)
        if (sequence.final.length > 0 && (isDelayedExecution || !sequence.delayed)) {
            for (const status of sequence.final) {
                const success = await updateDetrackStatusSingle(
                    trackingNumber,
                    status,
                    product,
                    req,
                    warehouse,
                    false, // isCBSL
                    null   // cbslTrackingNumber
                );
                results.push({ status: status, success: success, final: true });

                if (success) {
                    console.log(`✅ Final Detrack update to ${status} for ${trackingNumber}`);

                    // If GDEX product, send AL1 (Received by Branch) ONLY - NO DT2
                    if (isGDEX) {
                        console.log(`📤 Sending GDEX AL1 (Received by Branch) for ${trackingNumber}`);
                        const gdexSuccess = await updateGDEXStatus(trackingNumber, 'branch_received', jobData);
                        results.push({ status: 'AL1', success: gdexSuccess, gdex: true });

                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }
        }

        // FIX: Always return an array, even if empty
        return results || [];

    } catch (error) {
        console.error(`❌ Error executing Detrack updates for ${trackingNumber}:`, error);
        // FIX: Return empty array instead of throwing
        return [];
    }
}

// Update the updateDetrackStatusSingle function for CBSL swap
async function updateDetrackStatusSingle(trackingNumber, status, product, req, warehouse, isCBSL = false, cbslTrackingNumber = null) {
    try {
        console.log(`🔄 Updating Detrack to ${status} for ${trackingNumber} (${product})`);

        let updateData = {
            do_number: trackingNumber,
            data: {
                status: status
            }
        };

        // Special handling for CBSL - swap do_number and tracking_number in Detrack
        if (isCBSL && cbslTrackingNumber) {
            updateData = {
                do_number: trackingNumber, // Use the original tracking number as do_number
                data: {
                    status: status,
                    do_number: cbslTrackingNumber, // Swap: use tracking_number as do_number
                    tracking_number: trackingNumber // Swap: use do_number as tracking_number
                }
            };
            console.log(`🔄 CBSL Detrack swap: do_number=${trackingNumber}, tracking_number=${cbslTrackingNumber}`);
        }

        const response = await axios.put(
            'https://app.detrack.com/api/v2/dn/jobs/update',
            updateData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey
                },
                timeout: 10000
            }
        );

        const success = response.data.success === true || response.data.status === 'success' || response.status === 200;

        if (success) {
            console.log(`✅ Detrack updated to ${status} for ${trackingNumber}`);

            // For CBSL, update the second tracking number if it's the first update
            if (isCBSL && cbslTrackingNumber && status === 'at_warehouse') {
                await updateCBSLSecondTracking(cbslTrackingNumber, status);
            }

            return true;
        } else {
            console.log(`❌ Detrack update to ${status} failed for ${trackingNumber}:`, response.data);
            return false;
        }

    } catch (error) {
        console.error(`❌ Detrack API error for ${trackingNumber} (status: ${status}):`, error.message);
        return false;
    }
}

// Update CBSL second tracking number
async function updateCBSLSecondTracking(trackingNumber, status) {
    try {
        const detrackUpdateData2 = {
            do_number: trackingNumber,
            data: {
                status: status
            }
        };

        const response = await axios.put(
            'https://app.detrack.com/api/v2/dn/jobs/update',
            detrackUpdateData2,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey
                },
                timeout: 10000
            }
        );

        if (response.data.success === true || response.data.status === 'success' || response.status === 200) {
            console.log(`✅ CBSL secondary tracking ${trackingNumber} updated to ${status}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`❌ CBSL secondary update error:`, error.message);
        return false;
    }
}

// ==================================================
// ⏰ Delayed Job Scheduling System
// ==================================================

// Global delayed jobs storage
const delayedJobs = new Map();

// Update scheduleDetrackUpdate function - 30 minutes for production
async function scheduleDetrackUpdate(trackingNumber, warehouse, jobData, product, req) {
    try {
        const delayedJobId = 'delayed_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const scheduledTime = Date.now() + (30 * 60 * 1000); // 30 minutes for production

        const delayedJob = {
            jobId: delayedJobId,
            trackingNumber: trackingNumber,
            warehouse: warehouse,
            product: product,
            jobData: jobData,
            scheduledTime: scheduledTime,
            status: 'scheduled',
            createdAt: Date.now(),
            reqUser: {
                name: req.user.name,
                id: req.user._id
            },
            attemptCount: 0,
            maxAttempts: 3
        };

        // Store in memory
        delayedJobs.set(delayedJobId, delayedJob);

        console.log(`⏰ Scheduled delayed Detrack update for ${trackingNumber} (${product}) at ${new Date(scheduledTime).toLocaleTimeString()} (30 mins)`);

        // Schedule the update
        setTimeout(async () => {
            await executeDelayedDetrackUpdate(delayedJobId);
        }, 30 * 60 * 1000); // 30 minutes for production

        return delayedJobId;

    } catch (error) {
        console.error(`❌ Error scheduling delayed update for ${trackingNumber}:`, error);
        return null;
    }
}

// Update executeDelayedDetrackUpdate function - Now adds "At Warehouse" history
async function executeDelayedDetrackUpdate(delayedJobId) {
    try {
        const delayedJob = delayedJobs.get(delayedJobId);
        if (!delayedJob) {
            console.error(`❌ Delayed job not found: ${delayedJobId}`);
            return;
        }

        const { trackingNumber, warehouse, product, jobData } = delayedJob;

        console.log(`⏰ Executing delayed Detrack update for ${trackingNumber} (${product})`);

        // Update MongoDB to "At Warehouse" WITH history
        const update = {
            $set: {
                currentStatus: "At Warehouse",
                lastUpdateDateTime: moment().format(),
                warehouseEntry: "Yes",
                warehouseEntryDateTime: moment().format(),
                latestLocation: warehouse,
                lastUpdatedBy: delayedJob.reqUser.name,
                queueStatus: null, // Clear queue status
                queueScheduledTime: null,
                queueNote: null
            },
            $push: {
                history: {
                    statusHistory: "At Warehouse",
                    dateUpdated: moment().format(),
                    updatedBy: delayedJob.reqUser.name,
                    lastLocation: warehouse,
                }
            }
        };

        await ORDERS.updateOne(
            { doTrackingNumber: trackingNumber },
            update
        );

        console.log(`✅ MongoDB updated with "At Warehouse" history for delayed job ${trackingNumber}`);

        // Execute Detrack updates (delayed execution - pass jobData for CBSL)
        const detrackResults = await executeDetrackUpdates(
            trackingNumber,
            product,
            jobData.status,
            { user: delayedJob.reqUser },
            warehouse,
            true, // Is delayed execution
            jobData // Pass jobData for CBSL
        );

        const detrackSuccess = detrackResults.some(result => result.success);

        if (detrackSuccess) {
            delayedJob.status = 'completed';
            delayedJob.completedAt = Date.now();
            delayedJob.detrackResults = detrackResults;
            console.log(`✅ Delayed Detrack update completed for ${trackingNumber}`);
        } else {
            // Retry logic
            delayedJob.attemptCount++;
            // In executeDelayedDetrackUpdate function, update retry timing
            if (delayedJob.attemptCount < delayedJob.maxAttempts) {
                console.log(`🔄 Retrying delayed update for ${trackingNumber} (attempt ${delayedJob.attemptCount})`);
                setTimeout(async () => {
                    await executeDelayedDetrackUpdate(delayedJobId);
                }, 30 * 60 * 1000); // Retry after 30 minutes for production
            } else {
                delayedJob.status = 'failed';
                delayedJob.error = 'Max retries exceeded';
                console.error(`❌ Delayed Detrack update failed for ${trackingNumber} after ${delayedJob.maxAttempts} attempts`);
            }
        }

    } catch (error) {
        console.error(`❌ Error executing delayed update ${delayedJobId}:`, error);
        const delayedJob = delayedJobs.get(delayedJobId);
        if (delayedJob) {
            delayedJob.status = 'failed';
            delayedJob.error = error.message;
        }
    }
}

// ==================================================
// 🔧 Helper Functions
// ==================================================

// Map Detrack status to readable format
function mapDetrackStatus(detrackStatus) {
    if (!detrackStatus) return "Unknown";

    const status = detrackStatus.toLowerCase();

    if (status === 'info_recv') return "Info Received";
    if (status === 'on_hold') return "On Hold";
    if (status === 'shipment_delay') return "Shipment delay";
    if (status === 'custom_clearing') return "Custom Clearing";
    if (status === 'at_warehouse') return "At Warehouse";
    if (status === 'dispatched') return "In Progress/Out for Delivery/Out for Collection";
    if (status === 'completed') return "Completed";
    if (status === 'failed') return "Failed";
    if (status === 'cancelled') return "Cancelled";
    if (status === 'missing_parcel') return "Missing Parcel";
    if (status === 'in_sorting_area') return "In Sorting Area";

    return detrackStatus;
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

    const product = (groupName || '').toLowerCase();
    const owner = (jobOwner || '').toLowerCase();

    if (product === 'pure51') {
        currentProduct = 'pure51';
    } else if (product === 'cbsl') {
        currentProduct = 'cbsl';
    } else if (product === 'jpmc') {
        currentProduct = 'pharmacyjpmc';
    } else if (product === 'ld') {
        currentProduct = 'localdelivery';
    } else if (product === 'moh') {
        currentProduct = 'pharmacymoh';
    } else if (product === 'phc') {
        currentProduct = 'pharmacyphc';
    } else if (product === 'icarus') {
        currentProduct = 'icarus';
    } else if (product === 'ewe') {
        currentProduct = 'ewe';
        senderName = "EWE";
    } else if (product === 'kptdp') {
        currentProduct = 'kptdp';
    } else if (product === 'pdu') {
        currentProduct = 'pdu';
        senderName = "SYPOST";
    } else if (product === 'mglobal') {
        currentProduct = 'mglobal';
        senderName = "MGLOBAL";
    } else if (product === 'gdex' || product === 'gdext') {
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

    // Convert to string
    const phoneStr = phoneNumber.toString().trim();

    // If already starts with +, return as is
    if (phoneStr.startsWith('+')) {
        return phoneStr;
    }

    // Remove any spaces or special characters
    const cleanNumber = phoneStr.replace(/\D/g, '');

    if (cleanNumber.length === 7) {
        return "+673" + cleanNumber;
    } else if (cleanNumber.length === 10 && cleanNumber.startsWith('673')) {
        return "+" + cleanNumber;
    } else if (cleanNumber.length === 11 && cleanNumber.startsWith('673')) {
        return "+" + cleanNumber;
    } else if (cleanNumber.length === 8 && cleanNumber.startsWith('0')) {
        // Handle 08-XXXXXX format
        return "+673" + cleanNumber.substring(1);
    } else {
        // Return original if format doesn't match
        return phoneStr;
    }
}

// ==================================================
// 👥 Group IIW Results by Customer
// ==================================================

function groupIIWResultsByCustomer(results) {
    const grouped = {};

    results.forEach(item => {
        if (item.customerName && item.area) {
            const key = `${item.customerName}|${item.area}`;

            if (!grouped[key]) {
                grouped[key] = {
                    customerName: item.customerName,
                    area: item.area,
                    trackingNumbers: [],
                    count: 0,
                    status: item.status || 'Updated'
                };
            }

            grouped[key].trackingNumbers.push(item.trackingNumber);
            grouped[key].count++;
        }
    });

    return Object.values(grouped);
}

// ==================================================
// 🔧 Batch Processing Utilities
// ==================================================

// Add this helper function near your other helper functions
function determineProductType(groupName, jobOwner) {
    const product = (groupName || '').toLowerCase();
    const owner = (jobOwner || '').toLowerCase();

    if (product === 'pdu' || owner.includes('pdu')) {
        return 'PDU';
    } else if (product === 'mglobal' || owner.includes('mglobal')) {
        return 'MGLOBAL';
    } else if (product === 'ewe' || owner.includes('ewe')) {
        return 'EWE';
    } else if (product === 'gdex') {
        return 'GDEX';
    } else if (product === 'gdext') {
        return 'GDEXT';
    }
    return null;
}

// ==================================================
// ⏱ Heroku Timeout Handling
// ==================================================

// Add timeout handling for Heroku's 30-second limit
// Increase timeout for all routes (Heroku specific)
app.use((req, res, next) => {
    res.setTimeout(120000, () => { // 120 seconds timeout
        console.log('Request has timed out.');
        res.status(503).send('Service unavailable. Please try again.');
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

// ==================================================
// 🔄 Duplicate Tracking (Add this near other global variables)
// ==================================================

// Global duplicate tracker
const processedTrackingNumbers = {
    bulk: new Map(),
    onebyone: new Map()
};

// Replace the current trackDuplicate function with this improved version:
function trackDuplicate(trackingNumber, updateCode, updateMethod = 'bulk') {
    const key = `${updateCode}_${trackingNumber}`;
    const tracker = updateMethod === 'onebyone' ? processedTrackingNumbers.onebyone : processedTrackingNumbers.bulk;

    const now = Date.now();

    if (tracker.has(key)) {
        const data = tracker.get(key);
        // Only increment if not already marked as processed
        if (!data.processed) {
            data.count = (data.count || 1) + 1;
            data.lastSeen = now;
            tracker.set(key, data);
            return { isDuplicate: true, count: data.count };
        } else {
            // Already processed, don't count as duplicate
            return { isDuplicate: false, count: data.count || 1 };
        }
    } else {
        // First time seeing this tracking number
        tracker.set(key, {
            trackingNumber: trackingNumber,
            updateCode: updateCode,
            count: 1,
            firstSeen: now,
            lastSeen: now,
            processed: false,
            method: updateMethod
        });
        return { isDuplicate: false, count: 1 };
    }
}

// Clean up old entries (older than 1 hour)
setInterval(() => {
    const oneHour = 60 * 60 * 1000;
    const now = Date.now();

    // Clean bulk tracker
    for (const [key, data] of processedTrackingNumbers.bulk.entries()) {
        if (now - data.lastSeen > oneHour) {
            processedTrackingNumbers.bulk.delete(key);
        }
    }

    // Clean onebyone tracker
    for (const [key, data] of processedTrackingNumbers.onebyone.entries()) {
        if (now - data.lastSeen > oneHour) {
            processedTrackingNumbers.onebyone.delete(key);
        }
    }

    console.log(`🧹 Cleaned duplicate trackers. Bulk: ${processedTrackingNumbers.bulk.size}, OneByOne: ${processedTrackingNumbers.onebyone.size} entries`);
}, 5 * 60 * 1000); // Run every 5 minutes

// Special route for chunk processing (immediate response)
app.post('/updateJob/chunk', async (req, res) => {
    try {
        const { updateCode, mawbNum, warehouse, trackingNumbers, chunkIndex } = req.body; // Added warehouse

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

        // For IIW updates, validate warehouse if provided
        if (updateCode === 'IIW' && warehouse && warehouse.trim() === '') {
            return res.status(400).json({ error: 'Warehouse selection is required for Item in Warehouse update' });
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
            delayed: [],
            updatedCount: 0,
            failedCount: 0,
            delayedCount: 0,
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
            processJobsInBackground(jobId, {
                updateCode,
                mawbNum,
                warehouse, // Added warehouse
                trackingNumbers: uniqueTrackingNumbers,
                req
            }, {
                batchSize: 10,
                batchDelay: 300,
                isChunk: true
            });
        }, 100);

    } catch (error) {
        console.error('Chunk route error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Chunk processing failed', message: error.message });
        }
    }
});

// Replace the existing processBatch function with this updated version
async function processBatch(batch, updateCode, mawbNum, warehouse, req) {
    console.log(`🔄 Processing batch of ${batch.length} items with updateCode: ${updateCode}`);

    // Create a map to track duplicates within THIS batch
    const batchDuplicates = new Map();
    batch.forEach(trackingNumber => {
        const count = batchDuplicates.get(trackingNumber) || 0;
        batchDuplicates.set(trackingNumber, count + 1);
    });

    const batchPromises = batch.map(async (trackingNumber) => {
        try {
            // Check for duplicate WITHIN THIS BATCH first
            const batchDuplicateCount = batchDuplicates.get(trackingNumber) || 1;

            // Track in global duplicate tracker
            const duplicateCheck = trackDuplicate(trackingNumber, updateCode, 'bulk');

            // Determine if this is a duplicate that should be skipped
            let isDuplicate = false;
            let duplicateCount = 1;
            let skipReason = '';

            // If this is NOT the first occurrence in the batch, mark as duplicate
            if (batchDuplicateCount > 1) {
                // Find which occurrence this is
                let occurrence = 0;
                let isFirstOccurrence = false;

                for (let i = 0; i < batch.length; i++) {
                    if (batch[i] === trackingNumber) {
                        occurrence++;
                        if (i === batch.indexOf(trackingNumber)) {
                            // This is the first occurrence in the array
                            isFirstOccurrence = true;
                            break;
                        }
                    }
                }

                // If not first occurrence and we've seen it before in this batch, skip
                if (!isFirstOccurrence && occurrence > 1) {
                    console.log(`⏭️ Skipping duplicate within batch: ${trackingNumber} (occurrence ${occurrence} of ${batchDuplicateCount})`);
                    isDuplicate = true;
                    duplicateCount = batchDuplicateCount;
                    skipReason = `Duplicate within batch (occurrence ${occurrence}/${batchDuplicateCount})`;
                }
            }

            // Also check if this tracking number was already processed globally
            if (duplicateCheck.isDuplicate && duplicateCheck.count > 1) {
                console.log(`⏭️ Skipping globally duplicate: ${trackingNumber} (seen ${duplicateCheck.count} times globally)`);
                isDuplicate = true;
                duplicateCount = duplicateCheck.count;
                skipReason = `Global duplicate (seen ${duplicateCheck.count} times)`;
            }

            // If duplicate, return duplicate result immediately
            if (isDuplicate) {
                return {
                    success: false,
                    message: skipReason,
                    isDuplicate: true,
                    duplicateCount: duplicateCount,
                    trackingNumber: trackingNumber
                };
            }

            // Mark as being processed in the duplicate tracker
            const key = `${updateCode}_${trackingNumber}`;
            const data = processedTrackingNumbers.bulk.get(key);
            if (data) {
                data.processed = true;
                processedTrackingNumbers.bulk.set(key, data);
            }

            // Process the update only if not a duplicate
            let result;
            if (updateCode === 'IIW') {
                result = await processItemInWarehouseUpdate(trackingNumber, warehouse, req);
            } else if (updateCode === 'UAN') {
                const success = await processMAWBUpdate(trackingNumber, mawbNum, req);
                result = {
                    success: success,
                    message: success ? `MAWB updated to ${mawbNum}` : 'MAWB update failed'
                };
            } else if (updateCode === 'CCH') {
                const success = await processOnHoldUpdate(trackingNumber, req);
                result = {
                    success: success,
                    message: success ? 'Put on hold' : 'On hold update failed'
                };
            } else if (['H9', 'H18', 'H19', 'H27', 'H31'].includes(updateCode)) {
                const gdexHoldResult = await processGDEXHoldUpdate(trackingNumber, updateCode, req);
                result = {
                    success: gdexHoldResult.success,
                    message: gdexHoldResult.message || 'GDEX Hold update failed'
                };
            } else if (updateCode === 'UMN') {
                const success = await processUMNUpdate(trackingNumber, mawbNum, req);
                return {
                    success: success,
                    message: success ? `MAWB updated to ${mawbNum}` : 'UMN update failed'
                };
            } else {
                result = {
                    success: false,
                    message: `Unsupported update code: ${updateCode}`
                };
            }

            // Add tracking number to result
            result.trackingNumber = trackingNumber;
            return result;

        } catch (error) {
            console.error(`❌ Error processing ${trackingNumber}:`, error);
            return {
                success: false,
                message: 'Error: ' + error.message,
                trackingNumber: trackingNumber
            };
        }
    });

    const batchResults = await Promise.allSettled(batchPromises);

    // Process results
    const results = {
        successful: [],
        failed: [],
        delayed: [],
        duplicate: [], // Duplicate entries
        updatedCount: 0,
        failedCount: 0,
        delayedCount: 0,
        duplicateCount: 0
    };

    batchResults.forEach((result, index) => {
        const trackingNumber = batch[index];

        if (result.status === 'fulfilled' && result.value) {
            const value = result.value;

            if (value.isDuplicate) {
                // Add to duplicates array
                results.duplicate.push({
                    trackingNumber: value.trackingNumber || trackingNumber,
                    result: value.message,
                    duplicateCount: value.duplicateCount || 1,
                    status: "Duplicate"
                });
                results.duplicateCount++;
            } else if (value.delayed) {
                results.delayed.push({
                    trackingNumber: value.trackingNumber || trackingNumber,
                    result: value.message,
                    product: value.delayedInfo?.product,
                    scheduledTime: value.delayedInfo?.scheduledTime,
                    currentStatus: value.delayedInfo?.currentStatus,
                    status: "Queued (5 min)"
                });
                results.delayedCount++;
            } else if (value.success) {
                // Mark as processed in the duplicate tracker
                const key = `${updateCode}_${trackingNumber}`;
                const data = processedTrackingNumbers.bulk.get(key);
                if (data) {
                    data.processed = true;
                    processedTrackingNumbers.bulk.set(key, data);
                }

                results.successful.push({
                    trackingNumber: value.trackingNumber || trackingNumber,
                    result: value.message,
                    status: "Updated"
                });
                results.updatedCount++;
            } else {
                results.failed.push({
                    trackingNumber: value.trackingNumber || trackingNumber,
                    result: value.message,
                    status: "Failed"
                });
                results.failedCount++;
            }
        } else {
            results.failed.push({
                trackingNumber: trackingNumber,
                result: 'Processing error',
                status: "Error"
            });
            results.failedCount++;
        }
    });

    console.log(`📊 Batch results: ${results.updatedCount} updated, ${results.failedCount} failed, ${results.delayedCount} delayed, ${results.duplicateCount} duplicates`);

    // Add grouping for IIW results
    if (updateCode === 'IIW') {
        results.groupedByCustomer = groupIIWResultsByCustomer([
            ...results.successful,
            ...results.delayed
        ]);
        console.log(`👥 Grouped into ${results.groupedByCustomer.length} customer groups`);
    }

    return results;
}

// Add route to check delayed jobs
app.get('/updateJob/delayed/status', ensureAuthenticated, (req, res) => {
    try {
        const delayedJobsArray = Array.from(delayedJobs.values())
            .filter(job => job.reqUser && job.reqUser.id === req.user._id)
            .map(job => ({
                jobId: job.jobId,
                trackingNumber: job.trackingNumber,
                product: job.product,
                status: job.status,
                scheduledTime: new Date(job.scheduledTime).toLocaleString(),
                createdAt: new Date(job.createdAt).toLocaleString(),
                completedAt: job.completedAt ? new Date(job.completedAt).toLocaleString() : null,
                error: job.error
            }));

        res.json({
            count: delayedJobsArray.length,
            jobs: delayedJobsArray
        });
    } catch (error) {
        console.error('Error getting delayed jobs status:', error);
        res.status(500).json({ error: 'Failed to get delayed jobs status' });
    }
});

// Add cleanup for completed delayed jobs
setInterval(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    for (const [jobId, job] of delayedJobs.entries()) {
        if ((job.status === 'completed' || job.status === 'failed') &&
            (now - job.createdAt) > oneDay) {
            delayedJobs.delete(jobId);
            console.log(`🧹 Cleaned up old delayed job: ${jobId}`);
        }
    }
}, 60 * 60 * 1000); // Run every hour

// In the processJobsInBackground function, ensure duplicate results are properly merged
async function processJobsInBackground(jobId, jobData, options = {}) {
    const { updateCode, mawbNum, warehouse, trackingNumbers, req } = jobData;
    const {
        batchSize = 10,
        batchDelay = 500,
        isChunk = false
    } = options;

    const results = {
        successful: [],
        failed: [],
        delayed: [],
        duplicate: [], // Ensure this array exists
        updatedCount: 0,
        failedCount: 0,
        delayedCount: 0,
        duplicateCount: 0, // Ensure this count exists
        status: 'processing',
        total: trackingNumbers.length,
        processed: 0,
        startTime: Date.now(),
        isChunk: isChunk
    };

    backgroundJobs.set(jobId, { ...results, status: 'processing' });

    try {
        const totalBatches = Math.ceil(trackingNumbers.length / batchSize);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const start = batchIndex * batchSize;
            const end = Math.min(start + batchSize, trackingNumbers.length);
            const batch = trackingNumbers.slice(start, end);

            // Process batch
            const batchResults = await processBatch(batch, updateCode, mawbNum, warehouse, req);

            // Merge results - IMPORTANT: Make sure duplicates are included
            results.successful.push(...(batchResults.successful || []));
            results.failed.push(...(batchResults.failed || []));
            results.delayed.push(...(batchResults.delayed || []));
            results.duplicate.push(...(batchResults.duplicate || [])); // This line is critical
            results.updatedCount += (batchResults.updatedCount || 0);
            results.failedCount += (batchResults.failedCount || 0);
            results.delayedCount += (batchResults.delayedCount || 0);
            results.duplicateCount += (batchResults.duplicateCount || 0); // This line is critical
            results.processed = start + batch.length;

            // Merge grouped results for IIW
            if (updateCode === 'IIW' && batchResults.groupedByCustomer) {
                results.groupedByCustomer = results.groupedByCustomer || [];
                results.groupedByCustomer.push(...batchResults.groupedByCustomer);
            }

            // Update job progress
            backgroundJobs.set(jobId, {
                ...results,
                status: 'processing',
                totalBatches: totalBatches,
                currentBatch: batchIndex + 1
            });

            // Delay between batches
            if (batchIndex < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, batchDelay));
            }
        }

        results.status = 'completed';
        results.processingTime = Date.now() - results.startTime;

        // Log final results for debugging
        console.log(`✅ Job ${jobId} completed:`, {
            updated: results.updatedCount,
            failed: results.failedCount,
            delayed: results.delayedCount,
            duplicates: results.duplicateCount,
            total: results.total
        });

        backgroundJobs.set(jobId, results);

    } catch (error) {
        console.error('Background job error:', error);
        results.status = 'failed';
        results.error = error.message;
        backgroundJobs.set(jobId, results);
    }
}

// Test route for POD download testing
app.get('/testPOD', ensureAuthenticated, (req, res) => {
    res.render('testPOD', {
        title: 'Test POD Download',
        user: req.user
    });
});

// API endpoint for testing POD download
app.post('/api/test/pod-download', ensureAuthenticated, async (req, res) => {
    try {
        const { trackingNumber } = req.body;

        if (!trackingNumber) {
            return res.status(400).json({
                success: false,
                error: 'Tracking number required'
            });
        }

        console.log(`=== TEST POD Download for: ${trackingNumber} ===`);

        // Step 1: Get Detrack data
        const detrackResponse = await axios.get(
            `https://app.detrack.com/api/v2/dn/jobs/show/?do_number=${trackingNumber}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey
                },
                timeout: 10000
            }
        );

        const detrackData = detrackResponse.data.data;

        if (!detrackData) {
            return res.status(404).json({
                success: false,
                error: 'Tracking number not found in Detrack'
            });
        }

        const result = {
            trackingNumber,
            product: detrackData.group_name,
            status: detrackData.status,
            hasPhoto: !!detrackData.photo_1_file_url,
            photoUrl: detrackData.photo_1_file_url || null,
            attempts: [],
            base64Data: null,
            base64Length: 0,
            downloadSuccess: false
        };

        // Step 2: Test download if photo exists
        if (detrackData.photo_1_file_url) {
            console.log(`📸 Photo URL found, attempting download...`);

            // Try immediate download
            const downloadResult = await testDownloadImage(
                detrackData.photo_1_file_url,
                trackingNumber
            );

            result.attempts = downloadResult.attempts;
            result.base64Data = downloadResult.base64;
            result.base64Length = downloadResult.base64Length;
            result.downloadSuccess = downloadResult.success;

            // Log Base64 preview (first 100 chars)
            if (downloadResult.base64) {
                console.log(`✅ Base64 preview: ${downloadResult.base64.substring(0, 100)}...`);
            }
        } else {
            console.log(`⚠️ No photo URL available for ${trackingNumber}`);
        }

        console.log(`📊 Test completed for ${trackingNumber}`);

        return res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error(`❌ Test error for ${req.body.trackingNumber}:`, error.message);

        return res.status(500).json({
            success: false,
            error: error.message,
            trackingNumber: req.body.trackingNumber
        });
    }
});

// Helper function for testing download only
async function testDownloadImage(imageUrl, consignmentID) {
    const result = {
        originalUrl: imageUrl,
        attempts: [],
        base64: null,
        base64Length: 0,
        success: false
    };

    // Attempt 1: Try original URL
    try {
        console.log(`   Attempt 1: Original URL`);
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            headers: {
                'X-API-KEY': apiKey,
                'Accept': 'image/*'
            },
            timeout: 8000
        });

        result.attempts.push({
            number: 1,
            type: 'original_url',
            status: 'success',
            bytes: response.data.length,
            message: `Downloaded ${response.data.length} bytes`
        });

        // Convert to Base64
        const base64Image = response.data.toString('base64');
        result.base64 = base64Image;
        result.base64Length = base64Image.length;
        result.success = true;

        console.log(`   ✅ Success on first attempt: ${base64Image.length} chars`);
        return result;

    } catch (error1) {
        console.log(`   ❌ Attempt 1 failed: ${error1.message}`);
        result.attempts.push({
            number: 1,
            type: 'original_url',
            status: 'failed',
            error: error1.message,
            statusCode: error1.response?.status
        });

        // Attempt 2: Refresh URL and try again
        try {
            console.log(`   Attempt 2: Refreshing URL...`);

            const refreshResponse = await axios.get(
                `https://app.detrack.com/api/v2/dn/jobs/show/?do_number=${consignmentID}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': apiKey
                    },
                    timeout: 5000
                }
            );

            if (refreshResponse.data.data?.photo_1_file_url) {
                console.log(`   Got fresh URL, attempting download...`);

                const retryResponse = await axios.get(
                    refreshResponse.data.data.photo_1_file_url,
                    {
                        responseType: 'arraybuffer',
                        headers: {
                            'X-API-KEY': apiKey,
                            'Accept': 'image/*'
                        },
                        timeout: 8000
                    }
                );

                result.attempts.push({
                    number: 2,
                    type: 'refreshed_url',
                    status: 'success',
                    bytes: retryResponse.data.length,
                    message: `Downloaded ${retryResponse.data.length} bytes from refreshed URL`
                });

                // Convert to Base64
                const base64Image = retryResponse.data.toString('base64');
                result.base64 = base64Image;
                result.base64Length = base64Image.length;
                result.success = true;

                console.log(`   ✅ Success on second attempt: ${base64Image.length} chars`);
                return result;

            } else {
                result.attempts.push({
                    number: 2,
                    type: 'refreshed_url',
                    status: 'failed',
                    error: 'No photo URL in refreshed data'
                });
            }

        } catch (error2) {
            console.log(`   ❌ Attempt 2 failed: ${error2.message}`);
            result.attempts.push({
                number: 2,
                type: 'refreshed_url',
                status: 'failed',
                error: error2.message
            });
        }
    }

    return result;
}

// ==================================================
// 🐛 Debug Route for MAWB Data
// ==================================================

app.get('/updateJob/debug/mawbs', ensureAuthenticated, async (req, res) => {
    try {
        const sevenDaysAgo = moment().subtract(7, 'days').toDate();

        // Get raw data for debugging
        const debugData = await ORDERS.aggregate([
            {
                $match: {
                    lastUpdateDateTime: { $gte: sevenDaysAgo },
                    mawbNo: { $exists: true, $ne: '' }
                }
            },
            {
                $group: {
                    _id: '$mawbNo',
                    total: { $sum: 1 },
                    scanned: {
                        $sum: {
                            $cond: [{ $eq: ['$warehouseEntry', 'Yes'] }, 1, 0]
                        }
                    },
                    products: { $addToSet: '$product' },
                    latestUpdate: { $max: '$lastUpdateDateTime' },
                    sampleTracking: { $first: '$doTrackingNumber' }
                }
            },
            {
                $project: {
                    mawbNo: '$_id',
                    total: 1,
                    scanned: 1,
                    unscanned: { $subtract: ['$total', '$scanned'] },
                    products: 1,
                    latestUpdate: 1,
                    sampleTracking: 1,
                    allScanned: { $eq: ['$scanned', '$total'] }
                }
            },
            { $sort: { latestUpdate: -1 } },
            { $limit: 100 }
        ]);

        // Get total counts
        const totalCount = await ORDERS.countDocuments({
            lastUpdateDateTime: { $gte: sevenDaysAgo },
            mawbNo: { $exists: true, $ne: '' }
        });

        const withMAWBScanned = await ORDERS.countDocuments({
            lastUpdateDateTime: { $gte: sevenDaysAgo },
            mawbNo: { $exists: true, $ne: '' },
            warehouseEntry: 'Yes'
        });

        const withMAWBUnscanned = await ORDERS.countDocuments({
            lastUpdateDateTime: { $gte: sevenDaysAgo },
            mawbNo: { $exists: true, $ne: '' },
            warehouseEntry: { $ne: 'Yes' }
        });

        res.json({
            success: true,
            stats: {
                totalOrdersWithMAWB: totalCount,
                scanned: withMAWBScanned,
                unscanned: withMAWBUnscanned,
                uniqueMAWBs: debugData.length
            },
            mawbs: debugData,
            queryInfo: {
                dateRange: `Last 7 days (from ${sevenDaysAgo.toISOString()})`,
                currentTime: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Debug route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================================================
// 📁 Excel Template Generation
// ==================================================

app.get('/templates/UAN_template.xlsx', ensureAuthenticated, (req, res) => {
    try {
        console.log('📋 Generating UAN Excel template...');

        // Create simple data array
        const data = [
            ['Tracking Number', 'MAWB Number', 'Postal Code', 'Parcel Weight (kg)'],
            ['EXAMPLE001', 'MAWB123456', 'BE1234', '1.5'],
            ['EXAMPLE002', 'MAWB123456', 'BE5678', '2.0'],
            ['EXAMPLE003', 'MAWB789012', '', '0.8'],
            ['EXAMPLE004', 'MAWB789012', 'BE9012', ''],
            ['', '', '', ''],
            ['=== INSTRUCTIONS ===', '', '', ''],
            ['1. Tracking Number and MAWB Number are REQUIRED', '', '', ''],
            ['2. Postal Code and Parcel Weight are OPTIONAL', '', '', ''],
            ['3. Do NOT modify column headers', '', '', ''],
            ['4. Save as .xlsx, .xls, or .csv file', '', '', ''],
            ['5. Only jobs with "Info Received" status will be processed', '', '', ''],
            ['6. Maximum 3000 records per file', '', '', ''],
            ['7. Remove sample data before uploading', '', '', '']
        ];

        // Create workbook
        const XLSX = require('xlsx');
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'UAN Template');

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set headers and send
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="UAN_template.xlsx"');
        res.send(buffer);

        console.log('✅ Excel template sent successfully');

    } catch (error) {
        console.error('❌ Error generating Excel template:', error);
        // Fallback to CSV if Excel fails
        sendCSVTemplate(res);
    }
});

app.get('/templates/UAN_template.csv', ensureAuthenticated, (req, res) => {
    sendCSVTemplate(res);
});

function sendCSVTemplate(res) {
    try {
        console.log('📋 Generating CSV template...');

        const csvContent = `Tracking Number,MAWB Number,Postal Code,Parcel Weight (kg)
EXAMPLE001,MAWB123456,BE1234,1.5
EXAMPLE002,MAWB123456,BE5678,2.0
EXAMPLE003,MAWB789012,,0.8
EXAMPLE004,MAWB789012,BE9012,

=== INSTRUCTIONS ===
1. Tracking Number and MAWB Number are REQUIRED
2. Postal Code and Parcel Weight are OPTIONAL
3. Do NOT modify column headers
4. Save as .csv file
5. Only jobs with "Info Received" status will be processed
6. Maximum 3000 records per file
7. Remove sample data before uploading`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="UAN_template.csv"');
        res.send(csvContent);

        console.log('✅ CSV template sent successfully');

    } catch (error) {
        console.error('❌ Error generating CSV template:', error);
        res.status(500).send('Error generating template file');
    }
}

// ==================================================
// 🔄 Enhanced Excel Processing with Retry Logic
// ==================================================

async function processExcelUploadWithRetry(jobId, mawbNum, data, req) {
    const job = backgroundJobs.get(jobId);
    if (!job) {
        console.error(`❌ Job ${jobId} not found`);
        return;
    }

    const results = {
        successful: [],
        failed: [],
        updatedCount: 0,
        failedCount: 0,
        status: 'processing',
        total: data.length,
        processed: 0,
        startTime: Date.now(),
        retries: [],
        productRestrictionFailures: 0 // Add this counter
    };

    backgroundJobs.set(jobId, { ...job, ...results, status: 'processing' });

    try {
        // Process in smaller batches to avoid timeouts
        const BATCH_SIZE = 50; // Smaller batches
        const BATCH_DELAY = 1000; // 1 second between batches
        const MAX_RETRIES = 3; // Max retries per item

        const totalBatches = Math.ceil(data.length / BATCH_SIZE);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const start = batchIndex * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, data.length);
            const batch = data.slice(start, end);

            console.log(`🔄 Processing batch ${batchIndex + 1}/${totalBatches} for job ${jobId}`);

            // Process batch with retry logic
            const batchResults = await processBatchWithRetry(batch, mawbNum, req, MAX_RETRIES);

            // Merge results
            results.successful.push(...batchResults.successful);
            results.failed.push(...batchResults.failed);
            results.updatedCount += batchResults.updatedCount;
            results.failedCount += batchResults.failedCount;
            results.processed = end;

            // Track product restriction failures
            if (batchResults.productRestrictionFailures) {
                results.productRestrictionFailures += batchResults.productRestrictionFailures;
            }

            if (batchResults.retries && batchResults.retries.length > 0) {
                results.retries.push(...batchResults.retries);
            }

            // Update progress
            backgroundJobs.set(jobId, {
                ...results,
                status: 'processing',
                currentBatch: batchIndex + 1,
                totalBatches: totalBatches,
                progress: Math.round((results.processed / results.total) * 100)
            });

            // Delay between batches (except last one)
            if (batchIndex < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
        }

        // Check if we have retries to process
        if (results.retries.length > 0) {
            console.log(`🔄 Processing ${results.retries.length} retries for job ${jobId}`);

            const retryResults = await processRetryItems(results.retries, mawbNum, req);

            // Merge retry results
            results.successful.push(...retryResults.successful);
            results.failed.push(...retryResults.failed);
            results.updatedCount += retryResults.updatedCount;
            results.failedCount += retryResults.failedCount;

            // Track product restriction failures from retries
            if (retryResults.productRestrictionFailures) {
                results.productRestrictionFailures += retryResults.productRestrictionFailures;
            }
        }

        results.status = 'completed';
        results.processingTime = Date.now() - results.startTime;
        backgroundJobs.set(jobId, results);

        // Log summary including product restriction info
        console.log(`✅ Job ${jobId} completed:`);
        console.log(`   Total processed: ${results.total}`);
        console.log(`   Successfully updated: ${results.updatedCount}`);
        console.log(`   Failed: ${results.failedCount}`);
        console.log(`   Failed due to product restrictions: ${results.productRestrictionFailures}`);
        console.log(`   Processing time: ${results.processingTime}ms`);

    } catch (error) {
        console.error(`❌ Job ${jobId} processing error:`, error);
        results.status = 'failed';
        results.error = error.message;
        backgroundJobs.set(jobId, results);
    }
}

async function processBatchWithRetry(batch, mawbNum, req, maxRetries = 3) {
    const results = {
        successful: [],
        failed: [],
        updatedCount: 0,
        failedCount: 0,
        retries: [], // Items to retry
        productRestrictionFailures: 0
    };

    const allowedProducts = ['mglobal', 'pdu', 'ewe', 'gdex', 'gdext'];

    const promises = batch.map(async (item) => {
        let retryCount = 0;
        let lastError = null;
        let lastResult = null;

        while (retryCount <= maxRetries) {
            try {
                // Add delay for retries (except first attempt)
                if (retryCount > 0) {
                    const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000); // Exponential backoff
                    console.log(`⏳ Retry ${retryCount}/${maxRetries} for ${item.trackingNumber} after ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                // Process the update
                const result = await processUANUpdateWithAdditionalFields(
                    item.trackingNumber,
                    mawbNum,
                    item.postalCode,
                    item.parcelWeight,
                    req
                );

                // Store the result for analysis
                lastResult = result;

                if (result.success) {
                    results.successful.push({
                        trackingNumber: item.trackingNumber,
                        result: `MAWB updated to ${mawbNum}`,
                        attempts: retryCount + 1,
                        message: result.message
                    });
                    results.updatedCount++;
                    console.log(`✅ ${item.trackingNumber}: MAWB updated to ${mawbNum} (attempt ${retryCount + 1})`);
                    return; // Success, exit retry loop
                } else {
                    // Check if failure is due to product restriction
                    const isProductRestriction = result.reason === 'Product not allowed' ||
                        result.message?.includes('not allowed for UAN') ||
                        result.skipped === true && result.reason === 'Product not allowed';

                    if (isProductRestriction) {
                        results.productRestrictionFailures++;
                        // Don't retry for product restrictions
                        results.failed.push({
                            trackingNumber: item.trackingNumber,
                            result: result.reason || 'Product not allowed',
                            message: result.message,
                            attempts: retryCount + 1,
                            isProductRestriction: true
                        });
                        results.failedCount++;
                        console.log(`🚫 ${item.trackingNumber}: Product not allowed - ${result.message}`);
                        return; // Exit for product restriction
                    }

                    // Check if it's a "skipped" item (wrong status, already at warehouse, etc.)
                    if (result.skipped) {
                        // Don't retry skipped items
                        results.failed.push({
                            trackingNumber: item.trackingNumber,
                            result: result.reason || 'Skipped',
                            message: result.message,
                            attempts: retryCount + 1,
                            isSkipped: true
                        });
                        results.failedCount++;
                        console.log(`⚠️ ${item.trackingNumber}: Skipped - ${result.message}`);
                        return; // Exit for skipped items
                    }

                    // For other failures, prepare to retry
                    lastError = new Error(result.message || 'Update failed');
                    retryCount++;

                    if (retryCount <= maxRetries) {
                        console.log(`🔄 ${item.trackingNumber}: Update failed, retrying (${retryCount}/${maxRetries})`);
                    }
                }

            } catch (error) {
                lastError = error;
                retryCount++;

                // If it's a timeout error, we should retry
                if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                    console.log(`⏱️ ${item.trackingNumber}: Timeout, will retry (${retryCount}/${maxRetries})`);

                    if (retryCount <= maxRetries) {
                        continue; // Continue to next retry attempt
                    }
                } else {
                    // Other errors might not benefit from retry
                    console.log(`❌ ${item.trackingNumber}: Non-retryable error - ${error.message}`);
                    break;
                }
            }
        }

        // If we exhausted retries or got a non-retryable error
        if (retryCount > maxRetries || lastError) {
            const isRetryableError = lastError?.code === 'ECONNABORTED' ||
                lastError?.message?.includes('timeout') ||
                lastError?.message?.includes('network');

            results.failed.push({
                trackingNumber: item.trackingNumber,
                result: lastError?.message || 'Max retries exceeded',
                message: lastError?.message || 'Failed after all retries',
                attempts: retryCount,
                lastResult: lastResult
            });
            results.failedCount++;

            // Add to retries list if it was a timeout/network error and we haven't hit max retries
            if (isRetryableError && retryCount <= maxRetries) {
                results.retries.push({
                    ...item,
                    retryCount: retryCount,
                    lastError: lastError?.message,
                    lastResult: lastResult
                });
                console.log(`🔁 ${item.trackingNumber}: Added to retry queue (${retryCount} attempts so far)`);
            } else {
                console.log(`❌ ${item.trackingNumber}: Failed permanently - ${lastError?.message || 'Unknown error'}`);
            }
        }
    });

    // Process with concurrency limit
    const CONCURRENCY = 10; // Process 10 items at a time
    for (let i = 0; i < promises.length; i += CONCURRENCY) {
        const chunk = promises.slice(i, i + CONCURRENCY);
        await Promise.allSettled(chunk);
    }

    // Log batch summary
    console.log(`📊 Batch completed:`);
    console.log(`   Successful: ${results.updatedCount}`);
    console.log(`   Failed: ${results.failedCount}`);
    console.log(`   Product restriction failures: ${results.productRestrictionFailures}`);
    console.log(`   Items to retry: ${results.retries.length}`);

    return results;
}

async function processRetryItems(retryItems, mawbNum, req) {
    const results = {
        successful: [],
        failed: [],
        updatedCount: 0,
        failedCount: 0,
        productRestrictionFailures: 0
    };

    // Process retries one by one with longer delays
    for (const item of retryItems) {
        try {
            console.log(`🔄 Final retry attempt for ${item.trackingNumber} (previous attempts: ${item.retryCount})`);

            // Longer delay for final retries
            await new Promise(resolve => setTimeout(resolve, 2000));

            const result = await processUANUpdateWithAdditionalFields(
                item.trackingNumber,
                mawbNum,
                item.postalCode,
                item.parcelWeight,
                req
            );

            if (result.success) {
                results.successful.push({
                    trackingNumber: item.trackingNumber,
                    result: `MAWB updated to ${mawbNum} (after retry)`,
                    attempts: item.retryCount + 1,
                    message: result.message
                });
                results.updatedCount++;
                console.log(`✅ ${item.trackingNumber}: Retry successful - MAWB updated`);
            } else {
                // Check for product restriction in retry (shouldn't happen, but just in case)
                const isProductRestriction = result.reason === 'Product not allowed' ||
                    result.message?.includes('not allowed for UAN');

                if (isProductRestriction) {
                    results.productRestrictionFailures++;
                }

                results.failed.push({
                    trackingNumber: item.trackingNumber,
                    result: result.reason || 'Failed after all retries',
                    message: result.message || 'Update failed',
                    attempts: item.retryCount + 1,
                    isProductRestriction: isProductRestriction,
                    finalAttempt: true
                });
                results.failedCount++;
                console.log(`❌ ${item.trackingNumber}: Final retry failed - ${result.message}`);
            }

        } catch (error) {
            results.failed.push({
                trackingNumber: item.trackingNumber,
                result: `Error: ${error.message}`,
                message: `Error during final retry: ${error.message}`,
                attempts: item.retryCount + 1,
                finalAttempt: true
            });
            results.failedCount++;
            console.log(`💥 ${item.trackingNumber}: Error during final retry - ${error.message}`);
        }
    }

    // Log retry summary
    if (retryItems.length > 0) {
        console.log(`📊 Retry batch completed:`);
        console.log(`   Retry successful: ${results.updatedCount}`);
        console.log(`   Retry failed: ${results.failedCount}`);
        console.log(`   Product restriction failures in retry: ${results.productRestrictionFailures}`);
    }

    return results;
}

// ==================================================
// 🔄 Enhanced UAN Processing for Existing Orders
// ==================================================

async function processUANUpdateWithAdditionalFields(trackingNumber, mawbNum, postalCode, parcelWeight, req) {
    try {
        console.log(`🔍 Processing ${trackingNumber} for MAWB: ${mawbNum}`);

        // Check if order already exists in MongoDB
        const existingOrder = await ORDERS.findOne({ doTrackingNumber: trackingNumber });

        if (existingOrder) {
            console.log(`📦 Order exists in MongoDB for ${trackingNumber}`);

            // Check current status
            console.log(`   Current MAWB: ${existingOrder.mawbNo || 'None'}`);
            console.log(`   Current Status: ${existingOrder.currentStatus || 'Unknown'}`);
            console.log(`   Warehouse Entry: ${existingOrder.warehouseEntry || 'No'}`);
            console.log(`   Product: ${existingOrder.product || 'Unknown'}`);

            // ========== IMPORTANT: VALIDATE PRODUCT FOR UAN ==========
            const allowedProducts = ['mglobal', 'pdu', 'ewe', 'gdex', 'gdext'];
            const currentProduct = existingOrder.product?.toLowerCase() || '';

            if (!allowedProducts.includes(currentProduct)) {
                console.log(`❌ Skipping ${trackingNumber} - Product "${currentProduct}" not allowed for UAN update`);
                console.log(`   Allowed products: ${allowedProducts.join(', ')}`);
                return {
                    success: false,
                    skipped: true,
                    reason: 'Product not allowed',
                    message: `Product "${currentProduct}" is not allowed for UAN/MAWB updates`
                };
            }

            // ========== DON'T UPDATE IF ALREADY AT WAREHOUSE ==========
            if (existingOrder.warehouseEntry === "Yes") {
                console.log(`⚠️ Skipping ${trackingNumber} - Already at warehouse`);
                return {
                    success: false,
                    skipped: true,
                    reason: 'Already at warehouse',
                    message: 'Job already scanned at warehouse, cannot update MAWB'
                };
            }

            // ========== DON'T UPDATE IF NOT "Info Received" STATUS ==========
            if (existingOrder.currentStatus !== "Info Received") {
                console.log(`⚠️ Skipping ${trackingNumber} - Status is "${existingOrder.currentStatus}", not "Info Received"`);
                return {
                    success: false,
                    skipped: true,
                    reason: 'Wrong status',
                    message: `Job status is "${existingOrder.currentStatus}", must be "Info Received" for UAN update`
                };
            }

            // ========== UPDATE EXISTING ORDER ==========
            const updateFields = {
                mawbNo: mawbNum,
                lastUpdateDateTime: moment().format(),
                lastUpdatedBy: req.user.name
            };

            if (postalCode) updateFields.receiverPostalCode = postalCode.toUpperCase();
            if (parcelWeight) updateFields.parcelWeight = parseFloat(parcelWeight) || 0;

            await ORDERS.updateOne(
                { doTrackingNumber: trackingNumber },
                { $set: updateFields }
            );

            console.log(`✅ Updated existing order in MongoDB`);

        } else {
            // Order doesn't exist - create new one
            console.log(`🆕 Creating new order for ${trackingNumber}`);

            // Get job details from Detrack
            const jobData = await getJobDetailsWithRetry(trackingNumber);
            if (!jobData) {
                console.log(`❌ Job ${trackingNumber} not found in Detrack`);
                return {
                    success: false,
                    reason: 'Not found in Detrack',
                    message: 'Job not found in Detrack'
                };
            }

            // Check status
            if (jobData.status !== 'info_recv') {
                console.log(`❌ Job status must be "info_recv", found: ${jobData.status}`);
                return {
                    success: false,
                    reason: 'Wrong status',
                    message: `Job status is "${jobData.status}", must be "info_recv" for UAN update`
                };
            }

            // Get product info - FIXED LOGIC
            console.log(`📊 Detrack job data for ${trackingNumber}:`);
            console.log(`   - group_name: ${jobData.group_name}`);
            console.log(`   - job_owner: ${jobData.job_owner}`);
            console.log(`   - status: ${jobData.status}`);

            const { currentProduct, senderName } = getProductInfo(jobData.group_name, jobData.job_owner);
            console.log(`✅ Detected product: ${currentProduct}, sender: ${senderName}`);

            // ========== VALIDATE ALLOWED PRODUCTS FOR UAN ==========
            const allowedProducts = ['mglobal', 'pdu', 'ewe', 'gdex', 'gdext'];
            if (!allowedProducts.includes(currentProduct)) {
                console.log(`❌ Product "${currentProduct}" not allowed for UAN update`);
                console.log(`   Allowed products: ${allowedProducts.join(', ')}`);
                return {
                    success: false,
                    skipped: true,
                    reason: 'Product not allowed',
                    message: `Product "${currentProduct}" is not allowed for UAN/MAWB updates. Allowed: ${allowedProducts.join(', ')}`
                };
            }

            // Create new order
            console.log(`🏷️ Creating new order for product: ${currentProduct.toUpperCase()}`);
            const success = await createNewOrderWithRules(jobData, trackingNumber, mawbNum, req, currentProduct);
            if (!success) return { success: false, reason: 'MongoDB creation failed' };

            // Update additional fields if provided
            if (postalCode || parcelWeight) {
                const updateFields = {};
                if (postalCode) updateFields.receiverPostalCode = postalCode.toUpperCase();
                if (parcelWeight) updateFields.parcelWeight = parseFloat(parcelWeight) || 0;

                await ORDERS.updateOne(
                    { doTrackingNumber: trackingNumber },
                    { $set: updateFields }
                );
            }
        }

        // Update Detrack - FIXED PRODUCT DETECTION
        console.log(`🔄 Updating Detrack for ${trackingNumber}`);

        let productForDetrack = '';
        let jobDataForDetrack = null;

        if (existingOrder) {
            productForDetrack = existingOrder.product?.toLowerCase() || '';
            jobDataForDetrack = await getJobDetailsWithRetry(trackingNumber);
        } else {
            // For new orders, get fresh data
            jobDataForDetrack = await getJobDetailsWithRetry(trackingNumber);
            const { currentProduct } = getProductInfo(jobDataForDetrack?.group_name, jobDataForDetrack?.job_owner);
            productForDetrack = currentProduct;
        }

        console.log(`✅ Final product for Detrack update: ${productForDetrack}`);

        // Double-check product validation before Detrack update
        const allowedProducts = ['mglobal', 'pdu', 'ewe', 'gdex', 'gdext'];
        if (!allowedProducts.includes(productForDetrack)) {
            console.log(`❌ Final validation failed for ${trackingNumber} - Product "${productForDetrack}" not allowed`);
            return {
                success: false,
                reason: 'Product validation failed',
                message: `Product "${productForDetrack}" not allowed for UAN updates`
            };
        }

        const updateData = createDetrackUpdateData(trackingNumber, mawbNum, productForDetrack, jobDataForDetrack || {}, false);
        if (postalCode) updateData.data.postal_code = postalCode.toUpperCase();
        if (parcelWeight) updateData.data.weight = parseFloat(parcelWeight) || 0;

        console.log(`📤 Detrack update payload:`);
        console.log(JSON.stringify(updateData, null, 2));

        const detrackResult = await sendDetrackUpdateWithRetry(trackingNumber, updateData, mawbNum);

        if (detrackResult) {
            console.log(`✅ ${trackingNumber}: MAWB updated to ${mawbNum}`);
            return {
                success: true,
                isNewOrder: !existingOrder,
                wasUpdated: !!existingOrder,
                message: existingOrder ? `Updated existing order to MAWB ${mawbNum}` : `Created new order with MAWB ${mawbNum}`
            };
        } else {
            console.log(`❌ ${trackingNumber}: Detrack update failed`);
            return {
                success: false,
                reason: 'Detrack update failed',
                message: 'Failed to update Detrack'
            };
        }

    } catch (error) {
        console.error(`❌ Error processing ${trackingNumber}:`, error.message);
        return {
            success: false,
            reason: 'Processing error',
            message: `Error: ${error.message}`
        };
    }
}

// Enhanced job details function with better error handling
async function getJobDetailsWithRetry(trackingNumber, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            if (attempt > 1) {
                console.log(`🔄 Retry ${attempt - 1}/${maxRetries} for ${trackingNumber}`);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }

            const response = await axios.get(
                `https://app.detrack.com/api/v2/dn/jobs/show/?do_number=${trackingNumber}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': apiKey
                    },
                    timeout: 10000
                }
            );

            if (response.data.data) {
                return response.data.data;
            }

        } catch (error) {
            console.log(`Attempt ${attempt} failed for ${trackingNumber}:`, error.message);
            if (attempt > maxRetries) {
                throw error;
            }
        }
    }
    return null;
}

async function sendDetrackUpdateWithRetry(trackingNumber, updateData, mawbNum, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            console.log(`🔄 Detrack update attempt ${attempt}/${maxRetries + 1} for ${trackingNumber}`);

            if (attempt > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Linear backoff
            }

            const response = await axios.put(
                'https://app.detrack.com/api/v2/dn/jobs/update',
                updateData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': apiKey
                    },
                    timeout: 10000
                }
            );

            if (response.data.success === true || response.data.status === 'success' || response.status === 200) {
                console.log(`✅ Detrack update successful on attempt ${attempt}`);
                return true;
            }

        } catch (error) {
            console.log(`❌ Detrack attempt ${attempt} failed:`, error.message);
            if (attempt > maxRetries) {
                return false;
            }
        }
    }
    return false;
}

// Add this route to check existing orders
app.post('/updateJob/checkExistingOrders', ensureAuthenticated, async (req, res) => {
    try {
        const { trackingNumbers, mawbNum } = req.body;

        const existingOrders = await ORDERS.find({
            doTrackingNumber: { $in: trackingNumbers }
        }).select('doTrackingNumber mawbNo currentStatus warehouseEntry product');

        // Filter to show only orders that might cause issues
        const problematicOrders = existingOrders.filter(order => {
            return order.warehouseEntry === "Yes" ||
                order.currentStatus !== "Info Received" ||
                (order.mawbNo && order.mawbNo !== mawbNum);
        });

        res.json({
            totalChecked: trackingNumbers.length,
            existingOrders: existingOrders.length,
            problematicOrders: problematicOrders.length,
            details: problematicOrders.map(order => ({
                trackingNumber: order.doTrackingNumber,
                currentMAWB: order.mawbNo,
                status: order.currentStatus,
                warehouseEntry: order.warehouseEntry,
                product: order.product,
                issue: order.warehouseEntry === "Yes" ? "Already at warehouse" :
                    order.currentStatus !== "Info Received" ? `Wrong status: ${order.currentStatus}` :
                        order.mawbNo !== mawbNum ? `Different MAWB: ${order.mawbNo}` : "Unknown"
            }))
        });

    } catch (error) {
        console.error('Error checking existing orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================================================
// 📁 Excel Upload Route for UWP (Update Weight/Postal Code)
// ==================================================

app.post('/updateJob/uwpExcelUpload', ensureAuthenticated, upload.single('excelFile'), async (req, res) => {
    try {
        console.log('📥 UWP Excel upload request received');

        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded',
                message: 'Please select a file to upload'
            });
        }

        const file = req.file;
        console.log(`📁 File: ${file.originalname}, ${file.size} bytes`);

        // Parse file
        let data = [];
        const fileExt = file.originalname.split('.').pop().toLowerCase();

        if (fileExt === 'csv') {
            data = await parseCSVBuffer(file.buffer);
        } else if (fileExt === 'xlsx' || fileExt === 'xls') {
            data = await parseExcelBuffer(file.buffer);
        } else {
            return res.status(400).json({
                error: 'Unsupported file type',
                message: 'Please upload Excel (.xlsx, .xls) or CSV (.csv) files only'
            });
        }

        console.log(`📈 Parsed ${data.length} rows from file`);

        if (data.length === 0) {
            return res.status(400).json({
                error: 'Empty file',
                message: 'The file contains no data'
            });
        }

        // Check for required column
        const firstRow = data[0];
        const headers = Object.keys(firstRow);

        if (!headers.includes('Tracking Number')) {
            return res.status(400).json({
                error: 'Missing required column',
                message: 'File must contain "Tracking Number" column',
                found: headers
            });
        }

        // Process data - extract tracking numbers and optional fields
        const updates = [];

        data.forEach((row, index) => {
            const trackingNumber = row['Tracking Number']?.toString().trim();
            const postalCode = row['Postal Code']?.toString().trim();
            const parcelWeight = row['Parcel Weight (kg)']?.toString().trim() || row['Parcel Weight']?.toString().trim();

            if (trackingNumber) {
                updates.push({
                    trackingNumber,
                    postalCode: postalCode || null,  // null means skip update
                    parcelWeight: parcelWeight ? parseFloat(parcelWeight) : null,  // null means skip update
                    rowNumber: index + 2 // +2 because row 1 is header
                });
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'No valid data',
                message: 'No valid tracking numbers found in the file'
            });
        }

        console.log(`✅ Found ${updates.length} valid tracking numbers for UWP update`);

        // Generate job ID
        const jobId = generateJobId();

        // Store job data
        backgroundJobs.set(jobId, {
            status: 'queued',
            total: updates.length,
            processed: 0,
            successful: [],
            failed: [],
            updatedCount: 0,
            failedCount: 0,
            startTime: Date.now(),
            uploadType: 'uwp',
            data: updates,
            fileName: file.originalname,
            retryCount: 0
        });

        console.log(`✅ UWP Job created: ${jobId} with ${updates.length} records`);

        // Send immediate response
        res.json({
            jobId: jobId,
            status: 'queued',
            message: `File uploaded successfully. Processing ${updates.length} tracking numbers for weight/postal code updates`,
            totalJobs: updates.length,
            fileName: file.originalname
        });

        // Start background processing
        setTimeout(() => {
            processUWPUploadInBackground(jobId, updates, req);
        }, 100);

    } catch (error) {
        console.error('❌ UWP Excel upload error:', error);
        res.status(500).json({
            error: 'File processing failed',
            message: error.message
        });
    }
});

// ==================================================
// 🔄 UWP Background Processing
// ==================================================

async function processUWPUploadInBackground(jobId, updates, req) {
    const job = backgroundJobs.get(jobId);
    if (!job) {
        console.error(`❌ Job ${jobId} not found`);
        return;
    }

    const results = {
        successful: [],
        failed: [],
        updatedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        status: 'processing',
        total: updates.length,
        processed: 0,
        startTime: Date.now()
    };

    backgroundJobs.set(jobId, { ...job, ...results, status: 'processing' });

    try {
        // Process in smaller batches
        const BATCH_SIZE = 50;
        const BATCH_DELAY = 1000;

        const totalBatches = Math.ceil(updates.length / BATCH_SIZE);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const start = batchIndex * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, updates.length);
            const batch = updates.slice(start, end);

            console.log(`🔄 Processing UWP batch ${batchIndex + 1}/${totalBatches} for job ${jobId}`);

            // Process batch
            const batchResults = await processUWPBatch(batch, req);

            // Merge results
            results.successful.push(...batchResults.successful);
            results.failed.push(...batchResults.failed);
            results.updatedCount += batchResults.updatedCount;
            results.failedCount += batchResults.failedCount;
            results.skippedCount += batchResults.skippedCount || 0;
            results.processed = end;

            // Update progress
            backgroundJobs.set(jobId, {
                ...results,
                status: 'processing',
                currentBatch: batchIndex + 1,
                totalBatches: totalBatches,
                progress: Math.round((results.processed / results.total) * 100)
            });

            // Delay between batches
            if (batchIndex < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
        }

        results.status = 'completed';
        results.processingTime = Date.now() - results.startTime;

        console.log(`✅ UWP Job ${jobId} completed:`);
        console.log(`   Total processed: ${results.total}`);
        console.log(`   Successfully updated: ${results.updatedCount}`);
        console.log(`   Failed: ${results.failedCount}`);
        console.log(`   Skipped (no changes): ${results.skippedCount}`);

        backgroundJobs.set(jobId, results);

    } catch (error) {
        console.error(`❌ UWP Job ${jobId} processing error:`, error);
        results.status = 'failed';
        results.error = error.message;
        backgroundJobs.set(jobId, results);
    }
}

async function processUWPBatch(batch, req) {
    const results = {
        successful: [],
        failed: [],
        updatedCount: 0,
        failedCount: 0,
        skippedCount: 0
    };

    // Process with concurrency limit
    const CONCURRENCY = 10;
    const chunks = [];

    for (let i = 0; i < batch.length; i += CONCURRENCY) {
        chunks.push(batch.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
        const chunkPromises = chunk.map(async (item) => {
            try {
                const result = await processSingleUWPUpdate(
                    item.trackingNumber,
                    item.postalCode,
                    item.parcelWeight,
                    req
                );

                if (result.success) {
                    results.successful.push({
                        trackingNumber: item.trackingNumber,
                        result: result.message,
                        updates: result.updates
                    });
                    results.updatedCount++;
                } else if (result.skipped) {
                    results.skippedCount++;
                    // Optionally track skipped items
                    if (result.message) {
                        console.log(`ℹ️ ${item.trackingNumber}: ${result.message}`);
                    }
                } else {
                    results.failed.push({
                        trackingNumber: item.trackingNumber,
                        result: result.message || 'Update failed',
                        reason: result.reason
                    });
                    results.failedCount++;
                }
            } catch (error) {
                results.failed.push({
                    trackingNumber: item.trackingNumber,
                    result: `Error: ${error.message}`
                });
                results.failedCount++;
            }
        });

        await Promise.allSettled(chunkPromises);

        // Small delay between chunks
        if (chunks.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    return results;
}

async function processSingleUWPUpdate(trackingNumber, postalCode, parcelWeight, req) {
    try {
        console.log(`🔍 Processing UWP update for ${trackingNumber}`);
        console.log(`   Postal Code: ${postalCode || '(skip)'}`);
        console.log(`   Weight: ${parcelWeight || '(skip)'}`);

        // Check if there's anything to update
        if (!postalCode && !parcelWeight) {
            return {
                success: false,
                skipped: true,
                message: 'No fields to update (both postal code and weight empty)'
            };
        }

        // Check if job exists in Detrack
        const jobExists = await checkJobExists(trackingNumber);
        if (!jobExists) {
            console.log(`❌ Job ${trackingNumber} not found in Detrack`);
            return {
                success: false,
                reason: 'not_found',
                message: 'Tracking number not found in Detrack'
            };
        }

        // Get job details to verify it exists and get current values
        const jobData = await getJobDetails(trackingNumber);
        if (!jobData) {
            return {
                success: false,
                reason: 'no_details',
                message: 'Could not retrieve job details from Detrack'
            };
        }

        console.log(`✅ Job exists in Detrack, current values:`);
        console.log(`   Current Postal Code: ${jobData.postal_code || 'none'}`);
        console.log(`   Current Weight: ${jobData.weight || 'none'}`);

        // Prepare updates object - only include fields that have values
        const updates = {};
        const mongoUpdates = {};

        if (postalCode) {
            updates.postal_code = postalCode.toUpperCase();
            mongoUpdates.receiverPostalCode = postalCode.toUpperCase();
        }

        if (parcelWeight) {
            updates.weight = parseFloat(parcelWeight);
            mongoUpdates.parcelWeight = parseFloat(parcelWeight);
        }

        // Check if values are actually changing (optional, but nice to know)
        const postalChanged = postalCode && jobData.postal_code?.toUpperCase() !== postalCode.toUpperCase();
        const weightChanged = parcelWeight && parseFloat(jobData.weight) !== parseFloat(parcelWeight);

        if ((postalCode && !postalChanged) && (parcelWeight && !weightChanged)) {
            return {
                success: false,
                skipped: true,
                message: 'Values are already the same, no update needed'
            };
        }

        // 1. Update MongoDB
        if (Object.keys(mongoUpdates).length > 0) {
            await ORDERS.updateOne(
                { doTrackingNumber: trackingNumber },
                {
                    $set: {
                        ...mongoUpdates,
                        lastUpdateDateTime: moment().format(),
                        lastUpdatedBy: req.user.name
                    }
                },
                { upsert: false } // Don't create if doesn't exist
            );
            console.log(`✅ MongoDB updated for ${trackingNumber}`);
        }

        // 2. Update Detrack
        const detrackUpdateData = {
            do_number: trackingNumber,
            data: updates
        };

        console.log(`📤 Sending Detrack update:`, JSON.stringify(detrackUpdateData, null, 2));

        const detrackSuccess = await sendDetrackUpdateWithRetry(trackingNumber, detrackUpdateData, null);

        if (detrackSuccess) {
            const updatedFields = [];
            if (postalCode) updatedFields.push('postal code');
            if (parcelWeight) updatedFields.push('weight');

            console.log(`✅ UWP update successful for ${trackingNumber}`);
            return {
                success: true,
                message: `Updated ${updatedFields.join(' and ')}`,
                updates: updatedFields,
                trackingNumber
            };
        } else {
            console.log(`❌ Detrack update failed for ${trackingNumber}`);
            return {
                success: false,
                reason: 'detrack_failed',
                message: 'Failed to update Detrack'
            };
        }

    } catch (error) {
        console.error(`❌ Error in UWP update for ${trackingNumber}:`, error);
        return {
            success: false,
            reason: 'error',
            message: `Error: ${error.message}`
        };
    }
}

// ==================================================
// 📸 Multi-POD Download Functions for GDEX FAILED Deliveries
// ==================================================

async function downloadAvailablePODsForGDEXFailed(consignmentID, detrackData, expectedCount, maxRetries = 3) {
    console.log(`📸 Starting flexible POD download for failed GDEX ${consignmentID}`);
    console.log(`   Expected photos: ${expectedCount}/3 (minimum 1 required)`);

    const podImages = [];
    const imagesToDownload = [];

    // Only add URLs that exist
    if (detrackData.photo_1_file_url && detrackData.photo_1_file_url.startsWith('http')) {
        imagesToDownload.push({ number: 1, url: detrackData.photo_1_file_url });
    }
    if (detrackData.photo_2_file_url && detrackData.photo_2_file_url.startsWith('http')) {
        imagesToDownload.push({ number: 2, url: detrackData.photo_2_file_url });
    }
    if (detrackData.photo_3_file_url && detrackData.photo_3_file_url.startsWith('http')) {
        imagesToDownload.push({ number: 3, url: detrackData.photo_3_file_url });
    }

    console.log(`   Attempting to download ${imagesToDownload.length} available photos...`);

    // Download each available photo (continue even if some fail)
    for (const image of imagesToDownload) {
        try {
            console.log(`\n   ===== DOWNLOADING POD ${image.number} =====`);

            const base64Image = await downloadAndConvertToBase64Immediate(
                image.url,
                consignmentID,
                image.number,
                maxRetries
            );

            // Validate the result
            if (base64Image && base64Image.length > 100 && !base64Image.startsWith('http')) {
                podImages.push(base64Image);
                console.log(`   ✅ POD ${image.number}: SUCCESS (${base64Image.length} chars)`);
            } else {
                console.log(`   ⚠️ POD ${image.number}: Invalid result, skipping`);
            }

        } catch (error) {
            console.log(`   ⚠️ POD ${image.number}: Failed but continuing with other PODs - ${error.message}`);
            // Continue to next POD even if this one fails
        }
    }

    // Check if we got at least 1 photo
    if (podImages.length === 0) {
        throw new Error(`CRITICAL: Failed to download any PODs after all attempts`);
    }

    console.log(`\n🎉 SUCCESS: Downloaded ${podImages.length}/${imagesToDownload.length} available PODs (minimum requirement met!)`);
    return podImages;
}

// ==================================================
// 📦 New Unified POD Routes
// ==================================================

// API endpoint to get job details from Detrack
app.get('/api/job-details/:trackingNumber', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const trackingNumber = req.params.trackingNumber.toUpperCase();
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

        // Log the response to see what fields are available
        console.log('Detrack API response for', trackingNumber, ':', {
            other_phone_numbers: response.data.data?.other_phone_numbers,
            phone_number: response.data.data?.phone_number,
            deliver_to_collect_from: response.data.data?.deliver_to_collect_from
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching job details:', error);
        res.status(404).json({ error: 'Tracking number not found' });
    }
});

// Render the list POD page
app.get('/listPOD', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        res.render('listPOD', { user: req.user });
    } catch (error) {
        console.error('Error loading listPOD page:', error);
        res.status(500).send('Failed to load POD list');
    }
});

// API endpoint for unified POD list with server-side processing
app.get('/api/listPOD', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
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
                { htmlContent: regex }
            ];
        }

        let sort = {};
if (order && columns) {
    const colName = columns[order.column].data;
    const dir = order.dir === 'desc' ? -1 : 1;
    sort[colName] = dir;
} else {
    // Sort by creationDate from newest to oldest (descending)
    sort = { creationDate: -1 };
}

        const total = await UnifiedPOD.countDocuments({});
        const filtered = await UnifiedPOD.countDocuments(query);

        const pods = await UnifiedPOD.find(query)
            .select([
                '_id',
                'podName',
                'product',
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
        console.error("Error loading POD list:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================================================
// 📦 POD VIEW ROUTE - Add this BEFORE any other routes with :podId
// ==================================================

app.get('/api/view-pod/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    console.log('🔥🔥🔥 /api/view-pod/:podId route was called! 🔥🔥🔥');
    console.log('Pod ID received:', req.params.podId);

    try {
        const podId = req.params.podId;

        // Validate MongoDB ObjectId format (24 hex chars)
        if (!podId || podId.length !== 24) {
            console.log('❌ Invalid ID format:', podId);
            return res.status(400).json({ error: 'Invalid POD ID format. ID must be 24 characters.' });
        }

        console.log('🔍 Searching for POD with ID:', podId);
        const pod = await UnifiedPOD.findById(podId);

        if (!pod) {
            console.log('❌ POD not found for ID:', podId);
            return res.status(404).json({ error: 'POD not found' });
        }

        console.log('✅ POD found:', pod.podName);
        console.log('✅ HTML content length:', pod.htmlContent?.length || 0);

        res.json({ htmlContent: pod.htmlContent });
    } catch (error) {
        console.error('❌ Error fetching POD:', error);
        res.status(500).json({ error: 'Failed to fetch POD: ' + error.message });
    }
});

// Test route to verify the API is working
app.get('/api/test-view', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    console.log('🔥 /api/test-view route was called');
    res.json({ message: 'Test view route is working', user: req.user?.name });
});

// Delete POD route
app.get('/deletePOD/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const podId = req.params.podId;
        console.log('Deleting POD with ID:', podId);

        const deletedPod = await UnifiedPOD.findByIdAndDelete(podId);

        if (deletedPod) {
            console.log('POD deleted:', deletedPod.podName);
            res.redirect('/listPOD');
        } else {
            res.status(404).send('POD not found');
        }
    } catch (error) {
        console.error('Error deleting POD:', error);
        res.status(500).send('Failed to delete POD: ' + error.message);
    }
});

// Save POD route - handle DD.MM.YY format
app.post('/save-pod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const { podName, product, podDate, podCreator, deliveryDate, area, dispatcher, htmlContent, rowCount } = req.body;

        console.log('Received save request for POD:', podName);
        console.log('Raw deliveryDate received:', deliveryDate);

        // Normalize deliveryDate to YYYY-MM-DD format
        let normalizedDeliveryDate = deliveryDate;

        // Handle format: "14.04.26" (DD.MM.YY)
        if (deliveryDate && deliveryDate.match(/^\d{2}\.\d{2}\.\d{2}$/)) {
            const parts = deliveryDate.split('.');
            const day = parts[0];
            const month = parts[1];
            const year = 2000 + parseInt(parts[2]);
            normalizedDeliveryDate = `${year}-${month}-${day}`;
            console.log('Converted DD.MM.YY to YYYY-MM-DD:', normalizedDeliveryDate);
        }
        // Handle format: "DD.MM.YYYY"
        else if (deliveryDate && deliveryDate.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
            const parts = deliveryDate.split('.');
            normalizedDeliveryDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            console.log('Converted DD.MM.YYYY to YYYY-MM-DD:', normalizedDeliveryDate);
        }
        // Handle format: "DD/MM/YY"
        else if (deliveryDate && deliveryDate.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
            const parts = deliveryDate.split('/');
            const day = parts[0];
            const month = parts[1];
            const year = 2000 + parseInt(parts[2]);
            normalizedDeliveryDate = `${year}-${month}-${day}`;
            console.log('Converted DD/MM/YY to YYYY-MM-DD:', normalizedDeliveryDate);
        }
        // Handle format: "DD-MM-YY"
        else if (deliveryDate && deliveryDate.match(/^\d{2}-\d{2}-\d{2}$/)) {
            const parts = deliveryDate.split('-');
            const day = parts[0];
            const month = parts[1];
            const year = 2000 + parseInt(parts[2]);
            normalizedDeliveryDate = `${year}-${month}-${day}`;
            console.log('Converted DD-MM-YY to YYYY-MM-DD:', normalizedDeliveryDate);
        }

        // Validate required fields
        if (!podName || !product || !podDate || !podCreator || !normalizedDeliveryDate || !area || !dispatcher || !htmlContent || !rowCount) {
            console.log('Missing required fields');
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newPod = new UnifiedPOD({
            podName: podName,
            product: product,
            podDate: podDate,
            podCreator: podCreator,
            deliveryDate: normalizedDeliveryDate, // Store as YYYY-MM-DD
            area: area,
            dispatcher: dispatcher,
            rowCount: rowCount,
            htmlContent: htmlContent,
            creationDate: moment().format()
        });

        const savedPod = await newPod.save();
        console.log('POD saved successfully:', savedPod.podName, 'ID:', savedPod._id, 'Delivery Date:', savedPod.deliveryDate);

        res.status(200).json({ message: 'POD data saved successfully', id: savedPod._id });
    } catch (error) {
        console.error('Error saving POD:', error);
        res.status(500).json({ error: 'Failed to save POD data: ' + error.message });
    }
});

// API endpoint to get order details from MongoDB
app.get('/api/order-details/:trackingNumber', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const trackingNumber = req.params.trackingNumber.toUpperCase();
        console.log('Searching for order with tracking number:', trackingNumber);

        const order = await ORDERS.findOne({ doTrackingNumber: trackingNumber });

        if (!order) {
            console.log('Order not found for tracking number:', trackingNumber);
            return res.status(404).json({ error: 'Order not found' });
        }

        console.log('Order found:', {
            doTrackingNumber: order.doTrackingNumber,
            receiverName: order.receiverName,
            product: order.product,
            jobmethod: order.jobMethod,
            grRemark: order.grRemark  // Add this to log
        });

        res.json({
            doTrackingNumber: order.doTrackingNumber,
            receiverName: order.receiverName,
            receiverAddress: order.receiverAddress,
            receiverPhoneNumber: order.receiverPhoneNumber,
            additionalPhoneNumber: order.additionalPhoneNumber || '',
            jobMethod: order.jobMethod || '',
            totalPrice: order.totalPrice || '',
            paymentAmount: order.paymentAmount || '',
            paymentMethod: order.paymentMethod || '',
            remarks: order.remarks || '',
            product: order.product || '',
            grRemark: order.grRemark || ''  // Add grRemark field
        });

    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// ==================================================
// 📦 ASSIGN POD JOBS TO OUT FOR DELIVERY
// ==================================================

app.post('/api/assign-pod-jobs', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    const { podId, podName, trackingNumbers, dispatcher, assignDate } = req.body;

    console.log(`=== Assigning POD Jobs: ${podName} ===`);
    console.log(`Dispatcher: ${dispatcher}`);
    console.log(`Assign Date: ${assignDate}`);
    console.log(`Tracking Numbers: ${trackingNumbers.length} jobs`);

    const results = [];

    // Process each tracking number sequentially
    for (let i = 0; i < trackingNumbers.length; i++) {
        const consignmentID = trackingNumbers[i];
        console.log(`\n[${i + 1}/${trackingNumbers.length}] Processing: ${consignmentID}`);

        try {
            // Step 1: Fetch data from Detrack
            const response = await axios.get(`https://app.detrack.com/api/v2/dn/jobs/show/?do_number=${consignmentID}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey
                }
            });

            const data = response.data.data;
            const product = data.group_name;
            let currentProduct = '';

            // Determine product type
            if (product === 'GDEX') currentProduct = 'gdex';
            else if (product === 'GDEXT') currentProduct = 'gdext';
            else if (product === 'EWE') currentProduct = 'ewe';
            else currentProduct = product.toLowerCase();

            // Check if job can be assigned to Out for Delivery
            const canAssignOutForDelivery = (
                (data.type === 'Delivery' && (data.status === 'at_warehouse' || data.status === 'in_sorting_area')) ||
                (data.type === 'Delivery' && data.status === 'on_hold' && (currentProduct === 'gdex' || currentProduct === 'gdext'))
            );

            if (!canAssignOutForDelivery) {
                let errorMsg = `Cannot assign - Current status: ${data.status}`;
                if (data.type !== 'Delivery') errorMsg = `Cannot assign - Job type is ${data.type}, not Delivery`;
                if (data.status === 'dispatched') errorMsg = `Job already assigned to a dispatcher`;
                if (data.status === 'completed') errorMsg = `Job already completed`;
                if (data.status === 'failed') errorMsg = `Job has failed delivery`;
                if (data.status === 'cancelled') errorMsg = `Job has been cancelled`;

                results.push({
                    trackingNumber: consignmentID,
                    success: false,
                    error: errorMsg
                });
                continue;
            }

            // Get area from address
            let area = data.zone || 'N/A';
            let finalArea = area;

            // Prepare update data for MongoDB
            let update = {
                area: finalArea,
                currentStatus: "Out for Delivery",
                lastUpdateDateTime: moment().format(),
                instructions: data.remarks || '',
                assignedTo: dispatcher,
                attempt: data.attempt || 0,
                jobDate: assignDate,
                latestLocation: dispatcher,
                lastUpdatedBy: req.user.name,
                $push: {
                    history: {
                        statusHistory: "Out for Delivery",
                        dateUpdated: moment().format(),
                        updatedBy: req.user.name,
                        lastAssignedTo: dispatcher,
                        reason: "N/A",
                        lastLocation: dispatcher,
                    }
                }
            };

            // Handle COD for EWE products
            let detrackUpdateData = {
                do_number: consignmentID,
                data: {
                    date: assignDate,
                    assign_to: dispatcher,
                    status: "dispatched",
                    zone: finalArea,
                }
            };

            if ((data.payment_mode === "COD") && (currentProduct === "ewe")) {
                update.paymentMethod = "Cash";
                update.totalPrice = data.payment_amount;
                update.paymentAmount = data.payment_amount;
                detrackUpdateData.data.total_price = data.payment_amount;
                detrackUpdateData.data.payment_mode = "Cash";
            }

            // Step 2: Update MongoDB
            const filter = { doTrackingNumber: consignmentID };
            const mongoResult = await ORDERS.findOneAndUpdate(filter, update, { upsert: false, new: false });

            if (!mongoResult) {
                results.push({
                    trackingNumber: consignmentID,
                    success: false,
                    error: 'Order not found in MongoDB'
                });
                continue;
            }

            console.log(`✅ MongoDB updated for ${consignmentID}`);

            // Step 3: Update Detrack
            const detrackSuccess = await updateDetrackStatusWithRetry(consignmentID, apiKey, detrackUpdateData);

            if (!detrackSuccess) {
                results.push({
                    trackingNumber: consignmentID,
                    success: false,
                    error: 'Failed to update Detrack status'
                });
                continue;
            }

            console.log(`✅ Detrack updated for ${consignmentID}`);

            // Step 4: Update GDEX if applicable
            let gdexSuccess = true;
            if (product === 'GDEX' || product === 'GDEXT') {
                console.log(`🔄 Sending GDEX Out for Delivery for ${consignmentID}`);
                gdexSuccess = await updateGDEXStatus(consignmentID, 'out_for_delivery');

                if (gdexSuccess) {
                    console.log(`✅ GDEX updated for ${consignmentID}`);
                } else {
                    console.log(`⚠️ GDEX update failed for ${consignmentID} (non-critical)`);
                }
            }

            results.push({
                trackingNumber: consignmentID,
                success: true,
                product: product,
                gdexUpdated: (product === 'GDEX' || product === 'GDEXT') ? gdexSuccess : 'N/A'
            });

            console.log(`✅ Successfully assigned ${consignmentID} to ${dispatcher}`);

            // Small delay to avoid API rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.error(`❌ Error processing ${consignmentID}:`, error.message);
            results.push({
                trackingNumber: consignmentID,
                success: false,
                error: error.message.includes('404') ? 'Tracking number not found in Detrack' : error.message
            });
        }
    }

    // Log summary
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    console.log(`\n=== Assignment Complete for ${podName} ===`);
    console.log(`Success: ${successCount}, Failed: ${failCount}`);

    res.json({
        success: true,
        podName: podName,
        totalJobs: trackingNumbers.length,
        successCount: successCount,
        failCount: failCount,
        results: results
    });
});

// Product Mapping for Display Names
const PRODUCT_MAPPING = {
    'ewe': 'EWE',
    'pdu': 'PDU',
    'mglobal': 'MGLOBAL',
    'gdex': 'GDEX',
    'gdext': 'GDEX',
    'pure51': 'PURE51',
    'localdelivery': 'LD',
    'cbsl': 'CBSL',
    'pharmacymoh': 'MOH',
    'pharmacyjpmc': 'JPMC',
    'pharmacyphc': 'PHC',
    'kptdp': 'KPT',
    'icarus': 'ICARUS'
};

// Products that need grouping by MAWB number
const MAWB_PRODUCTS = ['ewe', 'pdu', 'mglobal', 'gdex', 'gdext'];

// Email Transporter (SMTP)
const emailTransporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || 'it.support@globex.com.bn',
        pass: process.env.EMAIL_PASS
    },
    tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: true
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
});

// Verify email connection on startup
emailTransporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email transporter error:', error);
    } else {
        console.log('✅ Email transporter ready');
    }
});

// Helper: Get display name for product
function getProductDisplayName(productKey) {
    return PRODUCT_MAPPING[productKey] || productKey.toUpperCase();
}

// Helper: Calculate aging in days
function calculateAging(warehouseEntryDateTime) {
    const now = moment().tz("Asia/Brunei");
    const entryDate = moment(warehouseEntryDateTime).tz("Asia/Brunei");
    return Math.floor(now.diff(entryDate, 'days', true));
}

// Helper: Format date for display
function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '-';
    return moment(dateTimeString).tz("Asia/Brunei").format('DD.MM.YY HH:mm:ss');
}

// Helper: Escape HTML
function escapeHtml(text) {
    if (!text) return '-';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\n/g, '<br>');
}

// Generate HTML email content
function generateEmailContent(productGroups, reportDate) {
    let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Go Rush Pending Jobs Notification ${reportDate}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f4f4f4; padding: 15px; border-bottom: 3px solid #007bff; margin-bottom: 20px; }
        .header h2 { margin: 0; }
        .product-section { margin-bottom: 30px; page-break-inside: avoid; }
        .product-title { background-color: #007bff; color: white; padding: 10px 15px; margin: 0 0 10px 0; font-size: 18px; font-weight: bold; }
        .subgroup-title { background-color: #28a745; color: white; padding: 8px 15px; margin: 15px 0 10px 0; font-size: 14px; font-weight: bold; }
        .job-count { font-size: 14px; font-weight: normal; margin-left: 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
        th { background-color: #e9ecef; border: 1px solid #dee2e6; padding: 8px; text-align: left; font-weight: bold; }
        td { border: 1px solid #dee2e6; padding: 8px; vertical-align: top; }
        tr:nth-child(even) { background-color: #f8f9fa; }
        .footer { margin-top: 30px; padding: 15px; background-color: #f4f4f4; text-align: center; font-size: 11px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Go Rush Pending Jobs Notification - ${reportDate}</h2>
        </div>`;

    for (const group of productGroups) {
        if (group.type === 'mawb_group') {
            html += `<div class="product-section">
                <div class="product-title">${escapeHtml(group.productName)} <span class="job-count">(${group.totalJobs} jobs)</span></div>`;
            for (const subgroup of group.subgroups) {
                html += `<div class="subgroup-title">MAWB: ${escapeHtml(subgroup.mawbNo)} <span class="job-count">(${subgroup.count} jobs)</span></div>
                <table><thead><tr>
                    <th>Tracking No.</th><th>Aging (days)</th><th>First in Warehouse</th><th>Location</th><th>Attempt</th>
                    <th>Latest Reason</th><th>Area</th><th>Name</th><th>Main Phone</th>
                    <th>Additional Phone</th><th>Customer Remark</th><th>GR Remark</th>
                </tr></thead><tbody>`;
                for (const job of subgroup.jobs) {
                    const agingStyle = job.aging >= 7 ? 'color: red; font-weight: bold;' : (job.aging >= 3 ? 'color: orange;' : '');
                    html += `<tr>
                        <td>${escapeHtml(job.doTrackingNumber)}</td>
                        <td style="text-align: center; ${agingStyle}">${job.aging}</td>
                        <td>${escapeHtml(job.warehouseEntryDateTime)}</td>
                        <td>${escapeHtml(job.latestLocation)}</td>
                        <td style="text-align: center;">${escapeHtml(job.attempt)}</td>
                        <td>${escapeHtml(job.latestReason)}</td>
                        <td>${escapeHtml(job.area)}</td>
                        <td>${escapeHtml(job.receiverName)}</td>
                        <td>${escapeHtml(job.receiverPhoneNumber)}</td>
                        <td>${escapeHtml(job.additionalPhoneNumber)}</td>
                        <td>${escapeHtml(job.remarks)}</td>
                        <td>${escapeHtml(job.grRemark)}</td>
                    </tr>`;
                }
                html += `</tbody></table>`;
            }
            html += `</div>`;
        } else {
            html += `<div class="product-section">
                <div class="product-title">${escapeHtml(group.productName)} <span class="job-count">(${group.count} jobs)</span></div>
                <table><thead><tr>
                    <th>Tracking No.</th><th>Aging (days)</th><th>First in Warehouse</th><th>Location</th><th>Attempt</th>
                    <th>Latest Reason</th><th>Area</th><th>Name</th><th>Main Phone</th>
                    <th>Additional Phone</th><th>Customer Remark</th><th>GR Remark</th>
                </tr></thead><tbody>`;
            for (const job of group.jobs) {
                const agingStyle = job.aging >= 7 ? 'color: red; font-weight: bold;' : (job.aging >= 3 ? 'color: orange;' : '');
                html += `<tr>
                    <td>${escapeHtml(job.doTrackingNumber)}</td>
                    <td style="text-align: center; ${agingStyle}">${job.aging}</td>
                    <td>${escapeHtml(job.warehouseEntryDateTime)}</td>
                    <td>${escapeHtml(job.latestLocation)}</td>
                    <td style="text-align: center;">${escapeHtml(job.attempt)}</td>
                    <td>${escapeHtml(job.latestReason)}</td>
                    <td>${escapeHtml(job.area)}</td>
                    <td>${escapeHtml(job.receiverName)}</td>
                    <td>${escapeHtml(job.receiverPhoneNumber)}</td>
                    <td>${escapeHtml(job.additionalPhoneNumber)}</td>
                    <td>${escapeHtml(job.remarks)}</td>
                    <td>${escapeHtml(job.grRemark)}</td>
                </tr>`;
            }
            html += `</tbody></table></div>`;
        }
    }

    html += `<div class="footer"><p>This is an automated report. Please contact IT Support for any issues.</p><p>Generated by Go Rush System</p></div></div></body></html>`;
    return html;
}

// Generate Excel file
function generateExcelAttachment(productGroups) {
    const XLSX = require('xlsx');
    const workbook = XLSX.utils.book_new();
    
    for (const group of productGroups) {
        if (group.type === 'mawb_group') {
            for (const subgroup of group.subgroups) {
                const sheetName = `${group.productName}_${subgroup.mawbNo}`.substring(0, 31);
                const data = [
                    [`${group.productName} - MAWB: ${subgroup.mawbNo} (${subgroup.count} jobs)`],
                    [],
                    ['Tracking No.', 'Aging (days)', 'First in Warehouse', 'Location', 'Attempt', 'Latest Reason', 'Area', 'Name', 'Main Phone', 'Additional Phone', 'Customer Remark', 'GR Remark']
                ];
                for (const job of subgroup.jobs) {
                    data.push([job.doTrackingNumber, job.aging, job.warehouseEntryDateTime, job.latestLocation, job.attempt, job.latestReason, job.area, job.receiverName, job.receiverPhoneNumber, job.additionalPhoneNumber, job.remarks, job.grRemark]);
                }
                const worksheet = XLSX.utils.aoa_to_sheet(data);
                worksheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 8 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 35 }, { wch: 35 }];
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            }
        } else {
            const sheetName = group.productName.substring(0, 31);
            const data = [
                [`${group.productName} (${group.count} jobs)`],
                [],
                ['Tracking No.', 'Aging (days)', 'First in Warehouse', 'Location', 'Attempt', 'Latest Reason', 'Area', 'Name', 'Main Phone', 'Additional Phone', 'Customer Remark', 'GR Remark']
            ];
            for (const job of group.jobs) {
                data.push([job.doTrackingNumber, job.aging, job.warehouseEntryDateTime, job.latestLocation, job.attempt, job.latestReason, job.area, job.receiverName, job.receiverPhoneNumber, job.additionalPhoneNumber, job.remarks, job.grRemark]);
            }
            const worksheet = XLSX.utils.aoa_to_sheet(data);
            worksheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 8 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 35 }, { wch: 35 }];
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        }
    }
    
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// Main function to send email
async function sendPendingJobsEmail(isTest = true) {
    const bruneiNow = moment().tz("Asia/Brunei");
    const reportDate = bruneiNow.format('DD.MM.YYYY');
    const emailSubject = `Go Rush Pending Jobs Notification ${reportDate}`;
    
    console.log(`\n📧 ${isTest ? 'TEST' : 'PRODUCTION'}: Starting pending jobs email for ${reportDate}...`);
    
    try {
        // Fetch jobs
        const pendingJobs = await ORDERS.find({
            warehouseEntry: "Yes",
            currentStatus: { $ne: "Completed" }
        }).lean();
        
        console.log(`📊 Found ${pendingJobs.length} pending jobs`);
        
        if (pendingJobs.length === 0) {
            return { success: false, message: 'No pending jobs found' };
        }
        
        // Filter: age ≤ 30 days, not cancelled
        const filteredJobs = pendingJobs.filter(job => {
            const aging = calculateAging(job.warehouseEntryDateTime);
            return aging <= 30 && job.currentStatus !== "Cancelled";
        });
        
        const cancelledCount = pendingJobs.filter(job => job.currentStatus === "Cancelled").length;
        const oldCount = pendingJobs.length - filteredJobs.length - cancelledCount;
        
        if (cancelledCount > 0) console.log(`🗑️ Excluding ${cancelledCount} cancelled jobs`);
        if (oldCount > 0) console.log(`🗑️ Excluding ${oldCount} jobs > 30 days`);
        console.log(`📊 Processing ${filteredJobs.length} jobs`);
        
        if (filteredJobs.length === 0) {
            return { success: false, message: 'No jobs after filtering' };
        }
        
        // Group by product and MAWB
        const mawbData = {};
        const regularData = {};
        
        for (const job of filteredJobs) {
            const productKey = job.product || 'Unknown';
            
            if (MAWB_PRODUCTS.includes(productKey)) {
                if (!mawbData[productKey]) {
                    mawbData[productKey] = { productName: getProductDisplayName(productKey), groups: {} };
                }
                const mawbNo = job.mawbNo;
                if (!mawbNo || mawbNo === 'No MAWB') continue; // Skip empty MAWB
                
                if (!mawbData[productKey].groups[mawbNo]) mawbData[productKey].groups[mawbNo] = [];
                
                mawbData[productKey].groups[mawbNo].push({
                    doTrackingNumber: job.doTrackingNumber || '-',
                    aging: calculateAging(job.warehouseEntryDateTime),
                    warehouseEntryDateTime: formatDateTime(job.warehouseEntryDateTime),
                    latestLocation: job.latestLocation || '-',
                    attempt: job.attempt || '0',
                    latestReason: job.latestReason || '-',
                    area: job.area || '-',
                    receiverName: job.receiverName || '-',
                    receiverPhoneNumber: job.receiverPhoneNumber || '-',
                    additionalPhoneNumber: job.additionalPhoneNumber || '-',
                    remarks: job.remarks || '-',
                    grRemark: job.grRemark || '-'
                });
            } else {
                if (!regularData[productKey]) regularData[productKey] = [];
                regularData[productKey].push({
                    doTrackingNumber: job.doTrackingNumber || '-',
                    aging: calculateAging(job.warehouseEntryDateTime),
                    warehouseEntryDateTime: formatDateTime(job.warehouseEntryDateTime),
                    latestLocation: job.latestLocation || '-',
                    attempt: job.attempt || '0',
                    latestReason: job.latestReason || '-',
                    area: job.area || '-',
                    receiverName: job.receiverName || '-',
                    receiverPhoneNumber: job.receiverPhoneNumber || '-',
                    additionalPhoneNumber: job.additionalPhoneNumber || '-',
                    remarks: job.remarks || '-',
                    grRemark: job.grRemark || '-'
                });
            }
        }
        
        // Build product groups
        const productGroups = [];
        
        for (const [key, data] of Object.entries(mawbData)) {
            const subgroups = [];
            let totalJobs = 0;
            for (const [mawbNo, jobs] of Object.entries(data.groups)) {
                jobs.sort((a, b) => b.aging - a.aging);
                subgroups.push({ mawbNo, count: jobs.length, jobs, maxAging: Math.max(...jobs.map(j => j.aging)) });
                totalJobs += jobs.length;
            }
            subgroups.sort((a, b) => b.maxAging - a.maxAging);
            productGroups.push({ type: 'mawb_group', productName: data.productName, totalJobs, subgroups, maxAging: Math.max(...subgroups.map(s => s.maxAging)) });
        }
        
        for (const [key, jobs] of Object.entries(regularData)) {
            jobs.sort((a, b) => b.aging - a.aging);
            productGroups.push({ type: 'regular', productName: getProductDisplayName(key), count: jobs.length, jobs, maxAging: jobs[0]?.aging || 0 });
        }
        
        productGroups.sort((a, b) => b.maxAging - a.maxAging);
        
        // Generate email content
        const emailHtml = generateEmailContent(productGroups, reportDate);
        const excelBuffer = generateExcelAttachment(productGroups);
        
        // Set recipients
        const recipients = isTest 
            ? ['syahmi.ghafar@globex.com.bn']
            : ['operation2@globex.com.bn', 'operation3@globex.com.bn', 'warehouse@globex.com.bn', 'customer.care@globex.com.bn'];
        
        console.log(`📧 Sending to: ${recipients.join(', ')}`);
        
        // Send email
        const info = await emailTransporter.sendMail({
            from: `"Go Rush System" <${process.env.EMAIL_USER || 'it.support@globex.com.bn'}>`,
            to: recipients.join(', '),
            subject: emailSubject,
            html: emailHtml,
            attachments: [{ filename: `pending_jobs_${reportDate}.xlsx`, content: excelBuffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }]
        });
        
        console.log(`✅ Email sent! Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('❌ Email error:', error);
        return { success: false, error: error.message };
    }
}

// Scheduled job: Every day at 7am Brunei time (Monday to Saturday)
function scheduleDailyEmail() {
    const scheduleNext = () => {
        const now = moment().tz("Asia/Brunei");
        let nextRun = moment().tz("Asia/Brunei").set({ hour: 7, minute: 0, second: 0 });
        
        if (now.isAfter(nextRun)) nextRun.add(1, 'day');
        if (nextRun.day() === 7) nextRun.add(1, 'day'); // Skip Sunday
        
        const delayMs = nextRun.diff(now);
        console.log(`📅 Next email scheduled: ${nextRun.format('YYYY-MM-DD HH:mm:ss')} (Brunei Time)`);
        
        setTimeout(() => {
            sendPendingJobsEmail(false).then(result => {
                if (result.success) console.log(`✅ Scheduled email sent`);
                else console.error(`❌ Scheduled email failed: ${result.error}`);
                scheduleNext();
            });
        }, delayMs);
    };
    scheduleNext();
}

// ==================================================
// 📧 Test Endpoints
// ==================================================

// Test email (always sends to test recipient)
app.get('/test-email', async (req, res) => {
    console.log('🧪 Test email triggered');
    const result = await sendPendingJobsEmail(true);
    res.json(result);
});

app.get('/test-prod-email', async (req, res) => {
    console.log('🚀 PRODUCTION test triggered');
    const result = await sendPendingJobsEmail(false);  // false = PRODUCTION
    res.json(result);
});

// Health check
app.get('/email-health', async (req, res) => {
    try {
        await emailTransporter.verify();
        res.json({ status: 'ok', message: 'Email transporter is ready' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Start the scheduled email job
scheduleDailyEmail();

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});