const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function createTable() {
  const sql = postgres(process.env.DATABASE_URL);

  try {
    console.log('Creating facilitation_payments table...');
    await sql`
      CREATE TABLE IF NOT EXISTS facilitation_payments (
        id VARCHAR(255) PRIMARY KEY,
        lead_id VARCHAR(255) NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        payment_method VARCHAR(30),
        facilitation_fee_base_amount DECIMAL(10, 2) NOT NULL DEFAULT 1500.00,
        coupon_code VARCHAR(50),
        coupon_id VARCHAR(255),
        coupon_discount_type VARCHAR(20),
        coupon_discount_value DECIMAL(10, 2),
        coupon_discount_amount DECIMAL(10, 2) DEFAULT 0,
        facilitation_fee_final_amount DECIMAL(10, 2) NOT NULL,
        razorpay_qr_id VARCHAR(255),
        razorpay_qr_status VARCHAR(30),
        razorpay_qr_image_url TEXT,
        razorpay_qr_short_url TEXT,
        razorpay_qr_expires_at TIMESTAMPTZ,
        razorpay_payment_id VARCHAR(255),
        razorpay_order_id VARCHAR(255),
        razorpay_payment_status VARCHAR(30),
        utr_number_manual VARCHAR(100),
        payment_screenshot_url TEXT,
        facilitation_fee_status VARCHAR(30) NOT NULL DEFAULT 'UNPAID',
        payment_paid_at TIMESTAMPTZ,
        payment_verified_at TIMESTAMPTZ,
        payment_verification_source VARCHAR(30),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    console.log('✅ Table created successfully');
  } catch (error) {
    console.error('❌ Error creating table:', error);
  } finally {
    await sql.end();
  }
}

createTable();