import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { leads, manualConsentAudits } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

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

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ leadId: string }> }
) {
    try {
        const admin = await requireAdmin();
        if (!admin) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 403 }
            );
        }

        const { leadId } = await params;
        const body = await req.json();

        const { reviewNotes } = body;

        const rows = await db
            .select()
            .from(manualConsentAudits)
            .where(eq(manualConsentAudits.lead_id, leadId))
            .orderBy(desc(manualConsentAudits.created_at))
            .limit(1);

        if (!rows.length) {
            return NextResponse.json(
                { success: false, error: 'Manual consent record not found' },
                { status: 404 }
            );
        }

        const now = new Date();

        await db.update(manualConsentAudits)
            .set({
                review_status: 'verified',
                rejection_notes: reviewNotes ?? null,
                reviewed_by: admin.id,
                reviewed_at: now,
                updated_at: now,
            })
            .where(eq(manualConsentAudits.id, rows[0].id));

        await db.update(leads)
            .set({
                consent_status: 'verified',
                updated_at: now,
            })
            .where(eq(leads.id, leadId));

        return NextResponse.json({
            success: true,
            status: 'verified',
            reviewedAt: now.toISOString(),
        });
    } catch (error) {
        console.error('[Manual Consent Verify] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Server error' },
            { status: 500 }
        );
    }
}
