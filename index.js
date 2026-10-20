/* =========================================
   SANJAY KUMAR — PORTFOLIO BACKEND
   Node.js + Express + Resend API
   ========================================= */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5500;

/* =========================================
   MIDDLEWARE
   ========================================= */
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.set('trust proxy', 1);

// CORS setup
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://sanjaykumar-tech.github.io',
  'https://portfolio-frontend-beta-brown.vercel.app', // Vercel URL
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

/* =========================================
   RATE LIMITING
   ========================================= */
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Too many requests. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/* =========================================
   RESEND SETUP
   ========================================= */
const resend = new Resend(process.env.RESEND_API_KEY);

/* =========================================
   HEALTH CHECK
   ========================================= */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SK Portfolio Backend is running 🚀',
    endpoints: { send: 'POST /send', health: 'GET /health' }
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/* =========================================
   MAIN ENDPOINT — POST /send
   ========================================= */
app.post('/send', contactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'Name, email, and message are required.' });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Name must be at least 2 characters.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (message.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Message must be at least 3 characters.' });
    }

    const sanitize = (str) => String(str).replace(/[<>]/g, '').trim();
    const safeName = sanitize(name);
    const safeEmail = sanitize(email);
    const safeSubject = sanitize(subject || 'General Inquiry');
    const safeMessage = sanitize(message);

    /* =========================================
       PREMIUM DARK TEMPLATE FOR YOU (SANJAY)
       ========================================= */
    await resend.emails.send({
      from: 'Portfolio Contact <onboarding@resend.dev>',
      to: 'sanjayotherwork@gmail.com', // ⚡ UNGA RESEND ACCOUNT EMAIL
      reply_to: safeEmail,
      subject: `📬 New Contact: ${safeSubject}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #050505; font-family: 'Inter', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #050505; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" max-width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #0a0a0a; border-radius: 16px; border: 1px solid #1f2937; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                  
                  <!-- Top Glow Line -->
                  <tr>
                    <td height="4" style="background: linear-gradient(90deg, transparent, #00ff88, transparent);"></td>
                  </tr>

                  <!-- Header -->
                  <tr>
                    <td align="center" style="padding: 30px 20px; background-color: #0f1f18;">
                      <h1 style="margin: 0; color: #00ff88; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                        📬 New Portfolio Contact
                      </h1>
                      <p style="margin: 8px 0 0 0; color: #a1a1aa; font-size: 14px;">
                        Someone just reached out to you
                      </p>
                    </td>
                  </tr>

                  <!-- Body Content -->
                  <tr>
                    <td style="padding: 32px;">
                      
                      <!-- Sender Name -->
                      <div style="margin-bottom: 20px;">
                        <p style="margin: 0 0 6px 0; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Name</p>
                        <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 500;">${safeName}</p>
                      </div>

                      <!-- Sender Email -->
                      <div style="margin-bottom: 20px;">
                        <p style="margin: 0 0 6px 0; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Email</p>
                        <p style="margin: 0; color: #00ff88; font-size: 16px;">
                          <a href="mailto:${safeEmail}" style="color: #00ff88; text-decoration: none;">${safeEmail}</a>
                        </p>
                      </div>

                      <!-- Subject -->
                      <div style="margin-bottom: 20px;">
                        <p style="margin: 0 0 6px 0; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Subject</p>
                        <p style="margin: 0; color: #ffffff; font-size: 16px;">${safeSubject}</p>
                      </div>

                      <!-- Message Box -->
                      <div style="margin-bottom: 10px;">
                        <p style="margin: 0 0 6px 0; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Message</p>
                        <div style="background-color: #111827; border-left: 4px solid #00ff88; border-radius: 8px; padding: 20px; color: #d1d5db; font-size: 15px; line-height: 1.6;">
                          ${safeMessage.replace(/\n/g, '<br>')}
                        </div>
                      </div>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td align="center" style="padding: 20px; background-color: #050505; border-top: 1px solid #1f2937;">
                      <p style="margin: 0; color: #52525b; font-size: 12px;">
                        © ${new Date().getFullYear()} Sanjay Kumar · Portfolio Notification
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    });

    /* =========================================
       PREMIUM AUTO-REPLY TEMPLATE FOR SENDER
       ========================================= */
    await resend.emails.send({
      from: 'Sanjay Kumar <onboarding@resend.dev>',
      to: safeEmail,
      subject: `✅ Thanks for reaching out, ${safeName}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #050505; font-family: 'Inter', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #050505; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" max-width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #0a0a0a; border-radius: 16px; border: 1px solid #1f2937; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                  
                  <!-- Top Glow Line -->
                  <tr>
                    <td height="4" style="background: linear-gradient(90deg, transparent, #00ff88, transparent);"></td>
                  </tr>

                  <!-- Header -->
                  <tr>
                    <td align="center" style="padding: 40px 20px; background-color: #0f1f18;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700;">
                        Hi ${safeName} 👋
                      </h1>
                      <p style="margin: 10px 0 0 0; color: #00ff88; font-size: 15px; font-weight: 500;">
                        Message received successfully
                      </p>
                    </td>
                  </tr>

                  <!-- Body Content -->
                  <tr>
                    <td style="padding: 32px;">
                      <p style="margin: 0 0 16px 0; color: #a1a1aa; font-size: 16px; line-height: 1.6;">
                        Thanks for reaching out! I've received your message and I'll get back to you within <strong style="color: #00ff88;">24–48 hours</strong>.
                      </p>
                      
                      <p style="margin: 0 0 16px 0; color: #a1a1aa; font-size: 16px; line-height: 1.6;">
                        Here's a copy of what you sent me:
                      </p>

                      <!-- Message Box -->
                      <div style="background-color: #111827; border-left: 4px solid #00ff88; border-radius: 8px; padding: 20px; color: #d1d5db; font-size: 15px; line-height: 1.6; font-style: italic; margin-bottom: 32px;">
                        ${safeMessage.replace(/\n/g, '<br>')}
                      </div>

                      <!-- CTA Button -->
                      <div style="text-align: center; margin-bottom: 32px;">
                        <a href="https://portfolio-frontend-beta-brown.vercel.app/" style="display: inline-block; background-color: #00b050; color: #000000; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 8px;">
                          View My Portfolio →
                        </a>
                      </div>

                      <p style="margin: 0; color: #a1a1aa; font-size: 16px; line-height: 1.6;">
                        Talk soon,<br>
                        <strong style="color: #ffffff;">Sanjay Kumar</strong><br>
                        <span style="color: #71717a; font-size: 14px;">Frontend Developer</span>
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td align="center" style="padding: 20px; background-color: #050505; border-top: 1px solid #1f2937;">
                      <p style="margin: 0; color: #52525b; font-size: 12px;">
                        © ${new Date().getFullYear()} Sanjay Kumar · All rights reserved.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    });

    console.log(`✅ Contact from ${safeEmail} (${safeName})`);

    return res.status(200).json({
      success: true,
      message: 'Message sent successfully!'
    });

  } catch (error) {
    console.error('❌ /send error:', error);
    return res.status(500).json({
      success: false,
      error: 'Something went wrong. Please try again.'
    });
  }
});

/* =========================================
   404 HANDLER
   ========================================= */
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found.' });
});

/* =========================================
   START SERVER
   ========================================= */
app.listen(PORT, () => {
  console.log('==========================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log('==========================================');
});

/* =========================================
   GRACEFUL SHUTDOWN
   ========================================= */
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down...');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('\nSIGINT received. Shutting down...');
  process.exit(0);
});