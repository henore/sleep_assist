import test from 'node:test';
import assert from 'node:assert/strict';
process.env.OPENAI_API_KEY = 'test-only';
const { handler, extractOutputText } = await import('./index.mjs');
const valid = { title: 'Title', message: 'Message', focusActionId: 'SC01' };
const message = (text) => ({ type: 'message', content: [{ type: 'output_text', text }] });

test('finds text after reasoning/tool items, ignores malformed items and aggregates text parts', () => {
  assert.equal(extractOutputText({output:[null,{type:'reasoning'}, {type:'function_call'},
    {type:'message', content:null}, {type:'message',content:[null,{type:'refusal'}, {type:'output_text',text:42}, {type:'output_text',text:'first'}]},message('second')]}), 'firstsecond');
});
test('no SDK helper fallback, no text, failed or incomplete response returns no text', () => {
  for (const value of [null, {}, {output_text:'SDK helper'}, {output:{}},
    {status:'incomplete',output:[message('partial')]},{status:'failed',output:[message('text')]}]) {
    assert.equal(extractOutputText(value),'');
  }
});
test('handler parses Responses output and preserves field validation', async () => {
  const original = globalThis.fetch;
  const error = console.error, log = console.log;
  console.error = () => {}; console.log = () => {};
  try {
    const cases = [
      [{status:'completed',output:[{type:'reasoning'},message(JSON.stringify(valid))]},200],
      [{output:[message('{bad json')]},502],
      [{output:[message('null')]},502],
      [{output:[message('[]')]},502],
      [{output:[]},502],
      ...['title','message','focusActionId'].flatMap(key => [null,42,'',' '].map(value => [{output:[message(JSON.stringify({...valid,[key]:value}))]},502])),
    ];
    for (const [body, status] of cases) {
      globalThis.fetch = async () => ({ok:true,json:async()=>body});
      const result = await handler({httpMethod:'POST',body:JSON.stringify({systemPrompt:'JSON',userPrompt:'Test',promptVersion:'v2'})});
      assert.equal(result.statusCode,status);
      if (status===200) assert.deepEqual(JSON.parse(result.body), {...valid,model:process.env.OPENAI_MODEL || 'gpt-5.6-sol',promptVersion:'v2'});
    }
  } finally { globalThis.fetch=original; console.error=error; console.log=log; }
});
