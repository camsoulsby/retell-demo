import Retell from 'retell-sdk';

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
