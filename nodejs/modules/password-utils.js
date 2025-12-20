//=============================================
// Password-Utils Module
/* Password utility functions for validation, hashing, and verification*/
//=============================================

//--------------
// Dependencies
//--------------

// Argon2 password hashing library
const argon2 = require('argon2');

//----------------------
// Argon2 Configuration
//----------------------

// Balance between security and performance
const ARGON2_OPTIONS = {
  type: argon2.argon2id,  // Uses a hybrid approach (best for most cases)
  memoryCost: 65536,      // 64 MB memory cost
  timeCost: 3,            // Number of iterations
  parallelism: 4          // Number of parallel threads
};

//---------------------
// Password Validation
//---------------------

// Checks if password meets minimum security requirements
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

  // Password does not include capital letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Password does not include lowercase letter
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

 // Returns validation result and any required changes
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

//------------------
// Password Hashing
//------------------

// Hashes a plaintext password
// NOTES: - Async is used to run ascynchronously since hashing can take a while
//        - Returns a Promise (value that can be used in the future)
//        - Await is used to handle this value (Pauses execustion until hashing is completed)
async function hashPassword(password) {
  return await argon2.hash(password, ARGON2_OPTIONS);
}

//----------------------
// Password Verification
//----------------------

// Compares a plain text password to a hashed password
async function comparePassword(password, hash) {
  return await argon2.verify(hash, password);
}

//-----------------
// Export Modules
//-----------------
module.exports = {
  validatePassword,
  hashPassword,
  comparePassword
};
