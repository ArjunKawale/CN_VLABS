/* ================================================================
   script.js  —  Adaptive Network Routing & Traffic Analysis
   Covers: Dijkstra, delay calc, canvas topology, animation, quiz
   ================================================================ */

/* ─────────────────────────────────────────────────────────────
   GRAPH DEFINITION  (same topology as Python project)
   Edge format: adjacency list with weights in ms
   ───────────────────────────────────────────────────────────── */
const GRAPH = {
  R1: { R2: 4,  R3: 2 },
  R2: { R1: 4,  R3: 1,  R4: 5 },
  R3: { R1: 2,  R2: 1,  R5: 10 },
  R4: { R2: 5,  R5: 2,  R6: 8 },
  R5: { R3: 10, R4: 2,  R7: 4 },
  R6: { R4: 8,  R7: 6,  R8: 3 },
  R7: { R5: 4,  R6: 6,  R8: 5 },
  R8: { R6: 3,  R7: 5 },
};

const ROUTERS = Object.keys(GRAPH);

/* ─────────────────────────────────────────────────────────────
   TOPOLOGY LAYOUT  (pixel positions for canvas drawing)
   ───────────────────────────────────────────────────────────── */
const TOPO_POSITIONS = {
  R1: { x: 80,  y: 100 },
  R2: { x: 200, y: 40  },
  R3: { x: 200, y: 160 },
  R4: { x: 340, y: 40  },
  R5: { x: 340, y: 160 },
  R6: { x: 480, y: 60  },
  R7: { x: 480, y: 160 },
  R8: { x: 600, y: 110 },
};

/* Scaled versions for the two different canvases */
function scaledPos(pos, w, h, padX = 60, padY = 40) {
  const xs = Object.values(pos).map(p => p.x);
  const ys = Object.values(pos).map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const result = {};
  for (const k in pos) {
    result[k] = {
      x: padX + ((pos[k].x - minX) / (maxX - minX)) * (w - padX * 2),
      y: padY + ((pos[k].y - minY) / (maxY - minY)) * (h - padY * 2),
    };
  }
  return result;
}

/* ─────────────────────────────────────────────────────────────
   NAVIGATION  (SPA)
   ───────────────────────────────────────────────────────────── */
function showSection(id) {
  document.querySelectorAll('.page-section').forEach(s => s.style.display = 'none');
  const t = document.getElementById(id);
  if (t) t.style.display = 'block';

  document.querySelectorAll('nav ul li a').forEach(a => {
    a.classList.remove('nav-active');
    if (a.getAttribute('data-section') === id) a.classList.add('nav-active');
  });

  if (id === 'section-topology') initTopology();
  if (id === 'section-sim')      initSimCanvas();
}

/* ─────────────────────────────────────────────────────────────
   DARK MODE
   ───────────────────────────────────────────────────────────── */
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  // Redraw canvases after theme switch
  setTimeout(() => {
    drawFullTopology(null);
    drawSimCanvas(null);
  }, 50);
}

/* ─────────────────────────────────────────────────────────────
   DIJKSTRA  —  returns { path, cost, steps }
   ───────────────────────────────────────────────────────────── */
function dijkstra(src, dst) {
  const dist  = {};
  const prev  = {};
  const visited = new Set();
  const steps = [];   // relaxation trace

  for (const n of ROUTERS) { dist[n] = Infinity; prev[n] = null; }
  dist[src] = 0;

  // Simple priority queue via sorted array (n=8, performance irrelevant)
  const pq = [{ node: src, d: 0 }];

  while (pq.length) {
    pq.sort((a, b) => a.d - b.d);
    const { node: u } = pq.shift();
    if (visited.has(u)) continue;
    visited.add(u);

    for (const [v, w] of Object.entries(GRAPH[u] || {})) {
      const nd = dist[u] + w;
      if (nd < dist[v]) {
        dist[v] = nd;
        prev[v] = u;
        steps.push({ from: u, to: v, linkWt: w, newCost: nd });
        pq.push({ node: v, d: nd });
      }
    }
  }

  // Reconstruct path
  const path = [];
  let cur = dst;
  while (cur !== null) { path.unshift(cur); cur = prev[cur]; }
  if (path[0] !== src) return { path: [], cost: Infinity, steps };
  return { path, cost: dist[dst], steps };
}

/* ─────────────────────────────────────────────────────────────
   ALL SIMPLE PATHS  (brute-force DFS, cutoff=8)
   ───────────────────────────────────────────────────────────── */
function allSimplePaths(src, dst, cutoff = 8) {
  const results = [];
  const dfs = (cur, dest, visited, path) => {
    if (path.length > cutoff) return;
    if (cur === dest) {
      const cost = path.reduce((s, _, i) =>
        i === 0 ? s : s + GRAPH[path[i - 1]][path[i]], 0);
      results.push({ path: [...path], cost, hops: path.length - 1 });
      return;
    }
    for (const nb of Object.keys(GRAPH[cur] || {})) {
      if (!visited.has(nb)) {
        visited.add(nb);
        path.push(nb);
        dfs(nb, dest, visited, path);
        path.pop();
        visited.delete(nb);
      }
    }
  };
  const v = new Set([src]);
  dfs(src, dst, v, [src]);
  results.sort((a, b) => a.cost - b.cost || a.hops - b.hops);
  return results;
}

/* ─────────────────────────────────────────────────────────────
   DELAY CALCULATIONS
   ───────────────────────────────────────────────────────────── */
function calcDelays(path, pktBytes = 1500, bwMbps = 100) {
  const hops = path.length - 1;
  const propMs = path.reduce((s, _, i) =>
    i === 0 ? s : s + GRAPH[path[i - 1]][path[i]], 0);
  const txPerLink = (pktBytes * 8) / (bwMbps * 1e6) * 1000;
  const txMs   = txPerLink * hops;
  const procMs = 0.5 * hops;
  const totalMs = propMs + txMs + procMs;
  const rttMs  = 2 * totalMs;
  const bdpBits = bwMbps * 1e6 * (rttMs / 1000);
  const throughput = hops > 0 ? bwMbps / hops : bwMbps;
  return {
    hops, propMs, txMs: +txMs.toFixed(4), procMs: +procMs.toFixed(4),
    totalMs: +totalMs.toFixed(4), rttMs: +rttMs.toFixed(4),
    bdpBits: +bdpBits.toFixed(2), throughput: +throughput.toFixed(4),
  };
}

function qosGrade(ms) {
  if (ms < 150)  return 'A — Excellent';
  if (ms < 400)  return 'B — Good';
  if (ms < 1000) return 'C — Fair';
  return 'D — Poor';
}

/* ─────────────────────────────────────────────────────────────
   CANVAS HELPERS
   ───────────────────────────────────────────────────────────── */
function isDark() { return document.body.classList.contains('dark-mode'); }

function drawTopologyOnCanvas(canvasId, highlightPath = null, nodePositions = null) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const pos = nodePositions || scaledPos(TOPO_POSITIONS, w, h);

  ctx.clearRect(0, 0, w, h);

  const bg       = isDark() ? '#111827' : '#f8faff';
  const edgeCol  = isDark() ? '#334155' : '#b0c4de';
  const nodeCol  = isDark() ? '#1f6feb' : '#1f6feb';
  const nodeText = '#ffffff';
  const hlEdge   = '#f59e0b';
  const hlNode   = '#f59e0b';
  const labelCol = isDark() ? '#94a3b8' : '#4a6fa5';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Build highlight edge set
  const hlEdges = new Set();
  if (highlightPath && highlightPath.length > 1) {
    for (let i = 0; i < highlightPath.length - 1; i++) {
      hlEdges.add(`${highlightPath[i]}-${highlightPath[i+1]}`);
      hlEdges.add(`${highlightPath[i+1]}-${highlightPath[i]}`);
    }
  }

  // Draw edges
  for (const [u, neighbours] of Object.entries(GRAPH)) {
    for (const [v, w] of Object.entries(neighbours)) {
      if (u > v) continue; // draw once
      const pu = pos[u], pv = pos[v];
      const isHL = hlEdges.has(`${u}-${v}`);

      ctx.beginPath();
      ctx.moveTo(pu.x, pu.y);
      ctx.lineTo(pv.x, pv.y);
      ctx.strokeStyle = isHL ? hlEdge : edgeCol;
      ctx.lineWidth   = isHL ? 3.5 : 1.8;
      ctx.setLineDash(isHL ? [] : []);
      ctx.stroke();

      // Weight label
      const mx = (pu.x + pv.x) / 2;
      const my = (pu.y + pv.y) / 2;
      ctx.fillStyle = labelCol;
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${w}ms`, mx + 2, my - 8);
    }
  }

  // Draw nodes
  const R = canvasId === 'fullTopoCanvas' ? 22 : 16;
  for (const node of ROUTERS) {
    const p = pos[node];
    const isHL = highlightPath && highlightPath.includes(node);

    // Shadow
    ctx.shadowColor = isHL ? 'rgba(245,158,11,0.5)' : 'rgba(0,0,0,0.18)';
    ctx.shadowBlur  = isHL ? 14 : 6;

    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
    ctx.fillStyle = isHL ? hlNode : nodeCol;
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.fillStyle = nodeText;
    ctx.font = `bold ${R < 20 ? 10 : 12}px Syne, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node, p.x, p.y);
  }
  ctx.shadowBlur = 0;
}

/* ─────────────────────────────────────────────────────────────
   SIMULATION CANVAS  (small, inside .simulation-area)
   ───────────────────────────────────────────────────────────── */
let simPath = [];
let simPos  = {};

function initSimCanvas() {
  const canvas = document.getElementById('topoCanvas');
  if (!canvas) return;
  simPos = scaledPos(TOPO_POSITIONS, canvas.width, canvas.height, 50, 30);
  drawTopologyOnCanvas('topoCanvas', simPath, simPos);
}

function drawSimCanvas(hlPath) {
  simPath = hlPath || simPath;
  initSimCanvas();
}

/* ─────────────────────────────────────────────────────────────
   PACKET LOG TABLE
   ───────────────────────────────────────────────────────────── */
let logStep = 1;

function logRow(from, to, flag, linkCost, cumDelay, state, rowClass = '') {
  const table = document.getElementById('logTable');
  if (!table) return;
  const row = table.insertRow();
  if (rowClass) row.className = rowClass;
  row.insertCell(0).innerText = logStep++;
  row.insertCell(1).innerText = from;
  row.insertCell(2).innerText = to;
  row.insertCell(3).innerText = flag;
  row.insertCell(4).innerText = typeof linkCost === 'number' ? linkCost.toFixed(2) : linkCost;
  row.insertCell(5).innerText = typeof cumDelay === 'number' ? cumDelay.toFixed(4) : cumDelay;
  row.insertCell(6).innerText = state;
}

function clearLog() {
  const t = document.getElementById('logTable');
  if (!t) return;
  while (t.rows.length > 1) t.deleteRow(1);
  logStep = 1;
}

/* ─────────────────────────────────────────────────────────────
   PACKET ANIMATION along path nodes
   ───────────────────────────────────────────────────────────── */
function animatePacketAlongPath(path, positions, onComplete) {
  const packet = document.getElementById('packet');
  if (!packet || path.length < 2) { if (onComplete) onComplete(); return; }

  let hopIndex = 0;
  packet.style.display = 'block';
  packet.innerText = 'PKT';

  function moveToHop() {
    if (hopIndex >= path.length) {
      setTimeout(() => {
        packet.style.display = 'none';
        if (onComplete) onComplete();
      }, 400);
      return;
    }

    const node = path[hopIndex];
    const p = positions[node];
    if (!p) { hopIndex++; moveToHop(); return; }

    const targetLeft = p.x - 36; // centre packet on node
    const targetTop  = p.y - 16;

    packet.style.transition = hopIndex === 0 ? 'none' : 'left 0.45s ease, top 0.45s ease';
    packet.style.left = targetLeft + 'px';
    packet.style.top  = targetTop  + 'px';

    hopIndex++;
    setTimeout(moveToHop, hopIndex === 1 ? 50 : 520);
  }
  moveToHop();
}

/* ─────────────────────────────────────────────────────────────
   RUN DIJKSTRA  (Simulation section)
   ───────────────────────────────────────────────────────────── */
function runDijkstra() {
  const src   = document.getElementById('srcSelect').value;
  const dst   = document.getElementById('dstSelect').value;
  const pkt   = +document.getElementById('pktSize').value   || 1500;
  const bw    = +document.getElementById('bandwidth').value || 100;

  if (src === dst) {
    alert('Source and destination must be different.');
    return;
  }

  clearLog();
  const stateEl = document.getElementById('routeState');
  const descEl  = document.getElementById('routeDesc');

  const { path, cost } = dijkstra(src, dst);

  if (!path.length) {
    stateEl.innerText = 'UNREACHABLE';
    descEl.innerText  = `No path found from ${src} to ${dst}.`;
    return;
  }

  const delays = calcDelays(path, pkt, bw);

  stateEl.innerText = 'ROUTING…';
  descEl.innerText  = `Shortest path: ${path.join(' → ')}  |  Cost: ${cost} ms  |  Hops: ${delays.hops}`;

  // Draw path on sim canvas
  simPath = path;
  drawSimCanvas(path);

  // Log each hop
  let cumDelay = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const u = path[i], v = path[i+1];
    const w = GRAPH[u][v];
    const hopDelay = w + delays.txMs / delays.hops + 0.5;
    cumDelay += hopDelay;
    logRow(u, v, 'DATA', w, cumDelay, i === path.length - 2 ? 'DELIVERED' : 'IN_TRANSIT', 'log-hop');
  }

  // Animate
  const canvas = document.getElementById('topoCanvas');
  const cw = canvas.width, ch = canvas.height;
  const pos = scaledPos(TOPO_POSITIONS, cw, ch, 50, 30);
  animatePacketAlongPath(path, pos, () => {
    stateEl.innerText = 'DELIVERED';
    logRow('System', '-', 'DELIVERED', '-', delays.totalMs, 'DONE', 'log-ok');
  });
}

/* ─────────────────────────────────────────────────────────────
   SIMULATE PACKET LOSS
   ───────────────────────────────────────────────────────────── */
function simulateLoss() {
  const src = document.getElementById('srcSelect').value;
  const dst = document.getElementById('dstSelect').value;
  if (src === dst) { alert('Source and destination must be different.'); return; }

  clearLog();
  const { path } = dijkstra(src, dst);
  if (!path.length) { alert('No path found.'); return; }

  // Pick a random intermediate hop to drop
  const lossHop = Math.floor(Math.random() * (path.length - 1));
  let cumDelay  = 0;

  document.getElementById('routeState').innerText = 'ROUTING…';

  for (let i = 0; i < path.length - 1; i++) {
    const u = path[i], v = path[i+1], w = GRAPH[u][v];
    if (i === lossHop) {
      logRow(u, v, '⚡ LOST', w, '—', 'DROPPED', 'log-lost');
      setTimeout(() => {
        document.getElementById('routeState').innerText = 'LOSS DETECTED';
        document.getElementById('routeDesc').innerText =
          `Packet lost at hop ${lossHop + 1} (${u}→${v}). Retransmission triggered.`;
        // Retransmit after 2s
        setTimeout(runDijkstra, 2000);
      }, 600);
      return;
    }
    cumDelay += w + 0.5;
    logRow(u, v, 'DATA', w, cumDelay, 'IN_TRANSIT', 'log-hop');
  }
}

/* ─────────────────────────────────────────────────────────────
   RESET SIMULATION
   ───────────────────────────────────────────────────────────── */
function resetSimulation() {
  clearLog();
  simPath = [];
  document.getElementById('routeState').innerText = 'IDLE';
  document.getElementById('routeDesc').innerText  = 'Select source and destination, then click Run Dijkstra.';
  const pkt = document.getElementById('packet');
  if (pkt) pkt.style.display = 'none';
  drawSimCanvas([]);
}

/* ─────────────────────────────────────────────────────────────
   NETWORK TOPOLOGY SECTION
   ───────────────────────────────────────────────────────────── */
function initTopology() {
  drawFullTopology(null);
  renderLinkTable();
  renderRoutingTable();
  // Click on canvas to highlight shortest path from clicked node to R8
  const canvas = document.getElementById('fullTopoCanvas');
  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width  / rect.width);
    const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
    const pos = scaledPos(TOPO_POSITIONS, canvas.width, canvas.height);
    for (const [node, p] of Object.entries(pos)) {
      const dx = mx - p.x, dy = my - p.y;
      if (Math.sqrt(dx*dx + dy*dy) < 24) {
        const dst = document.getElementById('rtSelect').value;
        const { path } = dijkstra(node, dst === node ? 'R8' : dst);
        drawFullTopology(path);
        return;
      }
    }
  };
}

function drawFullTopology(hlPath) {
  const canvas = document.getElementById('fullTopoCanvas');
  if (!canvas) return;
  const pos = scaledPos(TOPO_POSITIONS, canvas.width, canvas.height, 70, 50);
  drawTopologyOnCanvas('fullTopoCanvas', hlPath, pos);
}

function renderLinkTable() {
  const t = document.getElementById('linkTable');
  if (!t) return;
  while (t.rows.length > 1) t.deleteRow(1);
  for (const [u, nbrs] of Object.entries(GRAPH)) {
    for (const [v, w] of Object.entries(nbrs)) {
      if (u > v) continue;
      const row = t.insertRow();
      row.insertCell(0).innerText = u;
      row.insertCell(1).innerText = v;
      row.insertCell(2).innerText = w;
      const st = row.insertCell(3);
      st.innerText = 'Active';
      st.style.color = '#16a34a';
      st.style.fontWeight = '700';
    }
  }
}

function renderRoutingTable() {
  const src = document.getElementById('rtSelect').value;
  const t   = document.getElementById('rtTable');
  if (!t) return;
  while (t.rows.length > 1) t.deleteRow(1);

  for (const dst of ROUTERS) {
    if (dst === src) continue;
    const { path, cost } = dijkstra(src, dst);
    const row = t.insertRow();
    row.insertCell(0).innerText = dst;
    row.insertCell(1).innerText = path.length > 1 ? path[1] : '—';
    row.insertCell(2).innerText = cost === Infinity ? '∞' : cost;
    row.insertCell(3).innerText = path.length > 1 ? path.length - 1 : '—';
    row.insertCell(4).innerText = path.length ? path.join(' → ') : 'UNREACHABLE';
  }

  // Highlight topology for selected source to R8
  const { path } = dijkstra(src, 'R8');
  drawFullTopology(path);
}

/* ─────────────────────────────────────────────────────────────
   PERFORMANCE ANALYSIS SECTION
   ───────────────────────────────────────────────────────────── */
function runPerformanceAnalysis() {
  const src  = document.getElementById('perfSrc').value;
  const dst  = document.getElementById('perfDst').value;
  const pkt  = +document.getElementById('perfPkt').value   || 1500;
  const bw   = +document.getElementById('perfBw').value   || 100;

  if (src === dst) { alert('Source and destination must be different.'); return; }

  const paths  = allSimplePaths(src, dst, 8).slice(0, 6);
  const table  = document.getElementById('perfTable');

  while (table.rows.length > 1) table.deleteRow(1);

  paths.forEach((pi, idx) => {
    const d   = calcDelays(pi.path, pkt, bw);
    const qos = qosGrade(d.totalMs);
    const row = table.insertRow();
    row.className = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
    row.insertCell(0).innerText = idx + 1;
    row.insertCell(1).innerText = pi.path.join(' → ') + (idx === 0 ? ' ◀' : '');
    row.insertCell(2).innerText = d.hops;
    row.insertCell(3).innerText = pi.cost;
    row.insertCell(4).innerText = d.totalMs.toFixed(4);
    row.insertCell(5).innerText = d.rttMs.toFixed(4);
    row.insertCell(6).innerText = d.throughput.toFixed(4);
    row.insertCell(7).innerText = qos;
  });

  // Optimal path metrics
  if (paths.length) {
    const best = paths[0];
    const d    = calcDelays(best.path, pkt, bw);

    const mCard = document.getElementById('pathMetricsCard');
    const mDiv  = document.getElementById('pathMetrics');
    mCard.style.display = 'block';
    mDiv.innerHTML = `
      <p style="margin:0 0 12px 0;font-size:13px;color:#5a7daf;">
        <strong>Optimal path:</strong> ${best.path.join(' → ')}
      </p>
      <div class="metrics-grid">
        <div class="metric-box"><div class="label">Hop Count</div><div class="value">${d.hops}</div></div>
        <div class="metric-box"><div class="label">E2E Delay</div><div class="value">${d.totalMs.toFixed(2)} ms</div></div>
        <div class="metric-box"><div class="label">RTT</div><div class="value">${d.rttMs.toFixed(2)} ms</div></div>
        <div class="metric-box"><div class="label">Throughput</div><div class="value">${d.throughput.toFixed(2)} Mbps</div></div>
        <div class="metric-box"><div class="label">BDP</div><div class="value">${(d.bdpBits/8/1024).toFixed(2)} KB</div></div>
        <div class="metric-box"><div class="label">QoS Grade</div><div class="value" style="font-size:14px;">${qosGrade(d.totalMs)}</div></div>
        <div class="metric-box"><div class="label">Packet Size</div><div class="value">${pkt} B</div></div>
        <div class="metric-box"><div class="label">Link B/W</div><div class="value">${bw} Mbps</div></div>
      </div>`;

    // Delay breakdown bars
    const maxDelay = d.totalMs || 1;
    const bars = [
      { label: 'Propagation',  val: d.propMs,  color: '#1f6feb' },
      { label: 'Transmission', val: d.txMs,    color: '#10b981' },
      { label: 'Processing',   val: d.procMs,  color: '#f59e0b' },
      { label: 'Queuing',      val: 0,         color: '#ef4444' },
    ];

    const bCard = document.getElementById('delayBreakCard');
    const bDiv  = document.getElementById('delayBreak');
    bCard.style.display = 'block';
    bDiv.innerHTML = `
      <div class="delay-bars">
        ${bars.map(b => {
          const pct = ((b.val / maxDelay) * 100).toFixed(1);
          return `
            <div class="delay-bar-row">
              <div class="delay-bar-label">${b.label}</div>
              <div class="delay-bar-track">
                <div class="delay-bar-fill" style="width:${pct}%;background:${b.color};">
                  ${b.val.toFixed(4)} ms
                </div>
              </div>
            </div>`;
        }).join('')}
        <div class="delay-bar-row" style="margin-top:10px;border-top:2px solid #dde5f5;padding-top:8px;">
          <div class="delay-bar-label" style="font-weight:800;color:#0b2d6e;">Total E2E</div>
          <div style="flex:1;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:15px;color:#0b3d91;padding-left:8px;">
            ${d.totalMs.toFixed(4)} ms
          </div>
        </div>
      </div>`;
  }
}

/* ─────────────────────────────────────────────────────────────
   DIJKSTRA STEP TRACE  (Algorithm Comparison section)
   ───────────────────────────────────────────────────────────── */
function runTrace() {
  const src = document.getElementById('traceSrc').value;
  const dst = document.getElementById('traceDst').value;
  if (src === dst) { alert('Source and destination must be different.'); return; }

  const { path, steps } = dijkstra(src, dst);
  const t = document.getElementById('traceTable');
  while (t.rows.length > 1) t.deleteRow(1);

  steps.forEach((s, i) => {
    const row = t.insertRow();
    row.insertCell(0).innerText = i + 1;
    row.insertCell(1).innerText = s.from;
    row.insertCell(2).innerText = s.to;
    row.insertCell(3).innerText = s.linkWt;
    row.insertCell(4).innerText = s.newCost;
    row.insertCell(5).innerText = 'RELAX ✓';
  });

  // Summary row
  const sr = t.insertRow();
  sr.style.fontWeight = '700';
  sr.style.background = 'rgba(31,111,235,0.07)';
  sr.insertCell(0).innerText = '—';
  sr.insertCell(1).colSpan   = 5;
  sr.cells[1].innerText = `Shortest path: ${path.join(' → ')}  |  Total cost: ${path.length ? path.reduce((s,_,i)=>i===0?s:s+GRAPH[path[i-1]][path[i]],0) : '∞'} ms  |  Steps: ${steps.length}`;
}

/* ─────────────────────────────────────────────────────────────
   QUIZ
   ───────────────────────────────────────────────────────────── */
const QUIZ_ANSWERS = {
  q1: 'a', q2: 'b', q3: 'c', q4: 'b',
  q5: 'b', q6: 'b', q7: 'b', q8: 'c',
};

function submitQuiz() {
  let score = 0;
  for (const [q, ans] of Object.entries(QUIZ_ANSWERS)) {
    const sel = document.querySelector(`input[name="${q}"]:checked`);
    if (sel && sel.value === ans) score++;
  }
  const total = Object.keys(QUIZ_ANSWERS).length;
  let msg = `Your Score: ${score} / ${total}  — `;
  if (score === total) msg += '🏆 Perfect! Expert-level CN knowledge!';
  else if (score >= total * 0.75) msg += '🎉 Excellent work!';
  else if (score >= total * 0.5)  msg += '👍 Good — review weak areas.';
  else msg += '📖 Study the routing theory section.';
  document.getElementById('result').innerText = msg;
}

/* ─────────────────────────────────────────────────────────────
   INIT  on page load
   ───────────────────────────────────────────────────────────── */
window.onload = function () {
  showSection('section-home');
};