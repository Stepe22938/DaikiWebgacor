import fs from "fs";

const filePath = "c:/Users/Zaidan/Desktop/Server-Gila/Zaidan Web/artifacts/mc-roleplay/src/pages/admin.tsx";
const content = fs.readFileSync(filePath, "utf8");
const lines = content.split("\n");

console.log("HOOKS BELOW LINE 420:");
lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  if (lineNum > 420) {
    const trimmed = line.trim();
    // Match common React hooks
    if (trimmed.includes("use") && (trimmed.includes("(") || trimmed.includes("=") || trimmed.includes("return"))) {
      if (!trimmed.startsWith("//") && !trimmed.startsWith("console.")) {
        console.log(`${lineNum}: ${trimmed}`);
      }
    }
  }
});
