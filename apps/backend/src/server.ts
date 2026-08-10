import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import connectDB from './config/db';
import authRoutes from './routes/auth';
import dailyReportRoutes from './routes/dailyReports';
import projectRoutes from './routes/projects';
import teamRoutes from './routes/teams';
import materialOrderRoutes from './routes/materialOrders';
import materialPurchaseRoutes from './routes/materialPurchases';
import pettyCashRoutes from './routes/pettyCash';
import syncRoutes from './routes/sync';
import { moneyFilter } from './middleware/moneyFilter';
import { authenticate } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3000;

// ----------------------------------------------------------
// Global middleware
// ----------------------------------------------------------
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploaded photos
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests, please try again later.' } },
});
app.use('/api/', limiter);

// ----------------------------------------------------------
// Routes — ORDER MATTERS
// ----------------------------------------------------------

// Health check (public)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes — MUST be before global authenticate middleware
// (login and refresh are public endpoints)
app.use('/api/auth', authRoutes);

// All routes below require authentication + money filter
app.use('/api/projects', authenticate, moneyFilter, projectRoutes);
app.use('/api/teams', authenticate, teamRoutes);
app.use('/api/daily-reports', authenticate, moneyFilter, dailyReportRoutes);
app.use('/api/material-orders', authenticate, materialOrderRoutes);
app.use('/api/material-purchases', authenticate, moneyFilter, materialPurchaseRoutes);
app.use('/api/petty-cash', authenticate, moneyFilter, pettyCashRoutes);
app.use('/api/sync', authenticate, moneyFilter, syncRoutes);

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
