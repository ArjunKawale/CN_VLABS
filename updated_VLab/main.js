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

    // Run section-specific init
    if (sectionId === 'section-analyzer') initAnalyzer();
    if (sectionId === 'section-state') initStateMachine();
}

/* ================= DARK MODE ================= */
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}

/* ================= SIMULATION ================= */
let step = 1;
let clientSeq = 1000;
let serverSeq = 5000;

function updateState(state) {
    const el = document.getElementById('state');
    if (el) el.innerText = state;
    localStorage.setItem('tcpState', state);
}

function logPacket(src, dest, flag, seq, ack, state) {
    let table = document.getElementById('logTable');
    if (!table) return;
    let row = table.insertRow();

    row.insertCell(0).innerText = step++;
    row.insertCell(1).innerText = src;
    row.insertCell(2).innerText = dest;
    row.insertCell(3).innerText = flag;
    row.insertCell(4).innerText = seq;
    row.insertCell(5).innerText = ack;
    row.insertCell(6).innerText = state;

    let packets = JSON.parse(localStorage.getItem('tcpPackets')) || [];
    packets.push({ step: step - 1, source: src, destination: dest, flag, seq, ack, state });
    if (packets.length > 100) packets.shift();
    localStorage.setItem('tcpPackets', JSON.stringify(packets));
}

function clearPacketLog() {
    localStorage.removeItem('tcpPackets');
}

function resetSimulation() {
    localStorage.removeItem('tcpPackets');
    step = 1;
    clientSeq = 1000;
    serverSeq = 5000;

    const state = document.getElementById('state');
    if (state) state.innerText = 'CLOSED';

    // Clear log table body rows
    const table = document.getElementById('logTable');
    if (table) {
        while (table.rows.length > 1) table.deleteRow(1);
    }

    // Hide packet
    const packet = document.getElementById('packet');
    if (packet) packet.style.display = 'none';
}

function movePacket(start, end, label, callback) {
    let packet = document.getElementById('packet');
    if (!packet) { callback(); return; }
    packet.style.left = start + 'px';
    packet.innerText = label;
    packet.style.display = 'block';

    let pos = start;
    let interval = setInterval(() => {
        pos += (end > start ? 5 : -5);
        packet.style.left = pos + 'px';

        if (pos === end || (end > start && pos >= end) || (end < start && pos <= end)) {
            clearInterval(interval);
            packet.style.left = end + 'px';
            setTimeout(callback, 500);
        }
    }, 20);
}

function startHandshake() {
    updateState('SYN_SENT');
    logPacket('Client', 'Server', 'SYN', clientSeq, '-', 'SYN_SENT');

    movePacket(100, 600, 'SYN', () => {
        updateState('SYN_RECEIVED');
        logPacket('Server', 'Client', 'SYN-ACK', serverSeq, clientSeq + 1, 'SYN_RECEIVED');

        movePacket(600, 100, 'SYN-ACK', () => {
            updateState('ESTABLISHED');
            logPacket('Client', 'Server', 'ACK', clientSeq + 1, serverSeq + 1, 'ESTABLISHED');

            movePacket(100, 600, 'ACK', () => {
                logPacket('System', '-', 'CONNECTED', '-', '-', 'ESTABLISHED');
                alert('Connection Established');
            });
        });
    });
}

function lostSyn() {
    updateState('SYN_SENT');
    logPacket('Client', 'Server', 'SYN', clientSeq, '-', 'SYN_SENT');

    movePacket(100, 600, 'SYN', () => {
        logPacket('Network', '-', 'LOST', '-', '-', 'SYN_SENT');
        alert('SYN Packet Lost! Timeout Occurred.');

        setTimeout(() => {
            logPacket('Client', 'Server', 'SYN (Retransmit)', clientSeq, '-', 'SYN_SENT');
            startHandshake();
        }, 2000);
    });
}

function lostSynAck() {
    updateState('SYN_SENT');
    logPacket('Client', 'Server', 'SYN', clientSeq, '-', 'SYN_SENT');

    movePacket(100, 600, 'SYN', () => {
        updateState('SYN_RECEIVED');
        logPacket('Server', 'Client', 'SYN-ACK', serverSeq, clientSeq + 1, 'SYN_RECEIVED');

        movePacket(600, 100, 'SYN-ACK', () => {
            logPacket('Network', '-', 'LOST', '-', '-', 'SYN_RECEIVED');
            alert('SYN-ACK Lost! Retransmitting...');

            setTimeout(() => { startHandshake(); }, 2000);
        });
    });
}

function lostAck() {
    updateState('SYN_SENT');
    logPacket('Client', 'Server', 'SYN', clientSeq, '-', 'SYN_SENT');

    movePacket(100, 600, 'SYN', () => {
        updateState('SYN_RECEIVED');
        logPacket('Server', 'Client', 'SYN-ACK', serverSeq, clientSeq + 1, 'SYN_RECEIVED');

        movePacket(600, 100, 'SYN-ACK', () => {
            updateState('ESTABLISHED');
            logPacket('Client', 'Server', 'ACK', clientSeq + 1, serverSeq + 1, 'ESTABLISHED');

            movePacket(100, 600, 'ACK', () => {
                logPacket('Network', '-', 'LOST', '-', '-', 'ESTABLISHED');
                alert('ACK Lost! Retransmitting ACK...');

                setTimeout(() => {
                    logPacket('Client', 'Server', 'ACK (Retransmit)', clientSeq + 1, serverSeq + 1, 'ESTABLISHED');
                }, 2000);
            });
        });
    });
}

function terminateConnection() {
    updateState('FIN_WAIT_1');
    logPacket('Client', 'Server', 'FIN', clientSeq + 1, serverSeq + 1, 'FIN_WAIT_1');

    movePacket(100, 600, 'FIN', () => {
        updateState('CLOSE_WAIT');
        logPacket('Server', 'Client', 'ACK', serverSeq + 1, clientSeq + 2, 'CLOSE_WAIT');

        movePacket(600, 100, 'ACK', () => {
            updateState('LAST_ACK');
            logPacket('Server', 'Client', 'FIN', serverSeq + 1, clientSeq + 2, 'LAST_ACK');

            movePacket(600, 100, 'FIN', () => {
                updateState('TIME_WAIT');
                logPacket('Client', 'Server', 'ACK', clientSeq + 2, serverSeq + 2, 'TIME_WAIT');

                movePacket(100, 600, 'ACK', () => {
                    updateState('CLOSED');
                    logPacket('System', '-', 'CLOSED', '-', '-', 'CLOSED');
                    alert('Connection Closed');
                });
            });
        });
    });
}

/* ================= PACKET ANALYZER ================= */
function getDescription(flag) {
    if (flag === 'SYN') return 'Client requests connection (SYN)';
    if (flag === 'SYN-ACK') return 'Server acknowledges and sends SYN';
    if (flag === 'ACK') return 'Connection established acknowledgement';
    if (flag === 'FIN') return 'Connection termination request';
    return '';
}

function initAnalyzer() {
    let packets = JSON.parse(localStorage.getItem('tcpPackets')) || [];
    let table = document.getElementById('analyzerTable');
    if (!table) return;

    // Clear existing rows except header
    while (table.rows.length > 1) table.deleteRow(1);

    packets.forEach(packet => {
        let row = table.insertRow();
        row.insertCell(0).innerText = packet.step;
        row.insertCell(1).innerText = packet.source;
        row.insertCell(2).innerText = packet.destination;
        row.insertCell(3).innerText = packet.flag;
        row.insertCell(4).innerText = packet.seq;
        row.insertCell(5).innerText = packet.ack;
        row.insertCell(6).innerText = packet.state;
        row.insertCell(7).innerText = getDescription(packet.flag);
    });
}

/* ================= STATE MACHINE ================= */
function highlightState(stateName) {
    let states = document.getElementsByClassName('state');
    for (let i = 0; i < states.length; i++) {
        states[i].classList.remove('active-state');
    }
    let state = document.getElementById(stateName);
    if (state) state.classList.add('active-state');
}

function setState(stateName) {
    localStorage.setItem('tcpState', stateName);
    highlightState(stateName);
}

function resetStateMachine() {
    localStorage.setItem('tcpState', 'CLOSED');
    highlightState('CLOSED');
}

function initStateMachine() {
    let currentState = localStorage.getItem('tcpState');
    highlightState(currentState || 'CLOSED');
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
    if (score === 5) resultText += ' - Excellent!';
    else if (score >= 3) resultText += ' - Good!';
    else resultText += ' - Study TCP Again!';

    document.getElementById('result').innerText = resultText;
}

/* ================= INIT ================= */
window.onload = function () {
    showSection('section-home');
};