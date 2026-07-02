import { Agent, setGlobalDispatcher } from 'undici';
import dns from 'node:dns/promises';

console.log("Undici imports successful!");

dns.setServers(["1.1.1.1", "1.0.0.1", "8.8.8.8"]);

const agent = new Agent({
  connect: {
    lookup: async (hostname, options, callback) => {
      try {
        console.log(`Resolving: ${hostname}`);
        const addresses = await dns.resolve4(hostname);
        if (addresses && addresses.length > 0) {
          console.log(`Resolved ${hostname} to ${addresses[0]}`);
          return callback(null, addresses[0], 4);
        }
        const { address, family } = await dns.lookup(hostname, options);
        callback(null, address, family);
      } catch (err) {
        callback(err);
      }
    }
  }
});

setGlobalDispatcher(agent);

try {
  const res = await fetch("https://api.mangadex.org/manga?title=Jujutsu%20Kaisen&limit=1");
  console.log("Fetch status:", res.status);
  const data = await res.json();
  console.log("Successfully fetched JJK! Results length:", data.data?.length);
} catch (e) {
  console.error("Fetch failed:", e);
}
