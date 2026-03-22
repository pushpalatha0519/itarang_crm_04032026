import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couponCodes } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
    try {
        const { leadId, couponCode } = await req.json();
        if (!leadId) {
            return NextResponse.json({
                success: false,
                error: { message: 'leadId is required' },
            }, { status: 400 });
        }

        const normalizedCode = couponCode ? String(couponCode).toUpperCase().trim() : null;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const reservedCoupons = await db.select()
            .from(couponCodes)
            .where(and(
                eq(couponCodes.used_by_lead_id, String(leadId)),
                eq(couponCodes.status, 'reserved')
            ))
            .limit(1);

        if (!reservedCoupons.length) {
            return NextResponse.json({
                success: false,
                error: { message: 'No reserved coupon found for this lead' },
            }, { status: 404 });
        }

        const coupon = reservedCoupons[0];
        if (normalizedCode && coupon.code !== normalizedCode) {
            return NextResponse.json({
                success: false,
                error: { message: `Lead is reserved with ${coupon.code}, not ${normalizedCode}` },
            }, { status: 409 });
        }

        await db.update(couponCodes)
            .set({
                status: 'used',
                used_by: user?.id || coupon.used_by || null,
                updated_at: new Date(),
            })
            .where(eq(couponCodes.id, coupon.id));

        return NextResponse.json({
            success: true,
            couponId: coupon.id,
            couponCode: coupon.code,
            status: 'used',
            message: 'Coupon consumed successfully',
        });
    } catch (error) {
        console.error('[Consume Coupon] Error:', error);
        return NextResponse.json({
            success: false,
            error: { message: 'Server error while consuming coupon' },
        }, { status: 500 });
    }
}
