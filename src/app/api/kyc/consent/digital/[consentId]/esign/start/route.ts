import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { consentRecords, leads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { aadhaarGenerateOtp } from '@/lib/decentro';
import { CONSENT_STATUS, normalizeConsentStatus } from '@/lib/consent-status';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ consentId: string }> }
) {
  try {
    const { consentId } = await params;
    const { token, aadhaarNumber } = await req.json();

    if (!token || !aadhaarNumber) {
      return NextResponse.json(
        { success: false, error: { message: 'token and aadhaarNumber are required' } },
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
    const normalizedStatus = normalizeConsentStatus(lead.consent_status);
    if ([CONSENT_STATUS.VERIFIED, CONSENT_STATUS.EXPIRED, CONSENT_STATUS.ESIGN_BLOCKED].includes(normalizedStatus)) {
      return NextResponse.json(
        { success: false, error: { message: `Consent is in terminal state: ${normalizedStatus}` } },
        { status: 409 }
      );
    }

    const now = new Date();
    await db
      .update(consentRecords)
      .set({
        consent_status: CONSENT_STATUS.ESIGN_IN_PROGRESS,
        updated_at: now,
      })
      .where(eq(consentRecords.id, consentId));

    await db
      .update(leads)
      .set({
        consent_status: CONSENT_STATUS.ESIGN_IN_PROGRESS,
        updated_at: now,
      })
      .where(eq(leads.id, lead.id));

    const otpRes = await aadhaarGenerateOtp(aadhaarNumber);
    const txnId = otpRes?.decentroTxnId || otpRes?.decentro_txn_id || otpRes?.data?.decentroTxnId || otpRes?.data?.decentro_txn_id;

    if (!otpRes?.success || !txnId) {
      return NextResponse.json(
        { success: false, error: { message: otpRes?.message || 'Failed to initiate Aadhaar OTP' } },
        { status: 400 }
      );
    }

    await db
      .update(leads)
      .set({
        esign_transaction_id: txnId,
        updated_at: new Date(),
      })
      .where(eq(leads.id, lead.id));

    return NextResponse.json({
      success: true,
      status: CONSENT_STATUS.ESIGN_IN_PROGRESS,
      transactionId: txnId,
      message: 'OTP sent to Aadhaar-linked mobile',
    });
  } catch (error) {
    console.error('[Consent eSign Start] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
