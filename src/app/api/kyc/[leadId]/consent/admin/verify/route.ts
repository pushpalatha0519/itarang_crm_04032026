import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { leads, manualConsentAudits } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
    try {
        const { leadId } = await params;
        const { notes } = await req.json();

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const now = new Date();

        await db.transaction(async (tx) => {
            // Update Lead
            await tx.update(leads).set({
                consent_status: 'verified',
                consent_verified_by: user.id,
                consent_verified_at: now,
                consent_verification_notes: notes,
                consent_final: true,
                updated_at: now,
            }).where(eq(leads.id, leadId));

            // Update associated manual audits if any
            const audits = await tx.select().from(manualConsentAudits).where(eq(manualConsentAudits.lead_id, leadId)).orderBy(desc(manualConsentAudits.created_at)).limit(1);
            if (audits.length) {
                await tx.update(manualConsentAudits).set({
                    review_status: 'verified',
                    reviewed_by: user.id,
                    reviewed_at: now,
                    updated_at: now,
                }).where(eq(manualConsentAudits.id, audits[0].id));
            }
        });

        return NextResponse.json({ success: true, message: 'Consent verified successfully' });

    } catch (error) {
        console.error('[Admin Verify Consent] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
