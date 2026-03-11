'use client';

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import stringSimilarity from "string-similarity";
import {
    ChevronLeft, Loader2, Upload, CheckCircle2,
    AlertCircle, X, FileText,
    Send, Download, ArrowRight
} from 'lucide-react';
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
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    // ── Load Data ────────────────────────────────────────────────────────────

    useEffect(() => {
        const loadData = async () => {
            try {
                const res = await fetch(`/api/kyc/${leadId}/access-check`);
                const data = await res.json();
                if (!data.success || !data.allowed) { setAccessDenied(true); return; }

                setLead(data.lead);
                if (data.lead.payment_method) setPaymentMethod(data.lead.payment_method);
                if (data.lead.consent_status) setConsentStatus(data.lead.consent_status);
            } catch { setApiError('Failed to load KYC data'); }
            finally { setLoading(false); }
        };
        loadData();
    }, [leadId]);

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
        try {
            const res = await fetch(`/api/kyc/${leadId}/send-consent`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel }),
            });
            const data = await res.json();
            if (data.success) setConsentStatus('link_sent');
            else setApiError(data.error?.message || 'Failed to send consent');
        } catch { setApiError('Failed to send consent'); }
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
            const data = await res.json();
            if (data.success) {
                setConsentStatus('manual_review_pending');
            } else { setApiError(data.message || 'Upload failed'); }
        } catch { setApiError('Upload failed'); }
        finally { setUploadingPdf(false); }
    };

    const handleGenerateConsentPDF = async () => {
        setGeneratingPdf(true);
        try {
            const res = await fetch(`/api/kyc/${leadId}/consent/manual/generate-pdf`, { method: 'POST' });
            const data = await res.json();
            if (data.success && data.pdfUrl) {
                setConsentStatus('manual_pdf_generated');
                // Create a temporary link to automatically trigger the download
                const link = document.createElement('a');
                link.href = data.pdfUrl;
                link.download = `Consent_${leadId}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                // Also open in a new tab as fallback
                window.open(data.pdfUrl, '_blank');
            } else { setApiError(data.message || 'Failed to generate PDF'); }
        } catch { setApiError('Failed to generate PDF'); }
        finally { setGeneratingPdf(false); }
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
        const validStatuses = ['digitally_signed', 'manual_uploaded', 'manual_review_pending', 'manual_verified', 'verified'];
        if (!validStatuses.includes(consentStatus)) {
            setApiError('Customer consent must be completed or pending review'); return;
        }

        setSaving(true);
        try {
            const res = await fetch(`/api/kyc/${leadId}/complete-and-next`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentMethod }),
            });
            const data = await res.json();
            if (data.success) {
                if (data.requiresInterim) router.push(`/dealer-portal/leads/${leadId}/kyc/interim`);
                else router.push(`/dealer-portal/leads/${leadId}`);
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
                <button onClick={() => router.push('/dealer-portal/leads')} className="px-6 py-3 bg-[#0047AB] text-white rounded-xl font-bold">Back to Leads</button>
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
                        { label: 'Consent', done: ['digitally_signed', 'manual_uploaded', 'manual_review_pending', 'verified'].includes(consentStatus), active: !['digitally_signed', 'manual_uploaded', 'manual_review_pending', 'verified'].includes(consentStatus) },
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
                                <button onClick={() => handleSendConsent('sms')} disabled={consentStatus !== 'awaiting_signature'}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0047AB] text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#003580] transition-all">
                                    <Send className="w-4 h-4" /> Send SMS Consent
                                </button>
                                <button onClick={() => handleSendConsent('whatsapp')} disabled={consentStatus !== 'awaiting_signature'}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-green-700 transition-all">
                                    <Send className="w-4 h-4" /> Send WhatsApp Consent
                                </button>
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-900">Manual Consent</h4>
                                <button onClick={handleGenerateConsentPDF} disabled={generatingPdf}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold hover:border-[#0047AB] disabled:opacity-50 transition-all">
                                    {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    Generate Consent PDF
                                </button>
                                <label className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-bold transition-all ${consentStatus === 'manual_pdf_generated' ? 'cursor-pointer hover:border-[#0047AB]' : 'opacity-40 cursor-not-allowed'}`}>
                                    {uploadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    Upload Signed PDF
                                    <input type="file" className="hidden" accept="application/pdf" disabled={consentStatus !== 'manual_pdf_generated' || uploadingPdf} onChange={e => { if (e.target.files?.[0]) handleUploadSignedConsent(e.target.files[0]) }} />
                                </label>
                                {consentStatus === 'manual_pdf_generated' && (
                                    <p className="text-[10px] text-green-600 font-medium">PDF generated. Please print, sign, and upload here.</p>
                                )}
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-900">Status</h4>
                                <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                                    {['awaiting_signature', 'manual_pdf_generated', 'manual_review_pending', 'verified'].map(s => (
                                        <div key={s} className="flex items-center gap-2">
                                            {consentStatus === s || (['manual_review_pending', 'verified'].includes(consentStatus) && ['awaiting_signature', 'manual_pdf_generated'].includes(s))
                                                ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                : <div className="w-4 h-4 rounded-full border-2 border-gray-200" />}
                                            <span className={`text-xs font-medium ${consentStatus === s ? 'text-gray-900' : 'text-gray-400'}`}>
                                                {s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                </main >

                {/* ═══════════════════════════════════════════════════════════
                    STICKY FOOTER
                   ═══════════════════════════════════════════════════════════ */}
                < div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50" >
                    <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.push('/dealer-portal/leads')}
                                className="px-5 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                                <ChevronLeft className="w-4 h-4" /> Back
                            </button>
                            {lastSaved && <span className="text-xs text-gray-400">{lastSaved}</span>}
                            <button onClick={() => handleSaveDraft(false)} disabled={saving}
                                className="px-5 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 flex items-center gap-2">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                Save Draft
                            </button>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={handleSaveAndNext} disabled={saving}
                                className="px-8 py-2.5 bg-[#0047AB] text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#003580] flex items-center gap-2">
                                Save & Next <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div >
            </div >
        </div >
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
