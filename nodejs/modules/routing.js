// ---Routing Module---
/* This module handles URL routing for PDF server application.
It maps URLs to appropriate handlers, serves PDFs, and displays PDF metadata.*/

const path = require('path');
const fs = require('fs');

// Discover module (utility)
const pdfDiscovery = require('./pdfDiscovery');
// Validation module
const pdfValidation = require('./pdfValidation');

// Path to JSON metadata file for PDFs
const metadataPath = path.join(__dirname, '../pdfs/metadata.json');
let pdfMetadata = {};
// Load metadata from JSON file (Includes title and description for each PDF)
try {
    const data = fs.readFileSync(metadataPath, 'utf-8');
    pdfMetadata = JSON.parse(data);
} catch (err) {
    console.error("Error loading PDF metadata:", err);
}

// Routing function 
function route(app) {
    // Store PDFs for accesibilty for global route access
    // App must restart if new PDFs are added
    app.locals.pdfList = pdfDiscovery();

    // The module should map URLs to appropriate handlers or static files
    // Implement route definitions for your main pages and PDF endpoints

    // ---Homepage---
    // Main page with inline HTML
    app.get('/', (req, res) => {
        res.send(`<div style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                <h1 style="color: #2c3e50;">Hello from PDF Server</h1>
                <p style="font-size: 18px;">Welcome! Check out our available PDFs:</p>
                <a href="/pdfs" style="text-decoration: none; background-color: #3498db; color: white; padding: 10px 20px; border-radius: 5px;">View PDFs</a>
            </div>`
        );
    });

    // ---Available PDFs page---
    // Displays list of all available PDFs along with their metadata
    app.get('/pdfs', (req, res) => {
        const pdfList = app.locals.pdfList;

        // HTML for PDF list page
        let html = ` <div style="font-family: Arial, sans-serif; margin: 40px;">
                <h1 style="color: #2c3e50; text-align: center;">Available PDFs</h1>
                <ul style="list-style-type: none; padding: 0;">`;
        html += `<ul>`;

        // No PDF case handling
        if (pdfList.length === 0) {
            html += `<li style="text-align: center; color: #e74c3c;">No PDFs available</li>`;
        } else {
            // Loop through each PDF and add metadata
            pdfList.forEach(pdf => {
                const meta = pdfMetadata[pdf] || { title: pdf, description: '' };
                html += `<li style="margin: 20px 0; padding: 15px; border: 1px solid #ccc; border-radius: 8px;">
                        <a href="/pdfs/${pdf}" target="_blank" style="font-size: 20px; font-weight: bold; color: #2980b9; text-decoration: none;">
                            ${meta.title || pdf}
                        </a>
                        <p style="margin-top: 5px; color: #7f8c8d;">${meta.description || ''}</p>
                    </li>`;
            });
        }

        html += `</ul>`;
        html += `<p style="text-align: center; margin-top: 30px;">
                    <a href="/" style="text-decoration: none; color: #3498db;">Back to Home</a>
                </p>`;

        // Send completed HTML to client
        res.send(html);
    });

    // ---Serve individual PDF---
    // Checks if requested PDF exists and send to client
    app.get('/pdfs/:name', (req, res) => {
        const name = req.params.name;

        // Validate PDF exists in pdfs folder
        if (!pdfValidation(name)) {
            return res.status(404).send(`
            <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                <h1 style="color: #e74c3c; font-size: 48px;">404</h1>
                <h2 style="color: #2c3e50;">PDF Not Found</h2>
                <p style="font-size: 18px; color: #7f8c8d;">The pdf you're looking for doesn't exist.</p>
                <a href="/" 
                    style="display: inline-block; margin-top: 20px; text-decoration: none; 
                        background-color: #3498db; color: white; padding: 10px 20px; 
                        border-radius: 5px; font-weight: bold;">
                    Back to Home
            </a>
        </div>`);
        }

        const filePath = path.join(__dirname, '../pdfs', name);

        //Send PDF file to client using Express sendfile
        res.sendFile(filePath);
    });

    // ---Handle 404 errors--- for routes that don’t exist
    app.use((req, res) => {
        res.status(404).send(`
            <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                <h1 style="color: #e74c3c; font-size: 48px;">404</h1>
                <h2 style="color: #2c3e50;">Page Not Found</h2>
                <p style="font-size: 18px; color: #7f8c8d;">The page you're looking for doesn't exist.</p>
                <a href="/" 
                    style="display: inline-block; margin-top: 20px; text-decoration: none; 
                        background-color: #3498db; color: white; padding: 10px 20px; 
                        border-radius: 5px; font-weight: bold;">
                    Back to Home
            </a>
        </div>`);
    });
};

// Export module
module.exports = route;
