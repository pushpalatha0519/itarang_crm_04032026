require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestCoupon() {
    try {
        // Get a dealer ID (assuming there's at least one account)
        const { data: accounts, error: accountError } = await supabase
            .from('accounts')
            .select('id, business_entity_name')
            .limit(1);

        if (accountError || !accounts || accounts.length === 0) {
            console.error('No accounts found:', accountError);
            return;
        }

        const dealerId = accounts[0].id;
        const couponCode = 'TEST100';

        // Check if coupon already exists
        const { data: existingCoupon } = await supabase
            .from('coupon_codes')
            .select('id')
            .eq('code', couponCode)
            .single();

        if (existingCoupon) {
            console.log('Test coupon already exists:', couponCode);
            return;
        }

        // Create 100% discount coupon
        const { data, error } = await supabase
            .from('coupon_codes')
            .insert({
                id: `COUPON-${uuidv4()}`,
                code: couponCode,
                dealer_id: dealerId,
                status: 'available',
                credits_available: 100, // Allow multiple uses
                discount_type: 'percentage',
                discount_value: 100, // 100% discount
                max_discount_cap: 1500, // Max discount of ₹1500
                min_amount: 1500, // Minimum order amount
                expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
            })
            .select();

        if (error) {
            console.error('Error creating coupon:', error);
        } else {
            console.log('Test coupon created successfully:', data[0]);
            console.log('Coupon Code:', couponCode);
            console.log('Discount: 100% off (max ₹1500)');
        }
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

createTestCoupon();