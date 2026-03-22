export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { consentRecords, leads, manualConsentAudits } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createRequire } from 'module';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { buildManualConsentPdfHtml } from '@/lib/templates/manual-consent-pdf-template';
import { generateManualConsentId } from '@/lib/manual-consent';

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ leadId: string }> }
) {
    try {
        const { leadId } = await params;

        const leadRows = await db
            .select({
                id: leads.id,
                full_name: leads.full_name,
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
        const customerName = (lead.full_name ?? '').trim() || 'Customer';
        const formattedDate = new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        });
        const logoPath = join(process.cwd(), 'public', 'logo-full.png');
        const logoDataUrl = existsSync(logoPath)
            ? `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`
            : undefined;

        const html = buildManualConsentPdfHtml({
            customerName,
            date: formattedDate,
            organisationName: 'iTarang Technologies LLP',
            logoDataUrl,
        });

        await db
            .update(leads)
            .set({
                consent_status: 'manual_pdf_generated',
                updated_at: new Date(),
            })
            .where(eq(leads.id, leadId));

        const require = createRequire(import.meta.url);
        let puppeteer: any;
        try {
            puppeteer = require('puppeteer');
        } catch {
            throw new Error(
                'Puppeteer dependency is missing. Install it with: npm install puppeteer'
            );
        }

        const launchOptions: Record<string, unknown> = {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        };

        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        } else {
            const windowsBrowserCandidates = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            ];
            const detectedExecutable = windowsBrowserCandidates.find((p: string) => existsSync(p));
            if (detectedExecutable) {
                launchOptions.executablePath = detectedExecutable;
            } else {
                launchOptions.channel = 'chrome';
            }
        }

        const browser = await puppeteer.launch({
            ...launchOptions,
        });

        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20mm',
                    right: '16mm',
                    bottom: '20mm',
                    left: '16mm',
                },
            });
            const now = new Date();
            const consentRecordId = generateManualConsentId('CONSENT');
            const manualAuditId = generateManualConsentId('MCAUDIT');

            await db.insert(consentRecords).values({
                id: consentRecordId,
                lead_id: leadId,
                consent_for: 'primary',
                channel: 'manual',
                consent_type: 'manual',
                consent_status: 'manual_pdf_generated',
                created_at: now,
                updated_at: now,
            });

            await db.insert(manualConsentAudits).values({
                id: manualAuditId,
                lead_id: leadId,
                consent_record_id: consentRecordId,
                review_status: 'manual_pdf_generated',
                sign_method: 'manual',
                created_at: now,
                updated_at: now,
            });

            return new NextResponse(pdfBuffer, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': 'attachment; filename="DPDPA_consent_form_for_data_processing.pdf"',
                    'Cache-Control': 'no-store',
                },
            });
        } finally {
            await browser.close();
        }
    } catch (error) {
        console.error('[Manual Consent Generate PDF] Error:', error);
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json(
            { success: false, error: { message } },
            { status: 500 }
        );
    }
}
