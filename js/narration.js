/**
 * Narration and Timeline Control
 */
import { FUNCTION_DESCRIPTIONS, MBTI_TITLES, MBTI_NICKNAMES } from './data.js';
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
        const typeStr = state[target === 'A' ? 'typeA' : 'typeB'].split('-')[0];
        
        // Safety check for missing stack
        if (!stack || !levels || stack.length < 4 || levels.length < 4) {
            return null;
        }

        // Cycle through functions + final epithet
        const cycleInterval = 4; // 4 seconds per block
        const totalDuration = cycleInterval * 5; // 4 functions + 1 epithet
        const elapsed = state.timeline.elapsed;

        // Stop after one full cycle
        if (elapsed >= totalDuration) {
            if (state.timeline.phase !== 'FINISHED') {
                state.timeline.phase = 'FINISHED';
                state.highlightUser = null;
                state.highlightIndex = -1;
                return { phase: 'FINISHED', text: '' };
            }
            return null;
        }

        const funcIndex = Math.floor(elapsed / cycleInterval);
        const phaseToken = `${state.viewMode}-${funcIndex}`;

        if (state.timeline.phase !== phaseToken) {
            state.timeline.phase = phaseToken;
            
            if (funcIndex < 4) {
                // Functional stages
                state.highlightUser = target;
                state.highlightIndex = funcIndex;
                const labels = ['主機能', '補助機能', '第3機能', '劣等機能'];
                const text = `【${labels[funcIndex]}】<br>` + buildFunctionText(stack[funcIndex], levels[funcIndex], user.AT);
                return { phase: phaseToken, text };
            } else {
                // Final Epithet stage
                state.highlightUser = null;
                state.highlightIndex = -1;
                
                const nickname = MBTI_NICKNAMES[typeStr] || "探究者";
                const isT = user.AT > 50;
                const isInverted = levels[2] > levels[1];
                
                const variantKey = (isInverted ? 'I' : 'S') + (isT ? 'T' : 'A');
                const epithet = (MBTI_TITLES[typeStr] || {})[variantKey] || "未知なる者";

                const text = `<span style="font-size: 0.8em; opacity: 0.8;">総合評価：${nickname}</span><br>
<span style="font-size: 1.2em; color: #fff; text-shadow: 0 0 15px rgba(255,255,255,0.5);">「${epithet}」</span>`;
                return { phase: phaseToken, text };
            }
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
