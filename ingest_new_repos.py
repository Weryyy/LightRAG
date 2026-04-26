"""
Indexa solo los repos nuevos que no estaban en LightRAG antes.
Evita re-enviar los 181 docs que ya están en retry.
"""

import json
import time
from pathlib import Path
import requests

DOCS_DIR = Path("D:/LightRAG/docs")
LIGHTRAG_URL = "http://localhost:9621"

NEW_REPOS = [
    DOCS_DIR / "proyectos" / "MinorityReport",
    DOCS_DIR / "proyectos" / "PDF-Translator",
    DOCS_DIR / "proyectos" / "Scan-de-puertos-en-red",
    DOCS_DIR / "proyectos" / "cryptolake-con-Copilot",
    DOCS_DIR / "proyectos" / "doc-management-system",
    DOCS_DIR / "proyectos" / "proyecto-2-etl-python",
    DOCS_DIR / "proyectos" / "proyecto-3-webapp-kpis",
    DOCS_DIR / "proyectos" / "codex-plugin-cc",
    DOCS_DIR / "proyectos" / "Bot-Para-Tests-AWS",
    DOCS_DIR / "tecnica",
]

EXTENSIONS = {".md", ".txt", ".py", ".js", ".ts", ".sh", ".c", ".cpp", ".h", ".hpp",
              ".qml", ".ipynb", ".yml", ".yaml", ".toml", ".rst"}
SKIP_DIRS = {"node_modules", ".git", "__pycache__", "venv", ".venv", "checkpoints", "sprites",
             "venv311", "venv39", "venv310", "venv312", "env", "site-packages",
             "dist", "build", ".tox", ".mypy_cache", ".pytest_cache"}
SKIP_FILENAMES = {"dracula.txt"}
MIN_CHARS = 150
MAX_CHARS = 80_000
MAX_CHARS_TXT = 50_000


def extract_notebook(path):
    try:
        nb = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
    except json.JSONDecodeError:
        return ""
    parts = []
    for cell in nb.get("cells", []):
        if cell.get("cell_type") in ("markdown", "code"):
            src = "".join(cell.get("source", []))
            if src.strip():
                parts.append(src)
    return "\n\n".join(parts)


def should_skip(path):
    if "'" in path.name:
        return True
    if path.name in SKIP_FILENAMES:
        return True
    for part in path.parts:
        if part in SKIP_DIRS:
            return True
        if part.startswith(("venv", ".venv", "env3", ".env")) and part != ".env":
            return True
    return False


def main():
    try:
        requests.get(f"{LIGHTRAG_URL}/health", timeout=5)
    except requests.exceptions.ConnectionError:
        print("ERROR: LightRAG no responde.")
        return

    uploaded = skipped = errors = 0

    for base in NEW_REPOS:
        if not base.exists():
            print(f"[SKIP] No existe: {base}")
            continue
        for f in sorted(base.rglob("*")):
            if not f.is_file() or f.suffix not in EXTENSIONS or should_skip(f):
                continue
            try:
                content = extract_notebook(f) if f.suffix == ".ipynb" else f.read_text(encoding="utf-8", errors="ignore").strip()
            except Exception as e:
                print(f"  [ERR] {f.name}: {e}")
                errors += 1
                continue

            if len(content) < MIN_CHARS:
                skipped += 1
                continue

            limit = MAX_CHARS_TXT if f.suffix == ".txt" else MAX_CHARS
            content = content[:limit]

            # Derive category from path
            try:
                rel_to_docs = f.relative_to(DOCS_DIR)
                categoria = rel_to_docs.parts[0]  # "proyectos" or "tecnica"
                rel = rel_to_docs.as_posix()
                file_source = f"[{categoria}] {rel}"
            except ValueError:
                file_source = f.name

            try:
                resp = requests.post(
                    f"{LIGHTRAG_URL}/documents/text",
                    json={"text": content, "file_source": file_source},
                    timeout=30,
                )
                if resp.status_code in (200, 201):
                    print(f"  [OK] {file_source}")
                    uploaded += 1
                else:
                    print(f"  [WARN {resp.status_code}] {file_source}")
                    errors += 1
            except requests.exceptions.ConnectionError:
                print("  ERROR: LightRAG dejó de responder.")
                break

            time.sleep(0.3)

    print(f"\nResultado: {uploaded} enviados | {skipped} muy cortos | {errors} errores")


if __name__ == "__main__":
    main()
