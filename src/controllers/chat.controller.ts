import { Request, Response } from 'express';
import OpenAI from 'openai';
import redisClient, {connectToRedis} from '../redisClient';
import dotenv from 'dotenv';
dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
, 
});

function generateCacheKey(prompt: string): string {
  return `openai:cache:${prompt}`;
}

export async function handleChatRequest(req: Request, res: Response): Promise<void> {
  const { prompt } = req.body;

  if (!prompt) {
    res.status(400).json({ error: 'El prompt es obligatorio.' });
    return;
  }

  try {
    await connectToRedis();
    const cacheKey = generateCacheKey(prompt);

    // Verificar si el resultado ya está en caché
    const cachedResponse = await redisClient.get(cacheKey);
    if (cachedResponse) {
      console.log('Respuesta obtenida desde Redis');
      res.json({ source: 'cache', response: cachedResponse });
      return;
    }

    // Llamar a OpenAI si no está en caché
    console.log('Solicitando respuesta a OpenAI...');
    const chatCompletion = await client.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-3.5-turbo',
    });

    const response = chatCompletion.choices[0].message.content;

    // Almacenar en caché con expiración de 1 hora
    if (response) {
      await redisClient.set(cacheKey, response, { EX: 3600 });
      console.log('Respuesta almacenada en Redis');
    }

    res.json({ source: 'openai', response });
  } catch (error) {
    console.error('Error al procesar el chat:', error);
    res.status(500).json({ error: 'Ocurrió un error al procesar tu solicitud.' });
  }
}