
// ── Chat View (replaces Search) ───────────────────────────────────────────────

const CHAT_MODES = [
  { id: 'hybrid', label: 'hybrid', tip: 'Combina contexto local y global para mejores resultados' },
  { id: 'local',  label: 'local',  tip: 'Busca entidades cercanas en el grafo de conocimiento' },
  { id: 'global', label: 'global', tip: 'Recorre el grafo completo para respuestas amplias' },
  { id: 'naive',  label: 'naive',  tip: 'Búsqueda simple por similitud vectorial' },
];

const CHAT_CATEGORY_COLORS = {
  proyectos: { bg: '#1a2a3a', text: '#60a5fa', border: '#1e3a52' },
  estudio:   { bg: '#1a2e1a', text: '#4ade80', border: '#1e3d1e' },
  notas:     { bg: '#2e2010', text: '#fb923c', border: '#3d2a10' },
  tecnica:   { bg: '#221a36', text: '#a78bfa', border: '#2d2048' },
};

const MOCK_ANSWERS = [
  {
    trigger: ['lightrag','rag','grafo','graph'],
    answer: `**LightRAG** es un sistema RAG basado en grafos de conocimiento. A diferencia del RAG vectorial, construye un **grafo de entidades y relaciones** que permite respuestas más contextuales.\n\n**Ventajas principales:**\n- Indexación incremental de documentos\n- Múltiples modos de búsqueda (local, global, híbrido)\n- Compatible con modelos Ollama locales\n- API REST en \`localhost:9621\``,
    sources: [
      { path: 'proyectos/Master-IA-y-Bigdata/lightrag/README.md', category: 'proyectos' },
      { path: 'tecnica/rag-systems/graph-rag-comparison.md', category: 'tecnica' },
    ],
    meta: { mode: 'hybrid', time: 842, entities: 47 },
  },
  {
    trigger: ['transformer','attention','bert','gpt','modelo'],
    answer: `El **mecanismo de atención** en Transformers permite al modelo ponderar la relevancia de cada token en relación con los demás:\n\n\`\`\`\nAttention(Q, K, V) = softmax(QKᵀ / √d_k) · V\n\`\`\`\n\n**Multi-Head Attention** ejecuta esto en paralelo con múltiples cabezas. Es la base de BERT, GPT y Llama.`,
    sources: [
      { path: 'estudio/deep-learning/transformers-architecture.md', category: 'estudio' },
      { path: 'proyectos/Master-IA-y-Bigdata/NLP/attention-notes.ipynb', category: 'proyectos' },
      { path: 'tecnica/papers/attention-is-all-you-need-notes.md', category: 'tecnica' },
    ],
    meta: { mode: 'hybrid', time: 1203, entities: 83 },
  },
  {
    trigger: ['docker','compose','infra','servicio','puerto'],
    answer: `En tus repos tienes un stack completo en \`proyectos/infra/\`:\n\n- \`ollama\` — servidor de modelos (puerto 11434)\n- \`lightrag\` — API de conocimiento (puerto 9621)\n- \`postgres\` — base de datos vectorial\n- \`nginx\` — reverse proxy\n\nPara levantar: \`docker compose up -d --build\``,
    sources: [
      { path: 'proyectos/infra/docker-compose.yml', category: 'proyectos' },
      { path: 'notas/2025-01-docker-setup.md', category: 'notas' },
    ],
    meta: { mode: 'local', time: 389, entities: 21 },
  },
  {
    trigger: ['python','fastapi','api','endpoint'],
    answer: `La API de LightRAG está construida con **FastAPI** y expone los siguientes endpoints principales:\n\n- \`POST /query\` — consulta al grafo\n- \`POST /insert\` — indexa un documento\n- \`GET /health\` — estado del servidor\n- \`GET /graph/entities\` — lista de entidades\n\nDocumentación completa en \`localhost:9621/docs\``,
    sources: [
      { path: 'tecnica/api-docs/fastapi-lightrag.md', category: 'tecnica' },
      { path: 'proyectos/Master-IA-y-Bigdata/lightrag/README.md', category: 'proyectos' },
    ],
    meta: { mode: 'hybrid', time: 614, entities: 33 },
  },
];

const DEFAULT_FALLBACK = {
  answer: `He buscado en tu base de conocimiento sobre eso. Encontré referencias en varios documentos de tus repositorios, pero la información es escasa. Te recomiendo revisar los documentos fuente directamente o indexar más material sobre este tema.`,
  sources: [
    { path: 'notas/2024-11-lightrag-setup.md', category: 'notas' },
  ],
  meta: { mode: 'hybrid', time: 512, entities: 8 },
};

function getAnswer(query, mode) {
  const q = query.toLowerCase();
  const match = MOCK_ANSWERS.find(a => a.trigger.some(t => q.includes(t)));
  const base = match || DEFAULT_FALLBACK;
  return { ...base, meta: { ...base.meta, mode } };
}

function ChatMarkdown({ text }) {
  const html = text
    .replace(/```([\s\S]*?)```/g, '<pre style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:6px;padding:10px 14px;overflow-x:auto;margin:8px 0;font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#c4b5fd;line-height:1.6">$1</pre>')
    .replace(/`([^`]+)`/g, '<code style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#a78bfa;background:#1a1530;padding:1px 5px;border-radius:3px">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#f0f0f0;font-weight:600">$1</strong>')
    .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#7c6af7;flex-shrink:0;margin-top:1px">·</span><span>$1</span></div>')
    .replace(/\n\n/g, '<div style="height:8px"></div>');
  return <div style={{ color: '#d0d0d0', fontSize: '14px', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: html }} />;
}

function SourcesChips({ sources, open, onToggle }) {
  return (
    <div style={{ marginTop: '10px' }}>
      <button onClick={onToggle} style={cv.sourcesToggle}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: '150ms', flexShrink: 0 }}>
          <path d="M4 2l4 4-4 4" stroke="#555" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ color: '#555', fontSize: '11px' }}>{sources.length} fuentes</span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px' }}>
          {sources.map((s, i) => {
            const c = CHAT_CATEGORY_COLORS[s.category] || CHAT_CATEGORY_COLORS.tecnica;
            const parts = s.path.split('/');
            const fname = parts[parts.length - 1];
            return (
              <div key={i} style={{ ...cv.sourceChip, background: c.bg, border: `1px solid ${c.border}` }}>
                <span style={{ ...cv.chipBadge, color: c.text }}>{s.category}</span>
                <span style={cv.chipPath}>{fname}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetaLine({ meta }) {
  return (
    <div style={cv.metaLine}>
      <span>mode: <strong style={{ color: '#7c6af7' }}>{meta.mode}</strong></span>
      <span style={{ color: '#2a2a2a' }}>·</span>
      <span>{meta.time}ms</span>
      <span style={{ color: '#2a2a2a' }}>·</span>
      <span>{meta.entities} entities</span>
    </div>
  );
}

function AssistantMessage({ msg }) {
  const [sourcesOpen, setSourcesOpen] = React.useState(false);
  return (
    <div style={cv.assistantMsg}>
      <div style={cv.assistantAvatar}>
        <svg width="14" height="14" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="5" r="2.5" fill="#7c6af7"/>
          <circle cx="4" cy="16" r="2" fill="#7c6af7" opacity="0.7"/>
          <circle cx="18" cy="16" r="2" fill="#7c6af7" opacity="0.7"/>
          <line x1="11" y1="7.5" x2="11" y2="11.5" stroke="#7c6af7" strokeWidth="1.2" opacity="0.6"/>
          <line x1="9.5" y1="5.8" x2="5.2" y2="14.3" stroke="#7c6af7" strokeWidth="1.2" opacity="0.5"/>
          <line x1="12.5" y1="5.8" x2="16.8" y2="14.3" stroke="#7c6af7" strokeWidth="1.2" opacity="0.5"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ChatMarkdown text={msg.answer} />
        {msg.sources && (
          <SourcesChips sources={msg.sources} open={sourcesOpen} onToggle={() => setSourcesOpen(o => !o)} />
        )}
        {msg.meta && <MetaLine meta={msg.meta} />}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={cv.assistantMsg}>
      <div style={cv.assistantAvatar}>
        <svg width="14" height="14" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="5" r="2.5" fill="#7c6af7"/>
          <circle cx="4" cy="16" r="2" fill="#7c6af7" opacity="0.7"/>
          <circle cx="18" cy="16" r="2" fill="#7c6af7" opacity="0.7"/>
          <line x1="11" y1="7.5" x2="11" y2="11.5" stroke="#7c6af7" strokeWidth="1.2" opacity="0.6"/>
          <line x1="9.5" y1="5.8" x2="5.2" y2="14.3" stroke="#7c6af7" strokeWidth="1.2" opacity="0.5"/>
          <line x1="12.5" y1="5.8" x2="16.8" y2="14.3" stroke="#7c6af7" strokeWidth="1.2" opacity="0.5"/>
        </svg>
      </div>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', paddingTop: '4px' }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: '6px', height: '6px', borderRadius: '50%', background: '#7c6af7',
            animation: 'pulse 1.2s ease infinite',
            animationDelay: `${i * 0.2}s`,
            opacity: 0.6,
          }} />
        ))}
      </div>
    </div>
  );
}

function SearchView() {
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [mode, setMode] = React.useState('hybrid');
  const [loading, setLoading] = React.useState(false);
  const [tooltip, setTooltip] = React.useState(null);
  const bottomRef = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.parentNode.scrollTop = bottomRef.current.offsetTop;
    }
  }, [messages, loading]);

  React.useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) inputRef.current?.blur();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', text: input.trim() };
    const currentInput = input.trim();
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const result = await window.LightRAGAPI.runQuery(currentInput, mode);
      setMessages(prev => [...prev, { role: 'assistant', ...result }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        answer: `**Error consultando LightRAG:** \`${err.message}\`\n\nVerifica que el servidor esté corriendo en \`${window.LightRAGAPI.LIGHTRAG_URL}\`.`,
        sources: [],
        meta: { mode, time: 0, entities: 0 },
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div style={cv.root}>
      {/* Messages area */}
      <div style={cv.messages}>
        {isEmpty && (
          <div style={cv.emptyState}>
            <svg width="52" height="52" viewBox="0 0 22 22" fill="none" style={{ opacity: 0.15, marginBottom: '16px' }}>
              <circle cx="11" cy="5" r="2.5" stroke="#7c6af7" strokeWidth="1.5"/>
              <circle cx="4" cy="16" r="2" stroke="#7c6af7" strokeWidth="1.5"/>
              <circle cx="18" cy="16" r="2" stroke="#7c6af7" strokeWidth="1.5"/>
              <line x1="11" y1="7.5" x2="11" y2="11.5" stroke="#7c6af7" strokeWidth="1.2"/>
              <line x1="9.5" y1="5.8" x2="5.2" y2="14.3" stroke="#7c6af7" strokeWidth="1.2"/>
              <line x1="12.5" y1="5.8" x2="16.8" y2="14.3" stroke="#7c6af7" strokeWidth="1.2"/>
            </svg>
            <p style={{ color: '#444', fontSize: '15px', marginBottom: '6px' }}>LightRAG</p>
            <p style={{ color: '#333', fontSize: '13px', textAlign: 'center', lineHeight: 1.6, maxWidth: '340px' }}>
              Tu base de conocimiento está lista. Pregúntame sobre tus repos, notas y documentación técnica.
            </p>
            <div style={cv.suggestions}>
              {[
                'qué es LightRAG y cómo funciona',
                'explícame el mecanismo de atención',
                'cómo levanto el stack de docker',
                'qué endpoints expone la API FastAPI',
              ].map(q => (
                <button key={q} style={cv.suggBtn} onClick={() => { setInput(q); inputRef.current?.focus(); }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          msg.role === 'user' ? (
            <div key={i} style={cv.userMsg}>
              <div style={cv.userBubble}>{msg.text}</div>
            </div>
          ) : (
            <AssistantMessage key={i} msg={msg} />
          )
        ))}

        {loading && <TypingIndicator />}
        <div ref={bottomRef} style={{ height: '1px' }} />
      </div>

      {/* Input bar */}
      <div style={cv.inputArea}>
        {/* Mode pills */}
        <div style={cv.modeRow}>
          {CHAT_MODES.map(m => (
            <div key={m.id} style={{ position: 'relative' }}>
              <button
                onClick={() => setMode(m.id)}
                style={{ ...cv.modePill, ...(mode === m.id ? cv.modePillActive : {}) }}
                onMouseEnter={() => setTooltip(m.id)}
                onMouseLeave={() => setTooltip(null)}
              >
                {m.label}
              </button>
              {tooltip === m.id && <div style={cv.tooltip}>{m.tip}</div>}
            </div>
          ))}
        </div>

        {/* Text input */}
        <div style={cv.inputWrap}>
          <textarea
            ref={inputRef}
            style={cv.textarea}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pregunta algo sobre tu base de conocimiento..."
            rows={1}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            style={{ ...cv.sendBtn, opacity: (!input.trim() || loading) ? 0.3 : 1 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 2L2 6.5l5 1.5 1.5 5L14 2z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <div style={cv.inputHint}>
          <kbd style={cv.kbd}>Enter</kbd> para enviar · <kbd style={cv.kbd}>Shift+Enter</kbd> nueva línea · <kbd style={cv.kbd}>⌘K</kbd> foco
        </div>
      </div>
    </div>
  );
}

const cv = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: "'Inter', sans-serif" },
  messages: { flex: 1, overflowY: 'auto', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '0' },
  emptyState: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '60px 32px', minHeight: '400px',
  },
  suggestions: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '24px', width: '100%', maxWidth: '400px' },
  suggBtn: {
    padding: '8px 14px', borderRadius: '8px', border: '1px solid #1f1f1f',
    background: '#111', color: '#555', fontSize: '13px', cursor: 'pointer',
    textAlign: 'left', fontFamily: "'Inter', sans-serif", transition: 'all 150ms ease',
  },
  userMsg: { display: 'flex', justifyContent: 'flex-end', padding: '6px 32px' },
  userBubble: {
    background: '#1a1530', border: '1px solid #2d2050', borderRadius: '12px 12px 3px 12px',
    padding: '10px 14px', fontSize: '14px', color: '#e0d8ff', maxWidth: '65%', lineHeight: 1.6,
    wordBreak: 'break-word',
  },
  assistantMsg: { display: 'flex', gap: '12px', padding: '10px 32px', alignItems: 'flex-start' },
  assistantAvatar: {
    width: '28px', height: '28px', borderRadius: '6px',
    background: '#1a1530', border: '1px solid #2d2050',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px',
  },
  sourcesToggle: {
    display: 'flex', alignItems: 'center', gap: '5px',
    background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
  },
  sourceChip: {
    display: 'flex', alignItems: 'center', gap: '5px',
    borderRadius: '5px', padding: '3px 8px', cursor: 'pointer',
  },
  chipBadge: { fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", fontWeight: '600' },
  chipPath: { fontSize: '11px', color: '#666', fontFamily: "'JetBrains Mono', monospace" },
  metaLine: {
    display: 'flex', gap: '8px', alignItems: 'center',
    fontSize: '11px', color: '#3a3a3a', marginTop: '8px',
    fontFamily: "'JetBrains Mono', monospace",
  },
  inputArea: {
    flexShrink: 0, padding: '0 32px 16px', borderTop: '1px solid #141414',
    background: '#0a0a0a', paddingTop: '12px',
  },
  modeRow: { display: 'flex', gap: '5px', marginBottom: '8px' },
  modePill: {
    padding: '3px 10px', borderRadius: '16px', border: '1px solid #1f1f1f',
    background: 'transparent', color: '#555', fontSize: '11px',
    fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer', transition: 'all 150ms ease',
  },
  modePillActive: { background: '#1a1530', borderColor: '#7c6af750', color: '#a78bfa' },
  tooltip: {
    position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
    background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '6px',
    padding: '5px 9px', fontSize: '11px', color: '#aaa', whiteSpace: 'nowrap', zIndex: 10,
  },
  inputWrap: {
    display: 'flex', alignItems: 'flex-end', gap: '8px',
    background: '#111', border: '1px solid #2a2a2a', borderRadius: '10px',
    padding: '8px 8px 8px 14px',
    transition: 'border-color 150ms ease',
  },
  textarea: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: '#f0f0f0', fontSize: '14px', fontFamily: "'Inter', sans-serif",
    resize: 'none', lineHeight: 1.6, maxHeight: '160px', overflowY: 'auto',
    minHeight: '24px',
  },
  sendBtn: {
    width: '32px', height: '32px', borderRadius: '7px', border: 'none',
    background: '#7c6af7', color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    transition: 'opacity 150ms ease',
  },
  inputHint: { fontSize: '10px', color: '#2a2a2a', marginTop: '6px', fontFamily: "'JetBrains Mono', monospace" },
  kbd: { fontSize: '10px', color: '#3a3a3a', background: '#141414', border: '1px solid #2a2a2a', borderRadius: '3px', padding: '1px 4px' },
};

Object.assign(window, { SearchView });
