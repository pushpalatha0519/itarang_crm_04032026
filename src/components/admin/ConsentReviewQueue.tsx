'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, FileText, Loader2, XCircle, ShieldCheck, User } from 'lucide-react';

type ReviewTask = {
    id: string;
    lead_id: string;
    customer_name: string;
    sign_method: string;
    signed_pdf_url: string | null;
    uploaded_at: string | null;
    review_status: string;
    ocr_summary: any;
};

const REJECTION_REASONS = [
    'Signature missing',
    'Thumb impression missing',
    'Witness signature missing',
    'PDF not legible',
    'Date missing or invalid',
    'Suspected forgery',
];

export default function ConsentReviewQueue() {
    const [tasks, setTasks] = useState<ReviewTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [reviewingTask, setReviewingTask] = useState<ReviewTask | null>(null);
    const [notes, setNotes] = useState('');
    const [rejectionReason, setRejectionReason] = useState(REJECTION_REASONS[0]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/consent-reviews');
            const data = await res.json();
            if (data.success) setTasks(data.data || []);
        } catch (err) {
            console.error('Failed to fetch consent reviews');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleAction = async (action: 'approve' | 'reject') => {
        if (!reviewingTask) return;
        setSubmitting(true);
        try {
            const endpoint = action === 'approve'
                ? `/api/kyc/${reviewingTask.lead_id}/consent/manual/admin/verify`
                : `/api/kyc/${reviewingTask.lead_id}/consent/manual/admin/verify/reject`;
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reviewNotes: notes,
                    rejectionReason: action === 'reject' ? rejectionReason : undefined,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setReviewingTask(null);
                setNotes('');
                await fetchTasks();
            } else {
                alert(data?.error || data?.error?.message || 'Action failed. Please try again.');
            }
        } catch (err) {
            alert('Action failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-gray-900">Consent Review Queue</h2>
                    <p className="text-sm text-gray-500">Validate digital and manual customer consents</p>
                </div>
                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-xs font-bold border border-blue-100">
                    {tasks.length} Pending Actions
                </div>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-[#0047AB]" />
                    <p className="text-sm font-medium text-gray-400">Loading pending reviews...</p>
                </div>
            ) : tasks.length === 0 ? (
                <div className="bg-white rounded-[32px] border border-gray-100 p-20 text-center shadow-sm">
                    <ShieldCheck className="w-16 h-16 text-green-100 mx-auto mb-6" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Queue is Clear!</h3>
                    <p className="text-gray-400 text-sm max-w-xs mx-auto">All customer consents have been processed. Great job!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {tasks.map(task => (
                        <div key={task.id} className={`bg-white rounded-[24px] border transition-all duration-300 ${reviewingTask?.id === task.id ? 'border-[#0047AB] shadow-xl' : 'border-gray-100 hover:border-gray-200 shadow-sm'}`}>
                            <div className="p-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                                        <User className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-900 text-lg">{task.customer_name}</div>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                            <span>Lead: <span className="font-bold text-gray-700">{task.lead_id}</span></span>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                            <span className={`px-2 py-0.5 rounded-full font-bold ${task.sign_method === 'aadhaar_esign' ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700'}`}>
                                                {task.sign_method.replace(/_/g, ' ').toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {task.signed_pdf_url && (
                                        <a href={task.signed_pdf_url} target="_blank" rel="noopener noreferrer" className="h-11 px-5 rounded-xl bg-gray-50 text-gray-600 border border-gray-200 text-sm font-bold flex items-center gap-2 hover:bg-gray-100">
                                            <Eye className="w-4 h-4" /> View PDF
                                        </a>
                                    )}
                                    <button 
                                        onClick={() => setReviewingTask(reviewingTask?.id === task.id ? null : task)}
                                        className="h-11 px-8 rounded-xl bg-[#0047AB] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all"
                                    >
                                        Review Task
                                    </button>
                                </div>
                            </div>

                            {reviewingTask?.id === task.id && (
                                <div className="p-8 border-t border-gray-100 bg-gray-50/50 rounded-b-[24px]">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Verification Actions</h4>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-xs font-bold text-gray-700 mb-2 block">Decision</label>
                                                    <div className="flex gap-3">
                                                        <button 
                                                            onClick={() => handleAction('approve')}
                                                            disabled={submitting}
                                                            className="flex-1 h-14 bg-green-600 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-all disabled:opacity-40"
                                                        >
                                                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                                            Approve Consent
                                                        </button>
                                                        <button 
                                                            onClick={() => handleAction('reject')}
                                                            disabled={submitting}
                                                            className="flex-1 h-14 bg-red-600 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-all disabled:opacity-40"
                                                        >
                                                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-5 h-5" />}
                                                            Reject Consent
                                                        </button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-700 mb-2 block">Rejection Reason (if applicable)</label>
                                                    <select 
                                                        value={rejectionReason}
                                                        onChange={(e) => setRejectionReason(e.target.value)}
                                                        className="w-full h-12 px-4 bg-white border-2 border-gray-100 rounded-xl text-sm outline-none focus:border-[#0047AB]"
                                                    >
                                                        {REJECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Reviewer Feedback</h4>
                                            <textarea 
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Add internal notes about this verification..."
                                                className="w-full h-[140px] p-4 bg-white border-2 border-gray-100 rounded-2xl text-sm outline-none focus:border-[#0047AB] resize-none"
                                            />
                                        </div>
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
