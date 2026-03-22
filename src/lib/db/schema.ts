import { pgTable, text, timestamp, integer, boolean, varchar, decimal, jsonb, uuid, index, numeric } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
    id: uuid('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    dealer_id: varchar('dealer_id', { length: 255 }), 
    phone: text('phone'),
    avatar_url: text('avatar_url'),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
    id: varchar('id', { length: 255 }).primaryKey(),
    business_entity_name: text('business_entity_name'),
    business_name: text('business_name'),
    owner_name: text('owner_name'),
    email: text('email'),
    phone: varchar('phone', { length: 20 }),
    gstin: varchar('gstin', { length: 20 }),
    billing_address: text('billing_address'),
    status: varchar('status', { length: 20 }).default('active'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const leads = pgTable('leads', {
    id: varchar('id', { length: 255 }).primaryKey(),
    reference_id: varchar('reference_id', { length: 255 }),
    full_name: text('full_name'),
    father_or_husband_name: text('father_or_husband_name'),
    dob: timestamp('dob'),
    current_address: text('current_address'),
    permanent_address: text('permanent_address'),
    is_current_same: boolean('is_current_same').default(false),
    owner_name: text('owner_name').notNull(),
    owner_contact: varchar('owner_contact', { length: 20 }).notNull(),
    owner_email: text('owner_email'),
    phone: varchar('phone', { length: 20 }),
    mobile: varchar('mobile', { length: 20 }),
    state: varchar('state', { length: 100 }),
    city: varchar('city', { length: 100 }),
    shop_address: text('shop_address'),
    lead_source: varchar('lead_source', { length: 50 }),
    interest_level: varchar('interest_level', { length: 20 }),
    status: varchar('status', { length: 50 }).default('INCOMPLETE'),
    lead_status: varchar('lead_status', { length: 50 }).default('new'),
    kyc_status: varchar('kyc_status', { length: 50 }).default('not_started'),
    workflow_step: integer('workflow_step').default(1),
    has_co_borrower: boolean('has_co_borrower').default(false),
    
    business_name: text('business_name'),
    battery_order_expected: integer('battery_order_expected'),
    investment_capacity: varchar('investment_capacity', { length: 100 }),
    business_type: varchar('business_type', { length: 50 }),
    
    product_category_id: varchar('product_category_id', { length: 255 }),
    product_type_id: varchar('product_type_id', { length: 255 }),
    primary_product_id: varchar('primary_product_id', { length: 255 }),
    interested_in: jsonb('interested_in'),
    
    asset_model: varchar('asset_model', { length: 100 }),
    payment_method: varchar('payment_method', { length: 100 }),
    lead_score: integer('lead_score'),
    
    vehicle_rc: varchar('vehicle_rc', { length: 50 }),
    vehicle_ownership: varchar('vehicle_ownership', { length: 50 }),
    vehicle_owner_name: varchar('vehicle_owner_name', { length: 255 }),
    vehicle_owner_phone: varchar('vehicle_owner_phone', { length: 20 }),
    
    dealer_id: varchar('dealer_id', { length: 255 }).references(() => accounts.id),
    uploader_id: uuid('uploader_id').references(() => users.id),
    
    // AI / Management fields
    ai_managed: boolean('ai_managed').default(false),
    manual_takeover: boolean('manual_takeover').default(false),
    intent_score: integer('intent_score'),
    
    // Digital Consent Fields
    consent_status: varchar('consent_status', { length: 50 }).default('awaiting_signature'),
    consent_link_url: text('consent_link_url'),
    consent_link_sent_at: timestamp('consent_link_sent_at', { withTimezone: true }),
    consent_link_expires_at: timestamp('consent_link_expires_at', { withTimezone: true }),
    consent_delivery_channel: varchar('consent_delivery_channel', { length: 20 }),
    
    // eSign Fields
    esign_transaction_id: varchar('esign_transaction_id', { length: 255 }),
    esign_certificate_id: varchar('esign_certificate_id', { length: 255 }),
    esign_completed_at: timestamp('esign_completed_at', { withTimezone: true }),
    esign_failed_at: timestamp('esign_failed_at', { withTimezone: true }),
    esign_error_code: varchar('esign_error_code', { length: 100 }),
    esign_error_message: text('esign_error_message'),
    
    // Verification Fields
    consent_verified_by: uuid('consent_verified_by').references(() => users.id),
    consent_verified_at: timestamp('consent_verified_at', { withTimezone: true }),
    consent_verification_notes: text('consent_verification_notes'),
    consent_final: boolean('consent_final').default(false),
    consent_rejection_reason: text('consent_rejection_reason'),
    consent_rejection_notes: text('consent_rejection_notes'),
    consent_rejected_by: uuid('consent_rejected_by').references(() => users.id),
    consent_rejected_at: timestamp('consent_rejected_at', { withTimezone: true }),
    consent_attempt_count: integer('consent_attempt_count').default(0),
    
    // AI Dialer Fields
    last_call_status: varchar('last_call_status', { length: 50 }),
    last_call_outcome: varchar('last_call_outcome', { length: 100 }),
    
    // Qualification Fields
    qualified_by: uuid('qualified_by').references(() => users.id),
    qualified_at: timestamp('qualified_at', { withTimezone: true }),
    qualification_notes: text('qualification_notes'),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const personalDetails = pgTable('personal_details', {
    id: varchar('id', { length: 255 }).primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id, { onDelete: 'cascade' }),
    dob: timestamp('dob'), // DB has date, but timestamp is safer for Drizzle if it sends ISO strings
    income: numeric('income'),
    father_husband_name: text('father_husband_name'),
    local_address: text('local_address'),
    permanent_address: text('permanent_address'),
    aadhaar_no: varchar('aadhaar_no', { length: 255 }),
    pan_no: varchar('pan_no', { length: 255 }),
    email: text('email'),
    marital_status: varchar('marital_status', { length: 255 }),
    spouse_name: text('spouse_name'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const productCategories = pgTable('product_categories', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    is_active: boolean('is_active').default(true),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const oems = pgTable('oems', {
    id: varchar('id', { length: 255 }).primaryKey(),
    business_entity_name: text('business_entity_name').notNull(),
    gstin: varchar('gstin', { length: 20 }),
    pan: varchar('pan', { length: 20 }),
    address_line1: text('address_line1'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    pincode: varchar('pincode', { length: 10 }),
    bank_name: varchar('bank_name', { length: 100 }),
    bank_account_number: varchar('bank_account_number', { length: 50 }),
    ifsc_code: varchar('ifsc_code', { length: 20 }),
    status: varchar('status', { length: 20 }).default('active'),
    created_by: uuid('created_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable('products', {
    id: uuid('id').primaryKey().defaultRandom(),
    category_id: uuid('category_id').references(() => productCategories.id),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    sku: varchar('sku', { length: 100 }),
    hsn_code: varchar('hsn_code', { length: 20 }),
    asset_type: varchar('asset_type', { length: 50 }),
    voltage_v: integer('voltage_v'),
    capacity_ah: integer('capacity_ah'),
    is_serialized: boolean('is_serialized').default(false),
    warranty_months: integer('warranty_months'),
    status: varchar('status', { length: 20 }).default('active'),
    is_active: boolean('is_active').default(true),
    sort_order: integer('sort_order'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const consentRecords = pgTable('consent_records', {
    id: varchar('id', { length: 255 }).primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id, { onDelete: 'cascade' }).notNull(),
    consent_for: varchar('consent_for', { length: 50 }).default('primary'),
    // DB has 'channel' + 'consent_type' – we map both
    channel: varchar('channel', { length: 50 }),
    consent_type: varchar('consent_type', { length: 50 }),  // kept for compatibility but may be same as channel
    consent_status: varchar('consent_status', { length: 50 }),
    consent_token: text('consent_token'),
    consent_link_url: text('consent_link_url'),
    consent_link_sent_at: timestamp('consent_link_sent_at', { withTimezone: true }),

    // DB uses signed_consent_url instead of signed_pdf_url
    signed_consent_url: text('signed_consent_url'),
    signed_at: timestamp('signed_at', { withTimezone: true }),

    // Admin verification columns
    verified_by: uuid('verified_by').references(() => users.id),
    verified_at: timestamp('verified_at', { withTimezone: true }),

    generated_pdf_url: text('generated_pdf_url'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const manualConsentAudits = pgTable('manual_consent_audits', {
    id: varchar('id', { length: 255 }).primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id, { onDelete: 'cascade' }).notNull(),
    consent_record_id: varchar('consent_record_id', { length: 255 }).references(() => consentRecords.id, { onDelete: 'set null' }),

    preview_pdf_url: text('preview_pdf_url'),
    preview_pdf_path: text('preview_pdf_path'),
    preview_expires_at: timestamp('preview_expires_at', { withTimezone: true }),

    signed_pdf_url: text('signed_pdf_url'),
    signed_pdf_name: text('signed_pdf_name'),
    signed_pdf_size: integer('signed_pdf_size'),
    signed_pdf_uploaded_at: timestamp('signed_pdf_uploaded_at', { withTimezone: true }),
    uploaded_by: uuid('uploaded_by').references(() => users.id),

    sign_method: varchar('sign_method', { length: 30 }).default('manual'),
    upload_quality_flags: jsonb('upload_quality_flags'),
    pdf_metadata: jsonb('pdf_metadata'),
    ocr_summary: jsonb('ocr_summary'),

    review_status: varchar('review_status', { length: 30 }).default('manual_pdf_generated').notNull(),
    rejection_reason: text('rejection_reason'),
    rejection_notes: text('rejection_notes'),
    reviewed_by: uuid('reviewed_by').references(() => users.id),
    reviewed_at: timestamp('reviewed_at', { withTimezone: true }),

    // Browser/device metadata from upload
    ip_address: varchar('ip_address', { length: 50 }),
    user_agent: text('user_agent'),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
    return {
        manualConsentLeadIdx: index('manual_consent_audits_lead_idx').on(table.lead_id),
        manualConsentStatusIdx: index('manual_consent_audits_status_idx').on(table.review_status),
    };
});

export const auditLogs = pgTable('audit_logs', {
    id: varchar('id', { length: 255 }).primaryKey(),
    entity_type: varchar('entity_type', { length: 50 }).notNull(),
    entity_id: varchar('entity_id', { length: 255 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    changes: jsonb('changes'),
    performed_by: uuid('performed_by').notNull().references(() => users.id),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
});

export const slas = pgTable('slas', {
    id: varchar('id', { length: 255 }).primaryKey(),
    workflow_step: varchar('workflow_step', { length: 100 }).notNull(),
    entity_type: varchar('entity_type', { length: 50 }).notNull(),
    entity_id: varchar('entity_id', { length: 255 }).notNull(),
    assigned_to: uuid('assigned_to').references(() => users.id),
    sla_deadline: timestamp('sla_deadline', { withTimezone: true }).notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    escalated_to: uuid('escalated_to').references(() => users.id),
    escalated_at: timestamp('escalated_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const kycDocuments = pgTable('kyc_documents', {
    id: varchar('id', { length: 255 }).primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id, { onDelete: 'cascade' }),
    doc_type: varchar('doc_type', { length: 50 }),
    file_url: text('file_url'),
    file_name: text('file_name'),
    file_size: integer('file_size'),
    verification_status: varchar('verification_status', { length: 50 }).default('pending'),
    failed_reason: text('failed_reason'),
    ocr_data: jsonb('ocr_data'),
    api_response: jsonb('api_response'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const coBorrowerDocuments = pgTable('co_borrower_documents', {
    id: varchar('id', { length: 255 }).primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id, { onDelete: 'cascade' }),
    co_borrower_id: varchar('co_borrower_id', { length: 255 }),
    document_type: varchar('document_type', { length: 50 }),
    document_url: text('document_url'),
    status: varchar('status', { length: 50 }).default('uploaded'),
    ocr_data: jsonb('ocr_data'),
    uploaded_at: timestamp('uploaded_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const adminKycReviews = pgTable('admin_kyc_reviews', {
    id: varchar('id', { length: 255 }).primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id, { onDelete: 'cascade' }).notNull(),
    review_for: varchar('review_for', { length: 20 }).default('primary'),
    document_id: uuid('document_id'),
    outcome: varchar('outcome', { length: 30 }).notNull(),
    rejection_reason: text('rejection_reason'),
    additional_doc_requested: text('additional_doc_requested'),
    reviewer_id: uuid('reviewer_id').references(() => users.id),
    reviewer_notes: text('reviewer_notes'),
    reviewed_at: timestamp('reviewed_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const leadAssignments = pgTable('lead_assignments', {
    id: varchar('id', { length: 255 }).primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id, { onDelete: 'cascade' }).notNull(),
    lead_owner: uuid('lead_owner').notNull().references(() => users.id),
    lead_actor: uuid('lead_actor').references(() => users.id),
    assigned_by: uuid('assigned_by').notNull().references(() => users.id),
    actor_assigned_by: uuid('actor_assigned_by').references(() => users.id),
    actor_assigned_at: timestamp('actor_assigned_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const assignmentChangeLogs = pgTable('assignment_change_logs', {
    id: varchar('id', { length: 255 }).primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id, { onDelete: 'cascade' }).notNull(),
    change_type: varchar('change_type', { length: 50 }).notNull(),
    old_user_id: uuid('old_user_id').references(() => users.id),
    new_user_id: uuid('new_user_id').references(() => users.id),
    changed_by: uuid('changed_by').notNull().references(() => users.id),
    changed_at: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
});

export const aiCallLogs = pgTable('ai_call_logs', {
    id: varchar('id', { length: 255 }).primaryKey(),
    call_id: varchar('call_id', { length: 255 }).unique().notNull(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id, { onDelete: 'cascade' }).notNull(),
    status: varchar('status', { length: 50 }).default('initiated'),
    transcript: text('transcript'),
    recording_url: text('recording_url'),
    duration: integer('duration'),
    ended_at: timestamp('ended_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const inventory = pgTable('inventory', {
    id: varchar('id', { length: 255 }).primaryKey(),
    product_id: uuid('product_id').references(() => products.id),
    oem_id: varchar('oem_id', { length: 255 }).references(() => oems.id),
    oem_name: text('oem_name'),
    asset_category: varchar('asset_category', { length: 50 }),
    asset_type: varchar('asset_type', { length: 50 }),
    model_type: text('model_type'),
    serial_number: varchar('serial_number', { length: 100 }),
    manufacturing_date: timestamp('manufacturing_date'),
    expiry_date: timestamp('expiry_date'),
    inventory_amount: numeric('inventory_amount', { precision: 12, scale: 2 }),
    gst_percent: integer('gst_percent'),
    gst_amount: numeric('gst_amount', { precision: 12, scale: 2 }),
    final_amount: numeric('final_amount', { precision: 12, scale: 2 }),
    oem_invoice_number: varchar('oem_invoice_number', { length: 100 }),
    oem_invoice_date: timestamp('oem_invoice_date'),
    status: varchar('status', { length: 20 }).default('available'),
    created_by: uuid('created_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const provisions = pgTable('provisions', {
    id: varchar('id', { length: 255 }).primaryKey(),
    oem_id: varchar('oem_id', { length: 255 }).references(() => oems.id),
    oem_name: text('oem_name'),
    products: jsonb('products'),
    expected_delivery_date: timestamp('expected_delivery_date'),
    status: varchar('status', { length: 20 }).default('pending'),
    created_by: uuid('created_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable('orders', {
    id: varchar('id', { length: 255 }).primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id),
    products: jsonb('products'),
    total_amount: numeric('total_amount', { precision: 12, scale: 2 }),
    status: varchar('status', { length: 20 }).default('pending'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const deals = pgTable('deals', {
    id: varchar('id', { length: 255 }).primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id).notNull(),
    products: jsonb('products').notNull(),
    line_total: numeric('line_total', { precision: 12, scale: 2 }).notNull(),
    gst_amount: numeric('gst_amount', { precision: 12, scale: 2 }).notNull(),
    transportation_cost: numeric('transportation_cost', { precision: 12, scale: 2 }).default('0').notNull(),
    transportation_gst_percent: integer('transportation_gst_percent').default(18).notNull(),
    total_payable: numeric('total_payable', { precision: 12, scale: 2 }).notNull(),
    deal_status: varchar('deal_status', { length: 50 }).notNull(),
    payment_term: varchar('payment_term', { length: 20 }).notNull(),
    credit_period_months: integer('credit_period_months'),
    is_immutable: boolean('is_immutable').default(false).notNull(),
    created_by: uuid('created_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const approvals = pgTable('approvals', {
    id: varchar('id', { length: 255 }).primaryKey(),
    entity_type: varchar('entity_type', { length: 50 }).notNull(),
    entity_id: varchar('entity_id', { length: 255 }).notNull(),
    level: integer('level').notNull(),
    approver_role: varchar('approver_role', { length: 50 }).notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    approver_id: uuid('approver_id').references(() => users.id),
    decision_at: timestamp('decision_at'),
    rejection_reason: text('rejection_reason'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const kycVerifications = pgTable('kyc_verifications', {
    id: varchar('id', { length: 255 }).primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id, { onDelete: 'cascade' }).notNull(),
    verification_type: varchar('verification_type', { length: 50 }).notNull(), // aadhaar, pan, bank, rc, etc.
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    api_response: jsonb('api_response'),
    failed_reason: text('failed_reason'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const couponCodes = pgTable('coupon_codes', {
    id: varchar('id', { length: 255 }).primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    discount_type: varchar('discount_type', { length: 20 }).notNull(), // percentage, fixed
    discount_value: numeric('discount_value', { precision: 12, scale: 2 }),
    max_discount_cap: numeric('max_discount_cap', { precision: 12, scale: 2 }),
    min_amount: numeric('min_amount', { precision: 12, scale: 2 }),
    status: varchar('status', { length: 20 }).default('available'),
    expires_at: timestamp('expires_at', { withTimezone: true }),
    used_by_lead_id: varchar('used_by_lead_id', { length: 255 }).references(() => leads.id),
    used_by: uuid('used_by').references(() => users.id),
    validated_at: timestamp('validated_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const facilitationPayments = pgTable('facilitation_payments', {
    id: varchar('id', { length: 255 }).primaryKey(),
    lead_id: varchar('lead_id', { length: 255 }).references(() => leads.id, { onDelete: 'cascade' }).notNull(),
    payment_method: varchar('payment_method', { length: 50 }),
    facilitation_fee_base_amount: varchar('facilitation_fee_base_amount', { length: 50 }),
    coupon_code: varchar('coupon_code', { length: 50 }),
    coupon_id: varchar('coupon_id', { length: 255 }).references(() => couponCodes.id),
    coupon_discount_type: varchar('coupon_discount_type', { length: 20 }),
    coupon_discount_value: varchar('coupon_discount_value', { length: 50 }),
    coupon_discount_amount: varchar('coupon_discount_amount', { length: 50 }),
    facilitation_fee_final_amount: varchar('facilitation_fee_final_amount', { length: 50 }),
    
    razorpay_qr_id: varchar('razorpay_qr_id', { length: 255 }),
    razorpay_qr_status: varchar('razorpay_qr_status', { length: 50 }),
    razorpay_qr_image_url: text('razorpay_qr_image_url'),
    razorpay_qr_short_url: text('razorpay_qr_short_url'),
    razorpay_qr_expires_at: timestamp('razorpay_qr_expires_at', { withTimezone: true }),
    
    facilitation_fee_status: varchar('facilitation_fee_status', { length: 50 }), // e.g., PAID, QR_GENERATED, EXPIRED
    
    utr_number_manual: varchar('utr_number_manual', { length: 100 }),
    payment_screenshot_url: text('payment_screenshot_url'),
    
    razorpay_payment_id: varchar('razorpay_payment_id', { length: 255 }),
    razorpay_payment_status: varchar('razorpay_payment_status', { length: 50 }),
    payment_paid_at: timestamp('payment_paid_at', { withTimezone: true }),
    payment_verified_at: timestamp('payment_verified_at', { withTimezone: true }),
    payment_verification_source: varchar('payment_verification_source', { length: 50 }), // e.g., webhook, poll, manual
    
    created_by: uuid('created_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
    leadsUploaded: many(leads),
    assignments: many(leadAssignments),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
    uploader: one(users, { fields: [leads.uploader_id], references: [users.id] }),
    dealer: one(accounts, { fields: [leads.dealer_id], references: [accounts.id] }),
    consentRecords: many(consentRecords),
    manualAudits: many(manualConsentAudits),
    kycDocuments: many(kycDocuments),
    coBorrowerDocuments: many(coBorrowerDocuments),
    assignments: many(leadAssignments),
    inventory: many(inventory),
    orders: many(orders),
    provisions: many(provisions),
    deals: many(deals),
    facilitationPayments: many(facilitationPayments),
    verifications: many(kycVerifications),
}));

export const accountRelations = relations(accounts, ({ many }) => ({
    leads: many(leads),
}));

export const consentRecordsRelations = relations(consentRecords, ({ one }) => ({
    lead: one(leads, { fields: [consentRecords.lead_id], references: [leads.id] }),
}));

export const manualConsentAuditsRelations = relations(manualConsentAudits, ({ one }) => ({
    lead: one(leads, { fields: [manualConsentAudits.lead_id], references: [leads.id] }),
    consentRecord: one(consentRecords, { fields: [manualConsentAudits.consent_record_id], references: [consentRecords.id] }),
    uploader: one(users, { fields: [manualConsentAudits.uploaded_by], references: [users.id] }),
    reviewer: one(users, { fields: [manualConsentAudits.reviewed_by], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
    performer: one(users, { fields: [auditLogs.performed_by], references: [users.id] }),
}));

export const slasRelations = relations(slas, ({ one }) => ({
    assignee: one(users, { fields: [slas.assigned_to], references: [users.id] }),
    escalator: one(users, { fields: [slas.escalated_to], references: [users.id] }),
}));