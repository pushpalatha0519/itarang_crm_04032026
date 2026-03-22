import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
}

async function testInsert() {
    const sql = postgres(connectionString, {
        ssl: 'require',
        prepare: false,
    });

    try {
        const leadId = 'TEST-LEAD-' + Date.now();
        console.log(`Testing insert for leadId: ${leadId}`);

        await sql.begin(async (tx) => {
            console.log('Inserting into leads...');
            await tx`
                INSERT INTO leads (id, reference_id, owner_name, owner_contact, status, uploader_id)
                VALUES (${leadId}, ${'REF-'+leadId}, 'TEST', '1234567890', 'INCOMPLETE', '16386c4d-990d-4032-b078-d3a542c6b798')
            `;

            console.log('Inserting into personal_details...');
            await tx`
                INSERT INTO personal_details (id, lead_id, dob, father_husband_name)
                VALUES (${crypto.randomUUID()}, ${leadId}, NULL, NULL)
            `;
        });

        console.log('Test completed successfully!');

    } catch (error) {
        console.error('Test failed with error:', error);
    } finally {
        await sql.end();
    }
}

testInsert();
