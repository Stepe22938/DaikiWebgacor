import sqlite3
import os

db_path = r"C:\Users\Zaidan\.codex\state_5.sqlite"
if os.path.exists(db_path):
    print("Checking database:", db_path)
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check integrity
        cursor.execute("PRAGMA integrity_check;")
        result = cursor.fetchone()
        print("Integrity check result:", result)
        
        # List tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print("Tables:", tables)
        
        # Count rows in each table
        for table_name in tables:
            t_name = table_name[0]
            cursor.execute(f"SELECT COUNT(*) FROM `{t_name}`;")
            count = cursor.fetchone()[0]
            print(f"Table `{t_name}` row count: {count}")
            
            # Show table schema
            cursor.execute(f"PRAGMA table_info(`{t_name}`);")
            print(f"Schema for `{t_name}`:", cursor.fetchall())
            
        conn.close()
    except Exception as e:
        print("Database error:", e)
else:
    print("Database file not found.")
