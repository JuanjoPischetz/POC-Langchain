import express from 'express';
import dotenv from 'dotenv';
import chatRoutes from './routes/chat.route';
import chromaRoutes from './routes/chroma.route';
import agentRoutes from './routes/agent.route';
import { connectToRedis } from './redisClient';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para JSON
app.use(express.json());

// Rutas
app.use('/api', chatRoutes);
app.use('/api/chroma', chromaRoutes);
app.use('/api/agent', agentRoutes)


// Iniciar servidor
app.listen(PORT, async () => {
  // await connectToRedis(); // Conectar a Redis al iniciar el servidor
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});


