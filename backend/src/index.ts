import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import routes from './routes';
import { scheduleExpireBookingsJob } from './jobs/expireBookings';
import { trimBodyMiddleware } from './middleware/trimBody';
import { optionalAuth } from './middleware/auth';
import { serveUpload } from './controllers/upload.controller';
import { assertProductionSecrets, corsOrigins } from './config/security';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

assertProductionSecrets();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: corsOrigins(),
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(trimBodyMiddleware);

app.get('/uploads/:folder/:agencyId/:filename', optionalAuth, serveUpload);

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
});
