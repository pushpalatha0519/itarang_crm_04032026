// /app/api/kyc/[leadId]/consent/manual/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { manualConsentAudits } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';

async function uploadFileToStorage(file: Blob, fileName: string): Promise<string> {
  // Implement your storage logic here
  return `/uploads/${fileName}`;
}

export async function POST(req: NextRequest, { params }: { params: { leadId: string } }) {
  const leadId = params.leadId;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const fileBlob = formData.get('file') as Blob;
  if (!fileBlob) return NextResponse.json({ success: false, message: 'No file uploaded' });

  const fileName = (fileBlob as any).name || 'consent.pdf';
  const fileSize = fileBlob.size;
  const fileType = fileBlob.type;

  if (fileType !== 'application/pdf' || fileSize > 10 * 1024 * 1024) {
    return NextResponse.json({ success: false, message: 'Only PDF under 10MB allowed' });
  }

  const uploadedFileUrl = await uploadFileToStorage(fileBlob, fileName);

  // Check if row exists
  const existingRow = await db.select().from(manualConsentAudits).where(manualConsentAudits.lead_id.eq(leadId));

  if (existingRow.length > 0) {
    await db.update(manualConsentAudits)
      .set({
        signed_pdf_url: uploadedFileUrl,
        signed_pdf_name: fileName,
        signed_pdf_size: fileSize,
        signed_pdf_uploaded_at: new Date(),
        uploaded_by: user.id,
        review_status: 'manual_review_pending',
        updated_at: new Date(),
      })
      .where(manualConsentAudits.lead_id.eq(leadId));
  } else {
    await db.insert(manualConsentAudits).values({
      id: crypto.randomUUID(),
      lead_id: leadId,
      signed_pdf_url: uploadedFileUrl,
      signed_pdf_name: fileName,
      signed_pdf_size: fileSize,
      signed_pdf_uploaded_at: new Date(),
      uploaded_by: user.id,
      review_status: 'manual_review_pending',
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  return NextResponse.json({ success: true, message: 'File uploaded successfully', pdfUrl: uploadedFileUrl });
}