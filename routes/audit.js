const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { initializeQuestions, resetQuestions } = require('../models/questions');

// Initialize questions on first load
initializeQuestions();

// Home page - Start audit
router.get('/', (req, res) => {
    res.render('index');
});

// Audit form page
router.get('/audit', (req, res) => {
    // Get all questions grouped by section
    db.all(`
        SELECT id, section, question, max_score 
        FROM questions 
        ORDER BY id
    `, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }
        
        // Group questions by section
        const sections = {};
        rows.forEach(row => {
            if (!sections[row.section]) {
                sections[row.section] = [];
            }
            sections[row.section].push({
                id: row.id,
                question: row.question,
                max_score: row.max_score
            });
        });
        
        res.render('audit-form', { sections });
    });
});

// Handle form submission with scoring logic
router.post('/audit/submit', (req, res) => {
    const answers = req.body;
    
    // Get all questions from database to calculate scores
    db.all(`
        SELECT id, section, question, max_score 
        FROM questions 
        ORDER BY id
    `, (err, questions) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }
        
        // Calculate scores using Excel-matching logic
        const scores = calculateScoresExcelStyle(answers, questions);
        
        // Show email capture page instead of immediate results
        res.render('email-capture', {
            overallScore: scores.overallScore,
            sectionScores: scores.sectionScores,
            totalAchieved: scores.totalAchieved,
            totalPossible: scores.totalPossible,
            answers: answers
        });
    });
});

// Save lead and show detailed results
router.post('/audit/save-lead', (req, res) => {
    const { email, first_name, last_name, company, overallScore, sectionScores, totalAchieved, totalPossible, answers } = req.body;
    
    
    // Parse the data
    const parsedSectionScores = typeof sectionScores === 'string' ? JSON.parse(sectionScores) : sectionScores;
    const parsedAnswers = typeof answers === 'string' ? JSON.parse(answers) : answers;
    
    // Save to database
    const stmt = db.prepare(`
        INSERT INTO audits (email, first_name, last_name, company, overall_score, total_achieved, total_possible, section_scores, answers)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
        email,
        first_name || '',
        last_name || '',
        company || '',
        parseInt(overallScore),
        parseInt(totalAchieved),
        parseInt(totalPossible),
        JSON.stringify(parsedSectionScores),
        JSON.stringify(parsedAnswers)
    ], function(err) {
        if (err) {
            return res.status(500).send('Error saving your information');
        }
        
        // Show detailed results page with full report
        res.render('audit-results', {
            overallScore: parseInt(overallScore),
            sectionScores: parsedSectionScores,
            totalAchieved: parseInt(totalAchieved),
            totalPossible: parseInt(totalPossible),
            email: email,
            first_name: first_name || '',
            last_name: last_name || '',
            company: company || '',
            showDetailed: true,
            showFullReport: true
        });
    });
    
    stmt.finalize();
});

// Direct results page (for testing without email capture)
router.get('/audit/results', (req, res) => {
    // This is just for testing - in production, use the email capture flow
    res.send(`
        <html>
            <body>
                <h1>Test Results Page</h1>
                <p>This is for testing only. Use the form to submit your audit.</p>
                <a href="/audit">Go to Audit Form</a>
            </body>
        </html>
    `);
});

// Admin route to view leads (optional - for your internal use)
router.get('/admin/leads', (req, res) => {
    db.all('SELECT * FROM audits ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }
        
        res.render('admin-leads', { leads: rows });
    });
});

// View individual lead details
router.get('/admin/leads/:id', (req, res) => {
    const leadId = req.params.id;
    
    db.get('SELECT * FROM audits WHERE id = ?', [leadId], (err, lead) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }
        
        if (!lead) {
            return res.status(404).send('Lead not found');
        }
        
        // Parse JSON data
        const sectionScores = lead.section_scores ? JSON.parse(lead.section_scores) : {};
        const answers = lead.answers ? JSON.parse(lead.answers) : {};
        
        res.render('admin-lead-detail', { 
            lead: lead,
            sectionScores: sectionScores,
            answers: answers
        });
    });
});

// Export leads to CSV
router.get('/admin/leads/export', (req, res) => {
    db.all('SELECT * FROM audits ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }
        
        if (rows.length === 0) {
            return res.send(`
                <html>
                    <body>
                        <h1>No Leads to Export</h1>
                        <p>There are no leads in the database yet.</p>
                        <a href="/admin/leads">Back to Leads</a>
                    </body>
                </html>
            `);
        }
        
        // Create CSV header
        let csv = 'ID,Email,First Name,Last Name,Company,Overall Score,Total Achieved,Total Possible,Created Date\n';
        
        // Add data rows
        rows.forEach(lead => {
            csv += `"${lead.id}","${lead.email || ''}","${lead.first_name || ''}","${lead.last_name || ''}","${lead.company || ''}",${lead.overall_score || 0},${lead.total_achieved || 0},${lead.total_possible || 0},"${new Date(lead.created_at).toLocaleDateString()}"\n`;
        });
        
        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=hubspot-audit-leads-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    });
});

// EXCEL-STYLE SCORING LOGIC - Fixed version with proper section name matching
function calculateScoresExcelStyle(answers, questions) {
    const sectionScores = {};
    let totalAchieved = 0;
    let totalPossible = 0;

    // 🧭 Define all expected sections with normalized names
    const sectionStructure = {
        'Settings & Configuration': { count: 10, max: 20 },
        'CRM Core - Contacts': { count: 5, max: 10 },
        'CRM Core - Companies': { count: 5, max: 10 },
        'CRM Core - Leads': { count: 5, max: 10 },
        'CRM Core - Deals': { count: 5, max: 10 },
        'CRM Core - Tickets': { count: 5, max: 10 },
        'Content Hub': { count: 5, max: 10 },
        'Sales Hub': { count: 6, max: 12 },
        'Commerce': { count: 5, max: 10 },
        'Service Hub': { count: 6, max: 12 },
        'Data Management & Ops': { count: 5, max: 10 },
        'Automation': { count: 5, max: 10 },
        'Reporting & Analytics': { count: 6, max: 12 },
        'Breeze (AI/UX)': { count: 4, max: 8 },
        'Development & Extensibility': { count: 5, max: 10 }
    };

    // Create a mapping from normalized form keys to actual section names
    const sectionMapping = {
        'Settings_&_Configuration': 'Settings & Configuration',
        'CRM_Core_-_Contacts': 'CRM Core - Contacts',
        'CRM_Core_-_Companies': 'CRM Core - Companies',
        'CRM_Core_-_Leads': 'CRM Core - Leads',
        'CRM_Core_-_Deals': 'CRM Core - Deals',
        'CRM_Core_-_Tickets': 'CRM Core - Tickets',
        'Content_Hub': 'Content Hub',
        'Sales_Hub': 'Sales Hub',
        'Commerce': 'Commerce', // This one works already
        'Service_Hub': 'Service Hub',
        'Data_Management_&_Ops': 'Data Management & Ops',
        'Automation': 'Automation', // This one works already
        'Reporting_&_Analytics': 'Reporting & Analytics',
        'Breeze_(AI/UX)': 'Breeze (AI/UX)',
        'Development_&_Extensibility': 'Development & Extensibility'
    };

    // Initialize section scores
    Object.keys(sectionStructure).forEach(section => {
        sectionScores[section] = {
            achieved: 0,
            possible: sectionStructure[section].max,
            questionCount: sectionStructure[section].count
        };
        totalPossible += sectionStructure[section].max;
    });

    
    // 🧮 Calculate per-section scores based on actual form answers
    Object.keys(answers).forEach(answerKey => {
        // Handle array values (take the first one)
        let answerValue = answers[answerKey];
        if (Array.isArray(answerValue)) {
            answerValue = answerValue[0];
        }
        answerValue = parseInt(answerValue) || 0;
        
        // Extract section name from answer key (format: q0_Settings_&_Configuration)
        const match = answerKey.match(/q\d+_(.+)/);
        if (match) {
            const formSectionName = match[1];
            const actualSectionName = sectionMapping[formSectionName];
            
            if (actualSectionName && sectionScores[actualSectionName]) {
                sectionScores[actualSectionName].achieved += answerValue;
                totalAchieved += answerValue;
            } else {
            }
        } else {
        }
    });

    // 🔢 Compute percentages per section
    const formattedSectionScores = {};
    Object.keys(sectionScores).forEach(section => {
        const s = sectionScores[section];
        const percentage = s.possible > 0 ? Math.round((s.achieved / s.possible) * 100) : 0;
        
        formattedSectionScores[section] = {
            score: s.achieved,
            max: s.possible,
            percentage: percentage,
            questionCount: s.questionCount
        };
    });

    const overallScore = totalPossible > 0 ? Math.round((totalAchieved / totalPossible) * 100) : 0;

    return {
        overallScore,
        sectionScores: formattedSectionScores,
        totalAchieved,
        totalPossible
    };
}

// Test with your exact Excel data
router.get('/test-excel-scoring', (req, res) => {
    // This matches your Excel example exactly
    const excelExampleAnswers = {
        // Settings & Configuration (10 questions)
        'q0_Settings_&_Configuration': '2', // Tracking Code implemented
        'q1_Settings_&_Configuration': '2', // Subdomains connected
        'q2_Settings_&_Configuration': '2', // Email sending domain authenticated
        'q3_Settings_&_Configuration': '0', // Filter out internal IP address
        'q4_Settings_&_Configuration': '2', // Cookie notice / GDPR banner
        'q5_Settings_&_Configuration': '2', // Logo and Favicon set up
        'q6_Settings_&_Configuration': '2', // Physical address configured
        'q7_Settings_&_Configuration': '2', // Email subscription types defined
        'q8_Settings_&_Configuration': '1', // Naming conventions standardized
        'q9_Settings_&_Configuration': '1', // Folder structure established
        
        // CRM Core - Contacts (5 questions) - All 0 except last one
        'q10_CRM_Core_-_Contacts': '0',
        'q11_CRM_Core_-_Contacts': '0',
        'q12_CRM_Core_-_Contacts': '0',
        'q13_CRM_Core_-_Contacts': '0',
        'q14_CRM_Core_-_Contacts': '1',
        
        // Continue for all sections as per your Excel...
    };
    
    // Get all questions to calculate
    db.all('SELECT id, section, question, max_score FROM questions ORDER BY id', (err, questions) => {
        if (err) {
            return res.status(500).send('Database error');
        }
        
        const scores = calculateScoresExcelStyle(excelExampleAnswers, questions);


        res.json({
            message: 'Excel-style scoring test',
            expectedOverall: '27% (45/164 = 27.44%)',
            actualOverall: scores.overallScore + '%',
            sectionScores: scores.sectionScores,
            totalAchieved: scores.totalAchieved,
            totalPossible: scores.totalPossible
        });
    });
});

// Temporary route to reset questions with all sections (remove after use)
router.get('/reset-questions', (req, res) => {
    resetQuestions();
    res.send(`
        <html>
            <body>
                <h1>Questions reset successfully!</h1>
                <p>All 82 questions have been loaded into the database.</p>
                <a href="/">Go Home</a> | 
                <a href="/audit">Start Audit</a>
            </body>
        </html>
    `);
});

// Handle GET requests to POST routes with helpful error message
router.get('/audit/submit', (req, res) => {
    res.status(405).send(`
        <html>
            <body>
                <h1>Method Not Allowed</h1>
                <p>Please use the audit form to submit your responses.</p>
                <a href="/audit">Go to Audit Form</a>
            </body>
        </html>
    `);
});

module.exports = router;