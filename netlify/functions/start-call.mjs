import Retell from 'retell-sdk';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let name, phone;
  try {
    ({ name, phone } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  if (!name?.trim() || !phone?.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Name and phone number are required.' }) };
  }

  const ip = event.headers['x-nf-client-connection-ip'] ?? 'unknown';

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    const DAY = '24 h';
    const ipLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(2, DAY), prefix: 'rl:ip' });
    const phoneLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(2, DAY), prefix: 'rl:phone' });
    const globalLimiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(50, DAY), prefix: 'rl:global' });

    const [ipResult, phoneResult, globalResult] = await Promise.all([
      ipLimiter.limit(ip),
      phoneLimiter.limit(phone.trim()),
      globalLimiter.limit('global'),
    ]);

    if (!globalResult.success) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Daily demo limit reached. Please try again tomorrow.' }) };
    }
    if (!ipResult.success) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Too many calls from this IP. Please try again tomorrow.' }) };
    }
    if (!phoneResult.success) {
      return { statusCode: 429, body: JSON.stringify({ error: 'This phone number has reached its daily call limit.' }) };
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Rate limit error', detail: err.message }) };
  }

  try {
    const webCallResponse = await retell.call.createWebCall({
      agent_id: process.env.RETELL_AGENT_ID,
      retell_llm_dynamic_variables: {
        name: name.trim(),
        phone_number: phone.trim(),
      },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: webCallResponse.access_token }),
    };
  } catch (err) {
    console.error('Retell API error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to start call. Please try again.' }) };
  }
};
