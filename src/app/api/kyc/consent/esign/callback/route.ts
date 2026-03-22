import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { consentRecords, leads, manualConsentAudits } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { CONSENT_STATUS } from '@/lib/consent-status';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { transactionId, status, leadId, certificateId, signedPdfUrl, signerAadhaar, error } = body;

        console.log(`[eSign Callback] Received for Lead: ${leadId}, Status: ${status}`);

        const activeLeadId = leadId ?? null;
        if (!activeLeadId) {
            return NextResponse.json({ success: false, error: 'Lead ID not found' }, { status: 400 });
        }

        const record = await db
            .select()
            .from(consentRecords)
            .where(eq(consentRecords.lead_id, activeLeadId))
            .limit(1);

        const now = new Date();

        if (status === 'success') {
            await db.transaction(async (tx) => {
                // Update Consent Record
                if (record[0]?.id) {
                    await tx
                        .update(consentRecords)
                        .set({
                            consent_status: CONSENT_STATUS.ADMIN_REVIEW_PENDING,
                            signed_consent_url: signedPdfUrl,
                            signed_at: now,
                            updated_at: now,
                        })
                        .where(eq(consentRecords.id, record[0].id));
                }

                // Update Lead
                await tx.update(leads).set({
                    consent_status: CONSENT_STATUS.ADMIN_REVIEW_PENDING,
                    esign_transaction_id: transactionId,
                    esign_certificate_id: certificateId,
                    esign_completed_at: now,
                    updated_at: now,
                }).where(eq(leads.id, activeLeadId));

                // Create Admin Task (Manual Audit Record for review)
                await tx.insert(manualConsentAudits).values({
                    id: `AUDIT-${now.getTime()}`,
                    lead_id: activeLeadId,
                    consent_record_id: record[0]?.id ?? null,
                    signed_pdf_url: signedPdfUrl,
                    signed_pdf_uploaded_at: now,
                    sign_method: 'aadhaar_esign',
                    review_status: CONSENT_STATUS.ADMIN_REVIEW_PENDING,
                    created_at: now,
                    updated_at: now,
                });
            });

            return NextResponse.json({ success: true, message: `Status updated to ${CONSENT_STATUS.ADMIN_REVIEW_PENDING}` });

        } else if (status === 'failed') {
            const leadRows = await db
                .select()
                .from(leads)
                .where(eq(leads.id, activeLeadId))
                .limit(1);
            const lead = leadRows[0];
            const nextAttemptCount = (lead?.consent_attempt_count || 0) + 1;
            const nextStatus = nextAttemptCount >= 3 ? CONSENT_STATUS.ESIGN_BLOCKED : CONSENT_STATUS.ESIGN_FAILED;

            await db.update(leads).set({
                consent_status: nextStatus,
                esign_failed_at: now,
                esign_error_code: error?.code || 'ESIGN_FAILURE',
                esign_error_message: error?.message || 'Aadhaar eSign failed',
                consent_attempt_count: nextAttemptCount,
                updated_at: now,
            }).where(eq(leads.id, activeLeadId));

            if (record[0]?.id) {
                await db
                    .update(consentRecords)
                    .set({
                        consent_status: nextStatus,
                        updated_at: now,
                    })
                    .where(eq(consentRecords.id, record[0].id));
            }

            return NextResponse.json({
                success: true,
                status: nextStatus,
                retryAllowed: nextStatus !== 'esign_blocked',
                message: `Status updated to ${nextStatus}`,
            });
        }

        return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });

    } catch (error) {
        console.error('[eSign Callback] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
