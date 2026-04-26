import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from pathlib import Path
import json

DOCS_DIR = Path("docs")
MAX_CHARS = 80000
EXTENSIONS = {".md",".txt",".py",".js",".ts",".sh",".c",".cpp",".h",".ipynb",".yml",".yaml",".toml",".rst"}

def extract_notebook(path):
    try:
        nb = json.loads(path.read_text(encoding="utf-8", errors="replace"))
        parts = []
        for cell in nb.get("cells", []):
            ct = cell.get("cell_type", "")
            if ct in ("code", "markdown"):
                src = "".join(cell.get("source", []))
                if src.strip():
                    parts.append(src)
        return "\n\n".join(parts)
    except Exception:
        return ""

sizes = []
for f in DOCS_DIR.rglob("*"):
    if f.is_file() and f.suffix in EXTENSIONS:
        try:
            if f.suffix == ".ipynb":
                content = extract_notebook(f)
            else:
                content = f.read_text(encoding="utf-8", errors="replace")
            sizes.append((len(content), f.suffix, str(f.relative_to(DOCS_DIR))))
        except Exception:
            sizes.append((0, f.suffix, str(f.relative_to(DOCS_DIR))))

sizes.sort(reverse=True)

total = len(sizes)
over_limit = sum(1 for s, _, _ in sizes if s > MAX_CHARS)
total_chars = sum(s for s, _, _ in sizes)

print(f"Total files: {total} | Over {MAX_CHARS//1000}k chars: {over_limit} | Total chars: {total_chars:,}")
print()
print("Top 20 largest files:")
print(f"  {'Chars':>10}  {'Ext':>6}  File")
for chars, ext, name in sizes[:20]:
    flag = " [TRUNCATED]" if chars > MAX_CHARS else ""
    print(f"  {chars:>10,}  {ext:>6}  {name[:80]}{flag}")

print()
print("Files over 20k chars by extension:")
ext_counts = {}
for chars, ext, _ in sizes:
    if chars > 20000:
        ext_counts[ext] = ext_counts.get(ext, 0) + 1
for ext, count in sorted(ext_counts.items(), key=lambda x: -x[1]):
    print(f"  {ext}: {count}")

print()
total_chunks = sum(max(1, s // 1024) for s, _, _ in sizes)
print(f"Chunks estimate: ~{total_chunks} total -> ~{total_chunks * 3 // 60} min at 3s/chunk")
print(f"  (If truncated at 20k MAX_CHARS: ~{sum(max(1, min(s,20000) // 1024) for s,_,_ in sizes) * 3 // 60} min)")
