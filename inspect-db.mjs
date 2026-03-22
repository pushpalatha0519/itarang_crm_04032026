import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
}

async function inspect() {
    const sql = postgres(connectionString, {
        ssl: 'require',
        prepare: false,
    });

    try {
        console.log('Inspecting "kyc_documents" columns...');
        const columns = await sql`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'kyc_documents'
        `;
        
        columns.forEach(col => {
            console.log(`- ${col.column_name}: type=${col.data_type}, nullable=${col.is_nullable}`);
        });

    } catch (error) {
        console.error('Inspection failed:', error);
    } finally {
        await sql.end();
    }
}

inspect();
