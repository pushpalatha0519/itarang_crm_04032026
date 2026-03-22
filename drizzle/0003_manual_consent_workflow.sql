CREATE TABLE IF NOT EXISTS manual_consent_audits (
    id varchar(255) PRIMARY KEY,
    lead_id varchar(255) NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    consent_record_id varchar(255) REFERENCES consent_records(id) ON DELETE SET NULL,

    preview_pdf_url text,
    preview_pdf_path text,
    preview_expires_at timestamptz,
    preview_deleted_at timestamptz,

    signed_pdf_url text,
    signed_pdf_name text,
    signed_pdf_size integer,
    signed_pdf_uploaded_at timestamptz,
    uploaded_by uuid,

    sign_method varchar(30) DEFAULT 'manual',
    upload_quality_flags jsonb,
    pdf_metadata jsonb,
    ocr_summary jsonb,

    review_status varchar(30) DEFAULT 'manual_pdf_generated' NOT NULL,
    manual_checklist jsonb,
    review_notes text,
    rejection_reason text,
    reviewed_by uuid,
    reviewed_at timestamptz,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS manual_consent_audits_lead_idx
ON manual_consent_audits(lead_id);

CREATE INDEX IF NOT EXISTS manual_consent_audits_status_idx
ON manual_consent_audits(review_status);