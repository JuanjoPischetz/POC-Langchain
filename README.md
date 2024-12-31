## How to run it

#### Just use npm i and npm run dev.

#### .env example:

- OPENAI_API_KEY=your-key
- PORT=3003
- REDIS_URL=redis://localhost:6377

### Ask route from postman:

- {{base_url}}/api/agent/ask

#### Body example:

```json
{   
    "slug": "slug",
	"question": "busco promociones de la marca Samsung",
    "promotionTemplateId": "id"
}