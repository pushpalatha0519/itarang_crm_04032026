import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { consentRecords, leads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { CONSENT_STATUS, normalizeConsentStatus } from '@/lib/consent-status';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ consentId: string }> }
) {
  try {
    const { consentId } = await params;
    const token = req.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing consent token' } },
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
    const isExpired =
      !!lead.consent_link_expires_at &&
      new Date(lead.consent_link_expires_at).getTime() < Date.now();

    if (isExpired) {
      return NextResponse.json(
        {
          success: false,
          expired: true,
          status: 'expired',
          error: { message: 'Consent link expired' },
        },
        { status: 410 }
      );
    }

    const now = new Date();
    const normalizedStatus = normalizeConsentStatus(lead.consent_status);

    if (normalizedStatus === CONSENT_STATUS.LINK_SENT) {
      await db
        .update(leads)
        .set({
          consent_status: CONSENT_STATUS.LINK_OPENED,
          updated_at: now,
        })
        .where(eq(leads.id, lead.id));

      await db
        .update(consentRecords)
        .set({
          consent_status: CONSENT_STATUS.LINK_OPENED,
          updated_at: now,
        })
        .where(eq(consentRecords.id, consentId));
    }

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      customerName: lead.full_name || lead.owner_name || 'Customer',
      status:
        normalizedStatus === CONSENT_STATUS.LINK_SENT
          ? CONSENT_STATUS.LINK_OPENED
          : normalizedStatus,
      expiresAt: lead.consent_link_expires_at,
      canProceed: ![CONSENT_STATUS.EXPIRED, CONSENT_STATUS.VERIFIED].includes(normalizedStatus),
    });
  } catch (error) {
    console.error('[Consent Validate Link] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
