const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function createTestCoupon() {
  const sql = postgres(process.env.DATABASE_URL);

  try {
    console.log('Connected to database');

    // Add missing columns
    await sql`
      ALTER TABLE coupon_codes
      ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) DEFAULT 'flat',
      ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS max_discount_cap DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS min_amount DECIMAL(10, 2)
    `;

    // Insert coupon
    const result = await sql`
      INSERT INTO coupon_codes (id, code, dealer_id, discount_type, discount_value, max_discount_cap, min_amount, expires_at)
      VALUES ('COUPON-TEST-001', 'TEST100', 'ACC-ITARANG-001', 'percentage', 100, 1500, 1500, ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()})
      ON CONFLICT (code) DO NOTHING
    `;

    if (result.count > 0) {
      console.log('✅ Test coupon created successfully!');
      console.log('Coupon Code: TEST100');
      console.log('Discount: 100% off (max ₹1500)');
    } else {
      console.log('Coupon already exists');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

createTestCoupon();