import bcrypt from 'bcryptjs'
import { and, desc, eq, sql } from 'drizzle-orm'
import { Wallet } from 'ethers'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { SignJWT } from 'jose'
import { contacts as contactsTable, createDb, missionApplications, missionCategories, missions, users } from './db'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  RPC_URL?: string
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

    // 1. Encriptar contraseña - Usamos 8 rondas para no bloquear la CPU de Cloudflare Workers
    const hashedPassword = await bcrypt.hash(password, 8)

    // 2. Generar Wallet de Blockchain
    const wallet = Wallet.createRandom()
    const seedPhrase = wallet.mnemonic?.phrase || ''
    
    // 3. Insertar usuario (SIN guardar dirección ni balance)
    const newUser = await db.insert(users).values({
      email,
      name,
      password: hashedPassword
    }).returning()

    return c.json({ 
      success: true, 
      user: { 
        id: newUser[0].id, 
        email: newUser[0].email, 
        name: newUser[0].name,
        privateKey: wallet.privateKey, // SE ENVÍA SOLO ESTA VEZ AL CLIENTE
        seedPhrase: seedPhrase        // EL CLIENTE DEBE GUARDARLO LOCALMENTE
      } 
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
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email
        // El balance y la wallet se manejan exclusivamente en el cliente
      } 
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
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email
        // El balance y la wallet se manejan exclusivamente en el cliente
      } 
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// Endpoint para verificar un receptor por email (Búsqueda por email en lugar de dirección)
app.get('/users/verify-email/:email', async (c) => {
  try {
    const email = c.req.param('email')
    const db = createDb(c.env.DB)
    const user = await db.select().from(users).where(eq(users.email, email)).get()

    if (!user) {
      return c.json({ success: false, message: 'Usuario no encontrado' }, 404)
    }

    return c.json({ 
      success: true, 
      user: { id: user.id, name: user.name, email: user.email } 
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// Endpoint para enviar dinero
app.post('/transactions/send', async (c) => {
  try {
    const { senderId, receiverEmail, receiverId, amount, description, txHash } = await c.req.json()
    const db = createDb(c.env.DB)

    if (amount <= 0) {
      return c.json({ success: false, message: 'El monto debe ser mayor a 0' }, 400)
    }

    // Redondear a 2 decimales
    const finalAmount = Math.round(amount * 100) / 100

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
    
    // El balance ya no se valida ni se guarda en el servidor.
    // La App móvil valida el balance real de la blockchain antes de enviar.

    return c.json({ success: true, message: 'Transferencia registrada en el sistema' })
  } catch (e: any) {
    console.error('Error en transferencia:', e)
    return c.json({ success: false, message: 'Error al procesar la transferencia', error: e.message }, 500)
  }
})

// Endpoint para obtener historial de transacciones directamente desde Blockscout (Blockchain)
app.get('/transactions/history/:userId/:address', async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'))
    const address = c.req.param('address')
    const db = createDb(c.env.DB)

    // 1. Consultar a Blockscout API usando la dirección enviada por el cliente
    const BLOCKSCOUT_URL = 'http://localhost:4000/api'
    const query = `?module=account&action=txlist&address=${address}&sort=desc`
    
    const response = await fetch(BLOCKSCOUT_URL + query)
    const data: any = await response.json()

    if (data.status !== '1' || !Array.isArray(data.result)) {
      return c.json({ success: true, history: [] })
    }

    // 2. Procesar y enriquecer transacciones con nombres de la DB local
    // Nota: Ahora no podemos cruzar nombres tan fácil si no tenemos las direcciones en la DB
    // Pero podemos seguir guardando las direcciones en la tabla de Contactos para referencia.
    
    // 3. Formatear para la App
    const history = data.result.map((tx: any) => {
      const fromAddr = tx.from.toLowerCase()
      const toAddr = tx.to.toLowerCase()
      const isSender = fromAddr === address.toLowerCase()
      
      return {
        id: tx.hash,
        txHash: tx.hash,
        amount: parseFloat(tx.value) / 1e18,
        description: isSender ? `Envío a ${toAddr}` : `Recibido de ${fromAddr}`,
        createdAt: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        senderName: fromAddr,
        receiverName: toAddr,
        isOutgoing: isSender,
        status: tx.txreceipt_status === '1' ? 'success' : 'failed'
      }
    })

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

// --- Endpoints de Contactos ---

// Obtener contactos de un usuario
app.get('/contacts/:userId', async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'))
    const db = createDb(c.env.DB)
    const userContacts = await db.select().from(contactsTable).where(eq(contactsTable.userId, userId)).orderBy(desc(contactsTable.createdAt)).all()
    return c.json({ success: true, contacts: userContacts })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// Agregar un contacto
app.post('/contacts', async (c) => {
  try {
    const { userId, contactName, walletAddress } = await c.req.json()
    const db = createDb(c.env.DB)
    
    // Verificar si ya existe un contacto con esa dirección para ese usuario
    const existing = await db.select().from(contactsTable)
      .where(and(eq(contactsTable.userId, userId), eq(contactsTable.walletAddress, walletAddress)))
      .get()
      
    if (existing) {
      return c.json({ success: false, message: 'Ya tienes este contacto guardado' }, 400)
    }

    const newContact = await db.insert(contactsTable).values({
      userId,
      contactName,
      walletAddress
    }).returning()

    return c.json({ success: true, contact: newContact[0] })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// Eliminar un contacto
app.delete('/contacts/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const db = createDb(c.env.DB)
    await db.delete(contactsTable).where(eq(contactsTable.id, id))
    return c.json({ success: true, message: 'Contacto eliminado' })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
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

// 1. Crear una tarea (con Escrow)
app.post('/missions/create', async (c) => {
  try {
    const { creatorId, title, description, categoryId, reward, whatsapp } = await c.req.json()
    const db = createDb(c.env.DB)

    // Redondear a 2 decimales
    const finalReward = Math.round(reward * 100) / 100

    // NOTA: El saldo ahora se maneja 100% en la blockchain.
    // El frontend debe validar el saldo antes de llamar a este endpoint si quiere
    // que el servidor lleve un registro de misiones.
    // Por ahora, permitimos la creación de la misión para no bloquear el flujo,
    // pero en producción se debería validar contra la blockchain aquí también.
    
    await db.insert(missions).values({
      creatorId,
      title,
      description,
      categoryId,
      reward: finalReward,
      whatsapp,
      status: 'open'
    })

    return c.json({ success: true, message: 'Tarea creada correctamente' })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 2. Listar misiones abiertas
app.get('/missions/open', async (c) => {
  try {
    const userId = c.req.query('userId') ? parseInt(c.req.query('userId')!) : null
    const db = createDb(c.env.DB)
    
    const openMissions = await db.select({
      id: missions.id,
      title: missions.title,
      description: missions.description,
      categoryId: missions.categoryId,
      categoryName: missionCategories.name,
      reward: missions.reward,
      whatsapp: missions.whatsapp,
      status: missions.status,
      creatorId: missions.creatorId,
      creatorName: users.name,
      createdAt: missions.createdAt,
      // Información de postulación del usuario actual
      hasApplied: userId 
        ? sql<number>`(SELECT COUNT(*) FROM ${missionApplications} WHERE mission_id = ${missions.id} AND student_id = ${userId})`
        : sql<number>`0`,
      myBid: userId 
        ? sql<number>`(SELECT bid_amount FROM ${missionApplications} WHERE mission_id = ${missions.id} AND student_id = ${userId} LIMIT 1)`
        : sql`NULL`
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

// 2.3. Listar misiones a las que el usuario se ha postulado
app.get('/missions/my-applications/:userId', async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'))
    const db = createDb(c.env.DB)
    
    const myApplications = await db.select({
      applicationId: missionApplications.id,
      missionId: missions.id,
      title: missions.title,
      description: missions.description,
      reward: missions.reward,
      myBid: missionApplications.bidAmount,
      status: missionApplications.status,
      missionStatus: missions.status,
      creatorName: users.name,
      createdAt: missionApplications.createdAt
    })
    .from(missionApplications)
    .innerJoin(missions, eq(missionApplications.missionId, missions.id))
    .leftJoin(users, eq(missions.creatorId, users.id))
    .where(eq(missionApplications.studentId, userId))
    .orderBy(desc(missionApplications.createdAt))
    .all()

    return c.json({ success: true, applications: myApplications })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 2.2. Listar misiones de un usuario (creadas por él)
app.get('/missions/user/:userId', async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'))
    const db = createDb(c.env.DB)
    const userMissions = await db.select({
      id: missions.id,
      title: missions.title,
      description: missions.description,
      categoryId: missions.categoryId,
      categoryName: missionCategories.name,
      reward: missions.reward,
      whatsapp: missions.whatsapp,
      status: missions.status,
      creatorId: missions.creatorId,
      creatorName: users.name,
      createdAt: missions.createdAt
    })
    .from(missions)
    .leftJoin(users, eq(missions.creatorId, users.id))
    .leftJoin(missionCategories, eq(missions.categoryId, missionCategories.id))
    .where(and(
      eq(missions.creatorId, userId),
      sql`${missions.status} != 'cancelled'`
    ))
    .orderBy(desc(missions.createdAt))
    .all()

    return c.json({ success: true, missions: userMissions })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 2.1. Listar postulantes de una tarea (solo para el creador)
app.get('/missions/applications/:missionId', async (c) => {
  try {
    const missionIdStr = c.req.param('missionId')
    const missionId = parseInt(missionIdStr)
    
    if (isNaN(missionId)) {
      return c.json({ success: false, error: 'ID de tarea inválido' }, 400)
    }

    console.log('Fetching applications for mission:', missionId)
    const db = createDb(c.env.DB)

    const applications = await db.select({
      id: missionApplications.id,
      missionId: missionApplications.missionId,
      studentId: missionApplications.studentId,
      studentName: users.name,
      comment: missionApplications.comment,
      bidAmount: missionApplications.bidAmount,
      status: missionApplications.status,
      createdAt: missionApplications.createdAt
    })
    .from(missionApplications)
    .leftJoin(users, eq(missionApplications.studentId, users.id))
    .where(eq(missionApplications.missionId, missionId))
    .all()

    console.log(`Applications found for mission ${missionId}:`, applications.length)
    return c.json({ success: true, applications })
  } catch (e: any) {
    console.error('Error fetching applications:', e)
    return c.json({ success: false, error: e.message || 'Error interno al cargar postulaciones' }, 500)
  }
})

// 3. Postularse a una tarea
app.post('/missions/apply', async (c) => {
  try {
    const { missionId, studentId, comment, bidAmount } = await c.req.json()
    const db = createDb(c.env.DB)

    // Redondear a 2 decimales
    const finalBid = Math.round(bidAmount * 100) / 100

    if (!finalBid || finalBid <= 0) {
      return c.json({ success: false, message: 'La oferta debe ser mayor a 0' }, 400)
    }

    // Permitir actualizar oferta si ya existe
    const existing = await db.select().from(missionApplications)
      .where(and(eq(missionApplications.missionId, missionId), eq(missionApplications.studentId, studentId)))
      .get()
    
    if (existing) {
      if (existing.status !== 'pending') {
        return c.json({ success: false, message: 'No puedes modificar una postulación que ya ha sido procesada' }, 400)
      }

      await db.update(missionApplications)
        .set({ 
          bidAmount: finalBid,
          comment: comment || existing.comment,
          createdAt: sql`(strftime('%s', 'now'))`
        })
        .where(eq(missionApplications.id, existing.id))

      return c.json({ success: true, message: 'Oferta actualizada correctamente' })
    }

    await db.insert(missionApplications).values({
      missionId,
      studentId,
      comment,
      bidAmount: finalBid,
      status: 'pending'
    })

    return c.json({ success: true, message: 'Postulación enviada' })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 4. Aceptar a un estudiante para la tarea
app.post('/missions/accept', async (c) => {
  try {
    const { applicationId } = await c.req.json()
    const db = createDb(c.env.DB)

    const application = await db.select().from(missionApplications).where(eq(missionApplications.id, applicationId)).get()
    if (!application) return c.json({ success: false, message: 'Postulación no encontrada' }, 404)

    const mission = await db.select().from(missions).where(eq(missions.id, application.missionId)).get()
    if (!mission) return c.json({ success: false, message: 'Tarea no encontrada' }, 404)

    if (mission.status !== 'open') {
      return c.json({ success: false, message: 'La tarea ya no está abierta para nuevas asignaciones' }, 400)
    }

    const creator = await db.select().from(users).where(eq(users.id, mission.creatorId)).get()
    if (!creator) return c.json({ success: false, message: 'Creador no encontrado' }, 404)

    // NOTA: El saldo ahora se maneja 100% en la blockchain.
    // El frontend debe validar el saldo antes de llamar a este endpoint.
    
    await db.batch([
      // Marcar postulación como aceptada
      db.update(missionApplications).set({ status: 'accepted' }).where(eq(missionApplications.id, applicationId)),
      // Rechazar el resto de las postulaciones
      db.update(missionApplications)
        .set({ status: 'rejected' })
        .where(and(
          eq(missionApplications.missionId, mission.id),
          sql`${missionApplications.id} != ${applicationId}`
        )),
      // Actualizar tarea con el nuevo precio y estado
      db.update(missions).set({ 
        reward: application.bidAmount,
        status: 'assigned' 
      }).where(eq(missions.id, mission.id))
    ])

    return c.json({ 
      success: true, 
      message: 'Estudiante asignado, precio actualizado y otros postulantes rechazados',
      newPrice: application.bidAmount
    })
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

    // Permitir eliminar cualquier tarea del dueño
    const operations: any[] = [
      db.delete(missionApplications).where(eq(missionApplications.missionId, mId)),
      db.delete(missions).where(eq(missions.id, mId))
    ];

    await db.batch(operations);

    return c.json({ 
      success: true, 
      message: 'Tarea eliminada del historial' 
    });
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

    const { missionId, userId, title, description, categoryId, reward, whatsapp } = body;
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
    // Redondear a 2 decimales
    const finalReward = Math.round(rewardNum * 100) / 100

    if (finalReward !== mission.reward) {
      // NOTA: El saldo ahora se maneja 100% en la blockchain.
      // En una versión futura, esto debería requerir una transacción on-chain.
    }

    await db.update(missions).set({
      title,
      description,
      categoryId: Number(categoryId),
      reward: finalReward,
      whatsapp
    }).where(eq(missions.id, mId));

    return c.json({ success: true, message: 'Tarea actualizada correctamente' });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
})

// 7. Finalizar tarea y liberar pago
app.post('/missions/complete', async (c) => {
  try {
    const { applicationId } = await c.req.json()
    const db = createDb(c.env.DB)

    // Buscar la postulación aceptada
    const application = await db.select().from(missionApplications)
      .where(and(eq(missionApplications.id, applicationId), eq(missionApplications.status, 'accepted')))
      .get()

    if (!application) return c.json({ success: false, message: 'Postulación aceptada no encontrada' }, 404)

    const mission = await db.select().from(missions).where(eq(missions.id, application.missionId)).get()
    if (!mission) return c.json({ success: false, message: 'Tarea no encontrada' }, 404)

    const student = await db.select().from(users).where(eq(users.id, application.studentId)).get()
    if (!student) return c.json({ success: false, message: 'Estudiante no encontrado' }, 404)

    await db.batch([
      // Marcar postulación como completada
      db.update(missionApplications).set({ status: 'completed' }).where(eq(missionApplications.id, applicationId)),
      // Marcar tarea como completada
      db.update(missions).set({ status: 'completed' }).where(eq(missions.id, mission.id))
      // El pago real debe ser procesado por el cliente mediante una transacción Blockchain
    ])

    return c.json({ success: true, message: 'Trabajo completado y pago liberado' })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

export default app