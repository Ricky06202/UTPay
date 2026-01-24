import bcrypt from 'bcryptjs'
import { and, desc, eq, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { SignJWT } from 'jose'
import { createDb, missionApplications, missionCategories, missions, transactions, users } from './db'

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
    const { senderId, receiverEmail, receiverId, amount, description } = await c.req.json()
    const db = createDb(c.env.DB)

    if (amount <= 0) {
      return c.json({ success: false, message: 'El monto debe ser mayor a 0' }, 400)
    }

    // 1. Buscar emisor y receptor
    const sender = await db.select().from(users).where(eq(users.id, senderId)).get()
    
    let receiver;
    if (receiverId) {
      receiver = await db.select().from(users).where(eq(users.id, receiverId)).get()
    } else if (receiverEmail) {
      receiver = await db.select().from(users).where(eq(users.email, receiverEmail)).get()
    }

    if (!sender) return c.json({ success: false, message: 'Emisor no encontrado' }, 404)
    if (!receiver) return c.json({ success: false, message: 'Receptor no encontrado' }, 404)
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

// --- ENDPOINTS DE MISIONES ---

// 0. Listar categorías de misiones
app.get('/missions/categories', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const categories = await db.select().from(missionCategories).all()
    return c.json({ success: true, categories })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 1. Crear una misión (con Escrow)
app.post('/missions/create', async (c) => {
  try {
    const { creatorId, title, description, categoryId, reward, slots, whatsapp } = await c.req.json()
    const db = createDb(c.env.DB)

    // Verificar saldo del creador
    const creator = await db.select().from(users).where(eq(users.id, creatorId)).get()
    if (!creator || creator.balance < reward) {
      return c.json({ success: false, message: 'Saldo insuficiente para crear esta misión' }, 400)
    }

    // Restar saldo (Escrow) y crear misión en batch
    await db.batch([
      db.update(users).set({ balance: (creator.balance || 0) - reward }).where(eq(users.id, creatorId)),
      db.insert(missions).values({
        creatorId,
        title,
        description,
        categoryId,
        reward,
        slots: slots || 1,
        whatsapp,
        status: 'open'
      })
    ])

    return c.json({ success: true, message: 'Misión creada correctamente' })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 2. Listar misiones abiertas
app.get('/missions/open', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const openMissions = await db.select({
      id: missions.id,
      title: missions.title,
      description: missions.description,
      categoryId: missions.categoryId,
      categoryName: missionCategories.name,
      reward: missions.reward,
      slots: missions.slots,
      whatsapp: missions.whatsapp,
      status: missions.status,
      creatorId: missions.creatorId,
      creatorName: users.name,
      createdAt: missions.createdAt
    })
    .from(missions)
    .leftJoin(users, eq(missions.creatorId, users.id))
    .leftJoin(missionCategories, eq(missions.categoryId, missionCategories.id))
    .where(eq(missions.status, 'open'))
    .orderBy(desc(missions.createdAt))
    .all()

    return c.json({ success: true, missions: openMissions })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 3. Postularse a una misión
app.post('/missions/apply', async (c) => {
  try {
    const { missionId, studentId, comment } = await c.req.json()
    const db = createDb(c.env.DB)

    // Evitar postulación doble
    const existing = await db.select().from(missionApplications)
      .where(and(eq(missionApplications.missionId, missionId), eq(missionApplications.studentId, studentId)))
      .get()
    
    if (existing) {
      return c.json({ success: false, message: 'Ya te has postulado a esta misión' }, 400)
    }

    await db.insert(missionApplications).values({
      missionId,
      studentId,
      comment,
      status: 'pending'
    })

    return c.json({ success: true, message: 'Postulación enviada' })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 4. Aceptar a un estudiante para la misión
app.post('/missions/accept', async (c) => {
  try {
    const { applicationId } = await c.req.json()
    const db = createDb(c.env.DB)

    const application = await db.select().from(missionApplications).where(eq(missionApplications.id, applicationId)).get()
    if (!application) return c.json({ success: false, message: 'Postulación no encontrada' }, 404)

    await db.batch([
      // Marcar postulación como aceptada
      db.update(missionApplications).set({ status: 'accepted' }).where(eq(missionApplications.id, applicationId)),
      // Marcar misión como asignada
      db.update(missions).set({ status: 'assigned' }).where(eq(missions.id, application.missionId))
    ])

    return c.json({ success: true, message: 'Estudiante asignado' })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 5. Cancelar una tarea (solo el dueño y si está abierta)
app.post('/missions/cancel', async (c) => {
  try {
    let body;
    try {
      body = await c.req.json();
    } catch (e) {
      return c.json({ success: false, message: 'Cuerpo de petición inválido o vacío' }, 400);
    }

    const { missionId, userId } = body;
    if (!missionId || !userId) {
      return c.json({ success: false, message: 'Faltan campos obligatorios: missionId, userId' }, 400);
    }

    const db = createDb(c.env.DB);
    const mId = Number(missionId);
    const uId = Number(userId);

    const mission = await db.select().from(missions).where(eq(missions.id, mId)).get();
    
    if (!mission) {
      return c.json({ success: false, message: 'Tarea no encontrada' }, 404);
    }

    if (Number(mission.creatorId) !== uId) {
      return c.json({ success: false, message: 'No tienes permiso para cancelar esta tarea' }, 403);
    }

    if (mission.status !== 'open') {
      return c.json({ success: false, message: 'Solo se pueden cancelar tareas abiertas' }, 400);
    }

    const creator = await db.select().from(users).where(eq(users.id, uId)).get();
    if (!creator) {
      return c.json({ success: false, message: 'Usuario creador no encontrado' }, 404);
    }

    await db.batch([
      db.update(users)
        .set({ balance: sql`balance + ${mission.reward}` })
        .where(eq(users.id, uId)),
      db.update(missions)
        .set({ status: 'cancelled' })
        .where(eq(missions.id, mId)),
      db.update(missionApplications)
        .set({ status: 'rejected' })
        .where(eq(missionApplications.missionId, mId))
    ]);

    return c.json({ success: true, message: 'Tarea cancelada y saldo reembolsado' });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
})

// 6. Editar una tarea (solo el dueño y si está abierta)
app.post('/missions/update', async (c) => {
  try {
    let body;
    try {
      body = await c.req.json();
    } catch (e) {
      return c.json({ success: false, message: 'Cuerpo de petición inválido' }, 400);
    }

    const { missionId, userId, title, description, categoryId, reward, slots, whatsapp } = body;
    const db = createDb(c.env.DB);

    const mId = Number(missionId);
    const uId = Number(userId);

    const mission = await db.select().from(missions).where(eq(missions.id, mId)).get();
    
    if (!mission) {
      return c.json({ success: false, message: 'Tarea no encontrada' }, 404);
    }

    if (Number(mission.creatorId) !== uId) {
      return c.json({ success: false, message: 'No tienes permiso para editar esta tarea' }, 403);
    }

    if (mission.status !== 'open') {
      return c.json({ success: false, message: 'Solo se pueden editar tareas abiertas' }, 400);
    }

    const rewardNum = Number(reward);
    if (rewardNum !== mission.reward) {
      const creator = await db.select().from(users).where(eq(users.id, uId)).get();
      const diff = rewardNum - mission.reward;
      
      if (creator && creator.balance < diff) {
        return c.json({ success: false, message: 'Saldo insuficiente para aumentar la recompensa' }, 400);
      }

      await db.update(users).set({ balance: (creator?.balance || 0) - diff }).where(eq(users.id, uId));
    }

    await db.update(missions).set({
      title,
      description,
      categoryId: Number(categoryId),
      reward: rewardNum,
      slots: Number(slots) || 1,
      whatsapp
    }).where(eq(missions.id, mId));

    return c.json({ success: true, message: 'Tarea actualizada correctamente' });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
})

// 7. Finalizar misión y liberar pago
app.post('/missions/complete', async (c) => {
  try {
    const { missionId } = await c.req.json()
    const db = createDb(c.env.DB)

    const mission = await db.select().from(missions).where(eq(missions.id, missionId)).get()
    if (!mission || mission.status !== 'assigned') {
      return c.json({ success: false, message: 'Misión no válida para completar' }, 400)
    }

    // Buscar al estudiante aceptado
    const application = await db.select().from(missionApplications)
      .where(and(eq(missionApplications.missionId, missionId), eq(missionApplications.status, 'accepted')))
      .get()

    if (!application) return c.json({ success: false, message: 'No hay estudiante asignado' }, 404)

    const student = await db.select().from(users).where(eq(users.id, application.studentId)).get()
    if (!student) return c.json({ success: false, message: 'Estudiante no encontrado' }, 404)

    await db.batch([
      // Marcar misión y postulación como completadas
      db.update(missions).set({ status: 'completed' }).where(eq(missions.id, missionId)),
      db.update(missionApplications).set({ status: 'completed' }).where(eq(missionApplications.id, application.id)),
      // Liberar pago al estudiante
      db.update(users).set({ balance: (student.balance || 0) + mission.reward }).where(eq(users.id, student.id)),
      // Registrar en historial de transacciones
      db.insert(transactions).values({
        senderId: mission.creatorId,
        receiverId: student.id,
        amount: mission.reward,
        description: `Pago por misión: ${mission.title}`
      })
    ])

    return c.json({ success: true, message: 'Misión completada y pago liberado' })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

export default app