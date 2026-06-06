import os

path = r"C:\Users\Zaidan\.codex\.codex-global-state.json"
if os.path.exists(path):
    with open(path, "rb") as f:
        data = f.read()
    
    print("Data from 0 to 480:")
    print(data[0:480])
else:
    print("File not found.")
