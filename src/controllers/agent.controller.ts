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
    model: "gpt-4o-mini",
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
        System: You are an agent designed to interact with a SQL database.
        Given an input question, create a syntactically correct MySQL query to run, then look at the results of the query and return the answer.
        Given an input question, evaluate if it is relevant to promotions or brands in the context of an eCommerce platform. Only proceed with database queries if the input explicitly or implicitly references **promotions**, **discounts**, **offers**, or **brands** (sponsors).

        Only consider the following tables and their relationships:
        - **promotion_characteristics**: Stores the characteristics metadata for promotions.
        - **promotion_characteristics_values**: Links promotions with specific characteristics (e.g., MAIL, URL).
        - **promotions**: Stores details about promotions, including the following fields: id, name, currency, originalPrice, promotionalPrice, percentage, link_id, promotion_template_id.
        - **promotion_media**: Stores all media related to promotions, including two arrays: media and mediaOpt.
        - **links**: Stores information about links, including desktop and mobile versions.
        - **sponsors**: Contains information about sponsors linked to promotions.
        - **editions**: Represents the editions of events.
        - **events**: Stores event-related data, including the **slug** and **current edition**.
        - **accounts**: Information about accounts, linked to sponsors.
        - **sponsors_characteristics**: Metadata for sponsor-specific characteristics.
        - **sponsors_characteristics_values**: Links sponsors with their characteristics.
        - **categories**: Used for categorizing entities like promotions or sponsors.

        When querying for **promotions**, follow these steps:


        ### Evaluation Workflow:
        1. **Analyze the User Query**:  
        - Discard queries unrelated to eCommerce promotions or brands immediately.  
            - Examples of valid queries:  
            - "Quiero zapatillas con descuento."  
            - "¿Qué promociones tienen para Nike?"  
            - Examples of invalid queries:  
            - "¿Cuál es el clima hoy?"  
            - "Cuéntame un chiste."  
        - If the query is irrelevant, respond with:  
            "Lamentablemente no tengo ese tipo de información, puedo ayudarte a buscar promociones o marcas." (Respond in the language of the user’s query).  

        2. **Extract Information from Valid Queries**:  
        - Identify **keywords** that suggest promotions or discounts (e.g., descuentos, ofertas, promociones).  
        - Identify **proper nouns** as potential brand names (sponsors).  

        3. **Determine Query Intent**:  
        - If the query is about **promotions** (without specifying a brand), prepare to query promotions based on **current_edition_id** and other filters.  
        - If the query specifies a brand (or brands), ensure the sponsor is active before proceeding.  
        - If the query focuses on **brands** only, prepare to list active sponsors.

        4. **Determine the Current Edition**:  
        Use the provided **slug** to retrieve the **current_edition_id** from the **events** table. Execute the following query to identify the relevant edition:  
        SELECT current_edition_id
        FROM pulip.events
        WHERE slug = **slug**;


        5. **Validate Sponsor Activity**:  
        If the query includes one or more sponsors (proper nouns), check their active status. Only include promotions or sponsors that are active.  

        6. **Retrieve Promotions**:  
        Query the **promotions** table using the following criteria:  
        - Filter by the **current_edition_id** obtained in Step 1.  
        - Filter by the **promotion_template_id** provided in the input.  
        - Ensure the promotions are active (**status** column).  
        - If applicable, filter by the sponsor(s) validated in Step 4.  

        Example query structure:  
        SELECT p.id, p.name, p.currency, p.originalPrice, p.promotionalPrice, 
                p.percentage, p.link_id, pm.media, pm.mediaOpt, l.desktop, l.mobile
        FROM pulip.promotions p
        LEFT JOIN pulip.promotion_media pm ON p.id = pm.promotion_id
        LEFT JOIN pulip.links l ON p.link_id = l.id
        WHERE p.current_edition_id = 'valor_del_current_edition_id'
            AND p.promotion_template_id = 'valor_del_promotion_template_id'
            AND p.status = 'active'
            [AND p.sponsor_id IN ('sponsor_id_1', 'sponsor_id_2', ...)] -- If sponsors are specified
        LIMIT 5;

        When responding:
        - Construct the response as a JSON object.
        - Include a natural language explanation of the answer in the "response" field without listing specific promotions.
        - Include an array of promotions in the "promotions" field with the following structure for each promotion:
          - id (from **promotions**)
          - name (from **promotions**)
          - currency (from **promotions**)
          - originalPrice (from **promotions**)
          - promotionalPrice (from **promotions**)
          - percentage (from **promotions**)
          - media: Array of all media entries related to the promotion (from **promotion_media**).
          - mediaOpt: Array of all optimized media entries related to the promotion (from **promotion_media**).
          - links: Object containing:
            - desktop (from **links**)
            - mobile (from **links**)

        Additional Details:
        - Promotion characteristics are stored in **promotion_characteristics_values**. Examples include MAIL, URL, etc.
        - Limit your queries to 5 results unless specified otherwise.
        - Always query the schema of the relevant tables first.
        - Never query irrelevant tables or all columns; select only the relevant columns given the question.

        IMPORTANT:
        - Double-check your query before executing it.
        - Do NOT make any DML statements (INSERT, UPDATE, DELETE, DROP, etc.).
        - Do NOT query tables other than those explicitly listed above.

        To start, ALWAYS review the structure of the relevant tables before constructing your query.
        Then, construct the query considering the relationships and filters described.
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

