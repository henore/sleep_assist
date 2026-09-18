import { SleepRecord, TechniqueResponse, InsightResult, Stats7d, RuleEngineResult, FocusCategory } from '../types/sleep';
import { TechniqueCategory, TECHNIQUE_DEFS } from '../constants/techniques';
import { calcTimeInBed, calcSleepEfficiency, formatTime } from '../utils/time';
import { Translations } from '../i18n/types';
import { en as enLocale } from '../i18n/locales/en';
import { calculateSessionStats, getPreviousCompletedSessions } from './statsCalculator';
import { evaluateSleepSession } from './ruleEngine';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? '';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

export const DAILY_INSIGHT_PROMPT_VERSION = 'v3';

const SYSTEM_PROMPT = `You are the Daily Insight generator for Simple CBT-I, a self-help sleep journal based on CBT-I principles.

You do not diagnose or treat medical conditions. Your job is not to create a treatment plan. The application has already analyzed the sleep data and selected the relevant CBT-I focus.

Use only the supplied structured data.

PRIMARY GOAL

Create one short, calm Daily Insight that:

1. briefly reflects one meaningful observation, positive behavior, or recent trend when supported by the data;
2. ALWAYS provides exactly ONE specific, practical CBT-I behavior the user can focus on today or tonight.

A Daily Insight must never consist only of comments about sleep duration, sleep efficiency, sleep satisfaction, bedtime, wake time, or recent trends. Sleep metrics are context. The practical CBT-I behavior is the core value of the Insight.

ACTION SELECTION

The practical action MUST come from the supplied eligibleFocusActions. Return its ID as focusActionId. Never invent a new CBT-I technique. Never output an action marked not_applicable. Prefer actions consistent with ruleEngine.recommendedFocus. When appropriate, prefer a useful action that was marked not_done. An action marked done may be reinforced when maintaining that behavior is the most appropriate focus. Do not shame the user for a not_done response. Treat not_applicable differently from not_done.

SATISFACTION

Do NOT mention sleep satisfaction routinely. Mention satisfaction only when the rule engine explicitly indicates it is relevant (such as low_satisfaction_despite_good_efficiency) or satisfaction has a clearly meaningful recent trend relevant to today's focus. Do not mention satisfaction simply because it exists in the input.

SLEEP DURATION

Do not routinely praise or criticize sleep merely because it was longer or shorter. Do not imply that longer sleep is automatically better. Use sleep duration only when it meaningfully supports the supplied rule-engine signals or recommendation.

CBT-I SAFETY

Never: diagnose insomnia, sleep apnea, depression, anxiety, bipolar disorder, or any other condition; recommend medications or supplements; give medical treatment advice; make causal claims unsupported by the supplied data; guarantee better sleep; tell the user to "try harder" to sleep; tell the user they must get a specific number of hours of sleep; independently prescribe a bedtime or wake time; shorten or lengthen a sleep window; prescribe or modify sleep restriction timing; create a sleep restriction schedule.

Sleep restriction scheduling requires separate application logic and is never controlled by you.

BEHAVIOR OVER OUTCOME

CBT-I focuses on controllable behavior rather than forcing sleep. Even after a poor night, reinforce a useful behavior if the user followed one. Do not imply that failing to sleep well means the user failed.

TREND USAGE

Use 7-day trends when enough data exists and when they add useful context. Do not pretend a trend exists when daysRecorded is insufficient. Do not overreact to tiny numerical differences. The Insight should not read like a statistical report.

INFORMATION PRIORITY

When composing the Insight, prioritize in this order:
1. ruleEngine.recommendedFocus
2. attentionSignals
3. today's actions and their results
4. positiveSignals
5. 7-day trends
6. satisfaction / raw duration

NO RESTATEMENT

Do not simply restate or paraphrase the user's sleep record or CBT-I check-in answers. The user already knows what they recorded.

Every sentence must add value through at least one of: interpretation, recent trend or contrast, prioritization, positive reinforcement, or one practical CBT-I-based action. Only mention a raw sleep fact when it is necessary to explain why the recommended action was chosen.

Avoid sentences such as: "You took a long time to fall asleep." / "You went to bed when sleepy." / "You woke during the night."

Prefer sentences such as: "You did well to wait for clear sleepiness before going to bed." / "Recent records suggest bedtime consistency is the more useful focus tonight." / "Keep that habit, and focus on just one thing tonight: ..."

STYLE

Write in the language specified by the language field.

Tone: calm, concise, supportive, adult, non-dramatic, practical.

Avoid: exaggerated praise, exclamation marks, generic encouragement, repetitive wording, medical jargon unless necessary, mentioning that you are an AI.

The user should feel that the message responds to today's actual sleep record and behavior, not that it is a generic template.

LENGTH

Keep the message concise. For Japanese, approximately 100-200 Japanese characters is a useful target, but naturalness is more important than an exact count.

OUTPUT

Return valid structured JSON only.

{
  "title": "...",
  "message": "...",
  "focusActionId": "..."
}

focusActionId MUST exactly match one ID in eligibleFocusActions. There must be exactly one practical behavioral recommendation in the message.`;

function buildUserPrompt(payload: string): string {
  return `Create today's Daily Insight from the following sleep-journal data.

The ruleEngine has already determined what matters today. Your job is to communicate it clearly and provide exactly one actionable CBT-I behavior from eligibleFocusActions.

Do not repeat every statistic. Mention numbers only when they make the insight easier to understand.

DATA:
${payload}

Return:
{
  "title": "...",
  "message": "...",
  "focusActionId": "..."
}`;
}

const RESULT_MAP: Record<TechniqueResponse, string> = {
  done: 'done',
  na: 'not_applicable',
  failed: 'not_done',
};

const CATEGORY_FULL: Record<TechniqueCategory, string> = {
  SR: 'sleep_restriction',
  SC: 'stimulus_control',
  CR: 'cognitive_restructuring',
  MR: 'mindfulness',
};

const CATEGORY_SHORT_REVERSE: Record<string, TechniqueCategory> = {
  sleep_restriction: 'SR',
  stimulus_control: 'SC',
  cognitive_restructuring: 'CR',
  mindfulness: 'MR',
};

export interface EligibleFocusAction {
  id: string;
  category: string;
  text: string;
  result: string;
}

export interface InsightContext {
  bedtime: Date;
  wakeTime: Date;
  sleepOnsetMinutes: number;
  nightWakeMinutes: number;
  satisfaction: number;
  techniqueIds: string[];
  techniqueResponses: Record<string, TechniqueResponse>;
  currentSession?: Pick<SleepRecord, 'id' | 'date'>;
  records: SleepRecord[];
  language: string;
  t: Translations;
}

export interface DailyInsightPayload {
  language: string;
  today: {
    bedtime: string;
    wakeTime: string;
    timeInBedMin: number;
    sleepOnsetLatencyMin: number;
    wakeAfterSleepOnsetMin: number;
    totalSleepTimeMin: number;
    sleepEfficiencyPct: number;
    satisfaction: number;
  };
  actions: {
    id: string;
    category: string;
    result: string;
    label: string;
  }[];
  eligibleFocusActions: EligibleFocusAction[];
  stats7d: Stats7d;
  ruleEngine: RuleEngineResult;
}

export function buildEligibleFocusActions(
  actions: { id: string; category: string; result: string }[],
  recommendedFocus: FocusCategory,
  stats: Stats7d,
): EligibleFocusAction[] {
  const eligible: EligibleFocusAction[] = [];
  const addedIds = new Set<string>();

  for (const a of actions) {
    if (a.result === 'not_applicable') continue;
    const def = TECHNIQUE_DEFS.find((d) => d.id === a.id);
    eligible.push({
      id: a.id,
      category: a.category,
      text: def ? enLocale[def.labelKey] : a.id,
      result: a.result,
    });
    addedIds.add(a.id);
  }

  const focusCatShort = CATEGORY_SHORT_REVERSE[recommendedFocus];
  const hasMatchingFocus = recommendedFocus === 'maintenance'
    || eligible.some((a) => a.category === recommendedFocus);

  if (!hasMatchingFocus && focusCatShort) {
    const candidates = TECHNIQUE_DEFS
      .filter((td) => td.category === focusCatShort)
      .filter((td) => !addedIds.has(td.id))
      .filter((td) => !td.eligibility || td.eligibility(stats));

    for (const td of candidates.slice(0, 2)) {
      eligible.push({
        id: td.id,
        category: CATEGORY_FULL[td.category],
        text: enLocale[td.labelKey],
        result: 'suggested',
      });
    }
  }

  eligible.sort((a, b) => {
    const catMatch = (x: EligibleFocusAction) =>
      x.category === recommendedFocus ? 0 : 1;
    const resultPriority = (x: EligibleFocusAction) =>
      x.result === 'not_done' ? 0 : x.result === 'suggested' ? 1 : 2;
    const cm = catMatch(a) - catMatch(b);
    if (cm !== 0) return cm;
    return resultPriority(a) - resultPriority(b);
  });

  return eligible;
}

export function buildDailyInsightPayload(ctx: InsightContext): DailyInsightPayload {
  const tib = calcTimeInBed(ctx.bedtime, ctx.wakeTime);
  const tst = Math.max(0, tib - ctx.sleepOnsetMinutes - ctx.nightWakeMinutes);
  const eff = calcSleepEfficiency(tib, ctx.sleepOnsetMinutes, ctx.nightWakeMinutes);
  const effRounded = Math.round(eff * 10) / 10;

  const bed = ctx.bedtime;
  const current = ctx.currentSession ?? { date: [bed.getFullYear(), String(bed.getMonth() + 1).padStart(2, '0'), String(bed.getDate()).padStart(2, '0')].join('-') };
  const previous = getPreviousCompletedSessions(current, ctx.records);
  // Below seven previous sessions, rely on repeated observations, not directional trends.
  const stats = calculateSessionStats([...previous].reverse(), 7);

  const actions = ctx.techniqueIds.map((id) => {
    const def = TECHNIQUE_DEFS.find((d) => d.id === id);
    return {
      id,
      category: (def?.category ?? 'MR') as TechniqueCategory,
      result: ctx.techniqueResponses[id] ?? ('na' as TechniqueResponse),
      label: def ? ctx.t[def.labelKey] : id,
    };
  });

  const ruleResult = evaluateSleepSession(
    {
      sleepEfficiencyPct: effRounded,
      sleepOnsetMin: ctx.sleepOnsetMinutes,
      wasoMin: ctx.nightWakeMinutes,
      satisfaction: ctx.satisfaction,
    },
    actions.map((a) => ({ id: a.id, category: a.category, result: a.result })),
    stats,
    previous,
  );

  const mappedActions = actions.map((a) => ({
    id: a.id,
    category: CATEGORY_FULL[a.category],
    result: RESULT_MAP[a.result],
    label: a.label,
  }));

  const eligibleFocusActions = buildEligibleFocusActions(
    mappedActions,
    ruleResult.recommendedFocus,
    stats,
  );

  return {
    language: ctx.language,
    today: {
      bedtime: formatTime(ctx.bedtime),
      wakeTime: formatTime(ctx.wakeTime),
      timeInBedMin: Math.round(tib),
      sleepOnsetLatencyMin: ctx.sleepOnsetMinutes,
      wakeAfterSleepOnsetMin: ctx.nightWakeMinutes,
      totalSleepTimeMin: Math.round(tst),
      sleepEfficiencyPct: effRounded,
      satisfaction: ctx.satisfaction,
    },
    actions: mappedActions,
    eligibleFocusActions,
    stats7d: stats,
    ruleEngine: ruleResult,
  };
}

export async function generateDailyInsight(ctx: InsightContext): Promise<InsightResult> {
  const payload = buildDailyInsightPayload(ctx);

  if (API_BASE) {
    try {
      const result = await callInsightApi(payload);
      const validated = validateInsightResult(result, payload.eligibleFocusActions);
      if (validated) return { ...validated, source: 'openai', locale: ctx.language };
      if (__DEV__) console.warn('[DailyInsight] API response failed validation, using fallback');
      return { ...buildFallbackFromPayload(payload, ctx.t), locale: ctx.language };
    } catch (e) {
      if (__DEV__) console.warn('[DailyInsight] API call failed, using fallback:', e);
      return { ...buildFallbackFromPayload(payload, ctx.t), locale: ctx.language };
    }
  }

  if (__DEV__) console.warn('[DailyInsight] No API_BASE configured, using fallback');
  return { ...buildFallbackFromPayload(payload, ctx.t), locale: ctx.language };
}

function validateInsightResult(
  result: InsightResult,
  eligible: EligibleFocusAction[],
): InsightResult | null {
  if (typeof result.title !== 'string' || !result.title.trim()
    || typeof result.message !== 'string' || !result.message.trim()) return null;
  if (typeof result.focusActionId !== 'string' || !result.focusActionId.trim()) return null;
  if (!eligible.some((a) => a.id === result.focusActionId)) return null;
  return result;
}

async function callInsightApi(payload: DailyInsightPayload): Promise<InsightResult> {
  const res = await fetch(`${API_BASE}/daily-insight`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(JSON.stringify(payload, null, 2)),
      promptVersion: DAILY_INSIGHT_PROMPT_VERSION,
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return {
    title: data.title ?? '',
    message: data.message ?? '',
    focusActionId: data.focusActionId ?? '',
    source: 'openai' as const,
    model: typeof data.model === 'string' ? data.model : undefined,
    promptVersion: typeof data.promptVersion === 'string' ? data.promptVersion : DAILY_INSIGHT_PROMPT_VERSION,
  };
}

function buildFallbackFromPayload(
  payload: DailyInsightPayload,
  t: Translations,
): InsightResult {
  const eligible = payload.eligibleFocusActions;
  const focus = payload.ruleEngine.recommendedFocus;

  const picked = eligible.find((a) => a.category === focus && a.result !== 'not_applicable')
    ?? eligible.find((a) => a.result === 'not_done')
    ?? eligible[0];

  const lines: string[] = [];

  if (payload.today.sleepEfficiencyPct >= 85) {
    lines.push(t.insightEfficiencyGood);
  } else if (payload.today.sleepEfficiencyPct >= 70) {
    lines.push(t.insightEfficiencyModerate);
  } else {
    lines.push(t.insightEfficiencyLow);
  }

  if (picked) {
    const technique = TECHNIQUE_DEFS.find((definition) => definition.id === picked.id);
    const actionText = technique ? t[technique.labelKey] : picked.text;
    lines.push(t.insightFocusSuggestion.replace('{action}', actionText));
  }

  return {
    title: '',
    message: lines.join('\n'),
    focusActionId: picked?.id ?? '',
    source: 'fallback' as const,
  };
}

export function buildTemplateInsight(
  efficiency: number,
  focusActionId: string,
  t: Translations,
): { title: string; message: string } {
  const lines: string[] = [];
  if (efficiency >= 85) lines.push(t.insightEfficiencyGood);
  else if (efficiency >= 70) lines.push(t.insightEfficiencyModerate);
  else lines.push(t.insightEfficiencyLow);

  if (focusActionId) {
    const technique = TECHNIQUE_DEFS.find((d) => d.id === focusActionId);
    const actionText = technique ? t[technique.labelKey] : focusActionId;
    lines.push(t.insightFocusSuggestion.replace('{action}', actionText));
  }
  return { title: '', message: lines.join('\n') };
}
