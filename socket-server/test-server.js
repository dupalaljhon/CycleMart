// Simple test to check if socket server is working
const http = require('http');

// Test the health endpoint
const req = http.get('http://localhost:3000/health', (res) => {
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    process.exit(0);
  });
});

req.on('error', (err) => {
  process.exit(1);
});

req.setTimeout(5000, () => {
  req.abort();
  process.exit(1);
});