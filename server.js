const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.use(session({
  secret: 'secureNoticeBoardKey',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
}));

// Simple admin credentials
const ADMIN = { username: 'admin', password: '12345' };

// Ensure uploads folder exists
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Middleware to protect admin routes
function requireLogin(req, res, next) {
  if (req.session.loggedIn) next();
  else res.status(401).json({ success: false, message: 'Unauthorized' });
}

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN.username && password === ADMIN.password) {
    req.session.loggedIn = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// Upload notice
app.post('/upload', requireLogin, upload.single('noticeFile'), (req, res) => {
  if (!req.file || !req.body.title)
    return res.status(400).json({ success: false, message: 'Missing file or title' });

  const notice = {
    title: req.body.title,
    filePath: `/uploads/${req.file.filename}`,
    filename: req.file.filename,
    date: new Date().toLocaleString()
  };

  let notices = [];
  if (fs.existsSync('notices.json')) notices = JSON.parse(fs.readFileSync('notices.json'));
  notices.push(notice);
  fs.writeFileSync('notices.json', JSON.stringify(notices, null, 2));

  res.json({ success: true });
});

// Get notices (public)
app.get('/notices', (req, res) => {
  if (fs.existsSync('notices.json')) res.sendFile(path.resolve('notices.json'));
  else res.json([]);
});

// Delete notice
app.post('/delete', requireLogin, (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ success: false });

  let notices = [];
  if (fs.existsSync('notices.json')) notices = JSON.parse(fs.readFileSync('notices.json'));

  const index = notices.findIndex(n => n.filename === filename);
  if (index === -1) return res.status(404).json({ success: false });

  const filePath = path.join(__dirname, 'uploads', filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  notices.splice(index, 1);
  fs.writeFileSync('notices.json', JSON.stringify(notices, null, 2));

  res.json({ success: true });
});

// Serve admin page securely
app.get('/admin.html', (req, res) => {
  if (req.session.loggedIn) {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  } else {
    res.redirect('/login.html');
  }
});

// app.listen(3000, () => console.log('✅ Server running on http://localhost:3000'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

