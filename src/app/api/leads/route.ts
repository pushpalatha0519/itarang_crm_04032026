import { createClient } from '@/lib/supabase/server';
import { withErrorHandler, successResponse, errorResponse } from '@/lib/api-utils';
import { requireAuth } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { eq, and, ilike, or, desc } from 'drizzle-orm';

export const GET = withErrorHandler(async (req: Request) => {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const interest = searchParams.get('type') || searchParams.get('interest'); // support both keys

    const userRole = (user.role || 'user').toLowerCase();
    
    // Base conditions
    let conditions = [];

    // Role-based scoping
    if (userRole === 'dealer') {
        if (!user.dealer_id) return errorResponse('Dealer ID missing from profile', 400);
        conditions.push(eq(leads.dealer_id, user.dealer_id));
    } else if (['sales_executive', 'sales_manager'].includes(userRole)) {
        conditions.push(eq(leads.uploader_id, user.id));
    }
    // CEO, Admin, Business Head see everything (no scoping condition)

    // Filters
    if (status && status !== 'All') {
        conditions.push(eq(leads.lead_status, status.toLowerCase()));
    }
    if (interest && interest !== 'All') {
        conditions.push(eq(leads.interest_level, interest.toLowerCase()));
    }

    // Search
    let queryBuilder = db.select().from(leads);
    
    let finalCondition = conditions.length > 0 ? and(...conditions) : undefined;

    if (search) {
        const searchCondition = or(
            ilike(leads.owner_name, `%${search}%`),
            ilike(leads.owner_contact, `%${search}%`),
            ilike(leads.full_name, `%${search}%`),
            ilike(leads.business_name, `%${search}%`)
        );
        finalCondition = finalCondition ? and(finalCondition, searchCondition) : searchCondition;
    }

    const data = await db.select()
        .from(leads)
        .where(finalCondition)
        .orderBy(desc(leads.created_at));

    return successResponse(data);
});
