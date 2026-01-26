import bcrypt from 'bcryptjs'
import { and, desc, eq, or, sql } from 'drizzle-orm'
import { ethers, Wallet } from 'ethers'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { SignJWT } from 'jose'
import { contacts as contactsTable, createDb, kvMetadata, missionApplications, missionCategories, missions, transactions, users } from './db'
import { getContract, getReadOnlyContract } from './utils/blockchain'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  RPC_URL?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors())

app.get('/', (c) => {
  return c.json({
    message: 'UTPay API - Blockchain Indexer Edition',
    status: 'ok'
  })
})

// Endpoint de Registro
app.post('/auth/register', async (c) => {
  try {
    const { email, name, password } = await c.req.json()
    const db = createDb(c.env.DB)

    // 1. Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 8)

    // 2. Generar Wallet de Blockchain
    const wallet = Wallet.createRandom()
    const seedPhrase = wallet.mnemonic?.phrase || ''
    
    // 3. Insertar usuario en la DB
    const newUser = await db.insert(users).values({
      email,
      name,
      password: hashedPassword,
      walletAddress: wallet.address
    }).returning()

    // 4. Registrar en el Smart Contract (Abstracción de Identidad)
    try {
      const contract = getContract()
      const tx = await contract.registerStudent(email, wallet.address)
      await tx.wait()
      console.log(`Estudiante ${email} registrado en blockchain con wallet ${wallet.address}`)
    } catch (blockchainError) {
      console.error('Error al registrar en blockchain:', blockchainError)
      // No bloqueamos el registro en la DB, pero lo ideal sería reintentar o marcar como pendiente
    }

    return c.json({ 
      success: true, 
      user: { 
        id: newUser[0].id, 
        email: newUser[0].email, 
        name: newUser[0].name,
        privateKey: wallet.privateKey,
        seedPhrase: seedPhrase
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
        email: user.email,
        walletAddress: user.walletAddress
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

    // Obtener balance real del contrato
    let balance = '0.0'
    try {
      const contract = getReadOnlyContract()
      const rawBalance = await contract.getBalance(user.email)
      balance = (Number(rawBalance) / 1e18).toString()
    } catch (e) {
      console.error('Error al obtener balance del contrato:', e)
    }

    return c.json({ 
      success: true, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        walletAddress: user.walletAddress,
        balance: balance
      } 
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

app.get('/users/verify-address/:address', async (c) => {
  try {
    const address = c.req.param('address')
    const db = createDb(c.env.DB)
    const user = await db.select().from(users).where(eq(users.walletAddress, address)).get()

    if (!user) {
      return c.json({ success: false, message: 'No se encontró un usuario con esa dirección' }, 404)
    }

    return c.json({ success: true, user: { id: user.id, name: user.name, email: user.email, walletAddress: user.walletAddress } })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// Endpoint para verificar un receptor por email
app.get('/users/verify-email/:email', async (c) => {
  try {
    const email = c.req.param('email')
    const db = createDb(c.env.DB)
    const user = await db.select().from(users).where(eq(users.email, email)).get()

    if (!user) {
      // Si no está en la DB local, podríamos verificar en el contrato
      try {
        const contract = getReadOnlyContract()
        await contract.getBalance(email)
        // Si no revierte, el estudiante existe en el contrato
        return c.json({ success: true, user: { name: 'Estudiante UTP', email: email } })
      } catch (contractErr) {
        return c.json({ success: false, message: 'No se encontró un usuario con ese correo' }, 404)
      }
    }

    return c.json({ 
      success: true, 
      user: { id: user.id, name: user.name, email: user.email, walletAddress: user.walletAddress } 
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// Endpoint para enviar dinero (Registro de intención)
app.post('/transactions/send', async (c) => {
  try {
    const { senderId, senderEmail, receiverEmail, amount, description, txHash } = await c.req.json()
    const db = createDb(c.env.DB)

    if (amount <= 0) {
      return c.json({ success: false, message: 'El monto debe ser mayor a 0' }, 400)
    }

    const finalAmount = Math.round(amount * 100) / 100

    // 1. Buscar emisor y receptor en la DB local para vincular IDs
    const sender = senderId 
      ? await db.select().from(users).where(eq(users.id, senderId)).get()
      : await db.select().from(users).where(eq(users.email, senderEmail)).get()
    
    const receiver = await db.select().from(users).where(eq(users.email, receiverEmail)).get()

    // 2. Registrar en la tabla de transacciones como 'pending'
    // Incluso si el receptor no está en nuestra DB (pero sí en el contrato), guardamos el correo
    await db.insert(transactions).values({
      txHash,
      senderId: sender?.id || null,
      receiverId: receiver?.id || null,
      senderEmail: sender?.email || senderEmail,
      receiverEmail: receiver?.email || receiverEmail,
      amount: finalAmount,
      description: description || `Envío a ${receiverEmail}`,
      status: 'pending'
    })

    return c.json({ success: true, message: 'Transacción registrada. El indexador la confirmará en breve.' })
  } catch (e: any) {
    console.error('Error en transferencia:', e)
    return c.json({ success: false, message: 'Error al procesar la transferencia', error: e.message }, 500)
  }
})

// Historial de transacciones (por email)
app.get('/transactions/history/:email', async (c) => {
  try {
    const email = c.req.param('email')
    const db = createDb(c.env.DB)

    // Consultar la tabla de transacciones (Caché de lectura)
    const history = await db.select()
      .from(transactions)
      .where(or(eq(transactions.senderEmail, email), eq(transactions.receiverEmail, email)))
      .orderBy(desc(transactions.createdAt))
      .all()

    const formattedHistory = history.map(tx => ({
      id: tx.txHash,
      txHash: tx.txHash,
      amount: tx.amount,
      description: tx.description,
      createdAt: tx.createdAt,
      senderName: tx.senderEmail,
      receiverName: tx.receiverEmail,
      isOutgoing: tx.senderEmail === email,
      status: tx.status
    }))

    return c.json({ success: true, history: formattedHistory })
  } catch (e: any) {
    console.error('Error en historial:', e)
    return c.json({ success: false, error: e.message }, 500)
  }
})

// --- Endpoints Internos para el Indexador ---

app.post('/internal/confirm-transaction', async (c) => {
  try {
    const { txHash, status, fromEmail, toEmail, amount, metadata } = await c.req.json()
    const db = createDb(c.env.DB)

    // Buscar si ya existe (por si fue creada por la app antes de la blockchain)
    const existing = await db.select().from(transactions).where(eq(transactions.txHash, txHash)).get()

    if (existing) {
      await db.update(transactions)
        .set({ status: status })
        .where(eq(transactions.txHash, txHash))
        .run()
    } else {
      // Insertar nueva transacción detectada por el indexador
      // Buscamos los IDs de los usuarios si existen en nuestra DB local
      const sender = await db.select().from(users).where(eq(users.email, fromEmail)).get()
      const receiver = await db.select().from(users).where(eq(users.email, toEmail)).get()

      await db.insert(transactions).values({
        txHash,
        senderId: sender?.id || 0,
        receiverId: receiver?.id || 0,
        senderEmail: fromEmail,
        receiverEmail: toEmail,
        amount: amount.toString(),
        description: metadata || '',
        status: status
      }).run()
    }

    console.log(`Indexador: Transacción ${txHash} sincronizada en DB (${status})`)
    return c.json({ success: true })
  } catch (e: any) {
    console.error('Error en confirm-transaction:', e)
    return c.json({ success: false, error: e.message }, 500)
  }
})

app.post('/internal/update-user-wallet', async (c) => {
  try {
    const { email, newWallet } = await c.req.json()
    const db = createDb(c.env.DB)

    await db.update(users)
      .set({ walletAddress: newWallet })
      .where(eq(users.email, email))
      .run()

    console.log(`Indexador: Wallet de ${email} actualizada a ${newWallet}`)
    return c.json({ success: true })
  } catch (e: any) {
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

// --- Endpoints Administrativos (Universidad) ---

app.post('/admin/mint', async (c) => {
  try {
    const { email, amount } = await c.req.json()
    const contract = getContract()
    
    console.log(`Admin: Cargando ${amount} UTP a ${email}...`)
    const tx = await contract.mint(email, ethers.parseEther(amount.toString()))
    await tx.wait()
    
    return c.json({ success: true, txHash: tx.hash })
  } catch (e: any) {
    console.error('Error en admin mint:', e)
    return c.json({ success: false, error: e.message }, 500)
  }
})

app.post('/admin/update-wallet', async (c) => {
  try {
    const { email, newWallet } = await c.req.json()
    const contract = getContract()
    
    console.log(`Admin: Actualizando wallet de ${email} a ${newWallet}...`)
    const tx = await contract.updateWallet(email, newWallet)
    await tx.wait()
    
    return c.json({ success: true, txHash: tx.hash })
  } catch (e: any) {
    console.error('Error en admin update-wallet:', e)
    return c.json({ success: false, error: e.message }, 500)
  }
})

app.get('/health', (c) => {
  return c.text('UTPay API is running!')
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

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Bindings, ctx: any) {
    ctx.waitUntil(runIndexer(env));
  },
};

async function runIndexer(env: Bindings) {
  console.log("🚀 Iniciando ronda de indexación (Scheduled)...");
  const db = createDb(env.DB);
  const contract = getReadOnlyContract();

  try {
    // 1. Obtener el último bloque procesado de la DB
    const lastBlockMeta = await db.select().from(kvMetadata).where(eq(kvMetadata.key, 'last_indexed_block')).get();
    let fromBlock = lastBlockMeta ? parseInt(lastBlockMeta.value) + 1 : 0;
    
    // 2. Obtener el bloque actual de la red
    const currentBlock = await contract.runner?.provider?.getBlockNumber();
    if (!currentBlock || fromBlock > currentBlock) {
      console.log("No hay bloques nuevos para procesar.");
      return;
    }

    // Limitamos a procesar 1000 bloques por vez para no saturar el Worker
    const toBlock = Math.min(fromBlock + 1000, currentBlock);
    console.log(`Buscando eventos desde el bloque ${fromBlock} al ${toBlock}...`);

    // 3. Consultar eventos de Transferencia
    const transferFilter = contract.filters.Transfer();
    const transferEvents = await contract.queryFilter(transferFilter, fromBlock, toBlock);

    for (const event of transferEvents) {
      if ('args' in event && event.args) {
        const [fromEmail, toEmail, amount, metadata] = event.args;
        const txHash = event.transactionHash;

        console.log(`✨ Sincronizando Transferencia: ${fromEmail} -> ${toEmail} (${ethers.formatEther(amount)} UTP)`);

        // Evitar duplicados
        const existing = await db.select().from(transactions).where(eq(transactions.txHash, txHash)).get();
        if (!existing) {
          const sender = await db.select().from(users).where(eq(users.email, fromEmail)).get();
          const receiver = await db.select().from(users).where(eq(users.email, toEmail)).get();

          await db.insert(transactions).values({
            txHash,
            senderId: sender?.id || null,
            receiverId: receiver?.id || null,
            senderEmail: fromEmail,
            receiverEmail: toEmail,
            amount: ethers.formatEther(amount),
            description: metadata || '',
            status: 'success'
          }).run();
        }
      }
    }

    // 4. Consultar eventos de Mint (Carga de saldo)
    const mintFilter = contract.filters.Mint();
    const mintEvents = await contract.queryFilter(mintFilter, fromBlock, toBlock);

    for (const event of mintEvents) {
      if ('args' in event && event.args) {
        const [email, amount] = event.args;
        const txHash = event.transactionHash;

        console.log(`💰 Sincronizando Mint: ${email} (+${ethers.formatEther(amount)} UTP)`);

        const existing = await db.select().from(transactions).where(eq(transactions.txHash, txHash)).get();
        if (!existing) {
          const receiver = await db.select().from(users).where(eq(users.email, email)).get();

          await db.insert(transactions).values({
            txHash,
            senderId: null,
            receiverId: receiver?.id || null,
            senderEmail: 'SISTEMA',
            receiverEmail: email,
            amount: ethers.formatEther(amount),
            description: 'Carga de saldo por Admin',
            status: 'success'
          }).run();
        }
      }
    }

    // 5. Actualizar el último bloque procesado
    if (lastBlockMeta) {
      await db.update(kvMetadata).set({ value: toBlock.toString() }).where(eq(kvMetadata.key, 'last_indexed_block')).run();
    } else {
      await db.insert(kvMetadata).values({ key: 'last_indexed_block', value: toBlock.toString() }).run();
    }

    console.log(`✅ Indexación completada hasta el bloque ${toBlock}`);
  } catch (error) {
    console.error("❌ Error en el indexador scheduled:", error);
  }
}