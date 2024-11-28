#!/usr/bin/env node
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const port = 3019;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Serve static files
app.use(express.static(__dirname));

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
            return res.status(401).json({ success: false });
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

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
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
