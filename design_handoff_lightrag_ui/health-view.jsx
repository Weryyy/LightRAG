
// ── Health Dashboard View ─────────────────────────────────────────────────────

const ACTIVITY_LOG = [
  { ts: '14:32:01', path: 'estudio/dl-course/week7-attention.md',          status: 'processing', entities: null },
  { ts: '14:28:44', path: 'tecnica/api-docs/fastapi-lightrag.md',           status: 'ok',         entities: 38  },
  { ts: '14:28:12', path: 'proyectos/data-pipeline/etl-notes.md',           status: 'ok',         entities: 21  },
  { ts: '12:11:03', path: 'tecnica/papers/attention-is-all-you-need-notes.md', status: 'ok',      entities: 64  },
  { ts: '12:10:22', path: 'notas/2025-03-meeting-recording-transcript.txt', status: 'error',      entities: null, err: 'invalid UTF-8' },
  { ts: '11:59:17', path: 'estudio/math/linear-algebra-notes.md',           status: 'ok',         entities: 47  },
  { ts: '11:58:01', path: 'proyectos/infra/docker-compose.yml',             status: 'ok',         entities: 14  },
  { ts: '09:41:33', path: 'notas/2024-11-lightrag-setup.md',                status: 'ok',         entities: 29  },
  { ts: '09:40:11', path: 'tecnica/rag-systems/graph-rag-comparison.md',    status: 'ok',         entities: 52  },
  { ts: '09:38:55', path: 'proyectos/Master-IA-y-Bigdata/lightrag/README.md', status: 'ok',       entities: 83  },
];

function Sparkline({ data, color, width = 80, height = 28 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity="0.7"/>
    </svg>
  );
}

function VRAMGauge({ used, total }) {
  const pct = used / total;
  const color = pct > 0.85 ? '#ef4444' : pct > 0.65 ? '#f59e0b' : '#22c55e';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <span style={{ fontSize: '22px', fontWeight: '600', color, fontFamily: "'Inter', sans-serif" }}>{used} GB</span>
        <span style={{ fontSize: '12px', color: '#555', fontFamily: "'JetBrains Mono', monospace" }}>/ {total} GB</span>
      </div>
      <div style={{ height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct * 100}%`, background: color,
          borderRadius: '3px', transition: 'width 600ms ease',
          boxShadow: `0 0 8px ${color}60`,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
        <span style={{ fontSize: '10px', color: '#444' }}>Used</span>
        <span style={{ fontSize: '10px', color: '#444' }}>{Math.round(pct * 100)}%</span>
      </div>
    </div>
  );
}

function QueueAnimation({ pending }) {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (pending === 0) return;
    const t = setInterval(() => setTick(x => x + 1), 300);
    return () => clearInterval(t);
  }, [pending]);
  const blocks = [0,1,2,3,4].map(i => ({
    active: pending > 0 && (tick % 5) === i,
  }));
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '8px' }}>
      {blocks.map((b, i) => (
        <div key={i} style={{
          width: '18px', height: '8px', borderRadius: '2px',
          background: b.active ? '#7c6af7' : '#1a1a1a',
          transition: 'background 200ms ease',
          border: '1px solid #2a2a2a',
        }} />
      ))}
      <span style={{ fontSize: '11px', color: '#444', marginLeft: '6px', fontFamily: "'JetBrains Mono', monospace" }}>
        {pending > 0 ? 'processing...' : 'idle'}
      </span>
    </div>
  );
}

function HealthView() {
  const [confirmReindex, setConfirmReindex] = React.useState(false);
  const [reindexing, setReindexing] = React.useState(false);
  const [health, setHealth] = React.useState(null);
  const [counts, setCounts] = React.useState({ all: 0, processed: 0, failed: 0, processing: 0, pending: 0 });
  const [vram, setVram] = React.useState({ used: 0, total: 6, model: '—', loaded: false });
  const [graphStats, setGraphStats] = React.useState({ entities: 0, relations: 0, ratio: 0 });
  const [recentLog, setRecentLog] = React.useState([]);

  React.useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const [hp, sc, ollama, pipeline] = await Promise.all([
          window.LightRAGAPI.getHealth().catch(() => null),
          window.LightRAGAPI.getStatusCounts().catch(() => ({ status_counts: {} })),
          window.LightRAGAPI.getOllamaRunning().catch(() => ({ models: [] })),
          window.LightRAGAPI.getPipelineStatus().catch(() => null),
        ]);
        if (cancelled) return;
        if (hp) setHealth(hp);

        const status = sc.status_counts || sc;
        setCounts({
          all: status.all || status.total || 0,
          processed: status.processed || 0,
          failed: status.failed || 0,
          processing: status.processing || 0,
          pending: status.pending || 0,
        });

        // VRAM from Ollama running models (size_vram in bytes)
        const m = (ollama.models || [])[0];
        if (m) {
          setVram({
            used: +(m.size_vram / 1024 / 1024 / 1024).toFixed(1),
            total: 6,
            model: (m.name || m.model || '').split(':')[0],
            loaded: true,
          });
        } else if (hp) {
          setVram(v => ({ ...v, model: (hp.configuration?.llm_model || '').split(':')[0].split('/').pop(), loaded: false }));
        }

        // Graph density from pipeline messages or summary
        if (pipeline) {
          const msgs = (pipeline.history_messages || []).slice(-20);
          const log = msgs.map((msg, i) => {
            const lvl = msg.includes('Error') || msg.includes('Failed') ? 'error'
                      : msg.includes('Warning') ? 'warn' : 'ok';
            return { ts: new Date().toLocaleTimeString(), path: msg.slice(0, 80), status: lvl, entities: null };
          }).reverse();
          setRecentLog(log);
        }
      } catch (e) { /* ignore */ }
    };
    refresh();
    const t = setInterval(refresh, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const handleReindex = async () => {
    if (!confirmReindex) { setConfirmReindex(true); return; }
    setReindexing(true);
    setConfirmReindex(false);
    try {
      await window.LightRAGAPI.reprocessFailed();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setTimeout(() => setReindexing(false), 1500);
    }
  };

  const handleScan = async () => {
    try {
      await window.LightRAGAPI.scanInputDir();
    } catch (e) { alert('Scan error: ' + e.message); }
  };

  return (
    <div className="health-root" style={hv.root}>
      {/* Metric cards */}
      <div className="health-grid" style={hv.metricsGrid}>
        {/* Total docs */}
        <div style={hv.card}>
          <div style={hv.cardLabel}>Knowledge Base</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={hv.bigNum}>{counts.all.toLocaleString()}</div>
              <div style={hv.subText}>documents</div>
              <div style={{ ...hv.subText, marginTop: '2px' }}>
                {counts.processed} processed · {counts.failed} failed
              </div>
            </div>
            <Sparkline data={[10, 30, 80, 140, 220, 280, 360, 460, Math.max(500, counts.processed * 0.95), counts.processed]} color="#7c6af7" />
          </div>
        </div>

        {/* VRAM */}
        <div style={hv.card}>
          <div style={hv.cardLabel}>VRAM Usage</div>
          <VRAMGauge used={vram.used} total={vram.total} />
        </div>

        {/* Model */}
        <div style={hv.card}>
          <div style={hv.cardLabel}>Model</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ ...hv.bigNum, fontFamily: "'JetBrains Mono', monospace", fontSize: '16px', color: '#a78bfa' }}>{vram.model || '—'}</div>
              <div style={{ ...hv.subText, marginTop: '4px' }}>binding: {health?.configuration?.llm_binding || 'ollama'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: vram.loaded ? '#22c55e' : '#f59e0b', display: 'inline-block' }}></span>
                <span style={{ fontSize: '11px', color: vram.loaded ? '#22c55e' : '#f59e0b' }}>{vram.loaded ? 'Loaded' : 'Idle'}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: '#444', fontFamily: "'JetBrains Mono', monospace" }}>embed:</div>
              <div style={{ fontSize: '11px', color: '#666', fontFamily: "'JetBrains Mono', monospace" }}>{(health?.configuration?.embedding_model || 'nomic-embed').split('-')[0]}</div>
              <div style={{ fontSize: '10px', color: '#444', fontFamily: "'JetBrains Mono', monospace", marginTop: '4px' }}>workers:</div>
              <div style={{ fontSize: '11px', color: '#666', fontFamily: "'JetBrains Mono', monospace" }}>{health?.configuration?.max_async ?? '—'}</div>
            </div>
          </div>
        </div>

        {/* Queue */}
        <div style={hv.card}>
          <div style={hv.cardLabel}>Processing Queue</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={hv.bigNum}>{counts.pending} <span style={{ fontSize: '14px', color: '#555', fontWeight: '400' }}>pending</span></div>
              <div style={{ ...hv.subText, marginTop: '4px' }}>{counts.processing} processing · {counts.failed} failed</div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '600', color: '#22c55e', fontFamily: "'Inter', sans-serif" }}>
              {counts.processed}
            </div>
          </div>
          <QueueAnimation pending={counts.pending + counts.processing} />
        </div>
      </div>

      {/* Live Pipeline */}
      <div className="health-pipeline" style={{ marginBottom: '24px', display: 'flex' }}>
        <PipelinePanel />
      </div>

      {/* Activity log */}
      <div style={hv.logSection}>
        <div style={hv.logHeader}>
          <span style={hv.logTitle}>Activity Log</span>
          <span style={{ fontSize: '11px', color: '#444', fontFamily: "'JetBrains Mono', monospace" }}>last 10 events</span>
        </div>
        <div style={hv.logBody}>
          {(recentLog.length > 0 ? recentLog : ACTIVITY_LOG).map((entry, i) => (
            <div key={i} style={{ ...hv.logRow, background: i % 2 === 0 ? 'transparent' : '#0c0c0c' }}>
              <span style={hv.logTs}>{entry.ts}</span>
              <span style={{
                ...hv.logStatus,
                color: entry.status === 'ok' ? '#22c55e' : entry.status === 'error' ? '#ef4444' : '#f59e0b',
              }}>
                {entry.status === 'ok' ? 'OK' : entry.status === 'error' ? 'ERR' : '...'}
              </span>
              <span style={hv.logPath}>{entry.path}</span>
              {entry.entities != null && (
                <span style={hv.logEntities}>+{entry.entities} ent</span>
              )}
              {entry.err && (
                <span style={hv.logErr}>{entry.err}</span>
              )}
            </div>
          ))}
          {recentLog.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#444', fontSize: '11px' }}>
              No recent activity. (Mostrando log de muestra)
            </div>
          )}
        </div>
      </div>

      {/* Actions footer */}
      <div style={hv.actions}>
        <button
          style={{ ...hv.actionBtn, ...(confirmReindex ? hv.actionBtnDanger : {}) }}
          onClick={handleReindex}
          disabled={reindexing}
        >
          {reindexing ? 'Retrying…' : confirmReindex ? '⚠ Confirmar: Reprocesar fallidos?' : 'Reprocess failed'}
        </button>
        {confirmReindex && (
          <button style={hv.actionBtn} onClick={() => setConfirmReindex(false)}>Cancel</button>
        )}
        <button style={hv.actionBtn} onClick={handleScan}>Scan input dir</button>
        <a href={(window.LightRAGAPI?.LIGHTRAG_URL || 'http://localhost:9621') + '/docs'} target="_blank" rel="noreferrer" style={{...hv.actionBtnGhost, textDecoration: 'none'}}>API docs →</a>
      </div>
    </div>
  );
}

const hv = {
  root: { display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden', gap: '20px', minHeight: '100%' },
  metricsGrid: { display: 'grid', gap: '12px', flexShrink: 0 },
  card: { background: '#111', border: '1px solid #1f1f1f', borderRadius: '8px', padding: '16px 18px' },
  cardLabel: { fontSize: '10px', color: '#444', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: '12px' },
  bigNum: { fontSize: '26px', fontWeight: '700', color: '#f0f0f0', lineHeight: 1.1 },
  subText: { fontSize: '11px', color: '#555', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" },
  logSection: { background: '#111', border: '1px solid #1f1f1f', borderRadius: '8px', display: 'flex', flexDirection: 'column', minHeight: '200px', maxHeight: '360px', overflow: 'hidden' },
  logHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #1a1a1a' },
  logTitle: { fontSize: '11px', color: '#555', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' },
  logBody: { overflowY: 'auto', flex: 1, fontFamily: "'JetBrains Mono', monospace" },
  logRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 14px', fontSize: '11px', lineHeight: 1 },
  logTs: { color: '#444', flexShrink: 0, width: '60px' },
  logStatus: { flexShrink: 0, width: '28px', fontWeight: '600' },
  logPath: { color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  logEntities: { color: '#7c6af7', flexShrink: 0, fontSize: '10px' },
  logErr: { color: '#ef4444', flexShrink: 0, fontSize: '10px' },
  actions: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' },
  actionBtn: {
    padding: '7px 14px', borderRadius: '6px', border: '1px solid #2a2a2a',
    background: '#161616', color: '#888', fontSize: '12px', cursor: 'pointer',
    fontFamily: "'Inter', sans-serif", transition: 'all 150ms ease',
  },
  actionBtnDanger: { borderColor: '#ef444460', background: '#1e0d0d', color: '#ef4444' },
  actionBtnGhost: {
    padding: '7px 14px', borderRadius: '6px', border: 'none',
    background: 'transparent', color: '#555', fontSize: '12px', cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
  },
};

Object.assign(window, { HealthView });
