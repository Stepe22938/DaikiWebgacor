import { Agent, setGlobalDispatcher } from "undici";
import dns from "dns";
import net from "net";

const resolveDoh = async (hostname) => {
  if (net.isIP(hostname)) return hostname;
  try {
    const url = `https://1.1.1.1/dns-query?name=${encodeURIComponent(hostname)}&type=A`;
    const res = await fetch(url, { headers: { "accept": "application/dns-json" } });
    if (res.ok) {
      const data = await res.json();
      const aRecord = data.Answer?.find((ans) => ans.type === 1);
      if (aRecord?.data) return aRecord.data;
    }
  } catch (e) { }
  return null;
};

const customDnsAgent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      if (net.isIP(hostname)) {
        const fam = net.isIPv6(hostname) ? 6 : 4;
        return callback(null, options.all ? [{ address: hostname, family: fam }] : hostname, fam);
      }
      resolveDoh(hostname).then((ip) => {
        if (ip) return callback(null, options.all ? [{ address: ip, family: 4 }] : ip, 4);
        dns.lookup(hostname, options, (lookupErr, address, family) => callback(lookupErr, address, family));
      });
    }
  }
});

setGlobalDispatcher(customDnsAgent);

async function testFeed(id, label) {
  console.log(`\n=== ${label} (${id}) ===`);
  
  // No lang filter - show total 
  const r = await fetch(`https://api.mangadex.org/manga/${id}/feed?limit=100&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`);
  const d = await r.json();
  if (!d.data) { console.log("Error:", JSON.stringify(d)); return; }

  const langs = [...new Set(d.data.map(c => c.attributes.translatedLanguage))];
  console.log("Total chapters fetched (limit 100):", d.data.length, "| Total in API:", d.total);
  console.log("Languages in this page:", langs);

  const sample = d.data.slice(0, 5).map(c => ({
    ch: c.attributes.chapter,
    lang: c.attributes.translatedLanguage,
    pages: c.attributes.pages,
    ext: c.attributes.externalUrl ? c.attributes.externalUrl.substring(0, 40) : null
  }));
  console.log("Sample:", sample);
}

async function run() {
  // My Dress-Up Darling  
  await testFeed("aa6c76f7-5f5f-46b6-a800-911145f81b9b", "My Dress-Up Darling");
  // Solo Leveling
  await testFeed("32d76d19-8a05-4db0-9fc2-e0b0648fe9d0", "Na Honjaman Level-Up (Solo Leveling)");
}

run().catch(console.error);
