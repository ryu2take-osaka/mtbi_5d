/**
 * MBTI Scoring Logic
 */
import { SCORE_CONFIG } from './config.js';
import { MBTI_FUNCTION_STACKS } from './data.js';

/**
 * Generates the 4-letter + A/T type string from raw slider data
 * @param {Object} data - Raw slider values (0-100)
 * @returns {string} e.g. "INTP-T"
 */
export function getMBTITypeString(data) {
    if (data.EI === 50 && data.NS === 50 && data.TF === 50 && data.JP === 50 && data.AT === 50) return "XXXX-X";
    const e = data.EI < 50 ? 'E' : (data.EI > 50 ? 'I' : 'X');
    const n = data.NS < 50 ? 'N' : (data.NS > 50 ? 'S' : 'X');
    const t = data.TF < 50 ? 'T' : (data.TF > 50 ? 'F' : 'X');
    const j = data.JP < 50 ? 'J' : (data.JP > 50 ? 'P' : 'X');
    const a = data.AT < 50 ? 'A' : (data.AT > 50 ? 'T' : 'X');
    return `${e}${n}${t}${j}-${a}`;
}

/**
 * Calculates levels (0-100) for each of the 4 functions in the stack
 * @param {Object} data - User slider data
 * @param {string[]} stack - 4 functional codes (e.g. ['Ti', 'Ne', ...])
 * @returns {number[]} 4 levels
 */
export function getFunctionLevels(data, stack) {
    if (!stack) return [0, 0, 0, 0];
    const posWeight = [1.0, 0.75, 0.5, 0.25];
    return stack.map((func, i) => {
        const attitude = func.charAt(1); // 'i' or 'e'
        const domain = func.charAt(0);   // 'N','S','T','F'
        const attScore = attitude === 'i' ? data.EI : (100 - data.EI);
        let domScore = 50;
        if (domain === 'N') domScore = 100 - data.NS;
        else if (domain === 'S') domScore = data.NS;
        else if (domain === 'T') domScore = 100 - data.TF;
        else if (domain === 'F') domScore = data.TF;
        const rawLevel = posWeight[i] * ((attScore + domScore) / 2);
        return Math.round(Math.max(0, Math.min(100, rawLevel)));
    });
}

/**
 * Main compatibility engine. Calculates rescue scores and mirror factors.
 * @param {Object} users - {A: userData, B: userData}
 * @param {Object} state - Current global state
 * @returns {Object} {data: details[], mirrorFactor: number, rescueScoreRaw: number, atModifier: number}
 */
export function calculateComplements(users, state) {
    const typeA = getMBTITypeString(users.A);
    const typeB = getMBTITypeString(users.B);
    const stackA = MBTI_FUNCTION_STACKS[typeA.split('-')[0]];
    const stackB = MBTI_FUNCTION_STACKS[typeB.split('-')[0]];
    const lvA = getFunctionLevels(users.A, stackA);
    const lvB = getFunctionLevels(users.B, stackB);

    let result = {
        data: [],
        mirrorFactor: 0,
        rescueScoreRaw: 0
    };

    if (!stackA || !stackB) return result;

    // 1. Rescue Score
    let rescueScore = 0;
    if (stackA[0] === stackB[3]) rescueScore += SCORE_CONFIG.FULL;
    if (stackB[0] === stackA[3]) rescueScore += SCORE_CONFIG.FULL;
    if (stackA[1] === stackB[3] || stackA[0] === stackB[2]) rescueScore += SCORE_CONFIG.PARTIAL;
    if (stackB[1] === stackA[3] || stackB[0] === stackA[2]) rescueScore += SCORE_CONFIG.PARTIAL;
    result.rescueScoreRaw = rescueScore;

    // 2. Mirror Factor
    let factors = [];
    const isMirror = (f1, f2) => f1.substring(0, 1) === f2.substring(0, 1) && f1.substring(1, 2) !== f2.substring(1, 2);

    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            if (isMirror(stackA[i], stackB[j])) {
                let f = 0;
                if (i === j) f += SCORE_CONFIG.MIRROR.position;
                if (i < 2 && j < 2) f += SCORE_CONFIG.MIRROR.strong;
                if (Math.abs(lvA[i] - lvB[j]) < 20) f += SCORE_CONFIG.MIRROR.lvNear;

                if (f > 0) {
                    factors.push(f);
                    result.data.push({
                        type: 'MIRROR', from: 'BOTH', funcA: stackA[i], funcB: stackB[j],
                        s: f * 10, idxA: i, idxB: j
                    });
                }
            }
            if (stackA[i] === stackB[j]) {
                result.data.push({
                    type: 'RESCUE', from: i < j ? 'A' : 'B', func: stackA[i],
                    s: 0.5, idxA: i, idxB: j
                });
            }
        }
    }
    result.mirrorFactor = Math.min(SCORE_CONFIG.MIRROR.cap, factors.reduce((a, b) => a + b, 0));
    result.atModifier = Math.round(((users.A.AT + users.B.AT) / 10) - 10);
    result.data.sort((a, b) => b.s - a.s);

    return result;
}

/**
 * Maps a numerical score to a rank letter
 * @param {number} score - 0-100
 * @returns {string} S, A, B, C, or D
 */
export function getRank(score) {
    if (score >= 80) return 'S';
    if (score >= 60) return 'A';
    if (score >= 40) return 'B';
    if (score >= 20) return 'C';
    return 'D';
}
