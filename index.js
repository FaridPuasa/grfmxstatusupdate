const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const moment = require('moment');

const app = express();
const port = 3000; // Change this to your desired port number

// Serve static files from the "public" directory
app.use(express.static('public'));

const apiKey = 'd4dfab3975765c8ffa920d9a0c6bda0c12d17a35a946d337'; // Replace with your API key

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));


// Define storage for uploaded images
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Render the scanFMX page
app.get('/scanFMX', (req, res) => {
  res.render('scanFMX');
});

// Render the initial page
app.get('/scanFMXwithPOD', (req, res) => {
  res.render('scanFMXwithPOD', { base64Image: null });
});

app.get('/scanFMXsuccess', (req, res) => {
  res.render('scanFMXsuccess'); // Render the success.ejs page
});

app.get('/scanFMXwithPODsuccess', (req, res) => {
  res.render('scanFMXwithPODsuccess'); // Render the success.ejs page
});

// Handle form submission
app.post('/scanFMX', async (req, res) => {
  try {
    // Step 1: Authenticate and get accessToken
    const authResponse = await axios.post('https://client.fmx.asia/api/tokenauth/authenticate', {
      userNameOrEmailAddress: 'glba0001',
      password: 'JsbQmg778XhBGTMP',
      source: 'string'
    });

    const accessToken = authResponse.data.result.accessToken;

    // Step 2: Create data for the second API
    const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');

    // Split the tracking numbers by newlines
    const consignmentIDs = req.body.consignmentIDs.split('\n').map((id) => id.trim());

    for (const consignmentID of consignmentIDs) {
      // Skip empty lines
      if (!consignmentID) continue;

      console.log('Processing Consignment ID:', consignmentID);
      console.log("current status  is " + req.body.statusCode)

      const data = {
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

      // Step 3: Make the second API request with bearer token
      const response = await axios.post('https://client.fmx.asia/api/v1/order/milestone/create', data, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      // Handle success response
      // You can customize this part with appropriate notifications and redirections
      console.log('API response:', response.data);
    }

    console.log('Success');
    res.redirect('/scanFMXsuccess'); // Redirect to the success page
  } catch (error) {
    // Handle error
    console.error('API error:', error);
    res.send('Error'); // Sending a simple error response
  }
});

// Handle form submission
app.post('/scanFMXwithPOD', async (req, res) => {
  try {
    // Get the tracking numbers from the textarea and split them into an array
    const consignmentIDs = req.body.consignmentIDs.trim().split('\n').map((id) => id.trim());

    // Loop through each tracking number
    for (const consignmentID of consignmentIDs) {

      console.log('Processing Consignment ID:', consignmentID);
      // Step 1: Make the first API GET request to fetch data.photo_1_file_url
      const response1 = await axios.get(`https://app.detrack.com/api/v2/dn/jobs/show/?do_number=${consignmentID}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey
        }
      });

      const data = response1.data;

      // Step 2: Make the second API POST request to authenticate and get the accessToken
      const authResponse = await axios.post('https://client.fmx.asia/api/tokenauth/authenticate', {
        userNameOrEmailAddress: 'glba0001',
        password: 'JsbQmg778XhBGTMP',
        source: 'string'
      });

      const accessToken = authResponse.data.result.accessToken;

      const counttaskhistory = data.data.milestones.length;

      var latestPODDate = "";

      for (let i = 0; i < counttaskhistory; i++) {
        if (data.data.milestones[i].status == 'completed') {
          latestPODDate = data.data.milestones[i].pod_at;
        }
      }

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
        StatusCode: '50',
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
    res.redirect('/scanFMXwithPODsuccess'); // Redirect to the success page
  } catch (error) {
    // Handle error
    console.error('API error:', error.message);
    res.send('Error occurred during the process'); // Sending a simple error response
  }
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
