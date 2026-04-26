# Handoff: LightRAG UI

## Overview
A full-featured local UI for LightRAG — a graph-based RAG system. The interface lets users chat with their knowledge graph, explore the entity graph visually, manage ingested documents, and monitor the ingest pipeline health. Designed to run as a local web app (vite/react or similar) connected to a LightRAG backend.

## About the Design Files
The files in this bundle are **design references created as HTML prototypes** — they show the intended look, layout, and interactive behavior. The task is to **recreate these designs in your target codebase** (React + Vite recommended, since all components are already React/JSX). Do not ship the HTML files directly; they use CDN-loaded React+Babel for prototyping and are not production-ready.

## Fidelity
**High-fidelity.** The prototypes are pixel-accurate designs with final colors, typography, spacing, and interactions. Recreate the UI faithfully using your codebase's established patterns. All colors, font families, spacing, and component behavior are specified below.

---

## Design Tokens

### Colors
```
Background (app)      #0a0a0a
Background (panel)    #111111
Background (card)     #0d0d0d
Background (input)    #0d0d0d
Border (default)      #1f1f1f
Border (subtle)       #1a1a1a
Border (accent)       #2a2a2a

Accent purple         #7c6af7
Accent purple (fill)  #1a1530
Accent purple (border)#7c6af740

Text primary          #f0f0f0
Text secondary        #c0c0c0
Text muted            #888888
Text dim              #555555
Text disabled         #444444

Green (ok)            #22c55e
Amber (warning)       #f59e0b
Red (error)           #ef4444

Category: tecnica     bg:#0d1a2e  text:#60a5fa  border:#3b82f620
Category: estudio     bg:#0d1f12  text:#4ade80  border:#22c55e20
Category: proyectos   bg:#1a1020  text:#c084fc  border:#a855f720
Category: notas       bg:#1a1510  text:#fb923c  border:#f9731620
```

### Typography
```
Font UI:      'Inter', sans-serif
Font mono:    'JetBrains Mono', monospace

Sizes: 10px / 11px / 12px / 13px / 14px / 16px / 22px
Weights: 400 / 500 / 600
```

### Spacing / Radius
```
Panel padding:    20–32px
Card radius:      8px
Button radius:    5–6px
Chip radius:      4px
Badge radius:     4px
Input radius:     6px
```

### Shadows
```
Modal:  0 20px 60px rgba(0,0,0,0.6)
Split picker: 0 8px 24px rgba(0,0,0,0.6)
```

---

## Layout

### App Shell
- Full viewport, dark background `#0a0a0a`
- **Sidebar** (fixed left, 220px wide) + **Main area** (flex: 1)
- Main area = Topbar (40px, border-bottom `#1a1a1a`) + View content (flex: 1, overflow hidden)
- Mobile (≤768px): sidebar hidden by default, hamburger button in topbar opens it as overlay

### Sidebar
- Logo area at top (LightRAG title, server status dot)
- Nav items: Search, Graph Explorer, Documents, Health
- Active item: background `#1a1530`, accent color `#a78bfa`, border-left `2px solid #7c6af7`
- Hover: background `#141414`
- Server status: animated green dot when online, red when offline

### Topbar
- Left: hamburger (mobile) + breadcrumb (`LightRAG / [View Name]`)
- Right: ⌘K shortcut (Search only) + **Split** toggle button + version badge
- Split button: activates split-view, highlights purple when active

---

## Views / Screens

### 1. Search (Chat Interface)
**Purpose:** Chat with the knowledge graph using LightRAG queries.

**Layout:**
- Full-height flex column
- Top: mode selector tabs (Hybrid / Local / Global / Naive) — pill group
- Middle: message list, scrollable, messages have max-width ~720px, centered
- Bottom: input bar (sticky), multiline textarea + send button

**Message bubbles:**
- User: right-aligned, bg `#1a1530`, border `#7c6af740`, text `#e0e0e0`, radius 12px
- Assistant: left-aligned, bg `#111`, border `#1f1f1f`, text `#c0c0c0`
- Each message shows timestamp (mono, `#555`)
- Sources block below assistant messages: chips showing entity names in category colors, expandable

**Input bar:**
- bg `#111`, border `#2a2a2a`, radius 10px, padding 14px 16px
- Textarea auto-grows, mono font
- Send button: bg `#1a1530`, border `#7c6af740`, color `#a78bfa`, hover fills brighter
- Mode selector persists across messages

---

### 2. Graph Explorer
**Purpose:** Force-directed graph of entities and their relationships.

**Layout:**
- Controls row at top: search input, type-filter chips (Concept/Person/Technology/File/Topic/Process)
- Main area: SVG graph (auto-sized) + right column (entity detail + all-nodes list)

**Graph:**
- SVG force-directed simulation (use d3-force or equivalent)
- Nodes: circles, color-coded by entity type
- Selected node: larger radius, glow ring, connections highlighted; non-connected nodes fade to 0.18 opacity
- Draggable nodes (mouse/touch)
- Edges: `#2a2a2a`, opacity 0.4
- Node labels: appear on hover/selection

**Entity Detail Panel** (right column, appears when node selected):
- Header: entity name + type badge + close button
- Description paragraph
- CONNECTIONS section: list of related entities (clickable, navigates graph)
- SOURCE DOCUMENTS section: clickable doc paths → opens Documents view filtered to that doc
  - "open in Documents →" link triggers cross-view navigation

**All Nodes Panel:**
- Scrollable list of all entities with search filter
- Click to select/focus node in graph

---

### 3. Documents
**Purpose:** Browse, search, and view ingested documents.

**Layout:**
- Stats bar (5 cards): Total / Processed / Failed / Processing / Last indexed
- Search + filters row
- Full-width table (scrollable)
- Batch action bar (appears when rows selected)

**Search bar:**
- Text input with search icon, placeholder "Search by path, filename, category…"
- Category filter chips: all / tecnica / estudio / proyectos / notas
- Status filter chips: all / processed / processing / failed
- Result count + "clear" link

**Table columns:** checkbox | status icon | file path | category badge | size | indexed | actions

**Row actions:**
- `View` button (always visible on processed docs): purple style, opens inline doc viewer
- `Retry` button (failed docs only): red style

**Document Viewer (inline):**
- Renders INSIDE the documents panel (position: absolute, inset: 0), not fullscreen modal
- Header: filename + path + meta tags + close button
- Body: rendered markdown (code blocks, headings, tables, paragraphs)
- Footer: Esc hint + "Open in editor" action

---

### 4. Health Dashboard
**Purpose:** Monitor server stats and ingest pipeline.

**Layout (top to bottom):**
1. Stats grid: Server status, Model, VRAM gauge, Queue depth, Throughput, Uptime
2. **Pipeline Panel** (new): live ingest queue + log
3. Activity Log table

**Stats grid:**
- VRAM: arc gauge (SVG), color-coded by usage %
- Sparklines for throughput history
- Badges for model name, uptime

**Pipeline Panel:**
- Split: left = queue (items with progress bars), right = live log
- Each queue item: status badge (queued/processing), file path, progress bar (animated), stage label, retry (↻) + cancel (✕) buttons
- Global: Pause/Resume + Cancel queue buttons
- Live log: scrollable monospace list with timestamps and colored level labels (INFO/OK/WARN/ERR)
- Simulated in prototype; real implementation polls `/api/pipeline/status`

---

## Split View
- **Split button** in topbar toggles split mode
- When active: left pane = current view, right pane = user-selected view
- Draggable divider: min 25% / max 78% left width
- Right pane header: dropdown to change which view is shown, ✕ to close split
- Cross-view navigation (Graph → Documents) opens Documents in the right pane automatically

---

## Interactions & Behavior

| Interaction | Behavior |
|---|---|
| ⌘K (search view) | Focus chat input |
| Esc | Close document viewer |
| Double-click divider | Reset split to 55/45 |
| Click entity node | Select, show detail panel; fade unconnected nodes |
| Drag entity node | Reposition node in graph |
| Click source doc in entity detail | Navigate to Documents filtered by doc name |
| Click View on doc row | Open inline document viewer |
| Pipeline: Pause | Stops progress simulation; resume resumes |
| Pipeline: Cancel queue | Removes queued items, keeps processing |
| Sidebar nav (mobile) | Closes sidebar after navigation |

---

## State Management

Key state (lives in root `App` component):
```typescript
view: 'search' | 'graph' | 'documents' | 'health'
rightView: string | null  // for split-view
docsQuery: string         // shared query from Graph → Documents bridge
mobileMenu: boolean
tweaks: TweakDefaults     // accent color, server online toggle
```

Cross-component bridge: `window.__navigateToDocs(query)` — Graph calls this to open Documents in split with a pre-applied filter. Implement as a React context or router-level action instead.

---

## API Endpoints to Wire Up
These are currently mocked; replace with real LightRAG backend calls:

```
POST   /api/query          { query, mode: 'hybrid'|'local'|'global'|'naive' }
GET    /api/documents      → list of ingested docs with status
GET    /api/graph/entities → nodes + edges for graph
GET    /api/health         → server stats (model, vram, uptime, queue)
GET    /api/pipeline       → current pipeline queue status
POST   /api/pipeline/cancel/:id
POST   /api/pipeline/retry/:id
GET    /api/documents/:id/content → raw text for viewer
```

---

## Assets / Fonts
- **JetBrains Mono** — load from Google Fonts: `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap`
- **Inter** — load from Google Fonts: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap`
- No image assets — all UI is CSS/SVG

---

## Files in This Package

| File | Description |
|---|---|
| `LightRAG UI.html` | Main app shell + App component |
| `sidebar.jsx` | Left sidebar nav component |
| `search-view.jsx` | Chat interface (SearchView) |
| `graph-view.jsx` | Force-directed graph + EntityDetail (GraphView) |
| `documents-view.jsx` | Document table + search + filters (DocumentsView) |
| `document-viewer.jsx` | Inline document content viewer (DocumentViewer) |
| `health-view.jsx` | Health dashboard (HealthView) |
| `pipeline-panel.jsx` | Live pipeline queue + log (PipelinePanel) |
| `split-view.jsx` | Draggable split-pane container (SplitView) |

---

## Notes for Implementation

1. The HTML files use CDN Babel + React — port each `.jsx` component into your build system as normal `.tsx` files.
2. Replace all `MOCK_*` constants with real API calls.
3. The graph simulation is a hand-rolled force sim — replace with `d3-force` for production quality.
4. The pipeline panel uses `setInterval` to simulate progress — replace with SSE or polling.
5. `window.__navigateToDocs` bridge should become a React context action or zustand/jotai atom.
6. Tweak defaults (`TWEAK_DEFAULTS` in the HTML) are a dev convenience — remove for production.
