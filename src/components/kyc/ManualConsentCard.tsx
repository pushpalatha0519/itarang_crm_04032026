'use client';

import { useRef, useState } from 'react';
import { Download, Loader2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';

type Props = {
    leadId: string;
    consentStatus: string;
    onStatusChange: (status: string) => void;
    onError: (message: string) => void;
};

export function ManualConsentCard({
    leadId,
    consentStatus,
    onStatusChange,
    onError,
}: Props) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [generating, setGenerating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [manualPdfGenerated, setManualPdfGenerated] = useState(
        ['manual_pdf_generated', 'manual_review_pending', 'verified'].includes(consentStatus)
    );
    const [uploadedAt, setUploadedAt] = useState<string | null>(null);
    const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);

    const digitalLocked = manualPdfGenerated || ['manual_review_pending', 'verified'].includes(consentStatus);
    const uploadEnabled = manualPdfGenerated;

    const handleGeneratePdf = async () => {
        setGenerating(true);
        try {
            const res = await fetch(`/api/kyc/${leadId}/consent/manual/generate-pdf`, {
                method: 'POST',
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                onError(data?.error?.message || 'Failed to generate consent PDF');
                return;
            }

            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = `DPDPA_consent_form_for_data_processing_${leadId}.pdf`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(objectUrl);

            setManualPdfGenerated(true);
            onStatusChange('manual_pdf_generated');

            alert('Consent PDF downloaded. Please print, sign, and upload scanned copy.');
        } catch {
            onError('Failed to generate consent PDF');
        } finally {
            setGenerating(false);
        }
    };

    const handleUploadClick = () => {
        if (!uploadEnabled) {
            onError('Generate the consent PDF first');
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileSelected = async (file?: File) => {
        if (!file) return;

        if (file.type !== 'application/pdf') {
            onError('Only PDF files are allowed');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            onError('PDF must be below 10MB');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('file', file);

        try {
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `/api/kyc/${leadId}/consent/manual/upload`);

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percent = Math.round((event.loaded / event.total) * 100);
                        setUploadProgress(percent);
                    }
                };

                xhr.onload = () => {
                    try {
                        const data = JSON.parse(xhr.responseText || '{}');
                        if (xhr.status >= 200 && xhr.status < 300 && data.success) {
                            setSignedPdfUrl(data.fileUrl || null);
                            setUploadedAt(data.uploadedAt || null);
                            onStatusChange(data.status || 'manual_review_pending');
                            resolve();
                        } else {
                            reject(
                                new Error(
                                    data.error?.message ||
                                    data.message ||
                                    `Upload failed (HTTP ${xhr.status})`
                                )
                            );
                        }
                    } catch {
                        reject(new Error(`Upload failed (HTTP ${xhr.status})`));
                    }
                };

                xhr.onerror = () => reject(new Error('Upload failed'));
                xhr.send(formData);
            });
        } catch (error) {
            onError(error instanceof Error ? error.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-3">
            <h4 className="text-sm font-bold text-gray-900">Manual Consent</h4>

            <button
                onClick={handleGeneratePdf}
                disabled={generating || ['manual_review_pending', 'verified'].includes(consentStatus)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold hover:border-[#0047AB] transition-all disabled:opacity-40"
            >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Generate Consent PDF
            </button>

            <button
                onClick={handleUploadClick}
                disabled={!uploadEnabled || uploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-bold hover:border-[#0047AB] transition-all disabled:opacity-40"
            >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload Signed Consent PDF
            </button>

            <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
            />

            {uploading && (
                <div className="p-3 bg-blue-50 rounded-xl">
                    <div className="flex items-center justify-between text-xs font-medium text-blue-700 mb-2">
                        <span>Uploading signed consent PDF</span>
                        <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-600 transition-all"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {manualPdfGenerated && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                    <div className="font-bold">Next Steps</div>
                    <div>1. Print the downloaded PDF</div>
                    <div>2. Customer must sign in the designated box</div>
                    <div>3. Customer thumb impression is required</div>
                    <div>4. Witness signature is required</div>
                    <div>5. Scan or take a clear and legible PDF</div>
                    <div>6. Upload the signed PDF</div>
                </div>
            )}

            {uploadedAt && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 space-y-1">
                    <div className="flex items-center gap-2 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        Consent uploaded successfully
                    </div>
                    <div>Uploaded at: {new Date(uploadedAt).toLocaleString()}</div>
                    {signedPdfUrl && (
                        <a
                            href={signedPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                        >
                            View uploaded PDF
                        </a>
                    )}
                </div>
            )}

            {digitalLocked && (
                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <AlertCircle className="w-4 h-4" />
                    Manual consent started, so digital send buttons must stay disabled.
                </div>
            )}
        </div>
    );
}
