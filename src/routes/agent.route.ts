import { Router } from 'express';
import { getTables, askQuestion } from '../controllers/agent.controller';

const router = Router();

// Definir la ruta para obtener las tablas
router.get('/tables', getTables);
router.post('/ask', askQuestion )

export default router;
