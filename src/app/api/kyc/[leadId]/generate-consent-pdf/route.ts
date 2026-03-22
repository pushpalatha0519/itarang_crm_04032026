// src/app/api/kyc/[leadId]/generate-consent-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const leadId = url.pathname.split('/')[3];

    const buffers: Buffer[] = [];
    const doc = new PDFDocument({ 
      autoFirstPage: false,
      size: 'A4', 
      margin: 50 
    });

    // Use local font to avoid ENOENT errors with standard fonts in Next.js bundle
    const pathMod = await import('path');
    const fs = await import('fs');
    const fontPath = pathMod.join(process.cwd(), 'public', 'fonts', 'Roboto-VariableFont_wdth,wght.ttf');
    
    doc.addPage();
    if (fs.existsSync(fontPath)) {
      doc.font(fontPath);
    }

    doc.fontSize(20);
    doc.text('KYC Consent Form', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(14);
    doc.text(`Lead ID: ${leadId}`);
    doc.text(`Date: ${new Date().toLocaleString('en-IN')}`);
    doc.moveDown();
    
    doc.fontSize(12);
    doc.text('I consent to KYC verification and data processing.', { lineGap: 4 });

    doc.on('data', (chunk) => buffers.push(chunk as Buffer));
    doc.end();

    await new Promise((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);
    });

    const pdfBuffer = Buffer.concat(buffers);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="kyc_${leadId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF Error:', error);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}