
// ── Graph Explorer View (draggable nodes + all-nodes panel) ───────────────────

const ENTITY_COLORS = {
  Technology: { fill: '#2d1f4e', stroke: '#7c6af7', text: '#a78bfa' },
  Concept:    { fill: '#1a2e1a', stroke: '#22c55e', text: '#4ade80' },
  Person:     { fill: '#1a2340', stroke: '#3b82f6', text: '#60a5fa' },
  File:       { fill: '#1e1e1e', stroke: '#555',    text: '#888' },
  Framework:  { fill: '#2e1a1a', stroke: '#f59e0b', text: '#fbbf24' },
};

const FALLBACK_ENTITIES = [
  { id: 1,  name: 'LightRAG',        type: 'Framework',   desc: 'Graph-based RAG system for local AI knowledge bases', docs: ['README.md', 'setup-notes.md'] },
  { id: 2,  name: 'Transformer',     type: 'Concept',     desc: 'Neural architecture based on self-attention mechanisms', docs: ['transformers.md', 'attention-notes.ipynb'] },
  { id: 3,  name: 'Ollama',          type: 'Technology',  desc: 'Local LLM inference runtime, compatible with many models', docs: ['docker-compose.yml', 'ollama-setup.md'] },
  { id: 4,  name: 'qwen2.5:7b',      type: 'Technology',  desc: 'Alibaba 7B parameter language model, quantized 4-bit', docs: ['models.md'] },
  { id: 5,  name: 'Attention',       type: 'Concept',     desc: 'Core mechanism: Q·K·V weighted context aggregation', docs: ['week7-attention.md'] },
  { id: 6,  name: 'Python',          type: 'Technology',  desc: 'Primary language for ML/AI projects in this knowledge base', docs: ['requirements.txt', 'setup.py'] },
  { id: 7,  name: 'Docker',          type: 'Technology',  desc: 'Containerization platform used for service orchestration', docs: ['docker-compose.yml'] },
  { id: 8,  name: 'Vector DB',       type: 'Concept',     desc: 'Embedding storage backend for similarity search', docs: ['rag-systems.md'] },
  { id: 9,  name: 'Knowledge Graph', type: 'Concept',     desc: 'Entity-relation graph built from indexed documents', docs: ['README.md', 'graph-rag-comparison.md'] },
  { id: 10, name: 'FastAPI',         type: 'Framework',   desc: 'Python web framework serving the LightRAG REST API', docs: ['api-docs.md'] },
  { id: 11, name: 'Neo4j',           type: 'Technology',  desc: 'Graph database option for entity persistence', docs: ['neo4j-setup.md'] },
  { id: 12, name: 'BERT',            type: 'Technology',  desc: 'Bidirectional encoder for embedding generation', docs: ['transformers.md'] },
  { id: 13, name: 'RAG',             type: 'Concept',     desc: 'Retrieval-Augmented Generation paradigm', docs: ['rag-systems.md', 'README.md'] },
  { id: 14, name: 'Embedding',       type: 'Concept',     desc: 'Dense vector representations of text chunks', docs: ['embeddings.md'] },
  { id: 15, name: 'NLP',             type: 'Concept',     desc: 'Natural Language Processing — parent field', docs: ['NLP/'] },
  { id: 16, name: 'Llama',           type: 'Technology',  desc: 'Meta open-source LLM family, used for local inference', docs: ['models.md'] },
  { id: 17, name: 'Hugging Face',    type: 'Framework',   desc: 'ML ecosystem: datasets, models, transformers library', docs: ['hf-notes.md'] },
  { id: 18, name: 'Fine-tuning',     type: 'Concept',     desc: 'Adapting pre-trained models to specific domains', docs: ['finetune-notes.md'] },
  { id: 19, name: 'Quantization',    type: 'Concept',     desc: 'Model compression: reducing precision for efficiency', docs: ['quantization.md'] },
  { id: 20, name: 'PostgreSQL',      type: 'Technology',  desc: 'Relational DB with pgvector extension for embeddings', docs: ['db-setup.md'] },
  { id: 21, name: 'Git',             type: 'Technology',  desc: 'Version control used across all repos', docs: ['git-workflow.md'] },
  { id: 22, name: 'Jupyter',         type: 'Technology',  desc: 'Notebook environment for experiments and analysis', docs: ['notebooks/'] },
  { id: 23, name: 'Tokenizer',       type: 'Concept',     desc: 'Converts text to token sequences for model input', docs: ['tokenization.md'] },
  { id: 24, name: 'GGUF',            type: 'File',        desc: 'Model format used by llama.cpp and Ollama', docs: ['models.md'] },
  { id: 25, name: 'nomic-embed',     type: 'Technology',  desc: 'Embedding model used by LightRAG for text vectorization', docs: ['README.md'] },
];

const FALLBACK_EDGES = [
  [1,3],[1,9],[1,10],[1,13],[1,8],[3,4],[2,5],[2,12],[2,15],[5,14],[8,14],[8,11],
  [9,8],[9,11],[13,8],[13,14],[6,1],[6,10],[7,3],[7,10],[4,14],[12,14],[15,2],[15,5],
  [3,16],[16,19],[16,24],[4,24],[17,2],[17,18],[17,12],[18,4],[19,4],[20,8],[20,1],
  [21,6],[22,6],[22,2],[23,2],[23,14],[25,1],[25,14],[10,6],[11,9],
];

function initPositions(entities, W, H) {
  return entities.map((e, i) => {
    const angle = (i / entities.length) * Math.PI * 2;
    const r = Math.min(W, H) * 0.32;
    return { ...e, x: W/2 + r * Math.cos(angle), y: H/2 + r * Math.sin(angle), vx: 0, vy: 0, fx: null, fy: null };
  });
}

function GraphView() {
  const W = 700, H = 560;
  const [entities, setEntities] = React.useState(FALLBACK_ENTITIES);
  const [edges, setEdges] = React.useState(FALLBACK_EDGES);
  const [graphLoading, setGraphLoading] = React.useState(true);
  const [graphError, setGraphError] = React.useState(null);
  const nodesRef = React.useRef(initPositions(FALLBACK_ENTITIES, W, H));
  const [nodes, setNodes] = React.useState(nodesRef.current);
  const [selected, setSelected] = React.useState(null);
  const [hovered, setHovered] = React.useState(null);
  const [filter, setFilter] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [nodeSearch, setNodeSearch] = React.useState('');
  const [dragging, setDragging] = React.useState(null);
  const [showPanel, setShowPanel] = React.useState(false);
  const svgRef = React.useRef(null);
  const frameRef = React.useRef(null);
  const alphaRef = React.useRef(1);
  const dragRef = React.useRef(null);
  const edgesRef = React.useRef(FALLBACK_EDGES);
  React.useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Load graph from API
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await window.LightRAGAPI.getGraph({ label: '*', maxNodes: 200, maxDepth: 3 });
        if (cancelled) return;
        if (data.nodes && data.nodes.length > 0) {
          setEntities(data.nodes);
          setEdges(data.edges);
          nodesRef.current = initPositions(data.nodes, W, H);
          setNodes(nodesRef.current);
          alphaRef.current = 1;
        }
      } catch (e) {
        if (!cancelled) setGraphError(e.message);
      } finally {
        if (!cancelled) setGraphLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Force simulation
  React.useEffect(() => {
    function tick() {
      const ns = nodesRef.current;
      const alpha = alphaRef.current;
      if (alpha < 0.002 && !dragRef.current) { frameRef.current = requestAnimationFrame(tick); return; }
      if (alpha > 0.002) alphaRef.current *= 0.98;

      // Repulsion
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[j].x - ns[i].x;
          const dy = ns[j].y - ns[i].y;
          const dist = Math.sqrt(dx*dx + dy*dy) || 1;
          const force = (3500 / (dist * dist)) * Math.max(alpha, 0.05);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (ns[i].fx === null) { ns[i].vx -= fx; ns[i].vy -= fy; }
          if (ns[j].fx === null) { ns[j].vx += fx; ns[j].vy += fy; }
        }
      }

      // Edge attraction
      edgesRef.current.forEach(([a, b]) => {
        const ni = ns.find(n => n.id === a);
        const nj = ns.find(n => n.id === b);
        if (!ni || !nj) return;
        const dx = nj.x - ni.x;
        const dy = nj.y - ni.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const target = 110;
        const force = (dist - target) * 0.035 * Math.max(alpha, 0.05);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (ni.fx === null) { ni.vx += fx; ni.vy += fy; }
        if (nj.fx === null) { nj.vx -= fx; nj.vy -= fy; }
      });

      // Center gravity
      ns.forEach(n => {
        if (n.fx === null) {
          n.vx += (W/2 - n.x) * 0.004 * Math.max(alpha, 0.02);
          n.vy += (H/2 - n.y) * 0.004 * Math.max(alpha, 0.02);
        }
      });

      // Integrate
      ns.forEach(n => {
        if (n.fx !== null) {
          n.x = n.fx; n.y = n.fy;
          n.vx = 0; n.vy = 0;
        } else {
          n.vx *= 0.82; n.vy *= 0.82;
          n.x = Math.max(18, Math.min(W - 18, n.x + n.vx));
          n.y = Math.max(18, Math.min(H - 18, n.y + n.vy));
        }
      });

      setNodes([...ns]);
      frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  // Drag handlers
  const getSVGPoint = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  const onNodeMouseDown = (e, nodeId) => {
    e.stopPropagation();
    const pt = getSVGPoint(e);
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    dragRef.current = { id: nodeId, offsetX: pt.x - node.x, offsetY: pt.y - node.y };
    node.fx = node.x;
    node.fy = node.y;
    alphaRef.current = Math.max(alphaRef.current, 0.3);
    setDragging(nodeId);
  };

  const onSVGMouseMove = (e) => {
    if (!dragRef.current) return;
    const pt = getSVGPoint(e);
    const node = nodesRef.current.find(n => n.id === dragRef.current.id);
    if (!node) return;
    node.fx = Math.max(18, Math.min(W - 18, pt.x - dragRef.current.offsetX));
    node.fy = Math.max(18, Math.min(H - 18, pt.y - dragRef.current.offsetY));
    node.x = node.fx;
    node.y = node.fy;
  };

  const onSVGMouseUp = () => {
    if (!dragRef.current) return;
    const node = nodesRef.current.find(n => n.id === dragRef.current.id);
    if (node) { node.fx = null; node.fy = null; }
    dragRef.current = null;
    setDragging(null);
    alphaRef.current = Math.max(alphaRef.current, 0.15);
  };

  const onTouchStart = (e, nodeId) => {
    e.preventDefault();
    onNodeMouseDown(e, nodeId);
  };
  const onSVGTouchMove = (e) => {
    e.preventDefault();
    onSVGMouseMove(e);
  };
  const onSVGTouchEnd = (e) => {
    e.preventDefault();
    onSVGMouseUp();
  };

  const selectedNode = nodes.find(n => n.id === selected);
  const connectedIds = selected
    ? new Set(edges.filter(([a,b]) => a === selected || b === selected).flatMap(([a,b]) => [a,b]))
    : null;

  const filteredNodes = nodes.filter(n =>
    (!filter || n.type === filter) &&
    (!search || n.name.toLowerCase().includes(search.toLowerCase()))
  );
  const visibleIds = new Set(filteredNodes.map(n => n.id));

  // All-nodes panel search
  const allNodesList = entities.filter(n =>
    !nodeSearch || n.name.toLowerCase().includes(nodeSearch.toLowerCase()) || n.type.toLowerCase().includes(nodeSearch.toLowerCase())
  );
  const grouped = Object.keys(ENTITY_COLORS).reduce((acc, type) => {
    const items = allNodesList.filter(n => n.type === type);
    if (items.length) acc[type] = items;
    return acc;
  }, {});

  return (
    <div style={gv.root}>
      {/* Controls */}
      <div style={gv.controls}>
        <div style={gv.searchWrap}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: '10px' }}>
            <circle cx="7" cy="7" r="4.5" stroke="#555" strokeWidth="1.5"/>
            <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            style={gv.searchInput}
            placeholder="Buscar en grafo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={gv.filterRow}>
          {Object.keys(ENTITY_COLORS).map(type => {
            const c = ENTITY_COLORS[type];
            return (
              <button key={type} onClick={() => setFilter(filter === type ? null : type)} style={{
                ...gv.filterChip,
                background: filter === type ? c.fill : 'transparent',
                borderColor: filter === type ? c.stroke : '#2a2a2a',
                color: filter === type ? c.text : '#555',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.stroke, display: 'inline-block', marginRight: 5 }}></span>
                {type}
              </button>
            );
          })}
          {filter && <button onClick={() => setFilter(null)} style={{ ...gv.filterChip, borderColor: '#333', color: '#555' }}>✕ clear</button>}
        </div>
      </div>

      {/* Main area: graph + right panels */}
      <div className="graph-split" style={gv.split}>
        {/* SVG Graph */}
        <div style={gv.graphPanel}>
          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, display: 'flex', gap: 6 }}>
            <button
              onClick={() => setShowPanel(p => !p)}
              style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #2a2a2a', background: showPanel ? '#1a1530' : '#111', color: showPanel ? '#a78bfa' : '#555', fontSize: 11, cursor: 'pointer' }}
            >
              {showPanel ? 'Ocultar lista' : 'Ver nodos'}
            </button>
          </div>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ ...gv.svg, width: '100%', height: 'auto', cursor: dragging ? 'grabbing' : 'default', touchAction: 'none' }}
            onMouseMove={onSVGMouseMove}
            onMouseUp={onSVGMouseUp}
            onMouseLeave={onSVGMouseUp}
            onTouchMove={onSVGTouchMove}
            onTouchEnd={onSVGTouchEnd}
          >
            <defs>
              <radialGradient id="bgGrad2" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#111"/>
                <stop offset="100%" stopColor="#0a0a0a"/>
              </radialGradient>
            </defs>
            <rect width={W} height={H} fill="url(#bgGrad2)" rx="8"/>

            {/* Edges */}
            {edges.map(([a, b], i) => {
              const na = nodesRef.current.find(n => n.id === a);
              const nb = nodesRef.current.find(n => n.id === b);
              if (!na || !nb) return null;
              const isHighlighted = connectedIds && connectedIds.has(a) && connectedIds.has(b);
              const isVisible = visibleIds.has(a) && visibleIds.has(b);
              return (
                <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                  stroke={isHighlighted ? '#7c6af7' : '#1f1f1f'}
                  strokeWidth={isHighlighted ? 1.5 : 0.8}
                  opacity={isVisible ? (isHighlighted ? 0.8 : 0.5) : 0.06}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const c = ENTITY_COLORS[node.type] || ENTITY_COLORS.File;
              const isSelected = selected === node.id;
              const isHov = hovered === node.id;
              const isDrag = dragging === node.id;
              const isConnected = connectedIds && connectedIds.has(node.id);
              const isVisible = visibleIds.has(node.id);
              const r = isSelected ? 10 : 7;
              return (
                <g key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  onClick={() => !isDrag && setSelected(selected === node.id ? null : node.id)}
                  onMouseDown={e => onNodeMouseDown(e, node.id)}
                  onTouchStart={e => onTouchStart(e, node.id)}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: isDrag ? 'grabbing' : 'grab' }}
                  opacity={isVisible ? (selected && !isConnected && !isSelected ? 0.18 : 1) : 0.08}
                >
                  {(isSelected || isHov || isDrag) && (
                    <circle r={r + 6} fill={c.stroke} opacity="0.12"/>
                  )}
                  <circle r={r} fill={c.fill} stroke={c.stroke}
                    strokeWidth={isSelected ? 2.5 : isDrag ? 2 : 1}
                    strokeDasharray={isDrag ? '3,2' : 'none'}
                  />
                  {(isSelected || isHov || isDrag) && (
                    <text textAnchor="middle" dy={-r - 6} fontSize="10" fill={c.text}
                      fontFamily="'Inter', sans-serif" style={{ pointerEvents: 'none', fontWeight: 500 }}>
                      {node.name}
                    </text>
                  )}
                  {!isSelected && !isHov && !isDrag && isVisible && (
                    <text textAnchor="middle" dy={r + 12} fontSize="9" fill="#3a3a3a"
                      fontFamily="'Inter', sans-serif" style={{ pointerEvents: 'none' }}>
                      {node.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Legend + drag hint */}
          <div style={gv.legend}>
            {Object.entries(ENTITY_COLORS).map(([type, c]) => (
              <div key={type} style={gv.legendItem}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.stroke, flexShrink: 0 }}></span>
                <span style={{ fontSize: '10px', color: '#555' }}>{type}</span>
              </div>
            ))}
            <div style={{ ...gv.legendItem, marginTop: '6px', borderTop: '1px solid #1a1a1a', paddingTop: '6px' }}>
              <span style={{ fontSize: '10px', color: '#333', fontFamily: "'JetBrains Mono', monospace" }}>drag nodes to move</span>
            </div>
          </div>
        </div>

        {/* Right column: detail + all nodes list */}
        <div className={`graph-right-col${showPanel ? ' visible' : ''}`} style={gv.rightCol}>
          {/* Entity detail */}
          {selectedNode && (
            <div style={gv.detailPanel}>
              <EntityDetail node={selectedNode} nodes={nodes} edges={edges} onSelect={setSelected} />
            </div>
          )}

          {/* All nodes list */}
          <div style={{ ...gv.allNodesPanel, flex: selectedNode ? '0 0 auto' : 1 }}>
            <div style={gv.allNodesHeader}>
              <span style={gv.sectionTitle}>TODOS LOS NODOS</span>
              <span style={{ fontSize: '10px', color: '#333', fontFamily: "'JetBrains Mono', monospace" }}>{entities.length}{graphLoading ? '…' : ''}</span>
            </div>
            <div style={gv.nodeSearchWrap}>
              <input
                style={gv.nodeSearchInput}
                placeholder="Filtrar nodos..."
                value={nodeSearch}
                onChange={e => setNodeSearch(e.target.value)}
              />
            </div>
            <div style={gv.nodesList}>
              {Object.entries(grouped).map(([type, items]) => {
                const c = ENTITY_COLORS[type] || ENTITY_COLORS.File;
                return (
                  <div key={type} style={{ marginBottom: '8px' }}>
                    <div style={gv.groupLabel}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.stroke, display: 'inline-block', marginRight: 5 }}></span>
                      {type} <span style={{ color: '#333' }}>({items.length})</span>
                    </div>
                    {items.map(n => (
                      <button
                        key={n.id}
                        onClick={() => { setSelected(n.id === selected ? null : n.id); }}
                        style={{
                          ...gv.nodeItem,
                          background: selected === n.id ? c.fill : 'transparent',
                          borderColor: selected === n.id ? c.stroke + '60' : 'transparent',
                          color: selected === n.id ? c.text : '#888',
                        }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.stroke, flexShrink: 0, opacity: 0.7 }}></span>
                        {n.name}
                      </button>
                    ))}
                  </div>
                );
              })}
              {Object.keys(grouped).length === 0 && (
                <div style={{ fontSize: '12px', color: '#333', padding: '8px', textAlign: 'center' }}>Sin resultados</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntityDetail({ node, nodes, edges, onSelect }) {
  const c = ENTITY_COLORS[node.type] || ENTITY_COLORS.File;
  const related = (edges || [])
    .filter(([a, b]) => a === node.id || b === node.id)
    .map(([a, b]) => nodes.find(n => n.id === (a === node.id ? b : a)))
    .filter(Boolean);
  return (
    <div style={gv.detail}>
      <div style={gv.detailHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          <span style={gv.detailName}>{node.name}</span>
          <span style={{ ...gv.typeBadge, background: c.fill, color: c.text, border: `1px solid ${c.stroke}` }}>{node.type}</span>
        </div>
        <button onClick={() => onSelect(null)} style={gv.closeBtn}>✕</button>
      </div>
      <p style={gv.detailDesc}>{node.desc}</p>
      <div style={gv.section}>
        <div style={gv.sectionTitle}>CONEXIONES ({related.length})</div>
        {related.map(r => {
          const rc = ENTITY_COLORS[r.type] || ENTITY_COLORS.File;
          return (
            <button key={r.id} onClick={() => onSelect(r.id)} style={gv.relatedItem}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: rc.stroke, flexShrink: 0 }}></span>
              <span style={{ fontSize: '12px', color: '#c0c0c0' }}>{r.name}</span>
              <span style={{ fontSize: '10px', color: '#555', marginLeft: 'auto' }}>{r.type}</span>
            </button>
          );
        })}
      </div>
      {node.docs?.length > 0 && (
        <div style={gv.section}>
          <div style={{ ...gv.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>SOURCE DOCUMENTS ({node.docs.length})</span>
            <button
              onClick={() => window.__navigateToDocs && window.__navigateToDocs(node.docs[0].split('/').pop().replace(/\.[^.]+$/, ''))}
              style={gv.openDocsBtn}
              title="Open in Documents"
            >
              open in Documents →
            </button>
          </div>
          {node.docs.map((d, i) => (
            <button
              key={i}
              onClick={() => window.__navigateToDocs && window.__navigateToDocs(d.split('/').pop().replace(/\.[^.]+$/, ''))}
              style={gv.docItemBtn}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
                <path d="M2 1 H6 L8 3 V9 H2 Z" stroke="#7c6af7" strokeWidth="0.8" fill="none"/>
              </svg>
              <span style={{ fontSize: '11px', color: '#888', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const gv = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '20px 24px 16px' },
  controls: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexShrink: 0, flexWrap: 'wrap' },
  searchWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchInput: {
    background: '#111', border: '1px solid #2a2a2a', borderRadius: '6px',
    color: '#f0f0f0', fontSize: '12px', fontFamily: "'Inter', sans-serif",
    padding: '5px 10px 5px 28px', outline: 'none', width: '150px',
  },
  filterRow: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
  filterChip: {
    padding: '3px 9px', borderRadius: '16px', border: '1px solid',
    background: 'transparent', cursor: 'pointer', fontSize: '11px',
    fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', transition: 'all 150ms ease',
  },
  split: { display: 'flex', gap: '14px', flex: 1, minHeight: 0, overflow: 'hidden' },
  graphPanel: { flex: '1 1 auto', position: 'relative', minWidth: 0 },
  svg: { display: 'block', borderRadius: '8px', border: '1px solid #1a1a1a', userSelect: 'none' },
  legend: {
    position: 'absolute', bottom: '10px', left: '10px',
    display: 'flex', flexDirection: 'column', gap: '4px',
    background: 'rgba(10,10,10,0.85)', padding: '8px 10px', borderRadius: '6px',
    backdropFilter: 'blur(4px)',
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: '6px' },
  rightCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden', minWidth: 0 },
  detailPanel: {
    background: '#111', border: '1px solid #1f1f1f', borderRadius: '8px',
    flexShrink: 0, maxHeight: '260px', overflow: 'hidden',
  },
  allNodesPanel: {
    background: '#111', border: '1px solid #1f1f1f', borderRadius: '8px',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    minHeight: '100px',
  },
  allNodesHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 12px 6px', flexShrink: 0,
  },
  nodeSearchWrap: { padding: '0 10px 8px', flexShrink: 0 },
  nodeSearchInput: {
    width: '100%', background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: '5px',
    color: '#888', fontSize: '11px', fontFamily: "'Inter', sans-serif",
    padding: '4px 8px', outline: 'none',
  },
  nodesList: { overflowY: 'auto', flex: 1, padding: '0 8px 8px' },
  groupLabel: {
    fontSize: '10px', color: '#444', fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.06em', padding: '4px 4px 3px', display: 'flex', alignItems: 'center',
  },
  nodeItem: {
    display: 'flex', alignItems: 'center', gap: '7px', width: '100%',
    padding: '4px 6px', borderRadius: '4px', border: '1px solid transparent',
    background: 'transparent', cursor: 'pointer', fontSize: '12px',
    fontFamily: "'Inter', sans-serif", textAlign: 'left', transition: 'all 100ms ease',
  },
  detail: { padding: '14px 14px', overflowY: 'auto', height: '100%' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' },
  detailName: { fontSize: '14px', fontWeight: '600', color: '#f0f0f0' },
  typeBadge: { fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace" },
  closeBtn: { background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '12px', padding: '2px 4px', flexShrink: 0 },
  detailDesc: { fontSize: '12px', color: '#777', lineHeight: 1.6, margin: '0 0 12px' },
  section: { marginBottom: '12px' },
  sectionTitle: { fontSize: '10px', color: '#444', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', marginBottom: '6px', display: 'block' },
  relatedItem: {
    display: 'flex', alignItems: 'center', gap: '7px',
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '4px 6px', borderRadius: '4px', width: '100%', transition: 'background 100ms ease',
  },
  docItem: { display: 'flex', alignItems: 'center', gap: '7px', padding: '3px 6px' },
  docItemBtn: { display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 8px', width: '100%', background: 'transparent', border: '1px solid transparent', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' },
  openDocsBtn: { background: 'transparent', border: 'none', color: '#7c6af7', fontSize: '10px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", padding: 0, textTransform: 'none', letterSpacing: 0 },
};

Object.assign(window, { GraphView });
