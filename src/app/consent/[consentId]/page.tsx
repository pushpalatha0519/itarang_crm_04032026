'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

type ValidationResponse = {
  success: boolean;
  leadId?: string;
  customerName?: string;
  status?: string;
  expiresAt?: string;
  canProceed?: boolean;
  error?: { message?: string };
};

export default function CustomerConsentPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const consentId = params.consentId as string;
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('awaiting_signature');
  const [customerName, setCustomerName] = useState<string>('Customer');
  const [leadId, setLeadId] = useState<string>('');
  const [canProceed, setCanProceed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [otp, setOtp] = useState('');
  const [startingEsign, setStartingEsign] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const shortMaskedAadhaar = useMemo(() => {
    const cleaned = aadhaarNumber.replace(/\D/g, '');
    if (cleaned.length < 4) return '';
    return `XXXX-XXXX-${cleaned.slice(-4)}`;
  }, [aadhaarNumber]);

  useEffect(() => {
    const run = async () => {
      if (!consentId || !token) {
        setError('Invalid consent link');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/kyc/consent/digital/${consentId}/validate?token=${encodeURIComponent(token)}`
        );
        const data = (await res.json()) as ValidationResponse;

        if (!res.ok || !data.success) {
          setError(data.error?.message || 'Consent link could not be validated');
          setStatus(data.status || 'invalid');
        } else {
          setLeadId(data.leadId || '');
          setCustomerName(data.customerName || 'Customer');
          setStatus(data.status || 'link_opened');
          setCanProceed(!!data.canProceed);
        }
      } catch {
        setError('Failed to validate consent link');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [consentId, token]);

  const startEsign = async () => {
    setError(null);
    setSuccessMessage(null);

    const cleaned = aadhaarNumber.replace(/\D/g, '');
    if (cleaned.length !== 12) {
      setError('Please enter a valid 12-digit Aadhaar number');
      return;
    }

    setStartingEsign(true);
    try {
      const res = await fetch(`/api/kyc/consent/digital/${consentId}/esign/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          aadhaarNumber: cleaned,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Failed to initiate eSign');
        return;
      }

      setTransactionId(data.transactionId || '');
      setStatus('esign_in_progress');
      setSuccessMessage('OTP sent to your Aadhaar-linked mobile number');
    } catch {
      setError('Failed to initiate eSign');
    } finally {
      setStartingEsign(false);
    }
  };

  const verifyOtp = async () => {
    setError(null);
    setSuccessMessage(null);

    if (!transactionId) {
      setError('Missing transaction. Please restart eSign.');
      return;
    }
    if (!otp || otp.length < 4) {
      setError('Please enter valid OTP');
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await fetch(`/api/kyc/consent/digital/${consentId}/esign/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          transactionId,
          otp,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setStatus(data.status || 'esign_failed');
        setError(data.error?.message || data.message || 'OTP verification failed');
        return;
      }

      setStatus(data.status || 'admin_review_pending');
      setSuccessMessage('Consent signed successfully. It is now pending admin review.');
    } catch {
      setError('OTP verification failed');
    } finally {
      setVerifyingOtp(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading consent form...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">iTarang Customer Consent</h1>
          <p className="text-sm text-gray-500 mt-1">
            Customer: <span className="font-semibold">{customerName}</span>
            {leadId ? <span> | Lead ID: {leadId}</span> : null}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
          <p className="text-sm text-gray-700">
            Current Status: <span className="font-semibold">{status}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            By proceeding, you consent to processing of your KYC data for loan processing and compliance.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}

        {successMessage ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {successMessage}
          </div>
        ) : null}

        {canProceed && status !== 'admin_review_pending' && status !== 'admin_verified' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Aadhaar Number</label>
              <input
                type="text"
                value={aadhaarNumber}
                onChange={(e) => setAadhaarNumber(e.target.value)}
                placeholder="Enter 12-digit Aadhaar number"
                className="w-full h-11 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              {shortMaskedAadhaar ? (
                <p className="text-xs text-gray-500 mt-1">Will be used as: {shortMaskedAadhaar}</p>
              ) : null}
            </div>

            <button
              onClick={startEsign}
              disabled={startingEsign || status === 'esign_in_progress'}
              className="h-11 px-5 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {startingEsign ? 'Starting eSign...' : 'Sign with Aadhaar (Send OTP)'}
            </button>

            {status === 'esign_in_progress' ? (
              <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-700 font-semibold">Enter OTP</p>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter OTP"
                  className="w-full h-11 px-3 border border-blue-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={verifyOtp}
                  disabled={verifyingOtp}
                  className="h-11 px-5 rounded-lg bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {verifyingOtp ? 'Verifying OTP...' : 'Verify OTP & Complete eSign'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {(status === 'admin_review_pending' || status === 'admin_verified') ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-700">Consent submitted successfully.</p>
            <p className="text-xs text-green-700 mt-1">Your consent is with iTarang admin for review.</p>
          </div>
        ) : null}

        {(status === 'expired' || status === 'esign_blocked') ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-700">This consent link is not usable now.</p>
            <p className="text-xs text-amber-700 mt-1">
              Please contact your dealer to resend a fresh consent link.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
