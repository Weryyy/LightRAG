// ── LightRAG API client (all calls local) ────────────────────────────────────
// Base URL of the LightRAG REST server. Override with window.LIGHTRAG_URL if you
// run on a different port.
const LIGHTRAG_URL = window.LIGHTRAG_URL || 'http://localhost:9621';
const OLLAMA_URL   = window.OLLAMA_URL   || 'http://localhost:11434';

// ── Category derivation from file_source prefix ──────────────────────────────
// LightRAG's file_source uses the format `[categoria] proyectos/...`.
// Fallback: derive from path prefix.
function categoryFromSource(source) {
  if (!source) return 'tecnica';
  const m = source.match(/^\[(\w+)\]/);
  if (m) return m[1];
  if (source.startsWith('proyectos')) return 'proyectos';
  if (source.startsWith('estudio'))   return 'estudio';
  if (source.startsWith('notas'))     return 'notas';
  if (source.startsWith('tecnica'))   return 'tecnica';
  return 'tecnica';
}

function stripCategoryPrefix(source) {
  if (!source) return '';
  return source.replace(/^\[\w+\]\s*/, '');
}

function relativeTime(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '—';
  const sec = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (sec < 60)        return `${sec}s ago`;
  if (sec < 3600)      return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400)     return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

function humanSize(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

// ── HTTP helper ──────────────────────────────────────────────────────────────
async function httpJson(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

// ── Health & status ──────────────────────────────────────────────────────────
async function getHealth() {
  return httpJson(`${LIGHTRAG_URL}/health`);
}

async function getStatusCounts() {
  return httpJson(`${LIGHTRAG_URL}/documents/status_counts`);
}

async function getPipelineStatus() {
  return httpJson(`${LIGHTRAG_URL}/documents/pipeline_status`);
}

// ── Ollama (VRAM / running models) ────────────────────────────────────────────
async function getOllamaRunning() {
  try {
    return await httpJson(`${OLLAMA_URL}/api/ps`);
  } catch (e) {
    return { models: [] };
  }
}

// ── Query (search view) ──────────────────────────────────────────────────────
// LightRAG /query returns { response: "<text>" }. We fake out sources/meta
// since the simple endpoint doesn't include them. For sources we issue a
// secondary call to /query with `only_need_context: true` if you want details.
async function runQuery(query, mode = 'hybrid') {
  const t0 = performance.now();
  const data = await httpJson(`${LIGHTRAG_URL}/query`, {
    method: 'POST',
    body: JSON.stringify({ query, mode, top_k: 10 }),
  });
  const elapsed = Math.round(performance.now() - t0);
  const answer = (typeof data === 'string') ? data : (data.response || data.answer || JSON.stringify(data));
  // Try to extract "References" or "Sources" block at the end of the answer
  const sources = extractSources(answer);
  return {
    answer: answer.replace(/\n*###?\s*References[\s\S]*$/i, '').trim(),
    sources,
    meta: { mode, time: elapsed, entities: sources.length },
  };
}

function extractSources(text) {
  if (!text) return [];
  // Look for "References" / "Sources" section common in RAG outputs
  const refMatch = text.match(/###?\s*(References|Sources|Fuentes)[\s\S]+/i);
  if (!refMatch) return [];
  const lines = refMatch[0].split('\n').slice(1);
  const sources = [];
  for (const line of lines) {
    const m = line.match(/[-*\d.]+\s*\[?\s*([^\]\)]+\.(?:md|py|ipynb|js|ts|txt|yml|yaml|toml|sh|c|cpp|h|rst))/i);
    if (m) {
      const path = stripCategoryPrefix(m[1].trim());
      sources.push({ path, category: categoryFromSource(m[1]) });
      if (sources.length >= 8) break;
    }
  }
  return sources;
}

// ── Documents (paginated list) ────────────────────────────────────────────────
async function listDocuments({ status = 'all', page = 1, pageSize = 100, search = '' } = {}) {
  const body = {
    page,
    page_size: pageSize,
    sort_field: 'updated_at',
    sort_direction: 'desc',
  };
  if (status && status !== 'all') body.status_filter = status;
  if (search) body.search = search;

  const data = await httpJson(`${LIGHTRAG_URL}/documents/paginated`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  // Accept either { documents: [...], pagination: {...} } or a raw list
  const docs = data.documents || data.docs || (Array.isArray(data) ? data : []);
  return docs.map(rawDocToUi);
}

function rawDocToUi(d) {
  const source = d.file_source || d.file_path || d.id || '';
  const cleanPath = stripCategoryPrefix(source);
  const category = categoryFromSource(source);
  let size = d.content_length ? humanSize(d.content_length) : (d.chunks_count ? `${d.chunks_count} chunks` : '—');
  return {
    id: d.id || d._id || source,
    status: d.status || 'pending',
    path: cleanPath || source,
    fullSource: source,
    category,
    size,
    indexed: relativeTime(d.updated_at || d.created_at),
    error: d.error_msg || null,
    chunks_count: d.chunks_count,
    content_summary: d.content_summary,
  };
}

// ── Reprocess / retry ────────────────────────────────────────────────────────
async function reprocessFailed() {
  return httpJson(`${LIGHTRAG_URL}/documents/reprocess_failed`, { method: 'POST' });
}

async function clearCache() {
  return httpJson(`${LIGHTRAG_URL}/documents/clear_cache`, { method: 'POST', body: '{}' });
}

async function cancelPipeline() {
  return httpJson(`${LIGHTRAG_URL}/documents/cancel_pipeline`, { method: 'POST' });
}

// ── Document content (best effort) ───────────────────────────────────────────
// LightRAG doesn't expose a single "give me the text" endpoint, but
// /documents/paginated returns content_summary. For full content we hit
// /documents/{id}/content if it exists; otherwise fall back to the summary.
async function getDocumentContent(docId, fallbackSummary = '') {
  try {
    const data = await httpJson(`${LIGHTRAG_URL}/documents/${encodeURIComponent(docId)}/content`);
    return (typeof data === 'string') ? data : (data.content || data.text || fallbackSummary);
  } catch {
    return fallbackSummary || '*Document content not available — LightRAG does not expose a content endpoint for this doc.*';
  }
}

// ── Graph (entities + relations) ─────────────────────────────────────────────
// /graphs?label=*&max_depth=N returns { nodes, edges }. The wildcard label
// returns the full graph (capped at MAX_GRAPH_NODES, default 200).
async function getGraph({ label = '*', maxDepth = 3, maxNodes = 200 } = {}) {
  const params = new URLSearchParams({ label, max_depth: String(maxDepth), max_nodes: String(maxNodes) });
  const data = await httpJson(`${LIGHTRAG_URL}/graphs?${params}`);
  // Normalize nodes
  const rawNodes = data.nodes || [];
  const rawEdges = data.edges || data.relationships || [];

  const nodes = rawNodes.map((n, i) => ({
    id:   n.id || n.name || String(i),
    name: n.labels?.[0] || n.id || n.name || `Node ${i}`,
    type: pickEntityType(n.properties || n.props || {}),
    desc: (n.properties && (n.properties.description || n.properties.entity_description)) || '',
    docs: (n.properties && n.properties.source_id ? String(n.properties.source_id).split(/[,;<>]+/).filter(Boolean).slice(0, 5) : []),
  }));

  // Build numeric ID map for the visualization (it expects integers)
  const idMap = {};
  nodes.forEach((n, i) => { idMap[n.id] = i + 1; n.id = i + 1; });

  const edges = rawEdges
    .map(e => [idMap[e.source], idMap[e.target]])
    .filter(([a, b]) => a !== undefined && b !== undefined);

  return { nodes, edges };
}

function pickEntityType(props) {
  const t = (props.entity_type || props.type || 'concept').toString().toLowerCase();
  if (t.includes('person') || t.includes('organi')) return 'Person';
  if (t.includes('tech') || t.includes('tool'))     return 'Technology';
  if (t.includes('framework') || t.includes('library')) return 'Framework';
  if (t.includes('file') || t.includes('document'))     return 'File';
  return 'Concept';
}

async function getEntityDetail(name) {
  try {
    return await httpJson(`${LIGHTRAG_URL}/graphs/entity/${encodeURIComponent(name)}`);
  } catch {
    return null;
  }
}

// ── Re-indexing (Health view) ────────────────────────────────────────────────
async function scanInputDir() {
  return httpJson(`${LIGHTRAG_URL}/documents/scan`, { method: 'POST' });
}

// ── Public surface ───────────────────────────────────────────────────────────
window.LightRAGAPI = {
  LIGHTRAG_URL,
  OLLAMA_URL,
  getHealth,
  getStatusCounts,
  getPipelineStatus,
  getOllamaRunning,
  runQuery,
  listDocuments,
  reprocessFailed,
  clearCache,
  cancelPipeline,
  getDocumentContent,
  getGraph,
  getEntityDetail,
  scanInputDir,
  // helpers
  categoryFromSource,
  stripCategoryPrefix,
  relativeTime,
  humanSize,
};
