// ---PDF Discovery Module---
/* This module scans the designated PDF folder and returns a list
of available PDF files for the server to display */

const fs = require('fs');
const path = require('path');

// Path to folder where PDFs are stored
const pdfFolder = path.join(__dirname, '../pdfs');

// Consider caching the PDF list to avoid repeated file system reads
let pdfListCache = null;

// Function to discover PDFs in the folder
function pdfDiscovery() {

  // Returned cache list if it exists (Improve performance)
  if (pdfListCache) return pdfListCache;

  try {

    // Read all files
    const files = fs.readdirSync(pdfFolder);

    // Filter out files with pdf extension only
    pdfListCache = files.filter(file => file.endsWith('.pdf'));

    // Return list to use in routing module to display available PDFs
    return pdfListCache;
  } catch (err) {
    // Error handling
    console.error("Error reading PDF folder:", err);
    return [];
  }
}

// Export module
module.exports = pdfDiscovery;

