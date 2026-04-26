
// ── Split View ────────────────────────────────────────────────────────────────
// Renders left + draggable divider + right. `renderPane(viewId)` returns the
// component for a given view id. The divider drags to resize.

function SplitView({ leftView, rightView, renderPane, onCloseRight, onChangeRight, viewLabels }) {
  const [leftFrac, setLeftFrac] = React.useState(0.55);
  const [dragging, setDragging] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const rect = containerRef.current.getBoundingClientRect();
      const frac = (e.clientX - rect.left) / rect.width;
      setLeftFrac(Math.max(0.25, Math.min(0.78, frac)));
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging]);

  return (
    <div ref={containerRef} style={sv.container}>
      {/* LEFT */}
      <div style={{ ...sv.pane, flex: `0 0 ${leftFrac * 100}%` }}>
        {renderPane(leftView)}
      </div>

      {/* DIVIDER */}
      <div
        style={{ ...sv.divider, background: dragging ? '#7c6af7' : undefined }}
        onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
        onDoubleClick={() => setLeftFrac(0.55)}
        title="Drag to resize · double-click to reset"
      >
        <div style={sv.dividerGrip} />
      </div>

      {/* RIGHT */}
      <div style={{ ...sv.pane, flex: 1, position: 'relative' }}>
        <div style={sv.rightHeader}>
          <button
            style={sv.paneSelector}
            onClick={() => setPickerOpen(p => !p)}
          >
            <span style={{ color: '#a78bfa', fontWeight: '600' }}>{viewLabels[rightView]}</span>
            <span style={{ color: '#444', fontSize: '9px' }}>▾</span>
          </button>
          <button style={sv.closeBtn} onClick={onCloseRight} title="Close split">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          {pickerOpen && (
            <div style={sv.picker} onMouseLeave={() => setPickerOpen(false)}>
              {Object.entries(viewLabels).filter(([id]) => id !== leftView).map(([id, label]) => (
                <button
                  key={id}
                  style={{ ...sv.pickerItem, color: rightView === id ? '#a78bfa' : '#888' }}
                  onClick={() => { onChangeRight(id); setPickerOpen(false); }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {renderPane(rightView)}
        </div>
      </div>
    </div>
  );
}

const sv = {
  container: { display: 'flex', height: '100%', width: '100%', overflow: 'hidden' },
  pane: { display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  divider: {
    width: '6px', cursor: 'col-resize', background: '#0a0a0a',
    borderLeft: '1px solid #1a1a1a', borderRight: '1px solid #1a1a1a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'background 120ms',
  },
  dividerGrip: { width: '2px', height: '32px', background: '#2a2a2a', borderRadius: '1px' },
  rightHeader: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
    borderBottom: '1px solid #1a1a1a', background: '#0c0c0c', flexShrink: 0,
    position: 'relative',
  },
  paneSelector: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '3px 8px', borderRadius: '4px', border: '1px solid #1f1530',
    background: '#1a1530', cursor: 'pointer', fontSize: '11px',
    fontFamily: "'JetBrains Mono', monospace",
  },
  closeBtn: {
    marginLeft: 'auto', width: '22px', height: '22px',
    border: '1px solid #1a1a1a', background: 'transparent', color: '#666',
    borderRadius: '4px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  picker: {
    position: 'absolute', top: '36px', left: '10px', zIndex: 30,
    background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: '6px',
    padding: '4px', minWidth: '160px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
  },
  pickerItem: {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '6px 10px', borderRadius: '4px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: '12px', fontFamily: "'Inter', sans-serif",
  },
};

Object.assign(window, { SplitView });
