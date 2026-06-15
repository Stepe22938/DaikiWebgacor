import pg from 'pg';
import fs from 'fs';

const rootEnvPath = '../../.env';
if (fs.existsSync(rootEnvPath)) {
  const envContent = fs.readFileSync(rootEnvPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

async function run() {
  const userClerkId = "user_3En0HWWpItXpheNaJGYwsGO4xST"; // Steve
  
  // 1. Create a group chat
  console.log("1. Creating group conversation...");
  const createRes = await fetch("http://127.0.0.1:5000/api/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-switch-clerk-id": userClerkId
    },
    body: JSON.stringify({
      name: "AI Test Group",
      memberIds: []
    })
  });
  
  if (!createRes.ok) {
    console.error("Failed to create group:", createRes.status, await createRes.text());
    return;
  }
  
  const group = await createRes.json();
  const groupId = group.id;
  console.log("Created Group Conversation ID:", groupId);
  
  // 2. Send message mentioning @Meta AI
  console.log("2. Sending message mentioning @Meta AI...");
  const sendRes = await fetch(`http://127.0.0.1:5000/api/conversations/${groupId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-switch-clerk-id": userClerkId
    },
    body: JSON.stringify({
      content: "Halo @Meta AI, tolong jelaskan apa itu Arcadia!"
    })
  });
  
  if (!sendRes.ok) {
    console.error("Failed to send message:", sendRes.status, await sendRes.text());
    return;
  }
  
  console.log("Sent message successfully. Response:", await sendRes.json());
  
  // 3. Wait 4 seconds for AI reply
  console.log("3. Waiting 4 seconds for AI reply...");
  await new Promise(r => setTimeout(r, 4000));
  
  // 4. Query messages from DB
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const messages = await pool.query(
      "SELECT m.id, m.content, u.username, u.role FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.conversation_id = $1 ORDER BY m.created_at;",
      [groupId]
    );
    console.log(`Messages in Group ${groupId}:`, JSON.stringify(messages.rows, null, 2));
    
    const members = await pool.query(
      "SELECT cm.*, u.username, u.role FROM conversation_members cm JOIN users u ON cm.user_id = u.id WHERE cm.conversation_id = $1;",
      [groupId]
    );
    console.log(`Members of Group ${groupId}:`, JSON.stringify(members.rows, null, 2));
  } catch (err) {
    console.error("DB Query failed:", err);
  } finally {
    await pool.end();
  }
}

run();
