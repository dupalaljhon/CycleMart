// Simple test to check if socket server is working
const http = require('http');

// Test the health endpoint
const req = http.get('http://localhost:3000/health', (res) => {
  console.log('✅ Socket server is responding!');
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.log('❌ Socket server is not responding:', err.message);
  process.exit(1);
});

req.setTimeout(5000, () => {
  console.log('❌ Request timeout - server may not be running');
  req.abort();
  process.exit(1);
});