import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { manualConsentAudits, leads, accounts } from '@/lib/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';

const ADMIN_ROLES = ['ceo', 'business_head', 'sales_head'];

async function requireAdmin() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    const { data: profile } = await supabase
        .from('users')
        .select('id, role, name')
        .eq('id', user.id)
        .single();

    if (!profile || !ADMIN_ROLES.includes(profile.role)) return null;
    return profile;
}

export async function GET(req: NextRequest) {
    try {
        const admin = await requireAdmin();
        if (!admin) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || 'manual_review_pending';

        const rows = await db
            .select()
            .from(manualConsentAudits)
            .where(eq(manualConsentAudits.review_status, status))
            .orderBy(desc(manualConsentAudits.created_at));

        if (!rows.length) {
            return NextResponse.json({ success: true, data: [] });
        }

        const leadIds = [...new Set(rows.map(r => r.lead_id))];

        const leadRows = await db
            .select({
                id: leads.id,
                full_name: leads.full_name,
                dealer_id: leads.dealer_id,
                consent_status: leads.consent_status,
            })
            .from(leads)
            .where(inArray(leads.id, leadIds));

        const dealerIds = [...new Set(leadRows.map(l => l.dealer_id).filter(Boolean))] as string[];

        const dealerRows = dealerIds.length
            ? await db
                .select({
                    id: accounts.id,
                    business_entity_name: accounts.business_entity_name,
                })
                .from(accounts)
                .where(inArray(accounts.id, dealerIds))
            : [];

        const dealerMap = Object.fromEntries(
            dealerRows.map(d => [d.id, d.business_entity_name])
        );

        const leadMap = Object.fromEntries(
            leadRows.map(l => [l.id, l])
        );

        const data = rows.map(row => ({
            id: row.id,
            lead_id: row.lead_id,
            customer_name: leadMap[row.lead_id]?.full_name || 'Unknown',
            dealer_name: dealerMap[leadMap[row.lead_id]?.dealer_id || ''] || 'Unknown Dealer',
            consent_status: leadMap[row.lead_id]?.consent_status || row.review_status,
            signed_pdf_url: row.signed_pdf_url,
            signed_pdf_uploaded_at: row.signed_pdf_uploaded_at,
            review_status: row.review_status,
            pdf_metadata: row.pdf_metadata,
            ocr_summary: row.ocr_summary,
            upload_quality_flags: row.upload_quality_flags,
        }));

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('[Admin Manual Consent Reviews] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Server error' },
            { status: 500 }
        );
    }
}