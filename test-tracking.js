// Generate a test tracking URL

function encodeTrackingToken(data) {
  const queryString = new URLSearchParams({
    e: data.event,
    offerID: data.offerId,
    campaignID: data.campaignId,
    to: data.email,
  }).toString();

  // Encode to base64url
  return Buffer.from(queryString, 'utf-8').toString('base64url');
}

// Test data
const testData = {
  event: 'open',
  offerId: '12345',
  campaignId: 'camp-789',
  email: 'test@example.com',
};

const encoded = encodeTrackingToken(testData);
const email = "t.elmoktadi@outlook.com"
const trackingUrl = `http://localhost:3000/api/rd/${encoded}=${email}`;

console.log('Test Tracking URL:');
console.log(trackingUrl);
console.log('\nTest in browser or use curl:');
console.log(`curl "${trackingUrl.replace('=%EMAIL%', '')}"`);
