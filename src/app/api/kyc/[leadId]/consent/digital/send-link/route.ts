import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { consentRecords, leads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateConsentId, generateConsentToken, getConsentExpiry } from '@/lib/consent';

export async function POST(req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
    try {
        const { leadId } = await params;
        const { channel, customerPhone } = await req.json(); // channel: 'sms' | 'whatsapp'

        // 1. Validate Lead
        const lead = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
        if (!lead.length) {
            return NextResponse.json({ success: false, error: { message: 'Lead not found' } }, { status: 404 });
        }

        const phone = customerPhone || lead[0].phone || lead[0].owner_contact;
        if (!phone) {
            return NextResponse.json({ success: false, error: { message: 'Customer phone number is required' } }, { status: 400 });
        }

        // 2. Generate Link
        const token = generateConsentToken();
        const consentId = generateConsentId();
        const expiresAt = getConsentExpiry();
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://itarang.com';
        const linkUrl = `${appUrl}/consent/${consentId}?token=${token}`;

        // 3. Database Updates
        await db.transaction(async (tx) => {
            // Create Consent Record
            await tx.insert(consentRecords).values({
                id: consentId,
                lead_id: leadId,
                consent_for: 'primary',
                consent_type: 'digital',
                consent_status: 'link_sent',
                consent_token: token,
                consent_link_url: linkUrl,
                consent_link_sent_at: new Date(),
                // expires_at also needed in schema? Added it earlier but let's check
                created_at: new Date(),
                updated_at: new Date(),
            });

            // Update Lead
            await tx.update(leads)
                .set({
                    consent_status: 'link_sent',
                    consent_link_url: linkUrl,
                    consent_link_sent_at: new Date(),
                    consent_link_expires_at: expiresAt,
                    consent_delivery_channel: channel,
                    consent_attempt_count: (lead[0].consent_attempt_count || 0) + 1,
                    updated_at: new Date(),
                })
                .where(eq(leads.id, leadId));
        });

        // 4. Trigger Delivery (Mock for now)
        // TODO: In a real app, call Twilio/WhatsApp API here
        console.log(`[Consent] Sent ${channel} to ${phone}: ${linkUrl}`);

        return NextResponse.json({
            success: true,
            consentLinkId: consentId,
            linkUrl,
            expiresAt: expiresAt.toISOString(),
            deliveryStatus: 'sent',
        });

    } catch (error) {
        console.error('[Send Link] Error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ success: false, error: { message } }, { status: 500 });
    }
}
