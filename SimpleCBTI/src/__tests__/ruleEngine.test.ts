import { calcSleepEfficiency } from '../utils/time';
import { calculate7dStats } from '../services/statsCalculator';
import { evaluateSleepSession, POSITIVE_SIGNALS, ATTENTION_SIGNALS, computeQuestionWeights } from '../services/ruleEngine';
import { selectDailyQuestions, TECHNIQUE_DEFS } from '../constants/techniques';
import { buildDailyInsightPayload } from '../services/insightApi';
import { SleepRecord, Stats7d, QuestionWeights } from '../types/sleep';

// --- helpers ---

function makeRecord(overrides: Partial<SleepRecord> & { date: string }): SleepRecord {
  return {
    bedtime: null,
    wakeTime: null,
    sleepOnsetMinutes: null,
    nightWakeMinutes: null,
    satisfaction: null,
    memo: '',
    techniques: [],
    techniqueResponses: {},
    insight: '',
    insightTitle: '',
    insightFocusId: '',
    ...overrides,
  };
}

function makeCompleteRecord(date: string, opts: {
  bedHour?: number;
  wakeHour?: number;
  onset?: number;
  waso?: number;
  satisfaction?: number;
} = {}): SleepRecord {
  const { bedHour = 23, wakeHour = 7, onset = 15, waso = 10, satisfaction = 3 } = opts;
  const bed = new Date(`${date}T${bedHour.toString().padStart(2, '0')}:00:00`);
  const wake = new Date(`${date}T${wakeHour.toString().padStart(2, '0')}:00:00`);
  if (wake <= bed) wake.setDate(wake.getDate() + 1);
  return makeRecord({
    date,
    bedtime: bed.toISOString(),
    wakeTime: wake.toISOString(),
    sleepOnsetMinutes: onset,
    nightWakeMinutes: waso,
    satisfaction,
  });
}

function emptyStats(): Stats7d {
  return {
    daysRecorded: 0,
    avgTotalSleepTimeMin: 0,
    avgTimeInBedMin: 0,
    avgSleepEfficiencyPct: 0,
    avgSleepOnsetLatencyMin: 0,
    avgWakeAfterSleepOnsetMin: 0,
    avgSatisfaction: 0,
    sleepEfficiencyTrend: 'insufficient_data',
    sleepOnsetTrend: 'insufficient_data',
    wakeAfterSleepOnsetTrend: 'insufficient_data',
    sleepDurationTrend: 'insufficient_data',
    wakeTimeConsistency: 'moderate',
  };
}

function goodStats(): Stats7d {
  return {
    daysRecorded: 7,
    avgTotalSleepTimeMin: 390,
    avgTimeInBedMin: 450,
    avgSleepEfficiencyPct: 82,
    avgSleepOnsetLatencyMin: 20,
    avgWakeAfterSleepOnsetMin: 15,
    avgSatisfaction: 3.5,
    sleepEfficiencyTrend: 'improving',
    sleepOnsetTrend: 'improving',
    wakeAfterSleepOnsetTrend: 'stable',
    sleepDurationTrend: 'stable',
    wakeTimeConsistency: 'good',
  };
}

// ====== 1. Sleep efficiency calculation ======

describe('calcSleepEfficiency', () => {
  test('normal calculation', () => {
    const eff = calcSleepEfficiency(480, 20, 10);
    expect(eff).toBe(94);
  });

  test('zero time in bed returns 0', () => {
    expect(calcSleepEfficiency(0, 0, 0)).toBe(0);
  });

  test('negative time in bed returns 0', () => {
    expect(calcSleepEfficiency(-10, 0, 0)).toBe(0);
  });

  test('clamps to 0 when onset+waso exceeds TIB', () => {
    expect(calcSleepEfficiency(60, 40, 30)).toBe(0);
  });

  test('clamps to max 100', () => {
    expect(calcSleepEfficiency(480, 0, 0)).toBe(100);
  });
});

// ====== 2. Insufficient data handling ======

describe('calculate7dStats — insufficient data', () => {
  test('empty records return insufficient_data trends', () => {
    const stats = calculate7dStats([]);
    expect(stats.daysRecorded).toBe(0);
    expect(stats.sleepEfficiencyTrend).toBe('insufficient_data');
    expect(stats.sleepOnsetTrend).toBe('insufficient_data');
    expect(stats.wakeAfterSleepOnsetTrend).toBe('insufficient_data');
    expect(stats.sleepDurationTrend).toBe('insufficient_data');
  });

  test('fewer than 4 records return insufficient_data trends', () => {
    const now = new Date();
    const records = [0, 1, 2].map((i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      return makeCompleteRecord(key);
    });
    const stats = calculate7dStats(records);
    expect(stats.daysRecorded).toBe(3);
    expect(stats.sleepEfficiencyTrend).toBe('insufficient_data');
  });
});

// ====== 3. Efficiency improving ======

describe('ruleEngine — efficiency improving', () => {
  test('detects efficiency above 7d average', () => {
    const stats = goodStats();
    stats.avgSleepEfficiencyPct = 80;
    const result = evaluateSleepSession(
      { sleepEfficiencyPct: 90, sleepOnsetMin: 10, wasoMin: 5, satisfaction: 4 },
      [],
      stats,
    );
    expect(result.positiveSignals).toContain(POSITIVE_SIGNALS.EFFICIENCY_ABOVE_AVG);
  });

  test('does NOT flag small efficiency difference (< 3%)', () => {
    const stats = goodStats();
    stats.avgSleepEfficiencyPct = 85;
    const result = evaluateSleepSession(
      { sleepEfficiencyPct: 87, sleepOnsetMin: 10, wasoMin: 5, satisfaction: 4 },
      [],
      stats,
    );
    expect(result.positiveSignals).not.toContain(POSITIVE_SIGNALS.EFFICIENCY_ABOVE_AVG);
  });

  test('trend improving signal', () => {
    const stats = goodStats();
    const result = evaluateSleepSession(
      { sleepEfficiencyPct: 85, sleepOnsetMin: 10, wasoMin: 5, satisfaction: 3 },
      [],
      stats,
    );
    expect(result.positiveSignals).toContain(POSITIVE_SIGNALS.EFFICIENCY_IMPROVING);
  });
});

// ====== 4. Sleep onset worsening ======

describe('ruleEngine — sleep onset issues', () => {
  test('long onset attention signal', () => {
    const stats = goodStats();
    const result = evaluateSleepSession(
      { sleepEfficiencyPct: 80, sleepOnsetMin: 35, wasoMin: 5, satisfaction: 3 },
      [],
      stats,
    );
    expect(result.attentionSignals).toContain(ATTENTION_SIGNALS.ONSET_LONG);
  });

  test('onset longer than usual', () => {
    const stats = goodStats();
    stats.avgSleepOnsetLatencyMin = 15;
    const result = evaluateSleepSession(
      { sleepEfficiencyPct: 80, sleepOnsetMin: 28, wasoMin: 5, satisfaction: 3 },
      [],
      stats,
    );
    expect(result.attentionSignals).toContain(ATTENTION_SIGNALS.ONSET_LONGER_THAN_USUAL);
  });

  test('focus becomes stimulus_control on long onset', () => {
    const stats = goodStats();
    stats.wakeTimeConsistency = 'moderate';
    const result = evaluateSleepSession(
      { sleepEfficiencyPct: 80, sleepOnsetMin: 40, wasoMin: 5, satisfaction: 3 },
      [],
      stats,
    );
    expect(result.recommendedFocus).toBe('stimulus_control');
  });
});

// ====== 5. WASO increase ======

describe('ruleEngine — WASO issues', () => {
  test('high WASO attention signal', () => {
    const stats = goodStats();
    const result = evaluateSleepSession(
      { sleepEfficiencyPct: 75, sleepOnsetMin: 10, wasoMin: 40, satisfaction: 2 },
      [],
      stats,
    );
    expect(result.attentionSignals).toContain(ATTENTION_SIGNALS.WASO_HIGH);
  });

  test('WASO higher than usual', () => {
    const stats = goodStats();
    stats.avgWakeAfterSleepOnsetMin = 15;
    const result = evaluateSleepSession(
      { sleepEfficiencyPct: 78, sleepOnsetMin: 10, wasoMin: 30, satisfaction: 3 },
      [],
      stats,
    );
    expect(result.attentionSignals).toContain(ATTENTION_SIGNALS.WASO_HIGHER_THAN_USUAL);
  });
});

// ====== 6. Wake time inconsistency ======

describe('ruleEngine — wake time inconsistency', () => {
  test('wake_time_inconsistent signal', () => {
    const stats = goodStats();
    stats.wakeTimeConsistency = 'poor';
    const result = evaluateSleepSession(
      { sleepEfficiencyPct: 85, sleepOnsetMin: 10, wasoMin: 5, satisfaction: 3 },
      [],
      stats,
    );
    expect(result.attentionSignals).toContain(ATTENTION_SIGNALS.WAKE_TIME_INCONSISTENT);
    expect(result.recommendedFocus).toBe('sleep_restriction');
  });
});

// ====== 7. Good efficiency + low satisfaction ======

describe('ruleEngine — low satisfaction despite good efficiency', () => {
  test('detects cognitive restructuring need', () => {
    const stats = goodStats();
    stats.wakeTimeConsistency = 'good';
    const result = evaluateSleepSession(
      { sleepEfficiencyPct: 90, sleepOnsetMin: 5, wasoMin: 3, satisfaction: 1 },
      [],
      stats,
    );
    expect(result.attentionSignals).toContain(ATTENTION_SIGNALS.LOW_SATISFACTION_GOOD_EFFICIENCY);
    expect(result.recommendedFocus).toBe('cognitive_restructuring');
  });
});

// ====== 8. Action done ======

describe('ruleEngine — action done', () => {
  test('done action → positive signal', () => {
    const stats = goodStats();
    const result = evaluateSleepSession(
      { sleepEfficiencyPct: 85, sleepOnsetMin: 10, wasoMin: 5, satisfaction: 3 },
      [{ id: 'SC01', category: 'SC', result: 'done' }],
      stats,
    );
    expect(result.positiveSignals).toContain('stimulus_control_completed');
  });
});

// ====== 9. Action not_done ======

describe('ruleEngine — action not_done', () => {
  test('failed action → attention signal', () => {
    const stats = goodStats();
    const result = evaluateSleepSession(
      { sleepEfficiencyPct: 85, sleepOnsetMin: 10, wasoMin: 5, satisfaction: 3 },
      [{ id: 'SR01', category: 'SR', result: 'failed' }],
      stats,
    );
    expect(result.attentionSignals).toContain('sleep_restriction_not_completed');
  });
});

// ====== 10. not_applicable NOT treated as failure ======

describe('ruleEngine — not_applicable handling', () => {
  test('na does NOT appear in attention signals', () => {
    const stats = goodStats();
    const result = evaluateSleepSession(
      { sleepEfficiencyPct: 85, sleepOnsetMin: 10, wasoMin: 5, satisfaction: 3 },
      [
        { id: 'SC03', category: 'SC', result: 'na' },
        { id: 'CR01', category: 'CR', result: 'na' },
      ],
      stats,
    );
    expect(result.attentionSignals).not.toContain('stimulus_control_not_completed');
    expect(result.attentionSignals).not.toContain('cognitive_restructuring_not_completed');
    expect(result.positiveSignals).not.toContain('stimulus_control_completed');
  });
});

// ====== 11. Question weight changes ======

describe('questionWeights', () => {
  test('base weights returned for normal data', () => {
    const stats = goodStats();
    stats.wakeTimeConsistency = 'good';
    const w = computeQuestionWeights(
      { sleepEfficiencyPct: 85, sleepOnsetMin: 10, wasoMin: 5, satisfaction: 3 },
      stats,
    );
    expect(w.sleep_restriction).toBe(30);
    expect(w.stimulus_control).toBe(30);
    expect(w.cognitive_restructuring).toBe(30);
    expect(w.mindfulness).toBe(10);
  });

  test('wake time inconsistent boosts SR', () => {
    const stats = goodStats();
    stats.wakeTimeConsistency = 'poor';
    const w = computeQuestionWeights(
      { sleepEfficiencyPct: 85, sleepOnsetMin: 10, wasoMin: 5, satisfaction: 3 },
      stats,
    );
    expect(w.sleep_restriction).toBe(55);
  });

  test('long onset boosts SC', () => {
    const stats = goodStats();
    const w = computeQuestionWeights(
      { sleepEfficiencyPct: 80, sleepOnsetMin: 35, wasoMin: 5, satisfaction: 3 },
      stats,
    );
    expect(w.stimulus_control).toBe(55);
  });

  test('good efficiency + low satisfaction boosts CR', () => {
    const stats = goodStats();
    const w = computeQuestionWeights(
      { sleepEfficiencyPct: 90, sleepOnsetMin: 10, wasoMin: 5, satisfaction: 2 },
      stats,
    );
    expect(w.cognitive_restructuring).toBe(55);
  });

  test('weights capped at 70', () => {
    const stats = goodStats();
    stats.wakeTimeConsistency = 'poor';
    stats.avgSleepOnsetLatencyMin = 5;
    const w = computeQuestionWeights(
      { sleepEfficiencyPct: 90, sleepOnsetMin: 40, wasoMin: 40, satisfaction: 1 },
      stats,
    );
    expect(w.stimulus_control).toBeLessThanOrEqual(70);
  });
});

// ====== 12. Recently shown questions excluded ======

describe('selectDailyQuestions — cooldown', () => {
  test('excludes recently shown IDs', () => {
    const recentlyShown = new Set(['SC01', 'SC02', 'CR01', 'CR02', 'SR01', 'SR02', 'MR01']);
    const weights: QuestionWeights = {
      sleep_restriction: 30,
      stimulus_control: 30,
      cognitive_restructuring: 30,
      mindfulness: 10,
    };
    const result = selectDailyQuestions({
      questionWeights: weights,
      recentlyShownIds: recentlyShown,
      stats: goodStats(),
    });
    for (const id of result) {
      expect(recentlyShown.has(id)).toBe(false);
    }
  });
});

// ====== 13. Exactly 3 questions selected ======

describe('selectDailyQuestions — count', () => {
  test('selects exactly 3', () => {
    const weights: QuestionWeights = {
      sleep_restriction: 30,
      stimulus_control: 30,
      cognitive_restructuring: 30,
      mindfulness: 10,
    };
    const result = selectDailyQuestions({
      questionWeights: weights,
      recentlyShownIds: new Set(),
      stats: goodStats(),
    });
    expect(result.length).toBe(3);
  });

  test('all selected IDs exist in TECHNIQUE_DEFS', () => {
    const weights: QuestionWeights = {
      sleep_restriction: 30,
      stimulus_control: 30,
      cognitive_restructuring: 30,
      mindfulness: 10,
    };
    const result = selectDailyQuestions({
      questionWeights: weights,
      recentlyShownIds: new Set(),
      stats: goodStats(),
    });
    const allIds = TECHNIQUE_DEFS.map((t) => t.id);
    for (const id of result) {
      expect(allIds).toContain(id);
    }
  });

  test('no duplicates', () => {
    const weights: QuestionWeights = {
      sleep_restriction: 30,
      stimulus_control: 30,
      cognitive_restructuring: 30,
      mindfulness: 10,
    };
    for (let i = 0; i < 20; i++) {
      const result = selectDailyQuestions({
        questionWeights: weights,
        recentlyShownIds: new Set(),
        stats: goodStats(),
      });
      expect(new Set(result).size).toBe(result.length);
    }
  });
});

// ====== 14. AI payload does NOT contain memo ======

describe('buildDailyInsightPayload — memo excluded', () => {
  test('payload has no memo field', () => {
    const dummyT = new Proxy({} as any, { get: (_, key) => String(key) });
    const payload = buildDailyInsightPayload({
      bedtime: new Date('2025-01-10T23:00:00'),
      wakeTime: new Date('2025-01-11T07:00:00'),
      sleepOnsetMinutes: 20,
      nightWakeMinutes: 10,
      satisfaction: 3,
      techniqueIds: ['SC01'],
      techniqueResponses: { SC01: 'done' },
      records: [],
      language: 'ja',
      t: dummyT,
    });
    const json = JSON.stringify(payload);
    expect(json).not.toContain('"memo"');
  });
});

// ====== Additional: maintenance focus when nothing wrong ======

describe('ruleEngine — maintenance focus', () => {
  test('returns maintenance when no issues', () => {
    const stats = goodStats();
    stats.wakeTimeConsistency = 'good';
    const result = evaluateSleepSession(
      { sleepEfficiencyPct: 88, sleepOnsetMin: 10, wasoMin: 5, satisfaction: 4 },
      [{ id: 'SC01', category: 'SC', result: 'done' }],
      stats,
    );
    expect(result.recommendedFocus).toBe('maintenance');
  });
});

// ====== Additional: eligibility filtering ======

describe('selectDailyQuestions — eligibility', () => {
  test('SC03/SC04 excluded when avg onset is very low', () => {
    const stats = goodStats();
    stats.avgSleepOnsetLatencyMin = 5;
    const weights: QuestionWeights = {
      sleep_restriction: 0,
      stimulus_control: 100,
      cognitive_restructuring: 0,
      mindfulness: 0,
    };
    for (let i = 0; i < 30; i++) {
      const result = selectDailyQuestions({
        questionWeights: weights,
        recentlyShownIds: new Set(),
        stats,
      });
      expect(result).not.toContain('SC03');
      expect(result).not.toContain('SC04');
    }
  });

  test('SC05 excluded when avg WASO is very low', () => {
    const stats = goodStats();
    stats.avgWakeAfterSleepOnsetMin = 3;
    const weights: QuestionWeights = {
      sleep_restriction: 0,
      stimulus_control: 100,
      cognitive_restructuring: 0,
      mindfulness: 0,
    };
    for (let i = 0; i < 30; i++) {
      const result = selectDailyQuestions({
        questionWeights: weights,
        recentlyShownIds: new Set(),
        stats,
      });
      expect(result).not.toContain('SC05');
    }
  });
});
