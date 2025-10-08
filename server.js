const express = require('express');
const session = require('express-session');
const path = require('path');

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 3000;

// Vercel-specific configuration
app.set('trust proxy', 1);

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'hubspot-audit-vercel-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static('public'));

// Parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.use('/', require('./routes/audit'));

// Vercel requires module.exports
module.exports = app;

// Only listen locally (not on Vercel)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`HubSpot Audit Tool running on http://localhost:${PORT}`);
    });
}