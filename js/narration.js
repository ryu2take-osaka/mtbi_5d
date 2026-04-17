/**
 * Narration and Timeline Control
 */
import { FUNCTION_DESCRIPTIONS } from './data.js';
import { LV_BAND, UI_CONFIG } from './config.js';

export function getLvBand(lv) {
    if (lv >= LV_BAND.HIGH) return 'HIGH';
    if (lv >= LV_BAND.MID) return 'MID';
    return 'LOW';
}

export function buildFunctionText(func, lv, attitudeScore) {
    const meta = FUNCTION_DESCRIPTIONS[func];
    if (!meta) return '';
    const band = getLvBand(lv);
    const attitude = attitudeScore <= 50 ? 'A' : 'T';

    return `<strong>${meta.name} (LV:${lv})</strong><br>
${meta.base}<br>
<span style="font-size: 0.9em; opacity: 0.8;">${meta.lv[band]}</span><br>
<span style="font-size: 0.9em; opacity: 0.8;">${meta.tone[attitude]}</span>`;
}

export function updateNarration(state, totalComplements) {
    if (state.viewMode === 'compatibility') {
        const t = state.timeline.elapsed;
        const intervals = UI_CONFIG.NARRATION_INTERVALS;
        
        // Phase logic
        let phase = 'INTRO';
        if (t > intervals.OVERVIEW) phase = 'OVERVIEW';
        else if (t > intervals.DIFF) phase = 'DIFF';
        else if (t > intervals.SUB) phase = 'SUB';
        else if (t > intervals.CORE) phase = 'CORE';

        if (phase !== state.timeline.phase) {
            state.timeline.phase = phase;
            return { phase, text: getCompatibilityText(phase, state, totalComplements) };
        }
    } else {
        // Description modes
        const target = state.viewMode === 'self' ? 'A' : 'B';
        const user = state.users[target];
        const stack = state.stacks[target];
        const levels = state.levels[target];
        
        // Cycle through functions based on time
        const cycleInterval = 4; // 4 seconds per function
        const funcIndex = Math.floor(state.timeline.elapsed / cycleInterval) % 4;
        const phaseToken = `${state.viewMode}-${funcIndex}`;

        if (state.timeline.phase !== phaseToken) {
            state.timeline.phase = phaseToken;
            state.highlightUser = target;
            state.highlightIndex = funcIndex;

            const labels = ['主機能', '補助機能', '第3機能', '劣等機能'];
            const text = `【${labels[funcIndex]}】<br>` + buildFunctionText(stack[funcIndex], levels[funcIndex], user.AT);
            return { phase: phaseToken, text };
        }
    }
    return null;
}

function getCompatibilityText(phase, state, complements) {
    const rank = document.getElementById('rank-display').textContent;
    switch (phase) {
        case 'INTRO': return `あなたたちは「${rank}ランク」の関係です。<br>エネルギーの巡りを解析します。`;
        case 'CORE':
            if (complements.length > 0) {
                const c = complements[0];
                const meta = FUNCTION_DESCRIPTIONS[c.func || c.funcA];
                return `<strong>コア補完：${meta.name}</strong><br>${meta.base}`;
            }
            return `独自の距離感を保っている関係です。`;
        case 'SUB':
            return complements.length > 1 ? `複数の補助的な補完が関係を支えています。` : `静かに響き合うパートナーシップです。`;
        case 'DIFF': return `ズレによる摩擦には少しの注意が必要です。`;
        case 'OVERVIEW': return `評価結果：${rank}評価のパートナー性能。<br>共に進化し続ける関係です。`;
        default: return '';
    }
}
