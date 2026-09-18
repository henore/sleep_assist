import { en } from '../i18n/locales/en';
import type { InsightContext } from '../services/insightApi';

const ctx: InsightContext = {
  bedtime:new Date('2026-01-02T00:00:00Z'),wakeTime:new Date('2026-01-02T08:00:00Z'),
  sleepOnsetMinutes:10,nightWakeMinutes:10,satisfaction:3,techniqueIds:['SC01'],
  techniqueResponses:{SC01:'done'},records:[],language:'en',t:en,
};
let generate: typeof import('../services/insightApi').generateDailyInsight;
beforeAll(() => {
  const base=process.env.EXPO_PUBLIC_API_BASE;
  process.env.EXPO_PUBLIC_API_BASE='https://example.invalid';
  jest.isolateModules(() => { generate = require('../services/insightApi').generateDailyInsight; });
  if (base === undefined) delete process.env.EXPO_PUBLIC_API_BASE; else process.env.EXPO_PUBLIC_API_BASE=base;
  (globalThis as typeof globalThis & {__DEV__:boolean}).__DEV__=false;
});
afterEach(() => jest.restoreAllMocks());
test('validated API response is openai', async () => {
  jest.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>({title:'Title',message:'Message',focusActionId:'SC01',source:'fallback'})} as Response);
  expect((await generate(ctx)).source).toBe('openai');
});
test.each(['network','http','invalidId','invalidText'])('%s becomes fallback', async mode => {
  const fetch = jest.spyOn(globalThis,'fetch');
  if(mode==='network') fetch.mockRejectedValue(new Error('Offline'));
  else fetch.mockResolvedValue({ok:mode!=='http',status:502,json:async()=>({title:'Title',message:mode==='invalidText'?42:'Message',focusActionId:mode==='invalidId'?'unknown':'SC01'})} as Response);
  expect((await generate(ctx)).source).toBe('fallback');
});
