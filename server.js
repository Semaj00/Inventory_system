#!/usr/bin/env node
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const axios = require('axios'); // Add axios for making HTTP requests

const app = express();
const port = 3019;

// Middleware to parse JSON bodies with increased limit
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve static files
app.use(express.static(__dirname));

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Set up multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir); // Use the uploadsDir variable
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// MongoDB connection
const mongoURI = 'mongodb://localhost:27017/inventory_system';

// Set Mongoose to use native Promises
mongoose.Promise = global.Promise;

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds if MongoDB is unreachable
})
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1); // Exit the app if the database connection fails
    });

// Define a schema and model for items
const itemSchema = new mongoose.Schema({
    itemName: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
    },
});

const Item = mongoose.model('Item', itemSchema);

// Define a schema and model for login data
const loginSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
});

const Login = mongoose.model('Login', loginSchema);

// Define a schema and model for request data
const requestSchema = new mongoose.Schema({
    requestNo: String,
    itemName: String,
    quantity: Number,
    dateNeeded: String, // Change to String to store formatted date
    borrowerName: String,
    idNumber: String,
    courseYearSection: String // Updated field name
});

const Request = mongoose.model('Request', requestSchema);

// Define a schema and model for return data
const returnSchema = new mongoose.Schema({
    requestNo: String,
    itemName: String,
    quantity: Number,
    dateRequested: String,
    borrowerName: String,
    idNumber: String,
    courseYearSection: String,
    dateReturned: String, // Added field
    completion: String, // Added field
    condition: String // Added field
});

const Return = mongoose.model('Return', returnSchema);

// Define a schema and model for request log data
const requestLogSchema = new mongoose.Schema({
    requestNo: String,
    itemName: String,
    quantity: Number,
    dateRequested: String,
    borrowerName: String,
    idNumber: String,
    courseYearSection: String,
    dateReturned: String,
    completion: String,
    condition: String
});

const RequestLog = mongoose.model('RequestLog', requestLogSchema);

// Serve the login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'try.html'));
});

// Serve the create account page
app.get('/create-account', (req, res) => {
    res.sendFile(path.join(__dirname, 'create.html'));
});

// Serve the add request page
app.get('/add', (req, res) => {
    res.sendFile(path.join(__dirname, 'add.html'));
});

// Handle login
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        // Check if the user exists and the password matches
        const existingLogin = await Login.findOne({ username, password });

        if (existingLogin) {
            console.log('Login successful:', username);
            return res.status(200).json({ success: true });
        } else {
            console.log('Login failed: incorrect username or password');
            return res.status(401).json({ success: false, message: 'Incorrect username or password' });
        }
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).send('Internal server error');
    }
});

// Handle account creation
app.post('/create-account', async (req, res) => {
    try {
        const { email, username, password } = req.body;

        if (!email || !username || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Check if the username already exists
        const existingLogin = await Login.findOne({ username });

        if (existingLogin) {
            console.log('Account creation failed: username already exists');
            return res.status(409).json({ success: false });
        }

        // Save the new user in the database
        const newLogin = new Login({ email, username, password });
        await newLogin.save();
        console.log('Account created successfully:', { email, username, password });
        res.status(201).json({ success: true });
    } catch (err) {
        console.error('Error during account creation:', err);
        res.status(500).send('Internal server error');
    }
});

// Handle add request
app.post('/add-request', async (req, res) => {
    try {
        const { requestNo, itemName, quantity, dateNeeded, borrowerName, idNumber, courseYearSection } = req.body;

        if (!requestNo || !itemName || !quantity || !dateNeeded || !borrowerName || !idNumber || !courseYearSection) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const formattedDateNeeded = formatDate(dateNeeded);

        if (formattedDateNeeded === 'Invalid Date') {
            return res.status(400).json({ success: false, message: 'Invalid date format' });
        }

        const newRequest = new Request({ requestNo, itemName, quantity, dateNeeded: formattedDateNeeded, borrowerName, idNumber, courseYearSection });
        await newRequest.save();
        console.log('Request data saved to MongoDB:', newRequest);
        
        res.status(201).json({ success: true, data: newRequest });
    } catch (err) {
        console.error('Error saving request data to MongoDB:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Handle update request
app.put('/update-request', async (req, res) => {
    try {
        const { requestNo, itemName, quantity, dateNeeded, borrowerName, idNumber, courseYearSection } = req.body;

        if (!requestNo || !itemName || !quantity || !dateNeeded || !borrowerName || !idNumber || !courseYearSection) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Format the dateNeeded to dd/mm/yyyy
        const formattedDateNeeded = formatDate(dateNeeded);

        if (formattedDateNeeded === 'Invalid Date') {
            return res.status(400).json({ success: false, message: 'Invalid date format' });
        }

        // Update the request document in MongoDB
        const updatedRequest = await Request.findOneAndUpdate(
            { requestNo },
            { itemName, quantity, dateNeeded: formattedDateNeeded, borrowerName, idNumber, courseYearSection },
            { new: true }
        );

        if (updatedRequest) {
            console.log('Request data updated in MongoDB:', updatedRequest);
            res.json({ success: true, data: updatedRequest });
        } else {
            res.status(404).json({ success: false, message: 'Request not found' });
        }
    } catch (err) {
        console.error('Error updating request data in MongoDB:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Handle login update
app.put('/update-login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        // Update the login document in MongoDB
        const updatedLogin = await Login.findOneAndUpdate(
            { username },
            { password },
            { new: true }
        );

        if (updatedLogin) {
            console.log('Login data updated in MongoDB:', updatedLogin);
            res.json({ success: true, data: updatedLogin });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (err) {
        console.error('Error updating login data in MongoDB:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Handle return request
app.post('/return-request', async (req, res) => {
    try {
        const { requestNo, itemName, quantity, dateRequested, borrowerName, idNumber, courseYearSection, dateReturned, completion, condition } = req.body;

        if (!requestNo || !itemName || !quantity || !dateRequested || !borrowerName || !idNumber || !courseYearSection || !dateReturned || !completion || !condition) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        let returnData;
        // Check if the return document already exists
        const existingReturn = await Return.findOne({ requestNo });

        if (existingReturn) {
            // Update the existing return document
            existingReturn.itemName = itemName;
            existingReturn.quantity = quantity;
            existingReturn.dateRequested = dateRequested;
            existingReturn.borrowerName = borrowerName;
            existingReturn.idNumber = idNumber;
            existingReturn.courseYearSection = courseYearSection;
            existingReturn.dateReturned = dateReturned;
            existingReturn.completion = completion;
            existingReturn.condition = condition;

            returnData = await existingReturn.save();
            console.log('Return data updated in MongoDB:', existingReturn);
        } else {
            // Create a new return document
            const newReturn = new Return({ requestNo, itemName, quantity, dateRequested, borrowerName, idNumber, courseYearSection, dateReturned, completion, condition });

            // Save the return document to MongoDB
            returnData = await newReturn.save();
            console.log('Return data saved to MongoDB:', newReturn);
        }

        // Save the return data to the request log collection
        const newRequestLog = new RequestLog({ requestNo, itemName, quantity, dateRequested, borrowerName, idNumber, courseYearSection, dateReturned, completion, condition });
        await newRequestLog.save();
        console.log('Request log data saved to MongoDB:', newRequestLog);

        // Delete the request from the database
        await Request.findOneAndDelete({ requestNo });
        console.log('Request data deleted from MongoDB:', requestNo);

        res.json({ success: true, data: returnData });
    } catch (err) {
        console.error('Error saving return data to MongoDB:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Handle add or update request
app.post('/add-or-update-request', async (req, res) => {
    try {
        const { requestNo, itemName, quantity, dateNeeded, borrowerName, idNumber, courseYearSection } = req.body;

        if (!itemName || !quantity || !dateNeeded || !borrowerName || !idNumber || !courseYearSection) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const formattedDateNeeded = formatDate(dateNeeded);

        if (formattedDateNeeded === 'Invalid Date') {
            return res.status(400).json({ success: false, message: 'Invalid date format' });
        }

        let request;
        if (requestNo) {
            // Update the existing request
            request = await Request.findOneAndUpdate(
                { requestNo },
                { itemName, quantity, dateNeeded: formattedDateNeeded, borrowerName, idNumber, courseYearSection },
                { new: true }
            );
            if (!request) {
                return res.status(404).json({ success: false, message: 'Request not found' });
            }
        } else {
            // Create a new request
            request = new Request({ requestNo, itemName, quantity, dateNeeded: formattedDateNeeded, borrowerName, idNumber, courseYearSection });
            await request.save();
        }

        console.log('Request data saved to MongoDB:', request);
        res.status(201).json({ success: true, data: request });
    } catch (err) {
        console.error('Error saving request data to MongoDB:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Handle add item
app.post('/add-item', async (req, res) => {
    try {
        const { itemName, quantity } = req.body;

        if (!itemName || !quantity) {
            return res.status(400).json({ success: false, message: 'Item name and quantity are required' });
        }

        const newItem = new Item({ itemName, quantity });
        await newItem.save();
        console.log('Item data saved to MongoDB:', newItem);
        
        res.status(201).json({ success: true, data: newItem });
    } catch (err) {
        console.error('Error saving item data to MongoDB:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Endpoint to fetch all items
app.get('/items', async (req, res) => {
    try {
        const items = await Item.find();
        res.json(items);
    } catch (err) {
        console.error('Error fetching items:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Endpoint to delete an item
app.delete('/delete-item/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Item.findByIdAndDelete(id);
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting item:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Endpoint to update an item
app.put('/update-item/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { itemName, quantity } = req.body;

        if (!itemName || !quantity) {
            return res.status(400).json({ success: false, message: 'Item name and quantity are required' });
        }

        const updatedItem = await Item.findByIdAndUpdate(id, { itemName, quantity }, { new: true });

        if (updatedItem) {
            console.log('Item data updated in MongoDB:', updatedItem);
            res.json({ success: true, data: updatedItem });
        } else {
            res.status(404).json({ success: false, message: 'Item not found' });
        }
    } catch (err) {
        console.error('Error updating item data in MongoDB:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Utility function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
}

// Endpoint to fetch all requests
app.get('/requests', async (req, res) => {
    try {
        const requests = await Request.find();
        res.json({ success: true, data: requests });
    } catch (err) {
        console.error('Error fetching requests:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Endpoint to fetch all return data
app.get('/returns', async (req, res) => {
    try {
        const returns = await Return.find();
        res.json({ success: true, data: returns });
    } catch (err) {
        console.error('Error fetching returns:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Add this middleware at the end of all your routes
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

function updateTables(newRequest, newReturn) {
    // Update the items table in add.html
    const itemsTable = document.getElementById('itemsTable').getElementsByTagName('tbody')[0];
    const newRow = itemsTable.insertRow();
    newRow.insertCell(0).textContent = newRequest.requestNo;
    newRow.insertCell(1).textContent = newRequest.itemName;
    newRow.insertCell(2).textContent = newRequest.quantity;
    newRow.insertCell(3).textContent = formatDate(newRequest.dateNeeded);
    newRow.insertCell(4).textContent = newRequest.borrowerName;
    newRow.insertCell(5).textContent = newRequest.idNumber;
    newRow.insertCell(6).textContent = newRequest.courseYearSection;

    // Update the returns table in return.html
    const returnsTable = document.getElementById('returnsTable').getElementsByTagName('tbody')[0];
    const newReturnRow = returnsTable.insertRow();
    newReturnRow.insertCell(0).textContent = newReturn.requestNo;
    newReturnRow.insertCell(1).textContent = newReturn.itemName;
    newReturnRow.insertCell(2).textContent = newReturn.quantity;
    newReturnRow.insertCell(3).textContent = formatDate(newReturn.dateRequested);
    newReturnRow.insertCell(4).textContent = newReturn.borrowerName;
    newReturnRow.insertCell(5).textContent = newReturn.idNumber;
    newReturnRow.insertCell(6).textContent = newReturn.courseYearSection;
}

// Add the Google Custom Search API key and Custom Search Engine ID
const apiKey = 'AIzaSyDChRu5bpvsICgZJoO5Oae_w1lQloi0g2Y'; // Your API key
const cx = 'b4cc1bf9abbd949a1'; // Your Custom Search Engine ID

// Define a list of broad medical terms (including people, roles, and equipment)
const medicalTerms = [
    'doctor', 'nurse', 'surgeon', 'paramedic', 'anesthesiologist', 'radiologist',
    'hospital', 'clinic', 'nurse practitioner', 'healthcare', 'emergency room', 
    'operation', 'diagnosis', 'treatment', 'disease', 'pandemic', 'vaccine', 
    'first aid', 'blood pressure', 'surgery', 'medical procedure', 'infection , '
];

// Define a list of diseases and medical conditions
const diseases = [
    'diabetes', 'hypertension', 'cancer', 'covid-19', 'flu', 'pneumonia', 'asthma', 'heart disease', 
    'stroke', 'allergy', 'arthritis', 'gastroenteritis', 'tuberculosis', 'malaria', 'hepatitis', 'HIV',
    'chickenpox', 'measles', 'covid', 'dengue'
];

// Define a list of medical equipment (expanded version)
const medicalEquipment = [
    'syringe', 'medical tape', 'surgical gloves', 'stethoscope', 'scalpel', 
    'thermometer', 'bandage', 'IV drip', 'suture', 'defibrillator', 'wheelchair', 
    'hospital bed', 'blood pressure cuff', 'pulse oximeter', 'ECG machine', 'surgical mask',
    'anesthesia machine', 'oxygen mask', 'surgical drape', 'gurney', 'catheter', 
    'endoscope', 'surgical forceps', 'surgical clamp', 'dental mirror', 'x-ray machine', 
    'MRI scanner', 'CT scanner', 'ultrasound machine', 'nebulizer', 'stethoscope', 'gloves', 'surgical gown'
];

// Function to fetch disease treatment and medical advice from Google Custom Search API
const searchDiseaseTreatment = async (query) => {
    try {
        // Extract disease name from the query (case-insensitive matching)
        let disease = diseases.find(item => query.toLowerCase().includes(item));

        // If disease is found, modify the query to search for treatments and medical advice
        if (disease) {
            const diseaseQuery = `${disease} treatment or cure or medicine or what to do`;

            const response = await axios.get(`https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${diseaseQuery}`);
            const data = response.data;

            // Check if there are any results
            if (data.items && data.items.length > 0) {
                // Filter results for treatment, cure, medicine, or what to do
                const relevantResults = data.items.filter(item =>
                    item.snippet.toLowerCase().includes('treatment') ||
                    item.snippet.toLowerCase().includes('medicine') ||
                    item.snippet.toLowerCase().includes('cure') ||
                    item.snippet.toLowerCase().includes('advice')
                );

                if (relevantResults.length > 0) {
                    // Return the snippet of the most relevant result
                    return relevantResults[0].snippet;
                } else {
                    return `Sorry, I couldn't find detailed treatment information for ${disease}. Please consult a medical professional for advice.`;
                }
            } else {
                return `Sorry, I couldn't find any information on ${disease}.`;
            }
        } else {
            return "Sorry, I couldn't identify the disease you're asking about. Please provide a valid disease name.";
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        return "Sorry, something went wrong while fetching the information.";
    }
};

// Function to fetch disease treatment, medical advice, or medical equipment information from Google Custom Search API
const searchGoogle = async (query) => {
    try {
        // Check if the query includes a disease, medical equipment, or medical term from the list
        let disease = diseases.find(item => query.toLowerCase().includes(item));
        let equipment = medicalEquipment.find(item => query.toLowerCase().includes(item));
        let term = medicalTerms.find(item => query.toLowerCase().includes(item));

        if (disease) {
            // Determine if the query is asking for a definition or treatment
            const isTreatmentQuery = query.toLowerCase().includes('treatment') || query.toLowerCase().includes('cure');
            const searchQuery = isTreatmentQuery ? `${disease} treatment or cure or medicine` : `${disease} definition`;

            // Fetch data from Google Custom Search API
            const response = await axios.get(`https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${searchQuery}`);
            const data = response.data;

            if (data.items && data.items.length > 0) {
                const relevantResult = data.items[0].snippet; // Get the first snippet (result)

                return relevantResult;
            } else {
                return `Sorry, I couldn't find detailed information for ${disease}.`;
            }
        } else if (equipment) {
            // Determine if the query is asking for a definition or usage
            const isUsageQuery = query.toLowerCase().includes('use') || query.toLowerCase().includes('usage');
            const searchQuery = isUsageQuery ? `${equipment} how to use` : `${equipment} definition`;

            // Fetch data from Google Custom Search API
            const response = await axios.get(`https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${searchQuery}`);
            const data = response.data;

            if (data.items && data.items.length > 0) {
                const relevantResult = data.items[0].snippet; // Get the first snippet (result)

                return relevantResult;
            } else {
                return `Sorry, I couldn't find detailed information for ${equipment}.`;
            }
        } else if (term) {
            // Fetch definition for the medical term
            const searchQuery = `${term} definition`;

            // Fetch data from Google Custom Search API
            const response = await axios.get(`https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${searchQuery}`);
            const data = response.data;

            if (data.items && data.items.length > 0) {
                const relevantResult = data.items[0].snippet; // Get the first snippet (result)

                return relevantResult;
            } else {
                return `Sorry, I couldn't find detailed information for ${term}.`;
            }
        } else {
            return "Sorry, I couldn't identify the disease, medical equipment, or medical term you're asking about. Please provide a valid name.";
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        return "Sorry, something went wrong while fetching the information.";
    }
};

// Endpoint to handle chatbot queries
app.post('/chatbot', async (req, res) => {
    console.log('Received request at /chatbot endpoint');
    const { message } = req.body;
    const reply = await searchGoogle(message);
    res.json({ success: true, reply });
});

const visionApiKey = 'AIzaSyDvOl5IK2y92W-QtKSu0I9gb003_wjSuNg'; // Replace with your API key

app.post('/detect-object', async (req, res) => {
    try {
        const { image } = req.body;

        const response = await axios.post(`https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`, {
            requests: [
                {
                    image: { content: image },
                    features: [
                        { type: 'OBJECT_LOCALIZATION', maxResults: 5 },
                        { type: 'LABEL_DETECTION', maxResults: 5 }
                    ],
                },
            ],
        });

        const data = response.data;

        if (data.error) {
            console.error('API Error:', data.error.message);
            return res.status(500).json({ success: false, message: data.error.message });
        }

        res.json({ success: true, data: data.responses[0].labelAnnotations });
    } catch (error) {
        console.error('Error making API call:', error);
        res.status(500).json({ success: false, message: 'Error processing the image. Check console for details.' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});