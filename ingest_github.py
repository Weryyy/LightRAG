"""
LightRAG ingestion script — clones repos and indexes documentation + code.

Fixes vs previous version:
- Uses correct `file_source` field (was `description`, which LightRAG ignores)
- Extracts text from .ipynb notebooks (markdown + code cells)
- Adds .sh, .c, .cpp, .h, .hpp, .qml, .yml, .yaml, .toml, .rst extensions
- Excludes training datasets, binary files, duplicate notebook variants
- Scans docs/estudio, docs/notas, docs/tecnica in addition to proyectos
- Prefixes file_source with category for better retrieval filtering
"""

import json
import subprocess
import time
from pathlib import Path

import requests

REPOS = [
    # Repos públicos — se clonan/actualizan automáticamente
    "https://github.com/Weryyy/Proyectos-Entrevistas",
    "https://github.com/Weryyy/Master-IA-y-Bigdata",
    "https://github.com/Weryyy/Pokemoncito",
    "https://github.com/Weryyy/BootcampPython",
    "https://github.com/Weryyy/PDF-Translator",
    "https://github.com/Weryyy/Scan-de-puertos-en-red",
    "https://github.com/Weryyy/cryptolake-con-Copilot",
    "https://github.com/diegosnchz/MinorityReport",
    # Repos locales (privados): ya copiados a docs/proyectos/ manualmente
    # MinorityReport, doc-management-system, proyecto-2-etl-python,
    # proyecto-3-webapp-kpis, codex-plugin-cc, Bot-Para-Tests-AWS
]
DOCS_DIR = Path("D:/LightRAG/docs")
REPOS_DIR = DOCS_DIR / "proyectos"
LIGHTRAG_URL = "http://localhost:9621"

EXTENSIONS = {".md", ".txt", ".py", ".js", ".ts", ".sh", ".c", ".cpp", ".h", ".hpp", ".qml", ".ipynb",
              ".yml", ".yaml", ".toml", ".rst"}

SKIP_DIRS = {"node_modules", ".git", "__pycache__", "venv", ".venv", "checkpoints", "sprites",
             "venv311", "venv39", "venv310", "venv312", "env", ".env", "site-packages",
             "dist", "build", ".tox", ".mypy_cache", ".pytest_cache",
             "_archive", "assets", "vendor", "coverage"}

# Files to skip regardless of extension (training data, not user docs)
SKIP_FILENAMES = {"dracula.txt"}

MIN_CHARS = 150
MAX_CHARS = 80_000
# Plain text files over this size are likely data corpora (e.g. Dracula novel), not docs
MAX_CHARS_TXT = 50_000


def clone_or_update_repos():
    REPOS_DIR.mkdir(parents=True, exist_ok=True)
    print("=== Clonando / actualizando repositorios ===")
    for repo_url in REPOS:
        name = repo_url.split("/")[-1]
        dest = REPOS_DIR / name
        if dest.exists():
            print(f"  [UPDATE] {name}")
            subprocess.run(["git", "-C", str(dest), "pull"], capture_output=True)
        else:
            print(f"  [CLONE]  {name}")
            result = subprocess.run(
                ["git", "clone", "--depth=1", repo_url, str(dest)],
                capture_output=True, text=True
            )
            if result.returncode != 0:
                print(f"    ERROR: {result.stderr.strip()[:120]}")
            else:
                print(f"    OK")


def extract_notebook(path: Path) -> str:
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


def read_file(path: Path) -> str:
    if path.suffix == ".ipynb":
        return extract_notebook(path)
    return path.read_text(encoding="utf-8", errors="ignore").strip()


def should_skip(path: Path) -> bool:
    if "'" in path.name:
        return True
    if path.name in SKIP_FILENAMES:
        return True
    for part in path.parts:
        if part in SKIP_DIRS:
            return True
        # Skip any directory that looks like a venv (venv*, env*, .venv*)
        if part.startswith(("venv", ".venv", "env3", ".env")) and part != ".env":
            return True
    return False


def scan_dir(base: Path):
    if not base.exists():
        return
    for path in sorted(base.rglob("*")):
        if path.is_file() and path.suffix in EXTENSIONS and not should_skip(path):
            yield path


def upload_document(text: str, file_source: str) -> bool:
    try:
        resp = requests.post(
            f"{LIGHTRAG_URL}/documents/text",
            json={"text": text, "file_source": file_source},
            timeout=30,
        )
        return resp.status_code in (200, 201)
    except requests.exceptions.ConnectionError:
        return None  # Signal to stop
    except Exception:
        return False


def main():
    clone_or_update_repos()

    # Check LightRAG is up
    try:
        requests.get(f"{LIGHTRAG_URL}/health", timeout=5)
    except requests.exceptions.ConnectionError:
        print("\nERROR: LightRAG no responde. Ejecuta start_lightrag.bat primero.")
        return

    scan_dirs = [
        DOCS_DIR / "proyectos",
        DOCS_DIR / "estudio",
        DOCS_DIR / "notas",
        DOCS_DIR / "tecnica",
    ]

    print("\n=== Indexando documentos ===")
    uploaded = skipped_short = skipped_filter = errors = 0

    for base in scan_dirs:
        for doc_file in scan_dir(base):
            try:
                content = read_file(doc_file)
            except Exception as e:
                print(f"  [ERR read] {doc_file.name}: {e}")
                errors += 1
                continue

            if len(content) < MIN_CHARS:
                skipped_short += 1
                continue

            limit = MAX_CHARS_TXT if doc_file.suffix == ".txt" else MAX_CHARS
            content = content[:limit]
            categoria = base.name  # "proyectos", "estudio", "notas", "tecnica"
            rel = doc_file.relative_to(DOCS_DIR).as_posix()
            file_source = f"[{categoria}] {rel}"

            result = upload_document(content, file_source)

            if result is None:
                print("  ERROR: LightRAG dejó de responder. Abortando.")
                break
            elif result:
                print(f"  [OK] {file_source}")
                uploaded += 1
            else:
                print(f"  [WARN] {file_source}")
                errors += 1

            time.sleep(0.3)

    print(f"\nResultado: {uploaded} subidos | {skipped_short} muy cortos | {errors} errores")
    print("LightRAG procesará los documentos en background. Revisa lightrag.log para el progreso.")


if __name__ == "__main__":
    main()
