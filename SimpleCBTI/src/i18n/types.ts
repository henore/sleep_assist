import moreEnglish from './more/en.json';

export interface Translations {
  validationTechnique: string;
  validationMinutes: string;
  validationSatisfaction: string;
  moreCopy: typeof moreEnglish;
  invalidDate: string;
  invalidTime: string;
  tapToEdit: string;
  storageLoadError: string;
  storageOperationError: string;
  confirmAction: string;
  // Tabs
  tabDailyInsight: string;
  tabHistory: string;
  tabStats: string;
  tabMore: string;

  // Header
  headerDailyInsight: string;
  dailyInsightCardTitle: string;
  dailyInsightAttribution: string;
  dailyInsightGenerating: string;

  // Idle
  bedtime: string;
  longPressBedtime: string;

  // Sleeping
  bedtimeRecorded: string;
  wakeUp: string;
  longPressWakeUp: string;
  wakeUpRecorded: string;

  // Check-in
  morningCheckIn: string;
  sleepOnsetLabel: string;
  nightWakeLabel: string;
  minutes: string;
  satisfactionLabel: string;
  memoLabel: string;
  memoPlaceholder: string;
  todaysTechniques: string;
  tapCompleted: string;
  submitCheckIn: string;

  // Encouragement
  encouragement1: string;
  encouragement2: string;
  encouragement3: string;
  encouragement4: string;

  // Completed
  appSubtitle: string;
  today: string;
  wakeTime: string;
  asleep: string;
  inBed: string;
  sleepEfficiency: string;
  todaysInsight: string;
  tapToShowAll: string;

  // Detail modal
  todaysDetail: string;
  detailBedtime: string;
  detailWakeUp: string;
  detailTimeInBed: string;
  detailEfficiency: string;
  detailSatisfaction: string;
  close: string;
  deleteRecord: string;
  deleteConfirm: string;

  // Session action area
  readyForTonight: string;
  sleepSessionActive: string;
  inBedFor: string;

  // History
  historySubtitle: string;
  historyEmpty: string;
  historyDetail: string;
  dailyInsightSaved: string;
  timeInBedLabel: string;
  detailSleepOnset: string;
  detailNightWake: string;
  detailMemo: string;
  detailTechniques: string;
  detailInsight: string;
  detailTotalSleep: string;
  noMemo: string;

  // Stats
  statsEmpty: string;
  weeklyAverages: string;
  sleepTime: string;
  timeToFallAsleep: string;
  vsPreviousWeek: string;
  sleepByDay: string;
  sleepEfficiencyTrend: string;
  vsLastWeek: string;
  statsDuration: string;
  statsEfficiency: string;
  statsAvgSleep: string;
  statsAvgEfficiency: string;
  statsActualSleep: string;
  statsSleepOnset: string;
  statsNightWake: string;
  statsThisWeek: string;
  statsLastWeek: string;
  statsProTitle: string;
  statsProDesc: string;

  // Pro / Free gating
  proTrialDays: string;
  upgradeButton: string;
  insightProOnly: string;
  historyLimited: string;
  trialEndTitle: string;
  trialEndBody: string;
  trialEndCta: string;
  continueButton: string;

  // Placeholder screens
  historyPlaceholder: string;
  statsPlaceholder: string;

  // Technique categories
  techCatMR: string;
  techCatCR: string;
  techCatSC: string;
  techCatSR: string;

  // Technique responses
  techResponseDone: string;
  techResponseNA: string;
  techResponseFailed: string;

  // Techniques — Mindfulness / Relaxation
  techMR01: string;
  techMR02: string;
  techMR03: string;
  techMR04: string;
  techMR05: string;

  // Techniques — Cognitive Restructuring
  techCR01: string;
  techCR02: string;
  techCR03: string;
  techCR04: string;
  techCR05: string;
  techCR06: string;
  techCR07: string;
  techCR08: string;
  techCR09: string;
  techCR10: string;
  techCR11: string;
  techCR12: string;
  techCR13: string;
  techCR14: string;
  techCR15: string;

  // Techniques — Stimulus Control
  techSC01: string;
  techSC02: string;
  techSC03: string;
  techSC04: string;
  techSC05: string;
  techSC06: string;
  techSC07: string;
  techSC08: string;
  techSC09: string;
  techSC10: string;
  techSC11: string;
  techSC12: string;
  techSC13: string;
  techSC14: string;

  // Techniques — Sleep Restriction
  techSR01: string;
  techSR02: string;
  techSR03: string;
  techSR04: string;
  techSR05: string;
  techSR06: string;
  techSR07: string;
  techSR08: string;
  techSR09: string;
  techSR10: string;
  techSR11: string;
  techSR12: string;

  // More tab
  back: string;
  moreFreeVsPro: string;
  moreHowToUse: string;
  moreCBTIGuide: string;
  morePrivacy: string;
  moreTerms: string;
  moreRestorePurchases: string;
  moreManageSubscription: string;
  moreAbout: string;
  moreLanguage: string;
  moreBackup: string;
  moreBackupDesc: string;
  moreImport: string;
  moreImportDesc: string;
  backupWarning: string;
  backupCreated: string;
  backupFailed: string;
  importInvalid: string;
  importConfirm: string;
  importPeriod: string;
  importRecordCount: string;
  importInsightCount: string;
  importButton: string;
  importCancel: string;
  importSuccess: string;
  importFailed: string;
  importVersionError: string;
  proCardDesc: string;
  proCardActive: string;
  proCardViewPlans: string;

  // Insights (rule engine placeholders)
  insightEfficiencyGood: string;
  insightEfficiencyModerate: string;
  insightEfficiencyLow: string;
  insightSatisfactionHigh: string;
  insightSatisfactionLow: string;
  insightLongTimeInBed: string;
  insightFocusSuggestion: string;

  // Insight translation
  translateInsight: string;
  translating: string;
  translateFailed: string;
}

export type TranslationKey = Exclude<keyof Translations, 'moreCopy'>;

export type SupportedLocale =
  | 'en' | 'ja' | 'zh-Hans' | 'zh-Hant'
  | 'ko' | 'es' | 'fr' | 'de'
  | 'pt' | 'it' | 'ru' | 'ar'
  | 'hi' | 'th' | 'vi' | 'id';
