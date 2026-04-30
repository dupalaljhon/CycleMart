// Image Debug Helper
// Add this to your browser console to test image URLs directly

function testImageUrl(url) {
  // Test with fetch
  fetch(url, { method: 'HEAD' })
    .then(response => {
      if (response.ok) {
      } else {
      }
    })
    .catch(error => {
    });
  
  // Test with Image object
  const img = new Image();
  img.onload = () => {
  };
  img.onerror = (error) => {
  };
  img.src = url;
}

// Example usage:
// testImageUrl('http://api.cyclemart.shop/CycleMart-api/apiuploads/profile_68bbcd8bb7b60.jpeg');

