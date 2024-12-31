import { Request, Response } from 'express';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { OpenAIEmbeddings } from '@langchain/openai';
import dotenv from 'dotenv';
dotenv.config();


// Configuración de embeddings de OpenAI
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY, // Configura tu clave de OpenAI
});

// URL del servidor Chroma
const chromaUrl = 'http://localhost:8000';

export async function createCollection(req: Request, res: Response): Promise<void> {
  const { collectionName } = req.body;

  if (!collectionName) {
    res.status(400).json({ error: 'El nombre de la colección es obligatorio.' });
    return;
  }

  try {
    // Crea la colección en Chroma utilizando LangChain
    const vectorStore = await Chroma.fromExistingCollection(embeddings, {
      collectionName,
      url: chromaUrl,
    });

    res.status(201).json({ message: `Colección '${collectionName}' creada o existente.`, vectorStore });
  } catch (error) {
    console.error('Error al crear la colección:', error);
    res.status(500).json({ error: 'Error al crear la colección.' });
  }
}

export async function addDocuments(req: Request, res: Response): Promise<void> {
  const { collectionName, documents, ids } = req.body;
  console.log(documents)

  if (!collectionName || !documents || !ids || documents.length !== ids.length) {
    res.status(400).json({ error: 'Datos inválidos. Se requieren collectionName, documents e ids (de igual longitud).' });
    return;
  }

  try {
    // Carga o crea la colección en Chroma
    const vectorStore = await Chroma.fromExistingCollection(embeddings, {
      collectionName,
      url: chromaUrl,
    });

    // Añade documentos a la colección
    await vectorStore.addDocuments(documents.map((doc: string, index: number) => ({
      metadata:{id: ids[index]},
      pageContent: doc,
    })));

    res.status(200).json({ message: `Documentos añadidos/actualizados en la colección '${collectionName}'.` });
  } catch (error) {
    console.error('Error al añadir documentos:', error);
    res.status(500).json({ error: 'Error al añadir documentos.' });
  }
}

export async function queryCollection(req: Request, res: Response): Promise<void> {
  const { collectionName, queryText, nResults } = req.body;

  if (!collectionName || !queryText || !nResults) {
    res.status(400).json({ error: 'Datos inválidos. Se requieren collectionName, queryText y nResults.' });
    return;
  }

  try {
    // Carga la colección existente
    const vectorStore = await Chroma.fromExistingCollection(embeddings, {
      collectionName,
      url: chromaUrl,
    });

    // Consulta la colección
    const results = await vectorStore.similaritySearch(queryText, nResults);

    res.status(200).json({ message: 'Resultados obtenidos.', results });
  } catch (error) {
    console.error('Error al consultar la colección:', error);
    res.status(500).json({ error: 'Error al consultar la colección.' });
  }
}
