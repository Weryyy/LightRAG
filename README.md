# LightRAG — Personal Knowledge Graph

Local RAG setup using [LightRAG](https://github.com/HKUDS/LightRAG) + Ollama. Indexes personal repos, notes, and study materials into a knowledge graph queryable via chat.

## Stack

- **LightRAG** — graph-based RAG engine (REST API on `:9621`)
- **Ollama** — local LLM inference (`qwen2.5:7b` for extraction, `nomic-embed-text` for embeddings)
- **Custom UI** — dark-mode React frontend served on `:8765` (`design_handoff_lightrag_ui/`)

## Requirements

- [Ollama](https://ollama.com) with models pulled:
  ```
  ollama pull hf.co/bartowski/Qwen2.5-7B-Instruct-GGUF:Q4_K_M
  ollama pull nomic-embed-text
  ```
- Python 3.11 venv with `lightrag-hku[api]` installed
- GPU recommended (6 GB VRAM minimum for qwen2.5:7b Q4)

## Setup

```bash
# 1. Clone and create venv
python -m venv venv
venv\Scripts\pip install "lightrag-hku[api]"

# 2. Copy and edit config
cp .env.example .env
# Edit RAG_DIR and INPUT_DIR to your local paths

# 3. Start LightRAG server
start_lightrag.bat

# 4. Start the UI
cd design_handoff_lightrag_ui
python serve_ui.py
# Open http://localhost:8765
```

## Ingestion

Place documents in `docs/` with this structure:
```
docs/
  proyectos/   ← git repos (cloned automatically by ingest_github.py)
  estudio/     ← course notes, papers
  notas/       ← personal notes
  tecnica/     ← technical references
```

Run ingestion:
```bash
# Full ingestion (clones repos + indexes everything)
venv\Scripts\python ingest_github.py

# Incremental (only new/changed files)
venv\Scripts\python ingest_incremental.py

# Retry failed documents
venv\Scripts\python retry_failed.py
```

## UI Views

| View | Description |
|---|---|
| Search / Chat | RAG queries with mode selector (local / global / hybrid / naive) |
| Graph Explorer | Force-directed graph of extracted entities and relations |
| Documents | List of indexed docs with status, filtering, and retry |
| Health | Server stats, VRAM usage, pipeline log |

## Files

```
start_lightrag.bat          ← starts LightRAG server on :9621
ingest_github.py            ← full ingestion (clones repos + indexes docs/)
ingest_incremental.py       ← incremental ingestion
retry_failed.py             ← retries failed documents
.env.example                ← config template
design_handoff_lightrag_ui/ ← React frontend (fully offline, no CDN)
  LightRAG UI.html          ← app shell
  api.js                    ← API client (window.LightRAGAPI)
  *-view.jsx / *-panel.jsx  ← views
  vendor/                   ← React 18 + Babel vendored locally
  serve_ui.py               ← static server on :8765
```
