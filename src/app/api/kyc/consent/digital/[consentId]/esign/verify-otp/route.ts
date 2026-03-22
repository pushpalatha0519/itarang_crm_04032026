import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { consentRecords, leads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { aadhaarValidateOtp } from '@/lib/decentro';
import { CONSENT_STATUS } from '@/lib/consent-status';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ consentId: string }> }
) {
  try {
    const { consentId } = await params;
    const { token, transactionId, otp } = await req.json();

    if (!token || !transactionId || !otp) {
      return NextResponse.json(
        { success: false, error: { message: 'token, transactionId and otp are required' } },
        { status: 400 }
      );
    }

    const rows = await db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.id, consentId))
      .limit(1);
    if (!rows.length) {
      return NextResponse.json(
        { success: false, error: { message: 'Consent link not found' } },
        { status: 404 }
      );
    }

    const record = rows[0];
    if (!record.consent_token || record.consent_token !== token) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid consent token' } },
        { status: 401 }
      );
    }

    const leadRows = await db
      .select()
      .from(leads)
      .where(eq(leads.id, record.lead_id))
      .limit(1);
    if (!leadRows.length) {
      return NextResponse.json(
        { success: false, error: { message: 'Lead not found' } },
        { status: 404 }
      );
    }

    const lead = leadRows[0];
    const otpRes = await aadhaarValidateOtp(transactionId, otp);

    if (!otpRes?.success) {
      const now = new Date();
      const nextAttemptCount = (lead.consent_attempt_count || 0) + 1;
      const nextStatus = nextAttemptCount >= 3 ? CONSENT_STATUS.ESIGN_BLOCKED : CONSENT_STATUS.ESIGN_FAILED;

      await db
        .update(leads)
        .set({
          consent_status: nextStatus,
          consent_attempt_count: nextAttemptCount,
          esign_failed_at: now,
          esign_error_code: otpRes?.errorCode || 'ESIGN_OTP_FAILED',
          esign_error_message: otpRes?.message || 'Invalid Aadhaar OTP',
          updated_at: now,
        })
        .where(eq(leads.id, lead.id));

      await db
        .update(consentRecords)
        .set({
          consent_status: nextStatus,
          updated_at: now,
        })
        .where(eq(consentRecords.id, consentId));

      return NextResponse.json(
        {
          success: false,
          status: nextStatus,
          retryAllowed: nextStatus !== 'esign_blocked',
          error: { message: otpRes?.message || 'OTP verification failed' },
        },
        { status: 400 }
      );
    }

    // OTP success means eSign is completed and should move to admin review pending.
    const now = new Date();
    await db
      .update(leads)
      .set({
        consent_status: CONSENT_STATUS.ADMIN_REVIEW_PENDING,
        esign_transaction_id: transactionId,
        esign_completed_at: now,
        esign_error_code: null,
        esign_error_message: null,
        updated_at: now,
      })
      .where(eq(leads.id, lead.id));

    await db
      .update(consentRecords)
      .set({
        consent_status: CONSENT_STATUS.ADMIN_REVIEW_PENDING,
        signed_at: now,
        updated_at: now,
      })
      .where(eq(consentRecords.id, consentId));

    return NextResponse.json({
      success: true,
      status: CONSENT_STATUS.ADMIN_REVIEW_PENDING,
      message: 'eSign completed successfully and moved for admin review',
    });
  } catch (error) {
    console.error('[Consent eSign Verify OTP] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
