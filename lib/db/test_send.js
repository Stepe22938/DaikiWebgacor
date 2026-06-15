const res = await fetch("http://127.0.0.1:5000/api/conversations/6/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-switch-clerk-id": "user_3En0HWWpItXpheNaJGYwsGO4xST"
  },
  body: JSON.stringify({
    content: "Halo Meta AI, apa kabar?"
  })
});

console.log("Status:", res.status);
const data = await res.json();
console.log("Response:", JSON.stringify(data, null, 2));
