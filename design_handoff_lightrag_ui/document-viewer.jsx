
// ── Document Viewer Modal ─────────────────────────────────────────────────────

const MOCK_DOC_CONTENT = {
  'proyectos/Master-IA-y-Bigdata/lightrag/README.md': `# LightRAG

Graph-based RAG system for local AI knowledge bases.

## Overview

LightRAG builds a **knowledge graph** from your documents instead of relying purely on vector similarity. This enables more contextual, connected answers.

## Setup

\`\`\`bash
docker compose up -d --build
curl http://localhost:9621/health
\`\`\`

## Architecture

- **Ollama** — local LLM inference
- **FastAPI** — REST API on port 9621
- **PostgreSQL + pgvector** — vector storage
- **Neo4j** (optional) — graph persistence

## Models

Default: \`qwen2.5:7b\` (4-bit quantized, ~5GB VRAM)
Embedding: \`nomic-embed-text\``,

  'estudio/deep-learning/transformers-architecture.md': `# Transformer Architecture

Notes from "Attention is All You Need" (Vaswani et al., 2017).

## Self-Attention

\`\`\`
Attention(Q, K, V) = softmax(QKᵀ / √d_k) · V
\`\`\`

The scaling factor \`√d_k\` prevents the softmax from saturating when dimensions are large.

## Multi-Head Attention

Run attention in parallel with multiple "heads", each learning different patterns. Concatenate and project.

## Position Encoding

Since attention is permutation-invariant, positional information must be injected. Original paper uses sinusoidal encodings.`,

  'tecnica/rag-systems/graph-rag-comparison.md': `# Graph RAG vs Vector RAG

| Feature        | Vector RAG | Graph RAG |
|----------------|-----------|-----------|
| Retrieval      | Similarity | Traversal |
| Context        | Local      | Global    |
| Setup cost     | Low        | High      |
| Answer quality | OK         | Better    |

## When to use Graph RAG

- Questions requiring multi-hop reasoning
- Domains with rich entity relationships
- When source attribution matters`,

  default: `*Document content not available in this preview.*

This file would be loaded from the LightRAG REST API at:
\`GET http://localhost:9621/documents/{id}/content\``,
};

function getDocContent(path) {
  return MOCK_DOC_CONTENT[path] || MOCK_DOC_CONTENT.default;
}

function renderDocMarkdown(text) {
  return text
    .replace(/```([\s\S]*?)```/g, '<pre style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:6px;padding:12px;overflow-x:auto;margin:8px 0;font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#c4b5fd;line-height:1.6">$1</pre>')
    .replace(/`([^`]+)`/g, '<code style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#a78bfa;background:#1a1530;padding:1px 5px;border-radius:3px">$1</code>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:700;color:#f0f0f0;margin:18px 0 10px">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:15px;font-weight:600;color:#f0f0f0;margin:14px 0 8px">$1</h2>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#f0f0f0;font-weight:600">$1</strong>')
    .replace(/^\| (.+) \|$/gm, m => {
      const cells = m.slice(2, -2).split(' | ');
      return `<tr>${cells.map(c => `<td style="padding:6px 10px;border:1px solid #1f1f1f;font-size:12px;color:#c0c0c0">${c}</td>`).join('')}</tr>`;
    })
    .replace(/(<tr>.+<\/tr>\n?)+/gs, m => `<table style="border-collapse:collapse;margin:8px 0;background:#0d0d0d">${m}</table>`)
    .replace(/^- (.+)$/gm, '<li style="color:#c0c0c0;margin:3px 0;list-style:none;padding-left:14px;position:relative"><span style="position:absolute;left:0;color:#7c6af7">·</span>$1</li>')
    .replace(/\n\n/g, '<div style="height:6px"></div>');
}

function DocumentViewer({ doc, onClose }) {
  const [content, setContent] = React.useState('Loading…');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  React.useEffect(() => {
    if (!doc) return;
    setLoading(true);
    const fallback = doc.content_summary || `*Resumen no disponible para \`${doc.path}\`.*`;
    window.LightRAGAPI
      .getDocumentContent(doc.id, fallback)
      .then(setContent)
      .finally(() => setLoading(false));
  }, [doc]);

  if (!doc) return null;
  const parts = doc.path.split('/');
  const fname = parts[parts.length - 1];

  return (
    <div style={dvm.overlay} onClick={onClose}>
      <div style={dvm.modal} onClick={e => e.stopPropagation()}>
        <div style={dvm.header}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={dvm.fname}>{fname}</div>
            <div style={dvm.fpath}>{doc.path}</div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={dvm.metaTag}>{doc.size}</span>
            <span style={dvm.metaTag}>{doc.indexed}</span>
            <button style={dvm.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>
        <div style={dvm.body} dangerouslySetInnerHTML={{ __html: renderDocMarkdown(content) }} />
        <div style={dvm.footer}>
          <span style={{ fontSize: '11px', color: '#3a3a3a', fontFamily: "'JetBrains Mono', monospace" }}>
            press <kbd style={dvm.kbd}>Esc</kbd> to close
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button style={dvm.action}>Open in editor</button>
            <button style={dvm.action}>Copy path</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const dvm = {
  overlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(4px)', zIndex: 50,
    display: 'flex', alignItems: 'stretch', justifyContent: 'center',
    padding: '12px',
  },
  modal: {
    background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: '10px',
    width: '100%', maxWidth: '780px', minHeight: 0,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 18px', borderBottom: '1px solid #1f1f1f', flexShrink: 0,
  },
  fname: { fontSize: '14px', fontWeight: '600', color: '#f0f0f0', fontFamily: "'JetBrains Mono', monospace" },
  fpath: { fontSize: '11px', color: '#555', fontFamily: "'JetBrains Mono', monospace", marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  metaTag: { fontSize: '10px', color: '#666', fontFamily: "'JetBrains Mono', monospace", padding: '2px 7px', background: '#161616', border: '1px solid #1f1f1f', borderRadius: '4px' },
  closeBtn: { background: 'none', border: '1px solid #2a2a2a', borderRadius: '5px', color: '#888', cursor: 'pointer', padding: '4px 9px', fontSize: '12px' },
  body: { flex: 1, overflowY: 'auto', padding: '20px 24px', fontFamily: "'Inter', sans-serif", fontSize: '13px', lineHeight: 1.7, color: '#c0c0c0' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid #1f1f1f', flexShrink: 0 },
  kbd: { fontSize: '10px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '3px', padding: '1px 4px', color: '#888' },
  action: { fontSize: '12px', padding: '5px 12px', borderRadius: '5px', border: '1px solid #2a2a2a', background: '#161616', color: '#888', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
};

Object.assign(window, { DocumentViewer });
