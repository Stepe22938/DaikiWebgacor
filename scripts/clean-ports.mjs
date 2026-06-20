import { execSync } from "node:child_process";

function killPortProcess(port) {
  try {
    let stdout;
    if (process.platform === "win32") {
      stdout = execSync(`netstat -ano | findstr :${port}`, { stdio: ["pipe", "pipe", "ignore"] }).toString();
      const lines = stdout.split("\n");
      for (const line of lines) {
        if (line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== "0") {
            console.log(`[Port-Clean] Port ${port} is in use by PID ${pid}. Killing it...`);
            execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
          }
        }
      }
    } else {
      stdout = execSync(`lsof -t -i:${port}`, { stdio: ["pipe", "pipe", "ignore"] }).toString();
      const pids = stdout.split("\n").filter(Boolean);
      for (const pid of pids) {
        console.log(`[Port-Clean] Port ${port} is in use by PID ${pid}. Killing it...`);
        execSync(`kill -9 ${pid}`, { stdio: "ignore" });
      }
    }
  } catch (err) {
    // Port not in use
  }
}

killPortProcess(5000);
killPortProcess(5173);
