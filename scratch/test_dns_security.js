async function checkDnsBlock(domain) {
  try {
    const res = await fetch(`https://family.cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { "accept": "application/dns-json" },
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const data = await res.json();
      const isBlocked = data.Answer?.some(ans => ans.data === "0.0.0.0" || ans.data === "::");
      if (isBlocked) {
        return { blocked: true, reason: "Cloudflare Family DNS flagged/blocked this domain" };
      }
    }
  } catch (err) {
    console.error(`DNS check error:`, err.message);
  }
  return { blocked: false };
}

async function checkUrlscan(domain) {
  try {
    const res = await fetch(`https://urlscan.io/api/v1/search/?q=domain:${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const first = data.results[0];
        return {
          domainAgeDays: first.page?.domainAgeDays || first.page?.apexDomainAgeDays,
          title: first.page?.title,
          server: first.page?.server,
          status: first.page?.status,
        };
      }
    }
  } catch (err) {
    console.error(`Urlscan check error:`, err.message);
  }
  return null;
}

async function fetchPageMeta(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });

    const finalUrl = response.url;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return { finalUrl, contentType };
    }

    const text = await response.text();
    const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    const descMatch = text.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ||
                      text.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i);
    const description = descMatch ? descMatch[1].trim() : undefined;

    return { title, description, finalUrl };
  } catch (err) {
    return { error: err.message };
  }
}

async function analyzeUrl(url) {
  try {
    let cleanUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      cleanUrl = "https://" + url;
    }
    const hostname = new URL(cleanUrl).hostname.toLowerCase();
    
    console.log(`Analyzing: ${url} (hostname: ${hostname})`);
    
    const dnsStatus = await checkDnsBlock(hostname);
    const urlscan = await checkUrlscan(hostname);
    const meta = await fetchPageMeta(cleanUrl);

    console.log("Analysis Report:", JSON.stringify({
      url,
      domain: hostname,
      dnsStatus,
      urlscan,
      meta
    }, null, 2));
  } catch (err) {
    console.error(`Failed to analyze:`, err.message);
  }
}

async function run() {
  await analyzeUrl("https://youtube.com");
  await analyzeUrl("https://xvideos.com");
}

run();
