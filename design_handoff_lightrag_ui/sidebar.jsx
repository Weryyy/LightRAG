
const NAV_ITEMS = [
  { id: 'search', label: 'Chat', icon: SearchIcon },
  { id: 'graph', label: 'Graph Explorer', icon: GraphIcon },
  { id: 'documents', label: 'Documents', icon: DocsIcon },
  { id: 'health', label: 'Health', icon: HealthIcon },
];

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function GraphIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="3" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="13" cy="4" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="13" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="8" r="1.5" fill="currentColor" opacity="0.5"/>
      <line x1="5" y1="8" x2="7" y2="8" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      <line x1="9" y1="7.5" x2="11" y2="5" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
      <line x1="9" y1="8.5" x2="11" y2="11" stroke="currentColor" strokeWidth="1" opacity="0.6"/>
    </svg>
  );
}
function DocsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="5.5" y1="5.5" x2="10.5" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="5.5" y1="8" x2="10.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="5.5" y1="10.5" x2="8.5" y2="10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
function HealthIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 8h2.5l2-4 2.5 7 2-3H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Sidebar({ active, onNav, serverOnline: serverOnlineProp }) {
  const [serverOnline, setServerOnline] = React.useState(serverOnlineProp);
  const [model, setModel] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const h = await window.LightRAGAPI.getHealth();
        if (cancelled) return;
        setServerOnline(h.status === 'healthy');
        setModel((h.configuration?.llm_model || '').split('/').pop().split(':')[0]);
      } catch {
        if (!cancelled) setServerOnline(false);
      }
    };
    tick();
    const t = setInterval(tick, 6000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return (
    <aside style={sidebarStyles.root}>
      {/* Logo */}
      <div style={sidebarStyles.logo}>
        <GraphNodeLogo />
        <span style={sidebarStyles.logoText}>LightRAG</span>
      </div>

      {/* Nav */}
      <nav style={sidebarStyles.nav}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNav(id)}
            style={{
              ...sidebarStyles.navItem,
              ...(active === id ? sidebarStyles.navItemActive : {}),
            }}
          >
            <span style={{ color: active === id ? '#7c6af7' : '#888', display: 'flex' }}>
              <Icon />
            </span>
            <span style={{ color: active === id ? '#f0f0f0' : '#888' }}>{label}</span>
          </button>
        ))}
      </nav>

      {/* Status footer */}
      <div style={sidebarStyles.footer}>
        <div style={sidebarStyles.statusRow}>
          <span style={{ ...sidebarStyles.dot, background: serverOnline ? '#22c55e' : '#ef4444' }}></span>
          <span style={sidebarStyles.statusText}>{serverOnline ? 'Server online' : 'Offline'}</span>
        </div>
        <div style={sidebarStyles.modelName}>{model || '—'}</div>
        <div style={sidebarStyles.modelName}>{(window.LightRAGAPI?.LIGHTRAG_URL || '').replace(/^https?:\/\//, '')}</div>
      </div>
    </aside>
  );
}

function GraphNodeLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="5" r="2.5" fill="#7c6af7"/>
      <circle cx="4" cy="16" r="2" fill="#7c6af7" opacity="0.7"/>
      <circle cx="18" cy="16" r="2" fill="#7c6af7" opacity="0.7"/>
      <circle cx="11" cy="13" r="1.5" fill="#7c6af7" opacity="0.4"/>
      <line x1="11" y1="7.5" x2="11" y2="11.5" stroke="#7c6af7" strokeWidth="1.2" opacity="0.6"/>
      <line x1="9.5" y1="5.8" x2="5.2" y2="14.3" stroke="#7c6af7" strokeWidth="1.2" opacity="0.5"/>
      <line x1="12.5" y1="5.8" x2="16.8" y2="14.3" stroke="#7c6af7" strokeWidth="1.2" opacity="0.5"/>
      <line x1="5.5" y1="16.5" x2="9.5" y2="14" stroke="#7c6af7" strokeWidth="1" opacity="0.4"/>
      <line x1="16.5" y1="16.5" x2="12.5" y2="14" stroke="#7c6af7" strokeWidth="1" opacity="0.4"/>
    </svg>
  );
}

const sidebarStyles = {
  root: {
    width: '240px',
    minWidth: '240px',
    height: '100vh',
    background: '#0d0d0d',
    borderRight: '1px solid #1f1f1f',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', sans-serif",
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '20px 16px 16px',
    borderBottom: '1px solid #1f1f1f',
  },
  logoText: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '14px',
    fontWeight: '700',
    color: '#f0f0f0',
    letterSpacing: '0.02em',
  },
  nav: {
    flex: 1,
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: "'Inter', sans-serif",
    width: '100%',
    textAlign: 'left',
    transition: 'background 150ms ease',
  },
  navItemActive: {
    background: '#1a1530',
  },
  footer: {
    padding: '14px 16px',
    borderTop: '1px solid #1f1f1f',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  dot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusText: {
    fontSize: '12px',
    color: '#888',
  },
  modelName: {
    fontSize: '11px',
    color: '#555',
    fontFamily: "'JetBrains Mono', monospace",
    marginLeft: '13px',
  },
};

Object.assign(window, { Sidebar });
