import fs from "fs";
import path from "path";

const filePath = "c:/Users/Zaidan/Desktop/Server-Gila/Zaidan Web/artifacts/mc-roleplay/src/pages/admin.tsx";
const content = fs.readFileSync(filePath, "utf8");
const lines = content.split("\n");

console.log("HOOK CALLS FOUND IN admin.tsx:");
lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  // Look for common hook patterns like useSomething(
  if (line.includes("use") && (line.includes("(") || line.includes("=") || line.includes("return"))) {
    // Filter out imports, comments
    const trimmed = line.trim();
    if (!trimmed.startsWith("import") && !trimmed.startsWith("//") && !trimmed.startsWith("*")) {
      console.log(`${lineNum}: ${trimmed}`);
    }
  }
});
