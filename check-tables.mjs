import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
}

const tables = [
    'consent_records',
    'manual_consent_audits', 
    'leads',
    'facilitation_payments',
    'kyc_verifications',
    'coupon_codes',
    'ai_call_logs',
    'assignment_change_logs',
];

async function inspect() {
    const sql = postgres(connectionString, {
        ssl: 'require',
        prepare: false,
    });

    try {
        for (const tableName of tables) {
            const rows = await sql`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = ${tableName}
                ORDER BY ordinal_position
            `;
            if (rows.length === 0) {
                console.log(`\n❌ TABLE "${tableName}" DOES NOT EXIST`);
            } else {
                const cols = rows.map(r => r.column_name).join(', ');
                console.log(`\n✓ TABLE "${tableName}" — columns: ${cols}`);
            }
        }
    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        await sql.end();
    }
}

inspect();
