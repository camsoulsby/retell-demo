import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { rateLimit } from 'express-rate-limit';
import Retell from 'retell-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });

// In-memory rate limit state (resets on redeploy)
const phoneCallCounts = new Map();
let globalDailyCount = 0;
let globalResetAt = Date.now() + 24 * 60 * 60 * 1000;

const GLOBAL_DAILY_LIMIT = 50;
const PHONE_DAILY_LIMIT = 5;

function resetIfNeeded() {
  if (Date.now() > globalResetAt) {
    globalDailyCount = 0;
    globalResetAt = Date.now() + 24 * 60 * 60 * 1000;
    phoneCallCounts.clear();
  }
}

app.use(cors());
app.use(express.json());

// IP-based rate limit: 10 calls per 24 hours
const ipLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many calls from this IP. Please try again tomorrow.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/start-call', ipLimiter, async (req, res) => {
  const { name, phone } = req.body;

  if (!name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Name and phone number are required.' });
  }

  resetIfNeeded();

  if (globalDailyCount >= GLOBAL_DAILY_LIMIT) {
    return res.status(429).json({ error: 'Daily demo limit reached. Please try again tomorrow.' });
  }

  const phoneData = phoneCallCounts.get(phone) || { count: 0 };
  if (phoneData.count >= PHONE_DAILY_LIMIT) {
    return res.status(429).json({ error: 'This phone number has reached its daily call limit.' });
  }

  try {
    const webCallResponse = await retell.call.createWebCall({
      agent_id: process.env.RETELL_AGENT_ID,
      retell_llm_dynamic_variables: {
        name: name.trim(),
        phone_number: phone.trim(),
      },
    });

    globalDailyCount++;
    phoneCallCounts.set(phone, { count: phoneData.count + 1 });

    res.json({ accessToken: webCallResponse.access_token });
  } catch (err) {
    console.error('Retell API error:', err);
    res.status(500).json({ error: 'Failed to start call. Please try again.' });
  }
});

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
