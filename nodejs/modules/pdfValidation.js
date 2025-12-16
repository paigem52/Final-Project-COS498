// ---PDF Validation Module---
/* This module checks if a requested PDF exists in the designated folder.
Ensure only valid file paths are allowed */

const fs = require('fs');
const path = require('path');

// Path to folder where PDFs are stored
const pdfFolder = path.join(__dirname, '../pdfs');

// Function to validate PDF filename
function pdfValidation(fileName) {

  // Security check: Only allow access to PDFs within the designated folder
  // Can not go back a directory (..) or forward (/) 
  if (fileName.includes('..') || fileName.includes('/')) {
    // Invalid request
    return false;
  }

  // Full path to the PDF
  const filePath = path.join(pdfFolder, fileName)

  // Check if the file exists in the designated folder
  try {
    // existsSync checks existence, statSync.isFile makes sure it is a file
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (err) {
    // Return false to show invalid/ not found file
    console.error('Error checking PDF:', err);
    // Return appropriate 404 error message
    return false;
  }
}

// Export module
module.exports = pdfValidation;