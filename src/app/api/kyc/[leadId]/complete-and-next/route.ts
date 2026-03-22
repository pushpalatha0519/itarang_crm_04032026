import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { leads, kycDocuments, kycVerifications, couponCodes } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { isConsentVerified } from '@/lib/consent-status';

export async function POST(req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
    try {
        const { leadId } = await params;
        const { paymentMethod } = await req.json();

        // Server-side validations
        const docs = await db.select().from(kycDocuments).where(eq(kycDocuments.lead_id, leadId));
        const verifications = await db.select().from(kycVerifications).where(eq(kycVerifications.lead_id, leadId));
        const lead = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

        if (!lead.length) {
            return NextResponse.json({ success: false, error: { message: 'Lead not found' } }, { status: 404 });
        }

        const leadRow = lead[0];
        const method = (paymentMethod || leadRow.payment_method || '').toLowerCase();
        const isCash = method === 'cash';
        const isFinance = !isCash;

        const uploadedDocTypes = new Set(
            docs
                .filter((d) => !!d.file_url)
                .map((d) => String(d.doc_type || '').toLowerCase())
        );

        const requiredDocTypes = isCash
            ? ['aadhaar_front', 'aadhaar_back', 'pan_card']
            : [
                'aadhaar_front',
                'aadhaar_back',
                'pan_card',
                'passport_photo',
                'address_proof',
                'bank_statement',
                'cheque_1',
                'cheque_2',
                'cheque_3',
                'cheque_4',
            ];

        const assetModel = (leadRow.asset_model || '').toLowerCase();
        const needsRc = ['2w', '3w', '4w'].some((prefix) => assetModel.startsWith(prefix));
        if (isFinance && needsRc) requiredDocTypes.push('rc_copy');

        const missingDocTypes = requiredDocTypes.filter((docType) => !uploadedDocTypes.has(docType));
        if (missingDocTypes.length) {
            return NextResponse.json({
                success: false,
                error: { message: 'Not all required documents uploaded' },
                missingItems: missingDocTypes,
            }, { status: 400 });
        }

        // Check consent
        const consentOk = isConsentVerified(leadRow.consent_status);
        if (!consentOk) {
            return NextResponse.json({
                success: false,
                error: { message: 'Customer consent must be verified before proceeding' },
            }, { status: 400 });
        }

        // For finance flow, coupon must be reserved for this lead
        if (isFinance) {
            const reservedCoupon = await db
                .select({ id: couponCodes.id, code: couponCodes.code })
                .from(couponCodes)
                .where(and(
                    eq(couponCodes.used_by_lead_id, leadId),
                    eq(couponCodes.status, 'reserved')
                ))
                .limit(1);

            if (!reservedCoupon.length) {
                return NextResponse.json({
                    success: false,
                    error: { message: 'A verification coupon must be validated before proceeding' },
                }, { status: 400 });
            }
        }

        // Calculate KYC score
        const totalRequired = requiredDocTypes.length;
        const docsUploaded = totalRequired - missingDocTypes.length;
        const verificationsPassed = verifications.filter(v => v.status === 'success').length;
        const totalVerifications = verifications.length || 1;

        const kycScore = Math.round(
            (docsUploaded / totalRequired) * 40 +
            (verificationsPassed / totalVerifications) * 40 +
            (consentOk ? 20 : 0)
        );

        const now = new Date();

        // Check if interim step is needed (additional docs or co-borrower required)
        const requiresInterim = !!leadRow.has_co_borrower;

        if (requiresInterim) {
            await db.update(leads)
                .set({
                    kyc_status: 'completed',
                    workflow_step: 2, // Stay at 2, interim is a sub-step
                    updated_at: now,
                })
                .where(eq(leads.id, leadId));

            return NextResponse.json({
                success: true,
                requiresInterim: true,
                nextStep: 'interim',
                kycScore,
            });
        }

        // Complete KYC and advance to step 3
        await db.update(leads)
            .set({
                kyc_status: 'completed',
                workflow_step: 3,
                updated_at: now,
            })
            .where(eq(leads.id, leadId));

        // TODO: Trigger notifications
        // - Email to dealer: 'KYC approved for {customer_name}'
        // - SMS to customer: 'Your KYC is verified. Next: Select product.'

        return NextResponse.json({
            success: true,
            requiresInterim: false,
            nextStep: 3,
            kycScore,
            message: 'KYC completed successfully',
        });
    } catch (error) {
        console.error('[KYC Complete] Error:', error);
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ success: false, error: { message } }, { status: 500 });
    }
}
