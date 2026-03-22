export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { leads, consentRecords, manualConsentAudits } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import {
    cleanupExpiredManualConsentPreviews,
    ensurePublicTmpDir,
    generateManualConsentId,
} from '@/lib/manual-consent';

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ leadId: string }> }
) {
    try {
        const { leadId } = await params;

        cleanupExpiredManualConsentPreviews();

        const leadRows = await db
            .select({
                id: leads.id,
                full_name: leads.full_name,
                father_or_husband_name: leads.father_or_husband_name,
                dob: leads.dob,
                current_address: leads.current_address,
                asset_model: leads.asset_model,
                payment_method: leads.payment_method,
            })
            .from(leads)
            .where(eq(leads.id, leadId))
            .limit(1);

        if (!leadRows.length) {
            return NextResponse.json(
                { success: false, error: { message: 'Lead not found' } },
                { status: 404 }
            );
        }

        const lead = leadRows[0];
        const tmpDir = ensurePublicTmpDir();

        const fileName = `consent_preview_${leadId}_${Date.now()}.pdf`;
        const filePath = path.join(tmpDir, fileName);
        const pdfUrl = `/tmp/${fileName}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const doc = new PDFDocument({ 
            autoFirstPage: false,
            margin: 50 
        });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Add page first, then set font to avoid default Helvetica load
        doc.addPage();

        // Use local font to avoid ENOENT errors with standard fonts in Next.js bundle
        const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Roboto-VariableFont_wdth,wght.ttf');
        if (fs.existsSync(fontPath)) {
            doc.font(fontPath);
        }

        const logoPath = path.join(process.cwd(), 'public', 'logo-full.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 35, { fit: [140, 50] });
        }

        doc.moveDown(2);
        doc.fontSize(18).text('Customer Consent Form', { align: 'center' });
        doc.moveDown(1);

        doc.fontSize(12).text('CUSTOMER LOAN CONSENT FORM', { underline: true });
        doc.moveDown(0.8);

        doc.text(`Lead ID: ${lead.id}`);
        doc.text(`Customer Name: ${lead.full_name || '-'}`);
        doc.text(`Father / Husband Name: ${lead.father_or_husband_name || '-'}`);
        doc.text(`Date of Birth: ${lead.dob ? new Date(lead.dob).toLocaleDateString() : '-'}`);
        doc.text(`Address: ${lead.current_address || '-'}`);
        doc.text(`Product Details: ${lead.asset_model || '-'} / ${lead.payment_method || '-'}`);

        doc.moveDown(1.2);
        doc.text(
            'I hereby provide my consent to iTarang and its lending / verification partners to process my application, verify my KYC details, perform bureau / credit checks where applicable, and use the submitted documents for loan processing and compliance purposes.'
        );

        doc.moveDown(1.2);
        doc.text('Customer Signature: ______________________________');
        doc.moveDown(1);
        doc.text('Customer Thumb Impression: ________________________');
        doc.moveDown(1);
        doc.text('Witness Signature: ________________________________');
        doc.moveDown(1);
        doc.text('Date: ____ / ____ / ______');

        doc.moveDown(2);
        doc.fontSize(9).fillColor('gray').text(
            'This is a digitally generated document.',
            { align: 'center' }
        );

        doc.end();

        await new Promise<void>((resolve, reject) => {
            stream.on('finish', () => resolve());
            stream.on('error', reject);
        });

        const consentRecordId = generateManualConsentId('CONSENT');
        const auditId = generateManualConsentId('MCAUDIT');
        const now = new Date();

        await db.insert(consentRecords).values({
            id: consentRecordId,
            lead_id: leadId,
            consent_for: 'primary',
            channel: 'manual',
            consent_type: 'manual',
            consent_status: 'manual_pdf_generated',
            generated_pdf_url: pdfUrl,
            created_at: now,
            updated_at: now,
        });

        await db.insert(manualConsentAudits).values({
            id: auditId,
            lead_id: leadId,
            consent_record_id: consentRecordId,
            preview_pdf_url: pdfUrl,
            preview_pdf_path: filePath,
            preview_expires_at: expiresAt,
            review_status: 'manual_pdf_generated',
            sign_method: 'manual',
            created_at: now,
            updated_at: now,
        });

        await db.update(leads)
            .set({
                consent_status: 'manual_pdf_generated',
                updated_at: now,
            })
            .where(eq(leads.id, leadId));

        return NextResponse.json({
            success: true,
            pdfUrl,
            expiresIn: 24 * 3600,
            downloadLink: 'Download opens automatically',
        });
    } catch (error) {
        console.error('[Manual Consent Generate PDF] Error:', error);
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json(
            { success: false, error: { message } },
            { status: 500 }
        );
    }
}