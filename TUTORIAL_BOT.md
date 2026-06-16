# Arcadia Bot Integration & Migration Guide

Sistem bot ini dirancang agar developer dapat menghubungkan bot buatan mereka sendiri, atau memigrasikan bot Discord/Telegram yang sudah ada, cukup dengan mengubah **base URL API** tanpa mengubah alur logika codingan bot.

---

## 🚀 1. Cara Kerja Heartbeat & Webhook (Generic Bot)
Jika Anda membuat bot custom sederhana menggunakan script Node.js/Python biasa:

### A. Mengirimkan Heartbeat (Menjaga Bot Tetap "Online")
Agar bot Anda terdeteksi online dan muncul dalam kategori yang sesuai di sidebar:
Kirimkan HTTP POST request ke `/api/bots/connect` setiap **15-20 detik**.

Contoh Node.js:
```javascript
const BOT_TOKEN = "YOUR_BOT_TOKEN";
const BASE_URL = "http://localhost:5000"; // Ubah sesuai URL website Anda

function sendHeartbeat() {
  fetch(`${BASE_URL}/api/bots/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: BOT_TOKEN })
  })
  .then(res => res.json())
  .then(data => console.log(`Bot ${data.name} is ${data.status} in category ${data.category}`))
  .catch(err => console.error("Heartbeat failed:", err));
}

// Jalankan heartbeat berkala
setInterval(sendHeartbeat, 15000);
sendHeartbeat();
```

### B. Menerima Pesan Baru (Webhooks)
Saat bot Anda diinvite ke grup chat, setiap ada pesan baru, website akan mengirimkan payload POST ke **Webhook URL** yang Anda daftarkan di Developer Settings.

Format payload yang dikirimkan website ke bot Anda:
```json
{
  "event": "MESSAGE_CREATE",
  "bot": { "id": 1, "name": "Moderator Bot" },
  "message": {
    "conversationId": 12,
    "channelId": null,
    "content": "!ping",
    "sender": {
      "id": 4,
      "username": "Zaidan",
      "displayName": "Kak Owner",
      "role": "admin"
    }
  }
}
```

---

## 👾 2. Migrasi Bot Discord (Discord.js / Discord.py)
Anda dapat memigrasikan bot Discord tanpa mengubah source code logika bot Anda, cukup dengan mengarahkan API endpoint ke website ini.

### Contoh Node.js (Discord.js v14+):
```javascript
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  // Override API base URL agar mengarah ke website Anda
  rest: {
    api: "http://localhost:5000/api/v10",
  }
});

client.on('ready', () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
  // Logika bot Anda tetap sama!
  if (message.content === '!halo') {
    message.reply('Halo dari bot yang sudah dimigrasikan! 👋');
  }
});

// Gunakan Token Bot dari Developer Settings website Anda
client.login("arc_bot_xxxxxx");
```

---

## ✈️ 3. Migrasi Bot Telegram (Telegram Bot API)
Telegram bot berkomunikasi secara HTTP. Ubah API endpoint Telegram dari `https://api.telegram.org` menjadi base URL website Anda:

### Endpoint:
`POST /api/bot/telegram/bot{YOUR_BOT_TOKEN}/sendMessage`

### Payload:
```json
{
  "chat_id": 12, // Conversation ID group chat website Anda
  "text": "Halo! Pesan ini dikirim melalui Telegram Bot API compatibility layer."
}
```

---

## 🛠️ 4. Cara Menghubungkan Bot ke Website
1. Buka halaman **Messages** di website Anda.
2. Di sidebar kiri bawah, klik menu **Developer Settings**.
3. Di tab **Create Bot**, masukkan nama bot dan pilih kategori (e.g. `Moderation`, `Utility`, `Games`, `Fun`). Klik **Register Bot**.
4. Di tab **My Bots**, salin **Bot Token** Anda dan tempel di konfigurasi bot Anda.
5. Masukkan **Webhook URL** bot Anda (alamat server bot Anda yang mendengarkan event) dan simpan.
6. Jalankan code bot Anda. Bot Anda akan otomatis terdeteksi "Online" di sidebar sesuai kategorinya!
7. Masuk ke grup chat pilihan Anda, buka dialog **Members**, lalu klik **Invite Bot to Group** untuk memasukkan bot Anda ke sana.
