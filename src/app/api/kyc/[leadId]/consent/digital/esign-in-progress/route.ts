import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { consentRecords, leads } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { CONSENT_STATUS } from '@/lib/consent-status';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const body = await req.json().catch(() => ({}));
    const transactionId = body?.transactionId as string | undefined;
    const token = body?.token as string | undefined;

    const rows = await db
      .select()
      .from(consentRecords)
      .where(eq(consentRecords.lead_id, leadId))
      .orderBy(desc(consentRecords.created_at))
      .limit(1);

    if (!rows.length) {
      return NextResponse.json(
        { success: false, error: { message: 'Consent record not found' } },
        { status: 404 }
      );
    }

    const record = rows[0];
    if (token && record.consent_token && token !== record.consent_token) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid consent token' } },
        { status: 401 }
      );
    }

    const now = new Date();
    await db
      .update(consentRecords)
      .set({
        consent_status: CONSENT_STATUS.ESIGN_IN_PROGRESS,
        updated_at: now,
      })
      .where(eq(consentRecords.id, record.id));

    await db
      .update(leads)
      .set({
        consent_status: CONSENT_STATUS.ESIGN_IN_PROGRESS,
        esign_transaction_id: transactionId ?? null,
        updated_at: now,
      })
      .where(eq(leads.id, leadId));

    return NextResponse.json({ success: true, status: CONSENT_STATUS.ESIGN_IN_PROGRESS });
  } catch (error) {
    console.error('[Consent eSign In Progress] Error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
