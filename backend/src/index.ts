import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import routes from './routes';
import { scheduleExpireBookingsJob } from './jobs/expireBookings';
import { trimBodyMiddleware } from './middleware/trimBody';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());
app.use(trimBodyMiddleware);

// Local file uploads
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  scheduleExpireBookingsJob();
});
