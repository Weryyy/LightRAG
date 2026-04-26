#!/usr/bin/env python3
"""LightRAG Knowledge Graph Viewer - Obsidian-style force-directed visualization."""

import json
import webbrowser
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

GRAPHML_PATH = Path(__file__).parent / "rag_storage" / "graph_chunk_entity_relation.graphml"
PORT = 8765
NS = {"g": "http://graphml.graphdrawing.org/xmlns"}


def load_graph():
    tree = ET.parse(GRAPHML_PATH)
    root = tree.getroot()

    keys = {k.attrib["id"]: k.attrib["attr.name"] for k in root.findall("g:key", NS)}

    nodes = []
    for node in root.findall(".//g:node", NS):
        n = {"id": node.attrib["id"]}
        for d in node.findall("g:data", NS):
            n[keys.get(d.attrib["key"], d.attrib["key"])] = d.text or ""
        # Clean up duplicate descriptions separated by <SEP>
        if "description" in n:
            parts = n["description"].split("<SEP>")
            n["description"] = parts[0].strip()
        nodes.append(n)

    edges = []
    for edge in root.findall(".//g:edge", NS):
        e = {"source": edge.attrib["source"], "target": edge.attrib["target"]}
        for d in edge.findall("g:data", NS):
            e[keys.get(d.attrib["key"], d.attrib["key"])] = d.text or ""
        if "description" in e:
            parts = e["description"].split("<SEP>")
            e["description"] = parts[0].strip()
        try:
            e["weight"] = float(e.get("weight", 1.0))
        except (ValueError, TypeError):
            e["weight"] = 1.0
        edges.append(e)

    return {"nodes": nodes, "edges": edges}


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>LightRAG Knowledge Graph</title>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0d0d0d; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; overflow: hidden; }

  #app { display: flex; height: 100vh; width: 100vw; }

  #canvas-wrap { flex: 1; position: relative; }
  svg { width: 100%; height: 100%; }

  .link { stroke: #333; stroke-opacity: 0.6; transition: stroke-opacity 0.2s; }
  .link.highlighted { stroke: #7c6af7; stroke-opacity: 1; }
  .link.faded { stroke-opacity: 0.05; }

  .node circle { cursor: pointer; stroke: #1a1a2e; stroke-width: 1.5px; transition: r 0.15s, filter 0.15s; }
  .node circle.selected { filter: drop-shadow(0 0 8px currentColor); stroke: #fff; stroke-width: 2px; }
  .node circle.faded { opacity: 0.15; }

  .node text {
    font-size: 10px; fill: #aaa; pointer-events: none;
    text-shadow: 0 0 4px #000, 0 0 4px #000;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .node:hover text, .node.show-label text { opacity: 1; }

  /* Sidebar */
  #sidebar {
    width: 320px; background: #111; border-left: 1px solid #222;
    display: flex; flex-direction: column; overflow: hidden;
    transition: width 0.2s;
  }
  #sidebar.collapsed { width: 0; }

  #sidebar-header {
    padding: 16px; border-bottom: 1px solid #222;
    display: flex; align-items: center; justify-content: space-between;
  }
  #sidebar-header h2 { font-size: 13px; color: #888; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; }
  #close-btn { background: none; border: none; color: #555; cursor: pointer; font-size: 18px; line-height: 1; padding: 2px 6px; border-radius: 4px; }
  #close-btn:hover { color: #aaa; background: #1e1e1e; }

  #node-detail { padding: 16px; overflow-y: auto; flex: 1; }
  #node-name { font-size: 15px; font-weight: 600; color: #e8e8e8; margin-bottom: 6px; }
  .type-badge {
    display: inline-block; padding: 2px 8px; border-radius: 12px;
    font-size: 11px; font-weight: 500; margin-bottom: 12px;
  }
  .detail-label { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.06em; margin: 12px 0 4px; }
  .detail-value { font-size: 12px; color: #bbb; line-height: 1.6; }
  .connections-list { list-style: none; }
  .connections-list li {
    padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #999;
    cursor: pointer; margin-bottom: 2px;
  }
  .connections-list li:hover { background: #1a1a2e; color: #e0e0e0; }
  .conn-label { font-size: 10px; color: #555; margin-left: 6px; }

  /* Toolbar */
  #toolbar {
    position: absolute; top: 16px; left: 16px;
    display: flex; flex-direction: column; gap: 8px; z-index: 10;
  }
  #search-wrap { position: relative; }
  #search {
    background: #161616; border: 1px solid #2a2a2a; color: #e0e0e0;
    padding: 7px 12px 7px 32px; border-radius: 8px; font-size: 13px;
    width: 220px; outline: none;
  }
  #search:focus { border-color: #7c6af7; }
  #search-wrap::before { content: '⌕'; position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #555; font-size: 15px; }

  #stats { font-size: 11px; color: #444; padding: 4px 0; }

  /* Legend */
  #legend {
    position: absolute; bottom: 16px; left: 16px;
    background: rgba(13,13,13,0.85); border: 1px solid #1e1e1e;
    border-radius: 8px; padding: 10px 14px; z-index: 10;
    max-height: 260px; overflow-y: auto;
  }
  #legend h3 { font-size: 10px; color: #444; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  .legend-item { display: flex; align-items: center; gap: 7px; padding: 2px 0; cursor: pointer; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .legend-item span { font-size: 11px; color: #888; }
  .legend-item.muted span { color: #333; }
  .legend-item.muted .legend-dot { opacity: 0.2; }

  /* Controls */
  #controls { position: absolute; bottom: 16px; right: 16px; display: flex; flex-direction: column; gap: 6px; z-index: 10; }
  .ctrl-btn {
    width: 32px; height: 32px; background: #161616; border: 1px solid #2a2a2a;
    color: #888; border-radius: 6px; cursor: pointer; font-size: 16px;
    display: flex; align-items: center; justify-content: center;
  }
  .ctrl-btn:hover { background: #1e1e1e; color: #e0e0e0; }
</style>
</head>
<body>
<div id="app">
  <div id="canvas-wrap">
    <svg id="graph"></svg>

    <div id="toolbar">
      <div id="search-wrap">
        <input id="search" type="text" placeholder="Search nodes…" autocomplete="off">
      </div>
      <div id="stats"></div>
    </div>

    <div id="legend">
      <h3>Entity Types</h3>
      <div id="legend-items"></div>
    </div>

    <div id="controls">
      <button class="ctrl-btn" id="zoom-in" title="Zoom in">+</button>
      <button class="ctrl-btn" id="zoom-out" title="Zoom out">−</button>
      <button class="ctrl-btn" id="zoom-fit" title="Fit all" style="font-size:12px">⊡</button>
    </div>
  </div>

  <div id="sidebar" class="collapsed">
    <div id="sidebar-header">
      <h2>Node Detail</h2>
      <button id="close-btn">×</button>
    </div>
    <div id="node-detail"></div>
  </div>
</div>

<script>
const GRAPH_DATA = __GRAPH_DATA__;

const TYPE_COLORS = {
  concept:      "#7c6af7",
  technology:   "#4ecdc4",
  person:       "#ff6b6b",
  organization: "#ffd93d",
  method:       "#6bcb77",
  module:       "#4d96ff",
  event:        "#ff922b",
  content:      "#cc5de8",
  artifact:     "#74c0fc",
  category:     "#a9e34b",
  location:     "#f783ac",
  language:     "#63e6be",
  data:         "#e599f7",
  product:      "#ffa94d",
  equipment:    "#91a7ff",
  parameter:    "#a9e34b",
  city:         "#f783ac",
  list:         "#96f2d7",
  UNKNOWN:      "#3a3a4a",
};

function typeColor(t) { return TYPE_COLORS[t] || "#666"; }

// Build node index (null-proto to avoid collisions with "constructor", "toString", etc.)
const nodeById = Object.create(null);
GRAPH_DATA.nodes.forEach(n => nodeById[n.id] = n);

// Adjacency for hover highlighting
const adj = Object.create(null);
GRAPH_DATA.edges.forEach(e => {
  (adj[e.source] = adj[e.source] || new Set()).add(e.target);
  (adj[e.target] = adj[e.target] || new Set()).add(e.source);
});

const w = () => document.getElementById("canvas-wrap").clientWidth;
const h = () => document.getElementById("canvas-wrap").clientHeight;

const svg = d3.select("#graph");
const defs = svg.append("defs");

// Arrow marker (unused but ready)
defs.append("marker").attr("id","arrow").attr("viewBox","0 -5 10 10").attr("refX",18)
  .attr("markerWidth",6).attr("markerHeight",6).attr("orient","auto")
  .append("path").attr("d","M0,-5L10,0L0,5").attr("fill","#555");

const g = svg.append("g");

const zoom = d3.zoom().scaleExtent([0.05, 4]).on("zoom", e => g.attr("transform", e.transform));
svg.call(zoom);

// Edge thickness scale
const wExtent = d3.extent(GRAPH_DATA.edges, e => e.weight);
const strokeScale = d3.scaleLinear().domain(wExtent).range([1, 4]);

// Simulation
const sim = d3.forceSimulation(GRAPH_DATA.nodes)
  .force("link", d3.forceLink(GRAPH_DATA.edges).id(d => d.id).distance(120).strength(0.4))
  .force("charge", d3.forceManyBody().strength(-350))
  .force("center", d3.forceCenter(600, 400))
  .force("collide", d3.forceCollide(22));

// Draw edges
const link = g.append("g").selectAll("line")
  .data(GRAPH_DATA.edges).join("line")
  .attr("class", "link")
  .attr("stroke-width", d => strokeScale(d.weight));

// Draw nodes
const node = g.append("g").selectAll(".node")
  .data(GRAPH_DATA.nodes).join("g")
  .attr("class", "node")
  .call(d3.drag()
    .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
    .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
    .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
  )
  .on("click", (e, d) => { e.stopPropagation(); selectNode(d); })
  .on("mouseover", (e, d) => highlightNode(d))
  .on("mouseout", () => clearHighlight());

node.append("circle")
  .attr("r", d => {
    const deg = (adj[d.id] || new Set()).size;
    return 7 + Math.min(deg * 1.5, 10);
  })
  .attr("fill", d => typeColor(d.entity_type));

node.append("text")
  .attr("dx", 12).attr("dy", 4)
  .text(d => d.id.length > 22 ? d.id.slice(0, 20) + "…" : d.id);

svg.on("click", () => deselect());

sim.on("tick", () => {
  link
    .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
  node.attr("transform", d => `translate(${d.x},${d.y})`);
});

// Stats
document.getElementById("stats").textContent =
  `${GRAPH_DATA.nodes.length} nodes · ${GRAPH_DATA.edges.length} edges`;

// Legend
const types = [...new Set(GRAPH_DATA.nodes.map(n => n.entity_type))].sort();
const hiddenTypes = new Set();
const legendEl = document.getElementById("legend-items");
types.forEach(t => {
  const item = document.createElement("div");
  item.className = "legend-item";
  item.dataset.type = t;
  item.innerHTML = `<div class="legend-dot" style="background:${typeColor(t)}"></div><span>${t} <em style="color:#444">(${GRAPH_DATA.nodes.filter(n=>n.entity_type===t).length})</em></span>`;
  item.addEventListener("click", () => toggleType(t, item));
  legendEl.appendChild(item);
});

function toggleType(t, item) {
  if (hiddenTypes.has(t)) {
    hiddenTypes.delete(t);
    item.classList.remove("muted");
  } else {
    hiddenTypes.add(t);
    item.classList.add("muted");
  }
  node.style("display", d => hiddenTypes.has(d.entity_type) ? "none" : null);
  link.style("display", d => {
    const sn = nodeById[typeof d.source === "object" ? d.source.id : d.source];
    const tn = nodeById[typeof d.target === "object" ? d.target.id : d.target];
    return (sn && hiddenTypes.has(sn.entity_type)) || (tn && hiddenTypes.has(tn.entity_type)) ? "none" : null;
  });
}

// Highlight
function highlightNode(d) {
  const neighbors = adj[d.id] || new Set();
  node.select("circle").classed("faded", n => n.id !== d.id && !neighbors.has(n.id));
  link.classed("highlighted", e => e.source.id === d.id || e.target.id === d.id)
      .classed("faded",       e => e.source.id !== d.id && e.target.id !== d.id);
}
function clearHighlight() {
  node.select("circle").classed("faded", false);
  link.classed("highlighted", false).classed("faded", false);
}

// Selection / sidebar
let selectedId = null;
function selectNode(d) {
  if (selectedId === d.id) { deselect(); return; }
  selectedId = d.id;
  node.select("circle").classed("selected", n => n.id === d.id);
  node.classed("show-label", n => n.id === d.id);
  showSidebar(d);
}
function deselect() {
  selectedId = null;
  node.select("circle").classed("selected", false);
  node.classed("show-label", false);
  document.getElementById("sidebar").classList.add("collapsed");
}

function edgeNodeId(ref) {
  return typeof ref === "object" && ref !== null ? ref.id : ref;
}

function showSidebar(d) {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.remove("collapsed");
  const neighbors = [...(adj[d.id] || new Set())];
  const connEdges = GRAPH_DATA.edges.filter(e => edgeNodeId(e.source) === d.id || edgeNodeId(e.target) === d.id);

  const detail = document.getElementById("node-detail");
  detail.innerHTML = "";

  const nameEl = document.createElement("div");
  nameEl.id = "node-name";
  nameEl.textContent = d.id;
  detail.appendChild(nameEl);

  const badge = document.createElement("span");
  badge.className = "type-badge";
  badge.textContent = d.entity_type || "unknown";
  badge.style.cssText = `background:${typeColor(d.entity_type)}22;color:${typeColor(d.entity_type)};border:1px solid ${typeColor(d.entity_type)}44`;
  detail.appendChild(badge);

  if (d.description) {
    const lbl = document.createElement("div"); lbl.className = "detail-label"; lbl.textContent = "Description"; detail.appendChild(lbl);
    const val = document.createElement("div"); val.className = "detail-value"; val.textContent = d.description; detail.appendChild(val);
  }
  if (d.file_path && d.file_path !== "unknown_source") {
    const lbl = document.createElement("div"); lbl.className = "detail-label"; lbl.textContent = "Source"; detail.appendChild(lbl);
    const val = document.createElement("div"); val.className = "detail-value"; val.style.cssText = "font-size:11px;word-break:break-all"; val.textContent = d.file_path; detail.appendChild(val);
  }

  const connLbl = document.createElement("div"); connLbl.className = "detail-label"; connLbl.textContent = `Connections (${neighbors.length})`; detail.appendChild(connLbl);
  const ul = document.createElement("ul"); ul.className = "connections-list";
  connEdges.forEach(e => {
    const otherId = edgeNodeId(e.source) === d.id ? edgeNodeId(e.target) : edgeNodeId(e.source);
    const other = nodeById[otherId] || {entity_type: "?"};
    const li = document.createElement("li");
    li.dataset.nodeId = otherId;
    li.innerHTML = `<span style="color:${typeColor(other.entity_type)};font-size:9px;">●</span> `;
    const nameSpan = document.createElement("span"); nameSpan.textContent = otherId; li.appendChild(nameSpan);
    if (e.keywords) { const kw = document.createElement("span"); kw.className = "conn-label"; kw.textContent = e.keywords.split(",")[0]; li.appendChild(kw); }
    li.addEventListener("click", () => jumpTo(otherId));
    ul.appendChild(li);
  });
  detail.appendChild(ul);
}

function jumpTo(id) {
  const d = nodeById[id];
  if (!d) return;
  selectNode(d);
  const t = d3.zoomTransform(svg.node());
  svg.transition().duration(500).call(
    zoom.transform,
    d3.zoomIdentity.translate(w()/2 - d.x, h()/2 - d.y).scale(Math.max(t.k, 1.2))
  );
}

document.getElementById("close-btn").addEventListener("click", deselect);

// Search
document.getElementById("search").addEventListener("input", function() {
  const q = this.value.trim().toLowerCase();
  if (!q) { node.select("circle").classed("faded", false); return; }
  const matches = GRAPH_DATA.nodes.filter(n => n.id.toLowerCase().includes(q));
  node.select("circle").classed("faded", n => !n.id.toLowerCase().includes(q));
  if (matches.length === 1) jumpTo(matches[0].id);
});

// Zoom controls
document.getElementById("zoom-in").addEventListener("click", () => svg.transition().call(zoom.scaleBy, 1.4));
document.getElementById("zoom-out").addEventListener("click", () => svg.transition().call(zoom.scaleBy, 0.7));
document.getElementById("zoom-fit").addEventListener("click", fitAll);

function fitAll() {
  const bounds = g.node().getBBox();
  if (!bounds.width || !bounds.height) return;
  const pad = 40;
  const scale = Math.min((w()-pad*2)/bounds.width, (h()-pad*2)/bounds.height, 2);
  const tx = w()/2 - (bounds.x + bounds.width/2) * scale;
  const ty = h()/2 - (bounds.y + bounds.height/2) * scale;
  svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}

// Auto-fit after simulation settles
sim.on("end", fitAll);
setTimeout(fitAll, 3000);
</script>
</body>
</html>
"""


def build_html(graph_data: dict) -> str:
    return HTML_TEMPLATE.replace("__GRAPH_DATA__", json.dumps(graph_data, ensure_ascii=False))


class Handler(BaseHTTPRequestHandler):
    html_content: bytes = b""

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(self.html_content)))
        self.end_headers()
        self.wfile.write(self.html_content)

    def log_message(self, fmt, *args):
        pass  # silence request logs


def main():
    if not GRAPHML_PATH.exists():
        print(f"ERROR: graphml not found at {GRAPHML_PATH}")
        print("Make sure LightRAG has processed at least one document.")
        return
    print("Loading graph data…")
    graph_data = load_graph()
    print(f"  {len(graph_data['nodes'])} nodes, {len(graph_data['edges'])} edges")

    html_bytes = build_html(graph_data).encode("utf-8")
    Handler.html_content = html_bytes

    server = HTTPServer(("localhost", PORT), Handler)
    url = f"http://localhost:{PORT}"
    print(f"Serving at {url}")
    print("Press Ctrl+C to stop.")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    except OSError as exc:
        if "Address already in use" in str(exc) or exc.errno == 10048:
            print(f"ERROR: Port {PORT} already in use. Kill the existing process or change PORT.")
        else:
            raise


if __name__ == "__main__":
    main()
