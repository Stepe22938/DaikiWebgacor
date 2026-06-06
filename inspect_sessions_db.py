import sqlite3
import os

db_path = r"C:\Users\Zaidan\.codex\state_5.sqlite"
if os.path.exists(db_path):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, title, rollout_path, cwd, created_at, archived FROM threads;")
        rows = cursor.fetchall()
        print(f"Total threads: {len(rows)}")
        for row in rows:
            print(f"ID: {row[0]}")
            print(f"  Title: {row[1]}")
            print(f"  Path: {row[2]}")
            print(f"  CWD: {row[3]}")
            print(f"  Created: {row[4]}")
            print(f"  Archived: {row[5]}")
            print("-" * 40)
            
        conn.close()
    except Exception as e:
        print("Error:", e)
else:
    print("DB not found")
