import { db } from '@/lib/db';
import { /* campaigns, */ inventory, leads /*, loanApplications, deployedAssets, serviceTickets */ } from '@/lib/db/schema';
import { and, eq, ilike, or } from 'drizzle-orm';
import { successResponse, errorResponse, withErrorHandler } from '@/lib/api-utils';
import { requireRole } from '@/lib/auth-utils';

// Global search across dealer ecosystem.
// Supported params (per BRD): customer name, mobile, lead id, loan id, asset/inventory id, service ticket, campaign id
export const GET = withErrorHandler(async (req: Request) => {
    const user = await requireRole(['dealer']);
    const { searchParams } = new URL(req.url);
    const qRaw = (searchParams.get('q') || '').trim();

    if (qRaw.length < 2) {
        return errorResponse('Query too short', 400);
    }

    const q = qRaw.replace(/\s+/g, ' ');
    const like = `%${q}%`;

    // NOTE: keep each category small for fast UI.
    const [leadRows, inventoryRows /*, loanRows, assetRows, serviceRows, campaignRows */] = await Promise.all([
        db
            .select({
                id: leads.id,
                owner_name: leads.owner_name,
                phone: leads.owner_contact,
                interest_level: leads.interest_level,
            })
            .from(leads)
            .where(
                and(
                    eq(leads.dealer_id, user.dealer_id!),
                    or(
                        ilike(leads.owner_name, like),
                        ilike(leads.id, like),
                        ilike(leads.owner_contact, like),
                        ilike(leads.phone, like),
                        ilike(leads.mobile, like)
                    )
                )
            )
            .limit(8),

        db
            .select({
                id: inventory.id,
                model_type: inventory.model_type,
                asset_type: inventory.asset_type,
                serial_number: inventory.serial_number,
                status: inventory.status,
            })
            .from(inventory)
            .where(
                and(
                    eq(inventory.created_by, user.id),
                    or(
                        ilike(inventory.id, like),
                        ilike(inventory.serial_number, like),
                        ilike(inventory.model_type, like),
                        ilike(inventory.asset_type, like),
                        ilike(inventory.oem_name, like)
                    )
                )
            )
            .limit(8),
    ]);

    return successResponse({
        leads: leadRows.map((r) => ({
            id: r.id,
            label: `${r.owner_name || 'Lead'} · ${r.id}`,
            subLabel: r.phone
                ? `Mobile: ${r.phone} · Interest: ${(r.interest_level || 'cold')}`
                : `Interest: ${(r.interest_level || 'cold')}`,
            href: `/leads?open=${encodeURIComponent(r.id)}`,
        })),
        inventory: inventoryRows.map((r) => ({
            id: r.id,
            label: `${r.model_type} · ${r.id}`,
            subLabel: `${r.asset_type}${r.serial_number ? ` · SN: ${r.serial_number}` : ''} · Status: ${r.status}`,
            href: `/dealer-portal/inventory?open=${encodeURIComponent(r.id)}`,
        })),
        // Placeholders for missing features
        loans: [],
        assets: [],
        services: [],
        campaigns: [],
    });
});