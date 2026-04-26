
// ── Documents View ────────────────────────────────────────────────────────────

const CATEGORY_COLORS_D = {
  proyectos: { bg: '#1a2a3a', text: '#60a5fa', border: '#1e3a52' },
  estudio:   { bg: '#1a2e1a', text: '#4ade80', border: '#1e3d1e' },
  notas:     { bg: '#2e2010', text: '#fb923c', border: '#3d2a10' },
  tecnica:   { bg: '#221a36', text: '#a78bfa', border: '#2d2048' },
};

const MOCK_DOCS = [
  { id: 1,  status: 'processed', path: 'proyectos/Master-IA-y-Bigdata/lightrag/README.md',         category: 'proyectos', size: '18.4 KB', indexed: '2h ago' },
  { id: 2,  status: 'processed', path: 'estudio/deep-learning/transformers-architecture.md',        category: 'estudio',   size: '42.1 KB', indexed: '2h ago' },
  { id: 3,  status: 'failed',    path: 'proyectos/Master-IA-y-Bigdata/NLP/corpus-large.jsonl',      category: 'proyectos', size: '214 MB',  indexed: '2h ago', error: 'File too large (>200MB limit)' },
  { id: 4,  status: 'processed', path: 'tecnica/rag-systems/graph-rag-comparison.md',               category: 'tecnica',   size: '9.7 KB',  indexed: '3h ago' },
  { id: 5,  status: 'processed', path: 'notas/2024-11-lightrag-setup.md',                           category: 'notas',     size: '6.2 KB',  indexed: '3h ago' },
  { id: 6,  status: 'processing',path: 'estudio/dl-course/week7-attention.md',                      category: 'estudio',   size: '11.3 KB', indexed: 'now' },
  { id: 7,  status: 'processed', path: 'tecnica/papers/attention-is-all-you-need-notes.md',         category: 'tecnica',   size: '7.8 KB',  indexed: '5h ago' },
  { id: 8,  status: 'processed', path: 'proyectos/infra/docker-compose.yml',                        category: 'proyectos', size: '3.1 KB',  indexed: '1d ago' },
  { id: 9,  status: 'failed',    path: 'notas/2025-03-meeting-recording-transcript.txt',            category: 'notas',     size: '890 KB',  indexed: '1d ago', error: 'Parse error: invalid UTF-8 sequence at byte 4821' },
  { id: 10, status: 'processed', path: 'estudio/math/linear-algebra-notes.md',                     category: 'estudio',   size: '23.9 KB', indexed: '2d ago' },
  { id: 11, status: 'processed', path: 'tecnica/api-docs/fastapi-lightrag.md',                      category: 'tecnica',   size: '14.2 KB', indexed: '2d ago' },
  { id: 12, status: 'processed', path: 'proyectos/data-pipeline/etl-notes.md',                     category: 'proyectos', size: '8.5 KB',  indexed: '3d ago' },
];

const STATUS_ICON = {
  processed:  <span title="Processed" style={{ color: '#22c55e', fontSize: '14px' }}>✓</span>,
  failed:     <span title="Failed"    style={{ color: '#ef4444', fontSize: '14px' }}>✕</span>,
  processing: <ProcessingIcon />,
};

function ProcessingIcon() {
  const [dots, setDots] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 400);
    return () => clearInterval(t);
  }, []);
  return <span style={{ color: '#f59e0b', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>{'⟳'}</span>;
}

function DocumentsView({ initialQuery = '' }) {
  const [selected, setSelected] = React.useState(new Set());
  const [hovered, setHovered] = React.useState(null);
  const [confirmReindex, setConfirmReindex] = React.useState(false);
  const [viewing, setViewing] = React.useState(null);
  const [query, setQuery] = React.useState(initialQuery);
  const [catFilter, setCatFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [docs, setDocs] = React.useState([]);
  const [counts, setCounts] = React.useState({ all: 0, processed: 0, failed: 0, processing: 0, pending: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => { if (initialQuery) setQuery(initialQuery); }, [initialQuery]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, statusCounts] = await Promise.all([
        window.LightRAGAPI.listDocuments({ pageSize: 500 }),
        window.LightRAGAPI.getStatusCounts(),
      ]);
      setDocs(list);
      const sc = statusCounts.status_counts || statusCounts;
      setCounts({
        all: sc.all || sc.total || list.length,
        processed: sc.processed || 0,
        failed: sc.failed || 0,
        processing: sc.processing || 0,
        pending: sc.pending || 0,
      });
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { refresh(); const t = setInterval(refresh, 8000); return () => clearInterval(t); }, [refresh]);

  const filtered = docs.filter(d => {
    if (catFilter !== 'all' && d.category !== catFilter) return false;
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (!d.path.toLowerCase().includes(q) && !d.category.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const total = counts.all;
  const processed = counts.processed;
  const failed = counts.failed;
  const processing = counts.processing + counts.pending;

  const categories = ['all', 'proyectos', 'estudio', 'notas', 'tecnica'];
  const statuses = ['all', 'processed', 'processing', 'failed', 'pending'];

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(d => d.id)));
  };

  return (
    <div style={dv.root}>
      {/* Stats bar */}
      <div style={dv.statsBar}>
        <StatCard label="Total docs" value={total} color="#f0f0f0" />
        <StatCard label="Processed" value={processed} color="#22c55e" />
        <StatCard label="Failed" value={failed} color="#ef4444" action={failed > 0 && <RetryAllBtn />} />
        <StatCard label="Processing" value={processing} color="#f59e0b" />
        <StatCard label="Last indexed" value="2h ago" color="#888" isText />
      </div>

      {/* Search + filters */}
      <div style={dv.searchBar}>
        <div style={dv.searchInputWrap}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="5.5" cy="5.5" r="3.8" stroke="#555" strokeWidth="1.3"/>
            <line x1="8.5" y1="8.5" x2="11.5" y2="11.5" stroke="#555" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by path, filename, category…"
            style={dv.searchInput}
          />
          {query && (
            <button style={dv.clearBtn} onClick={() => setQuery('')}>×</button>
          )}
        </div>
        <div style={dv.filterGroup}>
          <span style={dv.filterLabel}>category</span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              style={{
                ...dv.filterChip,
                ...(catFilter === cat ? dv.filterChipActive : {}),
              }}
            >
              {cat}
            </button>
          ))}
        </div>
        <div style={dv.filterGroup}>
          <span style={dv.filterLabel}>status</span>
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                ...dv.filterChip,
                ...(statusFilter === s ? dv.filterChipActive : {}),
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <div style={dv.resultCount}>
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
          {(query || catFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => { setQuery(''); setCatFilter('all'); setStatusFilter('all'); }}
              style={dv.clearAllBtn}
            >clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={dv.tableWrap}>
        <table style={dv.table}>
          <thead>
            <tr style={dv.theadRow}>
              <th style={{ ...dv.th, width: '32px' }}>
                <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  style={dv.checkbox}
                />
              </th>
              <th style={{ ...dv.th, width: '28px' }}></th>
              <th style={dv.th}>File</th>
              <th style={dv.th}>Category</th>
              <th style={{ ...dv.th, width: '80px' }}>Size</th>
              <th style={{ ...dv.th, width: '80px' }}>Indexed</th>
              <th style={{ ...dv.th, width: '64px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan="7" style={dv.emptyRow}>No documents match your filters.</td></tr>
            )}
            {filtered.map(doc => {
              const c = CATEGORY_COLORS_D[doc.category] || CATEGORY_COLORS_D.tecnica;
              const isHov = hovered === doc.id;
              const isSel = selected.has(doc.id);
              const isFailed = doc.status === 'failed';
              return (
                <tr
                  key={doc.id}
                  onMouseEnter={() => setHovered(doc.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    ...dv.tr,
                    background: isFailed ? '#170c0c' : isSel ? '#14121f' : isHov ? '#141414' : 'transparent',
                    borderLeft: isFailed ? '2px solid #ef444430' : '2px solid transparent',
                  }}
                >
                  <td style={dv.td}>
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleSelect(doc.id)}
                      style={dv.checkbox}
                    />
                  </td>
                  <td style={dv.td}>{STATUS_ICON[doc.status]}</td>
                  <td style={dv.td}>
                    <div>
                      <div style={dv.filePath}>{doc.path}</div>
                      {isFailed && doc.error && (
                        <div style={dv.errorMsg}>{doc.error}</div>
                      )}
                    </div>
                  </td>
                  <td style={dv.td}>
                    <span style={{ ...dv.catBadge, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                      {doc.category}
                    </span>
                  </td>
                  <td style={{ ...dv.td, ...dv.numCell }}>{doc.size}</td>
                  <td style={{ ...dv.td, ...dv.numCell }}>{doc.indexed}</td>
                  <td style={dv.td}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      {isFailed && (
                        <button style={{ ...dv.actionBtn, borderColor: '#ef444460', color: '#ef4444' }}>
                          Retry
                        </button>
                      )}
                      {doc.status === 'processed' && (
                        <button
                          style={{ ...dv.actionBtn, borderColor: '#7c6af740', color: '#a78bfa', background: '#1a1530' }}
                          onClick={() => setViewing(doc)}
                        >
                          View
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Batch bar */}
      {selected.size > 0 && (
        <div style={dv.batchBar}>
          <span style={{ fontSize: '13px', color: '#888' }}>{selected.size} selected</span>
          <button style={dv.batchBtn} onClick={() => setSelected(new Set())}>Clear</button>
          <button style={dv.batchBtnPrimary}>Re-index selected</button>
        </div>
      )}
      {/* Doc viewer modal */}
      {viewing && <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function StatCard({ label, value, color, action, isText }) {
  return (
    <div style={dv.statCard}>
      <div style={{ fontSize: isText ? '16px' : '22px', fontWeight: '600', color, fontFamily: isText ? "'JetBrains Mono', monospace" : "'Inter', sans-serif", display: 'flex', alignItems: 'center', gap: '8px' }}>
        {value}
        {action}
      </div>
      <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

function RetryAllBtn() {
  const [busy, setBusy] = React.useState(false);
  const click = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await window.LightRAGAPI.reprocessFailed();
    } catch (e) {
      alert('Retry failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button onClick={click} disabled={busy} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', border: '1px solid #ef444440', background: 'transparent', color: '#ef4444', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
      {busy ? 'retrying…' : 'retry all'}
    </button>
  );
}

const dv = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '24px 32px', gap: '16px', position: 'relative' },
  searchBar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', flexShrink: 0 },
  searchInputWrap: { display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 220px', minWidth: '200px', padding: '7px 11px', background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: '6px' },
  searchInput: { flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e0e0e0', fontSize: '12px', fontFamily: "'Inter', sans-serif" },
  clearBtn: { width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: '#1a1a1a', color: '#666', borderRadius: '50%', cursor: 'pointer', fontSize: '12px', lineHeight: 1 },
  filterGroup: { display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' },
  filterLabel: { fontSize: '10px', color: '#444', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em', marginRight: '4px' },
  filterChip: { padding: '3px 9px', borderRadius: '4px', border: '1px solid #1f1f1f', background: 'transparent', color: '#666', fontSize: '11px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", textTransform: 'lowercase' },
  filterChipActive: { borderColor: '#7c6af740', background: '#1a1530', color: '#a78bfa' },
  resultCount: { marginLeft: 'auto', fontSize: '11px', color: '#555', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: '8px' },
  clearAllBtn: { background: 'transparent', border: 'none', color: '#7c6af7', fontSize: '11px', cursor: 'pointer', padding: '0', marginLeft: '6px', textDecoration: 'underline' },
  emptyRow: { textAlign: 'center', padding: '32px', color: '#555', fontSize: '12px', fontStyle: 'italic' },
  statsBar: { display: 'flex', gap: '12px', flexShrink: 0, flexWrap: 'wrap' },
  statCard: {
    background: '#111', border: '1px solid #1f1f1f', borderRadius: '8px',
    padding: '14px 18px', minWidth: '120px', flex: '1',
  },
  tableWrap: { flex: 1, overflowY: 'auto', borderRadius: '8px', border: '1px solid #1f1f1f' },
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: "'Inter', sans-serif" },
  theadRow: { borderBottom: '1px solid #1f1f1f', background: '#0d0d0d' },
  th: {
    padding: '9px 12px', textAlign: 'left', fontSize: '11px', color: '#444',
    fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em',
    fontWeight: '400', userSelect: 'none',
  },
  tr: { borderBottom: '1px solid #161616', transition: 'background 100ms ease' },
  td: { padding: '9px 12px', verticalAlign: 'middle' },
  filePath: {
    fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#c0c0c0',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '420px',
  },
  errorMsg: { fontSize: '11px', color: '#ef4444', marginTop: '3px', fontFamily: "'JetBrains Mono', monospace" },
  catBadge: { fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' },
  numCell: { fontSize: '12px', color: '#555', fontFamily: "'JetBrains Mono', monospace" },
  actionBtn: {
    padding: '3px 10px', borderRadius: '5px', border: '1px solid #2a2a2a',
    background: '#161616', color: '#888', fontSize: '11px', cursor: 'pointer',
    transition: 'all 150ms ease', whiteSpace: 'nowrap',
  },
  checkbox: { accentColor: '#7c6af7', cursor: 'pointer' },
  batchBar: {
    flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px',
    background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 16px',
  },
  batchBtn: { padding: '5px 12px', borderRadius: '6px', border: '1px solid #2a2a2a', background: 'transparent', color: '#666', fontSize: '12px', cursor: 'pointer' },
  batchBtnPrimary: { padding: '5px 14px', borderRadius: '6px', border: '1px solid #7c6af740', background: '#1a1530', color: '#a78bfa', fontSize: '12px', cursor: 'pointer' },
};

Object.assign(window, { DocumentsView });
