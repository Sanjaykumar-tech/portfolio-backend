/* =========================================
   SANJAY KUMAR — PORTFOLIO BACKEND
   Node.js + Express + Nodemailer (CommonJS)
   ========================================= */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5500;

/* =========================================
   MIDDLEWARE
   ========================================= */
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// CORS setup
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://sanjaykumar-tech.github.io',
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
  max: 5,
  message: {
    success: false,
    error: 'Too many requests. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/* =========================================
   NODEMAILER TRANSPORTER
   ========================================= */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter error:', error.message);
  } else {
    console.log('✅ Email transporter ready');
  }
});

/* =========================================
   HEALTH CHECK
   ========================================= */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SK Portfolio Backend is running 🚀',
    endpoints: {
      send: 'POST /send',
      health: 'GET /health'
    }
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
      return res.status(400).json({
        success: false,
        error: 'Name, email, and message are required.'
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Name must be at least 2 characters.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (message.trim().length < 10) {
      return res.status(400).json({ success: false, error: 'Message must be at least 10 characters.' });
    }

    const sanitize = (str) => String(str).replace(/[<>]/g, '').trim();
    const safeName = sanitize(name);
    const safeEmail = sanitize(email);
    const safeSubject = sanitize(subject || 'General Inquiry');
    const safeMessage = sanitize(message);

    const mailToYou = {
      from: `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: safeEmail,
      subject: `📬 New Contact: ${safeSubject}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #00b050, #00ff88); color: #000; padding: 24px; text-align: center;">
              <h1 style="margin: 0;">📬 New Portfolio Contact</h1>
            </div>
            <div style="padding: 32px 24px; color: #333;">
              <p><b>Name:</b> ${safeName}</p>
              <p><b>Email:</b> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
              <p><b>Subject:</b> ${safeSubject}</p>
              <p><b>Message:</b></p>
              <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border-left: 4px solid #00ff88;">
                ${safeMessage.replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const mailToSender = {
      from: `"Sanjay Kumar" <${process.env.EMAIL_USER}>`,
      to: safeEmail,
      subject: `✅ Thanks for reaching out, ${safeName}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #00b050, #00ff88); color: #000; padding: 32px; text-align: center;">
              <h1 style="margin: 0;">Hi ${safeName} 👋</h1>
            </div>
            <div style="padding: 32px; color: #333; line-height: 1.7;">
              <p>Thanks for reaching out! I'll get back to you within <b>24–48 hours</b>.</p>
              <p><b>Your message:</b></p>
              <blockquote style="border-left: 3px solid #00ff88; padding-left: 16px; color: #666;">
                ${safeMessage.replace(/\n/g, '<br>')}
              </blockquote>
              <p>Talk soon,<br><b>Sanjay Kumar</b></p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await Promise.all([
      transporter.sendMail(mailToYou),
      transporter.sendMail(mailToSender)
    ]);

    console.log(`✅ Contact from ${safeEmail} (${safeName})`);

    return res.status(200).json({
      success: true,
      message: 'Message sent successfully!'
    });

  } catch (error) {
    console.error('❌ /send error:', error);

    if (error.code === 'EAUTH') {
      return res.status(500).json({
        success: false,
        error: 'Email authentication failed. Check server credentials.'
      });
    }

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