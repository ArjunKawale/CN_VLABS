/* =========================================================
   DHCP LAB — script.js
   Handles: Navigation, Theory Tabs, Simulation, Quiz
   ========================================================= */

// ===================== NAVIGATION =====================
function navigate(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + section).classList.add('active');

  if (section === 'simulation') {
    setTimeout(initSimulation, 60);
  }
  if (section === 'quiz') {
    renderQuiz();
  }
}

function toggleDark() {
  document.body.classList.toggle('dark');
}

// ===================== THEORY TABS =====================
function theoryTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#theory-tabs .tab').forEach(t => t.classList.remove('active'));
  document.getElementById('theory-' + name).classList.add('active');
  btn.classList.add('active');
}

// ===================== SIMULATION STATE =====================
const PACKET_COLORS = {
  DISCOVER: '#FFC107',
  OFFER:    '#2196F3',
  REQUEST:  '#FF9800',
  ACK:      '#4CAF50'
};

const LEASE_SECONDS = 30;  // lease duration shown per client
const MAX_CLIENTS   = 8;

let canvas, ctx;
let serverNode  = { x: 0, y: 0, active: true };
let clients     = [];
let packetsList = [];
let ipPool      = [];
let logs        = [];
let clientCounter = 0;
let animFrame   = null;

// ---- IP Pool ----
function initPool() {
  ipPool = [];
  for (let i = 2; i <= 10; i++) ipPool.push(`192.168.1.${i}`);
}

function sortPool() {
  ipPool.sort((a, b) => parseInt(a.split('.')[3]) - parseInt(b.split('.')[3]));
}

// ---- Init Simulation ----
function initSimulation() {
  canvas = document.getElementById('dhcp-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  // Resize canvas to fill its container
  canvas.width  = canvas.offsetWidth || 620;
  canvas.height = 370;

  clients       = [];
  packetsList   = [];
  logs          = [];
  clientCounter = 0;
  serverNode.active = true;

  const toggleBtn = document.getElementById('server-toggle');
  if (toggleBtn) toggleBtn.textContent = '🔴 Disable Server';

  initPool();

  // Start with 3 clients
  for (let i = 0; i < 3; i++) spawnClient();

  updateClientButtons();
  updateInfoPanel();
  addLog('Simulation ready — click "Request IP" on any client to start DORA.');

  if (animFrame) cancelAnimationFrame(animFrame);
  renderLoop();
}

// ---- Node Positioning ----
function recalcPositions() {
  if (!canvas) return;
  const w = canvas.width;
  const h = canvas.height;
  serverNode.x = w / 2;
  serverNode.y = 78;
  const n = clients.length;
  const spacing = w / (n + 1);
  clients.forEach((c, i) => {
    c.x = spacing * (i + 1);
    c.y = h - 85;
  });
}

// ---- Add Client ----
function spawnClient() {
  clientCounter++;
  clients.push({
    id:          `PC${clientCounter}`,
    mac:         randomMAC(),
    ip:          null,
    state:       'INIT',
    leaseExpiry: null,
    x: 0, y: 0,
    busy: false
  });
  recalcPositions();
}

function addClient() {
  if (clients.length >= MAX_CLIENTS) {
    addLog('Maximum of 8 clients reached.');
    return;
  }
  spawnClient();
  updateClientButtons();
  updateInfoPanel();
}

function randomMAC() {
  return Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
  ).join(':');
}

// ---- Sleep Helper ----
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---- Logging ----
function addLog(msg) {
  const time = new Date().toTimeString().slice(0, 8);
  logs.unshift({ raw: msg, html: `[${time}] ${colorize(msg)}` });
  if (logs.length > 80) logs.pop();
  updateLogPanel();
}

function colorize(msg) {
  if (msg.includes('DISCOVER'))  return `<span style="color:#FFC107">${msg}</span>`;
  if (msg.includes('Offering') || msg.includes('OFFER')) return `<span style="color:#2196F3">${msg}</span>`;
  if (msg.includes('Requesting') || msg.includes('REQUEST')) return `<span style="color:#FF9800">${msg}</span>`;
  if (msg.includes('ACK') || msg.includes('assigned'))  return `<span style="color:#4CAF50">${msg}</span>`;
  if (msg.includes('expired') || msg.includes('No IP') || msg.includes('OFFLINE') || msg.includes('error'))
    return `<span style="color:#f44336">${msg}</span>`;
  if (msg.includes('Released') || msg.includes('reset') || msg.includes('ready'))
    return `<span style="color:#888">${msg}</span>`;
  return msg;
}

function updateLogPanel() {
  const panel = document.getElementById('log-panel');
  if (!panel) return;
  panel.innerHTML = logs.map(l => `<div class="log-entry">${l.html}</div>`).join('');
}

// ---- Client Buttons ----
function updateClientButtons() {
  const container = document.getElementById('client-buttons');
  if (!container) return;
  container.innerHTML = clients.map(c => `
    <div class="client-btn-group">
      <span class="client-label">${c.id}</span>
      <button onclick="requestIP('${c.id}')"
        ${c.busy || c.state === 'BOUND' ? 'disabled' : ''}>
        ${c.busy ? '⏳' : 'Request IP'}
      </button>
      ${c.state === 'BOUND'
        ? `<button class="release-btn" onclick="releaseIP('${c.id}')">Release</button>`
        : ''}
    </div>
  `).join('');
}

// ---- Info Panel ----
function updateInfoPanel() {
  const panel = document.getElementById('info-panel');
  if (!panel) return;
  const bound = clients.filter(c => c.state === 'BOUND');
  panel.innerHTML = `
    <div class="info-row">
      <span>IP Pool: <b>${ipPool.length}/9</b></span>
      <span>Allocated: <b>${bound.length}</b></span>
      <span>Server: <b class="${serverNode.active ? 'text-green' : 'text-red'}">
        ${serverNode.active ? '● ONLINE' : '● OFFLINE'}
      </b></span>
    </div>
    <div class="lease-list">
      ${bound.map(c => {
        const rem = Math.max(0, Math.ceil((c.leaseExpiry - Date.now()) / 1000));
        return `<span class="lease-badge">${c.id}: ${c.ip} — ${rem}s</span>`;
      }).join('')}
    </div>
  `;
}

// ---- Request IP (Entry Point) ----
async function requestIP(clientId) {
  const client = clients.find(c => c.id === clientId);
  if (!client || client.busy || client.state === 'BOUND') return;
  client.busy = true;
  updateClientButtons();
  await doraProcess(client);
  client.busy = false;
  updateClientButtons();
}

// ---- Start All Clients ----
async function startAll() {
  const idle = clients.filter(c => !c.busy && c.state !== 'BOUND');
  for (const c of idle) {
    requestIP(c.id);
    await sleep(350); // stagger so animations don't all overlap
  }
}

// ===================== DORA PROCESS =====================
async function doraProcess(client) {

  // ── Step 1: DISCOVER ──────────────────────────────────
  client.state = 'DISCOVER';
  addLog(`${client.id}: Sending DHCPDISCOVER (broadcast 255.255.255.255)`);

  // Broadcast: animate to server AND every other client
  const broadcastTargets = [serverNode, ...clients.filter(c => c.id !== client.id)];
  await Promise.all(
    broadcastTargets.map(t =>
      animatePacket(client.x, client.y, t.x, t.y, PACKET_COLORS.DISCOVER, 'DISCOVER')
    )
  );
  await sleep(550);

  // ── Server checks ──────────────────────────────────────
  if (!serverNode.active) {
    addLog(`Server: OFFLINE — ${client.id} cannot obtain IP`);
    client.state = 'INIT';
    return;
  }
  if (ipPool.length === 0) {
    addLog(`Server: No IP available — pool exhausted (${client.id} rejected)`);
    client.state = 'INIT';
    return;
  }

  // ── Step 2: OFFER ──────────────────────────────────────
  const offeredIP = ipPool[0];
  addLog(`Server: Offering IP ${offeredIP} to ${client.id} (lease: ${LEASE_SECONDS}s)`);
  await animatePacket(serverNode.x, serverNode.y, client.x, client.y, PACKET_COLORS.OFFER, 'OFFER');
  await sleep(550);

  // ── Step 3: REQUEST ────────────────────────────────────
  client.state = 'REQUEST';
  addLog(`${client.id}: Requesting IP ${offeredIP} from Server`);
  await animatePacket(client.x, client.y, serverNode.x, serverNode.y, PACKET_COLORS.REQUEST, 'REQUEST');
  await sleep(550);

  // ── Step 4: ACK ────────────────────────────────────────
  // Assign IP
  ipPool.shift();
  client.ip          = offeredIP;
  client.state       = 'BOUND';
  client.leaseExpiry = Date.now() + LEASE_SECONDS * 1000;

  addLog(`Server: ACK sent — IP ${offeredIP} assigned to ${client.id} (expires in ${LEASE_SECONDS}s)`);
  await animatePacket(serverNode.x, serverNode.y, client.x, client.y, PACKET_COLORS.ACK, 'ACK');

  updateClientButtons();
  updateInfoPanel();

  // ── Lease countdown ────────────────────────────────────
  const leaseTimer = setInterval(() => {
    // If this client's lease was manually released or simulation reset, stop
    if (client.state !== 'BOUND' || !client.leaseExpiry) {
      clearInterval(leaseTimer);
      return;
    }
    const remaining = (client.leaseExpiry - Date.now()) / 1000;
    if (remaining <= 0) {
      addLog(`${client.id}: Lease expired — IP ${client.ip} returned to pool`);
      ipPool.push(client.ip);
      sortPool();
      client.ip          = null;
      client.state       = 'INIT';
      client.leaseExpiry = null;
      clearInterval(leaseTimer);
      updateClientButtons();
    }
    updateInfoPanel();
  }, 1000);
}

// ---- Manual Release ----
function releaseIP(clientId) {
  const client = clients.find(c => c.id === clientId);
  if (!client || client.state !== 'BOUND') return;
  addLog(`${client.id}: Released IP ${client.ip} back to pool`);
  ipPool.push(client.ip);
  sortPool();
  client.ip          = null;
  client.state       = 'INIT';
  client.leaseExpiry = null;
  updateClientButtons();
  updateInfoPanel();
}

// ---- Toggle Server ----
function toggleServer() {
  serverNode.active = !serverNode.active;
  const btn = document.getElementById('server-toggle');
  if (btn) btn.textContent = serverNode.active ? '🔴 Disable Server' : '🟢 Enable Server';
  addLog(`Server: ${serverNode.active ? 'Enabled — ONLINE' : 'Disabled — OFFLINE'}`);
  updateInfoPanel();
}

// ---- Reset ----
function resetSimulation() {
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }

  // Clear all lease intervals by resetting client states
  clients.forEach(c => {
    c.state = 'INIT';
    c.leaseExpiry = null;
  });

  clients       = [];
  packetsList   = [];
  logs          = [];
  clientCounter = 0;
  serverNode.active = true;

  const btn = document.getElementById('server-toggle');
  if (btn) btn.textContent = '🔴 Disable Server';

  initPool();
  for (let i = 0; i < 3; i++) spawnClient();

  updateClientButtons();
  updateInfoPanel();
  addLog('Simulation reset. Ready.');
  renderLoop();
}

// ===================== PACKET ANIMATION =====================
function animatePacket(fromX, fromY, toX, toY, color, label) {
  return new Promise(resolve => {
    packetsList.push({
      fromX, fromY, toX, toY,
      x: fromX, y: fromY,
      color, label,
      progress: 0,
      speed: 0.024,
      done: false,
      resolve
    });
  });
}

// ===================== CANVAS RENDER =====================
function renderLoop() {
  renderFrame();
  animFrame = requestAnimationFrame(renderLoop);
}

function renderFrame() {
  if (!canvas || !ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const dark = document.body.classList.contains('dark');

  ctx.clearRect(0, 0, W, H);

  // ── Background ──
  ctx.fillStyle = dark ? '#0d1117' : '#eef2f8';
  ctx.fillRect(0, 0, W, H);

  // ── Subtle dot-grid ──
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,80,0.04)';
  for (let gx = 25; gx < W; gx += 30)
    for (let gy = 20; gy < H; gy += 30) {
      ctx.beginPath(); ctx.arc(gx, gy, 1.3, 0, Math.PI * 2); ctx.fill();
    }

  // ── Connection lines (client → server) ──
  clients.forEach(c => {
    ctx.save();
    ctx.setLineDash([5, 9]);
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,50,150,0.1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(serverNode.x, serverNode.y + 34);
    ctx.lineTo(c.x, c.y - 38);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  });

  // ── Draw server node ──
  drawServer(dark);

  // ── Draw client nodes ──
  clients.forEach(c => drawClient(c, dark));

  // ── Update + draw packets ──
  const alive = [];
  for (const p of packetsList) {
    p.progress = Math.min(1, p.progress + p.speed);
    p.x = lerp(p.fromX, p.toX, easeIO(p.progress));
    p.y = lerp(p.fromY, p.toY, easeIO(p.progress));
    drawPacket(p);
    if (p.progress >= 1) {
      if (!p.done) { p.done = true; p.resolve(); }
    } else {
      alive.push(p);
    }
  }
  packetsList = alive;
}

// ── Math helpers ──
function lerp(a, b, t) { return a + (b - a) * t; }
function easeIO(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

// ===================== DRAW FUNCTIONS =====================

function drawServer(dark) {
  const { x, y, active } = serverNode;
  const W = 106, H = 62;
  ctx.save();

  // Shadow glow
  ctx.shadowColor = active ? 'rgba(11,61,145,0.45)' : 'rgba(0,0,0,0.2)';
  ctx.shadowBlur  = 16;

  // Body
  ctx.fillStyle = active
    ? (dark ? '#0d3b6e' : '#0b3d91')
    : (dark ? '#2a2a2a' : '#888');
  rrect(x - W / 2, y - H / 2, W, H, 11);
  ctx.fill();

  // Border
  ctx.shadowBlur  = 0;
  ctx.strokeStyle = active ? (dark ? '#4fc3f7' : '#5a9fff') : '#aaa';
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Labels
  ctx.fillStyle = 'white';
  ctx.font      = 'bold 11px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText('DHCP Server', x, y - 12);

  ctx.fillStyle = active ? '#a3d4ff' : '#ccc';
  ctx.font      = '10px Segoe UI';
  ctx.fillText(active ? '● ONLINE' : '● OFFLINE', x, y + 3);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font      = '9px Segoe UI';
  ctx.fillText(`Pool: ${ipPool.length}/9  |  Port 67`, x, y + 18);

  ctx.restore();
}

function drawClient(c, dark) {
  const { x, y, id, ip, state, leaseExpiry } = c;
  const W = 92, H = 72;

  // Background per state
  const bgMap = {
    INIT:     dark ? '#161b22'  : '#f4f7fb',
    DISCOVER: dark ? '#2a1f00'  : '#fff8e1',
    REQUEST:  dark ? '#2a1400'  : '#fff3e0',
    BOUND:    dark ? '#0a2010'  : '#e8f5e9'
  };
  const borderMap = {
    INIT:     dark ? '#30363d'  : '#cdd5e0',
    DISCOVER: '#FFC107',
    REQUEST:  '#FF9800',
    BOUND:    '#4CAF50'
  };

  ctx.save();
  ctx.shadowColor = state === 'BOUND' ? 'rgba(76,175,80,0.3)' : 'rgba(0,0,0,0.1)';
  ctx.shadowBlur  = 8;

  ctx.fillStyle = bgMap[state] || bgMap.INIT;
  rrect(x - W / 2, y - H / 2, W, H, 11);
  ctx.fill();

  ctx.shadowBlur  = 0;
  ctx.strokeStyle = borderMap[state] || borderMap.INIT;
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Monitor icon (simple SVG-style)
  ctx.fillStyle = dark ? '#444' : '#ccc';
  rrect(x - 14, y - H / 2 + 8, 28, 18, 3);
  ctx.fill();
  ctx.fillStyle = dark ? '#222' : '#aaa';
  rrect(x - 12, y - H / 2 + 10, 24, 14, 2);
  ctx.fill();

  // ID label
  ctx.fillStyle   = dark ? '#e6edf3' : '#1a1a2e';
  ctx.font        = 'bold 11px Segoe UI';
  ctx.textAlign   = 'center';
  ctx.fillText(id, x, y + 2);

  // IP / State
  if (ip) {
    ctx.fillStyle = '#4caf50';
    ctx.font      = 'bold 10px Segoe UI';
    ctx.fillText(ip, x, y + 16);
    if (leaseExpiry) {
      const rem = Math.max(0, Math.ceil((leaseExpiry - Date.now()) / 1000));
      ctx.fillStyle = rem < 8 ? '#f44336' : (dark ? '#8b949e' : '#999');
      ctx.font      = '9px Segoe UI';
      ctx.fillText(`⏱ ${rem}s`, x, y + 29);
    }
  } else {
    ctx.fillStyle = dark ? '#555' : '#bbb';
    ctx.font      = '9px Segoe UI';
    ctx.fillText(state, x, y + 20);
  }

  // Status dot (top-right corner)
  const dotColors = { INIT: '#777', DISCOVER: '#FFC107', REQUEST: '#FF9800', BOUND: '#4CAF50' };
  ctx.fillStyle = dotColors[state] || '#777';
  ctx.beginPath();
  ctx.arc(x + W / 2 - 8, y - H / 2 + 8, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPacket(p) {
  const { x, y, color, label, fromX, fromY, toX, toY } = p;
  ctx.save();

  // Faint trail
  const tx = x - (toX - fromX) * 0.04;
  const ty = y - (toY - fromY) * 0.04;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(tx, ty, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur  = 18;

  // Circle
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowBlur = 0;

  // White letter inside
  ctx.fillStyle       = 'rgba(255,255,255,0.95)';
  ctx.font            = 'bold 8px Segoe UI';
  ctx.textAlign       = 'center';
  ctx.textBaseline    = 'middle';
  ctx.fillText(label[0], x, y);

  // Label above circle
  ctx.fillStyle    = color;
  ctx.font         = 'bold 9px Segoe UI';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, x, y - 14);

  ctx.restore();
}

// Helper: rounded rectangle path
function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ===================== QUIZ =====================
const QUESTIONS = [
  {
    q:    'DHCP stands for:',
    opts: ['Dynamic Host Control Protocol', 'Dynamic Host Configuration Protocol',
           'Data Host Configuration Protocol', 'Dynamic Hyper Control Protocol'],
    ans:  1
  },
  {
    q:    'Which process defines DHCP IP assignment?',
    opts: ['ARP', 'TCP handshake', 'DORA', 'DNS resolution'],
    ans:  2
  },
  {
    q:    'What is the first step in the DHCP process?',
    opts: ['Offer', 'Request', 'Discover', 'ACK'],
    ans:  2
  },
  {
    q:    'DHCP uses which transport-layer protocol?',
    opts: ['TCP', 'UDP', 'HTTP', 'FTP'],
    ans:  1
  },
  {
    q:    'The DHCP server listens on port:',
    opts: ['68', '80', '67', '21'],
    ans:  2
  },
  {
    q:    'The DHCP client uses port:',
    opts: ['67', '68', '443', '25'],
    ans:  1
  },
  {
    q:    'Which broadcast IP address is used in DHCPDISCOVER?',
    opts: ['127.0.0.1', '255.255.255.255', '192.168.1.1', '0.0.0.1'],
    ans:  1
  },
  {
    q:    'If DHCP fails, the OS auto-assigns an address from:',
    opts: ['10.x.x.x', '172.x.x.x', '169.254.x.x', '192.168.x.x'],
    ans:  2
  },
  {
    q:    'Lease time in DHCP means:',
    opts: ['IP is permanently assigned', 'IP is valid for a limited time period',
           'Server uptime duration', 'DNS mapping time'],
    ans:  1
  },
  {
    q:    'DHCP follows which architecture model?',
    opts: ['Peer-to-peer', 'Client-server', 'Distributed', 'Hybrid'],
    ans:  1
  }
];

let qCurrent  = 0;
let qAnswered = new Array(QUESTIONS.length).fill(null);

function renderQuiz() {
  const container = document.getElementById('quiz-container');
  if (!container) return;

  const q   = QUESTIONS[qCurrent];
  const ans = qAnswered[qCurrent];
  const pct = Math.round(((qCurrent + 1) / QUESTIONS.length) * 100);

  container.innerHTML = `
    <div class="quiz-header">
      <span>Question ${qCurrent + 1} of ${QUESTIONS.length}</span>
      <div class="quiz-progress-bar">
        <div class="quiz-progress-fill" style="width:${pct}%"></div>
      </div>
    </div>
    <div class="quiz-question">${q.q}</div>
    <div class="quiz-options">
      ${q.opts.map((opt, i) => {
        let cls = 'quiz-option';
        if (ans !== null) {
          if (i === q.ans)         cls += ' correct';
          else if (i === ans)      cls += ' wrong';
        }
        return `<button class="${cls}" onclick="selectAnswer(${i})"
          ${ans !== null ? 'disabled' : ''}>
          ${String.fromCharCode(65 + i)}. ${opt}
        </button>`;
      }).join('')}
    </div>
    <div class="quiz-nav">
      <button onclick="quizNav(-1)" ${qCurrent === 0 ? 'disabled' : ''}>← Prev</button>
      ${qCurrent < QUESTIONS.length - 1
        ? `<button onclick="quizNav(1)">Next →</button>`
        : `<button onclick="submitQuiz()">Submit Quiz ✓</button>`}
    </div>
  `;
}

function selectAnswer(idx) {
  if (qAnswered[qCurrent] !== null) return;
  qAnswered[qCurrent] = idx;
  renderQuiz();
}

function quizNav(dir) {
  qCurrent = Math.max(0, Math.min(QUESTIONS.length - 1, qCurrent + dir));
  renderQuiz();
}

function submitQuiz() {
  const score = qAnswered.reduce((acc, ans, i) =>
    acc + (ans === QUESTIONS[i].ans ? 1 : 0), 0);
  const pct   = Math.round((score / QUESTIONS.length) * 100);
  const emoji = pct >= 90 ? '🏆 Outstanding!' :
                pct >= 70 ? '🎉 Great Job!'    :
                pct >= 50 ? '👍 Good Effort!'  : '📚 Keep Studying!';

  const container = document.getElementById('quiz-container');
  container.innerHTML = `
    <div class="quiz-result-card">
      <h2>${emoji}</h2>
      <div class="score-circle">
        ${score}<span>/${QUESTIONS.length}</span>
      </div>
      <p class="score-pct">${pct}% correct</p>
      <div class="answer-review">
        ${QUESTIONS.map((q, i) => {
          const correct = qAnswered[i] === q.ans;
          const yourAns = qAnswered[i] !== null ? q.opts[qAnswered[i]] : 'Not answered';
          return `
            <div class="review-item ${correct ? 'review-correct' : 'review-wrong'}">
              <b>Q${i + 1}:</b> ${q.q}<br>
              <small>
                ✓ Correct: <b>${q.opts[q.ans]}</b>
                ${!correct ? ` &nbsp;✗ Your answer: ${yourAns}` : ''}
              </small>
            </div>
          `;
        }).join('')}
      </div>
      <br/>
      <button onclick="initQuiz()">🔄 Retry Quiz</button>
    </div>
  `;
}

function initQuiz() {
  qCurrent  = 0;
  qAnswered = new Array(QUESTIONS.length).fill(null);
  renderQuiz();
}

// ===================== BOOT =====================
window.addEventListener('load', () => {
  navigate('home');
  initQuiz();
});
