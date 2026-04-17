/**
 * Main Application Entry Point
 */
import * as THREE from 'three';
import { initThree, updateVisuals, drawBeams, clearBeams } from './render.js';
import { calculateComplements, getMBTITypeString, getFunctionLevels } from './score.js';
import { MBTI_FUNCTION_STACKS, MBTI_NICKNAMES } from './data.js';
import { updateNarration } from './narration.js';
import { UI_CONFIG } from './config.js';

const state = {
    activeUser: 'A',
    viewMode: 'compatibility', // compatibility, self, other
    users: {
        A: { EI: 50, NS: 50, TF: 50, JP: 50, AT: 50 },
        B: { EI: 50, NS: 50, TF: 50, JP: 50, AT: 50 }
    },
    stacks: { A: null, B: null },
    levels: { A: [], B: [] },
    mode: 'IDLE',
    lastInteraction: 0,
    timeline: { phase: 'IDLE', elapsed: 0 },
    complementData: { data: [], mirrorFactor: 0, rescueScoreRaw: 0 },
    highlightUser: null,
    highlightIndex: -1
};

let three;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    const container = document.getElementById('canvas-container');
    three = initThree(container);

    // Initial decode
    const params = new URLSearchParams(window.location.search);
    if (params.has('d')) {
        decodeState(params.get('d'));
        if (!isAllFifty(state.users.A) && !isAllFifty(state.users.B)) {
            state.mode = 'EDITING';
            state.lastInteraction = -1000;
        }
    }

    setupEventListeners();
    initTicks();
    refreshMainUI();
    animate();
}

function initTicks() {
    const keys = ['EI', 'NS', 'TF', 'JP', 'AT'];
    keys.forEach(key => {
        const container = document.getElementById('ticks-' + key);
        for (let i = 0; i <= 10; i++) {
            const tick = document.createElement('div');
            tick.className = 'tick-mark';
            container.appendChild(tick);
        }
    });
}

function setupEventListeners() {
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-target');
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            if (target === 'SCORE') {
                document.getElementById('panel-SCORE').classList.add('active');
            } else {
                document.getElementById('panel-A').classList.add('active');
                state.activeUser = target;
                document.getElementById('desc-mode-btn').textContent = target === 'A' ? 'あなたの説明' : 'あいての説明';
                refreshMainUI();
            }
        });
    });

    // Sliders
    const sliders = ['EI', 'NS', 'TF', 'JP', 'AT'];
    sliders.forEach(key => {
        const el = document.getElementById(`slider-${key}`);
        el.addEventListener('input', (e) => {
            state.users[state.activeUser][key] = parseInt(e.target.value);
            onInteraction();
        });
        
        // Buttons
        document.querySelectorAll(`.adjust-btn[data-key="${key}"]`).forEach(btn => {
            btn.addEventListener('click', () => {
                const dir = parseInt(btn.getAttribute('data-dir'));
                state.users[state.activeUser][key] = Math.max(0, Math.min(100, state.users[state.activeUser][key] + dir));
                onInteraction();
            });
        });
    });

    // Share & Actions
    document.getElementById('share-x-btn').addEventListener('click', shareToX);
    document.getElementById('copy-url-btn').addEventListener('click', copyURL);
    document.getElementById('screenshot-btn').addEventListener('click', takeScreenshot);

    // --- Description Mode Button ---
    document.getElementById('desc-mode-btn').addEventListener('click', () => {
        setViewMode(state.activeUser === 'A' ? 'self' : 'other');
    });

    // Compatibility reset button
    document.getElementById('tab-SCORE').addEventListener('click', () => setViewMode('compatibility'));
}

function setViewMode(mode) {
    state.viewMode = mode;
    state.timeline.elapsed = 0;
    state.timeline.phase = 'IDLE';
    state.highlightIndex = -1;
    state.highlightUser = null;
    state.mode = 'PLAYING';
    
    // UI feedback
    const btn = document.getElementById('desc-mode-btn');
    if (btn) btn.style.borderColor = mode === 'compatibility' ? 'transparent' : '#fff';
    
    document.getElementById('narration-panel').style.display = 'block';
    refreshAllData();
}

function onInteraction() {
    state.mode = 'EDITING';
    state.lastInteraction = performance.now();
    document.getElementById('analysis-overlay').style.display = 'none';
    document.getElementById('narration-panel').style.display = 'none';
    refreshMainUI();
}

function refreshMainUI() {
    const data = state.users[state.activeUser];
    const keys = ['EI', 'NS', 'TF', 'JP', 'AT'];
    keys.forEach(key => {
        const val = data[key];
        const el = document.getElementById(`slider-${key}`);
        el.value = val;
        el.parentElement.parentElement.style.setProperty('--val', val + '%');
        updateLabel(key, val);
    });
    refreshAllData();
}

function updateLabel(key, val) {
    const texts = { EI:['外向型','内向型'], NS:['直感型','現実型'], TF:['思考型','感情型'], JP:['計画型','探索型'], AT:['自己主張型','激動型'] };
    const l = document.getElementById(`lbl-${key}-L`);
    const r = document.getElementById(`lbl-${key}-R`);
    l.className = ''; r.className = '';
    if (val < 50) { l.classList.add('bold'); l.textContent = `${100-val}% ${texts[key][0]}`; r.textContent = texts[key][1]; }
    else if (val > 50) { r.classList.add('bold'); l.textContent = texts[key][0]; r.textContent = `${val}% ${texts[key][1]}`; }
    else { l.textContent = texts[key][0]; r.textContent = texts[key][1]; }
}

function refreshAllData() {
    state.typeA = getMBTITypeString(state.users.A);
    state.typeB = getMBTITypeString(state.users.B);
    state.stacks.A = MBTI_FUNCTION_STACKS[state.typeA.split('-')[0]];
    state.stacks.B = MBTI_FUNCTION_STACKS[state.typeB.split('-')[0]];
    state.levels.A = getFunctionLevels(state.users.A, state.stacks.A);
    state.levels.B = getFunctionLevels(state.users.B, state.stacks.B);
    state.complementData = calculateComplements(state.users);
    
    updateVisuals(state);
    updateScoreUI();
}

function updateScoreUI() {
    // Distance
    const dist = three.scene.children.find(c => c.type === 'Mesh' && c.geometry.type === 'SphereGeometry').position.distanceTo(three.scene.children.find(c => c.type === 'Mesh' && c.geometry.type === 'SphereGeometry' && c !== three.scene.children.find(c => c.type === 'Mesh' && c.geometry.type === 'SphereGeometry')).position) / UI_CONFIG.SCALE;
    let score = Math.max(0, Math.min(100, (1.0 - (dist/3.0)) * 100));
    document.getElementById('score-display').textContent = Math.round(score);
    
    // Complement
    let compScore = Math.min(100, Math.round(Math.min(100, state.complementData.rescueScoreRaw) * (1 + state.complementData.mirrorFactor)));
    document.getElementById('comp-score-display').textContent = compScore;
    
    const compBox = document.getElementById('comp-score-box');
    if (state.complementData.mirrorFactor > 0) compBox.classList.add('mirror-active');
    else compBox.classList.remove('mirror-active');
    
    // Ranks and Summaries
    updateRank('rank-display', score);
    updateRank('comp-rank-display', compScore);
    
    document.getElementById('tab-A').querySelector('.mbti-type').textContent = `(${state.typeA})`;
    document.getElementById('tab-B').querySelector('.mbti-type').textContent = `(${state.typeB})`;
    
    updateSummary('summary-A', state.typeA);
    updateSummary('summary-B', state.typeB);
}

function updateRank(id, score) {
    const el = document.getElementById(id);
    let rank = 'D', col = '#e74c3c';
    if (score >= 80) { rank = 'S'; col = '#FFD700'; }
    else if (score >= 60) { rank = 'A'; col = '#2ecc71'; }
    else if (score >= 40) { rank = 'B'; col = '#3498db'; }
    else if (score >= 20) { rank = 'C'; col = '#e67e22'; }
    el.textContent = rank; el.style.color = col;
}

function updateSummary(id, type) {
    const el = document.getElementById(id);
    el.querySelector('.score-type-name').textContent = type;
    el.querySelector('.score-nickname').textContent = `タイプ：${MBTI_NICKNAMES[type.split('-')[0]] || '不明'}`;
}

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const now = performance.now();

    // State Transitions
    if (state.mode === 'EDITING' && now - state.lastInteraction > UI_CONFIG.INTERACTION_TIMEOUT) {
        if (!isAllFifty(state.users.A) && !isAllFifty(state.users.B)) {
            state.mode = 'ANALYZING';
            document.getElementById('analysis-overlay').style.display = 'flex';
            setTimeout(() => {
                state.mode = 'PLAYING';
                state.viewMode = 'compatibility';
                state.timeline.elapsed = 0; state.timeline.phase = 'IDLE';
                document.getElementById('analysis-overlay').style.display = 'none';
                document.getElementById('narration-panel').style.display = 'block';
            }, UI_CONFIG.ANALYSIS_TIME);
        } else { state.mode = 'IDLE'; }
    }

    if (state.mode === 'PLAYING') {
        state.timeline.elapsed += delta;
        const narr = updateNarration(state, state.complementData.data);
        if (narr) {
            const el = document.getElementById('narration-text');
            el.classList.remove('visible');
            setTimeout(() => { el.innerHTML = narr.text; el.classList.add('visible'); }, 50);
        }
        
        if (state.viewMode === 'compatibility') {
            const spheres = three.scene.children.filter(c => c.geometry && c.geometry.type === 'SphereGeometry');
            drawBeams(state.complementData.data, state.timeline.phase, spheres[0].position, spheres[1].position);
        } else {
            clearBeams();
        }
        updateVisuals(state);
    } else {
        clearBeams();
    }

    three.controls.update();
    three.composer.render();
}

function isAllFifty(u) { return u.EI === 50 && u.NS === 50 && u.TF === 50 && u.JP === 50 && u.AT === 50; }

// Utils
function decodeState(b64) {
    try {
        const str = atob(b64); if (str.length !== 10) return;
        const arr = new Uint8Array(10);
        for (let i=0; i<10; i++) arr[i] = str.charCodeAt(i);
        const keys = ['EI', 'NS', 'TF', 'JP', 'AT'];
        keys.forEach((k, i) => { state.users.A[k] = arr[i]; state.users.B[k] = arr[i+5]; });
    } catch(e) {}
}
function encodeState() {
    const keys = ['EI', 'NS', 'TF', 'JP', 'AT'];
    const arr = new Uint8Array(10);
    keys.forEach((k, i) => { arr[i] = state.users.A[k]; arr[i+5] = state.users.B[k]; });
    return btoa(String.fromCharCode.apply(null, arr));
}
function shareToX() {
    const url = `${window.location.origin}${window.location.pathname}?d=${encodeURIComponent(encodeState())}`;
    const text = `MBTI 5D Visualizer\n\nDistance: ${document.getElementById('score-display').textContent}\nComplement: ${document.getElementById('comp-score-display').textContent}\n\n結果をチェック：\n${url}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
}
function copyURL() {
    const url = `${window.location.origin}${window.location.pathname}?d=${encodeURIComponent(encodeState())}`;
    navigator.clipboard.writeText(url).then(() => {
        const toast = document.getElementById('copy-toast');
        toast.style.opacity = '1'; setTimeout(() => toast.style.opacity = '0', 2000);
    });
}
function takeScreenshot() {
    const btn = document.getElementById('screenshot-btn');
    const original = btn.innerHTML;
    btn.textContent = '保存中...';
    html2canvas(document.body, { backgroundColor: '#050510', scale: window.devicePixelRatio || 1, useCORS: true }).then(canvas => {
        const link = document.createElement('a');
        link.download = `mbti_5d_${state.typeA}_${state.typeB}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        btn.innerHTML = original;
    }).catch(() => { btn.innerHTML = original; alert('保存に失敗しました'); });
}
