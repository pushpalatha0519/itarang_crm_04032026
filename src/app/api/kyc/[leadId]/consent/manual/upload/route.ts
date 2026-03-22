export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { leads, manualConsentAudits } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import {
    isPdfBuffer,
    runVirusScan,
    extractPdfMetadata,
    runOptionalConsentOcrChecks,
} from '@/lib/manual-consent';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ leadId: string }> }
) {
    try {
        const { leadId } = await params;
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { success: false, error: { message: 'Unauthorized' } },
                { status: 401 }
            );
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: { message: 'File is required' } },
                { status: 400 }
            );
        }

        if (file.type !== 'application/pdf') {
            return NextResponse.json(
                { success: false, error: { message: 'Only PDF files are allowed' } },
                { status: 400 }
            );
        }

        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json(
                { success: false, error: { message: 'Max file size is 10MB' } },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        if (!isPdfBuffer(buffer)) {
            return NextResponse.json(
                { success: false, error: { message: 'Invalid PDF signature / magic bytes' } },
                { status: 400 }
            );
        }

        const virusScan = await runVirusScan(buffer);
        if (virusScan.infected) {
            return NextResponse.json(
                { success: false, error: { message: 'Uploaded file failed virus scan' } },
                { status: 400 }
            );
        }

        const pdfMetadata = await extractPdfMetadata(buffer);
        const ocrSummary = await runOptionalConsentOcrChecks(buffer);

        const fileName = `kyc/${leadId}/consent/manual_signed_${Date.now()}.pdf`;

        const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(fileName, buffer, {
                contentType: 'application/pdf',
                upsert: true,
            });

        if (uploadError) {
            return NextResponse.json(
                { success: false, error: { message: uploadError.message } },
                { status: 500 }
            );
        }

        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
        const now = new Date();

        const latestAuditRows = await db
            .select()
            .from(manualConsentAudits)
            .where(eq(manualConsentAudits.lead_id, leadId))
            .orderBy(desc(manualConsentAudits.created_at))
            .limit(1);

        if (!latestAuditRows.length) {
            return NextResponse.json(
                { success: false, error: { message: 'Generate manual consent PDF first' } },
                { status: 400 }
            );
        }

        const latestAudit = latestAuditRows[0];

        await db.update(manualConsentAudits)
            .set({
                signed_pdf_url: urlData.publicUrl,
                signed_pdf_name: file.name,
                signed_pdf_size: file.size,
                signed_pdf_uploaded_at: now,
                uploaded_by: user.id,
                pdf_metadata: pdfMetadata,
                ocr_summary: ocrSummary,
                upload_quality_flags: {
                    needsQualityReview: true,
                    dpiCheck: 'manual_review_required',
                    source: 'manual_upload',
                },
                review_status: 'manual_review_pending',
                updated_at: now,
            })
            .where(eq(manualConsentAudits.id, latestAudit.id));

        await db.update(leads)
            .set({
                consent_status: 'manual_review_pending',
                updated_at: now,
            })
            .where(eq(leads.id, leadId));

        console.info(`[Manual Consent] Admin notification hook -> lead ${leadId}`);
        console.info(`[Manual Consent] Dealer notification hook -> lead ${leadId}`);

        return NextResponse.json({
            success: true,
            fileUrl: urlData.publicUrl,
            uploadedAt: now.toISOString(),
            status: 'manual_review_pending',
        });
    } catch (error) {
        console.error('[Manual Consent Upload] Error:', error);
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json(
            { success: false, error: { message } },
            { status: 500 }
        );
    }
}