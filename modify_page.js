const fs = require('fs');
const filepath = 'c:\\\\Users\\\\DELL\\\\itarang_crm_04032026\\\\src\\\\app\\\\(dashboard)\\\\dealer-portal\\\\leads\\\\[id]\\\\kyc\\\\page.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// 1. handleSaveAndNext
const replace1 = `const stats = getDocStats();
        if (stats.uploaded < stats.total) { setApiError(\`Missing: \${stats.pending.map(d => d.label).join(', ')}\`); return; }
        if (!['digitally_signed', 'manual_uploaded', 'verified'].includes(consentStatus)) {
            setApiError('Customer consent is required'); return;
        }
        const failedVer = verifications.filter(v => v.status === 'failed');
        if (failedVer.length > 0) { setApiError(\`Verification failures: \${failedVer.map(v => v.label).join(', ')}\`); return; }`;

const replaceWith1 = `if (!['digitally_signed', 'manual_uploaded', 'verified'].includes(consentStatus)) {
            setApiError('Customer consent is required'); return;
        }`;
content = content.replace(replace1, replaceWith1);

// 2. Modify handleSaveAndNext disabled state (remove docStats.uploaded < docStats.total)
const replace2 = `disabled={submitting || docStats.uploaded < docStats.total || (isFinance && !feePaid)}`;
const replaceWith2 = `disabled={submitting}`;
content = content.replace(replace2, replaceWith2);

// 3. Sub-Progress bar modifying
const replace3 = `{ label: 'Payment', done: !isFinance || feePaid, active: isFinance && !feePaid },
                        { label: 'Documents', done: docStats.uploaded === docStats.total, active: (!isFinance || feePaid) && docStats.uploaded < docStats.total },
                        { label: 'Verification', done: verifications.some(v => v.status === 'success'), active: docStats.uploaded === docStats.total && !verifications.some(v => v.status === 'success') },
                        { label: 'Consent', done: ['digitally_signed', 'manual_uploaded', 'verified'].includes(consentStatus), active: false },
                        { label: 'Review', done: false, active: false },`;

const replaceWith3 = `{ label: 'Consent', done: ['digitally_signed', 'manual_uploaded', 'verified'].includes(consentStatus), active: !['digitally_signed', 'manual_uploaded', 'verified'].includes(consentStatus) },
                        { label: 'Review', done: false, active: false },`;
content = content.replace(replace3, replaceWith3);

// 4. Remove Submit Verification button
const replace4 = `{!verificationSubmitted && (
                                <button onClick={handleSubmitVerification}
                                    disabled={submitting || docStats.uploaded < docStats.total || (isFinance && !feePaid)}
                                    className="px-6 py-2.5 border-2 border-[#0047AB] text-[#0047AB] rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-blue-50 flex items-center gap-2">
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                                    Submit Verification
                                </button>
                            )}`;
content = content.replace(replace4, '');

// 5. Replace everything in <main> with JUST Section 6
const mainStartStr = '<main className="grid grid-cols-1 gap-6">';
const mainEndStr = '</main>';
const mainStart = content.indexOf(mainStartStr);
const mainEnd = content.indexOf(mainEndStr, mainStart);

if (mainStart !== -1 && mainEnd !== -1) {
    const mainContent = content.substring(mainStart + mainStartStr.length, mainEnd);
    const section6StartStr = '{/* ═══════════════════════════════════════════════════════════\\n                        SECTION 6: CUSTOMER CONSENT\\n                       ═══════════════════════════════════════════════════════════ */}';
    const sectioncardEnd = '</SectionCard>';
    
    // Instead of exact string match since whitespaces might vary, use substring logic:
    const sectionTitleIdx = content.indexOf('title="Customer Consent"');
    if (sectionTitleIdx !== -1) {
        // find previous SectionCard comment
        const commentPrefix = 'SECTION 6: CUSTOMER CONSENT';
        const sec6CommentIdx = content.lastIndexOf(commentPrefix, sectionTitleIdx);
        // Step back to the start of the comment block
        const startIdx = content.lastIndexOf('{/*', sec6CommentIdx);
        
        // Find closing SectionCard
        const endIdx = content.indexOf(sectioncardEnd, sectionTitleIdx);
        
        if (startIdx !== -1 && endIdx !== -1) {
            const section6Content = content.substring(startIdx, endIdx + sectioncardEnd.length);
            
            // Reconstruct content
            content = content.substring(0, mainStart + mainStartStr.length) +
                      '\\n\\n                    ' + section6Content + '\\n\\n                ' +
                      content.substring(mainEnd);
        } else {
             console.log("Could not find start/end of section6");
        }
    } else {
         console.log("Could not find title=Customer Consent");
    }
} else {
    console.log("Could not find main element");
}

fs.writeFileSync(filepath, content);
console.log('Done!');
