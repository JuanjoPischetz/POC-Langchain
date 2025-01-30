## How to run it

#### Just use npm i and npm run dev.

#### .env example:

- OPENAI_API_KEY=your-key
- PORT=3003
- REDIS_URL=redis://localhost:6377
- LANGCHAIN_TRACING_V2=true
- LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
- LANGCHAIN_API_KEY= your api key provided by Langsmith
- LANGCHAIN_PROJECT= your project name

### Ask route from postman:

- {{base_url}}/api/agent/ask

#### Body example:

```json
{   
    "slug": "slug",
	"question": "busco promociones de la marca Samsung",
    "promotionTemplateId": "id"
}