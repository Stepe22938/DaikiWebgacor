require('dotenv').config();
const postgres = require('postgres');

const client = postgres(process.env.DATABASE_URL);

async function main() {
  try {
    // Check current value
    const rows = await client`SELECT key, value FROM system_settings WHERE key = 'gacha_settings'`;
    if (rows.length === 0) {
      console.log('No gacha_settings row found in DB. Defaults will be used (duplicateRefund=5 is already set in code).');
    } else {
      const current = rows[0].value;
      console.log('Current gacha_settings:', JSON.stringify(current, null, 2));
      
      // Patch duplicateRefund to 5
      const patched = { ...current, duplicateRefund: 5 };
      await client`UPDATE system_settings SET value = ${JSON.stringify(patched)}::jsonb WHERE key = 'gacha_settings'`;
      console.log('SUCCESS: duplicateRefund updated to 5 in database!');
      console.log('New gacha_settings:', JSON.stringify(patched, null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
