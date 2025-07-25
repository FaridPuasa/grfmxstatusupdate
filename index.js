require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const moment = require('moment');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');
const NodeCache = require('node-cache');
const urgentCache = new NodeCache({ stdTTL: 60 }); // cache for 60 seconds
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the "public" directory
app.use(express.static('public'));

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
// Middleware to parse JSON data
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));

const mongoose = require('mongoose');
const db = require('./config/keys').MongoURI;
mongoose.set('strictQuery', true)
mongoose.connect(db, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(console.log('Database Connected'))
    .catch(err => console.log(err))

// Session management
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use((req, res, next) => {
    console.log(req.session); // Log the session object
    next();
});

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Passport configuration
passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
    USERS.findOne({ email: email })
        .then(user => {
            if (!user) {
                return done(null, false, { message: 'No user found with that email' });
            }

            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) throw err;
                if (isMatch) {
                    return done(null, user);
                } else {
                    return done(null, false, { message: 'Password incorrect' });
                }
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

// Import the shared schema
const podSchema = require('./schemas/podSchema');

// Import your models
const USERS = require('./models/USERS');
const PharmacyPOD = require('./models/PharmacyPOD');
const LDPOD = require('./models/LDPOD');
const GRPPOD = require('./models/GRPPOD');
const FMXPOD = require('./models/FMXPOD');
const EWEPOD = require('./models/EWEPOD');
const EWENSPOD = require('./models/EWENSPOD');
const CBSLPOD = require('./models/CBSLPOD');
const TEMUPOC = require('./models/TEMUPOC');
const TEMUPOD = require('./models/TEMUPOD');
const KPTDPPOD = require('./models/KPTDPPOD');
const KPTDFPOD = require('./models/KPTDFPOD');
const PDUPOD = require('./models/PDUPOD');
const MGLOBALPOD = require('./models/MGLOBALPOD');
const ORDERS = require('./models/ORDERS');
const WAORDERS = require('./models/WAORDERS');
const PharmacyFORM = require('./models/PharmacyFORM');
const NONCODPOD = require('./models/NONCODPOD');

const orderWatch = ORDERS.watch()

// Define storage for uploaded images
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve static files from the 'images' directory
app.use('/images', express.static('images'));

const apiKey = process.env.API_KEY;
const username = process.env.USRNME;
const password = process.env.PASSWORD;

// Create an array to store processing results
const processingResults = [];

app.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const moment = require('moment');
        const now = moment();

        function generateLocation(order) {
            const { latestLocation, room, rackRowNum, area, jobMethod } = order;
            if (!latestLocation) return '-';

            let parts = [latestLocation];

            if (latestLocation === 'Warehouse K1') {
                return parts.join(', ');
            }

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
            {
                product: 1,
                currentStatus: 1,
                warehouseEntry: 1,
                jobMethod: 1,
                warehouseEntryDateTime: 1,
                creationDate: 1,
                doTrackingNumber: 1,
                attempt: 1,
                latestReason: 1,
                area: 1,
                receiverName: 1,
                receiverPhoneNumber: 1,
                additionalPhoneNumber: 1,
                fridge: 1,
                latestLocation: 1,
                grRemark: 1,
                room: 1,
                rackRowNum: 1
            }
        );

        const deliveryOrders = await ORDERS.find(
            { currentStatus: "Out for Delivery" },
            {
                product: 1,
                jobDate: 1,
                assignedTo: 1,
                doTrackingNumber: 1,
                attempt: 1,
                receiverName: 1,
                receiverPhoneNumber: 1,
                grRemark: 1,
                area: 1
            }
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
                    fridge: order.fridge || '-',
                    latestLocation: order.latestLocation || '-',
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
                        fridge: order.fridge || '-',
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
            } else if (product === "temu") {
                return (method === "Standard" && age >= 5 && age <= 14) || (method === "Drop Off" && age >= 7 && age <= 14);
            } else {
                return warehouseEntry === "Yes" && ["At Warehouse", "Return to Warehouse"].includes(currentStatus) && age >= 3 && age <= 14;
            }
        });

        const overdueMap = categorize(allOrders, (order, age) => {
            const { product } = order;
            if (["pharmacymoh", "pharmacyjpmc", "pharmacyphc"].includes(product)) return age > 7 && age < 30;
            if (product === "temu") return age > 14 && age < 30;
            return age > 14 && age < 30;
        });

        const archivedMap = categorize(allOrders, (order, age) => age >= 30);

        const maxAttemptMap = categorize(allOrders, (order, age) => order.attempt >= 3 && age < 30);

        const fridgeMap = categorize(allOrders, (order, age) => {
            return ["pharmacymoh", "pharmacyjpmc", "pharmacyphc"].includes(order.product) &&
                ["At Warehouse", "Return to Warehouse"].includes(order.currentStatus) &&
                order.fridge === "Yes";
        });

        const deliveriesMap = (() => {
            const map = {};
            const assigneeAreas = {}; // track areas per assignee

            deliveryOrders.forEach(order => {
                const date = order.jobDate ? moment(order.jobDate).format("DD-MM-YYYY") : "Unknown Date";
                const assignee = order.assignedTo || "Unassigned";
                const product = order.product || "Unknown";
                const area = order.area || "Unknown";

                if (!map[date]) map[date] = {};
                if (!map[date][assignee]) {
                    map[date][assignee] = { __areas: new Set(), __products: {} };
                }

                map[date][assignee].__areas.add(area); // add to area Set

                if (!map[date][assignee].__products[product]) {
                    map[date][assignee].__products[product] = [];
                }

                map[date][assignee].__products[product].push({
                    doTrackingNumber: order.doTrackingNumber || '-',
                    area: order.area || '-',
                    receiverName: order.receiverName || '-',
                    receiverPhoneNumber: order.receiverPhoneNumber || '-',
                    grRemark: order.grRemark || '-'
                });
            });

            // Convert Sets to arrays for rendering
            Object.keys(map).forEach(date => {
                Object.keys(map[date]).forEach(assignee => {
                    map[date][assignee].__areas = Array.from(map[date][assignee].__areas);
                });
            });

            return map;
        })();

        res.render('dashboard', {
            currentMap,
            urgentMap,
            overdueMap,
            archivedMap,
            maxAttemptMap,
            fridgeMap,
            deliveriesMap,
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

// Render login page
app.get('/login', ensureNotAuthenticated, (req, res) => {
    res.render('login', { errors: [], user: null }); // Pass an empty user object or null
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

app.get('/search', ensureAuthenticated, ensureViewJob, (req, res) => {
    res.render('search', { moment: moment, user: req.user, orders: [], searchQuery: {} });
});

app.post('/search', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const { patientNumber, icPassNum, receiverPhoneNumber } = req.body;

        // Modify query to include pharmacymoh, pharmacyjpmc, and pharmacyphc
        let query = { product: { $in: ["pharmacymoh", "pharmacyjpmc", "pharmacyphc"] } };

        if (patientNumber) {
            query.patientNumber = new RegExp(patientNumber, 'i'); // Case-insensitive partial match
        }

        if (icPassNum) {
            query.icPassNum = new RegExp(icPassNum, 'i'); // Case-insensitive partial match
        }

        if (receiverPhoneNumber) {
            query.receiverPhoneNumber = new RegExp(receiverPhoneNumber, 'i'); // Case-insensitive partial match
        }

        const orders = await ORDERS.find(query)
            .select([
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
                'jobType',
                'jobMethod'
            ])
            .sort({ _id: -1 })
            .limit(1000);

        res.render('search', { moment: moment, user: req.user, orders, searchQuery: req.body });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/ewemanifesttobillsearch', ensureAuthenticated, ensureViewJob, (req, res) => {
    res.render('ewemanifesttobillsearch', { moment: moment, user: req.user, orders: [], searchQuery: {} });
});

app.get('/pdumanifesttobillsearch', ensureAuthenticated, ensureViewJob, (req, res) => {
    res.render('pdumanifesttobillsearch', { moment: moment, user: req.user, orders: [], searchQuery: {} });
});

app.get('/mglobalmanifesttobillsearch', ensureAuthenticated, ensureViewJob, (req, res) => {
    res.render('mglobalmanifesttobillsearch', { moment: moment, user: req.user, orders: [], searchQuery: {} });
});

app.post('/ewemanifesttobillsearch', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const { mawbNo } = req.body;

        let query = { product: { $in: ["ewe", "ewens"] } };

        if (mawbNo) {
            query.mawbNo = new RegExp(mawbNo, 'i'); // Case-insensitive partial match
        }

        const orders = await ORDERS.find(query)
            .select([
                '_id',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'area',
                'receiverPhoneNumber',
                'parcelWeight',
                'flightDate',
                'items',
                'mawbNo',
                'receiverPostalCode'
            ])
            .sort({ _id: -1 })
            .limit(5000);

        res.render('ewemanifesttobillsearch', { moment: moment, user: req.user, orders, searchQuery: req.body });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.post('/pdumanifesttobillsearch', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const { mawbNo } = req.body;

        // Update the query to only include "pdu" as the product
        let query = { product: "pdu" };

        if (mawbNo) {
            query.mawbNo = new RegExp(mawbNo, 'i'); // Case-insensitive partial match
        }

        const orders = await ORDERS.find(query)
            .select([
                '_id',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'area',
                'receiverPhoneNumber',
                'parcelWeight',
                'flightDate',
                'items',
                'mawbNo',
                'receiverPostalCode'
            ])
            .sort({ _id: -1 })
            .limit(5000);

        res.render('pdumanifesttobillsearch', { moment: moment, user: req.user, orders, searchQuery: req.body });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.post('/mglobalmanifesttobillsearch', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const { mawbNo } = req.body;

        // Update the query to only include "pdu" as the product
        let query = { product: "mglobal" };

        if (mawbNo) {
            query.mawbNo = new RegExp(mawbNo, 'i'); // Case-insensitive partial match
        }

        const orders = await ORDERS.find(query)
            .select([
                '_id',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'area',
                'receiverPhoneNumber',
                'parcelWeight',
                'flightDate',
                'items',
                'mawbNo',
                'receiverPostalCode'
            ])
            .sort({ _id: -1 })
            .limit(5000);

        res.render('mglobalmanifesttobillsearch', { moment: moment, user: req.user, orders, searchQuery: req.body });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
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

app.get('/listofOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: { $nin: ["fmx", "ewe", "pharmacymoh", "ewens", "temu", "kptdp", "kptdf", "pdu", "mglobal"] },
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'paymentAmount',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'additionalPhoneNumber',
                'dateTimeSubmission'
            ])
            .sort({ _id: -1 })
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
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

        console.log(waorders)

        const totalRecords = waorders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofWargaEmasOrders', { waorders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofAllOrdersAW', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const statusValues = ["At Warehouse", "Return to Warehouse"];

        const areaFilters = {
            "B": ["B", "B1", "B2"],
            "G": ["G", "G1", "G2"],
            "JT": ["JT", "JT1", "JT2", "JT3"],
            "KB": ["KB", "KB / SERIA", "LUMUT", "SERIA"],
            "TUT": ["TUTONG"],
            "TEMB": ["TEMBURONG"],
            "N/A": ["N/A", "", null]
        };

        const productFilters = {
            "MOH": "pharmacymoh",
            "JPMC": "pharmacyjpmc",
            "PHC": "pharmacyphc",
            "LD": "localdelivery",
            "CBSL": "cbsl",
            "EWE": "ewe",
            "EWENS": "ewens",
            "FMX": "fmx",
            "ICARUS": "icarus",
            "JOYBEAN": "localdeliveryjb",
            "BAIDURI": "bb",
            "FATHAN": "fcas",
            "GRP": "grp"
        };

        const counts = {};
        const productCounts = {};

        for (const key in areaFilters) {
            counts[key] = await ORDERS.countDocuments({
                area: { $in: areaFilters[key] },
                currentStatus: { $in: statusValues }
            });

            productCounts[key] = {};
            for (const productKey in productFilters) {
                productCounts[key][productKey] = await ORDERS.countDocuments({
                    area: { $in: areaFilters[key] },
                    product: productFilters[productKey],
                    currentStatus: { $in: statusValues }
                });
            }
        }

        const orders = await ORDERS.find({
            currentStatus: { $in: statusValues }
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'paymentAmount',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'additionalPhoneNumber',
                'dateTimeSubmission'
            ])
            .sort({ warehouseEntryDateTime: 1 });

        const totalRecords = orders.length;

        res.render('listofAllOrdersAW', { orders, counts, productCounts, moment, user: req.user, totalRecords });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofOrdersCompleted', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: { $nin: ["fmx", "ewe", "pharmacymoh", "ewens", "temu", "kptdp", "kptdf", "pdu", "mglobal"] },
            currentStatus: "Completed" // Equal to "Out for Delivery" // Product not equal to "fmx"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'paymentAmount',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'dateTimeSubmission',
            ])
            .sort({ lastUpdateDateTime: -1 }) // Sort by lastUpdateDateTime in descending order
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofOrdersCompleted', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofOrdersOFD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: { $nin: ["fmx", "ewe", "pharmacymoh", "ewens", "temu", "kptdp", "kptdf", "pdu", "mglobal"] },
            currentStatus: "Out for Delivery" // Equal to "Out for Delivery" // Product not equal to "fmx"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'paymentAmount',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'additionalPhoneNumber',
                'dateTimeSubmission'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofOrdersOFD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofAllOrdersOFD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const orders = await ORDERS.find({
            currentStatus: { $in: ["Out for Delivery", "Out for Collection"] } // Include both statuses
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'parcelTrackingNum',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'paymentAmount',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'additionalPhoneNumber',
                'dateTimeSubmission'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofAllOrdersOFD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofAllOrdersIR', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const orders = await ORDERS.find({
            product: { $nin: ["fmx", "ewe", "ewens", "temu", "kptdp", "kptdf", "pdu", "mglobal"] },
            currentStatus: "Info Received"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'parcelTrackingNum',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'paymentAmount',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'additionalPhoneNumber',
                'dateTimeSubmission'
            ])
            .sort({ _id: -1 });

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofAllOrdersIR', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofOrdersSC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: { $nin: ["fmx", "ewe", "pharmacymoh", "ewens", "temu", "kptdp", "kptdf", "pdu", "mglobal"] },
            currentStatus: "Self Collect" // Equal to "Out for Delivery" // Product not equal to "fmx"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'paymentAmount',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'additionalPhoneNumber',
                'dateTimeSubmission'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofOrdersSC', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofAllOrdersSC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            currentStatus: { $in: ["Self Collect", "Drop Off"] } // Include both statuses
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'paymentAmount',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'additionalPhoneNumber',
                'dateTimeSubmission'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofAllOrdersSC', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofOrdersAW', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const statusValues = ["At Warehouse", "Return to Warehouse"];
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: { $nin: ["fmx", "ewe", "pharmacymoh", "ewens", "temu", "kptdp", "kptdf", "pdu", "mglobal"] },
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'paymentAmount',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'additionalPhoneNumber',
                'dateTimeSubmission'
            ])
            .sort({ warehouseEntryDateTime: 1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofOrdersAW', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofOrdersIRCC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const statusValues = ["Info Received", "Custom Clearing", "Detained by Customs", "Custom Clearance Release"];
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: { $nin: ["fmx", "ewe", "pharmacymoh", "ewens", "temu", "kptdp", "kptdf", "pdu", "mglobal"] },
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'paymentAmount',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'additionalPhoneNumber',
                'dateTimeSubmission'
            ])
            .sort({ _id: -1 })

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofOrdersIRCC', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofOrdersCD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const statusValues = ["Cancelled", "Disposed"];
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: { $nin: ["fmx", "ewe", "pharmacymoh", "ewens", "temu", "kptdp", "kptdf", "pdu", "mglobal"] },
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'paymentAmount',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'dateTimeSubmission'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofOrdersCD', { orders, totalRecords, moment: moment, user: req.user });
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

app.get('/listofpharmacyMOHOrdersCompleted', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "pharmacymoh",
            currentStatus: "Completed" // Equal to "Out for Delivery" // Product not equal to "fmx"
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
            .sort({ lastUpdateDateTime: -1 }) // Sort by lastUpdateDateTime in descending order
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHOrdersCompleted', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyMOHOrdersOFD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "pharmacymoh",
            currentStatus: "Out for Delivery" // Equal to "Out for Delivery" // Product not equal to "fmx"
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
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHOrdersOFD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyMOHOrdersSC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "pharmacymoh",
            currentStatus: "Self Collect" // Equal to "Out for Delivery" // Product not equal to "fmx"
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
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHOrdersSC', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyMOHOrdersAW', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const statusValues = ["At Warehouse", "Return to Warehouse"];
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "pharmacymoh",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
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
            .sort({ warehouseEntryDateTime: 1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHOrdersAW', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyMOHOrdersIRCC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const statusValues = ["Info Received"];
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "pharmacymoh",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
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

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHOrdersIRCC', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyMOHOrdersCD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const statusValues = ["Cancelled"];
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "pharmacymoh",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
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
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHOrdersCD', { orders, totalRecords, moment: moment, user: req.user });
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

app.get('/listofpharmacyJPMCOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "pharmacymoh" and "deliveryTypeCode" value "EXP"
        const orders = await ORDERS.find({ product: "pharmacyjpmc" })
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
                'deliveryType',
                'remarks',
                'paymentMethod',
                'paymentAmount',
                'dateTimeSubmission',
                'membership',
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
        res.render('listofpharmacyJPMCOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyPHCOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "pharmacymoh" and "deliveryTypeCode" value "EXP"
        const orders = await ORDERS.find({ product: "pharmacyphc" })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'area',
                'patientNumber',
                'icPassNum',
                'receiverPhoneNumber',
                'additionalPhoneNumber',
                'remarks',
                'paymentMethod',
                'dateTimeSubmission',
                'membership',
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
        res.render('listofpharmacyPHCOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofLDOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "localdelivery"
        const orders = await ORDERS.find({ product: "localdelivery" })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'senderName',
                'senderPhoneNumber',
                'receiverName',
                'receiverPhoneNumber',
                'receiverAddress',
                'area',
                'ldPickupOrDelivery',
                'items',
                'ldProductType',
                'ldProductWeight',
                'pickupAddress',
                'pickupDate',
                'remarks',
                'paymentMethod',
                'paymentAmount',
                'billTo',
                'dateTimeSubmission',
                'membership',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ _id: -1 });

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofLDOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofLDJBOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "localdelivery"
        const orders = await ORDERS.find({ product: "localdeliveryjb" })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'senderName',
                'senderPhoneNumber',
                'receiverName',
                'receiverPhoneNumber',
                'receiverAddress',
                'area',
                'ldPickupOrDelivery',
                'items',
                'ldProductType',
                'ldProductWeight',
                'pickupAddress',
                'pickupDate',
                'remarks',
                'paymentMethod',
                'paymentAmount',
                'billTo',
                'dateTimeSubmission',
                'membership',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ _id: -1 });

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofLDJBOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofICARUSOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "localdelivery"
        const orders = await ORDERS.find({ product: "icarus" })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'senderName',
                'senderPhoneNumber',
                'receiverName',
                'receiverPhoneNumber',
                'receiverAddress',
                'area',
                'ldPickupOrDelivery',
                'items',
                'ldProductType',
                'ldProductWeight',
                'pickupAddress',
                'pickupDate',
                'remarks',
                'paymentMethod',
                'paymentAmount',
                'billTo',
                'dateTimeSubmission',
                'membership',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ _id: -1 });

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofICARUSOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofFCASOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "localdelivery"
        const orders = await ORDERS.find({ product: "fcas" })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'senderName',
                'senderPhoneNumber',
                'receiverName',
                'receiverPhoneNumber',
                'receiverAddress',
                'area',
                'ldPickupOrDelivery',
                'items',
                'ldProductType',
                'ldProductWeight',
                'pickupAddress',
                'pickupDate',
                'remarks',
                'paymentMethod',
                'paymentAmount',
                'billTo',
                'dateTimeSubmission',
                'membership',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ _id: -1 });

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFCASOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofBBOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "localdelivery"
        const orders = await ORDERS.find({ product: "bb" })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'senderName',
                'senderPhoneNumber',
                'receiverName',
                'receiverPhoneNumber',
                'receiverAddress',
                'area',
                'ldPickupOrDelivery',
                'items',
                'ldProductType',
                'pickupAddress',
                'pickupDate',
                'remarks',
                'paymentMethod',
                'paymentAmount',
                'billTo',
                'dateTimeSubmission',
                'membership',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ _id: -1 });

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofBBOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofPURE51Orders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "localdelivery"
        const orders = await ORDERS.find({ product: "pure51" })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'senderName',
                'senderPhoneNumber',
                'receiverName',
                'receiverPhoneNumber',
                'receiverAddress',
                'area',
                'ldPickupOrDelivery',
                'items',
                'ldProductType',
                'pickupAddress',
                'pickupDate',
                'remarks',
                'paymentMethod',
                'paymentAmount',
                'billTo',
                'dateTimeSubmission',
                'membership',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ _id: -1 });

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofPURE51Orders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofGRPOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "localdelivery"
        const orders = await ORDERS.find({ product: "grp" })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'parcelTrackingNum',
                'goRushReceivingCountry',
                'warehouseReference',
                'supplierName',
                'buyerName',
                'receiverPhoneNumber',
                'receiverAddress',
                'area',
                'itemCommodityType',
                'itemContains',
                'currency',
                'items',
                'parcelWeight',
                'paymentMethod',
                'paymentAmount',
                'remarks',
                'dateTimeSubmission',
                'membership',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'additionalPhoneNumber'
            ])
            .sort({ _id: -1 });

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofGRPOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofCBSLOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "localdelivery"
        const orders = await ORDERS.find({ product: "cbsl" })
            .select([
                '_id',
                'product',
                'parcelTrackingNum',
                'doTrackingNumber',
                'buyerName',
                'receiverPhoneNumber',
                'receiverAddress',
                'area',
                'supplierName',
                'items',
                'cargoPrice',
                'screenshotInvoice',
                'paymentMethod',
                'paymentAmount',
                'remarks',
                'dateTimeSubmission',
                'membership',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'additionalPhoneNumber'
            ])
            .sort({ _id: -1 });

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofCBSLOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofFMXOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "fmx"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ _id: -1 })
            .limit(500);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFMXOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofFMXOrdersCompleted', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "fmx",
            currentStatus: "Completed" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ lastUpdateDateTime: -1 }) // Sort by lastUpdateDateTime in descending order
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFMXOrdersCompleted', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofFMXOrdersOFD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Out for Delivery"
        const orders = await ORDERS.find({
            product: "fmx",
            currentStatus: "Out for Delivery" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFMXOrdersOFD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofFMXOrdersSC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Out for Delivery"
        const orders = await ORDERS.find({
            product: "fmx",
            currentStatus: "Self Collect" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFMXOrdersSC', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofFMXOrdersAW', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["At Warehouse", "Return to Warehouse"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "fmx",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ warehouseEntryDateTime: 1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFMXOrdersAW', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofFMXOrdersIRCC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["Info Received", "Custom Clearing", "Detained by Customs", "Custom Clearance Release"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "fmx",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFMXOrdersIRCC', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofFMXOrdersCD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["Cancelled", "Disposed"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "fmx",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFMXOrdersCD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofTEMUCOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "temu"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ _id: -1 })
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofTEMUCOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofTEMUDOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "temu",
            jobType: "Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ _id: -1 })
            .limit(500);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofTEMUDOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofTEMUCOrdersCompleted', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "temu",
            jobType: "Collection",
            currentStatus: "Completed" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }) // Sort by lastUpdateDateTime in descending order
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofTEMUCOrdersCompleted', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofTEMUDOrdersCompleted', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "temu",
            jobType: "Delivery",
            currentStatus: "Completed" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }) // Sort by lastUpdateDateTime in descending order
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofTEMUDOrdersCompleted', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofTEMUDOrdersAW', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["At Warehouse", "Return to Warehouse"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "temu",
            jobType: "Delivery",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ warehouseEntryDateTime: 1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofTEMUDOrdersAW', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofTEMUCOrdersOFC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Out for Delivery"
        const orders = await ORDERS.find({
            product: "temu",
            jobType: "Collection",
            currentStatus: "Out for Collection" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofTEMUCOrdersOFC', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofTEMUDOrdersOFD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Out for Delivery"
        const orders = await ORDERS.find({
            product: "temu",
            jobType: "Delivery",
            currentStatus: "Out for Delivery" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofTEMUCOrdersOFD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofTEMUCOrdersDO', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Self Collect"
        const orders = await ORDERS.find({
            product: "temu",
            jobType: "Collection",
            currentStatus: "Drop Off" // Equal to "Self Collect"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofTEMUCOrdersDO', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofTEMUDOrdersSC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Self Collect"
        const orders = await ORDERS.find({
            product: "temu",
            jobType: "Delivery",
            currentStatus: "Self Collect" // Equal to "Self Collect"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWEOrdersSC', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofTEMUCOrdersCD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["Cancelled", "Disposed"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "temu",
            jobType: "Collection",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofTEMUCOrdersCD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofTEMUDOrdersCD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["Cancelled", "Disposed"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "temu",
            jobType: "Delivery",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofTEMUDOrdersCD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofEWEOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "ewe"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ _id: -1 })
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWEOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofPDUOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "pdu"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ _id: -1 })
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofPDUOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofMGLOBALOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "mglobal"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ _id: -1 })
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofMGLOBALOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofKPTDPOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "kptdp"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight',
                'parcelTrackingNum'
            ])
            .sort({ _id: -1 })
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofKPTDPOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofKPTDFOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "kptdf"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight',
                'parcelTrackingNum'
            ])
            .sort({ _id: -1 })
            .limit(500);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofKPTDFOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofKPTDPOrdersCompleted', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "kptdp",
            currentStatus: "Completed" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight',
                'parcelTrackingNum'
            ])
            .sort({ lastUpdateDateTime: -1 }) // Sort by lastUpdateDateTime in descending order
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofKPTDPOrdersCompleted', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofKPTDFOrdersCompleted', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "kptdf",
            currentStatus: "Completed" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight',
                'parcelTrackingNum'
            ])
            .sort({ lastUpdateDateTime: -1 }) // Sort by lastUpdateDateTime in descending order
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofKPTDFOrdersCompleted', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofEWEOrdersCompleted', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "ewe",
            currentStatus: "Completed" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }) // Sort by lastUpdateDateTime in descending order
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWEOrdersCompleted', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofPDUOrdersCompleted', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "pdu",
            currentStatus: "Completed" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }) // Sort by lastUpdateDateTime in descending order
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofPDUOrdersCompleted', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofMGLOBALOrdersCompleted', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "mglobal",
            currentStatus: "Completed" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }) // Sort by lastUpdateDateTime in descending order
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofMGLOBALOrdersCompleted', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofEWEOrdersOFD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Out for Delivery"
        const orders = await ORDERS.find({
            product: "ewe",
            currentStatus: "Out for Delivery" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWEOrdersOFD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofPDUOrdersOFD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Out for Delivery"
        const orders = await ORDERS.find({
            product: "pdu",
            currentStatus: "Out for Delivery" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofPDUOrdersOFD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofMGLOBALOrdersOFD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Out for Delivery"
        const orders = await ORDERS.find({
            product: "mglobal",
            currentStatus: "Out for Delivery" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofMGLOBALOrdersOFD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofKPTDPOrdersOFD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Out for Delivery"
        const orders = await ORDERS.find({
            product: "kptdp",
            currentStatus: "Out for Delivery" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight',
                'parcelTrackingNum'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofKPTDPOrdersOFD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofKPTDFOrdersOFD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Out for Delivery"
        const orders = await ORDERS.find({
            product: "kptdf",
            currentStatus: "Out for Delivery" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight',
                'parcelTrackingNum'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofKPTDFOrdersOFD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofEWEOrdersSC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Self Collect"
        const orders = await ORDERS.find({
            product: "ewe",
            currentStatus: "Self Collect" // Equal to "Self Collect"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWEOrdersSC', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofPDUOrdersSC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Self Collect"
        const orders = await ORDERS.find({
            product: "pdu",
            currentStatus: "Self Collect" // Equal to "Self Collect"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofPDUOrdersSC', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofMGLOBALOrdersSC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Self Collect"
        const orders = await ORDERS.find({
            product: "mglobal",
            currentStatus: "Self Collect" // Equal to "Self Collect"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofMGLOBALOrdersSC', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofKPTDPOrdersSC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Self Collect"
        const orders = await ORDERS.find({
            product: "kptdp",
            currentStatus: "Self Collect" // Equal to "Self Collect"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight',
                'parcelTrackingNum'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofKPTDPOrdersSC', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofKPTDFOrdersSC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Self Collect"
        const orders = await ORDERS.find({
            product: "kptdf",
            currentStatus: "Self Collect" // Equal to "Self Collect"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight',
                'parcelTrackingNum'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofKPTDFOrdersSC', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofEWEOrdersAW', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["At Warehouse", "Return to Warehouse"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "ewe",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ warehouseEntryDateTime: 1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWEOrdersAW', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofPDUOrdersAW', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["At Warehouse", "Return to Warehouse"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "pdu",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ warehouseEntryDateTime: 1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofPDUOrdersAW', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofMGLOBALOrdersAW', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["At Warehouse", "Return to Warehouse"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "mglobal",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ warehouseEntryDateTime: 1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofMGLOBALOrdersAW', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofKPTDPOrdersAW', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["At Warehouse", "Return to Warehouse"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "kptdp",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight',
                'parcelTrackingNum'
            ])
            .sort({ warehouseEntryDateTime: 1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofKPTDPOrdersAW', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofKPTDFOrdersAW', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["At Warehouse", "Return to Warehouse"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "kptdf",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight',
                'parcelTrackingNum'
            ])
            .sort({ warehouseEntryDateTime: 1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofKPTDFOrdersAW', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofEWEOrdersCD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["Cancelled", "Disposed"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "ewe",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWEOrdersCD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofPDUOrdersCD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["Cancelled", "Disposed"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "pdu",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofPDUOrdersCD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofMGLOBALOrdersCD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["Cancelled", "Disposed"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "mglobal",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofMGLOBALOrdersCD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofKPTDPOrdersCD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["Cancelled", "Disposed"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "kptdp",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight',
                'parcelTrackingNum'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofKPTDPOrdersCD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofKPTDFOrdersCD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["Cancelled", "Disposed"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "kptdf",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight',
                'parcelTrackingNum'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofKPTDFOrdersCD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofEWENSOrders', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "ewens"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ _id: -1 })
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWENSOrders', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofEWENSOrdersCompleted', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: "ewens",
            currentStatus: "Completed" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }) // Sort by lastUpdateDateTime in descending order
            .limit(5000);

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWENSOrdersCompleted', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofEWENSOrdersOFD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Out for Delivery"
        const orders = await ORDERS.find({
            product: "ewens",
            currentStatus: "Out for Delivery" // Equal to "Out for Delivery"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWENSOrdersOFD', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofEWENSOrdersSC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with "product" value "fmx" and currentStatus equal to "Self Collect"
        const orders = await ORDERS.find({
            product: "ewens",
            currentStatus: "Self Collect" // Equal to "Self Collect"
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'latestLocation',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWENSOrdersSC', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofEWENSOrdersAW', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["At Warehouse", "Return to Warehouse"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "ewens",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ warehouseEntryDateTime: 1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWENSOrdersAW', { orders, totalRecords, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofEWENSOrdersCD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Define an array containing the desired currentStatus values
        const statusValues = ["Cancelled", "Disposed"];

        // Query the database to find orders with "product" value "fmx" and currentStatus equal to one of the values in statusValues array
        const orders = await ORDERS.find({
            product: "ewens",
            currentStatus: { $in: statusValues } // Equal to one of the values in statusValues array
        })
            .select([
                '_id',
                'product',
                'doTrackingNumber',
                'receiverName',
                'receiverAddress',
                'receiverPhoneNumber',
                'area',
                'remarks',
                'paymentMethod',
                'items',
                'senderName',
                'totalPrice',
                'jobDate',
                'currentStatus',
                'warehouseEntry',
                'warehouseEntryDateTime',
                'assignedTo',
                'attempt',
                'flightDate',
                'mawbNo',
                'fmxMilestoneStatus',
                'fmxMilestoneStatusCode',
                'latestReason',
                'history',
                'lastUpdateDateTime',
                'creationDate',
                'instructions',
                'latestLocation',
                'lastUpdatedBy',
                'lastAssignedTo',
                'deliveryType',
                'jobType',
                'jobMethod',
                'parcelWeight'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        const totalRecords = orders.length;

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWENSOrdersCD', { orders, totalRecords, moment: moment, user: req.user });
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


app.get('/listofgrpPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        // Use the new query syntax to find documents with selected fields
        const pods = await GRPPOD.find({})
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
        res.render('listofgrpPod', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch GRP POD data');
    }
});

app.get('/listoffmxPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        // Use the new query syntax to find documents with selected fields
        const pods = await FMXPOD.find({})
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
        res.render('listoffmxPod', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch FMX POD data');
    }
});

app.get('/listofEwePod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        // Use the new query syntax to find documents with selected fields
        const pods = await EWEPOD.find({})
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
        res.render('listofEwePod', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch EWE POD data');
    }
});

app.get('/listofpduPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        // Use the new query syntax to find documents with selected fields
        const pods = await PDUPOD.find({})
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
        res.render('listofpduPod', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch PDU POD data');
    }
});

app.get('/listofmglobalPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        // Use the new query syntax to find documents with selected fields
        const pods = await MGLOBALPOD.find({})
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
        res.render('listofmglobalPod', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch MGLOBAL POD data');
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


app.get('/listofkptdpPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        // Use the new query syntax to find documents with selected fields
        const pods = await KPTDPPOD.find({})
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
        res.render('listofkptdpPod', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch KPTDP POD data');
    }
});

app.get('/api/listofkptdpPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
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
                { htmlContent: regex } // supports tracking number search
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

        const total = await KPTDPPOD.countDocuments({});
        const filtered = await KPTDPPOD.countDocuments(query);

        const pods = await KPTDPPOD.find(query)
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
        console.error("Error loading KPTDP PODs:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.get('/listofkptdfPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        // Use the new query syntax to find documents with selected fields
        const pods = await KPTDFPOD.find({})
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
        res.render('listofkptdfPod', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch KPTDF POD data');
    }
});

app.get('/listofTemuPoc', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        // Use the new query syntax to find documents with selected fields
        const pods = await TEMUPOC.find({})
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
        res.render('listofTemuPoc', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch TEMU POC data');
    }
});

app.get('/api/listofTemuPoc', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
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

        const total = await TEMUPOC.countDocuments({});
        const filtered = await TEMUPOC.countDocuments(query);

        const pods = await TEMUPOC.find(query)
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
        console.error("Error loading TEMU POCs:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/listofTemuPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        // Use the new query syntax to find documents with selected fields
        const pods = await TEMUPOD.find({})
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
        res.render('listofTemuPod', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch TEMU POD data');
    }
});

app.get('/listofEweNSPod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        // Use the new query syntax to find documents with selected fields
        const pods = await EWENSPOD.find({})
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
        res.render('listofEweNSPod', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch EWENS POD data');
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
app.get('/podgrpDetail/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const pod = await GRPPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podgrpDetail', { htmlContent: pod.htmlContent, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Add a new route in your Express application
app.get('/podfmxDetail/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const pod = await FMXPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podfmxDetail', { htmlContent: pod.htmlContent, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Add a new route in your Express application
app.get('/podeweDetail/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const pod = await EWEPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podeweDetail', { htmlContent: pod.htmlContent, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Add a new route in your Express application
app.get('/podpduDetail/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const pod = await PDUPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podpduDetail', { htmlContent: pod.htmlContent, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Add a new route in your Express application
app.get('/podmglobalDetail/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const pod = await MGLOBALPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podmglobalDetail', { htmlContent: pod.htmlContent, user: req.user });
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
app.get('/podkptdpDetail/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const pod = await KPTDPPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podkptdpDetail', { htmlContent: pod.htmlContent, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Add a new route in your Express application
app.get('/podkptdfDetail/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const pod = await KPTDFPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podkptdfDetail', { htmlContent: pod.htmlContent, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Add a new route in your Express application
app.get('/poctemuDetail/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const pod = await TEMUPOC.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POC not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('poctemuDetail', { htmlContent: pod.htmlContent, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POC data');
    }
});

// Add a new route in your Express application
app.get('/podtemuDetail/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const pod = await TEMUPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podtemuDetail', { htmlContent: pod.htmlContent, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Add a new route in your Express application
app.get('/podewensDetail/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const pod = await EWENSPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podewensDetail', { htmlContent: pod.htmlContent, user: req.user });
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
app.get('/editGrpPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    GRPPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editGrpPod.ejs', { pod, user: req.user });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to update the HTML content of a specific POD
app.post('/updateGrpPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;
    const newHtmlContent = req.body.htmlContent;

    // Find the specific POD by ID
    GRPPOD.findByIdAndUpdate(podId, { htmlContent: newHtmlContent })
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
app.get('/editFmxPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    FMXPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editFmxPod.ejs', { pod, user: req.user });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to render the edit page for a specific POD
app.get('/editEwePod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    EWEPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editEwePod.ejs', { pod, user: req.user });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to render the edit page for a specific POD
app.get('/editPduPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    PDUPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editPduPod.ejs', { pod, user: req.user });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to render the edit page for a specific POD
app.get('/editMglobalPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    MGLOBALPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editMglobalPod.ejs', { pod, user: req.user });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
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
app.get('/editKptdpPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    KPTDPPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editKptdpPod.ejs', { pod, user: req.user });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to render the edit page for a specific POD
app.get('/editKptdfPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    KPTDFPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editKptdfPod.ejs', { pod, user: req.user });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to render the edit page for a specific POD
app.get('/editTemuPoc/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    TEMUPOC.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POC not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editTemuPoc.ejs', { pod, user: req.user });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POC data');
        });
});

// Route to render the edit page for a specific POD
app.get('/editTemuPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    TEMUPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editTemuPod.ejs', { pod, user: req.user });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to render the edit page for a specific POD
app.get('/editEweNSPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    EWENSPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editEweNSPod.ejs', { pod, user: req.user });
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
app.post('/updateFmxPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;
    const newHtmlContent = req.body.htmlContent;

    // Find the specific POD by ID
    FMXPOD.findByIdAndUpdate(podId, { htmlContent: newHtmlContent })
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
app.post('/updateEwePod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;
    const newHtmlContent = req.body.htmlContent;

    // Find the specific POD by ID
    EWEPOD.findByIdAndUpdate(podId, { htmlContent: newHtmlContent })
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
app.post('/updatePduPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;
    const newHtmlContent = req.body.htmlContent;

    // Find the specific POD by ID
    PDUPOD.findByIdAndUpdate(podId, { htmlContent: newHtmlContent })
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
app.post('/updateMglobalPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;
    const newHtmlContent = req.body.htmlContent;

    // Find the specific POD by ID
    MGLOBALPOD.findByIdAndUpdate(podId, { htmlContent: newHtmlContent })
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
app.post('/updateKptdpPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;
    const newHtmlContent = req.body.htmlContent;

    // Find the specific POD by ID
    KPTDPPOD.findByIdAndUpdate(podId, { htmlContent: newHtmlContent })
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
app.post('/updateKptdfPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;
    const newHtmlContent = req.body.htmlContent;

    // Find the specific POD by ID
    KPTDFPOD.findByIdAndUpdate(podId, { htmlContent: newHtmlContent })
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
app.post('/updateTemuPoc/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;
    const newHtmlContent = req.body.htmlContent;

    // Find the specific POD by ID
    TEMUPOC.findByIdAndUpdate(podId, { htmlContent: newHtmlContent })
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POC not found');
            }

            // Successfully updated the HTML content
            res.status(200).send('POC data updated successfully');
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to update POC data');
        });
});

// Route to update the HTML content of a specific POD
app.post('/updateTemuPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;
    const newHtmlContent = req.body.htmlContent;

    // Find the specific POD by ID
    TEMUPOD.findByIdAndUpdate(podId, { htmlContent: newHtmlContent })
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
app.post('/updateEweNSPod/:id', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, (req, res) => {
    const podId = req.params.id;
    const newHtmlContent = req.body.htmlContent;

    // Find the specific POD by ID
    EWENSPOD.findByIdAndUpdate(podId, { htmlContent: newHtmlContent })
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

app.get('/deleteGRPPod/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const podId = req.params.podId;

        // Use Mongoose to find and remove the document with the given ID
        const deletedPod = await GRPPOD.findByIdAndRemove(podId);

        if (deletedPod) {
            res.redirect('/listofgrpPod'); // Redirect to the list view after deletion
        } else {
            res.status(404).send('GRP POD not found');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to delete GRP POD');
    }
});

app.get('/deleteFMXPod/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const podId = req.params.podId;

        // Use Mongoose to find and remove the document with the given ID
        const deletedPod = await FMXPOD.findByIdAndRemove(podId);

        if (deletedPod) {
            res.redirect('/listoffmxPod'); // Redirect to the list view after deletion
        } else {
            res.status(404).send('FMX POD not found');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to delete FMX POD');
    }
});

app.get('/deleteEWEPod/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const podId = req.params.podId;

        // Use Mongoose to find and remove the document with the given ID
        const deletedPod = await EWEPOD.findByIdAndRemove(podId);

        if (deletedPod) {
            res.redirect('/listofEwePod'); // Redirect to the list view after deletion
        } else {
            res.status(404).send('EWE POD not found');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to delete EWE POD');
    }
});

app.get('/deletePDUPod/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const podId = req.params.podId;

        // Use Mongoose to find and remove the document with the given ID
        const deletedPod = await PDUPOD.findByIdAndRemove(podId);

        if (deletedPod) {
            res.redirect('/listofPduPod'); // Redirect to the list view after deletion
        } else {
            res.status(404).send('PDU POD not found');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to delete PDU POD');
    }
});

app.get('/deleteMGLOBALPod/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const podId = req.params.podId;

        // Use Mongoose to find and remove the document with the given ID
        const deletedPod = await MGLOBALPOD.findByIdAndRemove(podId);

        if (deletedPod) {
            res.redirect('/listofMglobalPod'); // Redirect to the list view after deletion
        } else {
            res.status(404).send('MGLOBAL POD not found');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to delete MGLOBAL POD');
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

app.get('/deleteKPTDPPod/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const podId = req.params.podId;

        // Use Mongoose to find and remove the document with the given ID
        const deletedPod = await KPTDPPOD.findByIdAndRemove(podId);

        if (deletedPod) {
            res.redirect('/listofKptdpPod'); // Redirect to the list view after deletion
        } else {
            res.status(404).send('KPTDP POD not found');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to delete KPTDP POD');
    }
});

app.get('/deleteKPTDFPod/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const podId = req.params.podId;

        // Use Mongoose to find and remove the document with the given ID
        const deletedPod = await KPTDFPOD.findByIdAndRemove(podId);

        if (deletedPod) {
            res.redirect('/listofKptdfPod'); // Redirect to the list view after deletion
        } else {
            res.status(404).send('KPTDP POD not found');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to delete KPTDF POD');
    }
});

app.get('/deleteTEMUPoc/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const podId = req.params.podId;

        // Use Mongoose to find and remove the document with the given ID
        const deletedPod = await TEMUPOC.findByIdAndRemove(podId);

        if (deletedPod) {
            res.redirect('/listofTemuPoc'); // Redirect to the list view after deletion
        } else {
            res.status(404).send('TEMU POC not found');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to delete TEMU POC');
    }
});

app.get('/deleteTEMUPod/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const podId = req.params.podId;

        // Use Mongoose to find and remove the document with the given ID
        const deletedPod = await TEMUPOD.findByIdAndRemove(podId);

        if (deletedPod) {
            res.redirect('/listofTemuPod'); // Redirect to the list view after deletion
        } else {
            res.status(404).send('TEMU POD not found');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to delete TEMU POD');
    }
});

app.get('/deleteEWENSPod/:podId', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    try {
        const podId = req.params.podId;

        // Use Mongoose to find and remove the document with the given ID
        const deletedPod = await EWENSPOD.findByIdAndRemove(podId);

        if (deletedPod) {
            res.redirect('/listofEweNSPod'); // Redirect to the list view after deletion
        } else {
            res.status(404).send('EWE POD not found');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to delete EWE POD');
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
        case 'GRP POD':
            PodModel = GRPPOD;
            break;
        case 'FMX POD':
            PodModel = FMXPOD;
            break;
        case 'EWE POD':
            PodModel = EWEPOD;
            break;
        case 'KPTDP POD':
            PodModel = KPTDPPOD;
            break;
        case 'KPTDF POD':
            PodModel = KPTDFPOD;
            break;
        case 'PDU POD':
            PodModel = PDUPOD;
            break;
        case 'MGLOBAL POD':
            PodModel = MGLOBALPOD;
            break;
        case 'EWENS POD':
            PodModel = EWENSPOD;
            break;
        case 'CBSL POD':
            PodModel = CBSLPOD;
            break;
        case 'TEMU POC':
            PodModel = TEMUPOC;
            break;
        case 'TEMU POD':
            PodModel = TEMUPOD;
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
            res.status(200).send('POD / POC data saved successfully');
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to save POD / POC data');
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
                if (product === "MOH/JPMC/PHC Pharmacy") {
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
                        fridge: order.fridge || '',
                    });

                } else {
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
                        fridge: '', // Detrack likely doesn't provide this
                    });
                }
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

// Handle form submission for /scanFMX route
app.post('/updateDelivery', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
    // Check if it's Sunday between 3 AM and 9 AM
    const now = moment();
    const isSunday = now.day() === 0;
    const isWithinRestrictedTime = now.hour() >= 0 && now.hour() < 12;

    let accessToken = null; // Initialize the accessToken variable

    if (!(isSunday && isWithinRestrictedTime)) {
        /*
        // Step 1: Authenticate and get accessToken
        const authResponse = await axios.post('https://client.fmx.asia/api/tokenauth/authenticate', {
            userNameOrEmailAddress: username,
            password: password,
            source: 'string'
        });

        accessToken = authResponse.data.result.accessToken;
        */
    } else {
        console.log("Skipping authentication because it's Sunday between 12 AM and 12 PM.");
    }
    // Split the tracking numbers by newlines

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
            var FMXAPIrun = 0;
            var mongoDBrun = 0;
            var completeRun = 0;
            var ceCheck = 0;
            var warehouseEntryCheck = 0;
            var waOrderArrivedDeliverStandard = 0;
            var waOrderArrivedDeliverExpressMedicine = 0;
            var waOrderArrivedDeliverExpressNonMedicine = 0;
            var waOrderArrivedDeliverImmediate = 0;
            var waOrderArrivedPickup = 0;
            var waOrderArrivedDeliverFMX = 0;
            var waOrderFailedDelivery = 0;
            var waOrderCompletedFeedback = 0;
            var product = '';
            var latestPODDate = "";
            var fmxUpdate = "";
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
            var fmxMilestoneCode = "";
            var remarkSC = '';
            var wmsAttempt = 0;
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

            // Skip empty lines
            if (!consignmentID) continue;

            console.log('Processing Consignment ID:', consignmentID);

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

            console.log(finalPhoneNum); // Output the final phone number

            for (let i = 0; i < counttaskhistory; i++) {
                if (data.data.milestones[i].status == 'completed') {
                    latestPODDate = data.data.milestones[i].pod_at;
                    completedCheckDateTime = data.data.milestones[i].created_at;
                }

                if (data.data.milestones[i].status == 'failed') {
                    detrackReason = data.data.milestones[i].reason;
                    if (data.data.milestones[i].reason == "Unattempted Delivery") {
                        wmsAttempt = wmsAttempt - 1;
                        unattemptedTimes = unattemptedTimes + 1;
                    }
                }

                if ((data.data.milestones[i].status == 'at_warehouse') && (warehouseEntryCheck == 0)) {
                    warehouseEntryCheckDateTime = data.data.milestones[i].created_at;
                    warehouseEntryCheck = 1;
                }

                if ((data.data.milestones[i].status == "out_for_delivery") || (data.data.milestones[i].status == "dispatched")) {
                    wmsAttempt = wmsAttempt + 1;
                }
            }

            lastMilestoneStatus = data.data.milestones[data.data.milestones.length - 1].status;

            if (data.data.postal_code != null) {
                postalCode = data.data.postal_code.toUpperCase()
            }

            product = data.data.group_name;

            if ((product == 'EWE') || (product == 'EWENS') || (product == 'KPTDP') || (product == 'PDU') || (product == 'PURE51') || (product == 'TEMU') || (product == 'MGLOBAL')) {
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

            if (req.body.statusCode == 'UFM') {
                appliedStatus = "Update Fridge Medicine"
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
                || (req.body.statusCode == 'FCC') || (req.body.statusCode == 'FSC')) {

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

            if (req.body.statusCode == 'FA') {
                newOrder = new ORDERS({
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
                });

                mongoDBrun = 1;
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

                mongoDBrun = 1;

                /* DetrackAPIrun = 1; */

                portalUpdate = "Portal updated for missing data. ";
                appliedStatus = "Missing data update"

                completeRun = 1;
            }

            if ((req.body.statusCode == 'IR') && (data.data.status == 'info_recv')) {
                if (existingOrder === null) {
                    if (product == 'TEMU') {
                        if (data.data.type == 'Collection') {
                            newOrder = new ORDERS({
                                area: area,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Info Received",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: "N/A",
                                    reason: "N/A",
                                    lastLocation: "Customer",
                                }],
                                lastAssignedTo: "N/A",
                                latestLocation: "Customer",
                                product: currentProduct,
                                assignedTo: "N/A",
                                senderName: data.data.job_owner,
                                totalPrice: 0,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Info Received",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "No",
                                warehouseEntryDateTime: "N/A",
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                latestReason: "N/A",
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: "N/A",
                                flightDate: "N/A",
                                mawbNo: "N/A",
                                lastUpdatedBy: req.user.name,
                                parcelWeight: "N/A",
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
            }

            if ((req.body.statusCode == 'CP') && (data.data.status == 'info_recv')) {
                if (existingOrder === null) {
                    if (product == 'PDU') {
                        newOrder = new ORDERS({
                            area: area,
                            items: itemsArray, // Use the dynamically created items array
                            attempt: data.data.attempt,
                            history: [{
                                statusHistory: "Custom Clearing",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastAssignedTo: "N/A",
                                reason: "N/A",
                                lastLocation: "Brunei Customs",
                            }],
                            lastAssignedTo: "N/A",
                            latestLocation: "Brunei Custom Clearance",
                            product: currentProduct,
                            assignedTo: "N/A",
                            senderName: "SYPOST",
                            totalPrice: data.data.total_price,
                            receiverName: data.data.deliver_to_collect_from,
                            trackingLink: data.data.tracking_link,
                            currentStatus: "Custom Clearing",
                            paymentMethod: data.data.payment_mode,
                            warehouseEntry: "No",
                            warehouseEntryDateTime: "N/A",
                            receiverAddress: data.data.address,
                            receiverPhoneNumber: finalPhoneNum,
                            doTrackingNumber: consignmentID,
                            remarks: data.data.remarks,
                            latestReason: "N/A",
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            jobDate: "N/A",
                            lastUpdatedBy: req.user.name,
                            parcelWeight: data.data.weight,
                            receiverPostalCode: postalCode,
                            jobType: data.data.type,
                            jobMethod: "Standard",
                            flightDate: data.data.job_received_date,
                            mawbNo: data.data.run_number
                        });

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "on_hold",
                                zone: area
                            }
                        };

                        portalUpdate = "Portal and Detrack status updated to Custom Clearing. ";

                        mongoDBrun = 1;
                        DetrackAPIrun = 1;
                        completeRun = 1;
                    }

                    if (product == 'MGLOBAL') {
                        newOrder = new ORDERS({
                            area: area,
                            items: itemsArray, // Use the dynamically created items array
                            attempt: data.data.attempt,
                            history: [{
                                statusHistory: "Custom Clearing",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastAssignedTo: "N/A",
                                reason: "N/A",
                                lastLocation: "Brunei Customs",
                            }],
                            lastAssignedTo: "N/A",
                            latestLocation: "Brunei Custom Clearance",
                            product: currentProduct,
                            assignedTo: "N/A",
                            senderName: "Morning Global",
                            totalPrice: data.data.total_price,
                            receiverName: data.data.deliver_to_collect_from,
                            trackingLink: data.data.tracking_link,
                            currentStatus: "Custom Clearing",
                            paymentMethod: "NON COD",
                            warehouseEntry: "No",
                            warehouseEntryDateTime: "N/A",
                            receiverAddress: data.data.address,
                            receiverPhoneNumber: finalPhoneNum,
                            doTrackingNumber: consignmentID,
                            remarks: data.data.remarks,
                            latestReason: "N/A",
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            jobDate: "N/A",
                            lastUpdatedBy: req.user.name,
                            parcelWeight: data.data.weight,
                            receiverPostalCode: postalCode,
                            jobType: data.data.type,
                            jobMethod: "Standard",
                            flightDate: data.data.job_received_date,
                            mawbNo: data.data.run_number
                        });

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "custom_clearing",
                                zone: area,
                                instructions: "CP",
                                job_type: "Standard",
                                total_price: 0,
                                payment_amount: 0,
                                payment_mode: "NON COD"
                            }
                        };

                        portalUpdate = "Portal and Detrack status updated to Custom Clearing. ";

                        mongoDBrun = 1;
                        DetrackAPIrun = 1;
                        completeRun = 1;
                    }
                }
            }

            if ((req.body.statusCode == '38') && (data.data.status == 'on_hold')) {
                if (product == 'PDU') {
                    update = {
                        currentStatus: "Custom Clearance Release",
                        lastUpdateDateTime: moment().format(),
                        latestLocation: "Brunei Customs",
                        lastUpdatedBy: req.user.name,
                        $push: {
                            history: {
                                statusHistory: "Custom Clearance Release",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastAssignedTo: "N/A",
                                reason: "N/A",
                                lastLocation: "Brunei Customs",
                            }
                        }
                    }

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "custom_clearing",
                            instructions: "CP"
                        }
                    };

                    portalUpdate = "Portal and Detrack status updated to Custom Clearance Release. ";

                    mongoDBrun = 2;
                    DetrackAPIrun = 1;
                    completeRun = 1;
                }
            }

            if (req.body.statusCode == 12) {
                if ((data.data.status == 'custom_clearing') && (data.data.instructions.includes('CP'))) {
                    update = {
                        currentStatus: "At Warehouse",
                        lastUpdateDateTime: moment().format(),
                        warehouseEntry: "Yes",
                        warehouseEntryDateTime: moment().format(),
                        latestLocation: req.body.warehouse,
                        lastUpdatedBy: req.user.name,
                        lastAssignedTo: "N/A",
                        $push: {
                            history: {
                                statusHistory: "At Warehouse",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastAssignedTo: "N/A",
                                reason: "N/A",
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

                    portalUpdate = "Portal and Detrack status updated to At Warehouse then Sorting Area. ";

                    mongoDBrun = 2;
                    DetrackAPIrun = 4;
                    completeRun = 1;

                }

                if ((data.data.status == 'info_recv') && (product == 'CBSL')) {
                    update = {
                        currentStatus: "At Warehouse",
                        lastUpdateDateTime: moment().format(),
                        warehouseEntry: "Yes",
                        warehouseEntryDateTime: moment().format(),
                        attempt: data.data.attempt,
                        latestLocation: req.body.warehouse,
                        lastUpdatedBy: req.user.name,
                        lastAssignedTo: "N/A",
                        $push: {
                            history: {
                                statusHistory: "At Warehouse",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastAssignedTo: "N/A",
                                reason: "N/A",
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
                            tracking_number: consignmentID
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
                            senderName: "KPT",
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
                            parcelTrackingNum: data.data.tracking_number,
                            remarks: data.data.remarks,
                            latestReason: "N/A",
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            jobDate: "N/A",
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
                                status: "", // Use the calculated dStatus
                                zone: area,
                                phone_number: finalPhoneNum
                            }
                        };

                        portalUpdate = "Portal status updated to At Warehouse. Detrack status updated to In Sorting Area. ";

                        DetrackAPIrun = 4;
                        completeRun = 1;
                    }
                }

                if ((data.data.status == 'info_recv') && (product != 'GRP') && (product != 'CBSL') && (product != 'TEMU') && (product != 'PDU') && (product != 'KPTDP') && (product != 'MGLOBAL')) {
                    if (existingOrder === null) {
                        if ((product == 'EWE') || (product == 'EWENS')) {
                            newOrder = new ORDERS({
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
                            });

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "", // Use the calculated dStatus
                                    zone: area,
                                    phone_number: finalPhoneNum
                                }
                            };

                            portalUpdate = "Portal status updated to At Warehouse. Detrack status updated to In Sorting Area. ";

                            mongoDBrun = 1;
                            DetrackAPIrun = 4;
                            completeRun = 1;
                        } else {
                            newOrder = new ORDERS({
                                area: area,
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
                                lastUpdatedBy: req.user.name,
                                receiverPostalCode: postalCode,
                                jobType: data.data.type,
                                jobMethod: data.data.job_type,
                                fridge: "No"
                            });

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "", // Use the calculated dStatus
                                    zone: area,
                                    phone_number: finalPhoneNum
                                }
                            };

                            portalUpdate = "Portal status updated to At Warehouse. Detrack status updated to In Sorting Area. ";

                            mongoDBrun = 1;
                            DetrackAPIrun = 4;
                            completeRun = 1;
                        }

                    } else {
                        update = {
                            currentStatus: "At Warehouse",
                            lastUpdateDateTime: moment().format(),
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: moment().format(),
                            latestLocation: req.body.warehouse,
                            lastUpdatedBy: req.user.name,
                            lastAssignedTo: "N/A",
                            fridge: "No",
                            $push: {
                                history: {
                                    statusHistory: "At Warehouse",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: "N/A",
                                    reason: "N/A",
                                    lastLocation: req.body.warehouse,
                                }
                            }
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "", // Use the calculated dStatus
                                zone: area,
                                phone_number: finalPhoneNum
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
                                area: area,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Out for Collection",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                    reason: "N/A",
                                    lastLocation: "Customer",
                                }],
                                lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
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
                                latestReason: "N/A",
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
                                    status: "dispatched"
                                }
                            };

                            portalUpdate = "Portal and Detrack status updated to Out for Collection assigned to " + req.body.dispatchers + " " + req.body.freelancerName + ". ";

                        } else {
                            newOrder = new ORDERS({
                                area: area,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Out for Collection",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: req.body.dispatchers,
                                    reason: "N/A",
                                    lastLocation: "Customer",
                                }],
                                lastAssignedTo: req.body.dispatchers,
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
                                latestReason: "N/A",
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
                                    status: "dispatched"
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
                                currentStatus: "Out for Collection",
                                lastUpdateDateTime: moment().format(),
                                instructions: data.data.remarks,
                                assignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                attempt: data.data.attempt,
                                jobDate: req.body.assignDate,
                                latestLocation: "Customer",
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                $push: {
                                    history: {
                                        statusHistory: "Out for Collection",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                        reason: "N/A",
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
                                    status: "dispatched"
                                }
                            };

                            portalUpdate = "Portal and Detrack status updated to Out for Collection assigned to " + req.body.dispatchers + " " + req.body.freelancerName + ". ";

                        } else {
                            update = {
                                currentStatus: "Out for Collection",
                                lastUpdateDateTime: moment().format(),
                                instructions: data.data.remarks,
                                assignedTo: req.body.dispatchers,
                                attempt: data.data.attempt,
                                jobDate: req.body.assignDate,
                                latestLocation: "Customer",
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: req.body.dispatchers,
                                $push: {
                                    history: {
                                        statusHistory: "Out for Collection",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: req.body.dispatchers,
                                        reason: "N/A",
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
                                    status: "dispatched"
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
                                area: area,
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
                                lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                latestLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                product: currentProduct,
                                assignedTo: "N/A",
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
                            update = {
                                currentStatus: "Out for Delivery",
                                lastUpdateDateTime: moment().format(),
                                instructions: data.data.remarks,
                                assignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                attempt: data.data.attempt,
                                jobDate: req.body.assignDate,
                                latestLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                $push: {
                                    history: {
                                        statusHistory: "Out for Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                        reason: "N/A",
                                        lastLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                    }
                                }
                            }

                            mongoDBrun = 2;

                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                date: req.body.assignDate, // Get the Assign Date from the form
                                assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                status: "dispatched"
                            }
                        };

                        portalUpdate = "Portal and Detrack status updated to Out for Delivery assigned to " + req.body.dispatchers + " " + req.body.freelancerName + ". ";

                    } else {
                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: area,
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
                                lastAssignedTo: req.body.dispatchers,
                                latestLocation: req.body.dispatchers,
                                product: currentProduct,
                                assignedTo: "N/A",
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
                            update = {
                                currentStatus: "Out for Delivery",
                                lastUpdateDateTime: moment().format(),
                                instructions: data.data.remarks,
                                assignedTo: req.body.dispatchers,
                                attempt: data.data.attempt,
                                jobDate: req.body.assignDate,
                                latestLocation: req.body.dispatchers,
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: req.body.dispatchers,
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

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                date: req.body.assignDate, // Get the Assign Date from the form
                                assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                status: "dispatched"
                            }
                        };

                        portalUpdate = "Portal and Detrack status updated to Out for Delivery assigned to " + req.body.dispatchers + ". ";
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
                                lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                latestReason: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
                                $push: {
                                    history: {
                                        statusHistory: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
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
                                lastAssignedTo: req.body.dispatchers,
                                latestReason: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
                                $push: {
                                    history: {
                                        statusHistory: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
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
                                lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                latestReason: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
                                $push: {
                                    history: {
                                        statusHistory: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
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
                                lastAssignedTo: req.body.dispatchers,
                                latestReason: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
                                $push: {
                                    history: {
                                        statusHistory: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
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
                                    area: area,
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
                                    lastAssignedTo: data.data.assign_to,
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
                                    lastAssignedTo: data.data.assign_to,
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
                                    area: area,
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
                                    lastAssignedTo: data.data.assign_to,
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
                                    attempt: data.data.attempt + 1,
                                    latestLocation: "Customer",
                                    lastUpdatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to,
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
                                lastAssignedTo: data.data.assign_to,
                                $push: {
                                    history: {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: data.data.reason,
                                        lastLocation: data.data.assign_to,
                                    },
                                    history: {
                                        statusHistory: "Return to Warehouse",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: "N/A",
                                        reason: "N/A",
                                        lastLocation: req.body.warehouse,
                                    }
                                }
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "at_warehouse" // Use the calculated dStatus
                                }
                            };

                            DetrackAPIrun = 1;
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
                                latestReason: data.data.reason,
                                attempt: data.data.attempt + 1,
                                latestLocation: req.body.warehouse,
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: data.data.assign_to,
                                grRemark: "Reschedule to self collect requested by customer",
                                $push: {
                                    history: {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: data.data.reason,
                                        lastLocation: data.data.assign_to,
                                    },
                                    history: {
                                        statusHistory: "Return to Warehouse",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: "N/A",
                                        reason: "N/A",
                                        lastLocation: req.body.warehouse,
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

                            DetrackAPIrun = 2;
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
                                lastAssignedTo: data.data.assign_to,
                                $push: {
                                    history: {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: data.data.reason,
                                        lastLocation: data.data.assign_to,
                                    },
                                    history: {
                                        statusHistory: "Return to Warehouse",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: "N/A",
                                        reason: "N/A",
                                        lastLocation: req.body.warehouse,
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

                            DetrackAPIrun = 2;
                            appliedStatus = "Failed Delivery, Return to Warehouse"
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        }
                    }

                    mongoDBrun = 2;
                    completeRun = 1;
                }

                if (data.data.status == 'completed') {
                    if (data.data.type == 'Collection') {
                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: area,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Completed",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to,
                                    reason: "N/A",
                                    lastLocation: req.body.warehouse,
                                }],
                                lastAssignedTo: data.data.assign_to,
                                latestLocation: req.body.warehouse,
                                product: currentProduct,
                                assignedTo: "N/A",
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
                                lastAssignedTo: data.data.assign_to,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                $push: {
                                    history: {
                                        statusHistory: "Completed",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "N/A",
                                        lastLocation: req.body.warehouse,
                                    }
                                }
                            }

                            mongoDBrun = 2;
                        }
                    } else {
                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: area,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: data.data.attempt,
                                history: [{
                                    statusHistory: "Completed",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to,
                                    reason: "N/A",
                                    lastLocation: "Customer",
                                }],
                                lastAssignedTo: data.data.assign_to,
                                latestLocation: "Customer",
                                product: currentProduct,
                                assignedTo: "N/A",
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
                                latestReason: "N/A",
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
                                lastAssignedTo: data.data.assign_to,
                                $push: {
                                    history: {
                                        statusHistory: "Completed",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "N/A",
                                        lastLocation: "Customer",
                                    }
                                }
                            }

                            mongoDBrun = 2;
                        }
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
                            area: area,
                            items: itemsArray, // Use the dynamically created items array
                            attempt: data.data.attempt,
                            history: [{
                                statusHistory: "Drop Off",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastAssignedTo: "Selfcollect",
                                reason: "N/A",
                                lastLocation: "Customer",
                            }],
                            lastAssignedTo: "Selfcollect",
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
                            latestReason: "N/A",
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
                            lastAssignedTo: "Selfcollect",
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
                            job_type: "Drop Off"
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
                                lastAssignedTo: "Selfcollect",
                                jobMethod: "Self Collect",
                                $push: {
                                    history: {
                                        statusHistory: "Self Collect",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: "Selfcollect",
                                        reason: "N/A",
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
                            update = {
                                currentStatus: "Self Collect",
                                lastUpdateDateTime: moment().format(),
                                instructions: data.data.remarks,
                                assignedTo: "Selfcollect",
                                jobDate: req.body.assignDate,
                                latestLocation: "Go Rush Office",
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: "Selfcollect",
                                jobMethod: "Self Collect",
                                $push: {
                                    history: {
                                        statusHistory: "Self Collect",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: "Selfcollect",
                                        reason: "N/A",
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
                        lastAssignedTo: "N/A",
                        pharmacyFormCreated: "Yes",
                        $push: {
                            history: {
                                statusHistory: "Cancelled",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastAssignedTo: "N/A",
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
                        lastAssignedTo: "N/A",
                        $push: {
                            history: {
                                statusHistory: "Cancelled",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastAssignedTo: "N/A",
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
                        }
                    };
                } else {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "cancelled",
                        }
                    };
                }

                portalUpdate = "Portal and Detrack status updated to Cancelled. ";

                mongoDBrun = 2
                DetrackAPIrun = 1;
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
                        lastAssignedTo: "N/A",
                        pharmacyFormCreated: "No",
                        $push: {
                            history: {
                                statusHistory: "Return to Warehouse",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastAssignedTo: "N/A",
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
                        lastAssignedTo: "N/A",
                        $push: {
                            history: {
                                statusHistory: "Return to Warehouse",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastAssignedTo: "N/A",
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
                    lastAssignedTo: "N/A",
                    $push: {
                        history: {
                            statusHistory: "Disposed",
                            dateUpdated: moment().format(),
                            updatedBy: req.user.name,
                            lastAssignedTo: "N/A",
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
                        latestReason: "Weight updated from " + data.data.weight + " kg to " + req.body.weight + " kg.",
                        lastUpdatedBy: req.user.name,
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
                        latestReason: "Weight updated to " + req.body.weight + " kg.",
                        lastUpdatedBy: req.user.name,
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
                        latestReason: "Payment method updated to " + req.body.paymentMethod + ".",
                        lastUpdatedBy: req.user.name,
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
                            latestReason: "Payment method updated to " + req.body.paymentMethod + ", price updated to $" + req.body.price,
                            lastUpdatedBy: req.user.name,
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
                            latestReason: "Payment method updated to " + req.body.paymentMethod + ", price updated to $" + req.body.price,
                            lastUpdatedBy: req.user.name,
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
                        latestReason: "Area updated from " + data.data.zone + " to " + req.body.area + ".",
                        lastUpdatedBy: req.user.name,
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
                        latestReason: "Area updated to " + req.body.area + ".",
                        lastUpdatedBy: req.user.name,
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
                        latestReason: "Address updated from " + data.data.address + " to " + req.body.address + ".",
                        lastUpdatedBy: req.user.name,
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
                        latestReason: "Address updated to " + req.body.address + ".",
                        lastUpdatedBy: req.user.name,
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
                        latestReason: "Phone number updated from " + data.data.phone_number + " to " + req.body.phoneNum + ".",
                        lastUpdatedBy: req.user.name,
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
                        latestReason: "Phone number updated to " + req.body.phoneNum + ".",
                        lastUpdatedBy: req.user.name,
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
                        latestReason: "Customer Name updated from " + data.data.deliver_to_collect_from + " to " + req.body.name + ".",
                        lastUpdatedBy: req.user.name,
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
                        latestReason: "Customer Name updated to " + req.body.name + ".",
                        lastUpdatedBy: req.user.name,
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
                        latestReason: "Job Date updated from " + data.data.date + " to " + req.body.assignDate + ".",
                        lastUpdatedBy: req.user.name,
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
                        latestReason: "Job Date updated to " + req.body.assignDate + ".",
                        lastUpdatedBy: req.user.name,
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
                        latestReason: "Postal Code updated from " + data.data.postal_code + " to " + req.body.postalCode + ".",
                        lastUpdatedBy: req.user.name,
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
                        latestReason: "Postal Code updated to " + req.body.postalCode + ".",
                        lastUpdatedBy: req.user.name,
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
                if (data.data.run_number != null) {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        latestReason: "AWB number updated from " + data.data.run_number + " to " + req.body.awbNum + ".",
                        lastUpdatedBy: req.user.name,
                        mawbNo: req.body.awbNum,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "AWB number updated from " + data.data.run_number + " to " + req.body.awbNum + ".",
                            }
                        }
                    }
                } else {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        latestReason: "AWB number updated to " + req.body.awbNum + ".",
                        lastUpdatedBy: req.user.name,
                        mawbNo: req.body.awbNum,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "AWB number updated to " + req.body.awbNum + ".",
                            }
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

            if (req.body.statusCode == 'UJM') {
                if (product == 'CBSL') {
                    if (req.body.jobMethod == "Drop Off") {
                        if ((data.data.address.includes("Brunei Muara")) || (data.data.address.includes("brunei-muara"))) {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                            latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                            lastUpdatedBy: req.user.name,
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
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                            latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                            lastUpdatedBy: req.user.name,
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
                            latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                            lastUpdatedBy: req.user.name,
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
                            latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                            lastUpdatedBy: req.user.name,
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
                            latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                            lastUpdatedBy: req.user.name,
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
                            latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                            lastUpdatedBy: req.user.name,
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
                            latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                            lastUpdatedBy: req.user.name,
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
                            latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                            lastUpdatedBy: req.user.name,
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
                            latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                            lastUpdatedBy: req.user.name,
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
                            latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                            lastUpdatedBy: req.user.name,
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
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                            latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                            lastUpdatedBy: req.user.name,
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
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                            latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                            lastUpdatedBy: req.user.name,
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
                            latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                            lastUpdatedBy: req.user.name,
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
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                                latestReason: "Job Method updated from " + data.data.job_type + " to " + req.body.jobMethod + ".",
                                lastUpdatedBy: req.user.name,
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
                if ((data.data.latestLocation == "Warehouse K1") || (data.data.latestLocation == "Warehouse K2")) {
                    if (req.body.warehouse == "Warehouse K1") {
                        update = {
                            lastUpdateDateTime: moment().format(),
                            latestReason: "Warehouse location updated from " + data.data.latestLocation + " to " + req.body.warehouse + ".",
                            lastUpdatedBy: req.user.name,
                            latestLocation: req.body.warehouse,
                            room: "Open Space",
                            rackRowNum: "N/A",
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Warehouse location updated from " + data.data.latestLocation + " to " + req.body.warehouse + ".",
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
                            latestReason: "Warehouse location updated from " + data.data.latestLocation + " to " + req.body.warehouse + ".",
                            lastUpdatedBy: req.user.name,
                            latestLocation: req.body.warehouse,
                            room: req.body.k2room,
                            rackRowNum: req.body.k2row,
                            $push: {
                                history: {
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Warehouse location updated from " + data.data.latestLocation + " to " + req.body.warehouse + ".",
                                }
                            }
                        }

                        portalUpdate = "Warehouse location updated. ";

                        mongoDBrun = 2;

                        completeRun = 1;
                    }
                }
            }

            if (req.body.statusCode == 'UFM') {
                if ((currentProduct == "pharmacymoh") || (currentProduct == "pharmacyjpmc") || (currentProduct == "pharmacyphc")) {
                    update = {
                        lastUpdateDateTime: moment().format(),
                        latestReason: "Fridge item updated.",
                        lastUpdatedBy: req.user.name,
                        fridge: req.body.fridge,
                        $push: {
                            history: {
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                reason: "Fridge item updated.",
                            }
                        }
                    }

                    portalUpdate = "Fridge item updated. ";

                    mongoDBrun = 2;

                    completeRun = 1;
                }
            }

            if (req.body.statusCode == 'UGR') {
                update = {
                    lastUpdateDateTime: moment().format(),
                    latestReason: "Go Rush Remark updated as " + req.body.grRemark + ".",
                    lastUpdatedBy: req.user.name,
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
                            assignedTo: "N/A",
                            latestReason: "Customer not available / cannot be contacted",
                            grRemark: "Customer not available / cannot be contacted",
                            lastUpdatedBy: req.user.name,
                            $push: {
                                history: {
                                    statusHistory: "Failed Delivery",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Customer not available / cannot be contacted"
                                },
                                history: {
                                    statusHistory: "At Warehouse",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
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
                            assignedTo: "N/A",
                            latestReason: "Reschedule to self collect requested by customer",
                            grRemark: "Reschedule to self collect requested by customer",
                            lastUpdatedBy: req.user.name,
                            $push: {
                                history: {
                                    statusHistory: "Failed Delivery",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    reason: "Reschedule to self collect requested by customer"
                                },
                                history: {
                                    statusHistory: "At Warehouse",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
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
                console.log(`MongoDB Updated for Tracking Number: ${consignmentID}`);
            }

            if (DetrackAPIrun == 1) {
                // Make the API request to update the status in Detrack
                request({
                    method: 'PUT',
                    url: 'https://app.detrack.com/api/v2/dn/jobs/update',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': apiKey
                    },
                    body: JSON.stringify(detrackUpdateData)
                }, function (error, response, body) {
                    if (!error && response.statusCode === 200) {
                        console.log(`Detrack Status Updated for Tracking Number: ${consignmentID}`);
                    } else {
                        console.error(`Error updating Detrack Status for Tracking Number: ${consignmentID}`);
                    }
                });
            }

            if (DetrackAPIrun == 2) {
                // Make the API request to add attempt in Detrack
                request({
                    method: 'POST',
                    url: 'https://app.detrack.com/api/v2/dn/jobs/reattempt',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': apiKey
                    },
                    body: JSON.stringify(detrackUpdateDataAttempt)
                }, function (error, response, body) {
                    if (!error && response.statusCode === 200) {
                        console.log(`Attempt for Consignment ID: ${consignmentID} increased by 1`);

                        // Always make the second API request after the first one
                        request({
                            method: 'PUT',
                            url: 'https://app.detrack.com/api/v2/dn/jobs/update',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-KEY': apiKey
                            },
                            body: JSON.stringify(detrackUpdateData)
                        }, function (error, response, body) {
                            if (!error && response.statusCode === 200) {
                                console.log(`Detrack Status Updated for Tracking Number: ${consignmentID}`);
                            } else {
                                console.error(`Error updating Detrack Status for Tracking Number: ${consignmentID}`);
                            }
                        });

                    } else {
                        console.error(`Error increase attempt by 1 for Tracking Number: ${consignmentID}`);
                    }
                });
            }

            if (DetrackAPIrun == 3) {
                // Make the API request to add attempt in Detrack
                request({
                    method: 'POST',
                    url: 'https://app.detrack.com/api/v2/dn/jobs/reattempt',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': apiKey
                    },
                    body: JSON.stringify(detrackUpdateDataAttempt)
                }, function (error, response, body) {
                    if (!error && response.statusCode === 200) {
                        console.log(`Attempt for Consignment ID: ${consignmentID} increased by 1`);
                    } else {
                        console.error(`Error increasing attempt by 1 for Tracking Number: ${consignmentID}`);
                    }
                });
            }

            if (DetrackAPIrun == 4) {
                // First update with status "at_warehouse"
                detrackUpdateData.data.status = "at_warehouse";

                request({
                    method: 'PUT',
                    url: 'https://app.detrack.com/api/v2/dn/jobs/update',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': apiKey
                    },
                    body: JSON.stringify(detrackUpdateData)
                }, function (error, response, body) {
                    if (!error && response.statusCode === 200) {
                        console.log(`Detrack Status Updated to "At Warehouse" for Tracking Number: ${consignmentID}`);

                        // Second update with status "in_sorting_area" (without zone)
                        detrackUpdateData.data = {
                            status: "in_sorting_area" // Only include status for the second run
                        };

                        request({
                            method: 'PUT',
                            url: 'https://app.detrack.com/api/v2/dn/jobs/update',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-KEY': apiKey
                            },
                            body: JSON.stringify(detrackUpdateData)
                        }, function (error, response, body) {
                            if (!error && response.statusCode === 200) {
                                console.log(`Detrack Status Updated to "In Sorting Area" for Tracking Number: ${consignmentID}`);
                            } else {
                                console.error(`Error updating Detrack Status to "In Sorting Area" for Tracking Number: ${consignmentID}`);
                            }
                        });
                    } else {
                        console.error(`Error updating Detrack Status to "At Warehouse" for Tracking Number: ${consignmentID}`);
                    }
                });
            }

            if (DetrackAPIrun == 5) {
                // First update with status "at_warehouse"
                detrackUpdateData.data.status = "at_warehouse";

                request({
                    method: 'PUT',
                    url: 'https://app.detrack.com/api/v2/dn/jobs/update',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': apiKey
                    },
                    body: JSON.stringify(detrackUpdateData)
                }, function (error, response, body) {
                    if (!error && response.statusCode === 200) {
                        console.log(`Detrack Status Updated to "At Warehouse" for Tracking Number: ${consignmentID}`);

                        // Second update with status "in_sorting_area" (without zone)
                        detrackUpdateData2.data = {
                            status: "in_sorting_area" // Only include status for the second run
                        };

                        request({
                            method: 'PUT',
                            url: 'https://app.detrack.com/api/v2/dn/jobs/update',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-KEY': apiKey
                            },
                            body: JSON.stringify(detrackUpdateData2)
                        }, function (error, response, body) {
                            if (!error && response.statusCode === 200) {
                                console.log(`Detrack Status Updated to "In Sorting Area" for Tracking Number: ${consignmentID}`);
                            } else {
                                console.error(`Error updating Detrack Status to "In Sorting Area" for Tracking Number: ${consignmentID}`);
                            }
                        });
                    } else {
                        console.error(`Error updating Detrack Status to "At Warehouse" for Tracking Number: ${consignmentID}`);
                    }
                });
            }

            if (DetrackAPIrun == 6) {
                request({
                    method: 'PUT',
                    url: 'https://app.detrack.com/api/v2/dn/jobs/update',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-KEY': apiKey
                    },
                    body: JSON.stringify(detrackUpdateData)
                }, function (error, response, body) {
                    if (!error && response.statusCode === 200) {
                        console.log(`Detrack Status Updated to "At Warehouse" for Tracking Number: ${consignmentID}`);

                        request({
                            method: 'PUT',
                            url: 'https://app.detrack.com/api/v2/dn/jobs/update',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-KEY': apiKey
                            },
                            body: JSON.stringify(detrackUpdateData2)
                        }, function (error, response, body) {
                            if (!error && response.statusCode === 200) {
                                console.log(`Detrack Status Updated to "At Warehouse" for Tracking Number: ${consignmentID}`);
                            } else {
                                console.error(`Error updating Detrack Status to "At Warehouse" for Tracking Number: ${consignmentID}`);
                            }
                        });
                    } else {
                        console.error(`Error updating Detrack Status to "At Warehouse" for Tracking Number: ${consignmentID}`);
                    }
                });
            }

            /* if (waOrderArrivedDeliverStandard == 5) {
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
                            "name": "order_arrived_deliver_standard",
                            "components": [
                                {
                                    "type": "header",
                                    "format": "text",
                                    "text": "Go Rush Order"
                                },
                                {
                                    "text": `Hello ${a},\n\nYour order for the tracking number *${b}* is now prepared by our dedicated team and will be delivered within 2 to 3 working days from today.\n\nYour tracking number can be tracked on www.gorushbn.com or through this link below:\n\n${c}\n\nIf there are any requests for a change in the address or reschedule, please reach us as soon as possible via WhatsApp or call us at *2332065*.`,
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

            if (waOrderArrivedDeliverExpressMedicine == 5) {
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
                            "name": "order_arrived_deliver_express_medicine",
                            "components": [
                                {
                                    "type": "header",
                                    "format": "text",
                                    "text": "Go Rush Order"
                                },
                                {
                                    "text": `Hello ${a},\n\nYour order for the tracking number *${b}* will be delivered on the next working day after the medicine is released from the pharmacy.\n\nYour tracking number can be tracked on www.gorushbn.com or through this link below:\n\n${c}\n\nIf there are any requests for a change in the address or reschedule, please reach us as soon as possible via WhatsApp or call us at *2332065*.`,
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

            if (waOrderArrivedDeliverExpressNonMedicine == 5) {
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
                            "name": "order_arrived_deliver_express_nonmedicine",
                            "components": [
                                {
                                    "type": "header",
                                    "format": "text",
                                    "text": "Go Rush Order"
                                },
                                {
                                    "text": `Hello ${a},\n\nYour order for the tracking number *${b}* is now prepared by our dedicated team and will be delivered today.\n\nYour tracking number can be tracked on www.gorushbn.com or through this link below:\n\n${c}\n\nIf there are any requests for a change in the address or reschedule, please reach us as soon as possible via WhatsApp or call us at *2332065*.`,
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

            if (waOrderArrivedDeliverImmediate == 5) {
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
                            "name": "order_arrived_deliver_immediate",
                            "components": [
                                {
                                    "type": "header",
                                    "format": "text",
                                    "text": "Go Rush Order"
                                },
                                {
                                    "text": `Hello ${a},\n\nYour order for the tracking number *${b}* is now prepared by our dedicated team and will be delivered within 3 hours.\n\nYour tracking number can be tracked on www.gorushbn.com or through this link below:\n\n${c}\n\nIf there are any requests for a change in the address or reschedule, please reach us as soon as possible via WhatsApp or call us at *2332065*.`,
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

            if (waOrderArrivedDeliverFMX == 5) {
                let a = data.data.deliver_to_collect_from;
                let b = consignmentID;
                let c = data.data.items[0].quantity + "x " + data.data.items[0].description
                let d = data.data.tracking_link;
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
                            "name": "order_arrived_deliver_fmx",
                            "components": [
                                {
                                    "type": "header",
                                    "format": "text",
                                    "text": "Go Rush Order"
                                },
                                {
                                    "text": `Hello ${a},\n\nYour order for the tracking number *${b}* is now prepared by our dedicated team and will be delivered on the next working day.\n\nOrder Details:\n\n*${c}*\n\nYour tracking number can be tracked on www.gorushbn.com or through this link below:\n\n${d}\n\nIf there are any requests for a change in the address or reschedule, please reach us as soon as possible via WhatsApp or call us at *2332065*.`,
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
                                        },
                                        {
                                            "text": d,
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

            if (waOrderArrivedPickup == 5) {
                let a = data.data.deliver_to_collect_from;
                let b = data.data.tracking_number;
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
                            "name": "order_arrived_pickup",
                            "components": [
                                {
                                    "type": "header",
                                    "format": "text",
                                    "text": "Go Rush Order"
                                },
                                {
                                    "text": `Hello ${a},\n\nYour order for the tracking number ${b} has arrived at Go Rush.\n\nYour tracking number can be tracked on www.gorushbn.com or through this link below: ${c}.\n\nOur dedicated team is now preparing your order and invoice for pickup.\n\nOnce ready, we'll promptly send you the invoice, and your order will be ready for collection.\n\nFor any further inquiries, please reach us via WhatsApp or call us at 2332065.`,
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
            } */

            if (ceCheck == 0) {
                // If processing is successful, add a success message to the results array
                processingResults.push({
                    consignmentID,
                    status: portalUpdate + fmxUpdate,
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
            attempt: 0,
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
            lastUpdateDateTime: moment().utcOffset('+08:00').format('DD-MM-YYYY hh:mm a'),
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

orderWatch.on('change', async (change) => {
    if (change.operationType == "insert") {
        // Push the new change to the queue
        queue.push(change);

        // If there's no active processing, start processing the queue
        if (!isProcessing) {
            processQueue();
        }
    }
});

async function processQueue() {
    isProcessing = true;

    while (queue.length > 0) {
        // Get the first change in the queue
        const currentChange = queue.shift();

        // Execute the logic for this change
        await handleOrderChange(currentChange);
    }

    isProcessing = false;
}

async function handleOrderChange(change) {
    try {
        const result = await ORDERS.find().sort({ $natural: -1 }).limit(1000);
        let filter = new mongoose.Types.ObjectId(result[0]._id);

        if (result[0].product != null) {
            let products = result[0].product;

            if (products.includes("pharmacy") == true) {
                products = "pharmacy";
            }

            let tracker;
            let sequence;
            let rawPhoneNumber = result[0].receiverPhoneNumber ? result[0].receiverPhoneNumber.trim() : null;
            let finalPhoneNum;

            if (rawPhoneNumber) {
                // Remove all non-digit characters
                let cleanedNumber = rawPhoneNumber.replace(/\D/g, "");

                if (/^\d{7}$/.test(cleanedNumber)) {
                    // Local 7-digit Brunei number
                    finalPhoneNum = "+673" + cleanedNumber;
                } else if (/^673\d{7}$/.test(cleanedNumber)) {
                    // Brunei number already with country code (no +)
                    finalPhoneNum = "+" + cleanedNumber;
                } else if (/^\+673\d{7}$/.test(rawPhoneNumber)) {
                    // Already correctly formatted
                    finalPhoneNum = rawPhoneNumber;
                } else {
                    finalPhoneNum = "N/A"; // Invalid Brunei number
                }
            } else {
                finalPhoneNum = "N/A"; // No number provided
            }
            let whatsappName = result[0].receiverName;

            let checkProduct = 0;

            if ((result.length >= 2) && (checkProduct == 0)) {
                for (let i = 1; i < result.length; i++) {
                    /* if (result[i].product.includes("localdelivery")) {
                        if (products == result[i].product) {
                            if (result[i].sequence == "N/A") {
                                sequence = 1
                                checkProduct = 1
                                i = result.length
                            }
                            else {
                                sequence = parseInt(result[i].sequence) + 1
                                checkProduct = 1
                                i = result.length
                            }
                        }
                    } else { */
                    if (result[i].product.includes(products)) {
                        if (result[i].sequence == "N/A") {
                            sequence = 1
                            checkProduct = 1
                            i = result.length
                        }
                        else {
                            sequence = parseInt(result[i].sequence) + 1
                            checkProduct = 1
                            i = result.length
                        }
                    }
                    /* } */
                }
                if (checkProduct == 0) {
                    sequence = 1
                    checkProduct = 1
                }
            }

            if (!sequence) {
                sequence = 1;  // Default sequence value if not set
            }

            // Example for pharmacy MOH product
            if (result[0].product == "pharmacymoh") {
                let suffix = "GR2", prefix = "MH";
                tracker = generateTracker(sequence, suffix, prefix);
            }

            if (result[0].product == "pharmacyjpmc") {
                let suffix = "GR2", prefix = "JP";
                tracker = generateTracker(sequence, suffix, prefix);
            }

            if (result[0].product == "pharmacyphc") {
                let suffix = "GR2", prefix = "PN";
                tracker = generateTracker(sequence, suffix, prefix);
            }

            if (result[0].product == "localdelivery") {
                let suffix = "GR3", prefix = "LD";
                tracker = generateTracker(sequence, suffix, prefix);
            }

            /* if (result[0].product == "localdeliveryjb") {
                let suffix = "GR3", prefix = "JB";
                tracker = generateTracker(sequence, suffix, prefix);
            } */

            if (result[0].product == "grp") {
                let suffix = "GR4", prefix = "GP";
                tracker = generateTracker(sequence, suffix, prefix);
            }

            if (result[0].product == "cbsl") {
                let suffix = "GR5", prefix = "CB";
                tracker = generateTracker(sequence, suffix, prefix);
            }

            if (result[0].product == "kptdp") {
                tracker = result[0].doTrackingNumber;
            }

            // Other product cases go here, similar to the above case

            let update = { doTrackingNumber: tracker, sequence: sequence };
            await ORDERS.findByIdAndUpdate(filter, update);

            // Logic to send WhatsApp message using axios
            if (result[0].product != "fmx" && result[0].product != "bb" && result[0].product != "fcas" &&
                result[0].product != "icarus" && result[0].product != "ewe" && result[0].product != "ewens" &&
                result[0].product != "temu" && result[0].product != "kptdf" && result[0].product != "pdu"
                && result[0].product != "pure51" && result[0].product != "mglobal" && finalPhoneNum != "N/A") {

                await sendWhatsAppMessage(finalPhoneNum, whatsappName, tracker);
            }
        }
    } catch (err) {
        console.error('Error processing order change:', err);
    }
}

function generateTracker(sequence, suffix, prefix) {
    if (sequence >= 0 && sequence <= 9) return `${suffix}0000000${sequence}${prefix}`;
    if (sequence >= 10 && sequence <= 99) return `${suffix}000000${sequence}${prefix}`;
    if (sequence >= 100 && sequence <= 999) return `${suffix}00000${sequence}${prefix}`;
    if (sequence >= 1000 && sequence <= 9999) return `${suffix}0000${sequence}${prefix}`;
    if (sequence >= 10000 && sequence <= 99999) return `${suffix}000${sequence}${prefix}`;
    if (sequence >= 100000 && sequence <= 999999) return `${suffix}00${sequence}${prefix}`;
    if (sequence >= 1000000 && sequence <= 9999999) return `${suffix}0${sequence}${prefix}`;
    return `${suffix}${sequence}${prefix}`;
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
                    'x-make-apikey': '2969421:27114c524def4cc4c85530d8b8018f9b' // Replace with the real key from Make
                }
            }
        );

        console.log('Order details sent to Make webhook successfully.');
    } catch (error) {
        console.error('Error sending to Make webhook:', error.response?.data || error.message);
    }
}

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});