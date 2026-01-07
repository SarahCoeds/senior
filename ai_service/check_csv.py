import pandas as pd
import os
import csv

files = [
    "parts.csv",
    "games.csv",
    "applications.csv",
    "building_instructions.csv",
    "troubleshooting.csv",
    "usage_scenarios.csv"
]

for file in files:
    print(f"\n=== Checking {file} ===")
    if not os.path.exists(file):
        print("✗ Not found")
        continue


    try:
        df = pd.read_csv(file)
        print(f"✓ Pandas loaded: {len(df)} rows, {len(df.columns)} columns")
        print(f"Columns: {list(df.columns)}")
    except Exception as e:
        print(f"✗ Pandas error: {e}")
        continue


    try:
        with open(file, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            rows = list(reader)
        col_count = len(rows[0])
        bad = [i for i, r in enumerate(rows[1:], start=2) if len(r) != col_count]
        if bad:
            print(f"⚠ Row-length mismatch on lines: {bad[:10]}{'...' if len(bad)>10 else ''}")
        else:
            print("✓ CSV rows are consistently formatted")
    except Exception as e:
        print(f"✗ CSV parse error: {e}")
