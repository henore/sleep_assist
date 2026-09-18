const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-sol';

export function extractOutputText(response) {
  if (!response || (response.status && response.status !== 'completed') || !Array.isArray(response.output)) return '';
  return response.output
    .filter((item) => item?.type === 'message' && Array.isArray(item.content))
    .flatMap((item) => item.content)
    .filter((part) => part?.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return cors(200, '');
  }

  if (event.httpMethod === 'GET') {
    return cors(200, JSON.stringify({ status: 'ok', model: MODEL }));
  }

  if (event.httpMethod !== 'POST') {
    return cors(405, JSON.stringify({ error: 'Method not allowed' }));
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return cors(400, JSON.stringify({ error: 'Invalid JSON' }));
  }

  const { systemPrompt, userPrompt, promptVersion } = body;
  if (!systemPrompt || !userPrompt) {
    return cors(400, JSON.stringify({ error: 'Missing systemPrompt or userPrompt' }));
  }

  if (!OPENAI_API_KEY) {
    return cors(500, JSON.stringify({ error: 'OPENAI_API_KEY not configured' }));
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: systemPrompt,
        input: userPrompt,
        text: { format: { type: 'json_object' } },
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI API error:', openaiRes.status, errText);
      return cors(502, JSON.stringify({
        error: 'OpenAI API call failed',
        status: openaiRes.status,
      }));
    }

    const openaiData = await openaiRes.json();
    const raw = extractOutputText(openaiData);

    if (typeof raw !== 'string' || !raw) {
      console.error('No usable output_text in OpenAI response');
      return cors(502, JSON.stringify({ error: 'No output_text from model' }));
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error('Failed to parse model output as JSON');
      return cors(502, JSON.stringify({ error: 'Invalid JSON from model' }));
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return cors(502, JSON.stringify({ error: 'Invalid JSON object from model' }));
    }
    const title = parsed.title;
    const message = parsed.message;
    const focusActionId = parsed.focusActionId;

    if (typeof title !== 'string' || !title.trim()) {
      return cors(502, JSON.stringify({ error: 'Missing title in model response' }));
    }
    if (typeof message !== 'string' || !message.trim()) {
      return cors(502, JSON.stringify({ error: 'Missing message in model response' }));
    }
    if (typeof focusActionId !== 'string' || !focusActionId.trim()) {
      return cors(502, JSON.stringify({ error: 'Missing focusActionId in model response' }));
    }

    const result = {
      title,
      message,
      focusActionId,
      model: MODEL,
      promptVersion: promptVersion ?? 'unknown',
    };

    console.log(JSON.stringify({
      event: 'daily_insight_generated',
      model: MODEL,
      promptVersion: result.promptVersion,
      focusActionId: result.focusActionId,
      titleLength: title.length,
      messageLength: message.length,
    }));

    return cors(200, JSON.stringify(result));
  } catch (err) {
    console.error('Unexpected error:', err);
    return cors(502, JSON.stringify({
      error: 'OpenAI API call failed',
      detail: err.message,
    }));
  }
}

function cors(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body,
  };
}
