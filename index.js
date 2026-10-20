/* =========================================
   SANJAY KUMAR — PORTFOLIO BACKEND
   Node.js + Express + Resend + MongoDB + Passport Auth
   ========================================= */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

const app = express();
const PORT = process.env.PORT || 5500;

/* =========================================
   MIDDLEWARE
   ========================================= */
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.set('trust proxy', 1);

// Session (Passport ku thevai)
app.use(session({
  secret: process.env.SESSION_SECRET || 'sk_portfolio_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' } 
}));

app.use(passport.initialize());
app.use(passport.session());

// CORS setup
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://portfolio-frontend-beta-brown.vercel.app',
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
  message: { success: false, error: 'Too many requests.' },
  standardHeaders: true,
  legacyHeaders: false
});

/* =========================================
   DATABASE & USER MODEL
   ========================================= */
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/portfolio')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Local login ku mattum
  googleId: { type: String },
  githubId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

/* =========================================
   PASSPORT CONFIGURATION
   ========================================= */
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ email: profile.emails[0].value });
      if (user) {
        if (!user.googleId) {
          user.googleId = profile.id;
          await user.save();
        }
        return done(null, user);
      }
      user = await User.create({
        name: profile.displayName,
        email: profile.emails[0].value,
        googleId: profile.id
      });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
));

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "/api/auth/github/callback",
    scope: ['user:email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : `${profile.username}@github.com`;
      let user = await User.findOne({ email });
      if (user) {
        if (!user.githubId) {
          user.githubId = profile.id;
          await user.save();
        }
        return done(null, user);
      }
      user = await User.create({
        name: profile.displayName || profile.username,
        email: email,
        githubId: profile.id
      });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

/* =========================================
   RESEND SETUP
   ========================================= */
const resend = new Resend(process.env.RESEND_API_KEY);

/* =========================================
   AUTHENTICATION ROUTES (LOGIN / SIGNUP)
   ========================================= */

// 1. LOCAL SIGNUP
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'User already exists.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ success: true, message: 'Account created!' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. LOCAL LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.password) return res.status(400).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET || 'secret_key_123', { expiresIn: '1d' });
    res.status(200).json({ success: true, token, name: user.name });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. GOOGLE AUTH ROUTES
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/api/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/login.html?error=auth_failed` }),
  (req, res) => {
    const token = jwt.sign({ _id: req.user._id }, process.env.JWT_SECRET || 'secret_key_123', { expiresIn: '1d' });
    res.redirect(`${process.env.FRONTEND_URL}/login.html?token=${token}&name=${req.user.name}`);
  }
);

// 4. GITHUB AUTH ROUTES
app.get('/api/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/api/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: `${process.env.FRONTEND_URL}/login.html?error=auth_failed` }),
  (req, res) => {
    const token = jwt.sign({ _id: req.user._id }, process.env.JWT_SECRET || 'secret_key_123', { expiresIn: '1d' });
    res.redirect(`${process.env.FRONTEND_URL}/login.html?token=${token}&name=${req.user.name}`);
  }
);

/* =========================================
   CONTACT FORM ENDPOINT
   ========================================= */
app.post('/send', contactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ success: false, error: 'Missing fields' });

    const sanitize = (str) => String(str).replace(/[<>]/g, '').trim();
    const safeName = sanitize(name);
    const safeEmail = sanitize(email);
    const safeSubject = sanitize(subject || 'General Inquiry');
    const safeMessage = sanitize(message);

    await resend.emails.send({
      from: 'Portfolio Contact <onboarding@resend.dev>',
      to: 'sanjayotherwork@gmail.com',
      reply_to: safeEmail,
      subject: `📬 New Contact: ${safeSubject}`,
      html: `
        <body style="background-color: #050505; color: #fff; padding: 40px; font-family: Arial;">
          <h1 style="color: #00ff88;">New Contact</h1>
          <p><b>Name:</b> ${safeName}</p>
          <p><b>Email:</b> ${safeEmail}</p>
          <p><b>Subject:</b> ${safeSubject}</p>
          <p><b>Message:</b> ${safeMessage}</p>
        </body>
      `
    });

    res.status(200).json({ success: true, message: 'Message sent!' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Email error' });
  }
});

/* =========================================
   SERVER START
   ========================================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});