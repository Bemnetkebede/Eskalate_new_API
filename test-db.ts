import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

async function testConnection() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        console.log('Connecting to:', process.env.DATABASE_URL);
        await client.connect();
        console.log('✅ Connection successful!');
        const res = await client.query('SELECT datname FROM pg_database');
        console.log('Databases:', res.rows.map(r => r.datname).join(', '));
        await client.end();
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
    }
}

testConnection();
