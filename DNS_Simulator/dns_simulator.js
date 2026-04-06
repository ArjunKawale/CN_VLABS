/* ================= NAVIGATION (SPA) ================= */
function showSection(sectionId) {
    const sections = document.querySelectorAll('.page-section');
    sections.forEach(s => s.style.display = 'none');

    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';

    // Update active nav link
    document.querySelectorAll('nav ul li a').forEach(a => {
        a.classList.remove('nav-active');
        if (a.getAttribute('data-section') === sectionId) {
            a.classList.add('nav-active');
        }
    });

    // Section-specific init
    if (sectionId === 'section-analyzer') initAnalyzer();
    if (sectionId === 'section-flowchart') initFlowChart();
}

/* ================= DARK MODE ================= */
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}

/* ================= SIMULATION STATE ================= */
let currentStep = 0;        // which step we are on (0 = not started)
let simRunning  = false;    // true when auto-run is active
let autoTimer   = null;     // holds setInterval handle for auto-run
let logStep     = 1;        // row counter for the log table

/* DNS step definitions — each entry describes one animated message */
const DNS_STEPS = [
    {
        from: 'node-client',
        to:   'node-resolver',
        label: 'DNS?',
        message: 'Client → Resolver: Query for domain',
        response: '(awaiting)',
        status: 'QUERYING',
        desc: 'Browser asks the Recursive Resolver: "What is the IP for {domain}?"',
        activeLines: ['line-c-r'],
        color: '#3498db'
    },
    {
        from: 'node-resolver',
        to:   'node-root',
        label: 'Root?',
        message: 'Resolver → Root Server: Who handles .com?',
        response: '(awaiting)',
        status: 'ROOT_QUERY',
        desc: 'Resolver contacts a Root DNS Server asking which TLD server handles .com domains.',
        activeLines: ['line-r-rt'],
        color: '#9b59b6'
    },
    {
        from: 'node-root',
        to:   'node-resolver',
        label: 'TLD↩',
        message: 'Root Server → Resolver: TLD server info',
        response: 'a.gtld-servers.net',
        status: 'ROOT_RESP',
        desc: 'Root Server replies: "Contact the .com TLD server at a.gtld-servers.net".',
        activeLines: ['line-r-rt'],
        color: '#8e44ad'
    },
    {
        from: 'node-resolver',
        to:   'node-tld',
        label: 'TLD?',
        message: 'Resolver → TLD Server: Who handles example.com?',
        response: '(awaiting)',
        status: 'TLD_QUERY',
        desc: 'Resolver asks the .com TLD Server: "Who is the Authoritative server for example.com?"',
        activeLines: ['line-r-tl'],
        color: '#e67e22'
    },
    {
        from: 'node-tld',
        to:   'node-resolver',
        label: 'Auth↩',
        message: 'TLD Server → Resolver: Authoritative server info',
        response: 'ns1.example.com',
        status: 'TLD_RESP',
        desc: 'TLD Server replies: "The Authoritative server for example.com is ns1.example.com".',
        activeLines: ['line-r-tl'],
        color: '#d35400'
    },
    {
        from: 'node-resolver',
        to:   'node-auth',
        label: 'IP?',
        message: 'Resolver → Auth Server: What is the IP for the domain?',
        response: '(awaiting)',
        status: 'AUTH_QUERY',
        desc: 'Resolver queries the Authoritative Server: "Give me the A record for {domain}."',
        activeLines: ['line-r-au'],
        color: '#27ae60'
    },
    {
        from: 'node-auth',
        to:   'node-resolver',
        label: 'IP↩',
        message: 'Auth Server → Resolver: IP address returned',
        response: '93.184.216.34',
        status: 'AUTH_RESP',
        desc: 'Authoritative Server returns the A record: IP = 93.184.216.34, TTL = 300s.',
        activeLines: ['line-r-au'],
        color: '#2ecc71'
    },
    {
        from: 'node-resolver',
        to:   'node-client',
        label: 'IP!',
        message: 'Resolver → Client: Final IP delivered',
        response: '93.184.216.34',
        status: 'RESOLVED',
        desc: 'Resolver caches the answer and returns IP 93.184.216.34 to the Client browser. Done!',
        activeLines: ['line-c-r'],
        color: '#1abc9c'
    }
];

/* Node centre coordinates (relative to simulation area) — used for packet path */
function getNodeCentre(nodeId) {
    const area = document.getElementById('dnsSimArea');
    const node = document.getElementById(nodeId);
    if (!area || !node) return { x: 0, y: 0 };
    const aR = area.getBoundingClientRect();
    const nR = node.getBoundingClientRect();
    return {
        x: nR.left - aR.left + nR.width  / 2,
        y: nR.top  - aR.top  + nR.height / 2
    };
}

/* ================= DRAW SVG CONNECTOR LINES ================= */
function drawConnectors() {
    // Map lines to their node pairs
    const lineDefs = [
        { id: 'line-c-r',  a: 'node-client',   b: 'node-resolver' },
        { id: 'line-r-rt', a: 'node-resolver',  b: 'node-root'     },
        { id: 'line-r-tl', a: 'node-resolver',  b: 'node-tld'      },
        { id: 'line-r-au', a: 'node-resolver',  b: 'node-auth'     }
    ];

    lineDefs.forEach(def => {
        const c1 = getNodeCentre(def.a);
        const c2 = getNodeCentre(def.b);
        const line = document.getElementById(def.id);
        if (!line) return;
        line.setAttribute('x1', c1.x);
        line.setAttribute('y1', c1.y);
        line.setAttribute('x2', c2.x);
        line.setAttribute('y2', c2.y);
    });
}

/* ================= NODE HIGHLIGHTS ================= */
function clearNodeHighlights() {
    document.querySelectorAll('.dns-node').forEach(n => n.classList.remove('node-active'));
}

function highlightNodes(fromId, toId) {
    clearNodeHighlights();
    const from = document.getElementById(fromId);
    const to   = document.getElementById(toId);
    if (from) from.classList.add('node-active');
    if (to)   to.classList.add('node-active');
}

/* ================= LINE HIGHLIGHTS ================= */
function clearLineHighlights() {
    document.querySelectorAll('.connector-line').forEach(l => l.classList.remove('active-line'));
}

function highlightLines(lineIds) {
    clearLineHighlights();
    lineIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('active-line');
    });
}

/* ================= MOVE PACKET ALONG A LINE ================= */
function movePacket(fromId, toId, label, color, callback) {
    const packet = document.getElementById('dns-packet');
    if (!packet) { if (callback) callback(); return; }

    const start = getNodeCentre(fromId);
    const end   = getNodeCentre(toId);

    // Offset so packet floats above the line
    const offsetY = -20;

    packet.innerText = label;
    packet.style.backgroundColor = color || '#f39c12';
    packet.style.left = (start.x - 30) + 'px';
    packet.style.top  = (start.y + offsetY) + 'px';
    packet.style.display = 'block';

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(30, Math.floor(distance / 5));
    let step = 0;

    const interval = setInterval(() => {
        step++;
        const t = step / steps;
        const x = start.x + dx * t - 30;
        const y = start.y + dy * t + offsetY;
        packet.style.left = x + 'px';
        packet.style.top  = y + 'px';

        if (step >= steps) {
            clearInterval(interval);
            packet.style.left = (end.x - 30) + 'px';
            packet.style.top  = (end.y + offsetY) + 'px';
            setTimeout(() => {
                if (callback) callback();
            }, 400);
        }
    }, 18);
}

/* ================= UPDATE STATE DISPLAY ================= */
function updateState(state, desc) {
    const stateEl = document.getElementById('dns-state');
    const descEl  = document.getElementById('step-description');
    if (stateEl) stateEl.innerText = state;
    if (descEl)  descEl.innerText  = desc || '';
    localStorage.setItem('dnsState', state);
}

/* ================= LOG A DNS QUERY ROW ================= */
function logQuery(from, to, message, response, status) {
    const table = document.getElementById('dnsLogTable');
    if (!table) return;

    const row = table.insertRow();
    row.insertCell(0).innerText = logStep++;
    row.insertCell(1).innerText = from;
    row.insertCell(2).innerText = to;
    row.insertCell(3).innerText = message;
    row.insertCell(4).innerText = response;
    row.insertCell(5).innerText = status;

    // Persist to localStorage
    const logs = JSON.parse(localStorage.getItem('dnsLog')) || [];
    logs.push({ step: logStep - 1, from, to, message, response, status });
    if (logs.length > 200) logs.shift();
    localStorage.setItem('dnsLog', JSON.stringify(logs));
}

/* ================= EXECUTE ONE SIMULATION STEP ================= */
function executeStep(stepIndex, onComplete) {
    if (stepIndex >= DNS_STEPS.length) {
        if (onComplete) onComplete();
        return;
    }

    const domain = (document.getElementById('domainInput')?.value || 'www.example.com').trim();
    const step = DNS_STEPS[stepIndex];
    const desc = step.desc.replace(/{domain}/g, domain);

    // Highlight nodes and lines
    highlightNodes(step.from, step.to);
    highlightLines(step.activeLines);

    // Update status panel
    updateState(step.status, desc);

    // Animate the packet
    movePacket(step.from, step.to, step.label, step.color, () => {
        // Log the event
        const fromLabel = getNodeLabel(step.from);
        const toLabel   = getNodeLabel(step.to);
        logQuery(fromLabel, toLabel, step.message, step.response, step.status);

        // If last step, show resolution result
        if (stepIndex === DNS_STEPS.length - 1) {
            showResolutionResult(domain);
        }

        if (onComplete) onComplete();
    });
}

/* Helper: get display name from node id */
function getNodeLabel(nodeId) {
    const map = {
        'node-client':   'Client',
        'node-resolver': 'Resolver',
        'node-root':     'Root Server',
        'node-tld':      'TLD Server',
        'node-auth':     'Auth Server'
    };
    return map[nodeId] || nodeId;
}

/* ================= SHOW RESOLUTION RESULT ================= */
function showResolutionResult(domain) {
    const card = document.getElementById('resolvedCard');
    const domEl = document.getElementById('resolvedDomain');
    const ipEl  = document.getElementById('resolvedIP');
    if (card)  card.style.display = 'block';
    if (domEl) domEl.innerText = domain;
    if (ipEl)  ipEl.innerText  = '93.184.216.34';

    const packet = document.getElementById('dns-packet');
    if (packet) packet.style.display = 'none';

    updateState('RESOLVED', '✅ DNS Resolution complete! IP delivered to browser.');
    clearLineHighlights();
    clearNodeHighlights();
}

/* ================= START SIMULATION ================= */
function startDNS() {
    // If already running, ignore
    if (simRunning) return;

    // Reset everything first so we always start from step 1
    performReset();
    simRunning = true;
    currentStep = 0;

    drawConnectors();

    const autoRun = document.getElementById('autoRun')?.checked;

    if (autoRun) {
        runAutoStep();
    } else {
        // Just execute step 0 and wait for user to click Next Step
        executeStep(currentStep, () => {
            currentStep++;
            simRunning = false;
        });
    }
}

/* ================= AUTO RUN ================= */
function runAutoStep() {
    if (currentStep >= DNS_STEPS.length) {
        simRunning = false;
        return;
    }

    executeStep(currentStep, () => {
        currentStep++;
        if (currentStep < DNS_STEPS.length) {
            autoTimer = setTimeout(runAutoStep, 1200);
        } else {
            simRunning = false;
        }
    });
}

/* ================= NEXT STEP (manual) ================= */
function nextStep() {
    // If auto-run is checked, ignore manual stepping
    if (document.getElementById('autoRun')?.checked) return;
    if (simRunning) return;
    if (currentStep === 0) { startDNS(); return; }
    if (currentStep >= DNS_STEPS.length) return;

    simRunning = true;
    drawConnectors();

    executeStep(currentStep, () => {
        currentStep++;
        simRunning = false;
    });
}

/* ================= RESET ================= */
function performReset() {
    // Clear auto timer if running
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    simRunning  = false;
    currentStep = 0;
    logStep     = 1;

    // Clear log table (keep header row)
    const table = document.getElementById('dnsLogTable');
    if (table) {
        while (table.rows.length > 1) table.deleteRow(1);
    }

    // Hide resolved card and packet
    const card   = document.getElementById('resolvedCard');
    const packet = document.getElementById('dns-packet');
    if (card)   card.style.display   = 'none';
    if (packet) packet.style.display = 'none';

    // Clear highlights
    clearNodeHighlights();
    clearLineHighlights();

    // Reset status
    updateState('IDLE', 'Press ▶ Start Simulation to begin DNS resolution.');

    // Clear localStorage
    localStorage.removeItem('dnsLog');
}

function resetDNS() {
    performReset();
}

/* ================= PACKET ANALYZER (Query Log section) ================= */
function initAnalyzer() {
    const logs  = JSON.parse(localStorage.getItem('dnsLog')) || [];
    const table = document.getElementById('analyzerTable');
    if (!table) return;

    while (table.rows.length > 1) table.deleteRow(1);

    logs.forEach(log => {
        const row = table.insertRow();
        row.insertCell(0).innerText = log.step;
        row.insertCell(1).innerText = log.from;
        row.insertCell(2).innerText = log.to;
        row.insertCell(3).innerText = log.message;
        row.insertCell(4).innerText = log.response;
        row.insertCell(5).innerText = log.status;
        row.insertCell(6).innerText = getStepDescription(log.status);
    });
}

function getStepDescription(status) {
    const map = {
        'QUERYING':   'Browser asked resolver for domain IP',
        'ROOT_QUERY': 'Resolver queried Root DNS Server',
        'ROOT_RESP':  'Root Server returned TLD server reference',
        'TLD_QUERY':  'Resolver queried TLD (.com) Server',
        'TLD_RESP':   'TLD Server returned Authoritative server reference',
        'AUTH_QUERY': 'Resolver queried Authoritative Server',
        'AUTH_RESP':  'Authoritative Server returned final IP address',
        'RESOLVED':   'Resolver delivered IP address to Client browser'
    };
    return map[status] || '';
}

function clearAnalyzer() {
    localStorage.removeItem('dnsLog');
    const table = document.getElementById('analyzerTable');
    if (table) {
        while (table.rows.length > 1) table.deleteRow(1);
    }
}

/* ================= FLOW CHART ================= */
function setFlowState(stateId) {
    document.querySelectorAll('.state').forEach(s => s.classList.remove('active-state'));
    const el = document.getElementById(stateId);
    if (el) el.classList.add('active-state');
    localStorage.setItem('dnsFlowState', stateId);
}

function resetFlowChart() {
    document.querySelectorAll('.state').forEach(s => s.classList.remove('active-state'));
    localStorage.removeItem('dnsFlowState');
}

function initFlowChart() {
    const saved = localStorage.getItem('dnsFlowState');
    if (saved) {
        document.querySelectorAll('.state').forEach(s => s.classList.remove('active-state'));
        const el = document.getElementById(saved);
        if (el) el.classList.add('active-state');
    }
}

/* ================= QUIZ ================= */
function submitQuiz() {
    let score = 0;
    if (document.querySelector('input[name="q1"]:checked')?.value === 'a') score++;
    if (document.querySelector('input[name="q2"]:checked')?.value === 'b') score++;
    if (document.querySelector('input[name="q3"]:checked')?.value === 'c') score++;
    if (document.querySelector('input[name="q4"]:checked')?.value === 'b') score++;
    if (document.querySelector('input[name="q5"]:checked')?.value === 'b') score++;

    let resultText = 'Your Score: ' + score + ' / 5';
    if (score === 5) resultText += ' — Excellent! DNS Master!';
    else if (score >= 3) resultText += ' — Good! Keep learning.';
    else resultText += ' — Study DNS Again!';

    document.getElementById('result').innerText = resultText;
}

/* ================= WINDOW RESIZE — redraw connectors ================= */
window.addEventListener('resize', () => {
    const simVisible = document.getElementById('section-simulation')?.style.display !== 'none';
    if (simVisible) drawConnectors();
});

/* ================= INIT ================= */
window.onload = function () {
    showSection('section-home');

    // Draw connectors after a short delay to let layout settle
    setTimeout(() => {
        drawConnectors();
        updateState('IDLE', 'Press ▶ Start Simulation to begin DNS resolution.');
    }, 100);
};
