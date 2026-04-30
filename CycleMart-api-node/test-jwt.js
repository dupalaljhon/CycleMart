// Test JWT Token Creation and Verification
// Run this to verify JWT_SECRET is working correctly

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

console.log('='.repeat(60));
console.log('JWT TOKEN TEST');
console.log('='.repeat(60));
console.log();

console.log('1. JWT_SECRET from .env:');
console.log(`   "${JWT_SECRET}"`);
console.log();

// Create a test token
const testPayload = {
    iss: 'http://example.org',
    aud: 'http://example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    uid: 123,
    role: 'user',
    email: 'test@example.com'
};

console.log('2. Creating test token with payload:');
console.log(JSON.stringify(testPayload, null, 2));
console.log();

const token = jwt.sign(testPayload, JWT_SECRET, { algorithm: 'HS256' });

console.log('3. Generated token:');
console.log(`   ${token.substring(0, 50)}...`);
console.log();

// Verify the token
try {
    const verified = jwt.verify(token, JWT_SECRET);
    console.log('4. Token verification: ✅ SUCCESS');
    console.log('   Decoded payload:');
    console.log(JSON.stringify(verified, null, 2));
    console.log();
    console.log('✅ JWT is working correctly!');
    console.log();
    console.log('This means:');
    console.log('- JWT_SECRET is loaded correctly from .env');
    console.log('- Token creation works');
    console.log('- Token verification works');
    console.log();
    console.log('If users are getting 401 errors, the issue is:');
    console.log('- Their token was created with a DIFFERENT secret');
    console.log('- They need to logout and login again');
} catch (error) {
    console.log('4. Token verification: ❌ FAILED');
    console.log(`   Error: ${error.message}`);
    console.log();
    console.log('❌ JWT is NOT working!');
    console.log();
    console.log('This means:');
    console.log('- JWT_SECRET might be wrong');
    console.log('- Check your .env file');
}

console.log('='.repeat(60));
console.log();

// Test with a fake "old PHP token"
console.log('5. Testing with simulated "old PHP token":');
const oldToken = jwt.sign(testPayload, 'different_secret_key', { algorithm: 'HS256' });
console.log(`   Old token: ${oldToken.substring(0, 50)}...`);
console.log();

try {
    jwt.verify(oldToken, JWT_SECRET);
    console.log('   Verification: ✅ SUCCESS (unexpected!)');
} catch (error) {
    console.log('   Verification: ❌ FAILED (expected!)');
    console.log(`   Error: ${error.message}`);
    console.log();
    console.log('   This is CORRECT behavior!');
    console.log('   Tokens from old PHP backend will fail verification.');
    console.log('   Users must login again to get new tokens.');
}

console.log();
console.log('='.repeat(60));
console.log('TEST COMPLETE');
console.log('='.repeat(60));
