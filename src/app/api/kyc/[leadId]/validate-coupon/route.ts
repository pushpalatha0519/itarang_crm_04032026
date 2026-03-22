import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couponCodes, leads } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { calculateDiscount } from '@/lib/razorpay';
import { createClient } from '@/lib/supabase/server';

const BASE_FEE = Number(process.env.FACILITATION_FEE_BASE_AMOUNT) || 1500;

export async function POST(req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
    try {
        const { leadId } = await params;
        const { couponCode } = await req.json();
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!couponCode) {
            return NextResponse.json({ valid: false, message: 'Coupon code is required' });
        }

        // Verify lead exists
        const leadRows = await db.select({ id: leads.id, payment_method: leads.payment_method })
            .from(leads).where(eq(leads.id, leadId)).limit(1);

        if (!leadRows.length) {
            return NextResponse.json({ valid: false, message: 'Lead not found' }, { status: 404 });
        }

        // Check if another coupon is already reserved for this lead
        const existingReserved = await db
            .select()
            .from(couponCodes)
            .where(
                and(
                    eq(couponCodes.used_by_lead_id, leadId),
                    eq(couponCodes.status, 'reserved')
                )
            )
            .limit(1);

        if (existingReserved.length) {
            if (existingReserved[0].code.toUpperCase() !== couponCode.toUpperCase().trim()) {
                return NextResponse.json({
                    valid: false,
                    message: `Lead already has reserved coupon ${existingReserved[0].code}. Release it first.`,
                    currentCouponCode: existingReserved[0].code,
                });
            }
        }

        // Find coupon
        const coupons = await db.select()
            .from(couponCodes)
            .where(eq(couponCodes.code, couponCode.toUpperCase().trim()))
            .limit(1);

        if (!coupons.length) {
            return NextResponse.json({ valid: false, message: 'Coupon code not found' });
        }

        const coupon = coupons[0];

        if (coupon.status === 'revoked') {
            return NextResponse.json({ valid: false, message: 'Coupon has been revoked' });
        }
        if (coupon.status === 'used') {
            return NextResponse.json({ valid: false, message: 'Coupon already used' });
        }
        if (coupon.status === 'reserved' && coupon.used_by_lead_id !== leadId) {
            return NextResponse.json({ valid: false, message: 'Coupon already reserved for another lead' });
        }

        // Check expiry
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
            await db.update(couponCodes)
                .set({ status: 'expired', updated_at: new Date() })
                .where(eq(couponCodes.id, coupon.id));
            return NextResponse.json({ valid: false, message: 'Coupon has expired' });
        }

        // Check minimum amount
        const minAmount = coupon.min_amount ? Number(coupon.min_amount) : 0;
        if (minAmount > BASE_FEE) {
            return NextResponse.json({ valid: false, message: `Minimum order amount is ₹${minAmount}` });
        }

        // Calculate discount
        const discountAmount = calculateDiscount(
            BASE_FEE,
            coupon.discount_type,
            coupon.discount_value ? Number(coupon.discount_value) : null,
            coupon.max_discount_cap ? Number(coupon.max_discount_cap) : null
        );

        const finalAmount = BASE_FEE - discountAmount;

        // Reserve coupon for this lead (1-to-1 lock)
        if (coupon.status !== 'reserved' || coupon.used_by_lead_id !== leadId) {
            await db.update(couponCodes)
                .set({
                    status: 'reserved',
                    used_by_lead_id: leadId,
                    used_by: user?.id || null,
                    validated_at: new Date(),
                    updated_at: new Date(),
                })
                .where(eq(couponCodes.id, coupon.id));
        }

        return NextResponse.json({
            valid: true,
            status: 'reserved',
            coupon_id: coupon.id,
            coupon_code: coupon.code,
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value ? Number(coupon.discount_value) : 0,
            discount_amount: discountAmount,
            base_amount: BASE_FEE,
            final_amount: finalAmount,
            message: discountAmount > 0
                ? `Coupon applied! You save ₹${discountAmount}`
                : 'Coupon validated successfully',
        });
    } catch (error) {
        console.error('[Validate Coupon] Error:', error);
        return NextResponse.json({ valid: false, message: 'Server error' }, { status: 500 });
    }
}
