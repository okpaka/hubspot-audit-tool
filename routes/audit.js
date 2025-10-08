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
        
        // Render results page
        res.render('audit-results', {
            overallScore: scores.overallScore,
            sectionScores: scores.sectionScores,
            totalPossible: scores.totalPossible,
            totalAchieved: scores.totalAchieved
        });
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

module.exports = router;