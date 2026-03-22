export const CONSENT_STATUS = {
  AWAITING_SIGNATURE: 'awaiting_signature',
  LINK_SENT: 'link_sent',
  LINK_OPENED: 'link_opened',
  ESIGN_IN_PROGRESS: 'esign_in_progress',
  ESIGN_COMPLETED: 'esign_completed',
  ADMIN_REVIEW_PENDING: 'admin_review_pending',
  VERIFIED: 'verified',
  ADMIN_REJECTED: 'admin_rejected',
  EXPIRED: 'expired',
  MANUAL_PDF_GENERATED: 'manual_pdf_generated',
  MANUAL_REVIEW_PENDING: 'manual_review_pending',
  MANUAL_UPLOADED: 'manual_uploaded',
  MANUAL_REJECTED: 'manual_rejected',
  ESIGN_FAILED: 'esign_failed',
  ESIGN_BLOCKED: 'esign_blocked',
} as const;

export function normalizeConsentStatus(status?: string | null): string {
  const s = (status || '').toLowerCase();
  if (!s) return CONSENT_STATUS.AWAITING_SIGNATURE;

  if (['manual_verified', 'admin_verified', CONSENT_STATUS.VERIFIED].includes(s)) {
    return CONSENT_STATUS.VERIFIED;
  }

  if (
    [CONSENT_STATUS.MANUAL_REVIEW_PENDING, 'consent_uploaded', 'manual_uploaded'].includes(
      s
    )
  ) {
    return CONSENT_STATUS.MANUAL_REVIEW_PENDING;
  }

  if ([CONSENT_STATUS.MANUAL_PDF_GENERATED, 'consent_generated'].includes(s)) {
    return CONSENT_STATUS.MANUAL_PDF_GENERATED;
  }

  return s;
}

export function isConsentVerified(status?: string | null): boolean {
  const s = normalizeConsentStatus(status);
  return s === CONSENT_STATUS.VERIFIED;
}

// Some deployed DBs still enforce old enum/check values on leads.consent_status.
// For maximum compatibility we persist this legacy value while UI/API can still show
// `manual_review_pending`.
export function getPersistedLeadStatusForManualReviewPending(): string {
  return CONSENT_STATUS.MANUAL_UPLOADED;
}
