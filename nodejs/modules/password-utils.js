// modules/password-utils.js
/* This module was retrieved from Troy Schotter's webserver tomb
(Complex Database Intergration/ Password Requirements and Encryption),
with small changes and additional comments inserted for further explanation
per the projects requirements.*/

// Install argon2 in order to use
const argon2 = require('argon2');

// Argon2 configuration option (good balance of security and performance)
const ARGON2_OPTIONS = {
  type: argon2.argon2id,  // Uses a hybrid approach (best for most cases)
  memoryCost: 65536,      // 64 MB memory cost
  timeCost: 3,            // Number of iterations
  parallelism: 4          // Number of parallel threads
};

// Function to check if password is valid/ meets minimum security requirements
function validatePassword(password) {

  // Stores errors in an array for easy retrieval in return method
  const errors = [];

  // No password entered
  if (!password) {
    errors.push('Password is required');
    return { valid: false, errors };
  }

  // Password does not satisfy length requirement
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Password does not include any capital letters
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Password does not include any lowercase letters
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Password does not include numerical value
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Password does not include special character
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

 // Returns as usable password if it satisfies all requirements
 // If not, it returns required changes
  return {
    valid: errors.length === 0,
    errors: errors
  };
}


// Simple function that will hash a password
// Async is used to run ascynchronously since hashing can take a while
// Returns a Promise (value that can be used in the future)
// Await is used to handle this value (Pauses execustion until hashing is completed)
async function hashPassword(password) {
  return await argon2.hash(password, ARGON2_OPTIONS);
}


// Compares a plain text password to a hashed password
async function comparePassword(password, hash) {
  return await argon2.verify(hash, password);
}

// Export all three modules for use
module.exports = {
  validatePassword,
  hashPassword,
  comparePassword
};
