import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { kycVerifications, kycDocuments, leads, couponCodes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { validateDocument, verifyBankAccount } from '@/lib/decentro';
import { isConsentVerified } from '@/lib/consent-status';

const VERIFICATION_LABELS: Record<string, string> = {
    aadhaar: 'Aadhaar Verification',
    pan: 'PAN Verification',
    bank: 'Bank Verification',
    address: 'Address Proof',
    rc: 'RC Verification',
    mobile: 'Mobile Number',
};

async function upsertVerification(leadId: string, type: string, values: Record<string, unknown>) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    const existing = await db.select({ id: kycVerifications.id })
        .from(kycVerifications)
        .where(and(eq(kycVerifications.lead_id, leadId), eq(kycVerifications.verification_type, type)))
        .limit(1);

    if (existing.length > 0) {
        await db.update(kycVerifications).set({ ...values, updated_at: now })
            .where(and(eq(kycVerifications.lead_id, leadId), eq(kycVerifications.verification_type, type)));
        return existing[0].id;
    } else {
        const id = `KYCVER-${dateStr}-${seq}`;
        await db.insert(kycVerifications).values({
            id,
            lead_id: leadId,
            verification_type: type,
            submitted_at: now,
            created_at: now,
            updated_at: now,
            ...values,
        });
        return id;
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
    try {
        const { leadId } = await params;
        const { couponCode, pan_number, account_number, ifsc, account_holder_name } = await req.json();
        const now = new Date();

        const lead = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
        if (!lead.length) {
            return NextResponse.json({ success: false, error: { message: 'Lead not found' } }, { status: 404 });
        }

        const leadRow = lead[0];
        const paymentMethod = (leadRow.payment_method || '').toLowerCase();
        const isFinance = ['finance', 'other_finance', 'dealer_finance'].includes(paymentMethod);

        if (isFinance) {
            const consentOk = isConsentVerified(leadRow.consent_status);
            if (!consentOk) {
                return NextResponse.json({
                    success: false,
                    error: { message: 'Consent must be verified before verification' },
                }, { status: 400 });
            }

            const docs = await db.select({
                doc_type: kycDocuments.doc_type,
                file_url: kycDocuments.file_url,
            })
                .from(kycDocuments)
                .where(eq(kycDocuments.lead_id, leadId));

            const uploadedDocTypes = new Set(
                docs
                    .filter((d) => !!d.file_url)
                    .map((d) => String(d.doc_type || '').toLowerCase())
            );

            const requiredDocTypes = [
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
            if (needsRc) requiredDocTypes.push('rc_copy');

            const missingDocTypes = requiredDocTypes.filter((docType) => !uploadedDocTypes.has(docType));
            if (missingDocTypes.length) {
                return NextResponse.json({
                    success: false,
                    error: {
                        message: 'Upload all required documents before verification',
                        missing_documents: missingDocTypes,
                    },
                }, { status: 400 });
            }
        }

        // Consume reserved coupon when verification starts
        if (isFinance) {
            const requestedCouponCode = couponCode ? String(couponCode).toUpperCase().trim() : null;

            const reservedCoupons = await db
                .select({ id: couponCodes.id, code: couponCodes.code })
                .from(couponCodes)
                .where(and(
                    eq(couponCodes.used_by_lead_id, leadId),
                    eq(couponCodes.status, 'reserved')
                ))
                .limit(1);

            if (!reservedCoupons.length) {
                return NextResponse.json({
                    success: false,
                    error: { message: 'A valid reserved coupon is required before verification' },
                }, { status: 400 });
            }

            const reservedCoupon = reservedCoupons[0];
            if (requestedCouponCode && reservedCoupon.code !== requestedCouponCode) {
                return NextResponse.json({
                    success: false,
                    error: { message: `Lead is reserved with ${reservedCoupon.code}, not ${requestedCouponCode}` },
                }, { status: 409 });
            }

            await db.update(couponCodes)
                .set({ status: 'used', updated_at: now })
                .where(eq(couponCodes.id, reservedCoupon.id));
        }

        const vehicleSlugs = ['2w', '3w', '4w', 'commercial'];
        const assetModel = (leadRow.asset_model || '').toLowerCase();
        const isVehicle = vehicleSlugs.some(s => assetModel.startsWith(s));

        // ── 1. PAN Verification (auto if pan_number provided) ──────────────
        if (pan_number) {
            try {
                const panRes = await validateDocument({
                    document_type: 'PAN',
                    id_number: pan_number.toUpperCase().trim(),
                });
                const panOk = (panRes.responseStatus || panRes.status || '').toUpperCase() === 'SUCCESS'
                    || panRes.message?.toLowerCase().includes('retrieved successfully');
                await upsertVerification(leadId, 'pan', {
                    status: panOk ? 'success' : 'failed',
                    api_provider: 'decentro',
                    api_request: { pan_number },
                    api_response: panRes,
                    failed_reason: panOk ? null : (panRes.message || 'PAN verification failed'),
                    completed_at: now,
                });
            } catch {
                await upsertVerification(leadId, 'pan', {
                    status: 'failed',
                    api_provider: 'decentro',
                    failed_reason: 'API call failed',
                });
            }
        } else {
            // Mark as initiating — dealer must verify manually
            await upsertVerification(leadId, 'pan', {
                status: 'initiating',
                api_provider: 'decentro',
            });
        }

        // ── 2. Bank Account Verification (auto if account details provided) ─
        if (account_number && ifsc) {
            try {
                const bankRes = await verifyBankAccount({
                    account_number,
                    ifsc: ifsc.toUpperCase().trim(),
                    name: account_holder_name,
                    perform_name_match: !!account_holder_name,
                });
                const bankOk = (bankRes.responseStatus || bankRes.status || '').toUpperCase() === 'SUCCESS'
                    || bankRes.message?.toLowerCase().includes('successfully');
                await upsertVerification(leadId, 'bank', {
                    status: bankOk ? 'success' : 'failed',
                    api_provider: 'decentro',
                    api_request: { account_number, ifsc },
                    api_response: bankRes,
                    failed_reason: bankOk ? null : (bankRes.message || 'Bank verification failed'),
                    completed_at: now,
                });
            } catch {
                await upsertVerification(leadId, 'bank', {
                    status: 'failed',
                    api_provider: 'decentro',
                    failed_reason: 'API call failed',
                });
            }
        } else {
            await upsertVerification(leadId, 'bank', {
                status: 'initiating',
                api_provider: 'decentro',
            });
        }

        // ── 3. Aadhaar — mark for OTP flow (dealer does this separately) ───
        await upsertVerification(leadId, 'aadhaar', {
            status: 'initiating',
            api_provider: 'decentro',
        });

        // ── 4. Other checks (address, mobile, rc) — mark initiating ────────
        const otherTypes = ['address', 'mobile', ...(isVehicle ? ['rc'] : [])];
        for (const type of otherTypes) {
            await upsertVerification(leadId, type, {
                status: 'initiating',
                api_provider: type === 'rc' ? 'surepass' : 'decentro',
            });
        }

        // Update lead KYC status
        await db.update(leads)
            .set({ kyc_status: 'in_progress', updated_at: now })
            .where(eq(leads.id, leadId));

        // Return current verification state
        const allVers = await db.select().from(kycVerifications).where(eq(kycVerifications.lead_id, leadId));
        const verifications = allVers.map(v => ({
            type: v.verification_type,
            label: VERIFICATION_LABELS[v.verification_type] || v.verification_type,
            status: v.status,
            last_update: v.updated_at?.toISOString() || null,
            failed_reason: v.failed_reason,
        }));

        return NextResponse.json({
            success: true,
            verificationsInitiated: allVers.length,
            estimatedTime: '1-3 minutes for pending checks',
            verifications,
        });
    } catch (error) {
        console.error('Submit verification error:', error);
        return NextResponse.json({ success: false, error: { message: 'Server error' } }, { status: 500 });
    }
}
