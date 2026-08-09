import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db';
import authRoutes from './routes/auth';
import { moneyFilter } from './middleware/moneyFilter';
import { authenticate } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3000;

// ----------------------------------------------------------
// Global middleware
// ----------------------------------------------------------
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Larger limit for photo base64 payloads
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests, please try again later.' } },
});
app.use('/api/', limiter);

// Money filter — applied globally on all authenticated responses.
// This intercepts res.json() to strip financial fields per-record
// for non-Owner/non-Accountant users. Applied BEFORE routes so it
// wraps ALL responses including sync pull data.
app.use('/api/', authenticate, moneyFilter);

// ----------------------------------------------------------
// Routes
// ----------------------------------------------------------

// Auth routes (login/refresh are public, handled inside the router)
// We mount auth WITHOUT the global authenticate middleware
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Placeholder for future route mounting
// app.use('/api/projects', authenticate, moneyFilter, projectRoutes);
// app.use('/api/teams', authenticate, moneyFilter, teamRoutes);
// app.use('/api/daily-reports', authenticate, moneyFilter, dailyReportRoutes);
// app.use('/api/material-orders', authenticate, moneyFilter, materialOrderRoutes);
// app.use('/api/material-purchases', authenticate, moneyFilter, materialPurchaseRoutes);
// app.use('/api/petty-cash', authenticate, moneyFilter, pettyCashRoutes);
// app.use('/api/payments', authenticate, moneyFilter, paymentRoutes);
// app.use('/api/verification', authenticate, moneyFilter, verificationRoutes);
// app.use('/api/coordination', authenticate, moneyFilter, coordinationRoutes);
// app.use('/api/notifications', authenticate, notificationRoutes);
// app.use('/api/sync', authenticate, moneyFilter, syncRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { message: 'Route not found.' },
  });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: { message: 'Internal server error.' },
  });
});

// ----------------------------------------------------------
// Start
// ----------------------------------------------------------
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🏗️  Crewly API running on port ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
