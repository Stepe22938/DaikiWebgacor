import os
import sys

try:
    import psycopg2
except ImportError:
    print("psycopg2 is not installed. Trying to install it...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary"])
    import psycopg2

db_url = "postgresql://daiki:phantomichostjaya@185.128.227.237:5433/daikiweb"

try:
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM system_settings WHERE key = 'homepage_settings'")
    row = cursor.fetchone()
    if row:
        print("SETTINGS FOUND:", row[1])
    else:
        print("SETTINGS NOT FOUND")
    conn.close()
except Exception as e:
    print("Database error:", e)
