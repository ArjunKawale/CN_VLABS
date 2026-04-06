/* ================================================================
   NAVIGATION
================================================================ */
let currentSection = 'home';

function navigate(section) {
  document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

  const sec = document.getElementById('section-' + section);
  if (sec) { sec.classList.add('active'); sec.classList.add('fade-in'); }

  const link = document.querySelector(`.nav-links a[data-section="${section}"]`);
  if (link) link.classList.add('active');

  currentSection = section;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function navigateSimTab(tab) {
  navigate('simulation');
  simTab(tab);
}

/* ================================================================
   DARK MODE
================================================================ */
let dark = false;

function toggleDark() {
  dark = !dark;
  document.documentElement.classList.toggle('dark', dark);
  document.getElementById('darkLabel').textContent = dark ? 'Light Mode' : 'Dark Mode';
  const icon = document.getElementById('darkIcon');
  if (dark) {
    icon.innerHTML = `
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1"  x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22"   x2="5.64"  y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1"  y1="12" x2="3"  y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78"  x2="5.64"  y2="18.36"/>
      <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>`;
  } else {
    icon.innerHTML = `<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>`;
  }
}

/* ================================================================
   SVG ICONS
================================================================ */
function checkIcon() {
  return `<svg class="icon-check icon-inline" width="20" height="20"
    fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>`;
}

function xIcon() {
  return `<svg class="icon-x icon-inline" width="20" height="20"
    fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9"  x2="9"  y2="15"/>
    <line x1="9"  y1="9"  x2="15" y2="15"/>
  </svg>`;
}

/* ================================================================
   SIM TABS
================================================================ */
let currentSimTab = 'binary';

function simTab(tab) {
  document.querySelectorAll('.sim-tab-content').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('fade-in');
  });
  document.querySelectorAll('.sim-btn[id^="tab-"]').forEach(b => b.classList.remove('active-tab'));

  const content = document.getElementById('simcontent-' + tab);
  if (content) {
    content.style.display = '';
    void content.offsetWidth;
    content.classList.add('fade-in');
  }

  const btn = document.getElementById('tab-' + tab);
  if (btn) btn.classList.add('active-tab');

  currentSimTab = tab;
}

/* ================================================================
   BINARY NUMBERS
================================================================ */
const TASKS = [
  { decimal: 0, binary: '000', prefilled: false },
  { decimal: 1, binary: '001', prefilled: false },
  { decimal: 2, binary: '010', prefilled: true  },
  { decimal: 3, binary: '011', prefilled: true  },
  { decimal: 4, binary: '100', prefilled: true  },
  { decimal: 5, binary: '101', prefilled: true  },
  { decimal: 6, binary: '110', prefilled: false },
  { decimal: 7, binary: '111', prefilled: false },
];

function buildBinaryTable() {
  const tbody = document.querySelector('#binaryTable tbody');
  let html = '';
  for (let i = 0; i < 4; i++) {
    const left  = TASKS[i];
    const right = TASKS[i + 4];
    html += `<tr>
      <td style="font-weight:600;">${left.decimal} →</td>
      <td>${cellBinary(left)}</td>
      <td style="font-weight:600;">${right.decimal} →</td>
      <td>${cellBinary(right)}</td>
    </tr>`;
  }
  tbody.innerHTML = html;
}

function cellBinary(t) {
  if (t.prefilled) {
    return `<span style="font-family:monospace;font-weight:700;color:var(--muted-fg);">${t.binary}</span>`;
  }
  return `<div style="display:flex;align-items:center;justify-content:center;gap:6px;">
    <input class="sim-input" id="bin-${t.decimal}" style="width:68px;" maxlength="3" placeholder="___"
      oninput="this.value=this.value.replace(/[^01]/g,'').slice(0,3);
               document.getElementById('binaryResult').style.display='none';" />
    <span id="binicon-${t.decimal}"></span>
  </div>`;
}

function submitBinary() {
  const editables = TASKS.filter(t => !t.prefilled);
  let allCorrect = true;

  editables.forEach(t => {
    const inp  = document.getElementById('bin-' + t.decimal);
    const icon = document.getElementById('binicon-' + t.decimal);
    const correct = inp && inp.value === t.binary;
    if (!correct) allCorrect = false;
    if (icon) icon.innerHTML = correct ? checkIcon() : xIcon();
  });

  const res = document.getElementById('binaryResult');
  if (allCorrect) {
    res.style.display = '';
    res.innerHTML = '✓ All answers correct! Move to the next section.';
    res.style.color = 'var(--success)';
  } else {
    res.style.display = 'none';
  }
}

/* ================================================================
   SUBNET ID
================================================================ */
const SCENARIOS = [
  { networks: 2,  answer: 1, hint: '2¹ = 2 networks' },
  { networks: 4,  answer: 2, hint: '2² = 4 networks' },
  { networks: 8,  answer: 3, hint: '2³ = 8 networks' },
  { networks: 16, answer: 4, hint: '2⁴ = 16 networks' },
  { networks: 5,  answer: 3, hint: 'Need at least 2³ = 8 ≥ 5' },
  { networks: 10, answer: 4, hint: 'Need at least 2⁴ = 16 ≥ 10' },
];

function buildSubnetIDTable() {
  const tbody = document.getElementById('subnetIDTable');
  let html = '';
  SCENARIOS.forEach((s, i) => {
    html += `<tr>
      <td style="font-weight:700;">${s.networks}</td>
      <td>
        <input class="sim-input" id="sid-${i}" style="width:60px;" maxlength="2" placeholder="_"
          oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,2);
                   document.getElementById('subnetIDResult').style.display='none';" />
      </td>
      <td><span id="sidicon-${i}"></span></td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function submitSubnetID() {
  let allCorrect = true;
  let hintsHtml  = '';

  SCENARIOS.forEach((s, i) => {
    const inp   = document.getElementById('sid-' + i);
    const icon  = document.getElementById('sidicon-' + i);
    const correct = inp && parseInt(inp.value) === s.answer;
    if (!correct) {
      allCorrect = false;
      hintsHtml += `<p class="msg-hint">💡 Hint for ${s.networks} networks: ${s.hint}</p>`;
    }
    if (icon) icon.innerHTML = correct ? checkIcon() : xIcon();
  });

  document.getElementById('subnetIDHints').innerHTML = hintsHtml;

  const res = document.getElementById('subnetIDResult');
  if (allCorrect) {
    res.style.display = '';
    res.innerHTML = '✓ All answers correct!';
    res.style.color = 'var(--success)';
  } else {
    res.style.display = 'none';
  }
}

/* ================================================================
   SUBNETTING
================================================================ */
const SUBNETS = [
  { label: 'Subnet 0', subnetBits: '00', networkAddr: '192.168.1.0',   range: '192.168.1.0 – 192.168.1.63' },
  { label: 'Subnet 1', subnetBits: '01', networkAddr: '192.168.1.64',  range: '192.168.1.64 – 192.168.1.127' },
  { label: 'Subnet 2', subnetBits: '10', networkAddr: '192.168.1.128', range: '192.168.1.128 – 192.168.1.191' },
  { label: 'Subnet 3', subnetBits: '11', networkAddr: '192.168.1.192', range: '192.168.1.192 – 192.168.1.255' },
];

function buildSubnettingTable() {
  const tbody = document.getElementById('subnettingTable');
  let html = '';
  SUBNETS.forEach((s, i) => {
    html += `<tr>
      <td style="font-weight:700;">${s.label}</td>
      <td>
        <input class="sim-input" id="snt-${i}" style="width:65px;" maxlength="2" placeholder="__"
          oninput="this.value=this.value.replace(/[^01]/g,'').slice(0,2);
                   document.getElementById('subnettingResult').style.display='none';" />
      </td>
      <td style="font-family:monospace;font-size:0.9em;">${s.networkAddr}</td>
      <td style="font-family:monospace;font-size:0.82em;color:var(--muted-fg);">${s.range}</td>
      <td><span id="snticon-${i}"></span></td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function submitSubnetting() {
  let allCorrect = true;
  SUBNETS.forEach((s, i) => {
    const inp   = document.getElementById('snt-' + i);
    const icon  = document.getElementById('snticon-' + i);
    const correct = inp && inp.value === s.subnetBits;
    if (!correct) allCorrect = false;
    if (icon) icon.innerHTML = correct ? checkIcon() : xIcon();
  });
  const res = document.getElementById('subnettingResult');
  if (allCorrect) {
    res.style.display = '';
    res.innerHTML = '✓ All subnet IDs correct!';
    res.style.color = 'var(--success)';
  } else {
    res.style.display = 'none';
  }
}

/* ================================================================
   PRACTICE — DYNAMIC PROBLEM GENERATOR
================================================================ */
let practiceProblem  = null;
let practiceSubmitted = false;

function generateProblem() {
  const subnetBitsCount = Math.floor(Math.random() * 3) + 2; // 2–4
  const numSubnets  = Math.pow(2, subnetBitsCount);
  const hostBits    = 8 - subnetBitsCount;
  const blockSize   = Math.pow(2, hostBits);
  const base = [
    Math.floor(Math.random() * 223) + 1,
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
  ];
  const maskValue = 256 - blockSize;
  const subnets = Array.from({ length: numSubnets }, (_, i) => ({
    index:       i,
    networkAddr: `${base.join('.')}.${i * blockSize}`,
    subnetBits:  i.toString(2).padStart(subnetBitsCount, '0'),
    firstHost:   `${base.join('.')}.${i * blockSize + 1}`,
    lastHost:    `${base.join('.')}.${(i + 1) * blockSize - 2}`,
    broadcast:   `${base.join('.')}.${(i + 1) * blockSize - 1}`,
  }));
  return {
    network: `${base.join('.')}.0/24`,
    subnetBitsCount,
    subnetMask: `255.255.255.${maskValue}`,
    blockSize,
    subnets,
  };
}

function buildPractice() {
  practiceProblem   = generateProblem();
  practiceSubmitted = false;

  document.getElementById('practiceMaskInput').value = '';
  document.getElementById('practiceMaskIcon').innerHTML = '';
  document.getElementById('practiceResult').innerHTML = '';
  document.getElementById('practiceHint').style.display = 'none';

  const p = practiceProblem;

  document.getElementById('practiceInfo').innerHTML = `
    <span>Network: <span class="badge badge-primary">${p.network}</span></span>
    <span>Subnet bits: <span class="badge badge-primary">${p.subnetBitsCount}</span></span>
    <span>Block size: <span class="badge badge-secondary">${p.blockSize}</span></span>
  `;

  const display = p.subnets.slice(0, Math.min(p.subnets.length, 8));
  const tbody   = document.getElementById('practiceTable');
  let html = '';
  display.forEach((s, i) => {
    html += `<tr>
      <td style="font-weight:700;">${s.index}</td>
      <td style="font-family:monospace;font-weight:700;color:var(--primary);">${s.subnetBits}</td>
      <td>
        <input class="sim-input" id="prac-${i}" style="width:160px;" placeholder="x.x.x.x"
          oninput="practiceClearSubmit()" />
      </td>
      <td id="pracBC-${i}" style="font-family:monospace;font-size:0.85em;color:var(--muted-fg);">—</td>
      <td><span id="pracicon-${i}"></span></td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function practiceClearSubmit() {
  practiceSubmitted = false;
  document.getElementById('practiceResult').innerHTML = '';
  document.getElementById('practiceHint').style.display = 'none';
  document.getElementById('practiceMaskIcon').innerHTML = '';
}

function submitPractice() {
  practiceSubmitted = true;
  const p       = practiceProblem;
  const display = p.subnets.slice(0, Math.min(p.subnets.length, 8));

  const maskVal   = document.getElementById('practiceMaskInput').value.trim();
  const maskCorrect = maskVal === p.subnetMask || maskVal === String(256 - p.blockSize);
  const maskIcon  = document.getElementById('practiceMaskIcon');
  if (maskCorrect) {
    maskIcon.innerHTML = checkIcon();
  } else {
    maskIcon.innerHTML = xIcon() +
      `<span style="font-family:monospace;font-size:0.85em;color:var(--destructive);margin-left:6px;">${p.subnetMask}</span>`;
  }

  let allSubnetsCorrect = true;
  display.forEach((s, i) => {
    const inp   = document.getElementById('prac-' + i);
    const icon  = document.getElementById('pracicon-' + i);
    const bc    = document.getElementById('pracBC-' + i);
    const correct = inp && inp.value.trim() === s.networkAddr;
    if (!correct) allSubnetsCorrect = false;
    if (icon) icon.innerHTML = correct ? checkIcon() : xIcon();
    if (bc)   bc.textContent = correct ? s.broadcast : '—';
  });

  const allCorrect = maskCorrect && allSubnetsCorrect;

  const res = document.getElementById('practiceResult');
  if (allCorrect) {
    res.innerHTML  = '✓ Perfect! Try another problem to keep practicing.';
    res.style.color = 'var(--success)';
  } else {
    res.innerHTML = '';
  }

  const hint = document.getElementById('practiceHint');
  if (!allCorrect) {
    hint.style.display = '';
    hint.textContent   = `💡 Remember: each subnet starts at a multiple of the block size (${p.blockSize})`;
  } else {
    hint.style.display = 'none';
  }
}

function newPracticeProblem() { buildPractice(); }

/* ================================================================
   QUIZ
================================================================ */
const QUESTIONS = [
  {
    question: '1. What does CIDR stand for?',
    options: ['Classless Inter-Domain Routing', 'Classified Internet Data Routing', 'Common Internal Domain Registry'],
    correct: 0,
  },
  {
    question: '2. How many bits are in an IPv4 address?',
    options: ['16', '32', '64'],
    correct: 1,
  },
  {
    question: '3. What is the subnet mask for /24?',
    options: ['255.255.0.0', '255.255.255.0', '255.255.255.128'],
    correct: 1,
  },
  {
    question: '4. Subnetting borrows bits from which portion?',
    options: ['Network', 'Host', 'Both'],
    correct: 1,
  },
  {
    question: '5. Which class has a default mask of 255.255.255.0?',
    options: ['Class A', 'Class B', 'Class C'],
    correct: 2,
  },
];

let quizAnswers   = {};
let quizSubmitted = false;

function buildQuiz() {
  const body = document.getElementById('quizBody');
  let html = '';
  QUESTIONS.forEach((q, qi) => {
    html += `<div class="quiz-question">
      <p>${q.question}</p>`;
    q.options.forEach((opt, oi) => {
      html += `<label>
        <input type="radio" name="q${qi}" value="${oi}" onchange="quizSelect(${qi}, ${oi})" />
        ${opt}
      </label>`;
    });
    html += `</div>`;
  });
  body.innerHTML = html;
}

function quizSelect(qi, oi) {
  if (quizSubmitted) return;
  quizAnswers[qi] = oi;
}

function handleQuiz() {
  if (quizSubmitted) {
    quizAnswers   = {};
    quizSubmitted = false;
    document.getElementById('quizBtn').textContent = 'Submit Quiz';
    document.getElementById('quizResult').style.display = 'none';
    buildQuiz();
    return;
  }

  quizSubmitted = true;
  const score = QUESTIONS.reduce((acc, q, i) => acc + (quizAnswers[i] === q.correct ? 1 : 0), 0);

  let text = `Your Score: ${score} / ${QUESTIONS.length}`;
  if      (score === QUESTIONS.length) text += ' — Excellent! 🎉';
  else if (score >= 3)                 text += ' — Good! 👍';
  else                                 text += ' — Study Subnetting Again! 📖';

  const res = document.getElementById('quizResult');
  res.style.display = '';
  res.textContent   = text;
  res.style.color   =
    score === QUESTIONS.length ? 'var(--success)' :
    score >= 3                 ? 'var(--accent)'  : 'var(--destructive)';

  document.getElementById('quizBtn').textContent = 'Retry';
}

/* ================================================================
   INIT
================================================================ */
buildBinaryTable();
buildSubnetIDTable();
buildSubnettingTable();
buildPractice();
buildQuiz();