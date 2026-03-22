import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { couponCodes } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const { leadId, currentCouponCode } = await req.json();

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: { message: 'leadId is required' } },
        { status: 400 }
      );
    }

    const rows = await db
      .select()
      .from(couponCodes)
      .where(
        and(
          eq(couponCodes.used_by_lead_id, leadId),
          eq(couponCodes.status, 'reserved')
        )
      )
      .limit(1);

    if (!rows.length) {
      return NextResponse.json({
        success: true,
        message: 'No reserved coupon to release',
      });
    }

    const coupon = rows[0];
    if (currentCouponCode && coupon.code !== String(currentCouponCode).toUpperCase().trim()) {
      return NextResponse.json(
        {
          success: false,
          error: { message: `Lead is reserved with ${coupon.code}, not ${currentCouponCode}` },
        },
        { status: 409 }
      );
    }

    await db
      .update(couponCodes)
      .set({
        status: 'available',
        used_by_lead_id: null,
        used_by: null,
        validated_at: null,
        updated_at: new Date(),
      })
      .where(eq(couponCodes.id, coupon.id));

    return NextResponse.json({
      success: true,
      couponCode: coupon.code,
      newStatus: 'available',
      message: 'Coupon released. You can now enter a new code.',
    });
  } catch (error) {
    console.error('[Coupon Release & Change] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
