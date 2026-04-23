/**
 * Main Application Entry Point
 */
import * as THREE from 'three';
import { initThree, updateVisuals, drawBeams, clearBeams } from './render.js';
import { calculateComplements, getMBTITypeString, getFunctionLevels } from './score.js';
import { MBTI_FUNCTION_STACKS, MBTI_NICKNAMES, MBTI_TITLES } from './data.js';
import { updateNarration, getStackStatus } from './narration.js';
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
            state.activeUser = 'A'; // Maintain inner state but we will show SCORE
            state.mode = 'EDITING'; 
            state.lastInteraction = -1000;
        }
    }

    setupEventListeners();
    initTicks();
    refreshMainUI();
    
    // Hide startup overlay after animations and start analysis if needed
    setTimeout(() => {
        const startup = document.getElementById('startup-overlay');
        if (startup) startup.classList.add('hidden');
        
        // After fade out, check if we should start analysis
        setTimeout(() => {
            if (!isAllFifty(state.users.A) && !isAllFifty(state.users.B)) {
                const tabScore = document.getElementById('tab-SCORE');
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tabScore.classList.add('active');
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                document.getElementById('panel-SCORE').classList.add('active');
                startAnalysis();
            }
        }, 1000); // Wait for fade-out transition
    }, 2500);

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
            
            // If clicking SCORE and we have data, trigger analysis if in EDITING
            if (target === 'SCORE' && !isAllFifty(state.users.A) && !isAllFifty(state.users.B)) {
                if (state.mode === 'EDITING' || state.mode === 'IDLE') {
                    startAnalysis();
                } else {
                    setViewMode('compatibility');
                }
            }

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

    // --- Description Mode Button ---
    document.getElementById('desc-mode-btn').addEventListener('click', () => {
        // Prevent freezing if stack is missing (押下時チェック)
        if (!state.stacks[state.activeUser]) return;
        setViewMode(state.activeUser === 'A' ? 'self' : 'other');
    });

    // We'll use the tab click handler for SCORE analysis
}

function startAnalysis() {
    state.mode = 'ANALYZING';
    document.getElementById('analysis-overlay').style.display = 'flex';
    document.getElementById('narration-panel').style.display = 'none';
    
    setTimeout(() => {
        state.mode = 'PLAYING';
        setViewMode('compatibility');
        document.getElementById('analysis-overlay').style.display = 'none';
    }, UI_CONFIG.ANALYSIS_TIME);
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
    const spheres = three.scene.children.filter(c => c.geometry && c.geometry.type === 'SphereGeometry');
    let score = 0;
    if (spheres.length >= 2) {
        const dist = spheres[0].position.distanceTo(spheres[1].position) / UI_CONFIG.SCALE;
        score = Math.max(0, Math.min(100, (1.0 - (dist / 3.0)) * 100));
    }
    const scoreEl = document.getElementById('score-display');
    if (scoreEl) scoreEl.textContent = Math.round(score);

    // Complement
    let baseCompScore = Math.min(100, Math.round(Math.min(100, state.complementData.rescueScoreRaw) * (1 + state.complementData.mirrorFactor)));
    let compScore = Math.min(100, baseCompScore + (state.complementData.atModifier || 0));
    const compScoreEl = document.getElementById('comp-score-display');
    if (compScoreEl) compScoreEl.textContent = compScore;

    const compBox = document.getElementById('comp-score-box');
    if (compBox) {
        if (state.complementData.mirrorFactor > 0) compBox.classList.add('mirror-active');
        else compBox.classList.remove('mirror-active');
    }

    // Ranks
    updateRank('rank-display', score);
    updateRank('comp-rank-display', compScore);

    const tabA = document.getElementById('tab-A');
    const tabB = document.getElementById('tab-B');
    if (tabA) {
        const span = tabA.querySelector('.mbti-type');
        if (span) span.textContent = `(${state.typeA})`;
    }
    if (tabB) {
        const span = tabB.querySelector('.mbti-type');
        if (span) span.textContent = `(${state.typeB})`;
    }

    // SCORE tab ready state
    const tabScore = document.getElementById('tab-SCORE');
    if (tabScore) {
        if (!isAllFifty(state.users.A) && !isAllFifty(state.users.B)) {
            tabScore.classList.add('ready');
        } else {
            tabScore.classList.remove('ready');
        }
    }
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

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const now = performance.now();

    // State Transitions removed: analysis is now manual via SCORE tab
    if (state.mode === 'EDITING' && now - state.lastInteraction > UI_CONFIG.INTERACTION_TIMEOUT) {
        state.mode = 'IDLE'; 
    }

    if (state.mode === 'PLAYING') {
        state.timeline.elapsed += delta;
        const narr = updateNarration(state, state.complementData.data);
        if (narr) {
            const el = document.getElementById('narration-text');
            if (narr.phase === 'FINISHED') {
                const btn = document.getElementById('desc-mode-btn');
                if (btn) btn.style.borderColor = 'transparent';
            }
            el.classList.remove('visible');
            // Use rAF to ensure browser processes the removal before adding back
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    el.innerHTML = narr.text;
                    el.classList.add('visible');
                });
            });
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
    const target = 'A'; // Always share User A as "My type"
    const u = state.users[target];
    const typeStr = state.typeA.split('-')[0];
    const nickname = MBTI_NICKNAMES[typeStr] || "探究者";
    
    const levels = state.levels[target];
    const isT = u.AT > 50;
    const isInverted = levels[2] > levels[1];
    const variantKey = (isInverted ? 'I' : 'S') + (isT ? 'T' : 'A');
    const epithet = (MBTI_TITLES[typeStr] || {})[variantKey] || "未知なる者";

    const stackStatus = getStackStatus(levels);

    const url = `${window.location.origin}${window.location.pathname}?d=${encodeURIComponent(encodeState())}`;
    const text = `わたしのタイプは${nickname}「${epithet}」\n${stackStatus.name}のスタックです\n\n結果をチェック：\n${url}\n#MBTI_5D`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
}
function copyURL() {
    const url = `${window.location.origin}${window.location.pathname}?d=${encodeURIComponent(encodeState())}`;
    navigator.clipboard.writeText(url).then(() => {
        const toast = document.getElementById('copy-toast');
        toast.style.opacity = '1'; setTimeout(() => toast.style.opacity = '0', 2000);
    });
}
