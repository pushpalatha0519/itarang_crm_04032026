'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, FileText, Loader2, XCircle } from 'lucide-react';

type ReviewItem = {
    id: string;
    lead_id: string;
    customer_name: string;
    dealer_name: string;
    consent_status: string;
    signed_pdf_url: string | null;
    signed_pdf_uploaded_at: string | null;
    review_status: string;
    pdf_metadata: any;
    ocr_summary: any;
    upload_quality_flags: any;
};

const REJECTION_REASONS = [
    'Signature missing',
    'Thumb impression missing',
    'Witness signature missing',
    'PDF not legible',
    'Date missing or invalid',
    'Suspected forgery',
];

export default function ManualConsentReviewQueue() {
    const [items, setItems] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviewingLeadId, setReviewingLeadId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [reviewNotes, setReviewNotes] = useState('');
    const [rejectionReason, setRejectionReason] = useState(REJECTION_REASONS[0]);

    const [checklist, setChecklist] = useState({
        legible: true,
        allSignatureBoxesFilled: true,
        thumbImpressionPresent: true,
        witnessSignaturePresent: true,
        customerNameMatchesLead: true,
        signedDateRecent: true,
        tamperingDetected: false,
    });

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/consent-reviews');
            const data = await res.json();
            if (data.success) setItems(data.data || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const submitVerify = async (leadId: string) => {
        setSubmitting(true);
        try {
            const res = await fetch(`/api/kyc/${leadId}/consent/manual/admin/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reviewNotes,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setReviewingLeadId(null);
                setReviewNotes('');
                await load();
            }
        } finally {
            setSubmitting(false);
        }
    };

    const submitReject = async (leadId: string) => {
        setSubmitting(true);
        try {
            const res = await fetch(`/api/kyc/${leadId}/consent/manual/admin/verify/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reviewNotes,
                    rejectionReason,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setReviewingLeadId(null);
                setReviewNotes('');
                await load();
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="mt-8 bg-white rounded-[20px] border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                    <h3 className="text-lg font-black text-gray-900">Manual Consent Review Queue</h3>
                    <p className="text-xs text-gray-500">Offline signed PDFs that need admin verification</p>
                </div>
            </div>

            {loading ? (
                <div className="py-10 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[#0047AB]" />
                </div>
            ) : items.length === 0 ? (
                <div className="py-10 text-sm text-gray-400 text-center">
                    No manual consent PDFs are waiting for review.
                </div>
            ) : (
                <div className="space-y-4">
                    {items.map(item => (
                        <div key={item.id} className="border border-gray-200 rounded-2xl p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="font-bold text-gray-900">{item.customer_name}</div>
                                    <div className="text-xs text-gray-500">
                                        Lead: {item.lead_id} · Dealer: {item.dealer_name}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Uploaded: {item.signed_pdf_uploaded_at ? new Date(item.signed_pdf_uploaded_at).toLocaleString() : '-'}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {item.signed_pdf_url && (
                                        <a
                                            href={item.signed_pdf_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold flex items-center gap-2"
                                        >
                                            <Eye className="w-4 h-4" />
                                            View PDF
                                        </a>
                                    )}
                                    <button
                                        onClick={() => setReviewingLeadId(reviewingLeadId === item.lead_id ? null : item.lead_id)}
                                        className="px-3 py-2 rounded-xl bg-[#0047AB] text-white text-xs font-bold"
                                    >
                                        Review
                                    </button>
                                </div>
                            </div>

                            {reviewingLeadId === item.lead_id && (
                                <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm">
                                        <label className="flex items-center gap-2">
                                            <input type="checkbox" checked={checklist.legible} onChange={e => setChecklist(v => ({ ...v, legible: e.target.checked }))} />
                                            PDF is legible and clear
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input type="checkbox" checked={checklist.allSignatureBoxesFilled} onChange={e => setChecklist(v => ({ ...v, allSignatureBoxesFilled: e.target.checked }))} />
                                            All signature boxes filled
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input type="checkbox" checked={checklist.thumbImpressionPresent} onChange={e => setChecklist(v => ({ ...v, thumbImpressionPresent: e.target.checked }))} />
                                            Thumb impression present
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input type="checkbox" checked={checklist.witnessSignaturePresent} onChange={e => setChecklist(v => ({ ...v, witnessSignaturePresent: e.target.checked }))} />
                                            Witness signature present
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input type="checkbox" checked={checklist.customerNameMatchesLead} onChange={e => setChecklist(v => ({ ...v, customerNameMatchesLead: e.target.checked }))} />
                                            Customer name matches lead record
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input type="checkbox" checked={checklist.signedDateRecent} onChange={e => setChecklist(v => ({ ...v, signedDateRecent: e.target.checked }))} />
                                            Date signed is within 7 days
                                        </label>
                                        <label className="flex items-center gap-2 md:col-span-2">
                                            <input type="checkbox" checked={checklist.tamperingDetected} onChange={e => setChecklist(v => ({ ...v, tamperingDetected: e.target.checked }))} />
                                            Any tampering / alteration detected
                                        </label>
                                    </div>

                                    <select
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        className="w-full mb-3 h-11 px-4 border-2 border-[#EBEBEB] rounded-xl text-sm outline-none focus:border-[#1D4ED8]"
                                    >
                                        {REJECTION_REASONS.map(reason => (
                                            <option key={reason} value={reason}>{reason}</option>
                                        ))}
                                    </select>

                                    <textarea
                                        value={reviewNotes}
                                        onChange={(e) => setReviewNotes(e.target.value)}
                                        placeholder="Admin review notes"
                                        className="w-full mb-4 min-h-[90px] px-4 py-3 border-2 border-[#EBEBEB] rounded-xl text-sm outline-none focus:border-[#1D4ED8]"
                                    />

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => submitVerify(item.lead_id)}
                                            disabled={submitting}
                                            className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold flex items-center gap-2"
                                        >
                                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                            Approve
                                        </button>

                                        <button
                                            onClick={() => submitReject(item.lead_id)}
                                            disabled={submitting}
                                            className="px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold flex items-center gap-2"
                                        >
                                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
