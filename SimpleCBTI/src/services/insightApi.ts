import { SleepRecord, TechniqueResponse, InsightResult, Stats7d, RuleEngineResult } from '../types/sleep';
import { TechniqueCategory, TECHNIQUE_DEFS } from '../constants/techniques';
import { calcTimeInBed, calcSleepEfficiency, formatTime } from '../utils/time';
import { Translations } from '../i18n/types';
import { calculate7dStats } from './statsCalculator';
import { evaluateSleepSession } from './ruleEngine';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? '';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

const SYSTEM_PROMPT = `You are the Daily Insight generator for a CBT-I self-help sleep journal.

Your role is NOT to diagnose, treat, or provide medical care.
Your role is to provide a short, supportive reflection based only on the structured sleep data supplied by the application.

Follow these rules strictly:

1. Use only the supplied data. Never invent facts.
2. Focus primarily on 7-day trends rather than judging a single night.
3. Acknowledge one positive behavior or improvement when supported by the data.
4. Give at most one practical suggestion for the next sleep period.
5. Suggestions must come only from the CBT-I behavior represented by the supplied action IDs or recommendedFocus.
6. Do not prescribe or modify sleep restriction schedules.
7. Do not recommend changing bedtime, wake time, or time-in-bed unless explicitly supplied by the application's rule engine.
8. Do not diagnose insomnia, sleep apnea, depression, anxiety, bipolar disorder, or any other condition.
9. Do not discuss medication, supplements, or medication changes.
10. Do not claim that a particular behavior caused a change in sleep unless the data proves causation. Use wording such as "may be helping" or "is consistent with".
11. Never shame the user for poor sleep or an incomplete CBT-I action.
12. Treat "not applicable" differently from "not completed".
13. Do not encourage the user to try harder to fall asleep.
14. Avoid absolute statements such as "you will sleep better tonight."
15. If the night was poor but the user followed a useful behavior, reinforce the behavior rather than focusing only on the sleep result.
16. Write in the language specified by "language".
17. Keep the response concise and conversational.
18. Do not mention that you are an AI.
19. Do not mention CBT-I terminology unnecessarily unless it improves understanding.
20. Return only valid JSON matching the requested output schema.

Use calm, restrained encouragement.
Do not use exaggerated praise.
Do not use exclamation marks unless linguistically necessary.
Prefer recognition of specific behavior over generic praise.
Prioritize reinforcing controllable behaviors over praising sleep outcomes.`;

function buildUserPrompt(payload: string): string {
  return `Create today's Daily Insight from the following sleep-journal data.

Priority:
1. Recognize meaningful progress or a useful behavior.
2. Briefly relate today's result to the 7-day trend.
3. Suggest one realistic behavior to focus on next.

Do not repeat every statistic.
Mention numbers only when they make the insight easier to understand.

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

export interface InsightContext {
  bedtime: Date;
  wakeTime: Date;
  sleepOnsetMinutes: number;
  nightWakeMinutes: number;
  satisfaction: number;
  techniqueIds: string[];
  techniqueResponses: Record<string, TechniqueResponse>;
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
  stats7d: Stats7d;
  ruleEngine: RuleEngineResult;
}

export function buildDailyInsightPayload(ctx: {
  bedtime: Date;
  wakeTime: Date;
  sleepOnsetMinutes: number;
  nightWakeMinutes: number;
  satisfaction: number;
  techniqueIds: string[];
  techniqueResponses: Record<string, TechniqueResponse>;
  records: SleepRecord[];
  language: string;
  t: Translations;
}): DailyInsightPayload {
  const tib = calcTimeInBed(ctx.bedtime, ctx.wakeTime);
  const tst = Math.max(0, tib - ctx.sleepOnsetMinutes - ctx.nightWakeMinutes);
  const eff = calcSleepEfficiency(tib, ctx.sleepOnsetMinutes, ctx.nightWakeMinutes);
  const effRounded = Math.round(eff * 10) / 10;

  const stats = calculate7dStats(ctx.records);

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
    actions: actions.map((a) => ({
      id: a.id,
      category: CATEGORY_FULL[a.category],
      result: RESULT_MAP[a.result],
      label: a.label,
    })),
    stats7d: stats,
    ruleEngine: ruleResult,
  };
}

export async function generateDailyInsight(ctx: InsightContext): Promise<InsightResult> {
  const payload = buildDailyInsightPayload(ctx);

  if (API_BASE) {
    try {
      return await callInsightApi(payload);
    } catch {
      return fallbackInsight(
        payload.today.sleepEfficiencyPct,
        ctx.satisfaction,
        payload.today.timeInBedMin,
        payload.stats7d,
        payload.ruleEngine,
        ctx.t,
      );
    }
  }

  return fallbackInsight(
    payload.today.sleepEfficiencyPct,
    ctx.satisfaction,
    payload.today.timeInBedMin,
    payload.stats7d,
    payload.ruleEngine,
    ctx.t,
  );
}

async function callInsightApi(payload: DailyInsightPayload): Promise<InsightResult> {
  const res = await fetch(`${API_BASE}/insight`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(JSON.stringify(payload, null, 2)),
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return {
    title: data.title ?? '',
    message: data.message ?? '',
    focusActionId: data.focusActionId ?? '',
  };
}

function fallbackInsight(
  efficiency: number,
  satisfaction: number,
  tibMin: number,
  _stats: Stats7d,
  _rules: RuleEngineResult,
  t: Translations,
): InsightResult {
  const lines: string[] = [];

  if (efficiency >= 85) {
    lines.push(t.insightEfficiencyGood);
  } else if (efficiency >= 70) {
    lines.push(t.insightEfficiencyModerate);
  } else {
    lines.push(t.insightEfficiencyLow);
  }

  if (satisfaction >= 4) {
    lines.push(t.insightSatisfactionHigh);
  } else if (satisfaction <= 2) {
    lines.push(t.insightSatisfactionLow);
  }

  if (tibMin / 60 >= 8.5) {
    lines.push(t.insightLongTimeInBed);
  }

  return {
    title: '',
    message: lines.join('\n'),
    focusActionId: '',
  };
}
