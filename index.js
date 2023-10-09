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
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Define storage for uploaded images
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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

app.get('/successUpdate', (req, res) => {
    res.render('successUpdate', { processingResults });
});

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
    const consignmentIDs = req.body.consignmentIDs.trim().split('\n').map((id) => id.trim());

    for (const consignmentID of consignmentIDs) {
        try {
            var DetrackAPIrun = 0;
            var FMXAPIrun = 0;
            var ccCheck = 0;
            var ceCheck = 0;
            var product = '';
            var latestPODDate = "";
            var detrackUpdate = "";
            var fmxUpdate = "";

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
            }

            product = data.data.group_name;

            if (product == 'FMX') {
                if ((req.body.statusCode == 'CP') && (ccCheck == 0)) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "custom_clearing" // Use the calculated dStatus
                        }
                    };

                    detrackUpdate = "Detrack status updated to Custom Clearing. ";
                    fmxUpdate = "FMX milestone updated to Custom Clearance In Progress.";

                    DetrackAPIrun = 1;
                    FMXAPIrun = 1;
                }

                if ((req.body.statusCode == 38) && /* (ccCheck == 1) && (data.data.status == 'custom_clearing') */ (data.data.status != 'at_warehouse')) {
                    FMXAPIrun = 1;

                    fmxUpdate = "FMX milestone updated to Custom Clearance Release.";
                }

                if ((req.body.statusCode == 12) && /* (ccCheck == 1) && (data.data.status == 'custom_clearing') */ (data.data.status != 'at_warehouse')) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse" // Use the calculated dStatus
                        }
                    };

                    detrackUpdate = "Detrack status updated to At Warehouse. ";
                    fmxUpdate = "FMX milestone updated to At Warehouse.";

                    DetrackAPIrun = 1;
                    FMXAPIrun = 1;
                }

                if ((req.body.statusCode == 35) && /* (ccCheck == 1) && */ (data.data.status == 'at_warehouse')) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            date: req.body.assignDate, // Get the Assign Date from the form
                            assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                            status: "dispatched" // Use the calculated dStatus
                        }
                    };

                    detrackUpdate = "Detrack status updated to Out for Delivery assigned to " + req.body.dispatchers + ". ";
                    fmxUpdate = "FMX milestone updated to Out for Delivery.";

                    DetrackAPIrun = 1;
                    FMXAPIrun = 1;
                }

                if ((req.body.statusCode == 'NA') && /* (ccCheck == 1) && */ (data.data.status == 'dispatched')) {
                    FMXAPIrun = 1;

                    fmxUpdate = "FMX milestone updated to Failed delivery, Customer cannot be contacted.";

                }

                if ((req.body.statusCode == 44) && /* (ccCheck == 1) && */ (data.data.status != 'at_warehouse')) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse" // Use the calculated dStatus
                        }
                    };

                    detrackUpdate = "Detrack status updated to At Warehouse. ";
                    fmxUpdate = "FMX milestone updated to Failed delivery, return to warehouse.";

                    DetrackAPIrun = 1;
                    FMXAPIrun = 1;
                }

                if ((req.body.statusCode == 'SC') && /* (ccCheck == 1) && */ (data.data.status == 'at_warehouse')) {
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
                }

                if ((req.body.statusCode == 50) && /* (ccCheck == 1) && */ (data.data.status == 'completed')) {
                    FMXAPIrun = 2;

                    fmxUpdate = "FMX milestone updated to Parcel Delivered. ";
                }
            }

            if (product != 'FMX') {
                if ((req.body.statusCode == 12) && (data.data.status != 'at_warehouse') && (product == 'GRP')) {
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
                }

                if ((req.body.statusCode == 12) && (data.data.status != 'at_warehouse') && (product == 'RS')) {
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
                }

                if ((req.body.statusCode == 12) && (data.data.status != 'at_warehouse') && (product != 'GRP') && (product != 'RS')) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse" // Use the calculated dStatus
                        }
                    };

                    detrackUpdate = "Detrack status updated to At Warehouse. ";

                    DetrackAPIrun = 1;
                }

                if ((req.body.statusCode == 35) && (data.data.status == 'at_warehouse')) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            date: req.body.assignDate, // Get the Assign Date from the form
                            assign_to: req.body.dispatchers, // Get the selected dispatcher from the form
                            status: "dispatched" // Use the calculated dStatus
                        }
                    };

                    detrackUpdate = "Detrack status updated to Out for Delivery assigned to " + req.body.dispatchers + ". ";

                    DetrackAPIrun = 1;
                }

                if ((req.body.statusCode == 44) && (data.data.status != 'at_warehouse')) {
                    var detrackUpdateData = {
                        do_number: consignmentID,
                        data: {
                            status: "at_warehouse" // Use the calculated dStatus
                        }
                    };

                    detrackUpdate = "Detrack status updated to At Warehouse. ";

                    DetrackAPIrun = 1;
                }

                if ((req.body.statusCode == 'SC') && (data.data.status == 'at_warehouse')) {
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
                }
            }

            if ((data.data.status == 'completed') || ((DetrackAPIrun == 0) && (FMXAPIrun == 0))) {
                ceCheck = 1;
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
                        console.log(`Detrack Status Updated for Consignment ID: ${consignmentID}`);
                    } else {
                        console.error(`Error updating Detrack Status for Consignment ID: ${consignmentID}`);
                    }
                });
            }

            if (FMXAPIrun == 1) {
                // Step 3: Create data for the second API request
                const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');

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

            if (FMXAPIrun == 2) {
                // Step 3: Make the third API POST request with accessToken
                const currentDate = moment(latestPODDate).format('YYYY-MM-DD HH:mm:ss');
                const fileName = `${consignmentID}_POD`;

                const photo1FileUrl = data.data.photo_1_file_url;

                // Download the image from data.photo_1_file_url
                const imageResponse = await axios.get(photo1FileUrl, { responseType: 'arraybuffer' });

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
                    status: 'Error: Tracking Number is either not updated properly to flow or already completed',
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

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
