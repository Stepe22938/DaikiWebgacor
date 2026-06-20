import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Inject global fetch interceptor to support mock switch-account-clerk-id header across all fetch requests
if (typeof window !== "undefined") {
  // Eagerly clear blocked mock IDs on load
  if (typeof localStorage !== "undefined") {
    const switchClerkId = localStorage.getItem("switch_clerk_id");
    if (switchClerkId && ["local_dev_user", "localdev"].includes(switchClerkId.trim().toLowerCase())) {
      localStorage.removeItem("switch_clerk_id");
    }
  }

  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    let isApiCall = false;
    let url = "";
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.pathname;
    } else if (input && typeof input === "object" && "url" in input) {
      url = (input as any).url;
    }

    isApiCall = url.startsWith("/api") || url.includes("/api/");

    if (isApiCall && typeof localStorage !== "undefined") {
      const switchClerkId = localStorage.getItem("switch_clerk_id");
      if (switchClerkId && switchClerkId.trim()) {
        const blockedIds = new Set(["local_dev_user", "localdev"]);
        if (blockedIds.has(switchClerkId.trim().toLowerCase())) {
          localStorage.removeItem("switch_clerk_id");
        } else {
          if (input && typeof input === "object" && "headers" in input && typeof (input as any).clone === "function") {
            const newRequest = (input as any).clone();
            newRequest.headers.set("x-switch-clerk-id", switchClerkId.trim());
            return originalFetch.call(this, newRequest, init);
          } else {
            init = init || {};
            const headers = new Headers(init.headers || {});
            if (!headers.has("x-switch-clerk-id")) {
              headers.set("x-switch-clerk-id", switchClerkId.trim());
              init.headers = headers;
            }
          }
        }
      }
    }
    return originalFetch.call(this, input, init);
  };
}

createRoot(document.getElementById("root")!).render(<App />);
