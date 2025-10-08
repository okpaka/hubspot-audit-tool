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
    console.log('Received answers:', answers);
    
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
        
        // Calculate scores
        const scores = calculateScores(answers, questions);
        
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
            console.error('Error saving lead:', err);
            return res.status(500).send('Error saving your information');
        }
        
        console.log('New lead saved:', { email, first_name, last_name, company, auditId: this.lastID });
        
        // Show detailed results page with full report
        res.render('audit-results', {
            overallScore: parseInt(overallScore),
            sectionScores: parsedSectionScores,
            totalAchieved: parseInt(totalAchieved),
            totalPossible: parseInt(totalPossible),
            email: email,
            firstName: first_name || '',
            lastName: last_name || '',
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

// Scoring logic function
function calculateScores(answers, questions) {
    const sectionScores = {};
    let totalAchieved = 0;
    let totalPossible = 0;
    
    // Initialize section scores
    questions.forEach(q => {
        if (!sectionScores[q.section]) {
            sectionScores[q.section] = {
                achieved: 0,
                possible: 0
            };
        }
    });
    
    // Calculate scores for each question
    questions.forEach((question, index) => {
        const answerKey = `q${index}_${question.section.replace(/\s+/g, '_')}`;
        const userScore = parseInt(answers[answerKey]) || 0;
        const maxScore = question.max_score;
        
        // Add to section totals
        sectionScores[question.section].achieved += userScore;
        sectionScores[question.section].possible += maxScore;
        
        // Add to overall totals
        totalAchieved += userScore;
        totalPossible += maxScore;
    });
    
    // Calculate percentages
    const overallScore = totalPossible > 0 ? Math.round((totalAchieved / totalPossible) * 100) : 0;
    
    // Format section scores for display
    const formattedSectionScores = {};
    Object.keys(sectionScores).forEach(section => {
        formattedSectionScores[section] = {
            score: sectionScores[section].achieved,
            max: sectionScores[section].possible,
            percentage: sectionScores[section].possible > 0 ? 
                Math.round((sectionScores[section].achieved / sectionScores[section].possible) * 100) : 0
        };
    });
    
    return {
        overallScore,
        sectionScores: formattedSectionScores,
        totalAchieved,
        totalPossible
    };
}

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