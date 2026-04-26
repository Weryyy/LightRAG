
// ── Pipeline Panel ────────────────────────────────────────────────────────────

const INITIAL_PIPELINE = [
  { id: 'p1', path: 'estudio/dl-course/week7-attention.md',          status: 'processing', progress: 0.42, stage: 'extracting entities' },
  { id: 'p2', path: 'tecnica/api-docs/fastapi-endpoints-v2.md',      status: 'queued',     progress: 0,    stage: 'waiting' },
  { id: 'p3', path: 'proyectos/data-pipeline/etl-improvements.md',   status: 'queued',     progress: 0,    stage: 'waiting' },
  { id: 'p4', path: 'notas/2025-04-team-meeting.md',                 status: 'queued',     progress: 0,    stage: 'waiting' },
];

const INITIAL_LOGS = [
  { ts: '14:32:08', level: 'info',  msg: '[ingest] starting pipeline worker (concurrency=2)' },
  { ts: '14:32:09', level: 'info',  msg: '[chunk]  week7-attention.md → 14 chunks' },
  { ts: '14:32:10', level: 'info',  msg: '[embed]  generating embeddings batch=14' },
  { ts: '14:32:12', level: 'ok',    msg: '[embed]  ✓ batch complete (1.8s)' },
  { ts: '14:32:13', level: 'info',  msg: '[entity] extracting entities via qwen2.5:7b' },
];

const STAGES = ['waiting','chunking','embedding','extracting entities','linking relations','indexing'];

function nowTs() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function classifyLog(msg) {
  const m = msg.toLowerCase();
  if (m.includes('error') || m.includes('failed')) return 'err';
  if (m.includes('warning')) return 'warn';
  if (m.includes('merged') || m.includes('extracted') || m.includes('processed') || m.includes('completed')) return 'ok';
  return 'info';
}

function PipelinePanel() {
  const [items, setItems] = React.useState([]);
  const [logs, setLogs] = React.useState([]);
  const [paused, setPaused] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [job, setJob] = React.useState({ name: '', cur: 0, total: 0 });
  const logRef = React.useRef(null);
  const seenLogsRef = React.useRef(new Set());

  // Poll real LightRAG pipeline
  React.useEffect(() => {
    if (paused) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await window.LightRAGAPI.getPipelineStatus();
        if (cancelled) return;
        setBusy(!!data.busy);
        setJob({
          name: data.job_name || '',
          cur:  data.cur_batch || 0,
          total: data.batchs || data.docs || 0,
        });

        // Build a synthetic queue: 1 processing + N pending derived from job counts
        const queueItems = [];
        if (data.busy) {
          queueItems.push({
            id: 'current',
            path: (data.latest_message || data.job_name || 'processing').slice(0, 80),
            status: 'processing',
            progress: data.batchs ? Math.min(0.99, (data.cur_batch || 0) / data.batchs) : 0.5,
            stage: data.latest_message ? data.latest_message.split(':')[0].toLowerCase().slice(0, 30) : 'processing',
          });
        }
        const pendingCount = Math.max(0, (data.batchs || 0) - (data.cur_batch || 0) - 1);
        if (pendingCount > 0) {
          queueItems.push({
            id: 'queued-summary',
            path: `+${pendingCount} more docs queued…`,
            status: 'queued',
            progress: 0,
            stage: 'waiting',
          });
        }
        setItems(queueItems);

        // Append new history messages to the live log
        const seen = seenLogsRef.current;
        const newLines = [];
        for (const msg of (data.history_messages || []).slice(-25)) {
          if (seen.has(msg)) continue;
          seen.add(msg);
          newLines.push({ ts: nowTs(), level: classifyLog(msg), msg });
        }
        if (newLines.length > 0) {
          setLogs(prev => [...prev, ...newLines].slice(-80));
        }
      } catch (e) {
        if (!cancelled) {
          setLogs(prev => [...prev, { ts: nowTs(), level: 'err', msg: `[pipeline] ${e.message}` }].slice(-80));
        }
      }
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => { cancelled = true; clearInterval(t); };
  }, [paused]);

  React.useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);

  const cancel = (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setLogs(prev => [...prev, { ts: nowTs(), level: 'warn', msg: `[ui] hidden ${id} from local view` }]);
  };
  const retry = async () => {
    try {
      await window.LightRAGAPI.reprocessFailed();
      setLogs(prev => [...prev, { ts: nowTs(), level: 'ok', msg: '[reprocess] failed docs re-queued' }]);
    } catch (e) {
      setLogs(prev => [...prev, { ts: nowTs(), level: 'err', msg: '[reprocess] ' + e.message }]);
    }
  };
  const cancelAll = async () => {
    try {
      const r = await window.LightRAGAPI.cancelPipeline();
      const msg = r?.status === 'not_busy' ? '[cancel] pipeline not running' : '[cancel] cancellation requested — pipeline stopping';
      setLogs(prev => [...prev, { ts: nowTs(), level: 'warn', msg }]);
    } catch (e) {
      setLogs(prev => [...prev, { ts: nowTs(), level: 'err', msg: '[cancel] ' + e.message }]);
    }
  };

  const active = items.length;

  return (
    <div style={pp.root}>
      <div style={pp.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: paused ? '#f59e0b' : (active > 0 ? '#22c55e' : '#555'),
            animation: !paused && active > 0 ? 'pulse 1.4s infinite' : 'none',
          }}></span>
          <span style={pp.title}>Ingest Pipeline</span>
          <span style={pp.activeCount}>{active} active</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button title="Reprocess all failed docs" style={{ ...pp.btn, borderColor: '#22c55e40', color: '#22c55e' }} onClick={retry}>
            ↻ Retry failed
          </button>
          <button style={pp.btn} onClick={() => setPaused(p => !p)}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button title="Clear LLM response cache" style={{ ...pp.btn, borderColor: '#ef444440', color: '#ef4444' }} onClick={cancelAll}>
            ✕ Cancel
          </button>
        </div>
      </div>

      <div style={pp.body}>
        {/* Queue */}
        <div style={pp.queue}>
          <div style={pp.sectionLabel}>QUEUE</div>
          {items.filter(i => i.status !== 'done').length === 0 ? (
            <div style={{ fontSize: '12px', color: '#444', padding: '12px', textAlign: 'center' }}>Idle — queue empty</div>
          ) : items.filter(i => i.status !== 'done').map(item => (
            <div key={item.id} style={pp.item}>
              <div style={pp.itemHead}>
                <span style={{
                  fontSize: '10px', padding: '1px 6px', borderRadius: '3px',
                  fontFamily: "'JetBrains Mono', monospace",
                  background: item.status === 'processing' ? '#1a1530' : '#161616',
                  color: item.status === 'processing' ? '#a78bfa' : '#666',
                  border: `1px solid ${item.status === 'processing' ? '#7c6af740' : '#2a2a2a'}`,
                }}>
                  {item.status}
                </span>
                <span style={pp.itemPath}>{item.path}</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button title="Reprocess all failed" style={pp.smallBtn} onClick={retry}>↻</button>
                  <button title="Hide from view" style={{ ...pp.smallBtn, color: '#ef4444' }} onClick={() => cancel(item.id)}>✕</button>
                </div>
              </div>
              <div style={pp.progressWrap}>
                <div style={{
                  ...pp.progressBar,
                  width: `${item.progress * 100}%`,
                  background: item.status === 'processing' ? '#7c6af7' : '#2a2a2a',
                }} />
              </div>
              <div style={pp.stageLine}>
                <span>{item.stage}</span>
                <span>{Math.round(item.progress * 100)}%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Logs */}
        <div style={pp.logs}>
          <div style={pp.sectionLabel}>LIVE LOG</div>
          <div ref={logRef} style={pp.logBox}>
            {logs.map((l, i) => (
              <div key={i} style={pp.logRow}>
                <span style={pp.logTs}>{l.ts}</span>
                <span style={{
                  ...pp.logLvl,
                  color: l.level === 'ok' ? '#22c55e' : l.level === 'warn' ? '#f59e0b' : l.level === 'err' ? '#ef4444' : '#7c6af7',
                }}>{l.level.toUpperCase()}</span>
                <span style={pp.logMsg}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const pp = {
  root: { background: '#111', border: '1px solid #1f1f1f', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 },
  title: { fontSize: '12px', color: '#c0c0c0', fontWeight: '600', fontFamily: "'JetBrains Mono', monospace" },
  activeCount: { fontSize: '10px', color: '#555', fontFamily: "'JetBrains Mono', monospace", padding: '1px 6px', background: '#161616', borderRadius: '3px' },
  btn: { padding: '4px 10px', borderRadius: '5px', border: '1px solid #2a2a2a', background: '#161616', color: '#888', fontSize: '11px', cursor: 'pointer', fontFamily: "'Inter', sans-serif" },
  body: { display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 1fr', gap: '0', flex: 1, minHeight: 0, overflow: 'hidden' },
  queue: { padding: '10px 12px', overflowY: 'auto', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: '8px' },
  sectionLabel: { fontSize: '10px', color: '#444', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: '4px' },
  item: { background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '5px', padding: '8px 10px' },
  itemHead: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' },
  itemPath: { flex: 1, fontSize: '11px', color: '#888', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  smallBtn: { width: '20px', height: '20px', border: '1px solid #2a2a2a', background: '#0a0a0a', color: '#666', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  progressWrap: { height: '3px', background: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: '2px', transition: 'width 400ms ease' },
  stageLine: { display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: '#555', fontFamily: "'JetBrains Mono', monospace" },
  logs: { padding: '10px 12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 },
  logBox: { flex: 1, overflowY: 'auto', background: '#0a0a0a', border: '1px solid #161616', borderRadius: '5px', padding: '8px 10px', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', lineHeight: 1.6 },
  logRow: { display: 'flex', gap: '8px', alignItems: 'baseline' },
  logTs: { color: '#444', flexShrink: 0, width: '54px' },
  logLvl: { flexShrink: 0, width: '32px', fontWeight: '600' },
  logMsg: { color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};

Object.assign(window, { PipelinePanel });
