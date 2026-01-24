import bcrypt from 'bcryptjs'
import { desc, eq, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { SignJWT } from 'jose'
import { createDb, transactions, users } from './db'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors())

app.get('/', (c) => {
  return c.json({
    message: 'Hello from Hono + Drizzle + D1!',
    status: 'ok'
  })
})

// Endpoint de Registro
app.post('/auth/register', async (c) => {
  try {
    const { email, name, password } = await c.req.json()
    const db = createDb(c.env.DB)

    // 1. Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10)

    // 2. Insertar usuario
    const newUser = await db.insert(users).values({
      email,
      name,
      password: hashedPassword,
      balance: 10.0 // Bono de bienvenida
    }).returning()

    return c.json({ 
      success: true, 
      user: { id: newUser[0].id, email: newUser[0].email, name: newUser[0].name } 
    })
  } catch (e: any) {
    console.error('Error en registro:', e)
    return c.json({ 
      success: false, 
      message: e.message || 'Error al registrar usuario',
      error: e.toString()
    }, 400)
  }
})

// Endpoint de Login
app.post('/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json()
    const db = createDb(c.env.DB)

    // 1. Buscar usuario
    const user = await db.select().from(users).where(eq(users.email, email)).get()

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return c.json({ success: false, message: 'Credenciales inválidas' }, 401)
    }

    // 2. Generar JWT
    const secret = new TextEncoder().encode(c.env.JWT_SECRET || 'utpay-secret-key-123')
    const token = await new SignJWT({ id: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret)

    return c.json({ 
      success: true, 
      token, 
      user: { id: user.id, name: user.name, email: user.email, balance: user.balance } 
    })
  } catch (e: any) {
    console.error('Error en login:', e)
    return c.json({ 
      success: false, 
      message: 'Error en el servidor',
      error: e.message || e.toString()
    }, 500)
  }
})

// Endpoint para obtener datos del usuario actual
app.get('/auth/me/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const db = createDb(c.env.DB)
    const user = await db.select().from(users).where(eq(users.id, id)).get()

    if (!user) {
      return c.json({ success: false, message: 'Usuario no encontrado' }, 404)
    }

    return c.json({ 
      success: true, 
      user: { id: user.id, name: user.name, email: user.email, balance: user.balance } 
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// Endpoint para enviar dinero
app.post('/transactions/send', async (c) => {
  try {
    const { senderId, receiverEmail, amount, description } = await c.req.json()
    const db = createDb(c.env.DB)

    if (amount <= 0) {
      return c.json({ success: false, message: 'El monto debe ser mayor a 0' }, 400)
    }

    // 1. Buscar emisor y receptor
    const sender = await db.select().from(users).where(eq(users.id, senderId)).get()
    const receiver = await db.select().from(users).where(eq(users.email, receiverEmail)).get()

    if (!sender) return c.json({ success: false, message: 'Emisor no encontrado' }, 404)
    if (!receiver) return c.json({ success: false, message: 'Receptor no encontrado (el correo debe estar registrado)' }, 404)
    if (sender.id === receiver.id) return c.json({ success: false, message: 'No puedes enviarte dinero a ti mismo' }, 400)
    
    if (sender.balance < amount) {
      return c.json({ success: false, message: 'Saldo insuficiente' }, 400)
    }

    // 2. Ejecutar transacción ATÓMICA
    // Usamos db.batch para asegurar que o se hacen todas, o no se hace ninguna
    await db.batch([
      // Restar al emisor
      db.update(users)
        .set({ balance: (sender.balance || 0) - amount })
        .where(eq(users.id, senderId)),

      // Sumar al receptor
      db.update(users)
        .set({ balance: (receiver.balance || 0) + amount })
        .where(eq(users.id, receiver.id)),

      // Registrar transacción
      db.insert(transactions).values({
        senderId,
        receiverId: receiver.id,
        amount,
        description: description || `Transferencia UTPay`
      })
    ])

    return c.json({ success: true, message: 'Transferencia realizada con éxito' })
  } catch (e: any) {
    console.error('Error en transferencia:', e)
    return c.json({ success: false, message: 'Error al procesar la transferencia', error: e.message }, 500)
  }
})

// Endpoint para obtener historial de transacciones
app.get('/transactions/history/:userId', async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'))
    const db = createDb(c.env.DB)

    const senderAlias = alias(users, 'sender')
    const receiverAlias = alias(users, 'receiver')

    const history = await db.select({
      id: transactions.id,
      amount: transactions.amount,
      description: transactions.description,
      createdAt: transactions.createdAt,
      senderId: transactions.senderId,
      receiverId: transactions.receiverId,
      senderName: senderAlias.name,
      receiverName: receiverAlias.name,
    })
    .from(transactions)
    .leftJoin(senderAlias, eq(transactions.senderId, senderAlias.id))
    .leftJoin(receiverAlias, eq(transactions.receiverId, receiverAlias.id))
    .where(or(eq(transactions.senderId, userId), eq(transactions.receiverId, userId)))
    .orderBy(desc(transactions.createdAt))
    .all()

    return c.json({ success: true, history })
  } catch (e: any) {
    console.error('Error en historial:', e)
    return c.json({ success: false, error: e.message }, 500)
  }
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