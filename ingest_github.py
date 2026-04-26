"""
LightRAG ingestion script — clones repos and indexes documentation + code.

Filters applied before sending anything to LightRAG:
  1. SKIP_DIRS / venv patterns (hard-coded)
  2. .gitignore files in each repo (parsed per-repo, respects nested .gitignores)
  3. Content quality score (rejects minified JS, data dumps, encoded blobs)
  4. Size limits (MIN_CHARS / MAX_CHARS)

Usage:
    python ingest_github.py              # normal run
    python ingest_github.py --dry-run    # show what would be indexed, no uploads
"""

import argparse
import fnmatch
import json
import re
import subprocess
import time
from pathlib import Path

import requests

REPOS = [
    "https://github.com/Weryyy/Proyectos-Entrevistas",
    "https://github.com/Weryyy/Master-IA-y-Bigdata",
    "https://github.com/Weryyy/Pokemoncito",
    "https://github.com/Weryyy/BootcampPython",
    "https://github.com/Weryyy/PDF-Translator",
    "https://github.com/Weryyy/Scan-de-puertos-en-red",
    "https://github.com/Weryyy/cryptolake-con-Copilot",
    "https://github.com/diegosnchz/MinorityReport",
]
DOCS_DIR  = Path("D:/LightRAG/docs")
REPOS_DIR = DOCS_DIR / "proyectos"
LIGHTRAG_URL = "http://localhost:9621"

EXTENSIONS = {
    ".md", ".txt", ".py", ".js", ".ts", ".sh",
    ".c", ".cpp", ".h", ".hpp", ".qml", ".ipynb",
    ".yml", ".yaml", ".toml", ".rst",
}

# Hard-coded dirs to always skip (deps, caches, venvs, build artefacts)
SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", "venv", ".venv",
    "checkpoints", "sprites", "site-packages",
    "dist", "build", ".tox", ".mypy_cache", ".pytest_cache",
    "_archive", "assets", "vendor", "coverage",
}

SKIP_FILENAMES = {"dracula.txt"}

MIN_CHARS    = 150
MAX_CHARS    = 80_000
MAX_CHARS_TXT = 50_000


# ── .gitignore parser ─────────────────────────────────────────────────────────

def load_gitignore_patterns(repo_root: Path) -> list[tuple[Path, list[str]]]:
    """Return list of (gitignore_dir, [patterns]) for every .gitignore in repo."""
    result = []
    for gi in repo_root.rglob(".gitignore"):
        patterns = []
        for line in gi.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                patterns.append(line)
        if patterns:
            result.append((gi.parent, patterns))
    return result


def is_gitignored(path: Path, gitignore_rules: list[tuple[Path, list[str]]]) -> tuple[bool, str]:
    """Check if path matches any .gitignore rule. Returns (ignored, matched_pattern)."""
    for gi_dir, patterns in gitignore_rules:
        try:
            rel = path.relative_to(gi_dir)
        except ValueError:
            continue
        rel_str  = rel.as_posix()
        rel_parts = rel.parts
        for pattern in patterns:
            p = pattern.rstrip("/")
            is_dir_only = pattern.endswith("/")
            # Match against full relative path and each path component
            targets = [rel_str] + list(rel_parts)
            for target in targets:
                if fnmatch.fnmatch(target, p) or fnmatch.fnmatch(target, p.lstrip("/")):
                    if is_dir_only and path.is_file():
                        # dir-only pattern: skip if any parent dir matches
                        for part in rel_parts[:-1]:
                            if fnmatch.fnmatch(part, p):
                                return True, f"{gi_dir.name}/.gitignore: {pattern}"
                    else:
                        return True, f"{gi_dir.name}/.gitignore: {pattern}"
    return False, ""


# ── Content quality filter ────────────────────────────────────────────────────

def quality_check(content: str, path: Path) -> tuple[bool, str]:
    """
    Returns (should_skip, reason).
    Detects:
      - Minified JS/CSS (very long lines)
      - Data dumps (window.globalProvideData, encoded blobs)
      - JSON array files with no prose
      - Files that are mostly non-printable / base64
    """
    lines = content.splitlines()
    if not lines:
        return True, "empty"

    # 1. Minified: median line length > 300
    lengths = sorted(len(l) for l in lines)
    median_len = lengths[len(lengths) // 2]
    if median_len > 300:
        return True, f"minified (median line {median_len} chars)"

    # 2. Single very long line covering most of the content
    max_line = max(len(l) for l in lines)
    if max_line > 5000 and max_line > len(content) * 0.6:
        return True, f"single-line data blob ({max_line} chars)"

    # 3. Known data dump patterns
    dump_patterns = [
        r"^window\.globalProvideData\(",
        r"^window\.__NUXT__",
        r"^self\.__next_f",
        r"^exports\[\"[a-f0-9]{8,}\"\]",
    ]
    first_500 = content[:500]
    for pat in dump_patterns:
        if re.search(pat, first_500, re.MULTILINE):
            return True, f"data dump pattern: {pat}"

    # 4. Base64 / binary ratio: >40% non-ASCII printable
    non_ascii = sum(1 for c in content if ord(c) > 127 or (ord(c) < 32 and c not in "\n\r\t"))
    if non_ascii / max(len(content), 1) > 0.4:
        return True, f"high non-ASCII ratio ({non_ascii/len(content):.0%})"

    # 5. Pure JSON array with no meaningful prose (e.g. large dataset)
    if path.suffix == ".json":
        stripped = content.strip()
        if stripped.startswith("[") and len(stripped) > 10_000:
            return True, "large JSON array (likely dataset)"

    return False, ""


# ── Hard dir/file skip ────────────────────────────────────────────────────────

def should_skip_hard(path: Path) -> bool:
    if "'" in path.name:
        return True
    if path.name in SKIP_FILENAMES:
        return True
    for part in path.parts:
        if part in SKIP_DIRS:
            return True
        if part.startswith(("venv", ".venv", "env3")) and part != ".env":
            return True
    return False


# ── File readers ──────────────────────────────────────────────────────────────

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


# ── Repo cloning ──────────────────────────────────────────────────────────────

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
                capture_output=True, text=True,
            )
            if result.returncode != 0:
                print(f"    ERROR: {result.stderr.strip()[:120]}")
            else:
                print(f"    OK")


# ── Upload ────────────────────────────────────────────────────────────────────

def upload_document(text: str, file_source: str) -> bool | None:
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


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be indexed without uploading")
    args = parser.parse_args()
    dry = args.dry_run

    if not dry:
        clone_or_update_repos()
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

    print(f"\n=== {'DRY RUN — ' if dry else ''}Indexando documentos ===\n")

    # Pre-load .gitignore rules per repo
    gitignore_cache: dict[Path, list] = {}
    for repo_dir in REPOS_DIR.iterdir():
        if repo_dir.is_dir():
            gitignore_cache[repo_dir] = load_gitignore_patterns(repo_dir)

    uploaded = skipped_hard = skipped_gi = skipped_quality = skipped_short = errors = 0
    skip_log: list[str] = []

    for base in scan_dirs:
        if not base.exists():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file() or path.suffix not in EXTENSIONS:
                continue

            # 1. Hard skip
            if should_skip_hard(path):
                skipped_hard += 1
                continue

            # 2. .gitignore — find which repo this file belongs to
            repo_root = None
            for rd in REPOS_DIR.iterdir():
                try:
                    path.relative_to(rd)
                    repo_root = rd
                    break
                except ValueError:
                    pass

            if repo_root and repo_root in gitignore_cache:
                ignored, reason = is_gitignored(path, gitignore_cache[repo_root])
                if ignored:
                    skipped_gi += 1
                    skip_log.append(f"  [GITIGNORE] {path.relative_to(DOCS_DIR)} — {reason}")
                    continue

            # 3. Read content
            try:
                content = read_file(path)
            except Exception as e:
                errors += 1
                skip_log.append(f"  [READ ERR] {path.name}: {e}")
                continue

            # 4. Size limits
            if len(content) < MIN_CHARS:
                skipped_short += 1
                continue

            limit = MAX_CHARS_TXT if path.suffix == ".txt" else MAX_CHARS
            content = content[:limit]

            # 5. Quality check
            bad, reason = quality_check(content, path)
            if bad:
                skipped_quality += 1
                skip_log.append(f"  [QUALITY]  {path.relative_to(DOCS_DIR)} — {reason}")
                continue

            # 6. Upload (or dry-run log)
            categoria = base.name
            rel = path.relative_to(DOCS_DIR).as_posix()
            file_source = f"[{categoria}] {rel}"

            if dry:
                print(f"  [WOULD INDEX] {file_source} ({len(content):,} chars)")
                uploaded += 1
                continue

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

    print(f"\n{'-'*60}")
    if dry:
        print(f"DRY RUN — se indexarían:  {uploaded}")
    else:
        print(f"Subidos:                  {uploaded}")
    print(f"Saltados (hard dirs):     {skipped_hard}")
    print(f"Saltados (.gitignore):    {skipped_gi}")
    print(f"Saltados (calidad):       {skipped_quality}")
    print(f"Saltados (muy cortos):    {skipped_short}")
    print(f"Errores:                  {errors}")

    if skip_log and dry:
        print(f"\n=== Detalle de skips ===")
        for line in skip_log:
            print(line)


if __name__ == "__main__":
    main()
