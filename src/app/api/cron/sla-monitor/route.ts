import { db } from '@/lib/db';
import { slas, auditLogs, users, leads, consentRecords } from '@/lib/db/schema';
import { eq, lt, and, inArray, sql } from 'drizzle-orm';
import { withErrorHandler, successResponse, generateId } from '@/lib/api-utils';
import { triggerN8nWebhook } from '@/lib/n8n';

// This route should be triggered by an external cron (e.g., Vercel Cron, GitHub Actions)
// it can be protected by an API_SECRET key in headers
export const GET = withErrorHandler(async (req: Request) => {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Only return unauthorized in production for security
        if (process.env.NODE_ENV === 'production') {
            return new Response('Unauthorized', { status: 401 });
        }
    }

    const now = new Date();

    // Consent expiry handler (runs with same cron trigger).
    const expiredConsentLeads = await db
        .select({ id: leads.id })
        .from(leads)
        .where(
            and(
                inArray(leads.consent_status, ['link_sent', 'link_opened', 'esign_in_progress']),
                lt(leads.consent_link_expires_at, now)
            )
        );

    for (const row of expiredConsentLeads) {
        await db.update(leads)
            .set({
                consent_status: 'expired',
                updated_at: now,
            })
            .where(eq(leads.id, row.id));

        await db.update(consentRecords)
            .set({
                consent_status: 'expired',
                updated_at: now,
            })
            .where(
                and(
                    eq(consentRecords.lead_id, row.id),
                    inArray(consentRecords.consent_status, ['link_sent', 'link_opened', 'esign_in_progress'])
                )
            );
    }

    // 1. Find active SLAs that have breached their deadline
    const breachedSlas = await db.select()
        .from(slas)
        .where(and(
            eq(slas.status, 'active'),
            lt(slas.sla_deadline, now)
        ));

    if (breachedSlas.length === 0) {
        return successResponse({
            message: 'No breached SLAs found',
            consentLinksExpired: expiredConsentLeads.length,
        });
    }

    // 2. Fetch CEO for default escalation if no specific escalatee
    const [ceo] = await db.select().from(users).where(eq(users.role, 'ceo')).limit(1);

    const results = await db.transaction(async (tx) => {
        const processed = [];

        for (const sla of breachedSlas) {
            // Update status to breached
            await tx.update(slas)
                .set({
                    status: 'breached',
                    escalated_at: now,
                    escalated_to: sla.escalated_to || ceo?.id // Default to CEO if not specified
                })
                .where(eq(slas.id, sla.id));

            // Log the breach
            await tx.insert(auditLogs).values({
                id: await generateId('AUDIT', auditLogs),
                entity_type: sla.entity_type,
                entity_id: sla.entity_id,
                action: 'complete', // action indicating an auto-process
                changes: { sla_status: 'breached', escalated: true },
                performed_by: ceo?.id || sla.assigned_to!, // Logged as system/CEO action
            });

            // Trigger n8n notification for breach
            await triggerN8nWebhook('sla-breach-notification', {
                sla_id: sla.id,
                entity_type: sla.entity_type,
                entity_id: sla.entity_id,
                breach_time: now.toISOString(),
                assigned_to_id: sla.assigned_to,
                escalated_to_id: sla.escalated_to || ceo?.id
            });

            processed.push(sla.id);
        }

        return processed;
    });

    return successResponse({
        message: `Processed ${results.length} breached SLAs`,
        ids: results,
        consentLinksExpired: expiredConsentLeads.length,
    });
});
