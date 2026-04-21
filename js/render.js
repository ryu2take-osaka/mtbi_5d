/**
 * Three.js and DOM Rendering
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { UI_CONFIG } from './config.js';
import { getMBTITypeString, getFunctionLevels } from './score.js';
import { MBTI_FUNCTION_STACKS, MBTI_NICKNAMES } from './data.js';

let scene, camera, renderer, composer, bloomPass, controls;
let sphereA, sphereB, line, guidesA, guidesB;
let beamsGroup;
let gFloor, gLeft, gBack;

const SCALE = UI_CONFIG.SCALE;
const BOX_SIZE = SCALE * 2;

export function initThree(container) {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050510, 0.05);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 15);

    const isMobile = window.innerWidth <= 768;
    renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: "high-performance", preserveDrawingBuffer: true });
    renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    initPostProcessing(container);
    initObjects();
    initLights();

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    window.addEventListener('resize', () => onWindowResize(container));

    return { scene, camera, renderer, composer, controls };
}

function initPostProcessing(container) {
    composer = new EffectComposer(renderer);
    const renderScene = new RenderPass(scene, camera);
    const bloomRes = window.innerWidth <= 768 ? 128 : 256;
    bloomPass = new UnrealBloomPass(new THREE.Vector2(bloomRes, bloomRes), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.2;
    bloomPass.strength = 1.0;
    bloomPass.radius = 0.5;
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
}

function initObjects() {
    // Grids
    const gridColorLine = 0x555566;
    const gridColorBg = 0x222233;
    const isMobile = window.innerWidth <= 768;
    const div = isMobile ? 10 : 20;

    gFloor = new THREE.GridHelper(BOX_SIZE, div, gridColorLine, gridColorBg);
    gFloor.position.y = -SCALE;
    scene.add(gFloor);

    gLeft = new THREE.GridHelper(BOX_SIZE, div, gridColorLine, gridColorBg);
    gLeft.rotation.z = Math.PI / 2;
    gLeft.position.x = -SCALE;
    scene.add(gLeft);

    gBack = new THREE.GridHelper(BOX_SIZE, div, gridColorLine, gridColorBg);
    gBack.rotation.x = Math.PI / 2;
    gBack.position.z = -SCALE;
    scene.add(gBack);

    // Spheres
    const sphereGeo = new THREE.SphereGeometry(1, 12, 12);
    const createMat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.8 });
    sphereA = new THREE.Mesh(sphereGeo, createMat());
    sphereB = new THREE.Mesh(sphereGeo, createMat());
    scene.add(sphereA);
    scene.add(sphereB);

    // Line
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);

    // Beams
    beamsGroup = new THREE.Group();
    scene.add(beamsGroup);

    // Guides
    guidesA = createGuideLines();
    guidesB = createGuideLines();
}

function createGuideLines() {
    const matX = new THREE.LineDashedMaterial({ color: 0xE4AE3A, transparent: true, opacity: 0.6, dashSize: 0.2, gapSize: 0.1 });
    const matY = new THREE.LineDashedMaterial({ color: 0x33A474, transparent: true, opacity: 0.6, dashSize: 0.2, gapSize: 0.1 });
    const matZ = new THREE.LineDashedMaterial({ color: 0x8A61A6, transparent: true, opacity: 0.6, dashSize: 0.2, gapSize: 0.1 });
    const gX = new THREE.Line(new THREE.BufferGeometry(), matX);
    const gY = new THREE.Line(new THREE.BufferGeometry(), matY);
    const gZ = new THREE.Line(new THREE.BufferGeometry(), matZ);
    scene.add(gX); scene.add(gY); scene.add(gZ);
    return { x: gX, y: gY, z: gZ };
}

function initLights() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    const dl = new THREE.DirectionalLight(0xffffff, 0.5);
    dl.position.set(10, 10, 10);
    scene.add(dl);
}

function onWindowResize(container) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
}

// --- Update Functions ---

export function updateVisuals(state) {
    const uA = state.users.A;
    const uB = state.users.B;
    const typeStrA = getMBTITypeString(uA);
    const typeStrB = getMBTITypeString(uB);
    const stackA = MBTI_FUNCTION_STACKS[typeStrA.split('-')[0]];
    const stackB = MBTI_FUNCTION_STACKS[typeStrB.split('-')[0]];

    // Positions
    const getPos = (u) => new THREE.Vector3(((u.NS - 50) / 50) * SCALE, ((u.TF - 50) / 50) * SCALE, ((u.JP - 50) / 50) * SCALE);
    sphereA.position.copy(getPos(uA));
    sphereB.position.copy(getPos(uB));

    const p2Exists = !isAllFifty(uB);
    sphereB.visible = p2Exists;
    line.visible = p2Exists;
    if (p2Exists) line.geometry.setFromPoints([sphereA.position, sphereB.position]);

    // Appearance
    const applyLooks = (mesh, u) => {
        const glow = (100 - u.EI) / 100;
        const col = getGroupColor(u);
        mesh.scale.setScalar(1.3 - (u.AT / 100) * 0.6);
        
        // Final Reveal Boost
        const isReveal = state.timeline.phase && state.timeline.phase.includes('TITLE_REVEAL');
        const boost = isReveal ? 5.0 : 1.0;

        mesh.material.color.copy(col).multiplyScalar(0.2);
        mesh.material.emissive.copy(col);
        mesh.material.emissiveIntensity = (0.5 + glow * 2.5) * boost;
    };
    applyLooks(sphereA, uA);
    applyLooks(sphereB, uB);

    // Guides
    updateGuidesVisibility(guidesA, sphereA.position, true);
    updateGuidesVisibility(guidesB, sphereB.position, p2Exists);

    // Side Stacks
    updateStackNodes('p1', stackA, uA, state);
    updateStackNodes('p2', p2Exists ? stackB : null, uB, state);

    const phase = state.timeline.phase;
    const isReveal = phase && phase.includes('TITLE_REVEAL');

    // Bloom juiciness
    const revealFactor = isReveal ? 2.0 : 1.0;
    bloomPass.strength = (0.6 + (((100 - uA.EI) / 100 + (100 - uB.EI) / 100) / 2) * 1.5) * revealFactor;

    // Grid Tinting Effect
    const targetColor = new THREE.Color(0x555566);
    if (isReveal) {
        const targetUser = state.viewMode === 'self' ? uA : uB;
        targetColor.copy(getGroupColor(targetUser));
    }
    
    [gFloor, gLeft, gBack].forEach(g => {
        if (!g) return;
        g.material.color.lerp(targetColor, 0.1);
    });
}

function updateGuidesVisibility(g, pos, visible) {
    g.x.visible = g.y.visible = g.z.visible = visible;
    if (!visible) return;
    g.x.geometry.setFromPoints([pos, new THREE.Vector3(-SCALE, pos.y, pos.z)]);
    g.y.geometry.setFromPoints([pos, new THREE.Vector3(pos.x, -SCALE, pos.z)]);
    g.z.geometry.setFromPoints([pos, new THREE.Vector3(pos.x, pos.y, -SCALE)]);
    g.x.computeLineDistances(); g.y.computeLineDistances(); g.z.computeLineDistances();
}

const funcColors = { 'N': '#E4AE3A', 'S': '#33A474', 'T': '#4298B4', 'F': '#E46562' };

function updateStackNodes(prefix, stack, user, state) {
    const levels = getFunctionLevels(user, stack);
    for (let i = 0; i < 4; i++) {
        const node = document.getElementById(`${prefix}-f${i + 1}-side`);
        const lvEl = document.getElementById(`${prefix}-f${i + 1}-lv`);
        if (!node) continue;
        if (stack) {
            const func = stack[i];
            const color = funcColors[func.charAt(0)] || '#fff';
            node.innerHTML = `<span>${func}</span>`;
            node.className = 'function-node';
            node.style.setProperty('--fill', `${levels[i]}%`);
            node.style.setProperty('--fill-color', color + '66');
            node.style.borderColor = color + '88';
            
            // Highlight Logic
            const isTargetUser = (state.highlightUser === 'A' && prefix === 'p1') || (state.highlightUser === 'B' && prefix === 'p2') || state.highlightUser === 'BOTH';
            if (state.highlightIndex === i && isTargetUser) {
                node.classList.add('active');
            }

            // Phase based glow (for compatibility mode)
            if (state.viewMode === 'compatibility') {
                const phase = state.timeline.phase;
                state.complementData.data.forEach((c, idx) => {
                    let active = (phase === 'CORE' && idx === 0) || (phase === 'SUB' && idx < 3) || phase === 'OVERVIEW';
                    if (active && ((prefix === 'p1' && c.idxA === i) || (prefix === 'p2' && c.idxB === i))) {
                        if (c.type === 'MIRROR') node.classList.add('glow-mirror');
                        else if (idx === 0) node.classList.add('glow-high');
                        else node.classList.add('glow-mid');
                    }
                });
            }
        } else {
            node.textContent = '-'; node.className = 'function-node'; node.style.setProperty('--fill', '0%');
        }
        if (lvEl) lvEl.textContent = stack ? `LV:${levels[i]}` : 'LV:0';
    }
}

function getGroupColor(u) {
    const isN = u.NS < 50; const isT = u.TF < 50; const isJ = u.JP < 50;
    if (isN && isT) return new THREE.Color('#bf5af2');
    if (isN && !isT) return new THREE.Color('#2ecc71');
    if (!isN && isJ) return new THREE.Color('#3498db');
    if (!isN && !isJ) return new THREE.Color('#f1c40f');
    return new THREE.Color('#ffffff');
}

function isAllFifty(u) { return u.EI === 50 && u.NS === 50 && u.TF === 50 && u.JP === 50 && u.AT === 50; }

export function clearBeams() { beamsGroup.clear(); }

export function drawBeams(compData, phase, posA, posB) {
    beamsGroup.clear();
    let bCount = 0;
    compData.forEach((c, idx) => {
        if (bCount >= 2) return;
        let show = (phase === 'CORE' && idx === 0) || (phase === 'SUB' && idx < 2) || phase === 'OVERVIEW';
        if (show) {
            const color = c.type === 'MIRROR' ? 0x00FFFF : 0xFFD700;
            const geo = new THREE.CylinderGeometry(0.02, 0.02, 1, 6);
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false });
            const beam = new THREE.Mesh(geo, mat);
            const start = c.from === 'B' ? posB : posA;
            const end = c.from === 'B' ? posA : posB;
            const dir = new THREE.Vector3().subVectors(end, start);
            beam.position.copy(start).add(dir.clone().multiplyScalar(0.5));
            beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
            beam.scale.set(1, dir.length(), 1);
            beamsGroup.add(beam);
            bCount++;
        }
    });
}
