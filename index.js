require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const moment = require('moment');
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

// Import the shared schema
const podSchema = require('./schemas/podSchema');

// Import your models
const PharmacyPOD = require('./models/PharmacyPOD');
const LDPOD = require('./models/LDPOD');
const GRPPOD = require('./models/GRPPOD');
const FMXPOD = require('./models/FMXPOD');
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

// Render the scanFMX page
app.get('/', (req, res) => {
    processingResults.length = 0;
    res.render('updateDelivery');
});

app.get('/podGenerator', (req, res) => {
    // Render the form page with EJS
    res.render('podGenerator');
});

app.get('/addressAreaCheck', (req, res) => {
    res.render('addressAreaCheck');
});

app.get('/successUpdate', (req, res) => {
    res.render('successUpdate', { processingResults });
});

app.get('/listofpharmacyMOHEXPOrders', async (req, res) => {
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
                'sendOrderTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHEXPOrders', { orders });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyMOHSTDOrders', async (req, res) => {
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
                'sendOrderTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHSTDOrders', { orders });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.post('/createPharmacyFormSuccess', async (req, res) => {
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
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to create Pharmacy Form');
    }
});

app.get('/listofpharmacyMOHTTGOrders', async (req, res) => {
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
                'sendOrderTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHTTGOrders', { orders });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyMOHKBOrders', async (req, res) => {
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
                'sendOrderTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHKBOrders', { orders });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyMOHIMMOrders', async (req, res) => {
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
                'sendOrderTo'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyMOHIMMOrders', { orders });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyJPMCOrders', async (req, res) => {
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
                'membership'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyJPMCOrders', { orders });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyPHCOrders', async (req, res) => {
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
                'membership'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofpharmacyPHCOrders', { orders });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofLDOrders', async (req, res) => {
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
                'membership'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofLDOrders', { orders });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofGRPOrders', async (req, res) => {
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
                'membership'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofGRPOrders', { orders });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofCBSLOrders', async (req, res) => {
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
                'membership'
            ])
            .sort({ _id: -1 });

        // Render the EJS template with the filtered and sorted orders
        res.render('listofCBSLOrders', { orders });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Failed to fetch orders');
    }
});

app.get('/listofpharmacyMOHForms', async (req, res) => {
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
        res.render('listofpharmacyMOHForms', { forms });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch Pharmacy Form data');
    }
});

// Add a new route in your Express application
app.get('/formpharmacyDetail/:formId', async (req, res) => {
    try {
        const form = await PharmacyFORM.findById(req.params.formId);

        if (!form) {
            return res.status(404).send('Form not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('formpharmacyDetail', { htmlContent: form.htmlContent });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch form data');
    }
});

// Route to render the edit page for a specific POD
app.get('/editPharmacyForm/:id', (req, res) => {
    const formId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    PharmacyFORM.findById(formId)
        .then((form) => {
            if (!form) {
                return res.status(404).send('Form not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editPharmacyForm.ejs', { form });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to update the HTML content of a specific POD
app.post('/updatePharmacyForm/:id', (req, res) => {
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

app.get('/deletePharmacyForm/:formId', async (req, res) => {
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

app.get('/listofpharmacyPod', async (req, res) => {
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
        res.render('listofpharmacyPod', { pods });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch Pharmacy POD data');
    }
});

app.get('/listofldPod', async (req, res) => {
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
        res.render('listofldPod', { pods });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch Local Delivery POD data');
    }
});

app.get('/listofgrpPod', async (req, res) => {
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
        res.render('listofgrpPod', { pods });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch GRP POD data');
    }
});

app.get('/listoffmxPod', async (req, res) => {
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
        res.render('listoffmxPod', { pods });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch FMX POD data');
    }
});

app.get('/listofcbslPod', async (req, res) => {
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
        res.render('listofcbslPod', { pods });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch FMX POD data');
    }
});

// Add a new route in your Express application
app.get('/podpharmacyDetail/:podId', async (req, res) => {
    try {
        const pod = await PharmacyPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podpharmacyDetail', { htmlContent: pod.htmlContent });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Add a new route in your Express application
app.get('/podldDetail/:podId', async (req, res) => {
    try {
        const pod = await LDPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podldDetail', { htmlContent: pod.htmlContent });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Add a new route in your Express application
app.get('/podgrpDetail/:podId', async (req, res) => {
    try {
        const pod = await GRPPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podgrpDetail', { htmlContent: pod.htmlContent });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Add a new route in your Express application
app.get('/podfmxDetail/:podId', async (req, res) => {
    try {
        const pod = await FMXPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podfmxDetail', { htmlContent: pod.htmlContent });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Add a new route in your Express application
app.get('/podcbslDetail/:podId', async (req, res) => {
    try {
        const pod = await CBSLPOD.findById(req.params.podId);

        if (!pod) {
            return res.status(404).send('POD not found');
        }

        // Render the podDetail.ejs template with the HTML content
        res.render('podcbslDetail', { htmlContent: pod.htmlContent });
    } catch (error) {
        console.error('Error:', error);
        // Handle the error and send an error response
        res.status(500).send('Failed to fetch POD data');
    }
});

// Route to render the edit page for a specific POD
app.get('/editPharmacyPod/:id', (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    PharmacyPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editPharmacyPod.ejs', { pod });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to update the HTML content of a specific POD
app.post('/updatePharmacyPod/:id', (req, res) => {
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
app.get('/editLdPod/:id', (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    LDPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editLdPod.ejs', { pod });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to update the HTML content of a specific POD
app.post('/updateLdPod/:id', (req, res) => {
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
app.get('/editGrpPod/:id', (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    GRPPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editGrpPod.ejs', { pod });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to update the HTML content of a specific POD
app.post('/updateGrpPod/:id', (req, res) => {
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
app.get('/editFmxPod/:id', (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    FMXPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editFmxPod.ejs', { pod });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to render the edit page for a specific POD
app.get('/editCbslPod/:id', (req, res) => {
    const podId = req.params.id;

    // Find the specific POD by ID, assuming you have a MongoDB model for your PODs
    CBSLPOD.findById(podId)
        .then((pod) => {
            if (!pod) {
                return res.status(404).send('POD not found');
            }

            // Render the edit page, passing the found POD data
            res.render('editCbslPod.ejs', { pod });
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to retrieve POD data');
        });
});

// Route to update the HTML content of a specific POD
app.post('/updateFmxPod/:id', (req, res) => {
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
app.post('/updateCbslPod/:id', (req, res) => {
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

app.get('/deletePharmacyPod/:podId', async (req, res) => {
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

app.get('/deleteLDPod/:podId', async (req, res) => {
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

app.get('/deleteGRPPod/:podId', async (req, res) => {
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

app.get('/deleteFMXPod/:podId', async (req, res) => {
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

app.get('/deleteCBSLPod/:podId', async (req, res) => {
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
app.post('/save-form', (req, res) => {
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
app.post('/save-pod', (req, res) => {
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
        case 'CBSL POD':
            PodModel = CBSLPOD;
            break;
        default:
            return res.status(400).send('Invalid collection');
    }

    console.log(PodModel)

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

    console.log(newPod)

    newPod.save()
        .then(() => {
            res.status(200).send('POD data saved successfully');
        })
        .catch((err) => {
            console.error('Error:', err);
            res.status(500).send('Failed to save POD data');
        });
});

app.post('/generatePOD', async (req, res) => {
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
            podCreatedDate: moment().format('DD.MM.YY')
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/addressAreaCheck', (req, res) => {
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

    res.render('successAddressArea', { entries: result });
});

// Function to update the document in the ORDERS collection
/* async function updateOrdersDocument(consignmentID, req) {
    try {
        const filter = { doTrackingNumber: consignmentID };
        const update = {
            $set: {
                lastUpdateDateTime: moment().format(),
            },
        };

        if ((req.body.dispatchers == "FL1") || (req.body.dispatchers == "FL2") || (req.body.dispatchers == "FL3") || (req.body.dispatchers == "FL4") || (req.body.dispatchers == "FL5")) {
            var finalDispatcherName = req.body.dispatchers.toUpperCase() + " " + req.body.freelancerName.toUpperCase()
        } else {
            var finalDispatcherName = req.body.dispatchers.toUpperCase()
        }

        // Update based on different status codes
        if (req.body.statusCode === 'CP') {
            update.$set.currentStatus = 'Custom Clearance in Progress';

            // Add new entry to history array
            update.$push = {
                history: {
                    statusHistory: 'Custom Clearance in Progress',
                    dateUpdated: moment().format(),
                    updatedBy: 'User',
                },
            };
        } else if (req.body.statusCode === '38') {
            update.$set.currentStatus = 'Custom Clearance Release';

            // Add new entry to history array
            update.$push = {
                history: {
                    statusHistory: 'Custom Clearance Release',
                    dateUpdated: moment().format(),
                    updatedBy: 'User',
                },
            };
        } else if (req.body.statusCode === '12') {
            update.$set.warehouseEntry = 'Yes';
            update.$set.warehouseEntryDateTime = moment().format();
            update.$set.currentStatus = 'Item in Warehouse';

            // Add new entry to history array
            update.$push = {
                history: {
                    statusHistory: 'Item in Warehouse',
                    dateUpdated: moment().format(),
                    updatedBy: 'User',
                },
            };
        } else if (req.body.statusCode === 35) {
            update.$set.currentStatus = 'Out for Delivery';
            update.$inc = { attempt: 1 };
            update.$set.assignedTo = finalDispatcherName;

            // Add new entry to history array
            update.$push = {
                history: {
                    statusHistory: 'Out for Delivery',
                    dateUpdated: moment().format(),
                    updatedBy: 'User',
                    lastAssignedTo: finalDispatcherName,
                },
            };
        } else if (req.body.statusCode === 'SD') {
            update.$set.lastUpdateDateTime = moment().format();
            update.$set.assignedTo = finalDispatcherName;

            // Add new entry to history array
            update.$push = {
                history: {
                    statusHistory: 'Out for Delivery',
                    dateUpdated: moment().format(),
                    updatedBy: 'User',
                    lastAssignedTo: finalDispatcherName,
                },
            };
        } else if (
            req.body.statusCode === 'MD' ||
            req.body.statusCode === 'RF' ||
            req.body.statusCode === 'FD' ||
            req.body.statusCode === 'SC' ||
            req.body.statusCode === 44
        ) {
            update.$set.currentStatus = 'Failed Delivery. Return to Warehouse';

            // Add new entry to history array
            update.$push = {
                history: {
                    statusHistory: 'Failed Delivery. Return to Warehouse',
                    dateUpdated: moment().format(),
                    updatedBy: 'User',
                    lastFailedReason: req.body.additionalReason,
                },
            };
        } else if (req.body.statusCode === 'CSSC') {
            update.$set.currentStatus = 'Self Collect';
            update.$inc = { attempt: 1 };
            update.$set.assignedTo = 'Selfcollect';

            // Add new entry to history array
            update.$push = {
                history: {
                    statusHistory: 'Self Collect',
                    dateUpdated: moment().format(),
                    updatedBy: 'User',
                    lastAssignedTo: 'Selfcollect',
                },
            };
        } else if (req.body.statusCode === 50) {
            update.$set.currentStatus = 'Success/Completed';

            // Add new entry to history array
            update.$push = {
                history: {
                    statusHistory: 'Success/Completed',
                    dateUpdated: moment().format(),
                    updatedBy: 'User',
                },
            };
        }

        // Update the document in the ORDERS collection
        const result = await ORDERS.updateOne(filter, update);

        if (result.modifiedCount === 1) {
            console.log(`Document updated successfully for Consignment ID: ${consignmentID}`);
        } else {
            console.log(`No document found for Consignment ID: ${consignmentID}`);
        }
    } catch (error) {
        console.error(`Error updating document for Consignment ID: ${consignmentID}`, error);
    }
} */

// Handle form submission for /scanFMX route
app.post('/updateDelivery', async (req, res) => {

    console.log("Update FMX Status " + req.body.statusCode);
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
            var ccCheck = 0;
            var ceCheck = 0;
            var product = '';
            var latestPODDate = "";
            var detrackUpdate = "";
            var fmxUpdate = "";
            var currentDetrackStatus = "";
            var fmxReason = "";

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
                if (data.data.milestones[i].status == 'custom_clearing') {
                    ccCheck = 1;
                }
                if (data.data.milestones[i].status == 'completed') {
                    latestPODDate = data.data.milestones[i].pod_at;
                }
                if (data.data.milestones[i].status == 'failed') {
                    fmxReason = data.data.milestones[i].reason;
                }
            }

            product = data.data.group_name;

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

            if (req.body.statusCode == 'CP') {
                appliedStatus = "Custom Clearance in Progress"
            }

            if (req.body.statusCode == 38) {
                appliedStatus = "Custom Clearance Release"
            }

            if (req.body.statusCode == 12) {
                appliedStatus = "Item in Warehouse"
            }

            if (req.body.statusCode == 35) {
                appliedStatus = "Out for Delivery"
            }

            if (req.body.statusCode == 'SD') {
                appliedStatus = "Swap Dispatchers"
            }

            if (req.body.statusCode == 'MD') {
                appliedStatus = "Failed Delivery due to Unattempted Delivery. Return to Warehouse(FMX)"
            }

            if (req.body.statusCode == 'RF') {
                appliedStatus = "Failed Delivery due to Customer Declined Delivery. Return to Warehouse(FMX)"
            }

            if (req.body.statusCode == 'FD') {
                appliedStatus = "Failed Delivery due to Reschedule Delivery Requested By Customer. Return to Warehouse (FMX)"
            }

            if (req.body.statusCode == 'SC') {
                appliedStatus = "Failed Delivery due to Reschedule to Self Collect Requested By Customer. Return to Warehouse (FMX)"
            }

            if (req.body.statusCode == 44) {
                appliedStatus = "Failed Delivery (optional additional remarks for FMX). Return To Warehouse"
            }

            if (req.body.statusCode == 'CSSC') {
                appliedStatus = "Self Collect"
            }

            if (req.body.statusCode == 50) {
                appliedStatus = "Success/Completed"
            }

            if (product == 'FMX') {
                if ((req.body.statusCode == 'CP') && (ccCheck == 0)) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "custom_clearing",
                            instructions: "FMX Milestone ID CP"
                        }
                    };

                    detrackUpdate = "Detrack status updated to Custom Clearing. ";
                    fmxUpdate = "FMX milestone updated to Custom Clearance In Progress.";

                    DetrackAPIrun = 1;
                    FMXAPIrun = 1;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 38) && (ccCheck == 1) && (data.data.status == 'custom_clearing') && (data.data.instructions.includes('CP'))) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            instructions: "FMX Milestone ID 38"
                        }
                    };

                    fmxUpdate = "FMX milestone updated to Custom Clearance Release.";

                    DetrackAPIrun = 1;
                    FMXAPIrun = 1;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 12) && (ccCheck == 1) && (data.data.status == 'custom_clearing') && (data.data.instructions.includes('38'))) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse",
                            instructions: "FMX Milestone ID 12"
                        }
                    };

                    detrackUpdate = "Detrack status updated to At Warehouse. ";
                    fmxUpdate = "FMX milestone updated to At Warehouse.";

                    DetrackAPIrun = 1;
                    FMXAPIrun = 1;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 35) && (data.data.status == 'at_warehouse')) {
                    if ((req.body.dispatchers == "FL1") || (req.body.dispatchers == "FL2") || (req.body.dispatchers == "FL3") || (req.body.dispatchers == "FL4") || (req.body.dispatchers == "FL5")) {
                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                date: req.body.assignDate, // Get the Assign Date from the form
                                assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                status: "dispatched", // Use the calculated dStatus
                                instructions: "FMX Milestone ID 12. Assigned to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + "."
                            }
                        };

                        detrackUpdate = "Detrack status updated to Out for Delivery assigned to " + req.body.dispatchers + " " + req.body.freelancerName + ". ";

                    } else {
                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                date: req.body.assignDate, // Get the Assign Date from the form
                                assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                status: "dispatched", // Use the calculated dStatus
                                instructions: "FMX Milestone ID 12. Assigned to " + req.body.dispatchers + " on " + req.body.assignDate + "."
                            }
                        };

                        detrackUpdate = "Detrack status updated to Out for Delivery assigned to " + req.body.dispatchers + ". ";
                    }

                    fmxUpdate = "FMX milestone updated to Out for Delivery.";

                    DetrackAPIrun = 1;
                    FMXAPIrun = 1;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 'SD') && (data.data.status == 'dispatched')) {
                    if ((req.body.dispatchers == "FL1") || (req.body.dispatchers == "FL2") || (req.body.dispatchers == "FL3") || (req.body.dispatchers == "FL4") || (req.body.dispatchers == "FL5")) {
                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                date: req.body.assignDate, // Get the Assign Date from the form
                                assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                instructions: "FMX Milestone ID 12. Assigned to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + "."
                            }
                        };

                        detrackUpdate = "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + ". ";

                    } else {
                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                date: req.body.assignDate, // Get the Assign Date from the form
                                assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                instructions: "FMX Milestone ID 12. Assigned to " + req.body.dispatchers + " on " + req.body.assignDate + "."
                            }
                        };

                        detrackUpdate = "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + ". ";
                    }

                    DetrackAPIrun = 1;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 'MD') && (data.data.status == 'failed')) {
                    fmxUpdate = "FMX milestone updated to Failed Delivery due to Unattempted Delivery (MD). Return to Warehouse (44).";
                    detrackUpdate = "Detrack status updated to At Warehouse. ";

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse", // Use the calculated dStatus
                            note: fmxUpdate,
                            instructions: "FMX Milestone ID MD 44"
                        }
                    };

                    var detrackUpdateDataAttempt = {
                        data: {
                            do_number: consignmentID,
                        }
                    };

                    DetrackAPIrun = 2;
                    FMXAPIrun = 3;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 'RF') && (data.data.status == 'failed')) {
                    fmxReason = req.body.additionalReason;

                    fmxUpdate = "FMX milestone updated to Failed Delivery. Customer Declined Delivery (RF) due to " + fmxReason + ". Return to Warehouse (44).";

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse", // Use the calculated dStatus
                            note: fmxUpdate,
                            instructions: "FMX Milestone ID RF 44"
                        }
                    };

                    var detrackUpdateDataAttempt = {
                        data: {
                            do_number: consignmentID,
                        }
                    };

                    DetrackAPIrun = 2;
                    FMXAPIrun = 3;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 'FD') && (data.data.status == 'failed')) {
                    fmxReason = req.body.additionalReason;

                    fmxUpdate = "FMX milestone updated to Failed Delivery. Reschedule Delivery Requested By Customer (FD) to " + fmxReason + ". Return to Warehouse (44).";

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse", // Use the calculated dStatus
                            note: fmxUpdate,
                            instructions: "FMX Milestone ID FD 44"
                        }
                    };

                    var detrackUpdateDataAttempt = {
                        data: {
                            do_number: consignmentID,
                        }
                    };

                    DetrackAPIrun = 2;
                    FMXAPIrun = 3;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 'SC') && (data.data.status == 'failed')) {
                    fmxReason = req.body.additionalReason;

                    fmxUpdate = "FMX milestone updated to Failed Delivery. Reschedule to Self Collect Requested By Customer (SC) to " + fmxReason + ". Return to Warehouse (44).";

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse", // Use the calculated dStatus
                            note: fmxUpdate,
                            instructions: "FMX Milestone ID SC 44"
                        }
                    };

                    var detrackUpdateDataAttempt = {
                        data: {
                            do_number: consignmentID,
                        }
                    };

                    DetrackAPIrun = 2;
                    FMXAPIrun = 3;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 44) && (data.data.status == 'failed')) {
                    if (req.body.additionalReason.length != 0) {
                        fmxReason = req.body.additionalReason;
                    }

                    detrackUpdate = "Detrack status updated to At Warehouse. ";
                    fmxUpdate = "FMX milestone updated to Failed delivery, return to warehouse (44). Reason: " + fmxReason;

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse", // Use the calculated dStatus
                            note: fmxUpdate,
                            instructions: "FMX Milestone ID 44"
                        }
                    };

                    var detrackUpdateDataAttempt = {
                        data: {
                            do_number: consignmentID,
                        }
                    };

                    DetrackAPIrun = 2;
                    FMXAPIrun = 2;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 'CSSC') && (data.data.status == 'at_warehouse')) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            date: req.body.assignDate, // Get the Assign Date from the form
                            assign_to: "Selfcollect", // Get the selected dispatcher from the form
                            status: "dispatched" // Use the calculated dStatus
                        }
                    };

                    detrackUpdate = "Detrack status updated for Self Collect. ";

                    DetrackAPIrun = 1;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 50) && (data.data.status == 'completed')) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            instructions: "FMX Milestone ID 50"
                        }
                    };

                    fmxUpdate = "FMX milestone updated to Parcel Delivered. ";

                    DetrackAPIrun = 1;
                    FMXAPIrun = 5;
                    mongoDBrun = 1;
                }

                if (req.body.statusCode == 'CD') {
                    if (req.body.additionalReason.length != 0) {
                        fmxReason = req.body.additionalReason;
                    }

                    detrackUpdate = "Detrack status updated to Cancelled. ";
                    fmxUpdate = "FMX milestone updated to Customer Declined Delivery (RF). Reason: " + fmxReason;

                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "cancelled",
                            note: fmxUpdate,
                            instructions: "FMX Milestone ID RF"
                        }
                    };

                    DetrackAPIrun = 1;
                    FMXAPIrun = 2;
                    mongoDBrun = 1;
                }
            }

            if (product != 'FMX') {
                if ((req.body.statusCode == 12) && (data.data.status != 'at_warehouse') && (data.data.status != 'completed') && (product == 'GRP')) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse", // Use the calculated dStatus
                            do_number: data.data.tracking_number,
                            tracking_number: consignmentID
                        }
                    };

                    detrackUpdate = "Detrack status updated to At Warehouse. ";

                    DetrackAPIrun = 1;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 12) && (data.data.status != 'at_warehouse') && (data.data.status != 'completed') && (product == 'CBSL')) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse", // Use the calculated dStatus
                            do_number: data.data.tracking_number,
                            tracking_number: consignmentID
                        }
                    };

                    detrackUpdate = "Detrack status updated to At Warehouse. ";

                    DetrackAPIrun = 1;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 12) && (data.data.status != 'at_warehouse') && (data.data.status != 'completed') && (product != 'GRP') && (product != 'CBSL')) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse" // Use the calculated dStatus
                        }
                    };

                    detrackUpdate = "Detrack status updated to At Warehouse. ";

                    DetrackAPIrun = 1;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 35) && (data.data.status == 'at_warehouse')) {
                    if ((req.body.dispatchers == "FL1") || (req.body.dispatchers == "FL2") || (req.body.dispatchers == "FL3") || (req.body.dispatchers == "FL4") || (req.body.dispatchers == "FL5")) {
                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                date: req.body.assignDate, // Get the Assign Date from the form
                                assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                status: "dispatched", // Use the calculated dStatus
                                instructions: "Assigned to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + "."
                            }
                        };

                        detrackUpdate = "Detrack status updated to Out for Delivery assigned to " + req.body.dispatchers + " " + req.body.freelancerName + ". ";

                    } else {
                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                date: req.body.assignDate, // Get the Assign Date from the form
                                assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                status: "dispatched", // Use the calculated dStatus
                                instructions: "Assigned to " + req.body.dispatchers + " on " + req.body.assignDate + "."
                            }
                        };

                        detrackUpdate = "Detrack status updated to Out for Delivery assigned to " + req.body.dispatchers + ". ";
                    }

                    DetrackAPIrun = 1;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 'SD') && (data.data.status == 'dispatched')) {
                    if ((req.body.dispatchers == "FL1") || (req.body.dispatchers == "FL2") || (req.body.dispatchers == "FL3") || (req.body.dispatchers == "FL4") || (req.body.dispatchers == "FL5")) {
                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                date: req.body.assignDate, // Get the Assign Date from the form
                                assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                instructions: "Assigned to " + req.body.dispatchers + " " + req.body.freelancerName + " on " + req.body.assignDate + "."
                            }
                        };

                        detrackUpdate = "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + " " + req.body.freelancerName + ". ";

                    } else {
                        var detrackUpdateData = {
                            do_number: consignmentID,
                            data: {
                                date: req.body.assignDate, // Get the Assign Date from the form
                                assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                                instructions: "Assigned to " + req.body.dispatchers + " on " + req.body.assignDate + "."
                            }
                        };

                        detrackUpdate = "Change dispatchers from " + data.data.assign_to + " to " + req.body.dispatchers + ". ";
                    }

                    DetrackAPIrun = 1;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 44) && (data.data.status != 'at_warehouse')) {
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

                    detrackUpdate = "Detrack status updated to At Warehouse. ";

                    DetrackAPIrun = 2;
                    mongoDBrun = 1;
                }

                if ((req.body.statusCode == 'CSSC') && (data.data.status == 'at_warehouse')) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            date: req.body.assignDate, // Get the Assign Date from the form
                            assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                            status: "dispatched" // Use the calculated dStatus
                        }
                    };

                    detrackUpdate = "Detrack status updated for Self Collect. ";

                    DetrackAPIrun = 1;
                    mongoDBrun = 1;
                }

                if (req.body.statusCode == 'CD') {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "cancelled",
                            note: req.body.additionalReason
                        }
                    };

                    detrackUpdate = "Detrack status updated to Cancelled. ";

                    DetrackAPIrun = 1;
                    mongoDBrun = 1;
                }
            }

            if (((req.body.statusCode != 50) && (data.data.status == 'completed')) || ((DetrackAPIrun == 0) && (FMXAPIrun == 0))) {
                ceCheck = 1;
            }

            /* if (mongoDBrun == 1) {
                // Call the function to update the ORDERS document
                await updateOrdersDocument(consignmentID, req);
            } */

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
                        console.log(`Detrack Status Updated for Consignment ID: ${consignmentID}`);
                    } else {
                        console.error(`Error updating Detrack Status for Consignment ID: ${consignmentID}`);
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
                                console.log(`Detrack Status Updated for Consignment ID: ${consignmentID}`);
                            } else {
                                console.error(`Error updating Detrack Status for Consignment ID: ${consignmentID}`);
                            }
                        });
            
                    } else {
                        console.error(`Error increase attempt by 1 for Consignment ID: ${consignmentID}`);
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
                    StatusCode: req.body.statusCode,
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
                    CityName: 'BN',
                    ConsigneeName: '',
                    Remark: fmxReason
                };

                if (req.body.statusCode == 'CD') {
                    requestData.StatusCode = 'RF';
                } else {
                    requestData.StatusCode = req.body.statusCode;
                }

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
                const statusCodesToRun = [req.body.statusCode, '44']; // Replace with actual status codes

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
                        ConsigneeName: ''
                    };

                    if (req.body.statusCode != 'MD') {
                        // Conditionally set the Remark field in the first run
                        if (i == 0) {
                            requestData.Remark = fmxReason;
                        }
                    }

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

                console.log(selectedPhotoUrl);

                // Download the image from the selected photo URL
                const imageResponse = await axios.get(selectedPhotoUrl, { responseType: 'arraybuffer' });

                if (imageResponse.status !== 200) {
                    throw new Error('Error occurred during image download');
                }

                // Convert the image to base64
                const base64Image = Buffer.from(imageResponse.data, 'binary').toString('base64');

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
                    StatusCode: req.body.statusCode,
                    CityName: 'BN',
                    ConsigneeName: ''
                }, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                // Show a success message
                console.log(response3.data);
                console.log('Success');
            }

            if (ceCheck == 0) {
                // If processing is successful, add a success message to the results array
                processingResults.push({
                    consignmentID,
                    status: detrackUpdate + fmxUpdate,
                });
            } else {
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
    res.redirect('/successUpdate'); // Redirect to the successUpdate page
});

orderWatch.on('change', change => {
    console.log("test mongodb")
    console.log(change.operationType)
    if (change.operationType == "insert") {
        ORDERS.find().sort({ $natural: -1 }).then(
            (result) => {
                let filter = new mongoose.Types.ObjectId(result[0]._id);

                console.log(filter)

                if (result[0].product != null) {
                    let products = result[0].product

                    console.log(products)

                    if (products.includes("pharmacy") == true) {
                        products = "pharmacy"
                    }

                    let tracker
                    let sequence
                    let sequenceToAdd = 0;
                    let phoneNumber = result[0].receiverPhoneNumber.replace(/[`'"+@]+/g, '').trim();

                    console.log(sequence)

                    let checkProduct = 0;

                    if ((result.length >= 2) && (checkProduct == 0)) {
                        console.log("done check length and product")
                        for (let i = 1; i < result.length; i++) {
                            if (result[i].product.includes(products)) {
                                if (result[i].sequence == "N/A") {
                                    sequenceToAdd = parseInt(sequenceToAdd) + 1;
                                }
                                else {
                                    sequence = parseInt(result[i].sequence) + 1 + parseInt(sequenceToAdd)
                                    checkProduct = 1
                                    i = result.length
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

                    console.log(tracker + " " + sequence)
                    let update = { ['doTrackingNumber']: tracker, ['sequence']: sequence }
                    console.log(update)
                    let option = { upsert: false, new: false }

                    ORDERS.findById(filter)
                        .then((foundOrder) => {
                            if (!foundOrder) {
                                console.log("Order not found.");
                                return;
                            }

                            foundOrder.doTrackingNumber = tracker;
                            foundOrder.sequence = sequence;

                            return foundOrder.save();
                        })
                        .then((updatedOrder) => {
                            if (updatedOrder) {
                                console.log(updatedOrder.doTrackingNumber);
                                console.log(updatedOrder);

                                if (phoneNumber.length <= 10) {
                                    var optInNumber = "00" + phoneNumber
                                }

                                if (phoneNumber.length > 10) {
                                    var optInNumber = phoneNumber
                                }

                                let gid = "2000215252"
                                let pas = "6@SemFzr"
                                let format = "json"
                                let auth_scheme = "plain"

                                let b = tracker

                                let msg = `Hello%2C%0A%0AWe+have+received+your+order.+Please+refer+to+the+following+for+your+reference.%0A%0ATracking+Number%3A+${b}%0A%0AOur+team+will+process+your+order.+Thank+you`

                                const URL = `https://media.smsgupshup.com/GatewayAPI/rest?userid=2000215252&password=6@SemFzr&send_to=${optInNumber}&v=1.1&format=json&msg_type=TEXT&method=SENDMESSAGE&msg=${msg}&isTemplate=true&header=Order+Confirmation&footer=Go+Rush+Express`

                                let OPT_IN_URL = `https://media.smsgupshup.com/GatewayAPI/rest?method=OPT_IN&format=${format}&userid=${gid}&password=${pas}&phone_number=${optInNumber}&v=1.1&auth_scheme=${auth_scheme}&channel=WHATSAPP`
                                axios.get(OPT_IN_URL).then(response => { axios.post(URL).then(response => { console.log(response) }).catch(err => { console.log(err) }) }).catch(err => { console.log(err) })
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
