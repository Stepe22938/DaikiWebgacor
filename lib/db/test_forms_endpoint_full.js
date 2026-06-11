import { db } from './src/index.ts';
import { eq, desc, asc, count, sql } from 'drizzle-orm';
import { formsTable, formFieldsTable, pollOptionsTable, formResponsesTable, usersTable } from './src/schema/index.ts';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('../../.env');
const env = fs.readFileSync(envPath, 'utf8');
const match = env.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
const connectionString = match ? match[1] : null;

if (!connectionString) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

process.env.DATABASE_URL = connectionString;

async function buildFormDetail(formId) {
  const form = await db.query.formsTable.findFirst({ where: eq(formsTable.id, formId) });
  if (!form) return null;

  const fields = await db
    .select()
    .from(formFieldsTable)
    .where(eq(formFieldsTable.formId, formId))
    .orderBy(asc(formFieldsTable.order));

  return {
    form,
    fields
  };
}

async function run() {
  try {
    const rows = await db.select().from(formsTable).where(eq(formsTable.status, "open")).orderBy(desc(formsTable.createdAt));
    console.log("LIST FORMS FROM DRIZZLE:");
    console.log(JSON.stringify(rows, null, 2));

    const detail = await buildFormDetail(4);
    console.log("FORM 4 DETAIL FROM DRIZZLE:");
    console.log(JSON.stringify(detail, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

run();
