'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import stringSimilarity from "string-similarity";
import {
    ChevronLeft, Loader2, Upload, CheckCircle2,
    AlertCircle, X, FileText,
    Send, Download, ArrowRight
} from 'lucide-react';

const CONSENT_FINAL_STATUSES = ['verified'] as const;
const CONSENT_MANUAL_READY_STATUSES = [
    'manual_pdf_generated',
    'manual_review_pending',
    'verified',
] as const;

const CONSENT_DIGITAL_LOCK_STATUSES = [
    'manual_pdf_generated',
    'manual_review_pending',
    'verified',
] as const;

const normalizeConsentStatus = (status?: string | null) => {
    const s = (status || '').toLowerCase();
    if (s === 'manual_pdf_generated' || s === 'consent_generated') return 'manual_pdf_generated';
    if (
        s === 'manual_review_pending' ||
        s === 'manual_uploaded' ||
        s === 'consent_uploaded' ||
        s === 'admin_review_pending'
    ) return 'manual_review_pending';
    if (s === 'verified' || s === 'manual_verified' || s === 'admin_verified') return 'verified';
    return 'awaiting_signature';
};

const isConsentFinal = (status: string) =>
    CONSENT_FINAL_STATUSES.includes(status as (typeof CONSENT_FINAL_STATUSES)[number]);

const isManualUploadEnabled = (status: string) =>
    CONSENT_MANUAL_READY_STATUSES.includes(status as (typeof CONSENT_MANUAL_READY_STATUSES)[number]);

const isDigitalSendLocked = (status: string) =>
    CONSENT_DIGITAL_LOCK_STATUSES.includes(status as (typeof CONSENT_DIGITAL_LOCK_STATUSES)[number]);

// ── Constants ────────────────────────────────────────────────────────────────

const FINANCE_DOCUMENTS = [
    { key: 'aadhaar_front', label: 'Aadhaar Front', required: true },
    { key: 'aadhaar_back', label: 'Aadhaar Back', required: true },
    { key: 'pan_card', label: 'PAN Card', required: true },
    { key: 'passport_photo', label: 'Passport Size Photo', required: true },
    { key: 'address_proof', label: 'Address Proof', required: true },
    { key: 'rc_copy', label: 'RC Copy', required: false, conditional: true },
    { key: 'bank_statement', label: 'Bank Statement', required: true },
    { key: 'cheque_1', label: 'Undated Cheque 1', required: true },
    { key: 'cheque_2', label: 'Undated Cheque 2', required: true },
    { key: 'cheque_3', label: 'Undated Cheque 3', required: true },
    { key: 'cheque_4', label: 'Undated Cheque 4', required: true },
];

const UPFRONT_DOCUMENTS = [
    { key: 'aadhaar_front', label: 'Aadhaar Front', required: true },
    { key: 'aadhaar_back', label: 'Aadhaar Back', required: true },
    { key: 'pan_card', label: 'PAN Card', required: true },
];

type VerificationStatus = 'pending' | 'initiating' | 'awaiting_action' | 'in_progress' | 'success' | 'failed';
type PaymentStatus = 'UNPAID' | 'QR_GENERATED' | 'PAYMENT_PENDING_CONFIRMATION' | 'PAID' | 'FAILED' | 'EXPIRED';

interface OcrComparisonField {
    field: string;
    label: string;
    ocrValue: string | null;
    leadValue: string | null;
    match: boolean;
    similarity?: number;
}

interface DocUpload {
    key: string;
    file_url: string | null;
    verification_status: VerificationStatus;
    failed_reason?: string;
    ocr_data?: Record<string, any> | null;
    ocr_comparison?: OcrComparisonField[] | null;
    ocr_failed?: boolean;
    enable_manual_entry?: boolean;
}

interface VerificationRow {
    type: string;
    label: string;
    status: VerificationStatus;
    last_update: string | null;
    failed_reason: string | null;
}

interface PaymentData {
    payment_id: string;
    qr_id: string;
    qr_image_url: string;
    qr_short_url: string;
    qr_status: string;
    expires_at: string;
    base_amount: number;
    discount_amount: number;
    final_amount: number;
    coupon_code: string | null;
    facilitation_fee_status: PaymentStatus;
    razorpay_payment_id?: string;
}


// ── Main Page ────────────────────────────────────────────────────────────────

export default function KYCPage() {
    const router = useRouter();
    const params = useParams();
    const leadId = params.id as string;

    // Core
    const [loading, setLoading] = useState(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [lead, setLead] = useState<any>(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    // Payment method (determined from lead)
    const [paymentMethod, setPaymentMethod] = useState<string>('finance');

    const [consentStatus, setConsentStatus] = useState<string>('awaiting_signature');
    const [verificationSubmitted, setVerificationSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // ── Decentro Inline Verification ──
    const [panNumber, setPanNumber] = useState('');
    const [panVerifying, setPanVerifying] = useState(false);
    const [panResult, setPanResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);
    const [aadhaarNumber, setAadhaarNumber] = useState('');
    const [aadhaarTxnId, setAadhaarTxnId] = useState('');
    const [aadhaarOtp, setAadhaarOtp] = useState('');
    const [aadhaarStep, setAadhaarStep] = useState<'input' | 'otp'>('input');
    const [aadhaarVerifying, setAadhaarVerifying] = useState(false);
    const [aadhaarResult, setAadhaarResult] = useState<{ success: boolean; message: string } | null>(null);
    const [bankAccountNo, setBankAccountNo] = useState('');
    const [bankIfsc, setBankIfsc] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankVerifying, setBankVerifying] = useState(false);
    const [bankResult, setBankResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);
    const [faceMatching, setFaceMatching] = useState(false);
    const [faceResult, setFaceResult] = useState<{ success: boolean; message: string; match_score?: number; is_match?: boolean } | null>(null);

    // ── Digital Consent State ──
    const [sendingConsent, setSendingConsent] = useState(false);
    const [showConsentConfirm, setShowConsentConfirm] = useState<{ show: boolean; channel: 'sms' | 'whatsapp' }>({ show: false, channel: 'sms' });
    const [confirmPhone, setConfirmPhone] = useState('');
    const [consentSentToast, setConsentSentToast] = useState<{ show: boolean; message: string } | null>(null);

    // ── Draft & Save ──

    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    const [savingManual, setSavingManual] = useState(false);

    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('UNPAID');
    const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
    const [reservedCouponCode, setReservedCouponCode] = useState<string | null>(null);
    const [couponCode, setCouponCode] = useState('');
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponResult, setCouponResult] = useState<any>(null);
    const [generatingQr, setGeneratingQr] = useState(false);
    const [regeneratingQr, setRegeneratingQr] = useState(false);

    const [uploadedDocs, setUploadedDocs] = useState<Record<string, DocUpload>>({});
    const [verifications, setVerifications] = useState<VerificationRow[]>([]);
    const [ocrComparisons, setOcrComparisons] = useState<Record<string, OcrComparisonField[]>>({});

    const [manualEntryDoc, setManualEntryDoc] = useState<string | null>(null);
    const [manualFields, setManualFields] = useState<Record<string, string>>({
        name: '',
        father_name: '',
        dob: '',
        address: '',
        pan_number: '',
        aadhaar_number: '',
    });
    const [showBankManual, setShowBankManual] = useState(false);
    const [bankManualFields, setBankManualFields] = useState<Record<string, string>>({
        account_holder_name: '',
        account_number: '',
        confirm_account_number: '',
        ifsc: '',
        bank_name: '',
    });
    const [bankManualErrors, setBankManualErrors] = useState<Record<string, string>>({});

    const isFinance = (paymentMethod || '').toLowerCase() !== 'cash';

    // ── Load Data ────────────────────────────────────────────────────────────

    useEffect(() => {
        const loadData = async () => {
            try {
                const res = await fetch(`/api/kyc/${leadId}/access-check`);
                const data = await res.json();
                if (!data.success || !data.allowed) {
                    setAccessDenied(true);
                    router.replace('/leads/new');
                    return;
                }

                setLead(data.lead);
                if (data.lead.payment_method) setPaymentMethod(data.lead.payment_method);
                setConsentStatus(normalizeConsentStatus(data.lead.consent_status));


                if (data.lead.owner_contact) setConfirmPhone(data.lead.owner_contact);

                // Load docs, verifications, and payment status in parallel
                const [docsRes, verRes, payRes] = await Promise.all([
                    fetch(`/api/kyc/${leadId}/documents`),
                    fetch(`/api/kyc/${leadId}/verifications`),
                    fetch(`/api/kyc/${leadId}/payment-status`),
                ]);

                const [docsData, verData, payData] = await Promise.all([
                    docsRes.json(), verRes.json(), payRes.json(),
                ]);

                if (docsData.success) {
                    const docMap: Record<string, DocUpload> = {};
                    docsData.data.forEach((d: any) => {
                        docMap[d.doc_type] = {
                            key: d.doc_type,
                            file_url: d.file_url,
                            verification_status: d.verification_status,
                            failed_reason: d.failed_reason,
                        };
                    });
                    setUploadedDocs(docMap);
                }

                if (verData.success) setVerifications(verData.data);

                if (payData.success && payData.data) {
                    setPaymentStatus(payData.status || 'UNPAID');
                    setPaymentData({
                        payment_id: payData.data.id,
                        qr_id: payData.data.razorpay_qr_id || '',
                        qr_image_url: payData.data.razorpay_qr_image_url || '',
                        qr_short_url: payData.data.razorpay_qr_short_url || '',
                        qr_status: payData.data.razorpay_qr_status || '',
                        expires_at: payData.data.razorpay_qr_expires_at || '',
                        base_amount: Number(payData.data.facilitation_fee_base_amount) || 1500,
                        discount_amount: Number(payData.data.coupon_discount_amount) || 0,
                        final_amount: Number(payData.data.facilitation_fee_final_amount) || 1500,
                        coupon_code: payData.data.coupon_code,
                        facilitation_fee_status: payData.status,
                        razorpay_payment_id: payData.data.razorpay_payment_id,
                    });
                    setReservedCouponCode(payData.reservedCoupon?.code || null);
                } else if (payData.success) {
                    setReservedCouponCode(payData.reservedCoupon?.code || null);
                }

            } catch { setApiError('Failed to load KYC data'); }
            finally { setLoading(false); }
        };
        loadData();
    }, [leadId, router]);

    // ── Helpers ──────────────────────────────────────────────────────────────

    const getRequiredDocs = () => {
        if (!isFinance) return UPFRONT_DOCUMENTS;
        const docs = [...FINANCE_DOCUMENTS];
        const isVehicle = lead && ['2W', '3W', '4W'].includes(lead.asset_model);
        return docs.map(d => d.key === 'rc_copy' ? { ...d, required: isVehicle } : d);
    };

    const getDocStats = () => {
        const required = getRequiredDocs().filter(d => d.required);
        const uploaded = required.filter(d => uploadedDocs[d.key]?.file_url);
        const pending = required.filter(d => !uploadedDocs[d.key]?.file_url);
        return { total: required.length, uploaded: uploaded.length, pending };
    };
    const docStats = getDocStats();
    const hasAllRequiredDocs = docStats.uploaded >= docStats.total;
    const hasReservedCouponClient = !isFinance
        || !!reservedCouponCode
        || couponResult?.status === 'reserved'
        || (!!couponResult?.valid && !!couponResult?.coupon_code)
        || !!paymentData?.coupon_code;
    const canSaveAndNext = isConsentFinal(consentStatus) && hasAllRequiredDocs && hasReservedCouponClient;
    const getSaveAndNextBlockingReason = () => {
        if (!isConsentFinal(consentStatus)) return 'Awaiting consent verification';
        if (!hasAllRequiredDocs) return `Upload all required documents (${docStats.uploaded}/${docStats.total})`;
        if (!hasReservedCouponClient) return 'Validate verification coupon';
        return '';
    };

    const feePaid = paymentStatus === 'PAID';
    const documentsGated = isFinance && !feePaid;

    // ── Payment Handlers ─────────────────────────────────────────────────────

    const handleValidateCoupon = async () => {
        if (!couponCode.trim()) return;
        setCouponLoading(true);
        setCouponResult(null);
        try {
            const res = await fetch(`/api/kyc/${leadId}/validate-coupon`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ couponCode: couponCode.trim() }),
            });
            const data = await res.json();
            setCouponResult(data);
            if (data?.valid && data?.coupon_code) {
                setReservedCouponCode(data.coupon_code);
            }
        } catch {
            setCouponResult({ valid: false, message: 'Network error' });
        } finally {
            setCouponLoading(false);
        }
    };

    const handleGenerateQr = async () => {
        setGeneratingQr(true);
        setApiError(null);
        try {
            const res = await fetch(`/api/kyc/${leadId}/create-payment-qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    coupon_code: couponResult?.valid ? couponResult.coupon_code : null,
                    coupon_id: couponResult?.valid ? couponResult.coupon_id : null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setPaymentData(data.data);
                setPaymentStatus('QR_GENERATED');
            } else {
                setApiError(data.error?.message || 'Failed to generate QR');
            }
        } catch {
            setApiError('Failed to generate payment QR');
        } finally {
            setGeneratingQr(false);
        }
    };

    const handleRegenerateQr = async () => {
        setRegeneratingQr(true);
        try {
            const res = await fetch(`/api/kyc/${leadId}/regenerate-payment-qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (data.success) {
                setPaymentData(prev => prev ? { ...prev, ...data.data, facilitation_fee_status: 'QR_GENERATED' } : data.data);
                setPaymentStatus('QR_GENERATED');
            } else {
                setApiError(data.error?.message || 'Failed to regenerate QR');
            }
        } catch {
            setApiError('Failed to regenerate QR');
        } finally {
            setRegeneratingQr(false);
        }
    };

    // ── Document Upload ──────────────────────────────────────────────────────

    const handleDocUpload = async (docType: string, file: File) => {
        if (file.size > 5 * 1024 * 1024) { setApiError('File size must be less than 5MB'); return; }
        const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) { setApiError('Only PNG, JPEG, and PDF files are allowed'); return; }

        // Set uploading state
        setUploadedDocs(prev => ({ ...prev, [docType]: { key: docType, file_url: null, verification_status: 'initiating' } }));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('docType', docType);

        try {
            const res = await fetch(`/api/kyc/${leadId}/upload-document`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                const docUpload: DocUpload = {
                    key: docType,
                    file_url: data.file_url,
                    verification_status: data.ocr_failed ? 'failed' : (data.ocr_data ? 'in_progress' : 'pending'),
                    failed_reason: data.ocr_error || data.warning || undefined,
                    ocr_data: data.ocr_data || null,
                    ocr_comparison: data.ocr_comparison || null,
                    ocr_failed: data.ocr_failed || false,
                    enable_manual_entry: data.enable_manual_entry || false,
                };
                setUploadedDocs(prev => ({ ...prev, [docType]: docUpload }));

                if (data.ocr_comparison?.length > 0) {
                    setOcrComparisons(prev => ({ ...prev, [docType]: data.ocr_comparison }));
                }
                if (data.warning) setApiError(data.warning);
                if (data.ocr_failed || data.enable_manual_entry) setManualEntryDoc(docType);

                // Auto face match
                setUploadedDocs(prev => {
                    const updated = { ...prev, [docType]: docUpload };

                    if (docType === 'passport_photo' || docType === 'aadhaar_front') {
                        const otherDoc = docType === 'passport_photo' ? 'aadhaar_front' : 'passport_photo';
                        const otherUpload = updated[otherDoc];

                        if (otherUpload?.file_url) {
                            triggerAutoFaceMatch(
                                docType === 'passport_photo'
                                    ? data.file_url
                                    : otherUpload.file_url,
                                docType === 'aadhaar_front'
                                    ? data.file_url
                                    : otherUpload.file_url
                            );
                        }
                    }

                    return updated;
                });

                // Auto address match
                if (docType === 'aadhaar_back' && data.ocr_data?.address) {
                    triggerAutoAddressMatch(data.ocr_data.address);
                }
            } else {
                setUploadedDocs(prev => ({ ...prev, [docType]: { key: docType, file_url: null, verification_status: 'failed', failed_reason: data.error?.message } }));
                setApiError(data.error?.message || 'Upload failed');
            }
        } catch {
            setUploadedDocs(prev => ({ ...prev, [docType]: { key: docType, file_url: null, verification_status: 'failed', failed_reason: 'Upload failed' } }));
            setApiError('Upload failed. Please try again.');
        }
    };

    const triggerAutoFaceMatch = async (passportUrl: string, aadhaarUrl: string) => {
        try {
            const [img1Res, img2Res] = await Promise.all([fetch(passportUrl), fetch(aadhaarUrl)]);
            const [img1Blob, img2Blob] = await Promise.all([img1Res.blob(), img2Res.blob()]);
            const form = new FormData();
            form.append('image1', new File([img1Blob], 'passport.jpg', { type: 'image/jpeg' }));
            form.append('image2', new File([img2Blob], 'aadhaar.jpg', { type: 'image/jpeg' }));
            setFaceMatching(true);
            const res = await fetch(`/api/kyc/${leadId}/decentro/face-match`, { method: 'POST', body: form });
            const data = await res.json();
            setFaceResult({ success: data.success, message: data.message, match_score: data.match_score, is_match: data.is_match });
        } catch { /* silent */ }
        finally { setFaceMatching(false); }
    };

    const triggerAutoAddressMatch = (aadhaarAddress: string) => {
        if (!lead?.current_address) return;
        const a = aadhaarAddress.trim().toLowerCase().replace(/\s+/g, ' ');
        const b = (lead.current_address || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const similarity = Math.round(stringSimilarity.compareTwoStrings(a, b) * 100);
        if (similarity < 70) {
            setOcrComparisons(prev => ({
                ...prev,
                'address_match': [{
                    field: 'address', label: 'Address (Aadhaar vs Lead)',
                    ocrValue: aadhaarAddress, leadValue: lead.current_address,
                    match: false, similarity,
                }],
            }));
        }
    };

    // ── Manual Entry ─────────────────────────────────────────────────────────

    const handleSaveManualEntry = async () => {
        if (!manualEntryDoc) return;
        setSavingManual(true);
        try {
            const res = await fetch(`/api/kyc/${leadId}/save-draft`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    step: 2,
                    data: { manualOcrData: { [manualEntryDoc]: manualFields }, paymentMethod, documents: uploadedDocs, consentStatus },
                }),
            });
            if (res.ok) {
                setUploadedDocs(prev => ({
                    ...prev,
                    [manualEntryDoc!]: { ...prev[manualEntryDoc!], verification_status: 'in_progress', ocr_failed: false, enable_manual_entry: false, ocr_data: manualFields },
                }));
                setManualEntryDoc(null);
                setManualFields({ name: '', father_name: '', dob: '', address: '', pan_number: '', aadhaar_number: '' });
            }
        } catch { setApiError('Failed to save manual entry'); }
        finally { setSavingManual(false); }
    };

    // ── Bank Manual Entry ──────────────────────────────────────────────────────

    const validateBankFields = () => {
        const errs: Record<string, string> = {};
        if (!bankManualFields.account_holder_name.trim()) errs.account_holder_name = 'Required';
        if (!bankManualFields.account_number.trim()) errs.account_number = 'Required';
        else if (bankManualFields.account_number.length < 9 || bankManualFields.account_number.length > 18) errs.account_number = '9-18 digits required';
        if (bankManualFields.account_number !== bankManualFields.confirm_account_number) errs.confirm_account_number = 'Account numbers do not match';
        if (!bankManualFields.ifsc.trim()) errs.ifsc = 'Required';
        else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankManualFields.ifsc)) errs.ifsc = 'Invalid IFSC format (e.g. SBIN0001234)';
        if (!bankManualFields.bank_name.trim()) errs.bank_name = 'Required';
        setBankManualErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSaveBankManual = async () => {
        if (!validateBankFields()) return;
        setSavingManual(true);
        try {
            const res = await fetch(`/api/kyc/${leadId}/save-draft`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    step: 2,
                    data: { bankManualData: bankManualFields, paymentMethod, documents: uploadedDocs, consentStatus },
                }),
            });
            if (res.ok) {
                setShowBankManual(false);
                setApiError(null);
            }
        } catch { setApiError('Failed to save bank details'); }
        finally { setSavingManual(false); }
    };

    // ── Comparison Table Helpers ───────────────────────────────────────────────

    const maskValue = (val: string | null | undefined, type: 'aadhaar' | 'pan' | 'account') => {
        if (!val) return null;
        if (type === 'aadhaar' && val.length >= 8) return 'XXXX XXXX ' + val.slice(-4);
        if (type === 'pan' && val.length >= 6) return val.slice(0, 2) + 'XXXX' + val.slice(-2);
        if (type === 'account' && val.length >= 4) return 'XXXXX' + val.slice(-4);
        return val;
    };
    const getKycProgress = () => {
        let total = 6;
        let completed = 0;

        if (paymentMethod) completed++;
        if (uploadedDocs?.aadhaar_front?.file_url) completed++;
        if (uploadedDocs?.aadhaar_back?.file_url) completed++;
        if (uploadedDocs?.passport_photo?.file_url) completed++;
        if (faceResult?.is_match) completed++;
        if (consentStatus === "submitted") completed++;

        return {
            total,
            completed,
            percent: Math.round((completed / total) * 100)
        };
    };

    const buildComparisonRows = () => {
        const rows: Array<{
            field: string; label: string;
            step1Value: string | null; ocrValue: string | null; manualValue: string | null;
            finalValue: string | null; matchStatus: 'match' | 'mismatch' | 'pending';
            source: string; remarks: string;
        }> = [];

        const allOcr: Record<string, any> = {};
        Object.values(uploadedDocs).forEach(doc => {
            if (doc.ocr_data) Object.assign(allOcr, doc.ocr_data);
        });

        const allManual: Record<string, string> = { ...manualFields };
        if (bankManualFields.account_holder_name) Object.assign(allManual, bankManualFields);

        const addRow = (field: string, label: string, step1Key: string | null, ocrKey: string | null, manualKey: string | null, mask?: 'aadhaar' | 'pan' | 'account') => {
            const s1 = step1Key && lead ? (lead[step1Key] || null) : null;
            const ocr = ocrKey ? (allOcr[ocrKey] || null) : null;
            const manual = manualKey ? (allManual[manualKey] || null) : null;
            const verified = ocr || manual;
            const finalVal = verified || s1;
            const displayS1 = mask ? maskValue(s1, mask) : s1;
            const displayOcr = mask ? maskValue(ocr, mask) : ocr;
            const displayManual = mask ? maskValue(manual, mask) : manual;
            const displayFinal = mask ? maskValue(finalVal, mask) : finalVal;

            let matchStatus: 'match' | 'mismatch' | 'pending' = 'pending';
            if (s1 && ocr) {
                matchStatus = s1.trim().toLowerCase() === ocr.trim().toLowerCase() ? 'match' : 'mismatch';
            } else if (s1 && manual) {
                matchStatus = s1.trim().toLowerCase() === manual.trim().toLowerCase() ? 'match' : 'mismatch';
            }

            let source = 'None';
            if (ocr) source = 'OCR/API';
            else if (manual) source = 'Manual';
            else if (s1) source = 'Step 1';

            rows.push({ field, label, step1Value: displayS1, ocrValue: displayOcr, manualValue: displayManual, finalValue: displayFinal, matchStatus, source, remarks: matchStatus === 'mismatch' ? 'Needs review' : '' });
        };

        addRow('full_name', 'Full Name', 'full_name', 'full_name', 'name');
        addRow('father_name', 'Father/Husband Name', 'father_or_husband_name', 'father_or_husband_name', 'father_name');
        addRow('dob', 'Date of Birth', 'dob', 'date_of_birth', 'dob');
        addRow('phone', 'Phone Number', 'phone', 'phone_number', null);
        addRow('address', 'Address', 'current_address', 'address', 'address');
        addRow('aadhaar_number', 'Aadhaar Number', null, 'aadhaar_number', 'aadhaar_number', 'aadhaar');
        addRow('pan_number', 'PAN Number', null, 'pan_number', 'pan_number', 'pan');
        addRow('bank_holder', 'Bank Account Holder', null, null, 'account_holder_name');
        addRow('account_number', 'Account Number', null, null, 'account_number', 'account');
        addRow('ifsc', 'IFSC', null, null, 'ifsc');

        return rows;
    };

    const getComparisonSummary = (rows: ReturnType<typeof buildComparisonRows>) => {
        const matched = rows.filter(r => r.matchStatus === 'match').length;
        const mismatched = rows.filter(r => r.matchStatus === 'mismatch').length;
        const pending = rows.filter(r => r.matchStatus === 'pending').length;
        return { matched, mismatched, pending };
    };

    // ── Consent ──────────────────────────────────────────────────────────────

    const handleSendConsent = async (channel: 'sms' | 'whatsapp') => {
        setSendingConsent(true);
        setApiError(null);
        try {
            const res = await fetch(`/api/kyc/${leadId}/consent/digital/send-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel, customerPhone: confirmPhone }),
            });
            const data = await res.json();

            if (data.success) {
                setConsentStatus('awaiting_signature');
                setConsentSentToast({
                    show: true,
                    message: `Consent link sent via ${channel.toUpperCase()}`,
                });
                setTimeout(() => setConsentSentToast(null), 4000);
                setShowConsentConfirm({ show: false, channel: 'sms' });
            } else {
                setApiError(data.error?.message || 'Failed to send consent');
            }
        } catch { setApiError('Failed to send consent'); }
        finally { setSendingConsent(false); }
    };

    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [uploadingPdf, setUploadingPdf] = useState(false);

    const handleUploadSignedConsent = async (file: File) => {
        if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) {
            setApiError('Only PDF files under 10MB are allowed'); return;
        }
        setUploadingPdf(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploadedBy', 'system'); // In a real app, retrieve user ID from auth context
        try {
            const res = await fetch(`/api/kyc/${leadId}/consent/manual/upload`, { method: 'POST', body: formData });
            const raw = await res.text();
            let data: any = {};
            try {
                data = raw ? JSON.parse(raw) : {};
            } catch {
                data = { message: raw?.slice(0, 200) || null };
            }
            if (res.ok && data.success) {
                setConsentStatus('manual_review_pending');
            } else {
                setApiError(
                    data?.error?.message ||
                    data?.message ||
                    `Upload failed (HTTP ${res.status})`
                );
            }
        } catch (error) {
            setApiError(error instanceof Error ? error.message : 'Upload failed');
        }
        finally { setUploadingPdf(false); }
    };
    const handleGenerateConsentPDF = async () => {
        setGeneratingPdf(true);
        setApiError(null);

        try {
            const res = await fetch(`/api/kyc/${leadId}/consent/manual/generate-pdf`, { method: 'POST' });
            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                setApiError(errData?.error?.message || 'Failed to generate PDF');
                return;
            }

            const pdfBlob = await res.blob();
            const objectUrl = URL.createObjectURL(pdfBlob);

            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = `DPDPA_consent_form_for_data_processing_${leadId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);

            setConsentStatus('manual_pdf_generated');
            setConsentSentToast({
                show: true,
                message: 'Consent PDF downloaded. Please print, sign, and upload scanned copy.',
            });
            setTimeout(() => setConsentSentToast(null), 5000);
        } catch (error) {
            setApiError('Failed to generate consent PDF');
            console.error('Consent PDF error:', error);
        } finally {
            setGeneratingPdf(false);
            setShowConsentConfirm({ show: false, channel: 'sms' });
        }
    };


    // ── Decentro Verification Handlers ───────────────────────────────────────

    const handlePanVerify = async () => {
        if (!panNumber.trim()) return;
        setPanVerifying(true); setPanResult(null);
        try {
            const res = await fetch(`/api/kyc/${leadId}/decentro/pan`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pan_number: panNumber.trim() }),
            });
            const data = await res.json();
            setPanResult({ success: data.success, message: data.message, data: data.data });
            const verRes = await fetch(`/api/kyc/${leadId}/verifications`);
            const verData = await verRes.json();
            if (verData.success) setVerifications(verData.data);
        } catch { setPanResult({ success: false, message: 'Request failed' }); }
        finally { setPanVerifying(false); }
    };

    const handleAadhaarSendOtp = async () => {
        if (!aadhaarNumber.trim()) return;
        setAadhaarVerifying(true); setAadhaarResult(null);
        try {
            const res = await fetch(`/api/kyc/${leadId}/decentro/aadhaar-otp`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aadhaar_number: aadhaarNumber.trim() }),
            });
            const data = await res.json();
            if (data.success && data.decentroTxnId) {
                setAadhaarTxnId(data.decentroTxnId); setAadhaarStep('otp');
                setAadhaarResult({ success: true, message: 'OTP sent to Aadhaar-linked mobile' });
            } else { setAadhaarResult({ success: false, message: data.message || 'Failed to send OTP' }); }
        } catch { setAadhaarResult({ success: false, message: 'Request failed' }); }
        finally { setAadhaarVerifying(false); }
    };

    const handleAadhaarVerifyOtp = async () => {
        if (!aadhaarOtp.trim() || !aadhaarTxnId) return;
        setAadhaarVerifying(true);
        try {
            const res = await fetch(`/api/kyc/${leadId}/decentro/aadhaar-verify`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decentro_txn_id: aadhaarTxnId, otp: aadhaarOtp.trim() }),
            });
            const data = await res.json();
            setAadhaarResult({ success: data.success, message: data.message });
            if (data.success) {
                setAadhaarStep('input');
                const verRes = await fetch(`/api/kyc/${leadId}/verifications`);
                const verData = await verRes.json();
                if (verData.success) setVerifications(verData.data);
            }
        } catch { setAadhaarResult({ success: false, message: 'Request failed' }); }
        finally { setAadhaarVerifying(false); }
    };

    const handleBankVerify = async () => {
        if (!bankAccountNo.trim() || !bankIfsc.trim()) return;
        setBankVerifying(true); setBankResult(null);
        try {
            const res = await fetch(`/api/kyc/${leadId}/decentro/bank`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account_number: bankAccountNo.trim(), ifsc: bankIfsc.trim(), name: bankName.trim() || undefined, perform_name_match: !!bankName.trim() }),
            });
            const data = await res.json();
            setBankResult({ success: data.success, message: data.message, data: data.data });
            const verRes = await fetch(`/api/kyc/${leadId}/verifications`);
            const verData = await verRes.json();
            if (verData.success) setVerifications(verData.data);
        } catch { setBankResult({ success: false, message: 'Request failed' }); }
        finally { setBankVerifying(false); }

    };

    // ── Submit & Save ────────────────────────────────────────────────────────

    const handleSaveDraft = async (auto = false) => {
        setSaving(true);
        try {
            await fetch(`/api/kyc/${leadId}/save-draft`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ step: 2, data: { paymentMethod, consentStatus } }),
            });
            setLastSaved(auto ? `Auto-saved at ${new Date().toLocaleTimeString()}` : `Saved at ${new Date().toLocaleTimeString()}`);
        } catch { /* silent */ }
        finally { setSaving(false); }
    };

    const handleSaveAndNext = async () => {
        if (!isConsentFinal(consentStatus)) {
            setApiError('Customer consent must be admin verified before proceeding'); return;
        }
        if (!hasAllRequiredDocs) {
            setApiError(`Please upload all required documents (${docStats.uploaded}/${docStats.total}) before proceeding`);
            return;
        }
        if (!hasReservedCouponClient) {
            setApiError('Please validate a verification coupon before proceeding');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/kyc/${leadId}/complete-and-next`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentMethod }),
            });
            const data = await res.json();
            if (data.success) {
                if (data.requiresInterim) router.push(`/leads/${leadId}/kyc/interim`);
                else router.push(`/leads/${leadId}`);
            } else { setApiError(data.error?.message || 'Failed to proceed'); }
        } catch { setApiError('Connection failed'); }
        finally { setSaving(false); }
    };

    // ── Render ───────────────────────────────────────────────────────────────

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]"><Loader2 className="w-10 h-10 animate-spin text-[#1D4ED8]" /></div>;
    if (accessDenied) return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]">
            <div className="text-center">
                <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-gray-500 mb-6">KYC is only available for Hot leads.</p>
                <button onClick={() => router.push('/leads')} className="px-6 py-3 bg-[#0047AB] text-white rounded-xl font-bold">Back to Leads</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F8F9FB]">
            <div className="max-w-[1200px] mx-auto px-6 py-8 pb-40">
                {/* HEADER */}
                <header className="mb-8 flex justify-between items-start">
                    <div className="flex gap-4">
                        <button onClick={() => router.back()} className="mt-1 p-2 hover:bg-white transition-colors rounded-lg">
                            <ChevronLeft className="w-6 h-6 text-gray-900" />
                        </button>
                        <div>
                            <h1 className="text-[28px] font-black text-gray-900 leading-tight tracking-tight">Customer KYC</h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Lead: <span className="font-medium">{lead?.reference_id || leadId}</span>
                                {lead?.full_name && <span> &mdash; {lead.full_name}</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-right mb-1.5">Workflow Progress</p>
                            <div className="flex items-center gap-6">
                                <span className="text-xs font-bold text-[#1D4ED8] whitespace-nowrap">Step 2 of 5</span>
                                <div className="flex gap-2.5">
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <div key={s} className={`h-[6px] w-[50px] rounded-full transition-all duration-300 ${s <= 2 ? 'bg-[#0047AB]' : 'bg-gray-200'}`} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Step 2 Sub-Progress */}
                <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
                    {[
                        { label: 'Consent', done: isConsentFinal(consentStatus), active: !isConsentFinal(consentStatus) },
                        { label: 'Review', done: false, active: false },
                    ].map((s, i) => (
                        <div key={s.label} className="flex items-center gap-2">
                            {i > 0 && <div className={`w-8 h-[2px] ${s.done || s.active ? 'bg-[#0047AB]' : 'bg-gray-200'}`} />}
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${s.done ? 'bg-green-50 text-green-700 border border-green-200'
                                : s.active ? 'bg-blue-50 text-[#0047AB] border border-blue-200'
                                    : 'bg-gray-50 text-gray-400 border border-gray-100'
                                }`}>
                                {s.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.active ? <div className="w-2 h-2 bg-[#0047AB] rounded-full animate-pulse" /> : <div className="w-2 h-2 bg-gray-300 rounded-full" />}
                                {s.label}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Error Banner */}
                {apiError && (
                    <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3 text-red-700 font-medium text-sm">
                            <AlertCircle className="w-5 h-5" />
                            {apiError}
                        </div>
                        <button onClick={() => setApiError(null)} className="p-1 hover:bg-white rounded-md"><X className="w-5 h-5" /></button>
                    </div>
                )}

                <main className="grid grid-cols-1 gap-6">

                    {/* ═══════════════════════════════════════════════════════════
                        SECTION 6: CUSTOMER CONSENT
                       ═══════════════════════════════════════════════════════════ */}
                    <SectionCard title="Customer Consent" icon={<FileText className="w-5 h-5 text-[#0047AB]" />}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-900">Digital Consent</h4>
                                <button
                                    onClick={() => setShowConsentConfirm({ show: true, channel: 'sms' })}
                                    disabled={isDigitalSendLocked(consentStatus) || sendingConsent}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0047AB] text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#003580] transition-all"
                                >
                                    {sendingConsent && showConsentConfirm.channel === 'sms' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Send SMS Consent
                                </button>

                                <button
                                    onClick={() => setShowConsentConfirm({ show: true, channel: 'whatsapp' })}
                                    disabled={isDigitalSendLocked(consentStatus) || sendingConsent}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-green-700 transition-all"
                                >
                                    {sendingConsent && showConsentConfirm.channel === 'whatsapp' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Send WhatsApp Consent
                                </button>
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-900">Manual Consent</h4>
                                <button onClick={handleGenerateConsentPDF} disabled={generatingPdf}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold hover:border-[#0047AB] disabled:opacity-50 transition-all">
                                    {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    Generate Consent PDF
                                </button>
                                <label className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-bold transition-all ${isManualUploadEnabled(consentStatus) ? 'cursor-pointer hover:border-[#0047AB]' : 'opacity-40 cursor-not-allowed'}`}>
                                    {uploadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    Upload Signed PDF
                                    <input type="file" className="hidden" accept="application/pdf" disabled={!isManualUploadEnabled(consentStatus) || uploadingPdf} onChange={e => { if (e.target.files?.[0]) handleUploadSignedConsent(e.target.files[0]) }} />
                                </label>
                                {isManualUploadEnabled(consentStatus) && (
                                    <p className="text-[10px] text-green-600 font-medium">PDF generated. Please print, sign, and upload here.</p>
                                )}
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-900">Status</h4>
                                <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                                    {[
                                        'awaiting_signature',
                                        'manual_pdf_generated',
                                        'manual_review_pending',
                                        'verified',
                                    ].map(s => (
                                        <div key={s} className="flex items-center gap-2">
                                            {consentStatus === s || (isConsentFinal(consentStatus) && ['awaiting_signature', 'manual_pdf_generated', 'manual_review_pending'].includes(s))
                                                ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                : <div className="w-4 h-4 rounded-full border-2 border-gray-200" />}
                                            <span className={`text-xs font-medium ${consentStatus === s ? 'text-gray-900' : 'text-gray-400'}`}>
                                                {s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                            </span>
                                        </div>
                                    ))}

                                    <div className="text-[11px] text-gray-500">
                                        These buttons stay disabled once manual consent starts or link is active.
                                    </div>
                                </div>

                            </div>
                        </div>
                    </SectionCard>
                </main>

                {/* STICKY FOOTER */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
                    <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/leads')}
                                className="px-5 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                            >
                                <ChevronLeft className="w-4 h-4" /> Back
                            </button>
                            {lastSaved && <span className="text-xs text-gray-400">{lastSaved}</span>}
                            <button
                                onClick={() => handleSaveDraft(false)}
                                disabled={saving}
                                className="px-5 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 flex items-center gap-2"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                Save Draft
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSaveAndNext}
                                disabled={saving || !canSaveAndNext}
                                title={!canSaveAndNext ? getSaveAndNextBlockingReason() : undefined}
                                className="px-8 py-2.5 bg-[#0047AB] text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#003580] flex items-center gap-2"
                            >
                                {canSaveAndNext ? 'Save & Next' : getSaveAndNextBlockingReason()}
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            {/* Digital Consent Modals & Toasts */}
            {
                showConsentConfirm.show && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                            <h3 className="text-xl font-black text-gray-900 mb-2">Confirm Phone Number</h3>
                            <p className="text-sm text-gray-500 mb-6">A consent link will be sent via {showConsentConfirm.channel.toUpperCase()}. Please verify the number:</p>

                            <div className="mb-8">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Mobile Number</label>
                                <input
                                    type="text"
                                    value={confirmPhone}
                                    onChange={(e) => setConfirmPhone(e.target.value)}
                                    className="w-full h-14 px-5 bg-gray-50 border-2 border-gray-100 rounded-2xl text-lg font-bold outline-none focus:border-[#0047AB] transition-all"
                                />
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowConsentConfirm({ show: false, channel: 'sms' })}
                                    className="flex-1 h-12 border-2 border-gray-100 rounded-xl text-sm font-bold text-gray-400 hover:bg-gray-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleSendConsent(showConsentConfirm.channel)}
                                    disabled={sendingConsent || !confirmPhone}
                                    className="flex-1 h-12 bg-[#0047AB] text-white rounded-xl text-sm font-bold hover:shadow-lg disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                                >
                                    {sendingConsent ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    Confirm & Send
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                consentSentToast && (
                    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[100] animate-in fade-in slide-in-from-bottom-4">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        <span className="text-sm font-bold">{consentSentToast.message}</span>
                        <button onClick={() => setConsentSentToast(null)} className="ml-2 hover:text-gray-400"><X className="w-4 h-4" /></button>
                    </div>
                )
            }
        </div>
    );
}

// ── Sub-Components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon, children, disabled, disabledMessage }: {
    title: string; icon?: React.ReactNode; children: React.ReactNode;
    disabled?: boolean; disabledMessage?: string;
}) {
    return (
        <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${disabled ? 'opacity-50' : ''}`}>
            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
                {icon}
                <h3 className="text-base font-black text-gray-900">{title}</h3>
            </div>
            <div className="px-6 py-5 relative">
                {disabled && (
                    <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
                        <div className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold">
                            {disabledMessage || 'Section locked'}
                        </div>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}
