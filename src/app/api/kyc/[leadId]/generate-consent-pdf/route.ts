export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { leads, consentRecords } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;

    // Fetch lead data
    const lead = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead.length) {
      return NextResponse.json(
        { success: false, error: { message: 'Lead not found' } },
        { status: 404 }
      );
    }

    const l = lead[0];

    // Ensure tmp folder exists
    const tmpDir = path.join(process.cwd(), 'public', 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Create PDF filename
    const fileName = `consent_preview_${leadId}_${Date.now()}.pdf`;
    const filePath = path.join(tmpDir, fileName);

    // Create PDF document
    const doc = new PDFDocument({
      margin: 50,
      autoFirstPage: true,
      font : null
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Title
    doc.fontSize(20).text('iTarang Customer Consent Form', {
      align: 'center'
    });

    doc.moveDown();

    // Lead details
    doc.fontSize(12).text(`Customer Name: ${l.full_name || ''}`);
    doc.text(`Lead ID: ${leadId}`);

    doc.moveDown();

    doc.text('CUSTOMER LOAN CONSENT FORM');

    doc.moveDown();

    doc.text(
      'I hereby provide consent for KYC verification, credit check, and loan processing with iTarang.'
    );

    doc.moveDown();

    doc.text('Customer Signature: ________________________');
    doc.text('Customer Thumb Impression: _________________');
    doc.text('Witness Signature: _________________________');

    doc.end();

    const pdfUrl = `/tmp/${fileName}`;

    // Save consent record in DB
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');

    await db.insert(consentRecords).values({
      id: `CONSENT-${dateStr}-${seq}`,
      lead_id: leadId,
      consent_for: 'primary',
      consent_type: 'manual',
      consent_status: 'awaiting_signature',
      generated_pdf_url: pdfUrl,
      created_at: now,
      updated_at: now
    });

    return NextResponse.json({
      success: true,
      pdfUrl,
      expiresIn: 3600
    });
  } catch (error) {
    console.error('[Generate Consent PDF] Error:', error);

    const message =
      error instanceof Error ? error.message : 'Server error';

    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 }
    );
  }
}