# LightRAG UI — Wiring notes

Cómo se conecta el frontend de Claude Design al servidor LightRAG local.

## Arrancar

1. **LightRAG**: ejecuta `D:\LightRAG\start_lightrag.bat` (puerto 9621).
2. **UI**: doble click en `start_ui.bat` o `python serve_ui.py`. Abre http://localhost:8765.

Todo es local, sin APIs externas. React, ReactDOM y Babel están en `vendor/`.

## Endpoints reales que usa cada vista

| Vista | Endpoint LightRAG |
|---|---|
| Search (chat) | `POST /query` con `{query, mode, top_k}` |
| Documents (lista) | `POST /documents/paginated` |
| Documents (counts) | `GET /documents/status_counts` |
| Documents (retry all) | `POST /documents/reprocess_failed` |
| Document viewer | `GET /documents/{id}/content` (fallback: `content_summary`) |
| Graph Explorer | `GET /graphs?label=*&max_depth=3&max_nodes=200` |
| Health | `GET /health` + `GET /documents/status_counts` |
| Health (VRAM) | Ollama `GET /api/ps` (puerto 11434) |
| Pipeline panel | `GET /documents/pipeline_status` (polling cada 2.5s) |
| Pipeline retry | `POST /documents/reprocess_failed` |
| Pipeline clear | `POST /documents/clear_cache` |
| Health scan input | `POST /documents/scan` |

## Ficheros

- `LightRAG UI.html` — shell de la app
- `api.js` — cliente HTTP centralizado (`window.LightRAGAPI`)
- `*-view.jsx` / `*-panel.jsx` — vistas (cargadas con Babel-standalone)
- `vendor/` — React 18 + ReactDOM + Babel-standalone vendoreados (offline)
- `serve_ui.py` — servidor estático en :8765
- `start_ui.bat` — atajo para arrancar el server

## Configuración

Si LightRAG corre en otro puerto, antes de cargar el HTML inyecta:
```html
<script>window.LIGHTRAG_URL = 'http://localhost:9999';</script>
```

## Limitaciones conocidas

- **Document content**: LightRAG no expone un endpoint de "dame el texto plano" del doc — se cae al `content_summary` que sí está en `paginated`.
- **Sources del chat**: LightRAG devuelve la respuesta como string. El cliente intenta extraer las fuentes parseando bloques `### References` al final de la respuesta. Si tu modo no las incluye, la lista quedará vacía.
- **Pipeline cancel/retry per item**: la API solo permite reprocesar todos los fallidos (`reprocess_failed`). Los botones por-item están deshabilitados o reducen al global.
- **Activity log de Health**: muestra los últimos 20 mensajes del `pipeline_status.history_messages`. No hay un log persistente vía API.
- **Graph layout**: simulación de fuerzas hecha a mano. Si pasas de ~200 nodos puede ralentizar el render — `MAX_GRAPH_NODES=200` en `.env` lo limita server-side.
