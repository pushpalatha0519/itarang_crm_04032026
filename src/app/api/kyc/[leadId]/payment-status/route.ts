import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { facilitationPayments, couponCodes } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { fetchQrStatus, fetchQrPayments } from '@/lib/razorpay';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
    try {
        const { leadId } = await params;
        const reservedRows = await db.select({
            id: couponCodes.id,
            code: couponCodes.code,
            status: couponCodes.status,
            validated_at: couponCodes.validated_at,
        })
            .from(couponCodes)
            .where(and(
                eq(couponCodes.used_by_lead_id, leadId),
                eq(couponCodes.status, 'reserved')
            ))
            .orderBy(desc(couponCodes.validated_at))
            .limit(1);
        const reservedCoupon = reservedRows[0] || null;
        const reservedCouponPayload = reservedCoupon ? {
            id: reservedCoupon.id,
            code: reservedCoupon.code,
            status: reservedCoupon.status,
            reservedAt: reservedCoupon.validated_at,
        } : null;

        // Get latest facilitation payment for this lead
        const rows = await db.select()
            .from(facilitationPayments)
            .where(eq(facilitationPayments.lead_id, leadId))
            .orderBy(desc(facilitationPayments.created_at))
            .limit(1);

        if (!rows.length) {
            return NextResponse.json({
                success: true,
                data: null,
                fee_paid: false,
                status: 'UNPAID',
                hasReservedCoupon: !!reservedCouponPayload,
                reservedCoupon: reservedCouponPayload,
            });
        }

        const payment = rows[0];

        // If already paid, return immediately
        if (payment.facilitation_fee_status === 'PAID') {
            return NextResponse.json({
                success: true,
                data: payment,
                fee_paid: true,
                status: 'PAID',
                hasReservedCoupon: !!reservedCouponPayload,
                reservedCoupon: reservedCouponPayload,
            });
        }

        // Poll Razorpay for QR status if we have a QR ID and status is QR_GENERATED
        if (payment.razorpay_qr_id && payment.facilitation_fee_status === 'QR_GENERATED') {
            try {
                const qrStatus = await fetchQrStatus(payment.razorpay_qr_id);

                // Check if payment was received
                if (qrStatus.payments_count_received > 0) {
                    const payments = await fetchQrPayments(payment.razorpay_qr_id);
                    const firstPayment = payments.items?.[0];

                    if (firstPayment && firstPayment.status === 'captured') {
                        // Update payment record
                        await db.update(facilitationPayments)
                            .set({
                                facilitation_fee_status: 'PAID',
                                razorpay_payment_id: firstPayment.id,
                                razorpay_payment_status: firstPayment.status,
                                razorpay_qr_status: qrStatus.status,
                                payment_paid_at: new Date(),
                                payment_verified_at: new Date(),
                                payment_verification_source: 'poll',
                                updated_at: new Date(),
                            })
                            .where(eq(facilitationPayments.id, payment.id));

                        return NextResponse.json({
                            success: true,
                            data: { ...payment, facilitation_fee_status: 'PAID', razorpay_payment_id: firstPayment.id },
                            fee_paid: true,
                            status: 'PAID',
                            hasReservedCoupon: !!reservedCouponPayload,
                            reservedCoupon: reservedCouponPayload,
                        });
                    }
                }

                // Check if QR expired
                if (['expired', 'closed'].includes(qrStatus.status)) {
                    await db.update(facilitationPayments)
                        .set({
                            facilitation_fee_status: 'EXPIRED',
                            razorpay_qr_status: qrStatus.status,
                            updated_at: new Date(),
                        })
                        .where(eq(facilitationPayments.id, payment.id));

                    return NextResponse.json({
                        success: true,
                        data: { ...payment, facilitation_fee_status: 'EXPIRED' },
                        fee_paid: false,
                        status: 'EXPIRED',
                        hasReservedCoupon: !!reservedCouponPayload,
                        reservedCoupon: reservedCouponPayload,
                    });
                }
            } catch (err) {
                // Razorpay API error - return DB status
                console.error('[Payment Status] Razorpay poll error:', err);
            }
        }

        return NextResponse.json({
            success: true,
            data: payment,
            fee_paid: false,
            status: payment.facilitation_fee_status,
            hasReservedCoupon: !!reservedCouponPayload,
            reservedCoupon: reservedCouponPayload,
        });
    } catch (error) {
        console.error('[Payment Status] Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
