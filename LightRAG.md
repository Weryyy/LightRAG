# LightRAG — Documentación del Sistema

Sistema RAG (Retrieval-Augmented Generation) local que indexa documentos y repositorios Git para responder preguntas con contexto. Usa Ollama como backend de LLM y embeddings.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────┐
│  Claude Code / Claude Desktop                        │
│  (cliente MCP)                                       │
└──────────────────────┬──────────────────────────────┘
                       │ MCP Protocol
                       ▼
┌─────────────────────────────────────────────────────┐
│  daniel-lightrag-mcp  (puerto 9621)                  │
│  Wrapper MCP sobre la API REST de LightRAG           │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP REST
                       ▼
┌─────────────────────────────────────────────────────┐
│  LightRAG Server  http://localhost:9621              │
│  lightrag-hku 1.4.14                                 │
│  Working dir: D:\LightRAG\rag_storage                │
└──────┬───────────────────────────────┬──────────────┘
       │ Embeddings + LLM              │ Storage
       ▼                               ▼
┌──────────────┐             ┌─────────────────────────┐
│ Ollama       │             │ rag_storage/             │
│ localhost:   │             │  kv_store_*.json         │
│   11434      │             │  vdb_*.json              │
│              │             │  graph_chunk_entity_     │
│ gemma-4-E4B  │             │    relation.graphml      │
│   Q4_K_M     │             └─────────────────────────┘
│   (ggml-org) │
│ nomic-embed- │
│   text       │
└──────────────┘
```

---

## Configuración

### Dónde va cada ajuste
- **`.env`**: toda la configuración del modelo, timeouts, chunking, concurrencia y límites de visualización. LightRAG lo lee al arrancar con `load_dotenv(override=False)`.
- **`start_lightrag.bat`**: solo flags que el CLI expone (`--timeout`, `--max-async`, `--summary-max-tokens`, `--ollama-*`). Los timeouts de LLM/embedding NO van aquí — van al `.env`.

### .env
```
LLM_BINDING=ollama
LLM_MODEL=hf.co/ggml-org/gemma-4-E4B-it-GGUF:Q4_K_M
LLM_BINDING_HOST=http://localhost:11434

EMBEDDING_BINDING=ollama
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_BINDING_HOST=http://localhost:11434
EMBEDDING_DIM=768

RAG_DIR=D:/LightRAG/rag_storage
INPUT_DIR=D:/LightRAG/docs

CHUNK_SIZE=1024
CHUNK_OVERLAP_SIZE=128

LLM_TIMEOUT=300
EMBEDDING_TIMEOUT=300

EMBEDDING_FUNC_MAX_ASYNC=2

MAX_GRAPH_NODES=200
```

Notas sobre el `.env`:
- `LLM_MODEL` — `hf.co/ggml-org/gemma-4-E4B-it-GGUF:Q4_K_M`. Gemma 4 E4B Q4_K_M (5.9 GB). Reemplazó a mistral:latest (Codeforces ELO 2150 vs ~110). Modelo único para ingesta + agente de código. VRAM ~5.9 GB en GTX 1660 6 GB — ajustado, mantener num_ctx=4096.
- `CHUNK_SIZE` / `CHUNK_OVERLAP_SIZE` — nombres exactos que lee el código (`lightrag/lightrag.py:310,314`). 1024/128 mejora cohesión de funciones de código vs 512/50 anterior.
- `LLM_TIMEOUT` y `EMBEDDING_TIMEOUT` — el worker timeout interno es `timeout * 2` (en `utils.py:683`), así que 300 da 600s reales por tarea.
- `EMBEDDING_FUNC_MAX_ASYNC=2` — el default es 8 y satura Ollama en GPU local.
- `MAX_GRAPH_NODES=200` — máximo de nodos devueltos por `/graphs`. Subir si el grafo crece y el navegador aguanta.

### Parámetros del servidor (start_lightrag.bat)
| Parámetro | Valor | Motivo |
|---|---|---|
| `--port` | 9621 | Puerto fijo del servidor |
| `--timeout` | 600 | Timeout de Gunicorn (I/O HTTP del servidor) |
| `--max-async` | 1 | Procesamiento secuencial de documentos (evita saturar GPU) |
| `--summary-max-tokens` | 600 | Tamaño máximo de resúmenes de entidad/relación (igual al `DEFAULT_SUMMARY_LENGTH_RECOMMENDED` del paquete) |
| `--ollama-llm-num_ctx` | 4096 | Context window para Gemma 4 E4B — conservador para no exceder 6 GB VRAM |
| `--ollama-embedding-num_ctx` | 4096 | Context window para nomic-embed-text |
| `--ollama-*-num_gpu` | 99 | Forzar offload completo a GPU (Ollama ignora si excede capas) |

---

## Scripts disponibles

### Iniciar el servidor
```batch
D:\LightRAG\start_lightrag.bat
```
- Espera a que Ollama esté disponible antes de arrancar
- URL Web UI: http://localhost:9621/webui/
- URL API: http://localhost:9621/docs

### Ingestar documentos (ingesta completa)
```bash
cd D:\LightRAG
venv\Scripts\python.exe ingest_github.py
```
- Clona/actualiza los repos en `docs/proyectos/`
- Indexa todos los archivos soportados de `docs/`
- Extensiones: `.md .txt .py .js .ts .sh .c .cpp .h .ipynb .yml .yaml .toml .rst`
- Prefija `file_source` con la categoría: `[proyectos]`, `[estudio]`, `[notas]`, `[tecnica]`
- Mínimo 150 chars, máximo 80.000 chars por archivo

### Ingestar documentos (ingesta incremental)
```bash
cd D:\LightRAG
venv\Scripts\python.exe ingest_incremental.py
```
- Igual que ingesta completa pero solo procesa archivos nuevos o modificados (detección por SHA-256)
- Mantiene estado en `.ingest_state.json`
- Ideal para routine semanal automática — cuesta segundos en lugar de 30-60 min

### Reintentar documentos fallidos
```bash
cd D:\LightRAG
venv\Scripts\python.exe retry_failed.py
# Solo disparar y salir sin monitorizar:
venv\Scripts\python.exe retry_failed.py --no-follow
# Polling más rápido:
venv\Scripts\python.exe retry_failed.py --poll-interval 5
```
Usa el endpoint nativo `POST /documents/reprocess_failed`, que reprocesa todos los docs en `failed`, `pending` o `processing` (crashes). Muestra contadores antes/después y sigue el pipeline vía `/documents/pipeline_status`.

### Monitorear progreso de ingesta
```bash
cd D:\LightRAG
venv\Scripts\python.exe monitor.py
```
Actualiza cada 10s con: progreso, velocidad, ETA, conteo de fallidos.

### Monitorear GPU / Ollama
```bash
cd D:\LightRAG
venv\Scripts\python.exe ollama_monitor.py
```
Muestra VRAM usada, temperatura GPU, modelos activos. Actualiza cada 2s.

### Visualizar el grafo de conocimiento (local)
```bash
cd D:\LightRAG
venv\Scripts\python.exe graph_viewer.py
```
Lee `rag_storage/graph_chunk_entity_relation.graphml` directamente (sin pasar por la API). Abre automáticamente un navegador en `http://localhost:8765` con visualización interactiva D3.js: force-directed layout, búsqueda, filtro por tipo de entidad, sidebar de detalle por nodo.

---

## Repositorios indexados

Ubicación: `D:\LightRAG\docs\proyectos\`

| Repo | Contenido |
|---|---|
| `Master-IA-y-Bigdata` | Notebooks ML, ejercicios de estudio |
| `Pokemoncito` | Proyecto Python + datos + RL |
| `Proyectos-Entrevistas` | Proyectos y challenges técnicos |
| `BootcampPython` | Materiales del bootcamp |

Carpetas adicionales:
- `docs/estudio/` — materiales de estudio sueltos
- `docs/notas/` — notas personales
- `docs/tecnica/` — documentación técnica

---

## Estado del almacenamiento (rag_storage/)

| Archivo | Descripción |
|---|---|
| `kv_store_doc_status.json` | Estado de cada doc: `pending/processing/done/failed` |
| `kv_store_full_docs.json` | Contenido completo de documentos indexados |
| `kv_store_text_chunks.json` | Chunks de texto procesados |
| `kv_store_llm_response_cache.json` | Caché de llamadas al LLM (~13 MB) |
| `vdb_chunks.json` | Embeddings de chunks |
| `vdb_entities.json` | Embeddings de entidades extraídas |
| `vdb_relationships.json` | Embeddings de relaciones |
| `graph_chunk_entity_relation.graphml` | Grafo de conocimiento completo |

Para ver el estado actual:
```bash
curl http://localhost:9621/documents/status_counts
```

---

## API Endpoints principales

Base URL: `http://localhost:9621`

| Endpoint | Método | Descripción |
|---|---|---|
| `/health` | GET | Estado del servidor |
| `/documents/text` | POST | Ingestar texto (`{"text": "...", "file_source": "..."}`) |
| `/documents/upload` | POST | Subir archivo |
| `/documents/scan` | POST | Escanear `INPUT_DIR` e ingestar nuevos |
| `/documents/reprocess_failed` | POST | Reprocesar docs fallidos/pendientes |
| `/documents/pipeline_status` | GET | Estado del pipeline en curso |
| `/documents/status_counts` | GET | Conteos por estado |
| `/documents/paginated` | POST | Listar docs con paginación |
| `/documents/clear_cache` | POST | Limpiar caché LLM |
| `/query` | POST | Consultar el RAG |
| `/query/stream` | POST | Consulta con streaming |
| `/webui/` | GET | Interfaz web |
| `/docs` | GET | Swagger UI de la API |

Trampas conocidas:
- `/documents/text` solo acepta `text` y `file_source`. Enviar `id` se ignora silenciosamente — no sirve para reintentar un doc concreto. Usar `/documents/reprocess_failed` en su lugar.

Ejemplo de consulta:
```bash
curl -X POST http://localhost:9621/query \
  -H "Content-Type: application/json" \
  -d '{"query": "¿Qué proyectos de ML tiene el usuario?", "mode": "hybrid"}'
```

Modos de consulta: `naive`, `local`, `global`, `hybrid` (recomendado).

---

## Troubleshooting

### Error: "the input length exceeds the context length" (400)
**Causa**: Un chunk o resumen de entidad supera el contexto de nomic-embed-text.
**Fix**: controlar el tamaño en origen con `.env`:
```
CHUNK_SIZE=512
```
y en el bat `--summary-max-tokens 600`. Para los docs ya fallidos: `python retry_failed.py`.

Nota: `EMBEDDING_TOKEN_LIMIT` en LightRAG solo emite un warning, no trunca — no sirve como fix.

### Error: Worker timeout (60s, 120s)
**Causa**: El worker timeout es `EMBEDDING_TIMEOUT * 2` (o `LLM_TIMEOUT * 2`). Default = 30s → 60s.
**Síntoma**: `Warning: Embedding func: Worker timeout for task ... after 60s`
**Fix**: en `.env`:
```
EMBEDDING_TIMEOUT=300
LLM_TIMEOUT=300
EMBEDDING_FUNC_MAX_ASYNC=2
```

### Error: ReadTimeout (httpx.ReadTimeout)
**Causa**: Mistral tarda demasiado generando entidades en un chunk grande.
**Fix**: `LLM_TIMEOUT=300` en `.env` y verificar Mistral en GPU con `python ollama_monitor.py`.

### Web UI: "Graph data is truncated to Max Nodes"
**Causa**: La frontend hardcodea 1000 como máximo de nodos a pedir; el servidor aplica `min(1000, MAX_GRAPH_NODES)`. Con grafos grandes (>1000 nodos) el navegador se cuelga.
**Fix**: `MAX_GRAPH_NODES=200` en `.env` (reiniciar servidor). Subir con cuidado si el grafo crece.
**Alternativa**: usar `graph_viewer.py` en puerto 8765, que lee el graphml completo sin límite de API.

### graph_viewer.py: pantalla negra sin nodos
**Causa**: Algún nodo tiene un id que colisiona con propiedades de `Object.prototype` (ej. `"constructor"`, `"toString"`). El objeto `adj` hereda esas propiedades y `.add()` falla.
**Síntoma en consola**: `Uncaught TypeError: adj[e.target].add is not a function`
**Fix aplicado**: `adj` y `nodeById` usan `Object.create(null)` en lugar de `{}`. Ya está corregido en el script.

### Ollama no responde
```bash
# Verificar que Ollama corre:
curl http://localhost:11434/api/tags
# Reiniciar Ollama si es necesario (ejecutar desde su acceso directo)
# start_lightrag.bat espera automáticamente a Ollama
```

### El servidor no arranca
```bash
# Verificar que el venv tiene lightrag instalado:
D:\LightRAG\venv\Scripts\lightrag-server.exe --version
# Si falla, reinstalar:
D:\LightRAG\venv\Scripts\pip install lightrag-hku --cache-dir D:\pip-cache
```

### Limpiar caché LLM (si está corrupto o muy grande)
```bash
D:\LightRAG\venv\Scripts\lightrag-clean-llmqc.exe --working-dir D:\LightRAG\rag_storage
```

---

## Flujo de trabajo habitual

```
1. Iniciar Ollama (si no está corriendo)
2. Ejecutar start_lightrag.bat
3. Esperar a que diga "Application startup complete"
4. [Opcional] Actualizar docs: python ingest_github.py
5. [Opcional] Monitorear: python monitor.py
6. [Opcional] Reintentar fallos: python retry_failed.py
7. [Opcional] Visualizar grafo: python graph_viewer.py → http://localhost:8765 (D:\LightRAG\graph_viewer.py)
8. Usar desde Claude Code via MCP (servidor ya registrado)
```

---

## Instalación del entorno (si hay que recrearlo)

```bash
# Crear venv en D: (no en C:)
python -m venv D:\LightRAG\venv

# Instalar lightrag con cache en D:
D:\LightRAG\venv\Scripts\pip install lightrag-hku daniel-lightrag-mcp --cache-dir D:\pip-cache

# Verificar instalación:
D:\LightRAG\venv\Scripts\lightrag-server.exe --version
```

---

## MCP — Integración con Claude

El servidor MCP está registrado en la configuración de Claude Desktop/Code.
Ejecutable: `D:\LightRAG\venv\Scripts\daniel-lightrag-mcp.exe`
Conecta con LightRAG en `http://localhost:9621`.

Para que funcione el MCP, LightRAG debe estar corriendo antes de abrir Claude.
