import cv2
import os

output_dir = r"C:\Users\Zaidan\.gemini\antigravity-ide\brain\b827d8fb-ae34-4ffc-8c43-0a5dd42ec481"
os.makedirs(output_dir, exist_ok=True)

path = r"c:\Users\Zaidan\Desktop\Server-Gila\Zaidan Web\artifacts\mc-roleplay\public\uploads\1782296335856-u70xmez.mp4"

print(f"Processing uploaded video at {path}...")
if not os.path.exists(path):
    print("Video does not exist!")
else:
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        print("Failed to open video")
    else:
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps
        print(f"FPS: {fps}, Total Frames: {total_frames}, Duration: {duration}s")
        
        # Extract frames every 5 seconds
        for sec in range(0, int(duration), 5):
            frame_idx = int(sec * fps)
            if frame_idx >= total_frames:
                break
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if ret:
                out_path = os.path.join(output_dir, f"uploaded_video_frame_{sec}s.png")
                cv2.imwrite(out_path, frame)
                print(f"Saved {out_path}")
                
        cap.release()
print("Done!")
