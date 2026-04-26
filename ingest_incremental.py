"""
Ingesta incremental para LightRAG — solo re-indexa archivos nuevos o modificados.

Mantiene un estado en .ingest_state.json con {file_source: sha256}.
En cada ejecución:
  - Nuevos archivos → se indexan
  - Archivos modificados (hash diferente) → se re-indexan
  - Archivos eliminados → se reportan (LightRAG no tiene delete API, se informa)
  - Sin cambios → se saltan

Ideal para routine semanal: cuesta segundos en vez de 30-60 min de re-ingesta completa.
"""

import hashlib
import json
import subprocess
import time
from pathlib import Path

import requests

DOCS_DIR = Path("D:/LightRAG/docs")
REPOS_DIR = DOCS_DIR / "proyectos"
LIGHTRAG_URL = "http://localhost:9621"
STATE_FILE = Path("D:/LightRAG/.ingest_state.json")

REPOS = [
    "https://github.com/Weryyy/Proyectos-Entrevistas",
    "https://github.com/Weryyy/Master-IA-y-Bigdata",
    "https://github.com/Weryyy/Pokemoncito",
    "https://github.com/Weryyy/BootcampPython",
    "https://github.com/Weryyy/PDF-Translator",
    "https://github.com/Weryyy/Scan-de-puertos-en-red",
    "https://github.com/Weryyy/cryptolake-con-Copilot",
    "https://github.com/diegosnchz/MinorityReport",
    # Repos locales (privados): copiados a docs/proyectos/ manualmente
    # doc-management-system, proyecto-2-etl-python,
    # proyecto-3-webapp-kpis, codex-plugin-cc, Bot-Para-Tests-AWS
]

EXTENSIONS = {".md", ".txt", ".py", ".js", ".ts", ".sh", ".c", ".cpp", ".h", ".hpp", ".qml", ".ipynb",
              ".yml", ".yaml", ".toml", ".rst"}

SKIP_DIRS = {"node_modules", ".git", "__pycache__", "venv", ".venv", "checkpoints", "sprites",
             "venv311", "venv39", "venv310", "venv312", "env", "site-packages",
             "dist", "build", ".tox", ".mypy_cache", ".pytest_cache"}
SKIP_FILENAMES = {"dracula.txt"}

MIN_CHARS = 150
MAX_CHARS = 80_000
MAX_CHARS_TXT = 50_000


def sha256_of(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def clone_or_update_repos():
    REPOS_DIR.mkdir(parents=True, exist_ok=True)
    print("=== Actualizando repositorios ===")
    for repo_url in REPOS:
        name = repo_url.split("/")[-1]
        dest = REPOS_DIR / name
        if dest.exists():
            result = subprocess.run(["git", "-C", str(dest), "pull"], capture_output=True, text=True)
            changed = "Already up to date" not in result.stdout
            status = "updated" if changed else "no changes"
            print(f"  [{status.upper()}] {name}")
        else:
            print(f"  [CLONE]  {name}")
            result = subprocess.run(
                ["git", "clone", "--depth=1", repo_url, str(dest)],
                capture_output=True, text=True
            )
            if result.returncode != 0:
                print(f"    ERROR: {result.stderr.strip()[:120]}")


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
        return None
    except Exception:
        return False


def main():
    clone_or_update_repos()

    try:
        requests.get(f"{LIGHTRAG_URL}/health", timeout=5)
    except requests.exceptions.ConnectionError:
        print("\nERROR: LightRAG no responde. Ejecuta start_lightrag.bat primero.")
        return

    state = load_state()
    new_state = {}

    scan_dirs = [
        DOCS_DIR / "proyectos",
        DOCS_DIR / "estudio",
        DOCS_DIR / "notas",
        DOCS_DIR / "tecnica",
    ]

    print("\n=== Comprobando cambios ===")
    uploaded = skipped_unchanged = skipped_short = errors = 0

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
            categoria = base.name
            rel = doc_file.relative_to(DOCS_DIR).as_posix()
            file_source = f"[{categoria}] {rel}"
            current_hash = sha256_of(content)
            new_state[file_source] = current_hash

            if state.get(file_source) == current_hash:
                skipped_unchanged += 1
                continue

            action = "NEW" if file_source not in state else "MODIFIED"
            result = upload_document(content, file_source)

            if result is None:
                print("  ERROR: LightRAG dejó de responder. Abortando.")
                save_state({**state, **new_state})
                return
            elif result:
                print(f"  [{action}] {file_source}")
                uploaded += 1
            else:
                print(f"  [WARN] {file_source}")
                errors += 1

            time.sleep(0.3)

    # Report deleted files (no API to remove from LightRAG, just inform)
    deleted = [k for k in state if k not in new_state]
    if deleted:
        print(f"\n  Archivos eliminados del disco ({len(deleted)}) — requieren re-ingesta completa para limpiar el grafo:")
        for d in deleted:
            print(f"    - {d}")

    save_state(new_state)

    print(f"\nResultado: {uploaded} indexados | {skipped_unchanged} sin cambios | {skipped_short} muy cortos | {errors} errores")
    if uploaded:
        print("LightRAG procesará los documentos en background. Revisa lightrag.log para el progreso.")
    else:
        print("Todo al día — no hay nada nuevo que indexar.")


if __name__ == "__main__":
    main()
