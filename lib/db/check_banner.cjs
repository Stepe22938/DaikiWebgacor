const { Client } = require("./node_modules/pg");
async function main() {
  const c = new Client("postgresql://daiki:phantomichostjaya@185.128.227.237:5433/daikiweb");
  await c.connect();
  const r = await c.query("SELECT id, name, icon_url, banner_url, description FROM conversations WHERE type = 'group' LIMIT 5");
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
