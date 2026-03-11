require('dotenv').config({ path: '.env.local' });
const Razorpay = require('razorpay');

console.log("=== Razorpay QR Code Generator ===");
console.log("Using credentials from .env.local");

// Use credentials from environment
const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

console.log("Current Key ID:", key_id ? key_id.substring(0, 12) + "..." : "NOT SET");
console.log("Key Secret configured:", key_secret ? "YES" : "NO");

if (!key_id || !key_secret) {
  console.error("\n❌ Razorpay credentials not found in .env.local");
  console.log("\n📝 To fix this:");
  console.log("1. Go to https://dashboard.razorpay.com/");
  console.log("2. Sign up for a test account or log in");
  console.log("3. Go to Settings > API Keys");
  console.log("4. Copy the Test Key ID and Test Key Secret");
  console.log("5. Update .env.local with:");
  console.log("   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx");
  console.log("   RAZORPAY_KEY_SECRET=your_test_secret_here");
  process.exit(1);
}

const razorpay = new Razorpay({ key_id, key_secret });

// Test QR code details
const amount = 100 * 100; // ₹100 in paise
const customerName = "Test Customer";
const description = "Test Facilitation Fee";
const expiresInMinutes = 30;
const closeBy = Math.floor(Date.now() / 1000) + expiresInMinutes * 60;

console.log(`\nCreating QR code for ₹${amount/100} for ${customerName}`);

// Create QR Code using the same method as the working API
razorpay.qrCode.create({
  type: 'upi_qr',
  name: customerName,
  usage: 'single_use',
  fixed_amount: true,
  payment_amount: amount,
  description: description,
  close_by: closeBy,
  notes: {
    lead_id: 'test_lead',
    purpose: 'facilitation_fee'
  }
}).then(qr => {
  console.log("\n✅ QR Code Created Successfully!");
  console.log("QR ID:", qr.id);
  console.log("Image URL:", qr.image_url);
  console.log("Short URL:", qr.short_url);
  console.log("Status:", qr.status);
  console.log("Amount:", qr.payment_amount / 100, "INR");
  console.log("Expires at:", new Date(qr.close_by * 1000).toLocaleString());
  console.log("\n💡 Use the Image URL or Short URL to display the QR code");
}).catch(err => {
  console.error("\n❌ Error creating QR code:", err.error || err);
  console.log("\n🔧 Troubleshooting:");
  console.log("1. Verify your Razorpay test credentials are correct");
  console.log("2. Make sure you're using TEST mode credentials (not live)");
  console.log("3. Check if your Razorpay account is activated for QR codes");
  console.log("4. Visit: https://dashboard.razorpay.com/ to get new test credentials");
});