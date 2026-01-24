import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createDb, users } from './db'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors())

app.get('/', (c) => {
  return c.json({
    message: 'Hello from Hono + Drizzle + D1!',
    status: 'ok'
  })
})

app.get('/api/data', (c) => {
  return c.json({
    id: 1,
    name: 'UTPay API',
    version: '1.0.0'
  })
})

app.get('/users', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const result = await db.select().from(users).all()
    return c.json(result)
  } catch (e: any) {
    return c.json({ err: e.message }, 500)
  }
})

export default app
