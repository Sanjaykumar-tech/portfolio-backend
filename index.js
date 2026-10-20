/* =========================================
   SANJAY KUMAR — PORTFOLIO BACKEND
   Node.js + Express + Resend API + MongoDB Auth
   ========================================= */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
   MONGODB CONNECTION & USER MODEL
   ========================================= */
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/portfolio')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

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
   AUTHENTICATION ROUTES (LOGIN / SIGNUP)
   ========================================= */

// 1. SIGNUP
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists. Please login.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ success: true, message: 'Account created successfully!' });

  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// 2. LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET || 'secret_key_123', { expiresIn: '1d' });

    res.status(200).json({ success: true, message: 'Login successful!', token, name: user.name });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

/* =========================================
   MAIN ENDPOINT — POST /send (CONTACT FORM)
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

    // Email to You
    await resend.emails.send({
      from: 'Portfolio Contact <onboarding@resend.dev>',
      to: 'sanjayotherwork@gmail.com', 
      reply_to: safeEmail,
      subject: `📬 New Contact: ${safeSubject}`,
      html: `
        <body style="background-color: #050505; font-family: Arial, sans-serif; padding: 40px 20px; color: #fff;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #0a0a0a; border-radius: 16px; border: 1px solid #1f2937; padding: 32px;">
            <h1 style="color: #00ff88;">📬 New Contact</h1>
            <p><b>Name:</b> ${safeName}</p>
            <p><b>Email:</b> ${safeEmail}</p>
            <p><b>Subject:</b> ${safeSubject}</p>
            <p><b>Message:</b> ${safeMessage}</p>
          </div>
        </body>
      `
    });

    // Auto Reply to Sender
    await resend.emails.send({
      from: 'Sanjay Kumar <onboarding@resend.dev>',
      to: safeEmail,
      subject: `✅ Thanks for reaching out, ${safeName}!`,
      html: `
        <body style="background-color: #050505; font-family: Arial, sans-serif; padding: 40px 20px; color: #fff;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #0a0a0a; border-radius: 16px; border: 1px solid #1f2937; padding: 32px;">
            <h1 style="color: #00ff88;">Hi ${safeName} 👋</h1>
            <p>Thanks for reaching out! I'll reply within 24-48 hours.</p>
            <p><b>Your message:</b></p>
            <blockquote style="border-left: 3px solid #00ff88; padding-left: 16px; color: #aaa;">${safeMessage}</blockquote>
          </div>
        </body>
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