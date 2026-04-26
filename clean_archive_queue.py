"""Remove _archive and assets entries from kv_store_doc_status.json.
Run with the LightRAG server STOPPED.
"""
import json
from pathlib import Path

KV = Path("D:/LightRAG/rag_storage/kv_store_doc_status.json")

with open(KV, encoding="utf-8") as f:
    data = json.load(f)

skip_keys = [k for k in data if "_archive" in k or "/assets/" in k or "\\assets\\" in k]
for k in skip_keys:
    del data[k]
    print(f"Removed: {k[:100]}")

with open(KV, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)

print(f"\nDone — removed {len(skip_keys)} entries. Remaining: {len(data)}")
