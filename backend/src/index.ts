import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import { scheduleExpireBookingsJob } from './jobs/expireBookings';
import { trimBodyMiddleware } from './middleware/trimBody';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(trimBodyMiddleware); // Issue #5: trim all incoming string fields globally

// API Routes
app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start scheduled jobs
  scheduleExpireBookingsJob();
});
