import urllib.request
import os

output_dir = r"C:\Users\Zaidan\.gemini\antigravity-ide\brain\b827d8fb-ae34-4ffc-8c43-0a5dd42ec481"
os.makedirs(output_dir, exist_ok=True)

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

for i in range(7):
    url = f"https://www.tiktok.com/api/img/?itemId=7653378939313769729&location=3&aid=1988&index={i}"
    print(f"Downloading index {i} from {url}...")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            data = response.read()
            out_path = os.path.join(output_dir, f"tiktok_design_index_{i}.jpg")
            with open(out_path, 'wb') as f:
                f.write(data)
            print(f"Saved {out_path}")
    except Exception as e:
        print(f"Failed to download index {i}: {e}")
print("Finished!")
