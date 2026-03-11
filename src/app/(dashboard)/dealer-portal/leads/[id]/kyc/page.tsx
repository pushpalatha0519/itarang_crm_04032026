'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

                </main>

                {/* ═══════════════════════════════════════════════════════════
                    STICKY FOOTER
                   ═══════════════════════════════════════════════════════════ */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
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
                </div>
            </div>
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
