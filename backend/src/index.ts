import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import rateLimit from 'express-rate-limit';
import routes from './routes';
import { scheduleExpireBookingsJob } from './jobs/expireBookings';
import { scheduleSubscriptionGraceJob } from './jobs/subscriptionGrace';
import { trimBodyMiddleware } from './middleware/trimBody';
import { optionalAuth } from './middleware/auth';
import { serveUpload } from './controllers/upload.controller';
import { stripeWebhook } from './controllers/billing.controller';
import { assertProductionSecrets, corsOrigins } from './config/security';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

assertProductionSecrets();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: corsOrigins(),
  credentials: true,
}));
app.use(cookieParser());
app.post(
  '/api/billing/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhook
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(trimBodyMiddleware);

const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/uploads/:folder/:agencyId/:filename', uploadRateLimiter, optionalAuth, serveUpload);

app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' && status >= 500 ? 'Internal server error' : (err.message || 'Internal server error'),
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  scheduleExpireBookingsJob();
  scheduleSubscriptionGraceJob();
});
