import { createClient, RedisClientType } from 'redis';

const redisClient: RedisClientType = createClient();

export async function connectToRedis(): Promise<void> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('Conectado a Redis');
  }
}

export default redisClient;
