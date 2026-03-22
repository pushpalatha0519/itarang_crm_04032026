import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { consentRecords, leads, manualConsentAudits } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { transactionId, status, leadId, certificateId, signedPdfUrl, signerAadhaar, error } = body;

        console.log(`[eSign Callback] Received for Lead: ${leadId}, Status: ${status}`);

        // 1. Find the consent record
        const record = await db.select().from(consentRecords).where(eq(consentRecords.esign_transaction_id, transactionId)).limit(1);
        
        // Note: In a real scenario, we might also look up by leadId and status='link_sent'
        // If no transactionId match, try leadId
        const activeLeadId = leadId || (record.length ? record[0].lead_id : null);
        if (!activeLeadId) {
            return NextResponse.json({ success: false, error: 'Lead ID not found' }, { status: 400 });
        }

        const now = new Date();

        if (status === 'success') {
            await db.transaction(async (tx) => {
                // Update Consent Record
                await tx.update(consentRecords).set({
                    consent_status: 'digitally_signed',
                    esign_certificate_id: certificateId,
                    signed_pdf_url: signedPdfUrl,
                    signed_at: now,
                    signer_aadhaar_masked: signerAadhaar,
                    sign_method: 'aadhaar_esign',
                    updated_at: now,
                }).where(eq(consentRecords.esign_transaction_id, transactionId));

                // Update Lead
                await tx.update(leads).set({
                    consent_status: 'digitally_signed',
                    esign_transaction_id: transactionId,
                    esign_certificate_id: certificateId,
                    esign_completed_at: now,
                    updated_at: now,
                }).where(eq(leads.id, activeLeadId));

                // Create Admin Task (Manual Audit Record for review)
                await tx.insert(manualConsentAudits).values({
                    id: `AUDIT-${now.getTime()}`,
                    lead_id: activeLeadId,
                    consent_record_id: record[0]?.id || `REC-${now.getTime()}`,
                    signed_pdf_url: signedPdfUrl,
                    signed_pdf_uploaded_at: now,
                    sign_method: 'aadhaar_esign',
                    review_status: 'manual_review_pending',
                    created_at: now,
                    updated_at: now,
                });
            });

            return NextResponse.json({ success: true, message: 'Status updated to digitally_signed' });

        } else if (status === 'failed') {
            await db.update(leads).set({
                consent_status: 'esign_failed',
                esign_failed_at: now,
                esign_error_code: error?.code || 'ESIGN_FAILURE',
                esign_error_message: error?.message || 'Aadhaar eSign failed',
                updated_at: now,
            }).where(eq(leads.id, activeLeadId));

            return NextResponse.json({ success: true, message: 'Status updated to esign_failed' });
        }

        return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });

    } catch (error) {
        console.error('[eSign Callback] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
