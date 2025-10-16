const db = require('./database');

// Complete questions list from Excel file
const questions = [
    // Settings & Configuration (10 questions)
    { section: 'Settings & Configuration', question: 'Tracking Code implemented', max_score: 2 },
    { section: 'Settings & Configuration', question: 'Subdomains connected', max_score: 2 },
    { section: 'Settings & Configuration', question: 'Email sending domain authenticated', max_score: 2 },
    { section: 'Settings & Configuration', question: 'Filter out internal IP address', max_score: 2 },
    { section: 'Settings & Configuration', question: 'Cookie notice / GDPR banner', max_score: 2 },
    { section: 'Settings & Configuration', question: 'Logo and Favicon set up', max_score: 2 },
    { section: 'Settings & Configuration', question: 'Physical address configured', max_score: 2 },
    { section: 'Settings & Configuration', question: 'Email subscription types defined', max_score: 2 },
    { section: 'Settings & Configuration', question: 'Naming conventions standardized', max_score: 2 },
    { section: 'Settings & Configuration', question: 'Folder structure established', max_score: 2 },
    
    // CRM Core - Contacts (5 questions)
    { section: 'CRM Core - Contacts', question: 'Marketing vs Non-marketing contacts optimized', max_score: 2 },
    { section: 'CRM Core - Contacts', question: 'Duplicate contacts managed', max_score: 2 },
    { section: 'CRM Core - Contacts', question: 'Unengaged/unreachable contacts filtered', max_score: 2 },
    { section: 'CRM Core - Contacts', question: 'Lifecycle stages consistently applied', max_score: 2 },
    { section: 'CRM Core - Contacts', question: 'Contact ownership model defined', max_score: 2 },
    
    // CRM Core - Companies (5 questions)
    { section: 'CRM Core - Companies', question: 'Companies associated with contacts and deals', max_score: 2 },
    { section: 'CRM Core - Companies', question: 'Company properties consistently filled', max_score: 2 },
    { section: 'CRM Core - Companies', question: 'Domain-to-company association enabled', max_score: 2 },
    { section: 'CRM Core - Companies', question: 'Duplicate companies managed', max_score: 2 },
    { section: 'CRM Core - Companies', question: 'Company enrichment applied', max_score: 2 },
    
    // CRM Core - Leads (5 questions)
    { section: 'CRM Core - Leads', question: 'Lead status framework defined', max_score: 2 },
    { section: 'CRM Core - Leads', question: 'Lead assignment rules automated', max_score: 2 },
    { section: 'CRM Core - Leads', question: 'Lead source attribution tracked', max_score: 2 },
    { section: 'CRM Core - Leads', question: 'Unqualified leads segmented', max_score: 2 },
    { section: 'CRM Core - Leads', question: 'Marketing-to-sales handoff enforced', max_score: 2 },
    
    // CRM Core - Deals (5 questions)
    { section: 'CRM Core - Deals', question: 'Deal stages defined and aligned', max_score: 2 },
    { section: 'CRM Core - Deals', question: 'Pipeline automation configured', max_score: 2 },
    { section: 'CRM Core - Deals', question: 'Stage probabilities applied', max_score: 2 },
    { section: 'CRM Core - Deals', question: 'Deals linked to contacts, companies, products', max_score: 2 },
    { section: 'CRM Core - Deals', question: 'Stale/long-term deals reviewed', max_score: 2 },
    
    // CRM Core - Tickets (5 questions)
    { section: 'CRM Core - Tickets', question: 'Ticket pipeline configured', max_score: 2 },
    { section: 'CRM Core - Tickets', question: 'Ticket automation rules applied', max_score: 2 },
    { section: 'CRM Core - Tickets', question: 'Tickets associated with contacts and companies', max_score: 2 },
    { section: 'CRM Core - Tickets', question: 'Ticket reporting aligned to SLAs/CSAT', max_score: 2 },
    { section: 'CRM Core - Tickets', question: 'Duplicate/unresolved tickets managed', max_score: 2 },
    
    // Content Hub (5 questions)
    { section: 'Content Hub', question: 'Content Hub used for blogs/landing pages', max_score: 2 },
    { section: 'Content Hub', question: 'SEO recommendations applied', max_score: 2 },
    { section: 'Content Hub', question: 'Personalization tokens and smart rules used', max_score: 2 },
    { section: 'Content Hub', question: 'Video hosting & reporting enabled', max_score: 2 },
    { section: 'Content Hub', question: 'AI content assistant leveraged', max_score: 2 },
    
    // Sales Hub (6 questions)
    { section: 'Sales Hub', question: 'Prospecting workspace used', max_score: 2 },
    { section: 'Sales Hub', question: 'AI Playbooks & transcription in use', max_score: 2 },
    { section: 'Sales Hub', question: 'Coaching playlists applied', max_score: 2 },
    { section: 'Sales Hub', question: 'AI/intent lead scoring implemented', max_score: 2 },
    { section: 'Sales Hub', question: 'Sequences/task queues optimized', max_score: 2 },
    { section: 'Sales Hub', question: 'Quotes/CPQ fully used', max_score: 2 },
    
    // Commerce (5 questions)
    { section: 'Commerce', question: 'Payments integrated', max_score: 2 },
    { section: 'Commerce', question: 'Recurring subscriptions managed', max_score: 2 },
    { section: 'Commerce', question: 'Invoices connected to Deals', max_score: 2 },
    { section: 'Commerce', question: 'Quotes integrated with payments', max_score: 2 },
    { section: 'Commerce', question: 'Commerce data used in reporting', max_score: 2 },
    
    // Service Hub (6 questions)
    { section: 'Service Hub', question: 'Shared inbox omnichannel enabled', max_score: 2 },
    { section: 'Service Hub', question: 'SLAs & routing rules configured', max_score: 2 },
    { section: 'Service Hub', question: 'Customer portal enabled', max_score: 2 },
    { section: 'Service Hub', question: 'Surveys (NPS/CSAT/CES) implemented', max_score: 2 },
    { section: 'Service Hub', question: 'Knowledge Base optimized', max_score: 2 },
    { section: 'Service Hub', question: 'AI chatbots deployed', max_score: 2 },
    
    // Data Management & Ops (5 questions)
    { section: 'Data Management & Ops', question: 'Data sync integrations in place', max_score: 2 },
    { section: 'Data Management & Ops', question: 'Programmable automation used', max_score: 2 },
    { section: 'Data Management & Ops', question: 'Data warehouse sync enabled', max_score: 2 },
    { section: 'Data Management & Ops', question: 'Data governance documented', max_score: 2 },
    { section: 'Data Management & Ops', question: 'Integration error monitoring process', max_score: 2 },
    
    // Automation (5 questions)
    { section: 'Automation', question: 'Workflows used across teams', max_score: 2 },
    { section: 'Automation', question: 'Deal stage automation rules configured', max_score: 2 },
    { section: 'Automation', question: 'Behavioral events trigger workflows', max_score: 2 },
    { section: 'Automation', question: 'AI workflow optimization applied', max_score: 2 },
    { section: 'Automation', question: 'Governance for inactive workflows', max_score: 2 },
    
    // Reporting & Analytics (6 questions)
    { section: 'Reporting & Analytics', question: 'Cross-object reports built', max_score: 2 },
    { section: 'Reporting & Analytics', question: 'Multi-touch attribution in use', max_score: 2 },
    { section: 'Reporting & Analytics', question: 'Predictive reports enabled', max_score: 2 },
    { section: 'Reporting & Analytics', question: 'Custom dashboards tailored', max_score: 2 },
    { section: 'Reporting & Analytics', question: 'RevOps dashboards aligned to OKRs', max_score: 2 },
    { section: 'Reporting & Analytics', question: 'Are the reports reliable & being used', max_score: 2 },
    
    // Breeze (AI/UX) (4 questions)
    { section: 'Breeze (AI/UX)', question: 'ChatSpot commands used', max_score: 2 },
    { section: 'Breeze (AI/UX)', question: 'AI content generation embedded', max_score: 2 },
    { section: 'Breeze (AI/UX)', question: 'AI forecasts relied on', max_score: 2 },
    { section: 'Breeze (AI/UX)', question: 'Breeze UI adopted', max_score: 2 },
    
    // Development & Extensibility (5 questions)
    { section: 'Development & Extensibility', question: 'Custom-coded workflow actions used', max_score: 2 },
    { section: 'Development & Extensibility', question: 'Private apps/integrations in use', max_score: 2 },
    { section: 'Development & Extensibility', question: 'API usage monitored', max_score: 2 },
    { section: 'Development & Extensibility', question: 'Sandbox environments used', max_score: 2 },
    { section: 'Development & Extensibility', question: 'Marketplace apps used strategically', max_score: 2 }
];

// Function to initialize questions
function initializeQuestions() {
    // First, check if questions already exist to avoid duplicates
    db.get('SELECT COUNT(*) as count FROM questions', (err, row) => {
        if (err) {
            console.error('Error checking questions:', err);
            return;
        }
        
        if (row.count === 0) {
            // console.log('Initializing questions database...');
            const stmt = db.prepare('INSERT INTO questions (section, question, max_score) VALUES (?, ?, ?)');
            
            questions.forEach(q => {
                stmt.run([q.section, q.question, q.max_score]);
            });
            
            stmt.finalize();
            console.log('Questions initialized successfully');
        } else {
            console.log('Questions already exist in database');
        }
    });
}

// Function to reset questions (use if you need to update)
function resetQuestions() {
    db.run('DELETE FROM questions', (err) => {
        if (err) {
            console.error('Error resetting questions:', err);
            return;
        }
        console.log('Questions reset successfully');
        initializeQuestions();
    });
}

module.exports = { initializeQuestions, resetQuestions, questions };