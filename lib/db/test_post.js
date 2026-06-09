const payload = {
  realmName: "Daiki Web Gacor Test",
  realmLogoUrl: "",
  heroTitle: "Arcadia Studio",
  heroSubtitle: "Studio Made A Minecraft Roleplay",
  serverIP: "None",
  mcVersion: "none",
  specsCpu: "none",
  specsMemory: "none",
  specsStorage: "none",
  specsLocation: "none"
};

async function test() {
  try {
    const res = await fetch("http://localhost:5000/api/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    console.log("STATUS:", res.status);
    const body = await res.json();
    console.log("RESPONSE BODY:", JSON.stringify(body, null, 2));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

test();
