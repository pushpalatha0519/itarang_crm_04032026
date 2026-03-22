import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { manualConsentAudits, leads } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        // TODO: Check if user is admin/CEO/Head
        
        const tasks = await db.select({
            id: manualConsentAudits.id,
            lead_id: manualConsentAudits.lead_id,
            customer_name: leads.owner_name,
            sign_method: manualConsentAudits.sign_method,
            signed_pdf_url: manualConsentAudits.signed_pdf_url,
            uploaded_at: manualConsentAudits.signed_pdf_uploaded_at,
            review_status: manualConsentAudits.review_status,
            ocr_summary: manualConsentAudits.ocr_summary,
        })
        .from(manualConsentAudits)
        .innerJoin(leads, eq(manualConsentAudits.lead_id, leads.id))
        .where(eq(manualConsentAudits.review_status, 'manual_review_pending'))
        .orderBy(desc(manualConsentAudits.created_at));

        return NextResponse.json({ success: true, data: tasks });

    } catch (error) {
        console.error('[Admin Consent Reviews] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
