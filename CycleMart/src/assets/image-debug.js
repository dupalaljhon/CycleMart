// Image Debug Helper
// Add this to your browser console to test image URLs directly

function testImageUrl(url) {
  console.log('Testing image URL:', url);
  
  // Test with fetch
  fetch(url, { method: 'HEAD' })
    .then(response => {
      console.log('Fetch response:', response.status, response.statusText);
      if (response.ok) {
        console.log('✅ Image is accessible via fetch');
      } else {
        console.log('❌ Image fetch failed:', response.status);
      }
    })
    .catch(error => {
      console.log('❌ Fetch error:', error);
    });
  
  // Test with Image object
  const img = new Image();
  img.onload = () => {
    console.log('✅ Image loaded successfully');
    console.log('Image dimensions:', img.width, 'x', img.height);
  };
  img.onerror = (error) => {
    console.log('❌ Image load failed:', error);
  };
  img.src = url;
}

// Example usage:
// testImageUrl('http://localhost/CycleMart/CycleMart/CycleMart-api/api/uploads/profile_68bbcd8bb7b60.jpeg');

console.log('Image debug helper loaded. Use testImageUrl(url) to test any image URL.');