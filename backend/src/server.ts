import { app, prisma, redis } from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Connect to Redis
    await redis.connect();
    console.log('Connected to Redis');

    // Connect to Prisma
    await prisma.$connect();
    console.log('Connected to PostgreSQL');

    // Start server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

startServer();
