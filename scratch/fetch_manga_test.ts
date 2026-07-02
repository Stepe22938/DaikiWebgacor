import { Agent, setGlobalDispatcher } from "undici";
import dns from "dns";

const resolveDoh = async (hostname: string): Promise<string | null> => {
  try {
    if (hostname.includes("cloudflare-dns.com")) return null;
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: { "accept": "application/dns-json" }
    });
    if (res.ok) {
      const data: any = await res.json();
      if (data.Answer && data.Answer.length > 0) {
        const aRecord = data.Answer.find((ans: any) => ans.type === 1);
        if (aRecord && aRecord.data) return aRecord.data;
      }
    }
  } catch {}
  return null;
};

const customDnsAgent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      resolveDoh(hostname).then((ip) => {
        if (ip) return callback(null, ip, 4);
        dns.lookup(hostname, options, (lookupErr, address, family) => {
          callback(lookupErr, address, family);
        });
      });
    }
  }
});

setGlobalDispatcher(customDnsAgent);

async function run() {
  const query = "Na Honjaman Level-Up";
  console.log(`Searching for: ${query}`);
  const res = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=5`);
  const data: any = await res.json();
  console.log("Search results:", data.data.map((m: any) => ({ id: m.id, title: m.attributes.title })));

  if (data.data.length > 0) {
    const id = data.data[0].id;
    console.log(`Fetching feed for ID: ${id}`);
    const feedRes = await fetch(`https://api.mangadex.org/manga/${id}/feed?limit=100`);
    const feedData: any = await feedRes.json();
    console.log("Feed items (first 20):", feedData.data.slice(0, 20).map((c: any) => ({
      chapter: c.attributes.chapter,
      lang: c.attributes.translatedLanguage,
      pages: c.attributes.pages,
      external: c.attributes.externalUrl
    })));
  }
}

run().catch(console.error);
