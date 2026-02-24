import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};

async function validate() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        console.error(`${colors.red}${colors.bright}Error: DATABASE_URL not found in environment.${colors.reset}`);
        process.exit(1);
    }

    const client = new Client({
        connectionString: connectionString.trim().replace(/^"|"$/g, ''),
        ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false
    });

    console.log(`${colors.cyan}${colors.bright}=== News API Database Validation ===${colors.reset}\n`);

    try {
        await client.connect();
        console.log(`${colors.green}✔ Database connection established.${colors.reset}`);

        let hasErrors = false;

        // 1. Check Tables
        const requiredTables = ['User', 'Article', 'ReadLog', 'DailyAnalytics'];
        const { rows: tableRows } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        const tablesInDb = tableRows.map(r => r.table_name);

        console.log(`\n${colors.bright}1. Table Verification:${colors.reset}`);
        for (const table of requiredTables) {
            if (tablesInDb.includes(table)) {
                console.log(`  ${colors.green}✔ Table '${table}' exists.${colors.reset}`);
            } else {
                console.log(`  ${colors.red}✘ Table '${table}' is missing.${colors.reset}`);
                hasErrors = true;
            }
        }

        // 2. UUID Check
        console.log(`\n${colors.bright}2. UUID Verification:${colors.reset}`);
        const { rows: extRows } = await client.query(`SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp'`);
        if (extRows.length > 0) {
            console.log(`  ${colors.green}✔ uuid-ossp extension is enabled.${colors.reset}`);
        } else {
            console.log(`  ${colors.yellow}⚠ uuid-ossp extension is not enabled (news_api might be using postgres 13+ built-in gen_random_uuid).${colors.reset}`);
        }

        const { rows: idCols } = await client.query(`
      SELECT table_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE column_name = 'id' AND table_schema = 'public'
    `);
        for (const table of requiredTables) {
            const col = idCols.find(r => r.table_name === table);
            if (col && (col.data_type === 'uuid' || col.udt_name === 'uuid')) {
                console.log(`  ${colors.green}✔ '${table}.id' is UUID.${colors.reset}`);
            } else if (col) {
                console.log(`  ${colors.red}✘ '${table}.id' is NOT UUID (Actual: ${col.data_type}/${col.udt_name}).${colors.reset}`);
                hasErrors = true;
            }
        }

        // 3. Enums
        console.log(`\n${colors.bright}3. Enum Verification:${colors.reset}`);
        const { rows: enumRows } = await client.query(`
      SELECT t.typname as enum_name, e.enumlabel as enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
    `);
        const enums: Record<string, string[]> = {};
        for (const row of enumRows) {
            const name = row.enum_name;
            const value = row.enum_value;
            const current = enums[name] ?? [];
            current.push(value);
            enums[name] = current;
        }

        const requiredEnums = {
            'Role': ['AUTHOR', 'READER'],
            'Status': ['DRAFT', 'PUBLISHED']
        };
        for (const [name, values] of Object.entries(requiredEnums)) {
            if (enums[name]) {
                const match = values.every(v => enums[name]?.includes(v));
                if (match) {
                    console.log(`  ${colors.green}✔ Enum '${name}' matches [${values.join(', ')}].${colors.reset}`);
                } else {
                    console.log(`  ${colors.yellow}⚠ Enum '${name}' mismatch. Expected [${values.join(', ')}], found [${enums[name]?.join(', ')}].${colors.reset}`);
                }
            } else {
                console.log(`  ${colors.red}✘ Enum '${name}' is missing.${colors.reset}`);
                hasErrors = true;
            }
        }

        // 4. Constraints
        console.log(`\n${colors.bright}4. Constraint Verification:${colors.reset}`);
        const { rows: constraints } = await client.query(`
      SELECT conname as name, contype as type, pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public'
    `);

        const hasConstraint = (pattern: RegExp, description: string) => {
            const found = constraints.some(c => pattern.test(c.name) || pattern.test(c.definition));
            if (found) {
                console.log(`  ${colors.green}✔ ${description}.${colors.reset}`);
            } else {
                console.log(`  ${colors.red}✘ ${description} is MISSING.${colors.reset}`);
                // Many of these are Zod-only by default in Prisma unless custom SQL is used
                // We report them as missing if they aren't in the DB.
            }
        };

        hasConstraint(/User_email_key|UNIQUE.*email/, "User email UNIQUE");
        hasConstraint(/DailyAnalytics_articleId_date_key|UNIQUE.*articleId.*date/, "DailyAnalytics (articleId, date) UNIQUE");
        hasConstraint(/CHECK.*name.*[a-zA-Z]/, "User name Alpha-only CHECK (SQL)");
        hasConstraint(/CHECK.*length.*title/, "Article title length CHECK (SQL)");
        hasConstraint(/CHECK.*length.*content/, "Article content min-length CHECK (SQL)");

        // 5. Foreign Keys
        console.log(`\n${colors.bright}5. Foreign Key Verification:${colors.reset}`);
        const fkChecks = [
            { from: 'Article', to: 'User', col: 'authorId' },
            { from: 'ReadLog', to: 'Article', col: 'articleId' },
            { from: 'DailyAnalytics', to: 'Article', col: 'articleId' }
        ];
        for (const fk of fkChecks) {
            const found = constraints.some(c => c.type === 'f' && c.definition.includes(fk.from) && c.definition.includes(fk.col));
            if (found) {
                console.log(`  ${colors.green}✔ FK: ${fk.from}(${fk.col}) -> ${fk.to}.${colors.reset}`);
            } else {
                console.log(`  ${colors.red}✘ Missing FK: ${fk.from}(${fk.col}) -> ${fk.to}.${colors.reset}`);
                hasErrors = true;
            }
        }

        // 6. Indexes
        console.log(`\n${colors.bright}6. Index Verification:${colors.reset}`);
        const { rows: indexRows } = await client.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'
    `);
        const checkIndex = (table: string, col: string) => {
            const found = indexRows.some(idx => idx.indexdef.includes(table) && idx.indexdef.includes(col));
            if (found) {
                console.log(`  ${colors.green}✔ Index on ${table}.${col} exists.${colors.reset}`);
            } else {
                console.log(`  ${colors.yellow}⚠ Index on ${table}.${col} missing.${colors.reset}`);
            }
        };
        checkIndex('Article', 'authorId');
        checkIndex('ReadLog', 'articleId');
        checkIndex('DailyAnalytics', 'date');

        console.log(`\n${colors.cyan}${colors.bright}=== Validation Summary ===${colors.reset}`);
        if (hasErrors) {
            console.log(`${colors.red}${colors.bright}FAILURE: One or more critical database requirements are missing.${colors.reset}`);
        } else {
            console.log(`${colors.green}${colors.bright}SUCCESS: Database schema matches core requirements!${colors.reset}`);
        }

    } catch (error: any) {
        console.error(`\n${colors.red}${colors.bright}Validation Failed with Error:${colors.reset}`);
        console.error(error.message);
    } finally {
        await client.end();
    }
}

validate();
