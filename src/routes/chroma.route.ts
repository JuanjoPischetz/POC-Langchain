import { Router } from 'express';
import { createCollection, addDocuments, queryCollection } from '../controllers/chroma.controller';

const router = Router();

// Ruta para crear una colección
router.post('/collection', createCollection);

// Ruta para añadir documentos a una colección
router.post('/collection/documents', addDocuments);

// Ruta para consultar documentos en una colección
router.post('/collection/query', queryCollection);

export default router;
