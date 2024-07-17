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
const CBSLPOD = require('./models/CBSLPOD');
const ORDERS = require('./models/ORDERS');
const PharmacyFORM = require('./models/PharmacyFORM');

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
        // Fetch EWE Orders
        const eweOrders = await ORDERS.aggregate([
            { $match: { product: 'ewe' } },
            {
                $group: {
                    _id: '$mawbNo',
                    mawbNo: { $first: '$mawbNo' },
                    flightDate: { $first: '$flightDate' },
                    total: { $sum: 1 },
                    atWarehouse: { $sum: { $cond: [{ $in: ['$currentStatus', ['At Warehouse', 'Return to Warehouse']] }, 1, 0] } },
                    k1: { $sum: { $cond: [{ $eq: ['$latestLocation', 'Warehouse K1'] }, 1, 0] } },
                    k2: { $sum: { $cond: [{ $eq: ['$latestLocation', 'Warehouse K2'] }, 1, 0] } },
                    outForDelivery: { $sum: { $cond: [{ $eq: ['$currentStatus', 'Out for Delivery'] }, 1, 0] } },
                    selfCollect: { $sum: { $cond: [{ $eq: ['$currentStatus', 'Self Collect'] }, 1, 0] } },
                    completed: { $sum: { $cond: [{ $eq: ['$currentStatus', 'Completed'] }, 1, 0] } },
                    cancelled: { $sum: { $cond: [{ $eq: ['$currentStatus', 'Cancelled'] }, 1, 0] } }
                }
            },
            { $sort: { flightDate: -1 } } // Sort by flightDate in descending order
        ]);

        // Fetch FMX Orders
        const fmxOrders = await ORDERS.aggregate([
            { $match: { product: 'fmx' } },
            {
                $group: {
                    _id: '$mawbNo',
                    mawbNo: { $first: '$mawbNo' },
                    flightDate: { $first: '$flightDate' },
                    total: { $sum: 1 },
                    atWarehouse: { $sum: { $cond: [{ $in: ['$currentStatus', ['At Warehouse', 'Return to Warehouse']] }, 1, 0] } },
                    outForDelivery: { $sum: { $cond: [{ $eq: ['$currentStatus', 'Out for Delivery'] }, 1, 0] } },
                    selfCollect: { $sum: { $cond: [{ $eq: ['$currentStatus', 'Self Collect'] }, 1, 0] } },
                    completed: { $sum: { $cond: [{ $eq: ['$currentStatus', 'Completed'] }, 1, 0] } },
                    cancelled: { $sum: { $cond: [{ $eq: ['$currentStatus', 'Cancelled'] }, 1, 0] } }
                }
            },
            { $sort: { flightDate: -1 } } // Sort by flightDate in descending order
        ]);


        // Fetch MOH Orders
        const mohOrders = await ORDERS.aggregate([
            { $match: { product: 'pharmacymoh' } },
            {
                $group: {
                    _id: {
                        deliveryTypeCode: '$deliveryTypeCode',
                        sendOrderTo: '$sendOrderTo'
                    },
                    total: { $sum: 1 },
                    atWarehouse: {
                        $sum: {
                            $cond: [
                                { $in: ['$currentStatus', ['At Warehouse', 'Return to Warehouse']] },
                                1,
                                0
                            ]
                        }
                    },
                    outForDelivery: {
                        $sum: {
                            $cond: [{ $eq: ['$currentStatus', 'Out for Delivery'] }, 1, 0]
                        }
                    },
                    selfCollect: {
                        $sum: {
                            $cond: [{ $eq: ['$currentStatus', 'Self Collect'] }, 1, 0]
                        }
                    },
                    completed: {
                        $sum: {
                            $cond: [{ $eq: ['$currentStatus', 'Completed'] }, 1, 0]
                        }
                    },
                    cancelled: {
                        $sum: {
                            $cond: [{ $eq: ['$currentStatus', 'Cancelled'] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    deliveryType: {
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: ['$_id.deliveryTypeCode', 'IMM'] },
                                    then: 'IMM OPD'
                                },
                                {
                                    case: { $eq: ['$_id.deliveryTypeCode', 'EXP'] },
                                    then: 'EXP OPD'
                                },
                                {
                                    case: {
                                        $and: [
                                            { $eq: ['$_id.deliveryTypeCode', 'STD'] },
                                            { $eq: ['$_id.sendOrderTo', 'PMMH'] }
                                        ]
                                    },
                                    then: 'STD PMMH'
                                },
                                {
                                    case: {
                                        $and: [
                                            { $eq: ['$_id.deliveryTypeCode', 'STD'] },
                                            { $eq: ['$_id.sendOrderTo', 'SSBH'] }
                                        ]
                                    },
                                    then: 'STD SSBH'
                                }
                            ],
                            default: 'STD OPD'
                        }
                    },
                    total: 1,
                    atWarehouse: 1,
                    outForDelivery: 1,
                    selfCollect: 1,
                    completed: 1,
                    cancelled: 1
                }
            },
            {
                $sort: { deliveryType: 1 } // Sort by delivery type
            }
        ]);


        // Render the dashboard view with both sets of orders
        res.render('dashboard', { mohOrders, eweOrders, fmxOrders, moment, user: req.user, orders: [] });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
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

        let query = { product: "pharmacymoh" };

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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 })
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

app.post('/ewemanifesttobillsearch', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        const { mawbNo } = req.body;

        let query = { product: "ewe" };

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
            .limit(1000);

        res.render('ewemanifesttobillsearch', { moment: moment, user: req.user, orders, searchQuery: req.body });
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
                'lastUpdatedBy'
            ])
            .sort({ lastUpdateDateTime: -1 })
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
            product: { $nin: ["fmx", "ewe", "pharmacymoh"] },
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 })
            .limit(500);

        // Render the EJS template with the filtered and sorted orders
        res.render('listofOrders', { orders, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofOrdersCompleted', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: { $nin: ["fmx", "ewe", "pharmacymoh"] },
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofOrdersCompleted', { orders, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofOrdersOFD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: { $nin: ["fmx", "ewe", "pharmacymoh"] },
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofOrdersOFD', { orders, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofAllOrdersOFD', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofAllOrdersOFD', { orders, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofOrdersSC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
            product: { $nin: ["fmx", "ewe", "pharmacymoh"] },
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofOrdersSC', { orders, moment: moment, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofAllOrdersSC', ensureAuthenticated, ensureViewJob, async (req, res) => {
    try {
        // Query the database to find orders with product not equal to "fmx" and currentStatus not equal to "complete"
        const orders = await ORDERS.find({
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofAllOrdersSC', { orders, moment: moment, user: req.user });
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
            product: { $nin: ["fmx", "ewe", "pharmacymoh"] },
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ warehouseEntryDateTime: 1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofOrdersAW', { orders, moment: moment, user: req.user });
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
            product: { $nin: ["fmx", "ewe", "pharmacymoh"] },
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofOrdersIRCC', { orders, moment: moment, user: req.user });
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
            product: { $nin: ["fmx", "ewe", "pharmacymoh"] },
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofOrdersCD', { orders, moment: moment, user: req.user });
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 })
            .limit(1000);

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHOrders', { orders, moment: moment, user: req.user });
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHOrdersCompleted', { orders, moment: moment, user: req.user });
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHOrdersOFD', { orders, moment: moment, user: req.user });
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHOrdersSC', { orders, moment: moment, user: req.user });
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
                'lastAssignedTo'
            ])
            .sort({ warehouseEntryDateTime: 1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHOrdersAW', { orders, moment: moment, user: req.user });
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHOrdersIRCC', { orders, moment: moment, user: req.user });
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHOrdersCD', { orders, moment: moment, user: req.user });
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 })
            .limit(1000);

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHEXPOrders', { orders, moment: moment, user: req.user });
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 })
            .limit(1000);

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHSTDOrders', { orders, moment: moment, user: req.user });
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHTTGOrders', { orders, moment: moment, user: req.user });
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHKBOrders', { orders, moment: moment, user: req.user });
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHIMMOrders', { orders, moment: moment, user: req.user });
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyJPMCOrders', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyPHCOrders', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofLDOrders', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofLDJBOrders', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofICARUSOrders', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFCASOrders', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofBBOrders', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofGRPOrders', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofCBSLOrders', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 })
            .limit(500);

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFMXOrders', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFMXOrdersCompleted', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFMXOrdersOFD', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFMXOrdersSC', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ warehouseEntryDateTime: 1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFMXOrdersAW', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFMXOrdersIRCC', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofFMXOrdersCD', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ _id: -1 })
            .limit(500);

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWEOrders', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWEOrdersCompleted', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWEOrdersOFD', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWEOrdersSC', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ warehouseEntryDateTime: 1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWEOrdersAW', { orders, moment: moment, user: req.user });
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
                'deliveryType',
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
                'lastAssignedTo'
            ])
            .sort({ lastUpdateDateTime: -1 }); // Sort by lastUpdateDateTime in descending order

        // Render the EJS template with the filtered and sorted orders
        res.render('listofEWEOrdersCD', { orders, moment: moment, user: req.user });
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
                'numberOfForms'
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
        // Use the new query syntax to find documents with selected fields
        const pods = await PharmacyPOD.find({})
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
        res.render('listofpharmacyPod', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch Pharmacy POD data');
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

app.get('/listofewePod', ensureAuthenticated, ensureGeneratePODandUpdateDelivery, async (req, res) => {
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
        res.render('listofewePod', { pods, user: req.user });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch EWE POD data');
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
            res.redirect('/listofewePod'); // Redirect to the list view after deletion
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
        numberOfForms: numberOfForms
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
        case 'CBSL POD':
            PodModel = CBSLPOD;
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
        // Parse input data from the form
        const { podCreatedBy, product, deliveryDate, areas, dispatchers, trackingNumbers, freelancerName } = req.body;

        if ((dispatchers == "FL1") || (dispatchers == "FL2") || (dispatchers == "FL3") || (dispatchers == "FL4") || (dispatchers == "FL5")) {
            var finalDispatcherName = dispatchers.toUpperCase() + " " + freelancerName.toUpperCase()
        } else {
            var finalDispatcherName = dispatchers.toUpperCase()
        }

        const podCreatedByCaps = podCreatedBy.toUpperCase()

        // Check if areas is a string or an array
        let areasArray = [];
        if (typeof areas === 'string') {
            areasArray = areas.split(',').map((area) => area.trim());
        } else if (Array.isArray(areas)) {
            areasArray = areas.map((area) => area.trim());
        }

        // Then, you can join the elements of the areasArray into a comma-separated string
        const areasJoined = areasArray.join(', ');

        // Split tracking numbers into an array
        const trackingNumbersArray = trackingNumbers.trim().split('\n').map((id) => id.trim().toUpperCase());

        const runSheetData = [];
        const uniqueTrackingNumbers = new Set(); // Use a Set to automatically remove duplicates

        for (const trackingNumber of trackingNumbersArray) {
            if (!trackingNumber) continue;
            uniqueTrackingNumbers.add(trackingNumber);
        }

        // Convert the Set back to an array (if needed)
        const uniqueTrackingNumbersArray = Array.from(uniqueTrackingNumbers);

        for (const trackingNumber of uniqueTrackingNumbersArray) {
            try {
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
                runSheetData.push({
                    trackingNumber,
                    deliverToCollectFrom: data.deliver_to_collect_from,
                    address: data.address,
                    phoneNumber: data.phone_number,
                    jobType: data.job_type || '',
                    totalPrice: data.total_price || '',
                    paymentMode: data.payment_mode || '',
                });
            } catch (error) {
                console.error(`Error for tracking number ${trackingNumber}:`, error);
                // You can handle the error for this specific tracking number here if needed.
                // It will continue processing other tracking numbers.
            }
        }
        // Render the runsheet EJS template with data
        res.render('podGeneratorSuccess', {
            podCreatedBy: podCreatedByCaps,
            product,
            deliveryDate: moment(deliveryDate).format('DD.MM.YY'),
            areas: areasJoined, // Use the joined string instead of the original variable
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

        if (address.includes("MANGGIS") == true) { area = "B1", kampong = "MANGGIS" }
        else if (address.includes("DELIMA") == true) { area = "B1", kampong = "DELIMA" }
        else if (address.includes("ANGGREK DESA") == true) { area = "B1", kampong = "ANGGREK DESA" }
        else if (address.includes("ANGGREK") == true) { area = "B1", kampong = "ANGGREK DESA" }
        else if (address.includes("PULAIE") == true) { area = "B1", kampong = "PULAIE" }
        else if (address.includes("LAMBAK") == true) { area = "B1", kampong = "LAMBAK" }
        else if (address.includes("TERUNJING") == true) { area = "B1", kampong = "TERUNJING" }
        else if (address.includes("MADANG") == true) { area = "B1", kampong = "MADANG" }
        else if (address.includes("AIRPORT") == true) { area = "B1", kampong = "AIRPORT" }
        else if (address.includes("ORANG KAYA BESAR IMAS") == true) { area = "B1", kampong = "OKBI" }
        else if (address.includes("OKBI") == true) { area = "B1", kampong = "OKBI" }
        else if (address.includes("SERUSOP") == true) { area = "B1", kampong = "SERUSOP" }
        else if (address.includes("BURONG PINGAI") == true) { area = "B1", kampong = "BURONG PINGAI" }
        else if (address.includes("SETIA NEGARA") == true) { area = "B1", kampong = "SETIA NEGARA" }
        else if (address.includes("PASIR BERAKAS") == true) { area = "B1", kampong = "PASIR BERAKAS" }
        else if (address.includes("MENTERI BESAR") == true) { area = "B1", kampong = "MENTERI BESAR" }
        else if (address.includes("KEBANGSAAN LAMA") == true) { area = "B1", kampong = "KEBANGSAAN LAMA" }
        else if (address.includes("BATU MARANG") == true) { area = "B2", kampong = "BATU MARANG" }
        else if (address.includes("DATO GANDI") == true) { area = "B2", kampong = "DATO GANDI" }
        else if (address.includes("KAPOK") == true) { area = "B2", kampong = "KAPOK" }
        else if (address.includes("KOTA BATU") == true) { area = "B2", kampong = "KOTA BATU" }
        else if (address.includes("MENTIRI") == true) { area = "B2", kampong = "MENTIRI" }
        else if (address.includes("MERAGANG") == true) { area = "B2", kampong = "MERAGANG" }
        else if (address.includes("PELAMBAIAN") == true) { area = "B2", kampong = "PELAMBAIAN" }
        else if (address.includes("PINTU MALIM") == true) { area = "B2", kampong = "PINTU MALIM" }
        else if (address.includes("SALAMBIGAR") == true) { area = "B2", kampong = "SALAMBIGAR" }
        else if (address.includes("SALAR") == true) { area = "B2", kampong = "SALAR" }
        else if (address.includes("SERASA") == true) { area = "B2", kampong = "SERASA" }
        else if (address.includes("SERDANG") == true) { area = "B2", kampong = "SERDANG" }
        else if (address.includes("SUNGAI BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
        else if (address.includes("SG BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
        else if (address.includes("SUNGAI BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
        else if (address.includes("SG BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
        else if (address.includes("SUNGAI HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
        else if (address.includes("SG HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
        else if (address.includes("SUNGAI TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
        else if (address.includes("SG TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
        else if (address.includes("SUBOK") == true) { area = "B2", kampong = "SUBOK" }
        else if (address.includes("SUNGAI AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
        else if (address.includes("SG AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
        else if (address.includes("SUNGAI BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
        else if (address.includes("SG BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
        else if (address.includes("TANAH JAMBU") == true) { area = "B2", kampong = "TANAH JAMBU" }
        else if (address.includes("SUNGAI OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
        else if (address.includes("SG OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
        else if (address.includes("KATOK") == true) { area = "G1", kampong = "KATOK" }
        else if (address.includes("MATA-MATA") == true) { area = "G1", kampong = "MATA-MATA" }
        else if (address.includes("MATA MATA") == true) { area = "G1", kampong = "MATA-MATA" }
        else if (address.includes("RIMBA") == true) { area = "G1", kampong = "RIMBA" }
        else if (address.includes("TUNGKU") == true) { area = "G1", kampong = "TUNGKU" }
        else if (address.includes("UBD") == true) { area = "G1", kampong = "UBD" }
        else if (address.includes("UNIVERSITI BRUNEI DARUSSALAM") == true) { area = "G1", kampong = "UBD" }
        else if (address.includes("JIS") == true) { area = "G1" }
        else if (address.includes("JERUDONG INTERNATIONAL SCHOOL") == true) { area = "G1", kampong = "JIS" }
        else if (address.includes("BERANGAN") == true) { area = "G2", kampong = "BERANGAN" }
        else if (address.includes("BERIBI") == true) { area = "G2", kampong = "BERIBI" }
        else if (address.includes("KIULAP") == true) { area = "G2", kampong = "KIULAP" }
        else if (address.includes("RIPAS") == true) { area = "G2", kampong = "RIPAS" }
        else if (address.includes("RAJA ISTERI PENGIRAN ANAK SALLEHA") == true) { area = "G2", kampong = "RIPAS" }
        else if (address.includes("KIARONG") == true) { area = "G2", kampong = "KIARONG" }
        else if (address.includes("PUSAR ULAK") == true) { area = "G2", kampong = "PUSAR ULAK" }
        else if (address.includes("KUMBANG PASANG") == true) { area = "G2", kampong = "KUMBANG PASANG" }
        else if (address.includes("MENGLAIT") == true) { area = "G2", kampong = "MENGLAIT" }
        else if (address.includes("MABOHAI") == true) { area = "G2", kampong = "MABOHAI" }
        else if (address.includes("ONG SUM PING") == true) { area = "G2", kampong = "ONG SUM PING" }
        else if (address.includes("GADONG") == true) { area = "G2", kampong = "GADONG" }
        else if (address.includes("TASEK LAMA") == true) { area = "G2", kampong = "TASEK LAMA" }
        else if (address.includes("BANDAR TOWN") == true) { area = "G2", kampong = "BANDAR TOWN" }
        else if (address.includes("BATU SATU") == true) { area = "JT1", kampong = "BATU SATU" }
        else if (address.includes("BENGKURONG") == true) { area = "JT1", kampong = "BENGKURONG" }
        else if (address.includes("BUNUT") == true) { area = "JT1", kampong = "BUNUT" }
        else if (address.includes("JALAN BABU RAJA") == true) { area = "JT1", kampong = "JALAN BABU RAJA" }
        else if (address.includes("JALAN ISTANA") == true) { area = "JT1", kampong = "JALAN ISTANA" }
        else if (address.includes("JUNJONGAN") == true) { area = "JT1", kampong = "JUNJONGAN" }
        else if (address.includes("KASAT") == true) { area = "JT1", kampong = "KASAT" }
        else if (address.includes("LUMAPAS") == true) { area = "JT1", kampong = "LUMAPAS" }
        else if (address.includes("JALAN HALUS") == true) { area = "JT1", kampong = "JALAN HALUS" }
        else if (address.includes("MADEWA") == true) { area = "JT1", kampong = "MADEWA" }
        else if (address.includes("PUTAT") == true) { area = "JT1", kampong = "PUTAT" }
        else if (address.includes("SINARUBAI") == true) { area = "JT1", kampong = "SINARUBAI" }
        else if (address.includes("TASEK MERADUN") == true) { area = "JT1", kampong = "TASEK MERADUN" }
        else if (address.includes("TELANAI") == true) { area = "JT1", kampong = "TELANAI" }
        else if (address.includes("BAN 1") == true) { area = "JT2", kampong = "BAN" }
        else if (address.includes("BAN 2") == true) { area = "JT2", kampong = "BAN" }
        else if (address.includes("BAN 3") == true) { area = "JT2", kampong = "BAN" }
        else if (address.includes("BAN 4") == true) { area = "JT2", kampong = "BAN" }
        else if (address.includes("BAN 5") == true) { area = "JT2", kampong = "BAN" }
        else if (address.includes("BAN 6") == true) { area = "JT2", kampong = "BAN" }
        else if (address.includes("BATONG") == true) { area = "JT2", kampong = "BATONG" }
        else if (address.includes("BATU AMPAR") == true) { area = "JT2", kampong = "BATU AMPAR" }
        else if (address.includes("BEBATIK") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
        else if (address.includes("BEBULOH") == true) { area = "JT2", kampong = "BEBULOH" }
        else if (address.includes("BEBATIK KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
        else if (address.includes("KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
        else if (address.includes("DADAP") == true) { area = "JT2", kampong = "DADAP" }
        else if (address.includes("KUALA LURAH") == true) { area = "JT2", kampong = "KUALA LURAH" }
        else if (address.includes("KULAPIS") == true) { area = "JT2", kampong = "KULAPIS" }
        else if (address.includes("LIMAU MANIS") == true) { area = "JT2", kampong = "LIMAU MANIS" }
        else if (address.includes("MASIN") == true) { area = "JT2", kampong = "MASIN" }
        else if (address.includes("MULAUT") == true) { area = "JT2", kampong = "MULAUT" }
        else if (address.includes("PANCHOR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
        else if (address.includes("PANCHUR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
        else if (address.includes("PANGKALAN BATU") == true) { area = "JT2", kampong = "PANGKALAN BATU" }
        else if (address.includes("PASAI") == true) { area = "JT2", kampong = "PASAI" }
        else if (address.includes("WASAN") == true) { area = "JT2", kampong = "WASAN" }
        else if (address.includes("PARIT") == true) { area = "JT2", kampong = "PARIT" }
        else if (address.includes("EMPIRE") == true) { area = "JT3", kampong = "EMPIRE" }
        else if (address.includes("JANGSAK") == true) { area = "JT3", kampong = "JANGSAK" }
        else if (address.includes("JERUDONG") == true) { area = "JT3", kampong = "JERUDONG" }
        else if (address.includes("KATIMAHAR") == true) { area = "JT3", kampong = "KATIMAHAR" }
        else if (address.includes("LUGU") == true) { area = "JT3", kampong = "LUGU" }
        else if (address.includes("SENGKURONG") == true) { area = "JT3", kampong = "SENGKURONG" }
        else if (address.includes("TANJONG NANGKA") == true) { area = "JT3", kampong = "TANJONG NANGKA" }
        else if (address.includes("TANJONG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
        else if (address.includes("TANJUNG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
        else if (address.includes("SUNGAI TAMPOI") == true) { area = "JT3", kampung = "SUNGAI TAMPOI" }
        else if (address.includes("SG TAMPOI") == true) { area = "JT3", kampong = "SUNGAI TAMPOI" }
        else if (address.includes("MUARA") == true) { area = "B2", kampong = "MUARA" }
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
    // Step 1: Authenticate and get accessToken
    const authResponse = await axios.post('https://client.fmx.asia/api/tokenauth/authenticate', {
        userNameOrEmailAddress: username,
        password: password,
        source: 'string'
    });

    const accessToken = authResponse.data.result.accessToken;

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
            var postalCode = 'N/A'

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

            product = data.data.group_name;

            if (product == 'EWE') {
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
                currentDetrackStatus = "In Progress/Out for Delivery"
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

            if (req.body.statusCode == 'FA') {
                appliedStatus = "Attempt and Payment Method Fix"
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
                appliedStatus = "Self Collect"
            }

            if (req.body.statusCode == 'SJ') {
                appliedStatus = "Completed"
            }

            if (req.body.statusCode == 'FJ') {
                appliedStatus = "Failed Delivery"
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
                appliedStatus = "Completed/Failed Delivery"
            }

            if ((req.body.statusCode == 'IR') || (req.body.statusCode == 'CP') || (req.body.statusCode == 'DC') || (req.body.statusCode == 38) || (req.body.statusCode == 35) || (req.body.statusCode == 'SD') || (req.body.statusCode == 'NC')
                || (req.body.statusCode == 'CSSC') || (req.body.statusCode == 'SJ') || (req.body.statusCode == 'FJ') || (req.body.statusCode == 'CD') || (req.body.statusCode == 'AJ') || (req.body.statusCode == 47) || (req.body.statusCode == 'SFJ')
                || (req.body.statusCode == 'FA') || (req.body.statusCode == 'AJN')) {
                filter = { doTrackingNumber: consignmentID };

                // Determine if there's an existing document in MongoDB
                existingOrder = await ORDERS.findOne({ doTrackingNumber: consignmentID });
            }

            if (req.body.statusCode == 12) {
                if ((product == 'CBSL')) {
                    filter = { doTrackingNumber: data.data.tracking_number };
                    // Determine if there's an existing document in MongoDB
                    existingOrder = await ORDERS.findOne({ doTrackingNumber: data.data.tracking_number });
                } else if ((product == 'GRP')) {
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

            if (product == 'EWED') {
                currentProduct = 'ewed'
            }

            if (product == 'FMXD') {
                currentProduct = 'fmxd'
            }

            if (product == 'FMX') {
                /* if (req.body.statusCode == 'FA') {
                    update = {
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
                    }

                    DetrackAPIrun = 1;
                    mongoDBrun = 2;

                    portalUpdate = "Detrack/Mongo updated. Attempt is fixed. Detrack no. of attempt are ";
                    appliedStatus = "Attempt and Payment Method Fix"

                    completeRun = 1;
                } */

                if ((req.body.statusCode == 'IR') && (data.data.status == 'info_recv')) {
                    newOrder = new ORDERS({
                        area: data.data.zone,
                        items: [{
                            quantity: data.data.items[0].quantity,
                            description: data.data.items[0].description,
                            totalItemPrice: data.data.total_price
                        }],
                        attempt: wmsAttempt,
                        history: [{
                            updatedBy: req.user.name,
                            dateUpdated: moment().format(),
                            statusHistory: "Info Received",
                            lastAssignedTo: "N/A",
                            reason: "N/A",
                            lastLocation: "N/A"
                        }],
                        lastAssignedTo: "N/A",
                        latestLocation: "N/A",
                        product: "fmx",
                        assignedTo: "N/A",
                        senderName: data.data.job_owner,
                        totalPrice: data.data.total_price,
                        deliveryType: data.data.type,
                        parcelWeight: data.data.weight,
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
                        cargoPrice: data.data.insurance_price,
                        instructions: data.data.instructions,
                        flightDate: data.data.job_received_date,
                        mawbNo: data.data.run_number,
                        fmxMilestoneStatus: "N/A",
                        fmxMilestoneStatusCode: "N/A",
                        latestReason: "N/A",
                        lastUpdateDateTime: moment().format(),
                        creationDate: data.data.created_at,
                        jobDate: "N/A",
                        lastUpdatedBy: req.user.name,
                    });

                    portalUpdate = "Portal status updated to Info Received. ";
                    appliedStatus = "Info Received"
                    mongoDBrun = 1;
                    completeRun = 1;
                }

                if ((req.body.statusCode == 'CP') && (data.data.status == 'info_recv')) {
                    if (existingOrder === null) {
                        newOrder = new ORDERS({
                            area: data.data.zone,
                            items: [{
                                quantity: data.data.items[0].quantity,
                                description: data.data.items[0].description,
                                totalItemPrice: data.data.total_price
                            }],
                            attempt: wmsAttempt,
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
                            product: "fmx",
                            assignedTo: "N/A",
                            senderName: data.data.job_owner,
                            totalPrice: data.data.total_price,
                            deliveryType: data.data.type,
                            parcelWeight: data.data.weight,
                            receiverName: data.data.deliver_to_collect_from,
                            trackingLink: data.data.tracking_link,
                            currentStatus: "Custom Clearing",
                            paymentMethod: data.data.payment_mode,
                            warehouseEntry: "No",
                            warehouseEntryDateTime: "N/A",
                            receiverAddress: data.data.address,
                            receiverPhoneNumber: data.data.phone_number,
                            doTrackingNumber: consignmentID,
                            remarks: data.data.remarks,
                            cargoPrice: data.data.insurance_price,
                            instructions: "FMX Milestone ID CP",
                            flightDate: data.data.job_received_date,
                            mawbNo: data.data.run_number,
                            fmxMilestoneStatus: "Customs Clearance in Progress",
                            fmxMilestoneStatusCode: "CP",
                            latestReason: "N/A",
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            jobDate: "N/A",
                            lastUpdatedBy: req.user.name,
                        });

                        mongoDBrun = 1;
                    } else {
                        update = {
                            currentStatus: "Custom Clearing",
                            lastUpdateDateTime: moment().format(),
                            fmxMilestoneStatus: "Customs Clearance in Progress",
                            fmxMilestoneStatusCode: "CP",
                            instructions: "FMX Milestone ID CP",
                            attempt: wmsAttempt,
                            latestLocation: "Brunei Custom Clearance",
                            lastUpdatedBy: req.user.name,
                            lastAssignedTo: "N/A",
                            $push: {
                                history: {
                                    statusHistory: "Custom Clearing",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: "N/A",
                                    reason: "N/A",
                                    lastLocation: "Brunei Custom Clearance",
                                }
                            }
                        }

                        mongoDBrun = 2;
                    }

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "custom_clearing",
                            instructions: "FMX Milestone ID CP",
                            job_type: "Delivery"
                        }
                    };

                    portalUpdate = "Portal and Detrack status updated to Custom Clearing. ";
                    fmxUpdate = "FMX milestone updated to Custom Clearance In Progress.";
                    fmxMilestoneCode = "CP"
                    appliedStatus = "Custom Clearance in Progress"

                    DetrackAPIrun = 1;
                    FMXAPIrun = 1;
                    completeRun = 1;
                }

                if ((req.body.statusCode == "DC") && (data.data.status == 'custom_clearing') /* && (data.data.instructions.includes('CP')) */) {
                    if (req.body.additionalReason.length != 0) {
                        detrackReason = req.body.additionalReason;
                    }

                    if (existingOrder === null) {
                        newOrder = new ORDERS({
                            area: data.data.zone,
                            items: [{
                                quantity: data.data.items[0].quantity,
                                description: data.data.items[0].description,
                                totalItemPrice: data.data.total_price
                            }],
                            attempt: wmsAttempt,
                            history: [{
                                statusHistory: "Detained by Customs",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastAssignedTo: "N/A",
                                reason: detrackReason,
                                lastLocation: "Brunei Custom Clearance",
                            }],
                            lastAssignedTo: "N/A",
                            latestLocation: "Brunei Custom Clearance",
                            product: "fmx",
                            assignedTo: "N/A",
                            senderName: data.data.job_owner,
                            totalPrice: data.data.total_price,
                            deliveryType: "Delivery",
                            parcelWeight: data.data.weight,
                            receiverName: data.data.deliver_to_collect_from,
                            trackingLink: data.data.tracking_link,
                            currentStatus: "Detained by Customs",
                            paymentMethod: data.data.payment_mode,
                            warehouseEntry: "No",
                            warehouseEntryDateTime: "N/A",
                            receiverAddress: data.data.address,
                            receiverPhoneNumber: data.data.phone_number,
                            doTrackingNumber: consignmentID,
                            remarks: data.data.remarks,
                            cargoPrice: data.data.insurance_price,
                            instructions: "FMX Milestone ID DC",
                            flightDate: data.data.job_received_date,
                            mawbNo: data.data.run_number,
                            fmxMilestoneStatus: "Detained by Customs",
                            fmxMilestoneStatusCode: "DC",
                            latestReason: detrackReason,
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            jobDate: "N/A",
                            lastUpdatedBy: req.user.name,
                        });

                        mongoDBrun = 1;
                    } else {
                        update = {
                            currentStatus: "Detained by Customs",
                            lastUpdateDateTime: moment().format(),
                            fmxMilestoneStatus: "Detained by Customs",
                            fmxMilestoneStatusCode: "DC",
                            instructions: "FMX Milestone ID DC",
                            latestReason: detrackReason,
                            attempt: wmsAttempt,
                            latestLocation: "Brunei Custom Clearance",
                            lastUpdatedBy: req.user.name,
                            lastAssignedTo: "N/A",
                            $push: {
                                history: {
                                    statusHistory: "Detained by Customs",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: "N/A",
                                    reason: detrackReason,
                                    lastLocation: "Brunei Custom Clearance",
                                }
                            }
                        }

                        mongoDBrun = 2;
                    }

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            instructions: "FMX Milestone ID DC",
                            job_type: "Delivery"
                        }
                    };

                    portalUpdate = "Portal status updated to Detained by Customs. "
                    fmxUpdate = "FMX milestone updated to Detained by Customs.";
                    fmxMilestoneCode = "DC"
                    appliedStatus = "Detained by Customs"

                    DetrackAPIrun = 1;
                    FMXAPIrun = 2;
                    completeRun = 1;
                }

                if ((req.body.statusCode == 38) && (data.data.status == 'custom_clearing') /* && ((data.data.instructions.includes('CP'))||(data.data.instructions.includes('DC'))) */) {
                    if (existingOrder === null) {
                        newOrder = new ORDERS({
                            area: data.data.zone,
                            items: [{
                                quantity: data.data.items[0].quantity,
                                description: data.data.items[0].description,
                                totalItemPrice: data.data.total_price
                            }],
                            attempt: wmsAttempt,
                            history: [{
                                statusHistory: "Custom Clearance Release",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastAssignedTo: "N/A",
                                reason: "N/A",
                                lastLocation: "Brunei Custom Clearance",
                            }],
                            lastAssignedTo: "N/A",
                            latestLocation: "Brunei Custom Clearance",
                            product: "fmx",
                            assignedTo: "N/A",
                            senderName: data.data.job_owner,
                            totalPrice: data.data.total_price,
                            deliveryType: "Delivery",
                            parcelWeight: data.data.weight,
                            receiverName: data.data.deliver_to_collect_from,
                            trackingLink: data.data.tracking_link,
                            currentStatus: "Custom Clearance Release",
                            paymentMethod: data.data.payment_mode,
                            warehouseEntry: "No",
                            warehouseEntryDateTime: "N/A",
                            receiverAddress: data.data.address,
                            receiverPhoneNumber: data.data.phone_number,
                            doTrackingNumber: consignmentID,
                            remarks: data.data.remarks,
                            cargoPrice: data.data.insurance_price,
                            instructions: "FMX Milestone ID 38",
                            flightDate: data.data.job_received_date,
                            mawbNo: data.data.run_number,
                            fmxMilestoneStatus: "Custom Clearance Release",
                            fmxMilestoneStatusCode: "38",
                            latestReason: "N/A",
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            jobDate: "N/A",
                            lastUpdatedBy: req.user.name,
                        });

                        mongoDBrun = 1;
                    } else {
                        update = {
                            currentStatus: "Custom Clearance Release",
                            lastUpdateDateTime: moment().format(),
                            fmxMilestoneStatus: "Custom Clearance Release",
                            fmxMilestoneStatusCode: "38",
                            instructions: "FMX Milestone ID 38",
                            attempt: wmsAttempt,
                            latestLocation: "Brunei Custom Clearance",
                            lastUpdatedBy: req.user.name,
                            lastAssignedTo: "N/A",
                            $push: {
                                history: {
                                    statusHistory: "Custom Clearance Release",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: "N/A",
                                    reason: "N/A",
                                    lastLocation: "Brunei Custom Clearance",
                                }
                            }
                        }

                        mongoDBrun = 2;
                    }

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            instructions: "FMX Milestone ID 38",
                            job_type: "Delivery"
                        }
                    };

                    portalUpdate = "Portal and Detrack status updated to Custom Clearance Release. "
                    fmxUpdate = "FMX milestone updated to Custom Clearance Release.";
                    fmxMilestoneCode = "38"
                    appliedStatus = "Custom Clearance Release"

                    DetrackAPIrun = 1;
                    FMXAPIrun = 1;
                    completeRun = 1;
                }

                if ((req.body.statusCode == 12) && (data.data.status == 'custom_clearing')) {
                    if (existingOrder === null) {
                        newOrder = new ORDERS({
                            area: data.data.zone,
                            items: [{
                                quantity: data.data.items[0].quantity,
                                description: data.data.items[0].description,
                                totalItemPrice: data.data.total_price
                            }],
                            attempt: wmsAttempt,
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
                            product: "fmx",
                            assignedTo: "N/A",
                            senderName: data.data.job_owner,
                            totalPrice: data.data.total_price,
                            deliveryType: "Delivery",
                            parcelWeight: data.data.weight,
                            receiverName: data.data.deliver_to_collect_from,
                            trackingLink: data.data.tracking_link,
                            currentStatus: "At Warehouse",
                            paymentMethod: data.data.payment_mode,
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: moment().format(),
                            receiverAddress: data.data.address,
                            receiverPhoneNumber: data.data.phone_number,
                            doTrackingNumber: consignmentID,
                            remarks: data.data.remarks,
                            cargoPrice: data.data.insurance_price,
                            instructions: "FMX Milestone ID 12",
                            flightDate: data.data.job_received_date,
                            mawbNo: data.data.run_number,
                            fmxMilestoneStatus: "At Warehouse",
                            fmxMilestoneStatusCode: "12",
                            latestReason: "N/A",
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            jobDate: "N/A",
                            lastUpdatedBy: req.user.name,
                        });

                        mongoDBrun = 1;
                    } else {
                        update = {
                            currentStatus: "At Warehouse",
                            lastUpdateDateTime: moment().format(),
                            fmxMilestoneStatus: "At Warehouse",
                            fmxMilestoneStatusCode: "12",
                            instructions: "FMX Milestone ID 12",
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: moment().format(),
                            attempt: wmsAttempt,
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
                    }

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse",
                            instructions: "FMX Milestone ID 12",
                            job_type: "Delivery"
                        }
                    };

                    portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                    fmxUpdate = "FMX milestone updated to At Warehouse.";
                    fmxMilestoneCode = "12"
                    appliedStatus = "Item in Warehouse"

                    DetrackAPIrun = 1;
                    FMXAPIrun = 1;
                    completeRun = 1;

                    if (data.data.phone_number != null) {
                        waOrderArrivedDeliverFMX = 1;
                    }
                }

                if ((req.body.statusCode == 35) && (data.data.status == 'at_warehouse')) {
                    /* if (wmsAttempt > 3) {
                        maxAttempt = 1;
                        completeRun = 1;
                    } else { */
                    if ((req.body.dispatchers == "FL1") || (req.body.dispatchers == "FL2") || (req.body.dispatchers == "FL3") || (req.body.dispatchers == "FL4") || (req.body.dispatchers == "FL5")) {
                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: [{
                                    quantity: data.data.items[0].quantity,
                                    description: data.data.items[0].description,
                                    totalItemPrice: data.data.total_price
                                }],
                                attempt: wmsAttempt,
                                history: [{
                                    statusHistory: "Out for Delivery",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                    reason: "N/A",
                                    lastLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                }],
                                lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                latestLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                product: "fmx",
                                assignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: "Delivery",
                                parcelWeight: data.data.weight,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Out for Delivery",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                cargoPrice: data.data.insurance_price,
                                instructions: "FMX Milestone ID 35. Assigned to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                fmxMilestoneStatus: "Out for Delivery",
                                fmxMilestoneStatusCode: "35",
                                latestReason: "N/A",
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: req.body.assignDate,
                                lastUpdatedBy: req.user.name,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                currentStatus: "Out for Delivery",
                                lastUpdateDateTime: moment().format(),
                                fmxMilestoneStatus: "Out for Delivery",
                                fmxMilestoneStatusCode: "35",
                                instructions: "FMX Milestone ID 35. Assigned to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
                                assignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                attempt: wmsAttempt,
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
                                status: "dispatched", // Use the calculated dStatus
                                instructions: "FMX Milestone ID 35. Assigned to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
                                job_type: "Delivery"
                            }
                        };

                        portalUpdate = "Portal and Detrack status updated to Out for Delivery assigned to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ". ";

                    } else {
                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: [{
                                    quantity: data.data.items[0].quantity,
                                    description: data.data.items[0].description,
                                    totalItemPrice: data.data.total_price
                                }],
                                attempt: wmsAttempt,
                                history: [{
                                    statusHistory: "Out for Delivery",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: req.body.dispatchers,
                                    reason: "N/A",
                                    lastLocation: req.body.dispatchers,
                                }],
                                lastAssignedTo: req.body.dispatchers,
                                latestLocation: req.body.dispatchers,
                                product: "fmx",
                                assignedTo: req.body.dispatchers,
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: "Delivery",
                                parcelWeight: data.data.weight,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Out for Delivery",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                cargoPrice: data.data.insurance_price,
                                instructions: "FMX Milestone ID 35. Assigned to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                fmxMilestoneStatus: "Out for Delivery",
                                fmxMilestoneStatusCode: "35",
                                latestReason: "N/A",
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: req.body.assignDate,
                                lastUpdatedBy: req.user.name,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                currentStatus: "Out for Delivery",
                                lastUpdateDateTime: moment().format(),
                                fmxMilestoneStatus: "Out for Delivery",
                                fmxMilestoneStatusCode: "35",
                                instructions: "FMX Milestone ID 35. Assigned to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
                                assignedTo: req.body.dispatchers,
                                attempt: wmsAttempt,
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
                                status: "dispatched", // Use the calculated dStatus
                                instructions: "FMX Milestone ID 35. Assigned to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
                                job_type: "Delivery"
                            }
                        };

                        portalUpdate = "Portal and Detrack status updated to Out for Delivery assigned to " + req.body.dispatchers + " on " + req.body.assignDate + ". ";
                    }

                    fmxUpdate = "FMX milestone updated to Out for Delivery.";
                    fmxMilestoneCode = "35"
                    appliedStatus = "Out for Delivery"

                    DetrackAPIrun = 1;
                    FMXAPIrun = 1;
                    completeRun = 1;
                    /* } */
                }

                if ((req.body.statusCode == 'SD') && (data.data.status == 'dispatched')) {
                    if ((req.body.dispatchers == "FL1") || (req.body.dispatchers == "FL2") || (req.body.dispatchers == "FL3") || (req.body.dispatchers == "FL4") || (req.body.dispatchers == "FL5")) {
                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: [{
                                    quantity: data.data.items[0].quantity,
                                    description: data.data.items[0].description,
                                    totalItemPrice: data.data.total_price
                                }],
                                attempt: wmsAttempt,
                                history: [{
                                    statusHistory: "Out for Delivery (Switched Dispatchers)",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                    reason: "N/A",
                                    lastLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                }],
                                lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                latestLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                product: "fmx",
                                assignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: "Delivery",
                                parcelWeight: data.data.weight,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Out for Delivery",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                cargoPrice: data.data.insurance_price,
                                instructions: "FMX Milestone ID 35. Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                fmxMilestoneStatus: "Out for Delivery",
                                fmxMilestoneStatusCode: "35",
                                latestReason: "N/A",
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: req.body.assignDate,
                                lastUpdatedBy: req.user.name,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                instructions: "FMX Milestone ID 35. Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
                                assignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                jobDate: req.body.assignDate,
                                attempt: wmsAttempt,
                                latestLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                $push: {
                                    history: {
                                        statusHistory: "Out for Delivery (Switched Dispatchers)",
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
                                instructions: "FMX Milestone ID 35. Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
                                job_type: "Delivery"
                            }
                        };

                        portalUpdate = "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ". ";

                    } else {
                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: [{
                                    quantity: data.data.items[0].quantity,
                                    description: data.data.items[0].description,
                                    totalItemPrice: data.data.total_price
                                }],
                                attempt: wmsAttempt,
                                history: [{
                                    statusHistory: "Out for Delivery (Switched Dispatchers)",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                    reason: "N/A",
                                    lastLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                }],
                                lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                latestLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                product: "fmx",
                                assignedTo: req.body.dispatchers,
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: "Delivery",
                                parcelWeight: data.data.weight,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Out for Delivery",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                cargoPrice: data.data.insurance_price,
                                instructions: "FMX Milestone ID 35. Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                fmxMilestoneStatus: "Out for Delivery",
                                fmxMilestoneStatusCode: "35",
                                latestReason: "N/A",
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: req.body.assignDate,
                                lastUpdatedBy: req.user.name,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                lastUpdateDateTime: moment().format(),
                                instructions: "FMX Milestone ID 35. Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
                                assignedTo: req.body.dispatchers,
                                jobDate: req.body.assignDate,
                                attempt: wmsAttempt,
                                latestLocation: req.body.dispatchers,
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: req.body.dispatchers,
                                $push: {
                                    history: {
                                        statusHistory: "Out for Delivery (Switched Dispatchers)",
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
                                instructions: "FMX Milestone ID 35. Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
                                job_type: "Delivery"
                            }
                        };

                        portalUpdate = "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ". ";
                    }

                    appliedStatus = "Swap Dispatchers"

                    DetrackAPIrun = 1;
                    completeRun = 1;
                }

                if (req.body.statusCode == 'SFJ') {
                    if (data.data.status == 'failed') {
                        if (data.data.reason == "Unattempted Delivery") {
                            fmxUpdate = "FMX milestone updated to Failed Delivery due to Unattempted Delivery (MD). Return to Warehouse (44).";
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                            detrackReason = "Unattempted Delivery.";

                            if (existingOrder === null) {
                                newOrder = new ORDERS({
                                    area: data.data.zone,
                                    items: [{
                                        quantity: data.data.items[0].quantity,
                                        description: data.data.items[0].description,
                                        totalItemPrice: data.data.total_price
                                    }],
                                    attempt: wmsAttempt,
                                    history: [
                                        {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Unattempted Delivery",
                                            lastLocation: data.data.assign_to,
                                        },
                                        {
                                            statusHistory: "Return to Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: "N/A",
                                            reason: "N/A",
                                            lastLocation: req.body.warehouse,
                                        }
                                    ],
                                    lastAssignedTo: data.data.assign_to,
                                    latestLocation: req.body.warehouse,
                                    product: "fmx",
                                    assignedTo: "N/A",
                                    senderName: data.data.job_owner,
                                    totalPrice: data.data.total_price,
                                    deliveryType: "Delivery",
                                    parcelWeight: data.data.weight,
                                    receiverName: data.data.deliver_to_collect_from,
                                    trackingLink: data.data.tracking_link,
                                    currentStatus: "Return to Warehouse",
                                    paymentMethod: data.data.payment_mode,
                                    warehouseEntry: "Yes",
                                    warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                    receiverAddress: data.data.address,
                                    receiverPhoneNumber: data.data.phone_number,
                                    doTrackingNumber: consignmentID,
                                    remarks: data.data.remarks,
                                    cargoPrice: data.data.insurance_price,
                                    instructions: "FMX Milestone ID MD, 44",
                                    flightDate: data.data.job_received_date,
                                    mawbNo: data.data.run_number,
                                    fmxMilestoneStatus: "Failed Delivery due to Unattempted Delivery. Return to Warehouse",
                                    fmxMilestoneStatusCode: "MD, 44",
                                    latestReason: "Unattempted Delivery",
                                    lastUpdateDateTime: moment().format(),
                                    creationDate: data.data.created_at,
                                    jobDate: data.data.date,
                                    lastUpdatedBy: req.user.name,
                                });

                                mongoDBrun = 1;
                            } else {
                                update = {
                                    currentStatus: "Return to Warehouse",
                                    lastUpdateDateTime: moment().format(),
                                    instructions: "FMX Milestone ID MD, 44",
                                    assignedTo: "N/A",
                                    fmxMilestoneStatus: "Failed Delivery due to Unattempted Delivery. Return to Warehouse",
                                    fmxMilestoneStatusCode: "MD, 44",
                                    latestReason: "Unattempted Delivery",
                                    attempt: wmsAttempt,
                                    latestLocation: req.body.warehouse,
                                    lastUpdatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to,
                                    $push: {
                                        history: {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Unattempted Delivery",
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

                                mongoDBrun = 2;
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "at_warehouse", // Use the calculated dStatus
                                    instructions: "FMX Milestone ID MD, 44. Unattempted Delivery.",
                                    job_type: "Delivery"
                                }
                            };

                            DetrackAPIrun = 1;
                            fmxMilestoneCode = "MD"
                            appliedStatus = "Failed Delivery due to Unattempted Delivery. Return to Warehouse (FMX)"

                            if (data.data.phone_number != null) {
                                waOrderFailedDelivery = 1;
                            }
                        }

                        if (data.data.reason == "Reschedule delivery requested by customer") {
                            fmxUpdate = "FMX milestone updated to Failed Delivery. Reschedule Delivery Requested By Customer (FD) to " + data.data.note + ". Return to Warehouse (44).";
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                            detrackReason = "Reschedule Delivery Requested By Customer to " + data.data.note + ".";

                            if (existingOrder === null) {
                                newOrder = new ORDERS({
                                    area: data.data.zone,
                                    items: [{
                                        quantity: data.data.items[0].quantity,
                                        description: data.data.items[0].description,
                                        totalItemPrice: data.data.total_price
                                    }],
                                    attempt: wmsAttempt,
                                    history: [
                                        {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Reschedule Delivery Requested By Customer to " + data.data.note,
                                            lastLocation: data.data.assign_to,
                                        },
                                        {
                                            statusHistory: "Return to Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: "N/A",
                                            reason: "N/A",
                                            lastLocation: req.body.warehouse,
                                        }
                                    ],
                                    lastAssignedTo: data.data.assign_to,
                                    latestLocation: req.body.warehouse,
                                    product: "fmx",
                                    assignedTo: "N/A",
                                    senderName: data.data.job_owner,
                                    totalPrice: data.data.total_price,
                                    deliveryType: "Delivery",
                                    parcelWeight: data.data.weight,
                                    receiverName: data.data.deliver_to_collect_from,
                                    trackingLink: data.data.tracking_link,
                                    currentStatus: "Return to Warehouse",
                                    paymentMethod: data.data.payment_mode,
                                    warehouseEntry: "Yes",
                                    warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                    receiverAddress: data.data.address,
                                    receiverPhoneNumber: data.data.phone_number,
                                    doTrackingNumber: consignmentID,
                                    remarks: data.data.remarks,
                                    cargoPrice: data.data.insurance_price,
                                    instructions: "FMX Milestone ID RF, 44",
                                    flightDate: data.data.job_received_date,
                                    mawbNo: data.data.run_number,
                                    fmxMilestoneStatus: "Failed Delivery. Reschedule Delivery Requested By Customer to " + data.data.note + ". Return to Warehouse.",
                                    fmxMilestoneStatusCode: "FD, 44",
                                    latestReason: "Reschedule Delivery Requested By Customer to " + data.data.note,
                                    lastUpdateDateTime: moment().format(),
                                    creationDate: data.data.created_at,
                                    jobDate: data.data.date,
                                    lastUpdatedBy: req.user.name,
                                });

                                mongoDBrun = 1;
                            } else {
                                update = {
                                    currentStatus: "Return to Warehouse",
                                    lastUpdateDateTime: moment().format(),
                                    instructions: "FMX Milestone ID FD, 44",
                                    assignedTo: "N/A",
                                    fmxMilestoneStatus: "Failed Delivery. Reschedule Delivery Requested By Customer to " + data.data.note + ". Return to Warehouse.",
                                    fmxMilestoneStatusCode: "FD, 44",
                                    latestReason: "Reschedule Delivery Requested By Customer to " + data.data.note,
                                    attempt: wmsAttempt,
                                    latestLocation: req.body.warehouse,
                                    lastUpdatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to,
                                    $push: {
                                        history: {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Reschedule Delivery Requested By Customer to " + data.data.note,
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

                                mongoDBrun = 2;
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "at_warehouse", // Use the calculated dStatus
                                    instructions: "FMX Milestone ID FD, 44. Customer Declined Delivery due to " + data.data.note,
                                    job_type: "Delivery"
                                }
                            };

                            var detrackUpdateDataAttempt = {
                                data: {
                                    do_number: consignmentID,
                                }
                            };

                            DetrackAPIrun = 2;
                            fmxMilestoneCode = "FD"
                            appliedStatus = "Failed Delivery due to Reschedule Delivery Requested By Customer. Return to Warehouse (FMX)"
                        }

                        if (data.data.reason == "Reschedule to self collect requested by customer") {
                            fmxUpdate = "FMX milestone updated to Failed Delivery. Reschedule to Self Collect Requested By Customer (SC) to " + data.data.note + ". Return to Warehouse (44).";
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                            detrackReason = "Reschedule to Self Collect Requested By Customer to " + data.data.note + ".";

                            if (existingOrder === null) {
                                newOrder = new ORDERS({
                                    area: data.data.zone,
                                    items: [{
                                        quantity: data.data.items[0].quantity,
                                        description: data.data.items[0].description,
                                        totalItemPrice: data.data.total_price
                                    }],
                                    attempt: wmsAttempt,
                                    history: [
                                        {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Reschedule to Self Collect Requested By Customer to " + data.data.note,
                                            lastLocation: data.data.assign_to,
                                        },
                                        {
                                            statusHistory: "Return to Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: "N/A",
                                            reason: "N/A",
                                            lastLocation: req.body.warehouse,
                                        }
                                    ],
                                    lastAssignedTo: data.data.assign_to,
                                    latestLocation: req.body.warehouse,
                                    product: "fmx",
                                    assignedTo: "N/A",
                                    senderName: data.data.job_owner,
                                    totalPrice: data.data.total_price,
                                    deliveryType: "Delivery",
                                    parcelWeight: data.data.weight,
                                    receiverName: data.data.deliver_to_collect_from,
                                    trackingLink: data.data.tracking_link,
                                    currentStatus: "Return to Warehouse",
                                    paymentMethod: data.data.payment_mode,
                                    warehouseEntry: "Yes",
                                    warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                    receiverAddress: data.data.address,
                                    receiverPhoneNumber: data.data.phone_number,
                                    doTrackingNumber: consignmentID,
                                    remarks: data.data.remarks,
                                    cargoPrice: data.data.insurance_price,
                                    instructions: "FMX Milestone ID SC, 44",
                                    flightDate: data.data.job_received_date,
                                    mawbNo: data.data.run_number,
                                    fmxMilestoneStatus: "Failed Delivery. Reschedule to Self Collect Requested By Customer to " + data.data.note + ". Return to Warehouse",
                                    fmxMilestoneStatusCode: "SC, 44",
                                    latestReason: "Reschedule to Self Collect Requested By Customer to " + data.data.note,
                                    lastUpdateDateTime: moment().format(),
                                    creationDate: data.data.created_at,
                                    jobDate: data.data.date,
                                    lastUpdatedBy: req.user.name,
                                });

                                mongoDBrun = 1;
                            } else {
                                update = {
                                    currentStatus: "Return to Warehouse",
                                    lastUpdateDateTime: moment().format(),
                                    instructions: "FMX Milestone ID SC, 44",
                                    assignedTo: "N/A",
                                    fmxMilestoneStatus: "Failed Delivery. Reschedule to Self Collect Requested By Customer to " + data.data.note + ". Return to Warehouse",
                                    fmxMilestoneStatusCode: "SC, 44",
                                    latestReason: "Reschedule to Self Collect Requested By Customer to " + data.data.note,
                                    attempt: wmsAttempt,
                                    latestLocation: req.body.warehouse,
                                    lastUpdatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to,
                                    $push: {
                                        history: {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Reschedule to Self Collect Requested By Customer to " + data.data.note,
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

                                mongoDBrun = 2;
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "at_warehouse", // Use the calculated dStatus
                                    instructions: "FMX Milestone ID SC, 44. Reschedule to Self Collect Requested By Customer to " + data.data.note,
                                    job_type: "Delivery"
                                }
                            };

                            var detrackUpdateDataAttempt = {
                                data: {
                                    do_number: consignmentID,
                                }
                            };

                            DetrackAPIrun = 2;
                            fmxMilestoneCode = "SC"
                            appliedStatus = "Failed Delivery due to Reschedule to Self Collect Requested By Customer. Return to Warehouse (FMX)"
                        }

                        if (data.data.reason == "Cash/Duty Not Ready") {
                            fmxUpdate = "FMX milestone updated to Failed Delivery due to Cash/Duty Not Ready (DU). Return to Warehouse (44).";
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                            detrackReason = "Cash/Duty Not Ready.";

                            if (existingOrder === null) {
                                newOrder = new ORDERS({
                                    area: data.data.zone,
                                    items: [{
                                        quantity: data.data.items[0].quantity,
                                        description: data.data.items[0].description,
                                        totalItemPrice: data.data.total_price
                                    }],
                                    attempt: wmsAttempt,
                                    history: [
                                        {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Cash/Duty Not Ready",
                                            lastLocation: data.data.assign_to,
                                        },
                                        {
                                            statusHistory: "Return to Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: "N/A",
                                            reason: "N/A",
                                            lastLocation: req.body.warehouse,
                                        }
                                    ],
                                    lastAssignedTo: data.data.assign_to,
                                    latestLocation: req.body.warehouse,
                                    product: "fmx",
                                    assignedTo: "N/A",
                                    senderName: data.data.job_owner,
                                    totalPrice: data.data.total_price,
                                    deliveryType: "Delivery",
                                    parcelWeight: data.data.weight,
                                    receiverName: data.data.deliver_to_collect_from,
                                    trackingLink: data.data.tracking_link,
                                    currentStatus: "Return to Warehouse",
                                    paymentMethod: data.data.payment_mode,
                                    warehouseEntry: "Yes",
                                    warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                    receiverAddress: data.data.address,
                                    receiverPhoneNumber: data.data.phone_number,
                                    doTrackingNumber: consignmentID,
                                    remarks: data.data.remarks,
                                    cargoPrice: data.data.insurance_price,
                                    instructions: "FMX Milestone ID DU, 44",
                                    flightDate: data.data.job_received_date,
                                    mawbNo: data.data.run_number,
                                    fmxMilestoneStatus: "Failed Delivery due to Cash/Duty Not Ready. Return to Warehouse",
                                    fmxMilestoneStatusCode: "DU, 44",
                                    latestReason: "Cash/Duty Not Ready",
                                    lastUpdateDateTime: moment().format(),
                                    creationDate: data.data.created_at,
                                    jobDate: data.data.date,
                                    lastUpdatedBy: req.user.name,
                                });

                                mongoDBrun = 1;
                            } else {
                                update = {
                                    currentStatus: "Return to Warehouse",
                                    lastUpdateDateTime: moment().format(),
                                    instructions: "FMX Milestone ID DU, 44",
                                    assignedTo: "N/A",
                                    fmxMilestoneStatus: "Failed Delivery due to Cash/Duty Not Ready. Return to Warehouse",
                                    fmxMilestoneStatusCode: "DU, 44",
                                    latestReason: "Cash/Duty Not Ready",
                                    attempt: wmsAttempt,
                                    latestLocation: req.body.warehouse,
                                    lastUpdatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to,
                                    $push: {
                                        history: {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Cash/Duty Not Ready",
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

                                mongoDBrun = 2;
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "at_warehouse", // Use the calculated dStatus
                                    instructions: "FMX Milestone ID DU, 44. Cash/Duty Not Ready.",
                                    job_type: "Delivery"
                                }
                            };

                            var detrackUpdateDataAttempt = {
                                data: {
                                    do_number: consignmentID,
                                }
                            };

                            DetrackAPIrun = 2;
                            fmxMilestoneCode = "DU"
                            appliedStatus = "Failed Delivery due to Cash/Duty Not Ready. Return to Warehouse (FMX)"
                        }

                        if (data.data.reason == "Customer not available / cannot be contacted") {
                            fmxUpdate = "FMX milestone updated to Failed Delivery due to Consignee Not In, Business Closed/Customer not pickup phone (NA). Return to Warehouse (44).";
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                            detrackReason = "Consignee Not In, Business Closed/Customer not pickup phone.";

                            if (existingOrder === null) {
                                newOrder = new ORDERS({
                                    area: data.data.zone,
                                    items: [{
                                        quantity: data.data.items[0].quantity,
                                        description: data.data.items[0].description,
                                        totalItemPrice: data.data.total_price
                                    }],
                                    attempt: wmsAttempt,
                                    history: [
                                        {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Customer not available / cannot be contacted",
                                            lastLocation: data.data.assign_to,
                                        },
                                        {
                                            statusHistory: "Return to Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: "N/A",
                                            reason: "N/A",
                                            lastLocation: req.body.warehouse,
                                        }
                                    ],
                                    lastAssignedTo: data.data.assign_to,
                                    latestLocation: req.body.warehouse,
                                    product: "fmx",
                                    assignedTo: "N/A",
                                    senderName: data.data.job_owner,
                                    totalPrice: data.data.total_price,
                                    deliveryType: "Delivery",
                                    parcelWeight: data.data.weight,
                                    receiverName: data.data.deliver_to_collect_from,
                                    trackingLink: data.data.tracking_link,
                                    currentStatus: "Return to Warehouse",
                                    paymentMethod: data.data.payment_mode,
                                    warehouseEntry: "Yes",
                                    warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                    receiverAddress: data.data.address,
                                    receiverPhoneNumber: data.data.phone_number,
                                    doTrackingNumber: consignmentID,
                                    remarks: data.data.remarks,
                                    cargoPrice: data.data.insurance_price,
                                    instructions: "FMX Milestone ID NA, 44",
                                    flightDate: data.data.job_received_date,
                                    mawbNo: data.data.run_number,
                                    fmxMilestoneStatus: "Failed Delivery due to Consignee Not In, Business Closed/Customer not pickup phone. Return to Warehouse",
                                    fmxMilestoneStatusCode: "NA, 44",
                                    latestReason: "Customer not available / cannot be contacted",
                                    lastUpdateDateTime: moment().format(),
                                    creationDate: data.data.created_at,
                                    jobDate: data.data.date,
                                    lastUpdatedBy: req.user.name,
                                });

                                mongoDBrun = 1;
                            } else {
                                update = {
                                    currentStatus: "Return to Warehouse",
                                    lastUpdateDateTime: moment().format(),
                                    instructions: "FMX Milestone ID NA, 44",
                                    assignedTo: "N/A",
                                    fmxMilestoneStatus: "Failed Delivery due to Consignee Not In, Business Closed/Customer not pickup phone. Return to Warehouse",
                                    fmxMilestoneStatusCode: "NA, 44",
                                    latestReason: "Customer not available / cannot be contacted",
                                    attempt: wmsAttempt,
                                    latestLocation: req.body.warehouse,
                                    lastUpdatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to,
                                    $push: {
                                        history: {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Customer not available / cannot be contacted",
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

                                mongoDBrun = 2;
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "at_warehouse", // Use the calculated dStatus
                                    instructions: "FMX Milestone ID NA, 44. Customer not available / cannot be contacted.",
                                    job_type: "Delivery"
                                }
                            };

                            var detrackUpdateDataAttempt = {
                                data: {
                                    do_number: consignmentID,
                                }
                            };

                            DetrackAPIrun = 2;
                            fmxMilestoneCode = "NA"
                            appliedStatus = "Failed Delivery due to Customer not available / cannot be contacted. Return to Warehouse (FMX)"
                        }

                        if (data.data.reason == "No Such Person") {
                            fmxUpdate = "FMX milestone updated to Failed Delivery due to No Such Person (NP). Return to Warehouse (44).";
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                            detrackReason = "No Such Person.";

                            if (existingOrder === null) {
                                newOrder = new ORDERS({
                                    area: data.data.zone,
                                    items: [{
                                        quantity: data.data.items[0].quantity,
                                        description: data.data.items[0].description,
                                        totalItemPrice: data.data.total_price
                                    }],
                                    attempt: wmsAttempt,
                                    history: [
                                        {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "No Such Person",
                                            lastLocation: data.data.assign_to,
                                        },
                                        {
                                            statusHistory: "Return to Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: "N/A",
                                            reason: "N/A",
                                            lastLocation: req.body.warehouse,
                                        }
                                    ],
                                    lastAssignedTo: data.data.assign_to,
                                    latestLocation: req.body.warehouse,
                                    product: "fmx",
                                    assignedTo: "N/A",
                                    senderName: data.data.job_owner,
                                    totalPrice: data.data.total_price,
                                    deliveryType: "Delivery",
                                    parcelWeight: data.data.weight,
                                    receiverName: data.data.deliver_to_collect_from,
                                    trackingLink: data.data.tracking_link,
                                    currentStatus: "Return to Warehouse",
                                    paymentMethod: data.data.payment_mode,
                                    warehouseEntry: "Yes",
                                    warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                    receiverAddress: data.data.address,
                                    receiverPhoneNumber: data.data.phone_number,
                                    doTrackingNumber: consignmentID,
                                    remarks: data.data.remarks,
                                    cargoPrice: data.data.insurance_price,
                                    instructions: "FMX Milestone ID NP, 44",
                                    flightDate: data.data.job_received_date,
                                    mawbNo: data.data.run_number,
                                    fmxMilestoneStatus: "Failed Delivery due to No Such Person. Return to Warehouse",
                                    fmxMilestoneStatusCode: "NP, 44",
                                    latestReason: "No Such Person",
                                    lastUpdateDateTime: moment().format(),
                                    creationDate: data.data.created_at,
                                    jobDate: data.data.date,
                                    lastUpdatedBy: req.user.name,
                                });

                                mongoDBrun = 1;
                            } else {
                                update = {
                                    currentStatus: "Return to Warehouse",
                                    lastUpdateDateTime: moment().format(),
                                    instructions: "FMX Milestone ID NP, 44",
                                    assignedTo: "N/A",
                                    fmxMilestoneStatus: "Failed Delivery due to No Such Person. Return to Warehouse",
                                    fmxMilestoneStatusCode: "NP, 44",
                                    latestReason: "No Such Person",
                                    attempt: wmsAttempt,
                                    latestLocation: req.body.warehouse,
                                    lastUpdatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to,
                                    $push: {
                                        history: {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "No Such Person",
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

                                mongoDBrun = 2;
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "at_warehouse", // Use the calculated dStatus
                                    instructions: "FMX Milestone ID NP, 44. No Such Person.",
                                    job_type: "Delivery"
                                }
                            };

                            var detrackUpdateDataAttempt = {
                                data: {
                                    do_number: consignmentID,
                                }
                            };

                            DetrackAPIrun = 2;
                            fmxMilestoneCode = "NP"
                            appliedStatus = "Failed Delivery due to No Such Person. Return to Warehouse (FMX)"
                        }

                        if (data.data.reason == "Customer declined delivery") {
                            fmxUpdate = "FMX milestone updated to Failed Delivery. Shipment Refused by Consignee (RF) due to " + data.data.note + ". Return to Warehouse (44).";
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                            detrackReason = "Shipment Refused by Consignee due to " + data.data.note + ".";

                            if (existingOrder === null) {
                                newOrder = new ORDERS({
                                    area: data.data.zone,
                                    items: [{
                                        quantity: data.data.items[0].quantity,
                                        description: data.data.items[0].description,
                                        totalItemPrice: data.data.total_price
                                    }],
                                    attempt: wmsAttempt,
                                    history: [
                                        {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Shipment Refused by Consignee due to " + data.data.note,
                                            lastLocation: data.data.assign_to,
                                        },
                                        {
                                            statusHistory: "Return to Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: "N/A",
                                            reason: "N/A",
                                            lastLocation: req.body.warehouse,
                                        }
                                    ],
                                    lastAssignedTo: data.data.assign_to,
                                    latestLocation: req.body.warehouse,
                                    product: "fmx",
                                    assignedTo: "N/A",
                                    senderName: data.data.job_owner,
                                    totalPrice: data.data.total_price,
                                    deliveryType: "Delivery",
                                    parcelWeight: data.data.weight,
                                    receiverName: data.data.deliver_to_collect_from,
                                    trackingLink: data.data.tracking_link,
                                    currentStatus: "Return to Warehouse",
                                    paymentMethod: data.data.payment_mode,
                                    warehouseEntry: "Yes",
                                    warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                    receiverAddress: data.data.address,
                                    receiverPhoneNumber: data.data.phone_number,
                                    doTrackingNumber: consignmentID,
                                    remarks: data.data.remarks,
                                    cargoPrice: data.data.insurance_price,
                                    instructions: "FMX Milestone ID RF, 44",
                                    flightDate: data.data.job_received_date,
                                    mawbNo: data.data.run_number,
                                    fmxMilestoneStatus: "Failed Delivery. Shipment Refused by Consignee due to " + data.data.note + ". Return to Warehouse",
                                    fmxMilestoneStatusCode: "RF, 44",
                                    latestReason: "Shipment Refused by Consignee due to " + data.data.note,
                                    lastUpdateDateTime: moment().format(),
                                    creationDate: data.data.created_at,
                                    jobDate: data.data.date,
                                    lastUpdatedBy: req.user.name,
                                });

                                mongoDBrun = 1;
                            } else {
                                update = {
                                    currentStatus: "Return to Warehouse",
                                    lastUpdateDateTime: moment().format(),
                                    instructions: "FMX Milestone ID RF, 44",
                                    assignedTo: "N/A",
                                    fmxMilestoneStatus: "Failed Delivery. Shipment Refused by Consignee due to " + data.data.note + ". Return to Warehouse",
                                    fmxMilestoneStatusCode: "RF, 44",
                                    latestReason: "Shipment Refused by Consignee due to " + data.data.note,
                                    attempt: wmsAttempt,
                                    latestLocation: req.body.warehouse,
                                    lastUpdatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to,
                                    $push: {
                                        history: {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Shipment Refused by Consignee due to " + data.data.note,
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

                                mongoDBrun = 2;
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "at_warehouse", // Use the calculated dStatus
                                    instructions: "FMX Milestone ID RF, 44. Shipment Refused by Consignee due to " + data.data.note + ".",
                                    job_type: "Delivery"
                                }
                            };

                            var detrackUpdateDataAttempt = {
                                data: {
                                    do_number: consignmentID,
                                }
                            };

                            DetrackAPIrun = 2;
                            fmxMilestoneCode = "RF"
                            appliedStatus = "Failed Delivery due to Customer Declined Delivery / Shipment Refused by Consignee. Return to Warehouse (FMX)"
                        }

                        if (data.data.reason == "Unable to Locate Address") {
                            fmxUpdate = "FMX milestone updated to Failed Delivery due to Unable to Locate Receiver Address (UL). Return to Warehouse (44).";
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                            detrackReason = "Unable to Locate Address";

                            if (existingOrder === null) {
                                newOrder = new ORDERS({
                                    area: data.data.zone,
                                    items: [{
                                        quantity: data.data.items[0].quantity,
                                        description: data.data.items[0].description,
                                        totalItemPrice: data.data.total_price
                                    }],
                                    attempt: wmsAttempt,
                                    history: [
                                        {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Unable to Locate Address",
                                            lastLocation: data.data.assign_to,
                                        },
                                        {
                                            statusHistory: "Return to Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: "N/A",
                                            reason: "N/A",
                                            lastLocation: req.body.warehouse,
                                        }
                                    ],
                                    lastAssignedTo: data.data.assign_to,
                                    latestLocation: req.body.warehouse,
                                    product: "fmx",
                                    assignedTo: "N/A",
                                    senderName: data.data.job_owner,
                                    totalPrice: data.data.total_price,
                                    deliveryType: "Delivery",
                                    parcelWeight: data.data.weight,
                                    receiverName: data.data.deliver_to_collect_from,
                                    trackingLink: data.data.tracking_link,
                                    currentStatus: "Return to Warehouse",
                                    paymentMethod: data.data.payment_mode,
                                    warehouseEntry: "Yes",
                                    warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                    receiverAddress: data.data.address,
                                    receiverPhoneNumber: data.data.phone_number,
                                    doTrackingNumber: consignmentID,
                                    remarks: data.data.remarks,
                                    cargoPrice: data.data.insurance_price,
                                    instructions: "FMX Milestone ID UL, 44",
                                    flightDate: data.data.job_received_date,
                                    mawbNo: data.data.run_number,
                                    fmxMilestoneStatus: "Failed Delivery due to Unable to Locate Receiver Address. Return to Warehouse",
                                    fmxMilestoneStatusCode: "UL, 44",
                                    latestReason: "Unable to Locate Receiver Address",
                                    lastUpdateDateTime: moment().format(),
                                    creationDate: data.data.created_at,
                                    jobDate: data.data.date,
                                    lastUpdatedBy: req.user.name,
                                });

                                mongoDBrun = 1;
                            } else {
                                update = {
                                    currentStatus: "Return to Warehouse",
                                    lastUpdateDateTime: moment().format(),
                                    instructions: "FMX Milestone ID UL, 44",
                                    assignedTo: "N/A",
                                    fmxMilestoneStatus: "Failed Delivery due to Unable to Locate Receiver Address. Return to Warehouse",
                                    fmxMilestoneStatusCode: "UL, 44",
                                    latestReason: "Unable to Locate Receiver Address",
                                    attempt: wmsAttempt,
                                    latestLocation: req.body.warehouse,
                                    lastUpdatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to,
                                    $push: {
                                        history: {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Unable to Locate Receiver Address",
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

                                mongoDBrun = 2;
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "at_warehouse", // Use the calculated dStatus
                                    instructions: "FMX Milestone ID UL, 44. Unable to Locate Receiver Address.",
                                    job_type: "Delivery"
                                }
                            };

                            var detrackUpdateDataAttempt = {
                                data: {
                                    do_number: consignmentID,
                                }
                            };

                            DetrackAPIrun = 2;
                            fmxMilestoneCode = "UL"
                            appliedStatus = "Failed Delivery due to Unable to Locate Receiver Address. Return to Warehouse (FMX)"
                        }

                        if (data.data.reason == "Incorrect Address") {
                            fmxUpdate = "FMX milestone updated to Failed Delivery due to Incorrect Address (WA). Return to Warehouse (44).";
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                            detrackReason = "Incorrect Address";

                            if (existingOrder === null) {
                                newOrder = new ORDERS({
                                    area: data.data.zone,
                                    items: [{
                                        quantity: data.data.items[0].quantity,
                                        description: data.data.items[0].description,
                                        totalItemPrice: data.data.total_price
                                    }],
                                    attempt: wmsAttempt,
                                    history: [
                                        {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Incorrect Address",
                                            lastLocation: data.data.assign_to,
                                        },
                                        {
                                            statusHistory: "Return to Warehouse",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: "N/A",
                                            reason: "N/A",
                                            lastLocation: req.body.warehouse,
                                        }
                                    ],
                                    lastAssignedTo: data.data.assign_to,
                                    latestLocation: req.body.warehouse,
                                    product: "fmx",
                                    assignedTo: "N/A",
                                    senderName: data.data.job_owner,
                                    totalPrice: data.data.total_price,
                                    deliveryType: "Delivery",
                                    parcelWeight: data.data.weight,
                                    receiverName: data.data.deliver_to_collect_from,
                                    trackingLink: data.data.tracking_link,
                                    currentStatus: "Return to Warehouse",
                                    paymentMethod: data.data.payment_mode,
                                    warehouseEntry: "Yes",
                                    warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                    receiverAddress: data.data.address,
                                    receiverPhoneNumber: data.data.phone_number,
                                    doTrackingNumber: consignmentID,
                                    remarks: data.data.remarks,
                                    cargoPrice: data.data.insurance_price,
                                    instructions: "FMX Milestone ID WA, 44",
                                    flightDate: data.data.job_received_date,
                                    mawbNo: data.data.run_number,
                                    fmxMilestoneStatus: "Failed Delivery due to Incorrect Address. Return to Warehouse",
                                    fmxMilestoneStatusCode: "WA, 44",
                                    latestReason: "Incorrect Address",
                                    lastUpdateDateTime: moment().format(),
                                    creationDate: data.data.created_at,
                                    jobDate: data.data.date,
                                    lastUpdatedBy: req.user.name,
                                });

                                mongoDBrun = 1;
                            } else {
                                update = {
                                    currentStatus: "Return to Warehouse",
                                    lastUpdateDateTime: moment().format(),
                                    instructions: "FMX Milestone ID WA, 44",
                                    assignedTo: "N/A",
                                    fmxMilestoneStatus: "Failed Delivery due to Incorrect Address. Return to Warehouse",
                                    fmxMilestoneStatusCode: "WA, 44",
                                    latestReason: "Incorrect Address",
                                    attempt: wmsAttempt,
                                    latestLocation: req.body.warehouse,
                                    lastUpdatedBy: req.user.name,
                                    lastAssignedTo: data.data.assign_to,
                                    $push: {
                                        history: {
                                            statusHistory: "Failed Delivery",
                                            dateUpdated: moment().format(),
                                            updatedBy: req.user.name,
                                            lastAssignedTo: data.data.assign_to,
                                            reason: "Incorrect Address",
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

                                mongoDBrun = 2;
                            }

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "at_warehouse", // Use the calculated dStatus
                                    instructions: "FMX Milestone ID WA, 44. Incorrect Address.",
                                    job_type: "Delivery"
                                }
                            };

                            var detrackUpdateDataAttempt = {
                                data: {
                                    do_number: consignmentID,
                                }
                            };

                            DetrackAPIrun = 2;
                            fmxMilestoneCode = "WA"
                            appliedStatus = "Failed Delivery due to Unable to Incorrect Address. Return to Warehouse (FMX)"
                        }

                        FMXAPIrun = 3;
                        completeRun = 1;
                    }

                    if (data.data.status == 'completed') {
                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: [{
                                    quantity: data.data.items[0].quantity,
                                    description: data.data.items[0].description,
                                    totalItemPrice: data.data.total_price
                                }],
                                attempt: wmsAttempt,
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
                                product: "fmx",
                                assignedTo: data.data.assign_to,
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: data.data.type,
                                parcelWeight: data.data.weight,
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
                                cargoPrice: data.data.insurance_price,
                                instructions: "FMX Milestone ID 50.",
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                fmxMilestoneStatus: "Parcel Delivered",
                                fmxMilestoneStatusCode: "50",
                                latestReason: detrackReason,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: req.body.assignDate,
                                lastUpdatedBy: req.user.name,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                currentStatus: "Completed",
                                lastUpdateDateTime: moment().format(),
                                fmxMilestoneStatus: "Parcel Delivered",
                                fmxMilestoneStatusCode: "50",
                                instructions: "FMX Milestone ID 50.",
                                attempt: wmsAttempt,
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

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                instructions: "FMX Milestone ID 50"
                            }
                        };

                        fmxUpdate = "FMX milestone updated to Parcel Delivered. ";
                        portalUpdate = "Portal status updated to Completed. ";
                        fmxMilestoneCode = "50"
                        appliedStatus = "Failed Delivery, Return to Warehouse/Completed"

                        DetrackAPIrun = 1;
                        FMXAPIrun = 5;
                        completeRun = 1;

                        if (data.data.phone_number != null) {
                            waOrderCompletedFeedback = 1;
                        }
                    }
                }

                if ((req.body.statusCode == 'FJ') && (data.data.status == 'failed')) {
                    if (data.data.reason == "Unattempted Delivery") {
                        fmxUpdate = "FMX milestone updated to Failed Delivery due to Unattempted Delivery (MD). Return to Warehouse (44).";
                        portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        detrackReason = "Unattempted Delivery.";

                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: [{
                                    quantity: data.data.items[0].quantity,
                                    description: data.data.items[0].description,
                                    totalItemPrice: data.data.total_price
                                }],
                                attempt: wmsAttempt,
                                history: [
                                    {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Unattempted Delivery",
                                        lastLocation: data.data.assign_to,
                                    },
                                    {
                                        statusHistory: "Return to Warehouse",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: "N/A",
                                        reason: "N/A",
                                        lastLocation: req.body.warehouse,
                                    }
                                ],
                                lastAssignedTo: data.data.assign_to,
                                latestLocation: req.body.warehouse,
                                product: "fmx",
                                assignedTo: "N/A",
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: "Delivery",
                                parcelWeight: data.data.weight,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Return to Warehouse",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                cargoPrice: data.data.insurance_price,
                                instructions: "FMX Milestone ID MD, 44",
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                fmxMilestoneStatus: "Failed Delivery due to Unattempted Delivery. Return to Warehouse",
                                fmxMilestoneStatusCode: "MD, 44",
                                latestReason: "Unattempted Delivery",
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: data.data.date,
                                lastUpdatedBy: req.user.name,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                currentStatus: "Return to Warehouse",
                                lastUpdateDateTime: moment().format(),
                                instructions: "FMX Milestone ID MD, 44",
                                assignedTo: "N/A",
                                fmxMilestoneStatus: "Failed Delivery due to Unattempted Delivery. Return to Warehouse",
                                fmxMilestoneStatusCode: "MD, 44",
                                latestReason: "Unattempted Delivery",
                                attempt: wmsAttempt,
                                latestLocation: req.body.warehouse,
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: data.data.assign_to,
                                $push: {
                                    history: {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Unattempted Delivery",
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

                            mongoDBrun = 2;
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "at_warehouse", // Use the calculated dStatus
                                instructions: "FMX Milestone ID MD, 44. Unattempted Delivery.",
                                job_type: "Delivery"
                            }
                        };

                        DetrackAPIrun = 1;
                        fmxMilestoneCode = "MD"
                        appliedStatus = "Failed Delivery due to Unattempted Delivery. Return to Warehouse (FMX)"
                    }

                    if (data.data.reason == "Reschedule delivery requested by customer") {
                        fmxUpdate = "FMX milestone updated to Failed Delivery. Reschedule Delivery Requested By Customer (FD) to " + data.data.note + ". Return to Warehouse (44).";
                        portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        detrackReason = "Reschedule Delivery Requested By Customer to " + data.data.note + ".";

                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: [{
                                    quantity: data.data.items[0].quantity,
                                    description: data.data.items[0].description,
                                    totalItemPrice: data.data.total_price
                                }],
                                attempt: wmsAttempt,
                                history: [
                                    {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Reschedule Delivery Requested By Customer to " + data.data.note,
                                        lastLocation: data.data.assign_to,
                                    },
                                    {
                                        statusHistory: "Return to Warehouse",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: "N/A",
                                        reason: "N/A",
                                        lastLocation: req.body.warehouse,
                                    }
                                ],
                                lastAssignedTo: data.data.assign_to,
                                latestLocation: req.body.warehouse,
                                product: "fmx",
                                assignedTo: "N/A",
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: "Delivery",
                                parcelWeight: data.data.weight,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Return to Warehouse",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                cargoPrice: data.data.insurance_price,
                                instructions: "FMX Milestone ID RF, 44",
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                fmxMilestoneStatus: "Failed Delivery. Reschedule Delivery Requested By Customer to " + data.data.note + ". Return to Warehouse.",
                                fmxMilestoneStatusCode: "FD, 44",
                                latestReason: "Reschedule Delivery Requested By Customer to " + data.data.note,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: data.data.date,
                                lastUpdatedBy: req.user.name,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                currentStatus: "Return to Warehouse",
                                lastUpdateDateTime: moment().format(),
                                instructions: "FMX Milestone ID FD, 44",
                                assignedTo: "N/A",
                                fmxMilestoneStatus: "Failed Delivery. Reschedule Delivery Requested By Customer to " + data.data.note + ". Return to Warehouse.",
                                fmxMilestoneStatusCode: "FD, 44",
                                latestReason: "Reschedule Delivery Requested By Customer to " + data.data.note,
                                attempt: wmsAttempt,
                                latestLocation: req.body.warehouse,
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: data.data.assign_to,
                                $push: {
                                    history: {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Reschedule Delivery Requested By Customer to " + data.data.note,
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

                            mongoDBrun = 2;
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "at_warehouse", // Use the calculated dStatus
                                instructions: "FMX Milestone ID FD, 44. Customer Declined Delivery due to " + data.data.note,
                                job_type: "Delivery"
                            }
                        };

                        var detrackUpdateDataAttempt = {
                            data: {
                                do_number: consignmentID,
                            }
                        };

                        DetrackAPIrun = 2;
                        fmxMilestoneCode = "FD"
                        appliedStatus = "Failed Delivery due to Reschedule Delivery Requested By Customer. Return to Warehouse (FMX)"
                    }

                    if (data.data.reason == "Reschedule to self collect requested by customer") {
                        fmxUpdate = "FMX milestone updated to Failed Delivery. Reschedule to Self Collect Requested By Customer (SC) to " + data.data.note + ". Return to Warehouse (44).";
                        portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        detrackReason = "Reschedule to Self Collect Requested By Customer to " + data.data.note + ".";

                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: [{
                                    quantity: data.data.items[0].quantity,
                                    description: data.data.items[0].description,
                                    totalItemPrice: data.data.total_price
                                }],
                                attempt: wmsAttempt,
                                history: [
                                    {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Reschedule to Self Collect Requested By Customer to " + data.data.note,
                                        lastLocation: data.data.assign_to,
                                    },
                                    {
                                        statusHistory: "Return to Warehouse",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: "N/A",
                                        reason: "N/A",
                                        lastLocation: req.body.warehouse,
                                    }
                                ],
                                lastAssignedTo: data.data.assign_to,
                                latestLocation: req.body.warehouse,
                                product: "fmx",
                                assignedTo: "N/A",
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: "Delivery",
                                parcelWeight: data.data.weight,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Return to Warehouse",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                cargoPrice: data.data.insurance_price,
                                instructions: "FMX Milestone ID SC, 44",
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                fmxMilestoneStatus: "Failed Delivery. Reschedule to Self Collect Requested By Customer to " + data.data.note + ". Return to Warehouse",
                                fmxMilestoneStatusCode: "SC, 44",
                                latestReason: "Reschedule to Self Collect Requested By Customer to " + data.data.note,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: data.data.date,
                                lastUpdatedBy: req.user.name,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                currentStatus: "Return to Warehouse",
                                lastUpdateDateTime: moment().format(),
                                instructions: "FMX Milestone ID SC, 44",
                                assignedTo: "N/A",
                                fmxMilestoneStatus: "Failed Delivery. Reschedule to Self Collect Requested By Customer to " + data.data.note + ". Return to Warehouse",
                                fmxMilestoneStatusCode: "SC, 44",
                                latestReason: "Reschedule to Self Collect Requested By Customer to " + data.data.note,
                                attempt: wmsAttempt,
                                latestLocation: req.body.warehouse,
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: data.data.assign_to,
                                $push: {
                                    history: {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Reschedule to Self Collect Requested By Customer to " + data.data.note,
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

                            mongoDBrun = 2;
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "at_warehouse", // Use the calculated dStatus
                                instructions: "FMX Milestone ID SC, 44. Reschedule to Self Collect Requested By Customer to " + data.data.note,
                                job_type: "Delivery"
                            }
                        };

                        var detrackUpdateDataAttempt = {
                            data: {
                                do_number: consignmentID,
                            }
                        };

                        DetrackAPIrun = 2;
                        fmxMilestoneCode = "SC"
                        appliedStatus = "Failed Delivery due to Reschedule to Self Collect Requested By Customer. Return to Warehouse (FMX)"
                    }

                    if (data.data.reason == "Cash/Duty Not Ready") {
                        fmxUpdate = "FMX milestone updated to Failed Delivery due to Cash/Duty Not Ready (DU). Return to Warehouse (44).";
                        portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        detrackReason = "Cash/Duty Not Ready.";

                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: [{
                                    quantity: data.data.items[0].quantity,
                                    description: data.data.items[0].description,
                                    totalItemPrice: data.data.total_price
                                }],
                                attempt: wmsAttempt,
                                history: [
                                    {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Cash/Duty Not Ready",
                                        lastLocation: data.data.assign_to,
                                    },
                                    {
                                        statusHistory: "Return to Warehouse",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: "N/A",
                                        reason: "N/A",
                                        lastLocation: req.body.warehouse,
                                    }
                                ],
                                lastAssignedTo: data.data.assign_to,
                                latestLocation: req.body.warehouse,
                                product: "fmx",
                                assignedTo: "N/A",
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: "Delivery",
                                parcelWeight: data.data.weight,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Return to Warehouse",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                cargoPrice: data.data.insurance_price,
                                instructions: "FMX Milestone ID DU, 44",
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                fmxMilestoneStatus: "Failed Delivery due to Cash/Duty Not Ready. Return to Warehouse",
                                fmxMilestoneStatusCode: "DU, 44",
                                latestReason: "Cash/Duty Not Ready",
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: data.data.date,
                                lastUpdatedBy: req.user.name,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                currentStatus: "Return to Warehouse",
                                lastUpdateDateTime: moment().format(),
                                instructions: "FMX Milestone ID DU, 44",
                                assignedTo: "N/A",
                                fmxMilestoneStatus: "Failed Delivery due to Cash/Duty Not Ready. Return to Warehouse",
                                fmxMilestoneStatusCode: "DU, 44",
                                latestReason: "Cash/Duty Not Ready",
                                attempt: wmsAttempt,
                                latestLocation: req.body.warehouse,
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: data.data.assign_to,
                                $push: {
                                    history: {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Cash/Duty Not Ready",
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

                            mongoDBrun = 2;
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "at_warehouse", // Use the calculated dStatus
                                instructions: "FMX Milestone ID DU, 44. Cash/Duty Not Ready.",
                                job_type: "Delivery"
                            }
                        };

                        var detrackUpdateDataAttempt = {
                            data: {
                                do_number: consignmentID,
                            }
                        };

                        DetrackAPIrun = 2;
                        fmxMilestoneCode = "DU"
                        appliedStatus = "Failed Delivery due to Cash/Duty Not Ready. Return to Warehouse (FMX)"
                    }

                    if (data.data.reason == "Customer not available / cannot be contacted") {
                        fmxUpdate = "FMX milestone updated to Failed Delivery due to Consignee Not In, Business Closed/Customer not pickup phone (NA). Return to Warehouse (44).";
                        portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        detrackReason = "Consignee Not In, Business Closed/Customer not pickup phone.";

                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: [{
                                    quantity: data.data.items[0].quantity,
                                    description: data.data.items[0].description,
                                    totalItemPrice: data.data.total_price
                                }],
                                attempt: wmsAttempt,
                                history: [
                                    {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Customer not available / cannot be contacted",
                                        lastLocation: data.data.assign_to,
                                    },
                                    {
                                        statusHistory: "Return to Warehouse",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: "N/A",
                                        reason: "N/A",
                                        lastLocation: req.body.warehouse,
                                    }
                                ],
                                lastAssignedTo: data.data.assign_to,
                                latestLocation: req.body.warehouse,
                                product: "fmx",
                                assignedTo: "N/A",
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: "Delivery",
                                parcelWeight: data.data.weight,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Return to Warehouse",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                cargoPrice: data.data.insurance_price,
                                instructions: "FMX Milestone ID NA, 44",
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                fmxMilestoneStatus: "Failed Delivery due to Consignee Not In, Business Closed/Customer not pickup phone. Return to Warehouse",
                                fmxMilestoneStatusCode: "NA, 44",
                                latestReason: "Customer not available / cannot be contacted",
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: data.data.date,
                                lastUpdatedBy: req.user.name,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                currentStatus: "Return to Warehouse",
                                lastUpdateDateTime: moment().format(),
                                instructions: "FMX Milestone ID NA, 44",
                                assignedTo: "N/A",
                                fmxMilestoneStatus: "Failed Delivery due to Consignee Not In, Business Closed/Customer not pickup phone. Return to Warehouse",
                                fmxMilestoneStatusCode: "NA, 44",
                                latestReason: "Customer not available / cannot be contacted",
                                attempt: wmsAttempt,
                                latestLocation: req.body.warehouse,
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: data.data.assign_to,
                                $push: {
                                    history: {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Customer not available / cannot be contacted",
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

                            mongoDBrun = 2;
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "at_warehouse", // Use the calculated dStatus
                                instructions: "FMX Milestone ID NA, 44. Customer not available / cannot be contacted.",
                                job_type: "Delivery"
                            }
                        };

                        var detrackUpdateDataAttempt = {
                            data: {
                                do_number: consignmentID,
                            }
                        };

                        DetrackAPIrun = 2;
                        fmxMilestoneCode = "NA"
                        appliedStatus = "Failed Delivery due to Customer not available / cannot be contacted. Return to Warehouse (FMX)"
                    }

                    if (data.data.reason == "No Such Person") {
                        fmxUpdate = "FMX milestone updated to Failed Delivery due to No Such Person (NP). Return to Warehouse (44).";
                        portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        detrackReason = "No Such Person.";

                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: [{
                                    quantity: data.data.items[0].quantity,
                                    description: data.data.items[0].description,
                                    totalItemPrice: data.data.total_price
                                }],
                                attempt: wmsAttempt,
                                history: [
                                    {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "No Such Person",
                                        lastLocation: data.data.assign_to,
                                    },
                                    {
                                        statusHistory: "Return to Warehouse",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: "N/A",
                                        reason: "N/A",
                                        lastLocation: req.body.warehouse,
                                    }
                                ],
                                lastAssignedTo: data.data.assign_to,
                                latestLocation: req.body.warehouse,
                                product: "fmx",
                                assignedTo: "N/A",
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: "Delivery",
                                parcelWeight: data.data.weight,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Return to Warehouse",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                cargoPrice: data.data.insurance_price,
                                instructions: "FMX Milestone ID NP, 44",
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                fmxMilestoneStatus: "Failed Delivery due to No Such Person. Return to Warehouse",
                                fmxMilestoneStatusCode: "NP, 44",
                                latestReason: "No Such Person",
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: data.data.date,
                                lastUpdatedBy: req.user.name,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                currentStatus: "Return to Warehouse",
                                lastUpdateDateTime: moment().format(),
                                instructions: "FMX Milestone ID NP, 44",
                                assignedTo: "N/A",
                                fmxMilestoneStatus: "Failed Delivery due to No Such Person. Return to Warehouse",
                                fmxMilestoneStatusCode: "NP, 44",
                                latestReason: "No Such Person",
                                attempt: wmsAttempt,
                                latestLocation: req.body.warehouse,
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: data.data.assign_to,
                                $push: {
                                    history: {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "No Such Person",
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

                            mongoDBrun = 2;
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "at_warehouse", // Use the calculated dStatus
                                instructions: "FMX Milestone ID NP, 44. No Such Person.",
                                job_type: "Delivery"
                            }
                        };

                        var detrackUpdateDataAttempt = {
                            data: {
                                do_number: consignmentID,
                            }
                        };

                        DetrackAPIrun = 2;
                        fmxMilestoneCode = "NP"
                        appliedStatus = "Failed Delivery due to No Such Person. Return to Warehouse (FMX)"
                    }

                    if (data.data.reason == "Customer declined delivery") {
                        fmxUpdate = "FMX milestone updated to Failed Delivery. Shipment Refused by Consignee (RF) due to " + data.data.note + ". Return to Warehouse (44).";
                        portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        detrackReason = "Shipment Refused by Consignee due to " + data.data.note + ".";

                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: [{
                                    quantity: data.data.items[0].quantity,
                                    description: data.data.items[0].description,
                                    totalItemPrice: data.data.total_price
                                }],
                                attempt: wmsAttempt,
                                history: [
                                    {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Shipment Refused by Consignee due to " + data.data.note,
                                        lastLocation: data.data.assign_to,
                                    },
                                    {
                                        statusHistory: "Return to Warehouse",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: "N/A",
                                        reason: "N/A",
                                        lastLocation: req.body.warehouse,
                                    }
                                ],
                                lastAssignedTo: data.data.assign_to,
                                latestLocation: req.body.warehouse,
                                product: "fmx",
                                assignedTo: "N/A",
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: "Delivery",
                                parcelWeight: data.data.weight,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Return to Warehouse",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                cargoPrice: data.data.insurance_price,
                                instructions: "FMX Milestone ID RF, 44",
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                fmxMilestoneStatus: "Failed Delivery. Shipment Refused by Consignee due to " + data.data.note + ". Return to Warehouse",
                                fmxMilestoneStatusCode: "RF, 44",
                                latestReason: "Shipment Refused by Consignee due to " + data.data.note,
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: data.data.date,
                                lastUpdatedBy: req.user.name,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                currentStatus: "Return to Warehouse",
                                lastUpdateDateTime: moment().format(),
                                instructions: "FMX Milestone ID RF, 44",
                                assignedTo: "N/A",
                                fmxMilestoneStatus: "Failed Delivery. Shipment Refused by Consignee due to " + data.data.note + ". Return to Warehouse",
                                fmxMilestoneStatusCode: "RF, 44",
                                latestReason: "Shipment Refused by Consignee due to " + data.data.note,
                                attempt: wmsAttempt,
                                latestLocation: req.body.warehouse,
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: data.data.assign_to,
                                $push: {
                                    history: {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Shipment Refused by Consignee due to " + data.data.note,
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

                            mongoDBrun = 2;
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "at_warehouse", // Use the calculated dStatus
                                instructions: "FMX Milestone ID RF, 44. Shipment Refused by Consignee due to " + data.data.note + ".",
                                job_type: "Delivery"
                            }
                        };

                        var detrackUpdateDataAttempt = {
                            data: {
                                do_number: consignmentID,
                            }
                        };

                        DetrackAPIrun = 2;
                        fmxMilestoneCode = "RF"
                        appliedStatus = "Failed Delivery due to Customer Declined Delivery / Shipment Refused by Consignee. Return to Warehouse (FMX)"
                    }

                    if (data.data.reason == "Unable to Locate Address") {
                        fmxUpdate = "FMX milestone updated to Failed Delivery due to Unable to Locate Receiver Address (UL). Return to Warehouse (44).";
                        portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        detrackReason = "Unable to Locate Address";

                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: [{
                                    quantity: data.data.items[0].quantity,
                                    description: data.data.items[0].description,
                                    totalItemPrice: data.data.total_price
                                }],
                                attempt: wmsAttempt,
                                history: [
                                    {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Unable to Locate Address",
                                        lastLocation: data.data.assign_to,
                                    },
                                    {
                                        statusHistory: "Return to Warehouse",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: "N/A",
                                        reason: "N/A",
                                        lastLocation: req.body.warehouse,
                                    }
                                ],
                                lastAssignedTo: data.data.assign_to,
                                latestLocation: req.body.warehouse,
                                product: "fmx",
                                assignedTo: "N/A",
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: "Delivery",
                                parcelWeight: data.data.weight,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Return to Warehouse",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                cargoPrice: data.data.insurance_price,
                                instructions: "FMX Milestone ID UL, 44",
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                fmxMilestoneStatus: "Failed Delivery due to Unable to Locate Receiver Address. Return to Warehouse",
                                fmxMilestoneStatusCode: "UL, 44",
                                latestReason: "Unable to Locate Receiver Address",
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: data.data.date,
                                lastUpdatedBy: req.user.name,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                currentStatus: "Return to Warehouse",
                                lastUpdateDateTime: moment().format(),
                                instructions: "FMX Milestone ID UL, 44",
                                assignedTo: "N/A",
                                fmxMilestoneStatus: "Failed Delivery due to Unable to Locate Receiver Address. Return to Warehouse",
                                fmxMilestoneStatusCode: "UL, 44",
                                latestReason: "Unable to Locate Receiver Address",
                                attempt: wmsAttempt,
                                latestLocation: req.body.warehouse,
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: data.data.assign_to,
                                $push: {
                                    history: {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Unable to Locate Receiver Address",
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

                            mongoDBrun = 2;
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "at_warehouse", // Use the calculated dStatus
                                instructions: "FMX Milestone ID UL, 44. Unable to Locate Receiver Address.",
                                job_type: "Delivery"
                            }
                        };

                        var detrackUpdateDataAttempt = {
                            data: {
                                do_number: consignmentID,
                            }
                        };

                        DetrackAPIrun = 2;
                        fmxMilestoneCode = "UL"
                        appliedStatus = "Failed Delivery due to Unable to Locate Receiver Address. Return to Warehouse (FMX)"
                    }

                    if (data.data.reason == "Incorrect Address") {
                        fmxUpdate = "FMX milestone updated to Failed Delivery due to Incorrect Address (WA). Return to Warehouse (44).";
                        portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        detrackReason = "Incorrect Address";

                        if (existingOrder === null) {
                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: [{
                                    quantity: data.data.items[0].quantity,
                                    description: data.data.items[0].description,
                                    totalItemPrice: data.data.total_price
                                }],
                                attempt: wmsAttempt,
                                history: [
                                    {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Incorrect Address",
                                        lastLocation: data.data.assign_to,
                                    },
                                    {
                                        statusHistory: "Return to Warehouse",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: "N/A",
                                        reason: "N/A",
                                        lastLocation: req.body.warehouse,
                                    }
                                ],
                                lastAssignedTo: data.data.assign_to,
                                latestLocation: req.body.warehouse,
                                product: "fmx",
                                assignedTo: "N/A",
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: "Delivery",
                                parcelWeight: data.data.weight,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "Return to Warehouse",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: warehouseEntryCheckDateTime,
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: consignmentID,
                                remarks: data.data.remarks,
                                cargoPrice: data.data.insurance_price,
                                instructions: "FMX Milestone ID WA, 44",
                                flightDate: data.data.job_received_date,
                                mawbNo: data.data.run_number,
                                fmxMilestoneStatus: "Failed Delivery due to Incorrect Address. Return to Warehouse",
                                fmxMilestoneStatusCode: "WA, 44",
                                latestReason: "Incorrect Address",
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: data.data.date,
                                lastUpdatedBy: req.user.name,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                currentStatus: "Return to Warehouse",
                                lastUpdateDateTime: moment().format(),
                                instructions: "FMX Milestone ID WA, 44",
                                assignedTo: "N/A",
                                fmxMilestoneStatus: "Failed Delivery due to Incorrect Address. Return to Warehouse",
                                fmxMilestoneStatusCode: "WA, 44",
                                latestReason: "Incorrect Address",
                                attempt: wmsAttempt,
                                latestLocation: req.body.warehouse,
                                lastUpdatedBy: req.user.name,
                                lastAssignedTo: data.data.assign_to,
                                $push: {
                                    history: {
                                        statusHistory: "Failed Delivery",
                                        dateUpdated: moment().format(),
                                        updatedBy: req.user.name,
                                        lastAssignedTo: data.data.assign_to,
                                        reason: "Incorrect Address",
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

                            mongoDBrun = 2;
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "at_warehouse", // Use the calculated dStatus
                                instructions: "FMX Milestone ID WA, 44. Incorrect Address.",
                                job_type: "Delivery"
                            }
                        };

                        var detrackUpdateDataAttempt = {
                            data: {
                                do_number: consignmentID,
                            }
                        };

                        DetrackAPIrun = 2;
                        fmxMilestoneCode = "WA"
                        appliedStatus = "Failed Delivery due to Unable to Incorrect Address. Return to Warehouse (FMX)"
                    }

                    FMXAPIrun = 3;
                    completeRun = 1;
                }

                if ((req.body.statusCode == 'SJ') && (data.data.status == 'completed')) {
                    if (existingOrder === null) {
                        newOrder = new ORDERS({
                            area: data.data.zone,
                            items: [{
                                quantity: data.data.items[0].quantity,
                                description: data.data.items[0].description,
                                totalItemPrice: data.data.total_price
                            }],
                            attempt: wmsAttempt,
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
                            product: "fmx",
                            assignedTo: data.data.assign_to,
                            senderName: data.data.job_owner,
                            totalPrice: data.data.total_price,
                            deliveryType: data.data.type,
                            parcelWeight: data.data.weight,
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
                            cargoPrice: data.data.insurance_price,
                            instructions: "FMX Milestone ID 50.",
                            flightDate: data.data.job_received_date,
                            mawbNo: data.data.run_number,
                            fmxMilestoneStatus: "Parcel Delivered",
                            fmxMilestoneStatusCode: "50",
                            latestReason: detrackReason,
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            jobDate: req.body.assignDate,
                            lastUpdatedBy: req.user.name,
                        });

                        mongoDBrun = 1;
                    } else {
                        update = {
                            currentStatus: "Completed",
                            lastUpdateDateTime: moment().format(),
                            fmxMilestoneStatus: "Parcel Delivered",
                            fmxMilestoneStatusCode: "50",
                            instructions: "FMX Milestone ID 50.",
                            attempt: wmsAttempt,
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

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            instructions: "FMX Milestone ID 50"
                        }
                    };

                    fmxUpdate = "FMX milestone updated to Parcel Delivered. ";
                    portalUpdate = "Portal status updated to Completed. ";
                    fmxMilestoneCode = "50"
                    appliedStatus = "Completed"

                    DetrackAPIrun = 1;
                    FMXAPIrun = 5;
                    completeRun = 1;

                    if (data.data.phone_number != null) {
                        waOrderCompletedFeedback = 1;
                    }
                }


                if ((req.body.statusCode == 'CSSC') && (data.data.status == 'at_warehouse')) {
                    if (existingOrder === null) {
                        newOrder = new ORDERS({
                            area: data.data.zone,
                            items: [{
                                quantity: data.data.items[0].quantity,
                                description: data.data.items[0].description,
                                totalItemPrice: data.data.total_price
                            }],
                            attempt: wmsAttempt,
                            history: [{
                                statusHistory: "Self Collect",
                                dateUpdated: moment().format(),
                                updatedBy: req.user.name,
                                lastAssignedTo: "Selfcollect",
                                reason: "N/A",
                                lastLocation: "Go Rush Office",
                            }],
                            lastAssignedTo: "Selfcollect",
                            latestLocation: "Go Rush Office",
                            product: "fmx",
                            assignedTo: "Selfcollect",
                            senderName: data.data.job_owner,
                            totalPrice: data.data.total_price,
                            deliveryType: "Pickup",
                            parcelWeight: data.data.weight,
                            receiverName: data.data.deliver_to_collect_from,
                            trackingLink: data.data.tracking_link,
                            currentStatus: "Self Collect",
                            paymentMethod: data.data.payment_mode,
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: warehouseEntryCheckDateTime,
                            receiverAddress: data.data.address,
                            receiverPhoneNumber: data.data.phone_number,
                            doTrackingNumber: consignmentID,
                            remarks: data.data.remarks,
                            cargoPrice: data.data.insurance_price,
                            instructions: "Assigned for Self Collect.",
                            flightDate: data.data.job_received_date,
                            mawbNo: data.data.run_number,
                            fmxMilestoneStatus: "At Warehouse/Return to Warehouse",
                            fmxMilestoneStatusCode: "12/44",
                            latestReason: detrackReason,
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            jobDate: req.body.assignDate,
                            lastUpdatedBy: req.user.name,
                        });

                        mongoDBrun = 1;
                    } else {
                        update = {
                            currentStatus: "Self Collect",
                            lastUpdateDateTime: moment().format(),
                            instructions: "Assigned for Self Collect.",
                            assignedTo: "Selfcollect",
                            attempt: wmsAttempt,
                            jobDate: req.body.assignDate,
                            latestLocation: "Go Rush Office",
                            lastUpdatedBy: req.user.name,
                            lastAssignedTo: "Selfcollect",
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

                        mongoDBrun = 2;
                    }

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            date: req.body.assignDate, // Get the Assign Date from the form
                            assign_to: "Selfcollect", // Get the selected dispatcher from the form
                            status: "dispatched",
                            job_type: "Pickup"
                        }
                    };

                    portalUpdate = "Portal and Detrack status updated for Self Collect. ";
                    appliedStatus = "Self Collect"

                    DetrackAPIrun = 1;
                    completeRun = 1;
                }

                if ((req.body.statusCode == 'CD') && (data.data.status != 'completed')) {
                    detrackReason = "Cancelled";

                    portalUpdate = "Portal and Detrack status updated to Cancelled. ";
                    fmxUpdate = "FMX milestone updated to Customer Declined Delivery (RF). Reason: Cancelled";

                    if (existingOrder === null) {
                        newOrder = new ORDERS({
                            area: data.data.zone,
                            items: [{
                                quantity: data.data.items[0].quantity,
                                description: data.data.items[0].description,
                                totalItemPrice: data.data.total_price
                            }],
                            attempt: wmsAttempt,
                            history: [
                                {
                                    statusHistory: "Cancelled",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: "N/A",
                                    reason: "N/A",
                                    lastLocation: req.body.warehouse,
                                }
                            ],
                            lastAssignedTo: "N/A",
                            latestLocation: req.body.warehouse,
                            product: "fmx",
                            assignedTo: "N/A",
                            senderName: data.data.job_owner,
                            totalPrice: data.data.total_price,
                            deliveryType: data.data.job_type,
                            parcelWeight: data.data.weight,
                            receiverName: data.data.deliver_to_collect_from,
                            trackingLink: data.data.tracking_link,
                            currentStatus: "Cancelled",
                            paymentMethod: data.data.payment_mode,
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: warehouseEntryCheckDateTime,
                            receiverAddress: data.data.address,
                            receiverPhoneNumber: data.data.phone_number,
                            doTrackingNumber: consignmentID,
                            remarks: data.data.remarks,
                            cargoPrice: data.data.insurance_price,
                            instructions: "FMX Milestone ID RF.",
                            flightDate: data.data.job_received_date,
                            mawbNo: data.data.run_number,
                            fmxMilestoneStatus: "Customer Declined Delivery (RF). Reason: Cancelled",
                            fmxMilestoneStatusCode: "RF",
                            latestReason: detrackReason,
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            jobDate: data.data.date,
                            lastUpdatedBy: req.user.name,
                        });

                        mongoDBrun = 1;
                    } else {
                        update = {
                            currentStatus: "Cancelled",
                            lastUpdateDateTime: moment().format(),
                            instructions: "FMX Milestone ID RF.",
                            assignedTo: "N/A",
                            fmxMilestoneStatus: "Customer Declined Delivery (RF). Reason: Cancelled",
                            fmxMilestoneStatusCode: "RF",
                            latestReason: detrackReason,
                            attempt: wmsAttempt,
                            latestLocation: req.body.warehouse,
                            lastUpdatedBy: req.user.name,
                            lastAssignedTo: "N/A",
                            $push: {
                                history: {
                                    statusHistory: "Cancelled",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: "N/A",
                                    reason: detrackReason,
                                    lastLocation: req.body.warehouse,
                                }
                            }
                        }

                        mongoDBrun = 2;
                    }

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "cancelled",
                            instructions: "FMX Milestone ID RF. Cancelled Delivery "
                        }
                    };

                    fmxMilestoneCode = "RF"
                    appliedStatus = "Cancelled"

                    DetrackAPIrun = 1;
                    FMXAPIrun = 2;
                    completeRun = 1;
                }

                if ((req.body.statusCode == 'AJ') && (data.data.status == 'cancelled')) {
                    portalUpdate = "Portal and Detrack status updated to Return to Warehouse from Cancelled. ";
                    fmxUpdate = "FMX milestone updated to Return to Warehouse (44).";

                    if (existingOrder === null) {
                        newOrder = new ORDERS({
                            area: data.data.zone,
                            items: [{
                                quantity: data.data.items[0].quantity,
                                description: data.data.items[0].description,
                                totalItemPrice: data.data.total_price
                            }],
                            attempt: wmsAttempt,
                            history: [
                                {
                                    statusHistory: "Return to Warehouse",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: "N/A",
                                    reason: "N/A",
                                    lastLocation: req.body.warehouse,
                                }
                            ],
                            lastAssignedTo: "N/A",
                            latestLocation: req.body.warehouse,
                            product: "fmx",
                            assignedTo: "N/A",
                            senderName: data.data.job_owner,
                            totalPrice: data.data.total_price,
                            deliveryType: data.data.job_type,
                            parcelWeight: data.data.weight,
                            receiverName: data.data.deliver_to_collect_from,
                            trackingLink: data.data.tracking_link,
                            currentStatus: "Return to Warehouse",
                            paymentMethod: data.data.payment_mode,
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: warehouseEntryCheckDateTime,
                            receiverAddress: data.data.address,
                            receiverPhoneNumber: data.data.phone_number,
                            doTrackingNumber: consignmentID,
                            remarks: data.data.remarks,
                            cargoPrice: data.data.insurance_price,
                            instructions: "FMX Milestone ID 44. Return to Warehouse from Cancelled.",
                            flightDate: data.data.job_received_date,
                            mawbNo: data.data.run_number,
                            fmxMilestoneStatus: "Return to Warehouse (44).",
                            fmxMilestoneStatusCode: "44",
                            latestReason: detrackReason,
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            jobDate: data.data.date,
                            lastUpdatedBy: req.user.name,
                        });

                        mongoDBrun = 1;
                    } else {
                        update = {
                            currentStatus: "Return to Warehouse",
                            lastUpdateDateTime: moment().format(),
                            instructions: "FMX Milestone ID 44. Return to Warehouse from Cancelled.",
                            assignedTo: "N/A",
                            fmxMilestoneStatus: "Return to Warehouse (44).",
                            fmxMilestoneStatusCode: "44",
                            latestReason: detrackReason,
                            attempt: wmsAttempt,
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

                        mongoDBrun = 2;
                    }

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse",
                            instructions: "FMX Milestone ID 44. Return to Warehouse from Cancelled."
                        }
                    };

                    fmxMilestoneCode = "44"
                    appliedStatus = "Return to Warehouse from Cancelled"

                    DetrackAPIrun = 1;
                    FMXAPIrun = 2;
                    completeRun = 1;
                }

                if ((req.body.statusCode == 47) && (data.data.status == 'cancelled')) {
                    portalUpdate = "Portal and Detrack status updated to Disposed. ";
                    fmxUpdate = "FMX milestone updated to Shipment Destroyed (47).";

                    if (existingOrder === null) {
                        newOrder = new ORDERS({
                            area: data.data.zone,
                            items: [{
                                quantity: data.data.items[0].quantity,
                                description: data.data.items[0].description,
                                totalItemPrice: data.data.total_price,
                            }],
                            attempt: wmsAttempt,
                            history: [
                                {
                                    statusHistory: "Disposed",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: "N/A",
                                    reason: "N/A",
                                    lastLocation: req.body.warehouse,
                                }
                            ],
                            lastAssignedTo: "N/A",
                            latestLocation: req.body.warehouse,
                            product: "fmx",
                            assignedTo: "N/A",
                            senderName: data.data.job_owner,
                            totalPrice: data.data.total_price,
                            deliveryType: data.data.job_type,
                            parcelWeight: data.data.weight,
                            receiverName: data.data.deliver_to_collect_from,
                            trackingLink: data.data.tracking_link,
                            currentStatus: "Disposed",
                            paymentMethod: data.data.payment_mode,
                            warehouseEntry: "Yes",
                            warehouseEntryDateTime: warehouseEntryCheckDateTime,
                            receiverAddress: data.data.address,
                            receiverPhoneNumber: data.data.phone_number,
                            doTrackingNumber: consignmentID,
                            remarks: data.data.remarks,
                            cargoPrice: data.data.insurance_price,
                            instructions: "FMX Milestone ID 47.",
                            flightDate: data.data.job_received_date,
                            mawbNo: data.data.run_number,
                            fmxMilestoneStatus: "Shipment Destroyed (47).",
                            fmxMilestoneStatusCode: "47",
                            latestReason: detrackReason,
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            jobDate: data.data.date,
                            lastUpdatedBy: req.user.name,
                        });

                        mongoDBrun = 1;
                    } else {
                        update = {
                            currentStatus: "Disposed",
                            lastUpdateDateTime: moment().format(),
                            instructions: "FMX Milestone ID 47.",
                            assignedTo: "N/A",
                            fmxMilestoneStatus: "Shipment Destroyed (47).",
                            fmxMilestoneStatusCode: "RF",
                            latestReason: detrackReason,
                            attempt: wmsAttempt,
                            latestLocation: req.body.warehouse,
                            lastUpdatedBy: req.user.name,
                            lastAssignedTo: "N/A",
                            $push: {
                                history: {
                                    statusHistory: "Disposed",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: "N/A",
                                    reason: detrackReason,
                                    lastLocation: req.body.warehouse,
                                }
                            }
                        }

                        mongoDBrun = 2;
                    }

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            instructions: "FMX Milestone ID 47. Shipment Destroyed"
                        }
                    };

                    fmxMilestoneCode = "47"
                    appliedStatus = "Dispose Parcel"

                    DetrackAPIrun = 1;
                    FMXAPIrun = 2;
                    completeRun = 1;
                }
            }

            if (product != 'FMX') {
                if ((req.body.statusCode == 'IR') && (data.data.status == 'info_recv')) {
                    newOrder = new ORDERS({
                        area: data.data.zone,
                        items: [{
                            quantity: data.data.items[0].quantity,
                            description: data.data.items[0].description,
                            totalItemPrice: data.data.total_price
                        }],
                        attempt: data.data.attempt,
                        history: [{
                            updatedBy: req.user.name,
                            dateUpdated: moment().format(),
                            statusHistory: "Info Received",
                            lastAssignedTo: "N/A",
                            reason: "N/A",
                            lastLocation: "N/A",
                        }],
                        lastAssignedTo: "N/A",
                        latestLocation: "N/A",
                        product: currentProduct,
                        assignedTo: "N/A",
                        senderName: data.data.job_owner,
                        totalPrice: data.data.total_price,
                        deliveryType: data.data.job_type,
                        receiverName: data.data.deliver_to_collect_from,
                        trackingLink: data.data.tracking_link,
                        currentStatus: "Info Received",
                        paymentMethod: data.data.payment_mode,
                        warehouseEntry: "No",
                        warehouseEntryDateTime: "N/A",
                        receiverAddress: data.data.address,
                        receiverPhoneNumber: data.data.phone_number,
                        doTrackingNumber: consignmentID,
                        instructions: data.data.instructions,
                        latestReason: "N/A",
                        lastUpdateDateTime: moment().format(),
                        creationDate: data.data.created_at,
                        jobDate: "N/A",
                        lastUpdatedBy: req.user.name,
                    });

                    portalUpdate = "Portal status updated to Info Received. ";
                    appliedStatus = "Info Received"
                    mongoDBrun = 1;
                    completeRun = 1;
                }

                if ((req.body.statusCode == 12) && (data.data.status == 'info_recv') && (product == 'GRP')) {
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
                            status: "at_warehouse", // Use the calculated dStatus
                            do_number: data.data.tracking_number,
                            tracking_number: consignmentID
                        }
                    };

                    appliedStatus = "Item in Warehouse"

                    DetrackAPIrun = 1;
                    completeRun = 1;

                    if ((product == "BB") || (product == "FCAS") || (product == "ICARUS")) {
                        portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                    } else {
                        portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        waOrderArrivedPickup = 1;
                    }
                }

                if ((req.body.statusCode == 12) && (data.data.status == 'info_recv') && (product == 'CBSL')) {
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
                            status: "at_warehouse", // Use the calculated dStatus
                            do_number: data.data.tracking_number,
                            tracking_number: consignmentID
                        }
                    };

                    appliedStatus = "Item in Warehouse"

                    DetrackAPIrun = 1;
                    completeRun = 1;

                    if ((product == "BB") || (product == "FCAS") || (product == "ICARUS")) {
                        portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                    } else {
                        portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        if (data.data.phone_number != null) {
                            waOrderArrivedPickup = 1;
                        }
                    }
                }

                if ((req.body.statusCode == 12) && (product != 'GRP') && (product != 'CBSL')) {
                    if ((data.data.status == 'info_recv')) {
                        if (existingOrder === null) {
                            if (product == 'EWE') {
                                if (data.data.postal_code != null) {
                                    postalCode = data.data.postal_code.toUpperCase()
                                }

                                address = data.data.address.toUpperCase();

                                if (address.includes("MANGGIS") == true) { area = "B1", kampong = "MANGGIS" }
                                else if (address.includes("DELIMA") == true) { area = "B1", kampong = "DELIMA" }
                                else if (address.includes("ANGGREK DESA") == true) { area = "B1", kampong = "ANGGREK DESA" }
                                else if (address.includes("ANGGREK") == true) { area = "B1", kampong = "ANGGREK DESA" }
                                else if (address.includes("PULAIE") == true) { area = "B1", kampong = "PULAIE" }
                                else if (address.includes("LAMBAK") == true) { area = "B1", kampong = "LAMBAK" }
                                else if (address.includes("TERUNJING") == true) { area = "B1", kampong = "TERUNJING" }
                                else if (address.includes("MADANG") == true) { area = "B1", kampong = "MADANG" }
                                else if (address.includes("AIRPORT") == true) { area = "B1", kampong = "AIRPORT" }
                                else if (address.includes("ORANG KAYA BESAR IMAS") == true) { area = "B1", kampong = "OKBI" }
                                else if (address.includes("OKBI") == true) { area = "B1", kampong = "OKBI" }
                                else if (address.includes("SERUSOP") == true) { area = "B1", kampong = "SERUSOP" }
                                else if (address.includes("BURONG PINGAI") == true) { area = "B1", kampong = "BURONG PINGAI" }
                                else if (address.includes("SETIA NEGARA") == true) { area = "B1", kampong = "SETIA NEGARA" }
                                else if (address.includes("PASIR BERAKAS") == true) { area = "B1", kampong = "PASIR BERAKAS" }
                                else if (address.includes("MENTERI BESAR") == true) { area = "B1", kampong = "MENTERI BESAR" }
                                else if (address.includes("KEBANGSAAN LAMA") == true) { area = "B1", kampong = "KEBANGSAAN LAMA" }
                                else if (address.includes("BATU MARANG") == true) { area = "B2", kampong = "BATU MARANG" }
                                else if (address.includes("DATO GANDI") == true) { area = "B2", kampong = "DATO GANDI" }
                                else if (address.includes("KAPOK") == true) { area = "B2", kampong = "KAPOK" }
                                else if (address.includes("KOTA BATU") == true) { area = "B2", kampong = "KOTA BATU" }
                                else if (address.includes("MENTIRI") == true) { area = "B2", kampong = "MENTIRI" }
                                else if (address.includes("MERAGANG") == true) { area = "B2", kampong = "MERAGANG" }
                                else if (address.includes("PELAMBAIAN") == true) { area = "B2", kampong = "PELAMBAIAN" }
                                else if (address.includes("PINTU MALIM") == true) { area = "B2", kampong = "PINTU MALIM" }
                                else if (address.includes("SALAMBIGAR") == true) { area = "B2", kampong = "SALAMBIGAR" }
                                else if (address.includes("SALAR") == true) { area = "B2", kampong = "SALAR" }
                                else if (address.includes("SERASA") == true) { area = "B2", kampong = "SERASA" }
                                else if (address.includes("SERDANG") == true) { area = "B2", kampong = "SERDANG" }
                                else if (address.includes("SUNGAI BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
                                else if (address.includes("SG BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
                                else if (address.includes("SUNGAI BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
                                else if (address.includes("SG BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
                                else if (address.includes("SUNGAI HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
                                else if (address.includes("SG HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
                                else if (address.includes("SUNGAI TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
                                else if (address.includes("SG TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
                                else if (address.includes("SUBOK") == true) { area = "B2", kampong = "SUBOK" }
                                else if (address.includes("SUNGAI AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
                                else if (address.includes("SG AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
                                else if (address.includes("SUNGAI BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
                                else if (address.includes("SG BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
                                else if (address.includes("TANAH JAMBU") == true) { area = "B2", kampong = "TANAH JAMBU" }
                                else if (address.includes("SUNGAI OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
                                else if (address.includes("SG OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
                                else if (address.includes("KATOK") == true) { area = "G1", kampong = "KATOK" }
                                else if (address.includes("MATA-MATA") == true) { area = "G1", kampong = "MATA-MATA" }
                                else if (address.includes("MATA MATA") == true) { area = "G1", kampong = "MATA-MATA" }
                                else if (address.includes("RIMBA") == true) { area = "G1", kampong = "RIMBA" }
                                else if (address.includes("TUNGKU") == true) { area = "G1", kampong = "TUNGKU" }
                                else if (address.includes("UBD") == true) { area = "G1", kampong = "UBD" }
                                else if (address.includes("UNIVERSITI BRUNEI DARUSSALAM") == true) { area = "G1", kampong = "UBD" }
                                else if (address.includes("JIS") == true) { area = "G1" }
                                else if (address.includes("JERUDONG INTERNATIONAL SCHOOL") == true) { area = "G1", kampong = "JIS" }
                                else if (address.includes("BERANGAN") == true) { area = "G2", kampong = "BERANGAN" }
                                else if (address.includes("BERIBI") == true) { area = "G2", kampong = "BERIBI" }
                                else if (address.includes("KIULAP") == true) { area = "G2", kampong = "KIULAP" }
                                else if (address.includes("RIPAS") == true) { area = "G2", kampong = "RIPAS" }
                                else if (address.includes("RAJA ISTERI PENGIRAN ANAK SALLEHA") == true) { area = "G2", kampong = "RIPAS" }
                                else if (address.includes("KIARONG") == true) { area = "G2", kampong = "KIARONG" }
                                else if (address.includes("PUSAR ULAK") == true) { area = "G2", kampong = "PUSAR ULAK" }
                                else if (address.includes("KUMBANG PASANG") == true) { area = "G2", kampong = "KUMBANG PASANG" }
                                else if (address.includes("MENGLAIT") == true) { area = "G2", kampong = "MENGLAIT" }
                                else if (address.includes("MABOHAI") == true) { area = "G2", kampong = "MABOHAI" }
                                else if (address.includes("ONG SUM PING") == true) { area = "G2", kampong = "ONG SUM PING" }
                                else if (address.includes("GADONG") == true) { area = "G2", kampong = "GADONG" }
                                else if (address.includes("TASEK LAMA") == true) { area = "G2", kampong = "TASEK LAMA" }
                                else if (address.includes("BANDAR TOWN") == true) { area = "G2", kampong = "BANDAR TOWN" }
                                else if (address.includes("BATU SATU") == true) { area = "JT1", kampong = "BATU SATU" }
                                else if (address.includes("BENGKURONG") == true) { area = "JT1", kampong = "BENGKURONG" }
                                else if (address.includes("BUNUT") == true) { area = "JT1", kampong = "BUNUT" }
                                else if (address.includes("JALAN BABU RAJA") == true) { area = "JT1", kampong = "JALAN BABU RAJA" }
                                else if (address.includes("JALAN ISTANA") == true) { area = "JT1", kampong = "JALAN ISTANA" }
                                else if (address.includes("JUNJONGAN") == true) { area = "JT1", kampong = "JUNJONGAN" }
                                else if (address.includes("KASAT") == true) { area = "JT1", kampong = "KASAT" }
                                else if (address.includes("LUMAPAS") == true) { area = "JT1", kampong = "LUMAPAS" }
                                else if (address.includes("JALAN HALUS") == true) { area = "JT1", kampong = "JALAN HALUS" }
                                else if (address.includes("MADEWA") == true) { area = "JT1", kampong = "MADEWA" }
                                else if (address.includes("PUTAT") == true) { area = "JT1", kampong = "PUTAT" }
                                else if (address.includes("SINARUBAI") == true) { area = "JT1", kampong = "SINARUBAI" }
                                else if (address.includes("TASEK MERADUN") == true) { area = "JT1", kampong = "TASEK MERADUN" }
                                else if (address.includes("TELANAI") == true) { area = "JT1", kampong = "TELANAI" }
                                else if (address.includes("BAN 1") == true) { area = "JT2", kampong = "BAN" }
                                else if (address.includes("BAN 2") == true) { area = "JT2", kampong = "BAN" }
                                else if (address.includes("BAN 3") == true) { area = "JT2", kampong = "BAN" }
                                else if (address.includes("BAN 4") == true) { area = "JT2", kampong = "BAN" }
                                else if (address.includes("BAN 5") == true) { area = "JT2", kampong = "BAN" }
                                else if (address.includes("BAN 6") == true) { area = "JT2", kampong = "BAN" }
                                else if (address.includes("BATONG") == true) { area = "JT2", kampong = "BATONG" }
                                else if (address.includes("BATU AMPAR") == true) { area = "JT2", kampong = "BATU AMPAR" }
                                else if (address.includes("BEBATIK") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                                else if (address.includes("BEBULOH") == true) { area = "JT2", kampong = "BEBULOH" }
                                else if (address.includes("BEBATIK KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                                else if (address.includes("KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                                else if (address.includes("DADAP") == true) { area = "JT2", kampong = "DADAP" }
                                else if (address.includes("KUALA LURAH") == true) { area = "JT2", kampong = "KUALA LURAH" }
                                else if (address.includes("KULAPIS") == true) { area = "JT2", kampong = "KULAPIS" }
                                else if (address.includes("LIMAU MANIS") == true) { area = "JT2", kampong = "LIMAU MANIS" }
                                else if (address.includes("MASIN") == true) { area = "JT2", kampong = "MASIN" }
                                else if (address.includes("MULAUT") == true) { area = "JT2", kampong = "MULAUT" }
                                else if (address.includes("PANCHOR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
                                else if (address.includes("PANCHUR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
                                else if (address.includes("PANGKALAN BATU") == true) { area = "JT2", kampong = "PANGKALAN BATU" }
                                else if (address.includes("PASAI") == true) { area = "JT2", kampong = "PASAI" }
                                else if (address.includes("WASAN") == true) { area = "JT2", kampong = "WASAN" }
                                else if (address.includes("PARIT") == true) { area = "JT2", kampong = "PARIT" }
                                else if (address.includes("EMPIRE") == true) { area = "JT3", kampong = "EMPIRE" }
                                else if (address.includes("JANGSAK") == true) { area = "JT3", kampong = "JANGSAK" }
                                else if (address.includes("JERUDONG") == true) { area = "JT3", kampong = "JERUDONG" }
                                else if (address.includes("KATIMAHAR") == true) { area = "JT3", kampong = "KATIMAHAR" }
                                else if (address.includes("LUGU") == true) { area = "JT3", kampong = "LUGU" }
                                else if (address.includes("SENGKURONG") == true) { area = "JT3", kampong = "SENGKURONG" }
                                else if (address.includes("TANJONG NANGKA") == true) { area = "JT3", kampong = "TANJONG NANGKA" }
                                else if (address.includes("TANJONG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
                                else if (address.includes("TANJUNG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
                                else if (address.includes("SUNGAI TAMPOI") == true) { area = "JT3", kampung = "SUNGAI TAMPOI" }
                                else if (address.includes("SG TAMPOI") == true) { area = "JT3", kampong = "SUNGAI TAMPOI" }
                                else if (address.includes("MUARA") == true) { area = "B2", kampong = "MUARA" }
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
                                    deliveryType: data.data.job_type,
                                    receiverName: data.data.deliver_to_collect_from,
                                    trackingLink: data.data.tracking_link,
                                    currentStatus: "At Warehouse",
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
                                    jobDate: "N/A",
                                    flightDate: data.data.job_received_date,
                                    mawbNo: data.data.run_number,
                                    lastUpdatedBy: req.user.name,
                                    parcelWeight: data.data.weight,
                                    receiverPostalCode: postalCode,
                                });
                            } else {
                                newOrder = new ORDERS({
                                    area: data.data.zone,
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
                                    deliveryType: data.data.job_type,
                                    receiverName: data.data.deliver_to_collect_from,
                                    trackingLink: data.data.tracking_link,
                                    currentStatus: "At Warehouse",
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
                                    jobDate: "N/A",
                                    lastUpdatedBy: req.user.name,
                                });
                            }

                            mongoDBrun = 1;
                        } else {
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

                            mongoDBrun = 2;
                        }

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                status: "at_warehouse" // Use the calculated dStatus
                            }
                        };

                        if ((product == "BB") || (product == "FCAS") || (product == "ICARUS")) {
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        } else {
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                            if (data.data.phone_number != null) {
                                if (data.data.job_type.includes("Standard")) {
                                    waOrderArrivedDeliverStandard = 1;
                                }

                                if (data.data.job_type.includes("Drop off")) {
                                    waOrderArrivedDeliverExpressNonMedicine = 1;
                                }

                                if (data.data.job_type.includes("Express")) {
                                    if (currentProduct.includes("pharmacy")) {
                                        waOrderArrivedDeliverExpressMedicine = 1;
                                    } else {
                                        waOrderArrivedDeliverExpressNonMedicine = 1;
                                    }
                                }

                                if (data.data.job_type.includes("Immediate")) {
                                    waOrderArrivedDeliverImmediate = 1
                                }
                            }
                        }

                        appliedStatus = "Item in Warehouse"

                        DetrackAPIrun = 1;
                        completeRun = 1;
                    }
                    /* if ((data.data.status == 'cancelled')) {
                        if (product == 'EWE') {





                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: itemsArray, // Use the dynamically created items array
                                attempt: 0,
                                history: [{
                                    statusHistory: "At Warehouse",
                                    dateUpdated: moment().format(),
                                    updatedBy:  req.user.name,
                                    lastAssignedTo: "N/A",
                                    reason: "N/A",
                                }],
                                product: currentProduct,
                                assignedTo: "N/A",
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: data.data.job_type,
                                receiverName: data.data.deliver_to_collect_from,
                                trackingLink: data.data.tracking_link,
                                currentStatus: "At Warehouse",
                                paymentMethod: data.data.payment_mode,
                                warehouseEntry: "Yes",
                                warehouseEntryDateTime: moment().format(),
                                receiverAddress: data.data.address,
                                receiverPhoneNumber: data.data.phone_number,
                                doTrackingNumber: "N/A",
                                remarks: "previously " + consignmentID,
                                latestReason: "N/A",
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: "N/A",
                            });

                            //Have to create new Detrack

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    status: "at_warehouse" // Use the calculated dStatus
                                }
                            };
                            
                            DetrackAPIrun = 1;
                           

                            appliedStatus = "Item in Warehouse"
                            mongoDBrun = 1;
                            completeRun = 1;
                        }
                    } */
                }

                ///EWE Control Attempts
                if ((req.body.statusCode == 35) && (data.data.status == 'at_warehouse')) {
                    if ((wmsAttempt > 2) && (product == 'EWE')) {
                        maxAttempt = 1;
                        completeRun = 1;
                    } else {
                        if ((req.body.dispatchers == "FL1") || (req.body.dispatchers == "FL2") || (req.body.dispatchers == "FL3") || (req.body.dispatchers == "FL4") || (req.body.dispatchers == "FL5")) {
                            update = {
                                currentStatus: "Out for Delivery",
                                lastUpdateDateTime: moment().format(),
                                instructions: "Assigned to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
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

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: req.body.assignDate, // Get the Assign Date from the form
                                    assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                    status: "dispatched", // Use the calculated dStatus
                                    instructions: "Assigned to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + "."
                                }
                            };

                            portalUpdate = "Portal and Detrack status updated to Out for Delivery assigned to " + req.body.dispatchers + " " + req.body.freelancerName + ". ";

                        } else {
                            update = {
                                currentStatus: "Out for Delivery",
                                lastUpdateDateTime: moment().format(),
                                instructions: "Assigned to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
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

                            var detrackUpdateData = {
                                do_number: consignmentID,
                                data: {
                                    date: req.body.assignDate, // Get the Assign Date from the form
                                    assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                    status: "dispatched", // Use the calculated dStatus
                                    instructions: "Assigned to " + req.body.dispatchers + " on " + req.body.assignDate + "."
                                }
                            };

                            portalUpdate = "Portal and Detrack status updated to Out for Delivery assigned to " + req.body.dispatchers + ". ";
                        }

                        appliedStatus = "Out for Delivery"

                        DetrackAPIrun = 1;
                        completeRun = 1;
                    }
                }

                if ((req.body.statusCode == 'SD') && (data.data.status == 'dispatched')) {
                    if ((req.body.dispatchers == "FL1") || (req.body.dispatchers == "FL2") || (req.body.dispatchers == "FL3") || (req.body.dispatchers == "FL4") || (req.body.dispatchers == "FL5")) {
                        update = {
                            lastUpdateDateTime: moment().format(),
                            instructions: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + ".",
                            assignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                            jobDate: req.body.assignDate,
                            attempt: data.data.attempt,
                            latestLocation: req.body.dispatchers + " " + req.body.freelancerName,
                            lastUpdatedBy: req.user.name,
                            lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                            $push: {
                                history: {
                                    statusHistory: "Out for Delivery (Switched Dispatchers)",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: req.body.dispatchers + " " + req.body.freelancerName,
                                    reason: "N/A",
                                    lastLocation: req.body.dispatchers + " " + req.body.freelancerName,
                                }
                            }
                        }

                        mongoDBrun = 2;

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                date: req.body.assignDate, // Get the Assign Date from the form
                                assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                instructions: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + "."
                            }
                        };

                        portalUpdate = "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + ". ";

                    } else {
                        update = {
                            lastUpdateDateTime: moment().format(),
                            instructions: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
                            assignedTo: req.body.dispatchers,
                            jobDate: req.body.assignDate,
                            attempt: data.data.attempt,
                            latestLocation: req.body.dispatchers,
                            lastUpdatedBy: req.user.name,
                            lastAssignedTo: req.body.dispatchers,
                            $push: {
                                history: {
                                    statusHistory: "Out for Delivery (Switched Dispatchers)",
                                    dateUpdated: moment().format(),
                                    updatedBy: req.user.name,
                                    lastAssignedTo: req.body.dispatchers,
                                    reason: "N/A",
                                    lastLocation: req.body.dispatchers,
                                }
                            }
                        }

                        mongoDBrun = 2;

                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                date: req.body.assignDate, // Get the Assign Date from the form
                                assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                instructions: "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " on " + req.body.assignDate + ".",
                            }
                        };

                        portalUpdate = "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + ". ";
                    }
                    appliedStatus = "Swap Dispatchers"

                    DetrackAPIrun = 1;
                    completeRun = 1;
                }

                if (req.body.statusCode == 'SFJ') {
                    if (data.data.status == 'failed') {
                        if (data.data.reason == "Unattempted Delivery") {
                            update = {
                                currentStatus: "Return to Warehouse",
                                lastUpdateDateTime: moment().format(),
                                instructions: "Failed delivery due to " + data.data.reason,
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
                            appliedStatus = "Failed Delivery, Return to Warehouse/Completed"

                            if ((product == "BB") || (product == "FCAS")) {
                                portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                            } else {
                                portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                                if (data.data.phone_number != null) {
                                    waOrderFailedDelivery = 1;
                                }
                            }
                        } else {
                            update = {
                                currentStatus: "Return to Warehouse",
                                lastUpdateDateTime: moment().format(),
                                instructions: "Failed delivery due to " + data.data.reason,
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

                            var detrackUpdateDataAttempt = {
                                data: {
                                    do_number: consignmentID,
                                }
                            };

                            DetrackAPIrun = 2;
                            appliedStatus = "Failed Delivery, Return to Warehouse/Completed"
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        }

                        mongoDBrun = 2;
                        completeRun = 1;
                    }

                    if (data.data.status == 'completed') {
                        if (!existingOrder) {
                            newOrder = new ORDERS({
                                area: data.data.zone,
                                items: [{
                                    quantity: data.data.items[0].quantity,
                                    description: data.data.items[0].description,
                                    totalItemPrice: data.data.total_price
                                }],
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
                                assignedTo: data.data.assign_to,
                                senderName: data.data.job_owner,
                                totalPrice: data.data.total_price,
                                deliveryType: data.data.job_type,
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
                                lastUpdateDateTime: moment().format(),
                                creationDate: data.data.created_at,
                                jobDate: data.data.date,
                                lastUpdatedBy: req.user.name,
                            });

                            mongoDBrun = 1;
                        } else {
                            update = {
                                currentStatus: "Completed",
                                lastUpdateDateTime: moment().format(),
                                attempt: data.data.attempt,
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

                        appliedStatus = "Failed/Completed"
                        completeRun = 1;

                        if ((product == "BB") || (product == "FCAS") || (product == "ICARUS")) {
                            portalUpdate = "Portal status updated to Completed. ";
                        } else {
                            portalUpdate = "Portal status updated to Completed. ";
                            if (data.data.phone_number != null) {
                                waOrderCompletedFeedback = 1;
                            }
                        }
                    }
                }

                if ((req.body.statusCode == 'FJ') && (data.data.status == 'failed')) {
                    if (data.data.reason == "Unattempted Delivery") {
                        update = {
                            currentStatus: "Return to Warehouse",
                            lastUpdateDateTime: moment().format(),
                            instructions: "Failed delivery due to " + data.data.reason,
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

                        if ((product == "BB") || (product == "FCAS")) {
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                        } else {
                            portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                            if (data.data.phone_number != null) {
                                waOrderFailedDelivery = 1;
                            }
                        }
                    } else {
                        update = {
                            currentStatus: "Return to Warehouse",
                            lastUpdateDateTime: moment().format(),
                            instructions: "Failed delivery due to " + data.data.reason,
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

                        var detrackUpdateDataAttempt = {
                            data: {
                                do_number: consignmentID,
                            }
                        };

                        DetrackAPIrun = 2;
                        appliedStatus = "Failed Delivery, Return to Warehouse"
                        portalUpdate = "Portal and Detrack status updated to At Warehouse. ";
                    }

                    mongoDBrun = 2;
                    completeRun = 1;
                }

                if ((req.body.statusCode == 'SJ') && (data.data.status == 'completed')) {
                    if (!existingOrder) {
                        newOrder = new ORDERS({
                            area: data.data.zone,
                            items: [{
                                quantity: data.data.items[0].quantity,
                                description: data.data.items[0].description,
                                totalItemPrice: data.data.total_price
                            }],
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
                            assignedTo: data.data.assign_to,
                            senderName: data.data.job_owner,
                            totalPrice: data.data.total_price,
                            deliveryType: data.data.job_type,
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
                            lastUpdateDateTime: moment().format(),
                            creationDate: data.data.created_at,
                            jobDate: data.data.date,
                            lastUpdatedBy: req.user.name,
                        });

                        mongoDBrun = 1;
                    } else {
                        update = {
                            currentStatus: "Completed",
                            lastUpdateDateTime: moment().format(),
                            attempt: data.data.attempt,
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

                    appliedStatus = "Completed"
                    completeRun = 1;

                    if ((product == "BB") || (product == "FCAS") || (product == "ICARUS")) {
                        portalUpdate = "Portal status updated to Completed. ";
                    } else {
                        portalUpdate = "Portal status updated to Completed. ";
                        if (data.data.phone_number != null) {
                            waOrderCompletedFeedback = 1;
                        }
                    }
                }

                if ((req.body.statusCode == 'CSSC') && (data.data.status == 'at_warehouse')) {
                    update = {
                        currentStatus: "Self Collect",
                        lastUpdateDateTime: moment().format(),
                        instructions: "Assigned for Self Collect.",
                        assignedTo: "Selfcollect",
                        attempt: data.data.attempt,
                        jobDate: req.body.assignDate,
                        latestLocation: "Go Rush Office",
                        lastUpdatedBy: req.user.name,
                        lastAssignedTo: "Selfcollect",
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

                    mongoDBrun = 2;

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            date: req.body.assignDate, // Get the Assign Date from the form
                            assign_to: "Selfcollect", // Get the selected dispatcher from the form
                            status: "dispatched" // Use the calculated dStatus
                        }
                    };

                    portalUpdate = "Portal and Detrack status updated for Self Collect. ";
                    appliedStatus = "Self Collect"

                    DetrackAPIrun = 1;
                    completeRun = 1;
                }

                if ((req.body.statusCode == 'CD') && (data.data.status != 'completed')) {
                    detrackReason = "Cancelled";

                    update = {
                        currentStatus: "Cancelled",
                        lastUpdateDateTime: moment().format(),
                        instructions: "Cancelled Delivery",
                        assignedTo: "N/A",
                        latestReason: detrackReason,
                        attempt: data.data.attempt,
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

                    mongoDBrun = 2

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "cancelled",
                            instructions: "Cancelled Delivery",
                        }
                    };

                    portalUpdate = "Portal and Detrack status updated to Cancelled. ";
                    appliedStatus = "Cancelled"

                    DetrackAPIrun = 1;
                    completeRun = 1;
                }

                if ((req.body.statusCode == 'AJ') && (data.data.status == 'cancelled')) {
                    portalUpdate = "Portal and Detrack status updated to Return to Warehouse from Cancelled. ";

                    update = {
                        currentStatus: "Return to Warehouse",
                        lastUpdateDateTime: moment().format(),
                        instructions: "Return to Warehouse from Cancelled.",
                        assignedTo: "N/A",
                        latestReason: detrackReason,
                        attempt: data.data.attempt,
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

                    mongoDBrun = 2;

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse",
                            instructions: "Return to Warehouse from Cancelled."
                        }
                    };

                    appliedStatus = "Return to Warehouse from Cancelled"

                    DetrackAPIrun = 1;
                    completeRun = 1;
                }
            }

            if (req.body.statusCode == 'FA') {
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

                if (data.data.postal_code != null) {
                    postalCode = data.data.postal_code.toUpperCase()
                }

                update = {
                    receiverPostalCode: postalCode,
                }

                mongoDBrun = 2;

                portalUpdate = "Mongo updated. Add Postal Code. ";
                appliedStatus = "Postal Code Fix"

                completeRun = 1;
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

            //normal run
            if (FMXAPIrun == 1) {
                // Step 3: Create data for the second API request
                const currentTime = moment().format();

                const requestData = {
                    UploadType: '',
                    FileName: '',
                    FileFormat: '',
                    FileData: '',
                    DateEvent: currentTime,
                    ConsignmentId: consignmentID,
                    StatusCode: fmxMilestoneCode,
                    CityName: 'BN',
                    ConsigneeName: ''
                };

                // Step 4: Make the second API request with bearer token
                const response2 = await axios.post('https://client.fmx.asia/api/v1/order/milestone/create', requestData, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                });

                // Handle success response
                // You can customize this part with appropriate notifications and redirections
                console.log('API response:', response2.data);
            }

            //for 44 only
            if (FMXAPIrun == 2) {
                // Step 3: Create data for the second API request
                const currentTime = moment().format();

                const requestData = {
                    UploadType: '',
                    FileName: '',
                    FileFormat: '',
                    FileData: '',
                    DateEvent: currentTime,
                    ConsignmentId: consignmentID,
                    StatusCode: fmxMilestoneCode,
                    CityName: 'BN',
                    ConsigneeName: '',
                    Remark: detrackReason
                };

                // Step 4: Make the second API request with bearer token
                const response4 = await axios.post('https://client.fmx.asia/api/v1/order/milestone/create', requestData, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                });

                // Handle success response
                // You can customize this part with appropriate notifications and redirections
                console.log('API response:', response4.data);
            }

            if (FMXAPIrun == 3) {
                // Define an array of status codes to use in the two runs
                const statusCodesToRun = [fmxMilestoneCode, '44']; // Replace with actual status codes

                for (let i = 0; i < statusCodesToRun.length; i++) {
                    // Step 3: Create data for the API request
                    const currentTime = moment().format();

                    const requestData = {
                        UploadType: '',
                        FileName: '',
                        FileFormat: '',
                        FileData: '',
                        DateEvent: currentTime,
                        ConsignmentId: consignmentID,
                        StatusCode: statusCodesToRun[i], // Use the current status code from the array
                        CityName: 'BN',
                        ConsigneeName: '',
                        Remark: detrackReason
                    };

                    // Step 4: Make the API request with the bearer token
                    const response = await axios.post('https://client.fmx.asia/api/v1/order/milestone/create', requestData, {
                        headers: {
                            Authorization: `Bearer ${accessToken}`
                        }
                    });

                    // Handle success response
                    // You can customize this part with appropriate notifications and redirections
                    console.log(`API response for status code ${statusCodesToRun[i]}:`, response.data);
                }
            }

            if (FMXAPIrun == 5) {
                // Step 3: Make the third API POST request with accessToken
                const currentDate = moment(latestPODDate).format();
                const fileName = `${consignmentID}_POD`;

                const photoUrls = [
                    data.data.photo_1_file_url,
                    data.data.photo_2_file_url,
                    data.data.photo_3_file_url,
                    data.data.photo_4_file_url,
                    data.data.photo_5_file_url,
                    data.data.photo_6_file_url,
                    data.data.photo_7_file_url,
                    data.data.photo_8_file_url,
                    data.data.photo_9_file_url,
                    data.data.photo_10_file_url
                ];

                let selectedPhotoUrl = null;

                // Find the first non-null photo URL
                for (const url of photoUrls) {
                    if (url) {
                        selectedPhotoUrl = url;
                        break;
                    }
                }

                if (!selectedPhotoUrl) {
                    throw new Error('No valid photo URL found');
                }

                // Download the image from the selected photo URL
                const imageResponse = await axios.get(selectedPhotoUrl, { responseType: 'arraybuffer' });

                if (imageResponse.status !== 200) {
                    throw new Error('Error occurred during image download');
                }

                // Convert the image to base64
                const base64Image = Buffer.from(imageResponse.data, 'binary').toString('base64');

                if (data.data.status === 'Selfcollect') {
                    remarkSC = 'Self Collect';
                }

                // Make the third API POST request with accessToken and base64Image
                const response3 = await axios.post('https://client.fmx.asia/api/v1/order/milestone/create', {
                    ImageUploader: {
                        UploadType: 'POD',
                        FileName: fileName,
                        FileFormat: 'jpg',
                        FileData: base64Image // Use the base64 image data here
                    },
                    DateEvent: currentDate,
                    ConsignmentId: consignmentID,
                    StatusCode: fmxMilestoneCode,
                    CityName: 'BN',
                    ConsigneeName: '',
                    Remark: remarkSC // Add remark field with value
                }, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                // Show a success message
                console.log('Success');
            }

            if (waOrderArrivedDeliverStandard == 5) {
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
                                    "text": `Hello ${a},\n\nWe apologize for the order with tracking number ${b} not delivered today due to insufficient time.\n\nWe are committed to ensuring your order will be delivered on the next business day.\n\nYour tracking number can be tracked on www.gorushbn.com or through this link below:\n\n${c}\n\nFor reschedule delivery trip to Tutong, Belait, and Temburong or any further inquiries, please reach us via WhatsApp or call us at 2332065.`,
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
                    status: portalUpdate + fmxUpdate,
                });
            }
            else if ((ceCheck == 0) && (maxAttempt == 1)) {
                processingResults.push({
                    consignmentID,
                    status: `Error: Tracking Number have reached the max attempts. Please check with manager for next decision.`,
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

orderWatch.on('change', change => {
    if (change.operationType == "insert") {
        ORDERS.find().sort({ $natural: -1 }).limit(1000).then(
            (result) => {
                let filter = new mongoose.Types.ObjectId(result[0]._id);
                if (result[0].product != null) {
                    let products = result[0].product

                    if (products.includes("pharmacy") == true) {
                        products = "pharmacy"
                    }

                    let tracker
                    let sequence

                    if (result[0].receiverPhoneNumber != null) {
                        var phoneNumber = "+" + result[0].receiverPhoneNumber.trim();
                    }

                    let whatsappName = result[0].receiverName;

                    let checkProduct = 0;

                    if ((result.length >= 2) && (checkProduct == 0)) {
                        for (let i = 1; i < result.length; i++) {
                            if (result[i].product.includes("localdelivery")) {
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
                            } else {
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
                            }
                        }
                        if (checkProduct == 0) {
                            sequence = 1
                            checkProduct = 1
                        }
                    }

                    if (((result.length == 1) || (result.length == undefined)) && checkProduct == 0) {
                        sequence = 1
                        checkProduct = 1
                    }

                    if (result[0].product == "pharmacymoh") {
                        let suffix = "GR2"
                        let prefix = "MH"

                        if (sequence >= 0 && sequence <= 9) {
                            tracker = suffix + "0000000" + sequence + prefix
                        }
                        if (sequence >= 10 && sequence <= 99) {
                            tracker = suffix + "000000" + sequence + prefix
                        }
                        if (sequence >= 100 && sequence <= 999) {
                            tracker = suffix + "00000" + sequence + prefix
                        }
                        if (sequence >= 1000 && sequence <= 9999) {
                            tracker = suffix + "0000" + sequence + prefix
                        }
                        if (sequence >= 10000 && sequence <= 99999) {
                            tracker = suffix + "000" + sequence + prefix
                        }
                        if (sequence >= 100000 && sequence <= 999999) {
                            tracker = suffix + "00" + sequence + prefix
                        }
                        if (sequence >= 1000000 && sequence <= 9999999) {
                            tracker = suffix + "0" + sequence + prefix
                        }
                        if (sequence >= 10000000 && sequence <= 99999999) {
                            tracker = suffix + sequence + prefix
                        }
                    }

                    if (result[0].product == "pharmacyjpmc") {
                        let suffix = "GR2"
                        let prefix = "JP"

                        if (sequence >= 0 && sequence <= 9) {
                            tracker = suffix + "0000000" + sequence + prefix
                        }
                        if (sequence >= 10 && sequence <= 99) {
                            tracker = suffix + "000000" + sequence + prefix
                        }
                        if (sequence >= 100 && sequence <= 999) {
                            tracker = suffix + "00000" + sequence + prefix
                        }
                        if (sequence >= 1000 && sequence <= 9999) {
                            tracker = suffix + "0000" + sequence + prefix
                        }
                        if (sequence >= 10000 && sequence <= 99999) {
                            tracker = suffix + "000" + sequence + prefix
                        }
                        if (sequence >= 100000 && sequence <= 999999) {
                            tracker = suffix + "00" + sequence + prefix
                        }
                        if (sequence >= 1000000 && sequence <= 9999999) {
                            tracker = suffix + "0" + sequence + prefix
                        }
                        if (sequence >= 10000000 && sequence <= 99999999) {
                            tracker = suffix + sequence + prefix
                        }
                    }

                    if (result[0].product == "pharmacyphc") {
                        let suffix = "GR2"
                        let prefix = "PN"

                        if (sequence >= 0 && sequence <= 9) {
                            tracker = suffix + "0000000" + sequence + prefix
                        }
                        if (sequence >= 10 && sequence <= 99) {
                            tracker = suffix + "000000" + sequence + prefix
                        }
                        if (sequence >= 100 && sequence <= 999) {
                            tracker = suffix + "00000" + sequence + prefix
                        }
                        if (sequence >= 1000 && sequence <= 9999) {
                            tracker = suffix + "0000" + sequence + prefix
                        }
                        if (sequence >= 10000 && sequence <= 99999) {
                            tracker = suffix + "000" + sequence + prefix
                        }
                        if (sequence >= 100000 && sequence <= 999999) {
                            tracker = suffix + "00" + sequence + prefix
                        }
                        if (sequence >= 1000000 && sequence <= 9999999) {
                            tracker = suffix + "0" + sequence + prefix
                        }
                        if (sequence >= 10000000 && sequence <= 99999999) {
                            tracker = suffix + sequence + prefix
                        }
                    }

                    if (result[0].product == "grp") {
                        let suffix = "GR4"
                        let prefix = "GP"

                        if (sequence >= 0 && sequence <= 9) {
                            tracker = suffix + "0000000" + sequence + prefix
                        }
                        if (sequence >= 10 && sequence <= 99) {
                            tracker = suffix + "000000" + sequence + prefix
                        }
                        if (sequence >= 100 && sequence <= 999) {
                            tracker = suffix + "00000" + sequence + prefix
                        }
                        if (sequence >= 1000 && sequence <= 9999) {
                            tracker = suffix + "0000" + sequence + prefix
                        }
                        if (sequence >= 10000 && sequence <= 99999) {
                            tracker = suffix + "000" + sequence + prefix
                        }
                        if (sequence >= 100000 && sequence <= 999999) {
                            tracker = suffix + "00" + sequence + prefix
                        }
                        if (sequence >= 1000000 && sequence <= 9999999) {
                            tracker = suffix + "0" + sequence + prefix
                        }
                        if (sequence >= 10000000 && sequence <= 99999999) {
                            tracker = suffix + sequence + prefix
                        }
                    }

                    if (result[0].product == "localdelivery") {
                        let suffix = "GR3"
                        let prefix = "LD"

                        if (sequence >= 0 && sequence <= 9) {
                            tracker = suffix + "0000000" + sequence + prefix
                        }
                        if (sequence >= 10 && sequence <= 99) {
                            tracker = suffix + "000000" + sequence + prefix
                        }
                        if (sequence >= 100 && sequence <= 999) {
                            tracker = suffix + "00000" + sequence + prefix
                        }
                        if (sequence >= 1000 && sequence <= 9999) {
                            tracker = suffix + "0000" + sequence + prefix
                        }
                        if (sequence >= 10000 && sequence <= 99999) {
                            tracker = suffix + "000" + sequence + prefix
                        }
                        if (sequence >= 100000 && sequence <= 999999) {
                            tracker = suffix + "00" + sequence + prefix
                        }
                        if (sequence >= 1000000 && sequence <= 9999999) {
                            tracker = suffix + "0" + sequence + prefix
                        }
                        if (sequence >= 10000000 && sequence <= 99999999) {
                            tracker = suffix + sequence + prefix
                        }
                    }

                    if (result[0].product == "localdeliveryjb") {
                        let suffix = "GR3"
                        let prefix = "JB"

                        if (sequence >= 0 && sequence <= 9) {
                            tracker = suffix + "0000000" + sequence + prefix
                        }
                        if (sequence >= 10 && sequence <= 99) {
                            tracker = suffix + "000000" + sequence + prefix
                        }
                        if (sequence >= 100 && sequence <= 999) {
                            tracker = suffix + "00000" + sequence + prefix
                        }
                        if (sequence >= 1000 && sequence <= 9999) {
                            tracker = suffix + "0000" + sequence + prefix
                        }
                        if (sequence >= 10000 && sequence <= 99999) {
                            tracker = suffix + "000" + sequence + prefix
                        }
                        if (sequence >= 100000 && sequence <= 999999) {
                            tracker = suffix + "00" + sequence + prefix
                        }
                        if (sequence >= 1000000 && sequence <= 9999999) {
                            tracker = suffix + "0" + sequence + prefix
                        }
                        if (sequence >= 10000000 && sequence <= 99999999) {
                            tracker = suffix + sequence + prefix
                        }
                    }

                    if (result[0].product == "cbsl") {
                        let suffix = "GR5"
                        let prefix = "CB"

                        if (sequence >= 0 && sequence <= 9) {
                            tracker = suffix + "0000000" + sequence + prefix
                        }
                        if (sequence >= 10 && sequence <= 99) {
                            tracker = suffix + "000000" + sequence + prefix
                        }
                        if (sequence >= 100 && sequence <= 999) {
                            tracker = suffix + "00000" + sequence + prefix
                        }
                        if (sequence >= 1000 && sequence <= 9999) {
                            tracker = suffix + "0000" + sequence + prefix
                        }
                        if (sequence >= 10000 && sequence <= 99999) {
                            tracker = suffix + "000" + sequence + prefix
                        }
                        if (sequence >= 100000 && sequence <= 999999) {
                            tracker = suffix + "00" + sequence + prefix
                        }
                        if (sequence >= 1000000 && sequence <= 9999999) {
                            tracker = suffix + "0" + sequence + prefix
                        }
                        if (sequence >= 10000000 && sequence <= 99999999) {
                            tracker = suffix + sequence + prefix
                        }
                    }

                    if (result[0].product == "shein") {
                        let suffix = "GR6"
                        let prefix = "SH"

                        if (sequence >= 0 && sequence <= 9) {
                            tracker = suffix + "0000000" + sequence + prefix
                        }
                        if (sequence >= 10 && sequence <= 99) {
                            tracker = suffix + "000000" + sequence + prefix
                        }
                        if (sequence >= 100 && sequence <= 999) {
                            tracker = suffix + "00000" + sequence + prefix
                        }
                        if (sequence >= 1000 && sequence <= 9999) {
                            tracker = suffix + "0000" + sequence + prefix
                        }
                        if (sequence >= 10000 && sequence <= 99999) {
                            tracker = suffix + "000" + sequence + prefix
                        }
                        if (sequence >= 100000 && sequence <= 999999) {
                            tracker = suffix + "00" + sequence + prefix
                        }
                        if (sequence >= 1000000 && sequence <= 9999999) {
                            tracker = suffix + "0" + sequence + prefix
                        }
                        if (sequence >= 10000000 && sequence <= 99999999) {
                            tracker = suffix + sequence + prefix
                        }
                    }

                    let update = { ['doTrackingNumber']: tracker, ['sequence']: sequence }
                    let option = { upsert: false, new: false }

                    ORDERS.findById(filter)
                        .then((foundOrder) => {
                            if (!foundOrder) {
                                console.log("Order not found.");
                                return;
                            }

                            if ((result[0].product != "fmx") && (result[0].product != "bb") && (result[0].product != "fcas") && (result[0].product != "icarus") && (result[0].product != "ewe")
                                && (result[0].product != "shein")) {
                                foundOrder.doTrackingNumber = tracker;
                                foundOrder.sequence = sequence;
                            }

                            return foundOrder.save();
                        })
                        .then((updatedOrder) => {
                            if (updatedOrder) {
                                if ((result[0].product != "fmx") && (result[0].product != "bb") && (result[0].product != "fcas") && (result[0].product != "icarus") && (result[0].product != "ewe")
                                    && (result[0].product != "shein")) {
                                    let a = whatsappName;
                                    let b = tracker;

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
                                                "name": "order_received",
                                                "components": [
                                                    {
                                                        "type": "header",
                                                        "format": "text",
                                                        "text": "Order Received"
                                                    },
                                                    {
                                                        "text": `Hello ${a},\n\nYour order has been successfully received.\n\nYour tracking number is ${b} which can be tracked on the link below:\n\nwww.gorushbn.com\n\nOur team is now working on fulfilling your order. We appreciate your patience.\n\nFor any further inquiries, please reach us via WhatsApp or call us at 2332065.`,
                                                        "type": "body",
                                                        "parameters": [
                                                            {
                                                                "text": a,
                                                                "type": "text"
                                                            },
                                                            {
                                                                "text": b,
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
                            }
                        })
                        .catch((err) => {
                            console.log(err);
                        });
                }
            },
            (err) => {
                console.log(err)
            }
        )
    }
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});