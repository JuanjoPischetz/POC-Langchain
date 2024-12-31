import { Router } from 'express';
import { handleChatRequest } from '../controllers/chat.controller';

const router = Router();

// Definir la ruta para procesar el prompt
router.post('/chat', handleChatRequest);

export default router;
