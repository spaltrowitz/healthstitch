const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const whoopRoutes = require('./routes/whoopRoutes');
const appleRoutes = require('./routes/appleRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/whoop', whoopRoutes);
app.use('/auth/whoop', whoopRoutes);
app.use('/api/apple', appleRoutes);
app.use('/api/dashboard', dashboardRoutes);

module.exports = app;
