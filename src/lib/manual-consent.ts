import fs from 'fs';
import path from 'path';

export function generateManualConsentId(prefix: string) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${dateStr}-${seq}`;
}

export function ensurePublicTmpDir() {
    const tmpDir = path.join(process.cwd(), 'public', 'tmp');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
}

export function cleanupExpiredManualConsentPreviews() {
    const tmpDir = ensurePublicTmpDir();
    const files = fs.readdirSync(tmpDir);
    const now = Date.now();
    const maxAgeMs = 24 * 60 * 60 * 1000;

    for (const file of files) {
        if (!file.startsWith('consent_preview_') || !file.endsWith('.pdf')) continue;

        const fullPath = path.join(tmpDir, file);
        try {
            const stat = fs.statSync(fullPath);
            if (now - stat.mtimeMs > maxAgeMs) {
                fs.unlinkSync(fullPath);
            }
        } catch (error) {
            console.error('[Manual Consent Cleanup] Failed for:', fullPath, error);
        }
    }
}

export function isPdfBuffer(buffer: Buffer) {
    if (buffer.length < 4) return false;
    return buffer.slice(0, 4).toString() === '%PDF';
}

export async function extractPdfMetadata(buffer: Buffer) {
    try {
        const pdfParse = await import('pdf-parse');
        const parsed = await pdfParse.default(buffer);
        return {
            pageCount: parsed.numpages ?? null,
            info: parsed.info ?? null,
            version: parsed.version ?? null,
            textLength: parsed.text?.length ?? 0,
        };
    } catch {
        return {
            pageCount: null,
            info: null,
            version: null,
            textLength: null,
        };
    }
}

export async function runVirusScan(_buffer: Buffer) {
    // Safe placeholder.
    // Later connect real ClamAV here.
    return {
        scanned: true,
        infected: false,
        engine: 'placeholder',
    };
}

export async function runOptionalConsentOcrChecks(buffer: Buffer) {
    // Safe placeholder for now.
    // Later you can connect OCR / image signature detection here.
    const meta = await extractPdfMetadata(buffer);

    return {
        signatureDetected: 'unknown',
        thumbImpressionDetected: 'unknown',
        witnessSignatureDetected: 'unknown',
        checkboxDetected: 'unknown',
        pageCount: meta.pageCount,
        needsQualityReview: true,
    };
}