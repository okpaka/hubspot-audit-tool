
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, JS, images)
app.use(express.static('public'));

// Parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.use('/', require('./routes/audit'));

// Start server
app.listen(PORT, () => {
    console.log(`HubSpot Audit Tool running on http://localhost:${PORT}`);
});