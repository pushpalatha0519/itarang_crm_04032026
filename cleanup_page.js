const fs = require('fs');
const filepath = 'c:\\\\Users\\\\DELL\\\\itarang_crm_04032026\\\\src\\\\app\\\\(dashboard)\\\\dealer-portal\\\\leads\\\\[id]\\\\kyc\\\\page.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// Remove Sub-Components
const documentCardStart = content.indexOf('function DocumentCard(');
if (documentCardStart !== -1) {
    content = content.substring(0, documentCardStart);
}

// Remove unused state variables
content = content.replace(/\\/\\/ ── Payment State ──[\\s\\S]*?\\/\\/ ── Load Data ────────────────────────────────────────────────────────────/m, '// ── Load Data ────────────────────────────────────────────────────────────');

// Add back submit and paymentMethod states which were removed above
const statesToAdd = `    // Core
    const [loading, setLoading] = useState(true);
    const [lead, setLead] = useState<any>(null);
    const [accessDenied, setAccessDenied] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    // Payment method (determined from lead)
    const [paymentMethod, setPaymentMethod] = useState<string>('finance');
    const isFinance = ['finance', 'other_finance', 'dealer_finance'].includes(paymentMethod);

    const [consentStatus, setConsentStatus] = useState<string>('awaiting_signature');
    const [submitting, setSubmitting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    // ── Load Data ────────────────────────────────────────────────────────────`;

content = content.replace(/\\/\\/ Core[\\s\\S]*?\\/\\/ ── Load Data ────────────────────────────────────────────────────────────/m, statesToAdd);

// Simplify Load Data API calls
const loadDataRegex = /const loadData = async \\(\\) => \\{[\\s\\S]*?\\};/m;
const simplerLoadData = `const loadData = async () => {
            try {
                const res = await fetch(\`/api/kyc/\${leadId}/access-check\`);
                const data = await res.json();
                if (!data.success || !data.allowed) { setAccessDenied(true); return; }

                setLead(data.lead);
                if (data.lead.payment_method) setPaymentMethod(data.lead.payment_method);
                if (data.lead.consent_status) setConsentStatus(data.lead.consent_status);
            } catch { setApiError('Failed to load KYC data'); }
            finally { setLoading(false); }
        };`;
        
content = content.replace(loadDataRegex, simplerLoadData);

// Remove unused useEffects (polling and auto-save)
content = content.replace(/\\/\\/ ── Payment polling[\\s\\S]*?\\/\\/ ── Helpers ──────────────────────────────────────────────────────────────/m, '// ── Helpers ──────────────────────────────────────────────────────────────');

// Remove helpers
content = content.replace(/\\/\\/ ── Helpers ──────────────────────────────────────────────────────────────[\\s\\S]*?\\/\\/ ── Consent ──────────────────────────────────────────────────────────────/m, '// ── Consent ──────────────────────────────────────────────────────────────');

// Remove unused Types and Constants at the top
content = content.replace(/\\/\\/ ── Constants ────────────────────────────────────────────────────────────────[\\s\\S]*?\\/\\/ ── Main Page ────────────────────────────────────────────────────────────────/m, '// ── Main Page ────────────────────────────────────────────────────────────────');

fs.writeFileSync(filepath, content);
console.log('Cleanup Done!');
