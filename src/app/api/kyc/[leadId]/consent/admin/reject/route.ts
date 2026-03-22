import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { leads, manualConsentAudits } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { CONSENT_STATUS } from '@/lib/consent-status';

export async function POST(req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
    try {
        const { leadId } = await params;
        const { reason, notes } = await req.json();

        if (!reason) return NextResponse.json({ success: false, error: 'Rejection reason is required' }, { status: 400 });

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const now = new Date();

        await db.transaction(async (tx) => {
            const leadRows = await tx.select().from(leads).where(eq(leads.id, leadId)).limit(1);
            if (!leadRows.length) throw new Error('Lead not found');

            // Update Lead
            await tx.update(leads).set({
                consent_status: CONSENT_STATUS.ADMIN_REJECTED,
                consent_rejection_reason: reason,
                consent_rejection_notes: notes,
                consent_rejected_by: user.id,
                consent_rejected_at: now,
                consent_final: false,
                updated_at: now,
            }).where(eq(leads.id, leadId));

            // Update associated manual audits if any
            const audits = await tx.select().from(manualConsentAudits).where(eq(manualConsentAudits.lead_id, leadId)).orderBy(desc(manualConsentAudits.created_at)).limit(1);
            if (audits.length) {
                await tx.update(manualConsentAudits).set({
                    review_status: CONSENT_STATUS.MANUAL_REJECTED,
                    rejection_reason: reason,
                    rejection_notes: notes,
                    reviewed_by: user.id,
                    reviewed_at: now,
                    updated_at: now,
                }).where(eq(manualConsentAudits.id, audits[0].id));
            }
        });

        // TODO: Trigger notification to dealer about rejection

        return NextResponse.json({ success: true, message: 'Consent rejected successfully' });

    } catch (error) {
        console.error('[Admin Reject Consent] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
