import bcrypt from 'bcryptjs'
import { and, desc, eq, or, sql } from 'drizzle-orm'
import { formatUnits, parseUnits, Wallet } from 'ethers'
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

app.get('/admin/stats', async (c) => {
  try {
    const db = createDb(c.env.DB)
    console.log('--- Admin Stats Request ---')
    
    // 1. Usuarios Totales (Excluyendo administradores)
    const usersList = await db.select().from(users).where(or(eq(users.role, 'student'), eq(users.role, 'cafeteria'), sql`${users.role} IS NULL`)).all()
    const totalUsers = usersList.length
    
    // 2. Transacciones
    const txList = await db.select().from(transactions).all()
    
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayTimestamp = Math.floor(startOfDay.getTime() / 1000);
    
    const todayTransactions = txList.filter(tx => {
      // Intentar manejar diferentes formatos de fecha (timestamp o ISO string)
      let txTime = 0;
      if (tx.createdAt) {
        txTime = typeof tx.createdAt === 'number' 
          ? tx.createdAt 
          : Math.floor(new Date(tx.createdAt).getTime() / 1000);
      }
      return txTime >= todayTimestamp;
    }).length
    
    // 3. Volumen Total (Circulación actual: Mints - Burns)
    const totalVolume = txList.reduce((acc, tx) => {
      // Solo contar transacciones exitosas
      if (tx.status !== 'success' && tx.status !== 'confirmed') return acc;
      
      const sender = (tx.senderEmail || '').trim().toUpperCase();
      const receiver = (tx.receiverEmail || '').trim().toUpperCase();
      
      if (sender === 'SISTEMA') return acc + Number(tx.amount || 0);
      if (receiver === 'SISTEMA') return acc - Number(tx.amount || 0);
      return acc;
    }, 0)
    
    // 4. Misiones Activas
    const activeMissionsList = await db.select().from(missions).where(eq(missions.status, 'open')).all()
    const activeMissions = activeMissionsList.length

    console.log('Stats:', { totalUsers, todayTransactions, totalVolume, activeMissions })

    return c.json({
      success: true,
      stats: {
        totalUsers,
        todayTransactions,
        totalVolume,
        activeMissions
      }
    })
  } catch (e: any) {
    console.error('Error en admin stats:', e)
    return c.json({ success: false, error: e.message }, 500)
  }
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
      const rpcUrl = c.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error('RPC_URL environment variable is missing');
    }

    const contract = getContract(rpcUrl)
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
    const { email, password, walletAddress } = await c.req.json()
    const db = createDb(c.env.DB)

    // 1. Buscar usuario
    const user = await db.select().from(users).where(eq(users.email, email)).get()

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return c.json({ success: false, message: 'Credenciales inválidas' }, 401)
    }

    // 2. Sincronizar Wallet Address si se proporciona y el usuario no tiene una
    let currentWalletAddress = user.walletAddress;
    if (walletAddress && (!user.walletAddress || user.walletAddress !== walletAddress)) {
      console.log(`Sincronizando wallet para ${email}: ${walletAddress}`);
      await db.update(users)
        .set({ walletAddress: walletAddress })
        .where(eq(users.id, user.id))
        .run()
      currentWalletAddress = walletAddress;
    }

    // 3. Auto-autorización de Admins en Blockchain si es necesario
    if (user.role === 'admin' && currentWalletAddress) {
      const rpcUrl = c.env.RPC_URL
      if (rpcUrl) {
        c.executionCtx.waitUntil((async () => {
          try {
            const contract = getContract(rpcUrl)
            const isAlreadyAdmin = await contract.admins(currentWalletAddress)
            
            if (!isAlreadyAdmin) {
              console.log(`[Auth-Admin] Autorizando nuevo admin ${email} (${currentWalletAddress}) en blockchain...`)
              const tx = await contract.addAdmin(currentWalletAddress)
              await tx.wait()
              console.log(`[Auth-Admin] Admin ${email} autorizado con éxito. Hash: ${tx.hash}`)
            }
          } catch (error: any) {
            console.error(`[Auth-Admin-Error] No se pudo autorizar al admin ${email}:`, error.message)
          }
        })())
      }
    }

    // 4. Generar JWT
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
        walletAddress: currentWalletAddress,
        role: user.role
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

// Endpoint para sincronizar wallet manualmente
app.post('/auth/sync-wallet', async (c) => {
  try {
    const { email, walletAddress } = await c.req.json()
    const db = createDb(c.env.DB)

    if (!email || !walletAddress) {
      return c.json({ success: false, message: 'Faltan datos requeridos' }, 400)
    }

    // 1. Buscar usuario para confirmar que existe
    const user = await db.select().from(users).where(eq(users.email, email)).get()
    if (!user) {
      return c.json({ success: false, message: 'Usuario no encontrado' }, 404)
    }

    // 2. Actualizar en DB Local
    await db.update(users)
      .set({ walletAddress: walletAddress })
      .where(eq(users.email, email))
      .run()

    console.log(`[Sync] Wallet de ${email} sincronizada a ${walletAddress}`)
    
    // 3. Registrar en Blockchain en SEGUNDO PLANO (sin bloquear la respuesta)
    const rpcUrl = c.env.RPC_URL
    if (!rpcUrl) {
      console.warn(`[Sync-Warning] RPC_URL no configurada. Saltando registro en blockchain para ${email}`)
    } else {
      c.executionCtx.waitUntil((async () => {
        try {
          const contract = getContract(rpcUrl)
          console.log(`[Sync-BG] Intentando registrar ${email} en blockchain...`)
          
          const tx = await contract.registerStudent(email, walletAddress)
          console.log(`[Sync-BG] Transacción de registro enviada: ${tx.hash}`)
          await tx.wait()
          console.log(`[Sync-BG] Estudiante ${email} registrado con éxito`)
        } catch (blockchainError: any) {
          console.error(`[Sync-BG] Error en registro blockchain: ${blockchainError.message}`)
        }
      })())
    }

    return c.json({ 
      success: true, 
      message: 'Billetera vinculada y sincronizada correctamente',
      walletAddress 
    })
  } catch (e: any) {
    console.error('Error en sync-wallet:', e)
    return c.json({ success: false, message: 'Error al sincronizar wallet', error: e.message }, 500)
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
        email: user.email,
        walletAddress: user.walletAddress,
        balance: user.balance || 0,
        role: user.role,
        statIntellect: user.statIntellect || 0,
        statStrengthConsistency: user.statStrengthConsistency || 0,
        statStrengthPR5k: user.statStrengthPR5k || 0,
        statStrengthPR10k: user.statStrengthPR10k || 0,
        statStrengthPR21k: user.statStrengthPR21k || 0,
        statStrategy: user.statStrategy || 1200,
        statZen: user.statZen || 0,
        statService: user.statService || 0,
        statHonor: user.statHonor || 5.0,
        creditScore: user.creditScore || 0,
        activeLoan: user.activeLoan || 0
      } 
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// Endpoint para actualizar estadísticas de mérito (Simulación de fuente oficial)
app.post('/users/update-merit', async (c) => {
  try {
    const { 
      email, 
      statIntellect, 
      statStrengthConsistency, 
      statStrengthPR5k, 
      statStrengthPR10k, 
      statStrengthPR21k, 
      statStrategy, 
      statZen, 
      statService,
      statHonor 
    } = await c.req.json()
    const db = createDb(c.env.DB)
    
    // 1. Calcular Puntaje de Fortaleza (Híbrido Running)
    // Lógica de Constancia (60%): (Sesiones / 12) * 100
    const puntosConstancia = Math.min((statStrengthConsistency / 12) * 100, 100)
    
    // Lógica de PR (40%): El mejor de las 3 distancias
    const calculatePRPoints = (time: number, d5: number, d8: number, d10: number) => {
      if (!time || time === 0) return 0
      if (time <= d10) return 100
      if (time <= d8) return 80 + (20 * (d8 - time) / (d8 - d10))
      if (time <= d5) return 60 + (20 * (d5 - time) / (d5 - d8))
      return Math.max(0, 60 * (1 - (time - d5) / d5))
    }

    // Umbrales (segundos): 100pts, 80pts, 60pts
    const score5k = calculatePRPoints(statStrengthPR5k, 1800, 1500, 1200) // 30m, 25m, 20m
    const score10k = calculatePRPoints(statStrengthPR10k, 3600, 3000, 2400) // 60m, 50m, 40m
    const score21k = calculatePRPoints(statStrengthPR21k, 7800, 6600, 5400) // 130m, 110m, 90m
    
    const mejorPR = Math.max(score5k, score10k, score21k)
    const puntosFortalezaTotal = (puntosConstancia * 0.6) + (mejorPR * 0.4)

    // 2. Calcular Credit Score Global (El Hexágono de Mérito v2.0)
    // 1. Intelecto (30%): Escala 0-3. (index / 3) * 30
    const pilarIntelecto = (Math.min(statIntellect, 3) / 3) * 30
    
    // 2. Fortaleza (20%): Aplicamos el puntaje total de fortaleza a su peso
    const pilarFortaleza = (puntosFortalezaTotal / 100) * 20
    
    // 3. Estrategia (15%): ELO (1200-2000). ((elo - 1200) / 800) * 15
    const pilarEstrategia = (Math.max(0, Math.min(statStrategy - 1200, 800)) / 800) * 15
    
    // 4. Zen (10%): Minutos totales (ej. 300 min/mes para el tope). (minutos / 300) * 10
    const pilarZen = (Math.min(statZen, 300) / 300) * 10
    
    // 5. Servicio (15%): 100 horas. (horas / 100) * 15
    const pilarServicio = (Math.min(statService, 100) / 100) * 15
    
    // 6. Honor (10%): Estrellas 0-5. (estrellas / 5) * 10
    const pilarHonor = (Math.min(statHonor, 5) / 5) * 10

    let score = Math.round(pilarIntelecto + pilarFortaleza + pilarEstrategia + pilarZen + pilarServicio + pilarHonor)
    score = Math.min(score, 100)

    // 3. Actualizar DB Local
    await db.update(users)
      .set({ 
        statIntellect, 
        statStrengthConsistency, 
        statStrengthPR5k,
        statStrengthPR10k,
        statStrengthPR21k,
        statStrategy,
        statZen,
        statService,
        statHonor,
        creditScore: score 
      })
      .where(eq(users.email, email))
      .run()

    // 3. Sincronizar con Blockchain (Credit Score)
    const rpcUrl = c.env.RPC_URL
    if (!rpcUrl) {
      console.warn(`[Merit-Warning] RPC_URL no configurada. Saltando actualización de mérito para ${email}`)
    } else {
      c.executionCtx.waitUntil((async () => {
        try {
          const contract = getContract(rpcUrl)
          console.log(`[Merit] Sincronizando Score ${score} para ${email} en blockchain...`)
          const tx = await contract.updateCreditScore(email, score)
          await tx.wait()
          console.log(`[Merit] Blockchain actualizada: ${tx.hash}`)
        } catch (err: any) {
          console.error('[Merit-Error] Falló sincronización blockchain:', err.message)
        }
      })())
    }

    return c.json({ 
      success: true, 
      message: 'Estadísticas de mérito actualizadas',
      score 
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// Endpoint para solicitar micro-crédito (Blockchain + DB)
app.post('/transactions/request-loan', async (c) => {
  try {
    const { email, amount, walletAddress } = await c.req.json()
    const db = createDb(c.env.DB)
    
    // 1. Verificar usuario y su mérito en DB
    const user = await db.select().from(users).where(eq(users.email, email)).get()
    if (!user) return c.json({ success: false, message: 'Usuario no encontrado' }, 404)
    
    if ((user.creditScore || 0) < 80) {
      return c.json({ success: false, message: 'Mérito insuficiente (Score < 80)' }, 403)
    }

    if ((user.activeLoan || 0) > 0) {
      return c.json({ success: false, message: 'Ya tienes un préstamo activo' }, 400)
    }

    // 2. Ejecutar en Blockchain
    const rpcUrl = c.env.RPC_URL
    if (!rpcUrl) return c.json({ success: false, message: 'Blockchain no disponible' }, 500)
    
    const contract = getContract(rpcUrl)
    console.log(`[Loan] Procesando préstamo de ${amount} para ${email}...`)
    
    const tx = await contract.requestLoan(email, Math.round(amount))
    await tx.wait()
    
    // 3. Actualizar DB Local
    await db.update(users)
      .set({ 
        activeLoan: amount,
        balance: sql`${users.balance} + ${amount}`
      })
      .where(eq(users.email, email))
      .run()

    // 4. Registrar la transacción en el historial
    await db.insert(transactions).values({
      txHash: tx.hash,
      senderEmail: 'SISTEMA_CREDITO@utp.ac.pa',
      receiverEmail: email,
      receiverId: user.id,
      amount: amount,
      description: 'Micro-crédito por Mérito Estudiantil',
      status: 'success'
    })

    return c.json({ 
      success: true, 
      message: 'Préstamo otorgado con éxito',
      txHash: tx.hash 
    })
  } catch (e: any) {
    console.error('[Loan-Error]', e.message)
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
        const contract = getReadOnlyContract(c.env.RPC_URL)
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
      // Si ya existe, actualizamos el estado y también el monto por si acaso
      await db.update(transactions)
        .set({ 
          status: status,
          amount: Number(amount)
        })
        .where(eq(transactions.txHash, txHash))
        .run()
    } else {
      // Insertar nueva transacción detectada por el indexador
      const sender = await db.select().from(users).where(eq(users.email, fromEmail)).get()
      const receiver = await db.select().from(users).where(eq(users.email, toEmail)).get()

      await db.insert(transactions).values({
        txHash,
        senderId: sender?.id || null,
        receiverId: receiver?.id || null,
        senderEmail: fromEmail,
        receiverEmail: toEmail,
        amount: Number(amount),
        description: metadata || '',
        status: status
      }).run()
    }

    // SIEMPRE sincronizamos el balance real desde la Blockchain tras una confirmación
    // para evitar inconsistencias por transacciones duplicadas o errores de cálculo local
    const rpcUrl = c.env.RPC_URL;
    if (!rpcUrl) {
      console.warn('[Internal-Warning] RPC_URL no configurada. Saltando sincronización de balances reales.')
    } else {
      const contract = getReadOnlyContract(rpcUrl);
      
      if (fromEmail && fromEmail !== 'SISTEMA') {
        try {
          const balance = await contract.getBalance(fromEmail);
          await db.update(users).set({ balance: Number(formatUnits(balance, 2)) }).where(eq(users.email, fromEmail)).run();
          console.log(`Balance actualizado (Blockchain) para ${fromEmail}`);
        } catch (e) {
          console.error(`Error actualizando balance de ${fromEmail}:`, e);
        }
      }
      
      if (toEmail && toEmail !== 'SISTEMA') {
        try {
          const balance = await contract.getBalance(toEmail);
          await db.update(users).set({ balance: Number(formatUnits(balance, 2)) }).where(eq(users.email, toEmail)).run();
          console.log(`Balance actualizado (Blockchain) para ${toEmail}`);
        } catch (e) {
          console.error(`Error actualizando balance de ${toEmail}:`, e);
        }
      }
    }

    console.log(`Indexador: Transacción ${txHash} sincronizada en DB (${status})`)
    return c.json({ success: true })
  } catch (e: any) {
    console.error('Error en confirm-transaction:', e)
    return c.json({ success: false, error: e.message }, 500)
  }
})

app.post('/internal/sync-user-balance', async (c) => {
  try {
    const { email } = await c.req.json()
    const rpcUrl = c.env.RPC_URL;
    if (!rpcUrl) return c.json({ success: false, message: 'Falta RPC_URL' }, 500);

    const contract = getReadOnlyContract(rpcUrl)
    const balance = await contract.getBalance(email)
    const balanceFormatted = Number(formatUnits(balance, 2))

    const db = createDb(c.env.DB)
    await db.update(users)
      .set({ balance: balanceFormatted })
      .where(eq(users.email, email))
      .run()

    console.log(`Balance de ${email} sincronizado manual: ${balanceFormatted} UTP`)
    return c.json({ success: true, balance: balanceFormatted })
  } catch (e: any) {
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
    // 1. Obtener todos los usuarios que NO son admin
    const result = await db.select().from(users).where(sql`${users.role} != 'admin' OR ${users.role} IS NULL`).all()
    
    // 2. Obtener saldos reales de la blockchain para cada usuario
    const contract = getReadOnlyContract(c.env.RPC_URL)
    
    const usersWithRealBalance = await Promise.all(result.map(async (u) => {
      try {
        if (!u.email) return { ...u, balance: "0" };
        const balance = await contract.getBalance(u.email);
        return { 
          ...u, 
          balance: formatUnits(balance, 2) 
        };
      } catch (err) {
        console.error(`Error obteniendo saldo para ${u.email}:`, err);
        return { ...u, balance: "0" };
      }
    }));

    return c.json(usersWithRealBalance)
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
  console.log('--- INICIO MINT REQUEST ---')
  try {
    const body = await c.req.json()
    const { email, amount } = body
    console.log(`Payload recibido: email=${email}, amount=${amount}`)
    
    const rpcUrl = c.env.RPC_URL;
    console.log(`RPC_URL configurada: ${rpcUrl}`);
    
    if (!rpcUrl) {
      console.error('ERROR: RPC_URL no está definida en las variables de entorno');
      return c.json({ success: false, message: 'Configuración incompleta: falta RPC_URL' }, 500);
    }

    let contract;
    try {
      console.log('Obteniendo instancia del contrato...');
      contract = getContract(rpcUrl)
      console.log('Instancia del contrato obtenida.');
    } catch (err: any) {
      console.error('Error al inicializar el contrato:', err);
      return c.json({ success: false, message: 'Error al conectar con la lógica de Blockchain', error: err.message }, 500);
    }
    
    // 1. Intentar el MINT directamente
    try {
      console.log(`Preparando transacción de mint para ${amount} UTP a ${email}...`);
      // En ethers v6, parseUnits está directamente en ethers o se importa
      const amountInUnits = parseUnits(amount.toString(), 2);
      
      // Intentar enviar la transacción directamente
      const tx = await contract.mint(email, amountInUnits, { gasPrice: 0 })
      console.log(`Transacción de mint enviada! Hash: ${tx.hash}`)
      
      // No esperamos al .wait() aquí para no bloquear el UI del admin
      // Pero lo registramos en el contexto de ejecución para seguimiento
      c.executionCtx.waitUntil((async () => {
        try {
          console.log(`[Mint-BG] Esperando confirmación para ${tx.hash}...`)
          const receipt = await tx.wait()
          console.log(`[Mint-BG] Confirmada en bloque ${receipt.blockNumber}`)
          
          // Forzar una indexación inmediata tras la confirmación
          console.log(`[Mint-BG] Ejecutando indexador inmediato...`);
          await runIndexer(c.env);
        } catch (waitErr: any) {
          console.error(`[Mint-BG] Error esperando confirmación de ${tx.hash}:`, waitErr.message)
        }
      })())
      
      return c.json({ 
        success: true, 
        txHash: tx.hash,
        message: 'Transacción enviada a la red. Se confirmará en unos segundos.'
      })
    } catch (txErr: any) {
      console.log('DEBUG: Error en primer intento de mint:', txErr.message);

      // 2. Si falló porque el estudiante no existe, intentar registrarlo
      const isNotRegistered = 
        txErr.message.includes('Estudiante no existe') || 
        (txErr.data && txErr.data.includes('Estudiante no existe')) ||
        txErr.message.includes('revert');

      if (isNotRegistered) {
        console.log(`El estudiante ${email} no existe en blockchain. Intentando registro automático...`);
        
        const db = createDb(c.env.DB);
        const user = await db.select().from(users).where(eq(users.email, email)).get();
        
        if (!user || !user.walletAddress) {
          return c.json({ 
            success: false, 
            message: `El usuario ${email} no tiene una billetera asociada en la base de datos local.`,
            debug: 'User or walletAddress missing in DB'
          }, 400);
        }

        try {
          console.log(`Registrando y recargando: ${email}...`);
          // Aquí sí esperamos el registro porque el mint depende de él
          const regTx = await contract.registerStudent(email, user.walletAddress, { gasPrice: 0 });
          await regTx.wait();
          console.log('Registro exitoso. Enviando mint...');
          
          const amountInUnits = parseUnits(amount.toString(), 2);
          const retryTx = await contract.mint(email, amountInUnits, { gasPrice: 0 });
          
          // El segundo mint lo enviamos y respondemos rápido también
          c.executionCtx.waitUntil((async () => {
            try {
              await retryTx.wait();
              console.log(`[Mint-Retry-BG] Mint tras registro confirmado: ${retryTx.hash}`);
              // También indexar aquí
              await runIndexer(c.env);
            } catch (err: any) {
              console.error(`[Mint-Retry-BG] Error en confirmación:`, err.message);
            }
          })());

          return c.json({ 
            success: true, 
            txHash: retryTx.hash,
            message: 'Estudiante registrado y recarga enviada con éxito.'
          });
        } catch (regErr: any) {
          console.error('Error en proceso de registro + mint:', regErr);
          return c.json({ 
            success: false, 
            message: `Error al registrar/recargar al estudiante.`,
            error: regErr.message
          }, 500);
        }
      }

      // Si fue otro error diferente a "Estudiante no existe"
      return c.json({ 
        success: false, 
        message: 'La transacción falló.',
        error: txErr.message 
      }, 500)
    }

  } catch (e: any) {
    console.error('FATAL ERROR en admin/mint:', e)
    return c.json({ 
      success: false, 
      message: 'Error interno crítico en el servidor.',
      error: e.message,
      stack: e.stack
    }, 500)
  } finally {
    console.log('--- FIN MINT REQUEST ---')
  }
})

app.post('/admin/burn', async (c) => {
  console.log('--- INICIO BURN REQUEST ---')
  try {
    const body = await c.req.json()
    const { email, amount } = body
    const rpcUrl = c.env.RPC_URL;
    
    if (!rpcUrl) return c.json({ success: false, message: 'Falta RPC_URL' }, 500);

    const contract = getContract(rpcUrl)
    const amountInUnits = parseUnits(amount.toString(), 2);
    
    try {
      console.log(`Eliminando ${amount} UTP de ${email}...`);
      const tx = await contract.burn(email, amountInUnits, { gasPrice: 0 })
      
      c.executionCtx.waitUntil((async () => {
        try {
          await tx.wait()
          console.log(`[Burn-BG] Confirmado: ${tx.hash}`)
          
          // Forzar una indexación inmediata tras la confirmación
          console.log(`[Burn-BG] Ejecutando indexador inmediato...`);
          await runIndexer(c.env);
        } catch (waitErr: any) {
          console.error(`[Burn-BG] Error en confirmación:`, waitErr.message)
        }
      })())
      
      return c.json({ 
        success: true, 
        txHash: tx.hash,
        message: 'Solicitud de retiro enviada a la red.'
      })
    } catch (txErr: any) {
      console.error('Error en burn:', txErr);
      return c.json({ 
        success: false, 
        message: 'Error al procesar el retiro en Blockchain', 
        error: txErr.message 
      }, 500);
    }
  } catch (e: any) {
    console.error('Error general en endpoint /admin/burn:', e);
    return c.json({ success: false, error: e.message }, 500);
  } finally {
    console.log('--- FIN BURN REQUEST ---')
  }
})

app.post('/admin/update-wallet', async (c) => {
  try {
    const { email, newWallet, adminId } = await c.req.json()
    const db = createDb(c.env.DB)

    // 1. Verificar que el solicitante sea admin
    if (adminId) {
      const adminUser = await db.select().from(users).where(eq(users.id, adminId)).get()
      if (!adminUser || adminUser.role !== 'admin') {
        return c.json({ success: false, message: 'No tienes permisos de administrador' }, 403)
      }
    }

    const rpcUrl = c.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error('RPC_URL environment variable is missing');
    }

    const contract = getContract(rpcUrl)
    
    console.log(`Admin: Actualizando wallet de ${email} a ${newWallet}...`)
    
    // 2. Actualizar en Blockchain
    const tx = await contract.updateWallet(email, newWallet, { gasPrice: 0 })
    console.log(`UpdateWallet TX enviada: ${tx.hash}`)
    await tx.wait()
    console.log(`UpdateWallet TX confirmada: ${tx.hash}`)

    // 3. Actualizar en DB Local inmediatamente para mejor UX
    await db.update(users)
      .set({ walletAddress: newWallet })
      .where(eq(users.email, email))
      .run()
    
    return c.json({ success: true, txHash: tx.hash })
  } catch (e: any) {
    console.error('Error en admin update-wallet:', e)
    return c.json({ success: false, error: e.message }, 500)
  }
})

app.get('/admin/transactions', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const allTransactions = await db.select().from(transactions).orderBy(desc(transactions.createdAt)).all()
    return c.json({ success: true, transactions: allTransactions })
  } catch (e: any) {
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

    // 1. Obtener email del creador para el burn
    const creator = await db.select().from(users).where(eq(users.id, creatorId)).get()
    if (!creator) return c.json({ success: false, message: 'Creador no encontrado' }, 404)

    // 2. Ejecutar Burn en Blockchain (Escrow)
    const rpcUrl = c.env.RPC_URL
    if (rpcUrl) {
      try {
        const contract = getContract(rpcUrl)
        console.log(`[Missions-Create] Burning ${finalReward} from ${creator.email} (Escrow)...`)
        const tx = await contract.burn(creator.email, Math.round(finalReward))
        await tx.wait()
        console.log(`[Missions-Create] Burn exitoso: ${tx.hash}`)
      } catch (err: any) {
        console.error('[Missions-Create-Error] Falló burn blockchain:', err.message)
        return c.json({ success: false, message: 'Error al procesar pago en blockchain (Escrow): ' + err.message }, 500)
      }
    }
    
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
        : sql`NULL`,
      myApplicationStatus: userId 
        ? sql<string>`(SELECT status FROM ${missionApplications} WHERE mission_id = ${missions.id} AND student_id = ${userId} LIMIT 1)`
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

    // 1. Ajustar saldo en Blockchain si el bid es diferente a la recompensa original
    const rpcUrl = c.env.RPC_URL
    if (rpcUrl && application.bidAmount !== mission.reward) {
      try {
        const contract = getContract(rpcUrl)
        const diff = Math.abs(application.bidAmount - mission.reward)
        const diffRounded = Math.round(diff)
        
        if (application.bidAmount > mission.reward) {
          // El estudiante pidió más, quemamos la diferencia al creador
          console.log(`[Missions-Accept] Burning extra ${diffRounded} from ${creator.email}...`)
          const tx = await contract.burn(creator.email, diffRounded)
          await tx.wait()
        } else {
          // El estudiante pidió menos, devolvemos la diferencia al creador
          console.log(`[Missions-Accept] Minting back ${diffRounded} to ${creator.email}...`)
          const tx = await contract.mint(creator.email, diffRounded)
          await tx.wait()
        }
      } catch (err: any) {
        console.error('[Missions-Accept-Error] Falló ajuste blockchain:', err.message)
        return c.json({ success: false, message: 'Error al ajustar saldo en blockchain: ' + err.message }, 500)
      }
    }
    
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

    // Si tiene postulantes o está en curso/completada, no borrar, solo cambiar estado
    const applicationsCount = await db.select({ count: sql<number>`count(*)` })
      .from(missionApplications)
      .where(eq(missionApplications.missionId, mId))
      .get();

    const hasInteractions = (applicationsCount?.count || 0) > 0 || mission.status !== 'open';

    // 1. Reembolsar en Blockchain (siempre que se cancele una tarea que estaba abierta o asignada)
    const rpcUrl = c.env.RPC_URL
    if (rpcUrl && (mission.status === 'open' || mission.status === 'assigned')) {
      try {
        const creator = await db.select().from(users).where(eq(users.id, uId)).get()
        if (creator) {
          const contract = getContract(rpcUrl)
          console.log(`[Missions-Cancel] Minting back ${mission.reward} to ${creator.email} (Refund)...`)
          const tx = await contract.mint(creator.email, Math.round(mission.reward))
          await tx.wait()
          console.log(`[Missions-Cancel] Reembolso exitoso: ${tx.hash}`)
        }
      } catch (err: any) {
        console.error('[Missions-Cancel-Error] Falló reembolso blockchain:', err.message)
        // No bloqueamos la cancelación local si falla el reembolso, 
        // pero idealmente se debería manejar mejor
      }
    }

    if (hasInteractions) {
      await db.update(missions)
        .set({ status: 'cancelled' })
        .where(eq(missions.id, mId));
      
      return c.json({ 
        success: true, 
        message: 'Tarea cancelada y mantenida en el historial por tener interacciones' 
      });
    }

    // Si no tiene interacciones, eliminar permanentemente
    const operations: any[] = [
      db.delete(missionApplications).where(eq(missionApplications.missionId, mId)),
      db.delete(missions).where(eq(missions.id, mId))
    ];

    await db.batch(operations);

    return c.json({ 
      success: true, 
      message: 'Tarea eliminada permanentemente' 
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
})

// 5.5. Marcar tarea como terminada (por el estudiante asignado)
app.post('/missions/finish', async (c) => {
  try {
    const { missionId, studentId } = await c.req.json()
    const db = createDb(c.env.DB)

    const mission = await db.select().from(missions).where(eq(missions.id, missionId)).get()
    if (!mission) return c.json({ success: false, message: 'Tarea no encontrada' }, 404)

    if (mission.status !== 'assigned') {
      return c.json({ success: false, message: 'La tarea no está en curso' }, 400)
    }

    const application = await db.select().from(missionApplications)
      .where(and(
        eq(missionApplications.missionId, missionId),
        eq(missionApplications.studentId, studentId),
        eq(missionApplications.status, 'accepted')
      ))
      .get()

    if (!application) return c.json({ success: false, message: 'No eres el estudiante asignado a esta tarea' }, 403)

    await db.update(missionApplications)
      .set({ status: 'finished' })
      .where(eq(missionApplications.id, application.id))

    return c.json({ success: true, message: 'Has marcado la tarea como terminada. Espera a que el dueño confirme.' })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
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
      // 1. Ajustar saldo en Blockchain por cambio de recompensa
      const rpcUrl = c.env.RPC_URL
      if (rpcUrl) {
        try {
          const creator = await db.select().from(users).where(eq(users.id, uId)).get()
          if (creator) {
            const contract = getContract(rpcUrl)
            const diff = Math.abs(finalReward - mission.reward)
            const diffRounded = Math.round(diff)
            
            if (finalReward > mission.reward) {
              // Aumentó la recompensa, quemamos la diferencia al creador
              console.log(`[Missions-Update] Burning extra ${diffRounded} from ${creator.email}...`)
              const tx = await contract.burn(creator.email, diffRounded)
              await tx.wait()
            } else {
              // Disminuyó la recompensa, devolvemos la diferencia al creador
              console.log(`[Missions-Update] Minting back ${diffRounded} to ${creator.email}...`)
              const tx = await contract.mint(creator.email, diffRounded)
              await tx.wait()
            }
          }
        } catch (err: any) {
          console.error('[Missions-Update-Error] Falló ajuste blockchain:', err.message)
          return c.json({ success: false, message: 'Error al ajustar saldo en blockchain: ' + err.message }, 500)
        }
      }
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

    // Buscar la postulación aceptada o terminada
    const application = await db.select().from(missionApplications)
      .where(and(
        eq(missionApplications.id, applicationId), 
        or(eq(missionApplications.status, 'accepted'), eq(missionApplications.status, 'finished'))
      ))
      .get()

    if (!application) return c.json({ success: false, message: 'Postulación aceptada o terminada no encontrada' }, 404)

    const mission = await db.select().from(missions).where(eq(missions.id, application.missionId)).get()
    if (!mission) return c.json({ success: false, message: 'Tarea no encontrada' }, 404)

    const student = await db.select().from(users).where(eq(users.id, application.studentId)).get()
    if (!student) return c.json({ success: false, message: 'Estudiante no encontrado' }, 404)

    // 1. Liberar pago en Blockchain (Mint al estudiante)
    const rpcUrl = c.env.RPC_URL
    if (rpcUrl) {
      try {
        const contract = getContract(rpcUrl)
        console.log(`[Missions-Complete] Minting ${mission.reward} to ${student.email} (Payout)...`)
        const tx = await contract.mint(student.email, Math.round(mission.reward))
        await tx.wait()
        console.log(`[Missions-Complete] Pago exitoso: ${tx.hash}`)

        // Registrar la transacción en el historial local
        await db.insert(transactions).values({
          txHash: tx.hash,
          senderEmail: 'SISTEMA_TAREAS@utp.ac.pa',
          receiverEmail: student.email,
          receiverId: student.id,
          amount: mission.reward,
          description: `Pago por tarea: ${mission.title}`,
          status: 'success'
        })
      } catch (err: any) {
        console.error('[Missions-Complete-Error] Falló pago blockchain:', err.message)
        return c.json({ success: false, message: 'Error al liberar pago en blockchain: ' + err.message }, 500)
      }
    }

    await db.batch([
      // Marcar postulación como completada
      db.update(missionApplications).set({ status: 'completed' }).where(eq(missionApplications.id, applicationId)),
      // Marcar tarea como completada
      db.update(missions).set({ status: 'completed' }).where(eq(missions.id, mission.id)),
      // Aumentar honor del estudiante (+0.1 por tarea completada)
      db.update(users)
        .set({ 
          statHonor: sql`MIN(5.0, ${users.statHonor} + 0.1)`,
          creditScore: sql`MIN(100, ${users.creditScore} + 1)`
        })
        .where(eq(users.id, student.id)),
      // Aumentar honor del creador por usar el sistema (+0.05)
      db.update(users)
        .set({ 
          statHonor: sql`MIN(5.0, ${users.statHonor} + 0.05)`,
          creditScore: sql`MIN(100, ${users.creditScore} + 1)`
        })
        .where(eq(users.id, mission.creatorId))
    ])

    return c.json({ success: true, message: 'Trabajo completado y pago liberado' })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 8. Crear reseña para una tarea
app.post('/missions/review', async (c) => {
  try {
    const { missionId, reviewerId, revieweeId, rating, comment, role } = await c.req.json()
    const db = createDb(c.env.DB)

    // Validar que la tarea esté completada
    const mission = await db.select().from(missions).where(eq(missions.id, missionId)).get()
    if (!mission || mission.status !== 'completed') {
      return c.json({ success: false, message: 'Solo se pueden reseñar tareas completadas' }, 400)
    }

    // Insertar reseña
    await db.insert(missionReviews).values({
      missionId,
      reviewerId,
      revieweeId,
      rating,
      comment,
      role
    })

    // Actualizar statHonor del reseñado
    // Si la calificación es > 3, aumenta honor, si es < 3 disminuye
    const honorChange = (rating - 3) * 0.05
    await db.update(users)
      .set({ 
        statHonor: sql`MAX(0, MIN(5.0, ${users.statHonor} + ${honorChange}))`
      })
      .where(eq(users.id, revieweeId))

    return c.json({ success: true, message: 'Reseña enviada correctamente' })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// 8.1. Obtener reseñas de un usuario
app.get('/users/reviews/:userId', async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'))
    const db = createDb(c.env.DB)
    
    const reviews = await db.select({
      id: missionReviews.id,
      rating: missionReviews.rating,
      comment: missionReviews.comment,
      role: missionReviews.role,
      createdAt: missionReviews.createdAt,
      reviewerName: users.name,
      missionTitle: missions.title
    })
    .from(missionReviews)
    .innerJoin(users, eq(missionReviews.reviewerId, users.id))
    .innerJoin(missions, eq(missionReviews.missionId, missions.id))
    .where(eq(missionReviews.revieweeId, userId))
    .orderBy(desc(missionReviews.createdAt))
    .all()

    return c.json({ success: true, reviews })
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
  const contract = getReadOnlyContract(env.RPC_URL);

  try {
    // 1. Obtener el último bloque procesado de la DB
    const lastBlockMeta = await db.select().from(kvMetadata).where(eq(kvMetadata.key, 'last_indexed_block')).get();
    let fromBlock = lastBlockMeta ? parseInt(lastBlockMeta.value) : 0;
    
    // 2. Obtener el bloque actual de la red
    let currentBlock: number;
    try {
      const blockNumber = await contract.runner?.provider?.getBlockNumber();
      if (blockNumber === undefined) throw new Error("getBlockNumber returned undefined");
      currentBlock = blockNumber;
    } catch (rpcErr: any) {
      console.error(`❌ Error al obtener bloque actual de RPC (${env.RPC_URL}):`, rpcErr.message);
      return;
    }

    console.log(`[Indexer] Bloque actual en red: ${currentBlock}, Último indexado: ${fromBlock}`);

    // Si la blockchain se reinició o el fromBlock es mayor, resetear
    if (fromBlock > currentBlock) {
      console.log(`⚠️ [Indexer] Detectado reinicio de blockchain o error de sincronía. Reseteando de ${fromBlock} a ${currentBlock}`);
      fromBlock = Math.max(0, currentBlock - 100); // Empezar un poco atrás por seguridad
    }

    if (fromBlock >= currentBlock) {
      console.log("No hay bloques nuevos para procesar.");
      return;
    }

    // Empezamos desde el siguiente bloque
    const startBlock = fromBlock + 1;
    const toBlock = Math.min(startBlock + 1000, currentBlock);
    console.log(`Buscando eventos desde el bloque ${startBlock} al ${toBlock}...`);

    // Usar el mismo contrato para todas las consultas de balance para eficiencia
    const contractReader = contract; 

    // 3. Consultar eventos de Transferencia
    console.log("Consultando eventos de Transfer...");
    const transferFilter = contract.filters.Transfer();
    const transferEvents = await contract.queryFilter(transferFilter, startBlock, toBlock);
    console.log(`Encontrados ${transferEvents.length} eventos de Transfer`);

    for (const event of transferEvents) {
      if ('args' in event && event.args) {
        const [fromEmail, toEmail, amount, metadata] = event.args;
        const txHash = event.transactionHash;

        console.log(`✨ Sincronizando Transferencia: ${fromEmail} -> ${toEmail} (${formatUnits(amount, 2)} UTP)`);

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
            amount: Number(formatUnits(amount, 2)),
            description: metadata || '',
            status: 'success'
          }).run();
        }

        // Sincronizar balances de los involucrados
        if (fromEmail && fromEmail !== 'SISTEMA') {
          const bal = await contractReader.getBalance(fromEmail);
          await db.update(users).set({ balance: Number(formatUnits(bal, 2)) }).where(eq(users.email, fromEmail)).run();
        }
        if (toEmail && toEmail !== 'SISTEMA') {
          const bal = await contractReader.getBalance(toEmail);
          await db.update(users).set({ balance: Number(formatUnits(bal, 2)) }).where(eq(users.email, toEmail)).run();
        }
      }
    }

    // 4. Consultar eventos de Mint (Carga de saldo)
    console.log("Consultando eventos de Mint...");
    const mintFilter = contract.filters.Mint();
    const mintEvents = await contract.queryFilter(mintFilter, startBlock, toBlock);
    console.log(`Encontrados ${mintEvents.length} eventos de Mint`);

    for (const event of mintEvents) {
      if ('args' in event && event.args) {
        const [email, amount] = event.args;
        const txHash = event.transactionHash;

        console.log(`✨ Sincronizando Mint: ${email} (+${formatUnits(amount, 2)} UTP)`);

        const existing = await db.select().from(transactions).where(eq(transactions.txHash, txHash)).get();
        if (!existing) {
          const receiver = await db.select().from(users).where(eq(users.email, email)).get();

          await db.insert(transactions).values({
            txHash,
            senderId: null,
            receiverId: receiver?.id || null,
            senderEmail: 'SISTEMA',
            receiverEmail: email,
            amount: Number(formatUnits(amount, 2)),
            description: 'Carga de saldo por Admin',
            status: 'success'
          }).run();
        }

        // Sincronizar balance del receptor
        const bal = await contractReader.getBalance(email);
        await db.update(users).set({ balance: Number(formatUnits(bal, 2)) }).where(eq(users.email, email)).run();
      }
    }

    // 5. Consultar eventos de Burn (Retiro de saldo)
    console.log("Consultando eventos de Burn...");
    const burnFilter = contract.filters.Burn();
    const burnEvents = await contract.queryFilter(burnFilter, startBlock, toBlock);
    console.log(`Encontrados ${burnEvents.length} eventos de Burn`);

    for (const event of burnEvents) {
      if ('args' in event && event.args) {
        const [email, amount] = event.args;
        const txHash = event.transactionHash;

        console.log(`✨ Sincronizando Burn: ${email} (-${formatUnits(amount, 2)} UTP)`);

        const existing = await db.select().from(transactions).where(eq(transactions.txHash, txHash)).get();
        if (!existing) {
          const sender = await db.select().from(users).where(eq(users.email, email)).get();

          await db.insert(transactions).values({
            txHash,
            senderId: sender?.id || null,
            receiverId: null,
            senderEmail: email,
            receiverEmail: 'SISTEMA',
            amount: Number(formatUnits(amount, 2)),
            description: 'Retiro de saldo por Admin',
            status: 'success'
          }).run();
        }

        // Sincronizar balance del emisor
        const bal = await contractReader.getBalance(email);
        await db.update(users).set({ balance: Number(formatUnits(bal, 2)) }).where(eq(users.email, email)).run();
      }
    }

    // 6. Actualizar el último bloque procesado
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