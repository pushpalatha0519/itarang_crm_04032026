import crypto from 'crypto';

export function generateConsentId() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `CL-${date}-${random}`;
}

export function generateConsentToken() {
    return crypto.randomBytes(32).toString('hex');
}

export function getConsentExpiry() {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    return expiry;
}
