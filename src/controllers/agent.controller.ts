import { Request, Response } from 'express';
import { SqlDatabase } from 'langchain/sql_db';
import { DataSource } from 'typeorm';
import { pull } from "langchain/hub";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();
import { QuerySqlTool } from "langchain/tools/sql";
import { SqlToolkit } from "langchain/agents/toolkits/sql";
import { createReactAgent } from "@langchain/langgraph/prebuilt";


const PORT = 3306; 
const HOST = 'localhost'; 
const USERNAME = 'root'; 
const PASSWORD = 'root'; 
const DATABASE = 'pulip'; 


const llm = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY
  });
  

// Crear el DataSource de TypeORM para conectarse a MySQL
const datasource = new DataSource({
  type: 'mysql',
  host: HOST,
  port: PORT,
  username: USERNAME,
  password: PASSWORD,
  database: DATABASE,
});

// Método para manejar la obtención de las tablas
export async function getTables(req: Request, res: Response): Promise<void> {
  try {
    // Inicializar conexión con la base de datos
    if (!datasource.isInitialized) {
      await datasource.initialize();
    }

    // Crear instancia de SqlDatabase
    const db = await SqlDatabase.fromDataSourceParams({
      appDataSource: datasource,
    });

    // Consultar las tablas de la base de datos
    const tables = await db.getTableInfo();
    const tablesx2 = db.allTables.map(it => it.tableName)

    res.status(200).json({ tablesx2 });
  } catch (error) {
    console.error('Error al obtener tablas:', error);
    res.status(500).json({ error: 'Error al obtener tablas.' });
  } finally {
    // Cerrar la conexión si está abierta
    if (datasource.isInitialized) {
      await datasource.destroy();
    }
  }
}

export async function askQuestion(req: Request, res: Response): Promise<void> {
    try {
      const { question, slug, promotionTemplateId } = req.body;
  
      if (!question) {
        res.status(400).json({ error: 'La pregunta (question) es requerida.' });
        return;
      }

      if (!question) {
        res.status(400).json({ error: 'el evento (slug) es requerido.' });
        return;
      }
  
      if (!datasource.isInitialized) {
        await datasource.initialize();
      }
  
      // Inicializar base de datos
      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: datasource,
      });
  
      // Crear herramientas del agente
      const toolkit = new SqlToolkit(db, llm);
      const tools = toolkit.getTools();
  
      // Obtener plantilla del mensaje del sistema
      const systemPromptTemplate = await pull<ChatPromptTemplate>(
        'langchain-ai/sql-agent-system-prompt'
      );
  
      const systemMessage = await systemPromptTemplate.format({
        dialect: db.appDataSourceOptions.type,
        top_k: 5,
      });

      const systemPromptTemplateCustomMsg = `
            System: You are an agent specialized in interacting with a SQL (MySQL) database for an eCommerce platform. 
            Your task is to generate MySQL queries based on user questions about **promotions**, **discounts**, **offers**, or **brands (sponsors)**.

            ### Workflow:
            1. **Analyze the Query**:  
              - If unrelated to promotions or brands, respond:  
                "Lamentablemente no tengo esa información, pero puedo ayudarte con promociones o marcas."  

            2. **Determine Intent**:  
              - For **promotions**, query active promotions filtered by **current_edition_id**.  
              - For **brands**, ensure the sponsor is active before proceeding.  

            3. **Queries**:
              - Retrieve current edition:  
                SELECT current_edition_id FROM pulip.events WHERE slug = :slug;

              - Validate sponsors (if specified in the query):  
                SELECT id, name FROM pulip.sponsors 
                WHERE name = :brand AND active = 1 AND edition_id = :current_edition_id;

              - Query promotions:  
                SELECT p.id, p.name, p.currency_id, p.original_price, p.promotional_price, 
                        p.percentage, p.link_id
                FROM pulip.promotions p
                WHERE p.edition_id = :current_edition_id
                  AND p.active = 1
                  AND p.deleted = 0
                  AND p.name LIKE CONCAT('%', :promotion_name, '%') -- Only if a promotion name is specified
                  [[AND p.sponsor_id = :sponsor_id]] -- Only include this condition if a sponsor is validated
                LIMIT 5;

            ### Response:
            - Return JSON with:
              - \`response\`: Natural language explanation (exclude specific promotions), include proper nouns used by the user, exclude slug and template_id.
              - \`promotions\`: Array of objects with the following structure:
                - id: ID of the promotion
                - name: Name of the promotion
                - currency: Currency of the promotion
                - originalPrice: Original price of the product
                - promotionalPrice: Discounted price of the product
                - percentage: Percentage discount
                - links: Object containing:
                  - desktop: URL for desktop
                  - mobile: URL for mobile
            `.trim();


      


      // Crear el agente
      const agent = createReactAgent({
        llm,
        tools,
        stateModifier: systemPromptTemplateCustomMsg,
      });
  
      // Configurar entrada para el agente
      const agentInputs = {
        messages: [
          { role: 'user', content: `${question}. The current slug is: ${slug}. The promotion_template_id is ${promotionTemplateId}` },
        ],
      };      
  
      // Ejecutar agente para responder la pregunta
      let finalAnswer = null;
      let tokenSpent = null;
  
      for await (const step of await agent.stream(agentInputs, { streamMode: 'values' })) {
        const lastMessage = step.messages[step.messages.length - 1];
        finalAnswer = lastMessage.content;
        tokenSpent = lastMessage.usage_metadata
      }
  
      res.status(200).json({
        question,
        answer: finalAnswer,
        tokenSpent
      });
    } catch (error) {
      console.error('Error al procesar la pregunta:', error);
      res.status(500).json({ error: 'Error al procesar la pregunta.' });
    } finally {
      if (datasource.isInitialized) {
        await datasource.destroy();
      }
    }
  }

// "promotion_characteristics",
// "promotion_characteristics_values",
// "promotions",
// sponsors,
// "editions",
// "events"
// accounts,
// "sponsors_characteristics",
// "sponsors_characteristics_values",
// categories, promo cat, sponsor cat (promo entity)

