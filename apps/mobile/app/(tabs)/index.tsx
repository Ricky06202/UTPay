import { CreditMeritSection } from '@/components/CreditMeritSection';
import { LogoutButton } from '@/components/LogoutButton';
import { FeedbackModal } from '@/components/ui/FeedbackModal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UTPSymbol } from '@/components/ui/UTPSymbol';
import { API_URL } from '@/constants/api';
import { getWallet } from '@/constants/blockchain';
import { useAuth } from '@/context/auth';
import { ethers, Wallet } from 'ethers';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isWeb = Platform.OS === 'web';

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  const isDesktop = mounted && width >= 768;
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [backendStatus, setBackendStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [isSendModalVisible, setIsSendModalVisible] = useState(false);
  const [isQRModalVisible, setIsQRModalVisible] = useState(false);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [verificationStep, setVerificationStep] = useState<'input' | 'confirm'>('input');
  const [isVerifying, setIsVerifying] = useState(false);
  const [recipientData, setRecipientData] = useState<any>(null);
  const [receiverUTPId, setReceiverUTPId] = useState('');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

  // Estados para Libreta de Contactos
  const [contactsList, setContactsList] = useState<any[]>([]);
  const [isContactsModalVisible, setIsContactsModalVisible] = useState(false);
  const [isAddContactModalVisible, setIsAddContactModalVisible] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactAddress, setNewContactAddress] = useState('');
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [qrMode, setQrMode] = useState<'send' | 'add_contact'>('send');
  const [isScanResultModalVisible, setIsScanResultModalVisible] = useState(false);
  const [scannedAddress, setScannedAddress] = useState('');
  const [scannedUser, setScannedUser] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [blockchainBalance, setBlockchainBalance] = useState<string | null>(null);

  // Feedback Modal State
  const [feedback, setFeedback] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const router = useRouter();
  const { user, signOut, updateUser, refreshUser } = useAuth();
  const [showNoKeyAlert, setShowNoKeyAlert] = useState(false);
  const [importingSeed, setImportingSeed] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const fetchBlockchainBalance = async () => {
    // Ahora usamos el refreshUser del context para jalar el saldo de la API (DB local)
    // Esto es más rápido y cumple con el requerimiento de carga instantánea
    await refreshUser();
  };

  useEffect(() => {
    setMounted(true);
    checkBackend();
    if (user) {
      fetchHistory();
      fetchBlockchainBalance();
      fetchContacts();

      // Solo mostramos la alerta si NO hay llave Y NO la acabamos de importar
      // Usamos un pequeño delay o verificamos si ya se cerró manualmente
      if (!user.privateKey) {
        setShowNoKeyAlert(true);
      } else {
        setShowNoKeyAlert(false);
      }
    }

    // Intervalo para refrescar el historial automáticamente cada 15 segundos
    const historyInterval = setInterval(() => {
      if (user) {
        fetchHistory();
        fetchBlockchainBalance();
      }
    }, 15000);

    return () => clearInterval(historyInterval);
  }, [user?.id, user?.privateKey]);

  const checkBackend = async () => {
    try {
      setBackendStatus('loading');
      const response = await fetch(`${API_URL}/`);
      await response.json();
      setBackendStatus('ok');
      if (user) {
        fetchHistory();
        // refreshUser(); // Comentado para evitar sobrescribir llaves locales
      }
    } catch (error) {
      setBackendStatus('error');
    }
  };

  const fetchHistory = async () => {
    if (!user?.email) return;
    try {
      setIsLoadingHistory(true);
      const response = await fetch(`${API_URL}/transactions/history/${user.email}`);
      const data = await response.json();
      if (data.success) {
        setHistory(data.history.slice(0, 5)); // Solo los últimos 5 para el dashboard
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchContacts = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(`${API_URL}/contacts/${user.id}`);
      const data = await response.json();
      console.log('Contacts data received:', data.success, data.contacts?.length);
      if (data.success) {
        setContactsList(data.contacts || []);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const handleAddContact = async () => {
    if (!newContactName || !newContactAddress) {
      setFeedback({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Por favor completa todos los campos'
      });
      return;
    }

    if (!newContactAddress.startsWith('0x') || newContactAddress.length !== 42) {
      setFeedback({
        visible: true,
        type: 'error',
        title: 'Dirección Inválida',
        message: 'La dirección debe empezar con 0x y tener 42 caracteres'
      });
      return;
    }

    try {
      setIsAddingContact(true);
      const response = await fetch(`${API_URL}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          contactName: newContactName,
          walletAddress: newContactAddress
        })
      });
      const data = await response.json();
      console.log('Add contact response:', data);
      if (data.success) {
        setFeedback({
          visible: true,
          type: 'success',
          title: 'Contacto Guardado',
          message: `${newContactName} ha sido agregado a tu libreta`
        });
        setNewContactName('');
        setNewContactAddress('');
        setIsAddContactModalVisible(false);
        fetchContacts();
      } else {
        setFeedback({
          visible: true,
          type: 'error',
          title: 'Error',
          message: data.message || data.error || (typeof data === 'string' ? data : 'No se pudo agregar el contacto')
        });
      }
    } catch (error) {
      console.error('Error adding contact:', error);
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleDeleteContact = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/contacts/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        fetchContacts();
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
    }
  };

  const handleAmountChange = (text: string) => {
    // 1. Eliminar cualquier cosa que no sea número o punto
    let cleaned = text.replace(/[^0-9.]/g, '');
    
    // 2. Asegurar que solo haya un punto decimal
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // 3. Limitar a máximo 2 decimales
    if (parts.length > 1 && parts[1].length > 2) {
      cleaned = parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    setAmount(cleaned);
  };

  const onBarcodeScanned = async ({ data }: { data: string }) => {
    setIsScannerVisible(false);
    // Verificar si el código escaneado es una dirección de Ethereum válida
    if (data.startsWith('0x') && data.length === 42) {
      if (qrMode === 'add_contact') {
        setNewContactAddress(data);
        setIsAddContactModalVisible(true);
        
        // Intentar buscar el nombre del usuario automáticamente
        try {
          const response = await fetch(`${API_URL}/users/verify-address/${data}`);
          const result = await response.json();
          if (result.success && result.user) {
            setNewContactName(result.user.name);
          }
        } catch (e) {
          console.error('Error auto-fetching name:', e);
        }
      } else {
        // Modo dashboard: Mostrar modal de resultado "Todo en 1"
        setScannedAddress(data);
        setIsScanResultModalVisible(true);
        
    // Intentar buscar el usuario por email (ya que no tenemos dirección en DB)
    // Para simplificar, en este caso el usuario deberá ingresar el email si el QR no es reconocido
    setScannedAddress(data);
    setIsScanResultModalVisible(true);
    setScannedUser(null); // No podemos buscar por dirección en el servidor ahora
      }
    } else {
      setFeedback({
        visible: true,
        type: 'error',
        title: 'QR Inválido',
        message: 'El código QR escaneado no es una dirección válida de UTPay (Blockchain).'
      });
    }
  };

  const handleVerifyRecipient = async (idToVerify?: string) => {
    const targetId = idToVerify || receiverUTPId;

    if (!targetId || !amount) {
      setFeedback({
        visible: true,
        type: 'error',
        title: 'Campos incompletos',
        message: 'Por favor ingresa un correo o ID de estudiante y un monto.'
      });
      return;
    }

    if (targetId.toLowerCase() === user?.email?.toLowerCase()) {
      setFeedback({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'No puedes enviarte dinero a ti mismo.'
      });
      return;
    }

    try {
      setIsVerifying(true);
      // Intentar verificar por correo (Abstracción de Identidad)
      const isEmail = targetId.includes('@');
      const endpoint = isEmail ? `verify-email/${targetId}` : `verify-address/${targetId}`;
      
      const response = await fetch(`${API_URL}/users/${endpoint}`);
      const data = await response.json();

      if (data.success) {
        setRecipientData(data.user);
        setVerificationStep('confirm');
        setIsSendModalVisible(true);
      } else {
        setFeedback({
          type: 'error',
          visible: true,
          title: 'Usuario no encontrado',
          message: data.message || 'No existe ningún usuario con ese identificador.'
        });
      }
    } catch (error) {
      console.error('Error verifying recipient:', error);
      setFeedback({
        visible: true,
        type: 'error',
        title: 'Error de Conexión',
        message: 'No se pudo verificar al receptor. Revisa tu conexión.'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOpenScanner = async (mode: 'send' | 'add_contact' = 'send') => {
    setQrMode(mode);
    if (isWeb) {
       setFeedback({
         visible: true,
         type: 'info',
         title: 'No disponible en Web',
         message: 'La cámara solo está disponible en la aplicación móvil.'
       });
       return;
     }

     if (!permission?.granted) {
       const { granted } = await requestPermission();
       if (!granted) {
         setFeedback({
           visible: true,
           type: 'error',
           title: 'Permiso denegado',
           message: 'Necesitamos acceso a la cámara para escanear códigos QR.'
         });
         return;
       }
     }
     setIsScannerVisible(true);
   };

  const handleDirectImport = async () => {
    if (!importingSeed || importingSeed.trim().split(/\s+/).length !== 12) {
      setFeedback({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Por favor ingresa las 12 palabras de tu frase semilla.'
      });
      return;
    }

    setIsImporting(true);
    try {
      const cleanSeed = importingSeed.trim().toLowerCase().replace(/\s+/g, ' ');
      
      let wallet;
      try {
        wallet = Wallet.fromMnemonic(cleanSeed);
      } catch (e) {
        const hash = ethers.utils.id(cleanSeed);
        wallet = new Wallet(hash);
      }
      
      if (user) {
        // Sincronizar con la base de datos
        try {
          console.log(`Sincronizando wallet ${wallet.address} para ${user.email}...`);
          
          // Timeout de 10 segundos para la sincronización
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const syncResponse = await fetch(`${API_URL}/auth/sync-wallet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              walletAddress: wallet.address
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          const syncData = await syncResponse.json();
          if (!syncData.success) {
            console.error('Error sincronizando wallet con DB:', syncData.message);
          } else {
            console.log('Wallet sincronizada con éxito en DB');
          }
        } catch (syncErr: any) {
          if (syncErr.name === 'AbortError') {
            console.error('La sincronización tardó demasiado y fue cancelada.');
          } else {
            console.error('Error de red al sincronizar wallet:', syncErr);
          }
        }

        const updatedUser = {
          ...user,
          walletAddress: wallet.address,
          privateKey: wallet.privateKey,
          seedPhrase: cleanSeed
        };
        
        // Primero actualizamos el estado global
        await updateUser(updatedUser);
        
        // Log para verificar en consola
        console.log('Wallet imported successfully. Private key present:', !!wallet.privateKey);
        
        setShowNoKeyAlert(false);
        setImportingSeed('');
        setFeedback({
          visible: true,
          type: 'success',
          title: '¡Billetera Vinculada!',
          message: 'Tu billetera ha sido restaurada y sincronizada con tu cuenta.'
        });
      }
    } catch (err: any) {
      setFeedback({
        visible: true,
        type: 'error',
        title: 'Error',
        message: err.message
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSendMoney = async () => {
    console.log('Attempting to send money...');
    console.log('User private key available:', !!user?.privateKey);
    
    if (!recipientData?.email || !amount || !user?.privateKey) {
      setFeedback({
        visible: true,
        type: 'error', 
        title: 'Error de Llaves',
        message: 'No se encontró tu llave privada local o el correo del receptor.'
      });
      return;
    }

    try {
      setIsSending(true);

        // 0. Validar saldo antes de proceder (Balance On-Chain vs Monto)
      const currentBalance = parseFloat(user?.balance || '0');
      const sendAmount = parseFloat(amount);
      
      if (currentBalance < sendAmount) {
        setFeedback({
          visible: true,
          type: 'error',
          title: 'Saldo Insuficiente',
          message: `No tienes suficientes UTP en el contrato. Saldo actual: ${currentBalance.toFixed(2)} UTP`
        });
        setIsSending(false);
        return;
      }

      // 1. Firmar y enviar transacción al contrato UTPay usando la llave privada local
      let txHash = '';
      try {
        const wallet = getWallet(user.privateKey);
        const contract = getUTPayContract(wallet);
        
        const memo = comment || "";
        
        // Convertir monto a unidades del contrato (2 decimales)
        const amountInUnits = BigInt(Math.round(Number(amount) * 100));
        
        // Llamar a transferByEmail en lugar de transferencia nativa
        const tx = await contract.transferByEmail(
          recipientData.email,
          amountInUnits,
          memo,
          { gasPrice: 0 }
        );
        
        txHash = tx.hash;
        console.log('UTPay Contract Transaction Sent:', txHash);
      } catch (blockchainError: any) {
        console.error('Blockchain Error:', blockchainError);
        throw new Error('Error al firmar transacción en el contrato: ' + (blockchainError.message || 'Error desconocido'));
      }

      // 2. Notificar al backend para registro en el historial (Caché Indexador)
      const response = await fetch(`${API_URL}/transactions/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.id,
          senderEmail: user.email,
          receiverEmail: recipientData.email,
          amount: parseFloat(amount),
          description: comment ? comment : `Transferencia a ${recipientData.email}`,
          txHash: txHash
        })
      });

      const data = await response.json();

      if (data.success) {
        setFeedback({
          visible: true,
          type: 'success', 
          title: '¡Éxito!',
          message: `Has enviado ${amount} UTP. La transacción ha sido firmada localmente y enviada a la red.`
        });
        setIsSendModalVisible(false);
        setReceiverUTPId('');
        setAmount('');
        setComment('');
        setRecipientData(null);
        setVerificationStep('input');
        
        fetchHistory();
        // El refreshUser ya no es necesario para el balance ya que se jala de la blockchain
        fetchBlockchainBalance();
      } else {
        throw new Error(data.message || 'Error al registrar el envío');
      }
    } catch (err: any) {
      setFeedback({
        visible: true,
        type: 'error',
        title: 'Error en el envío',
        message: err.message || 'No se pudo completar la transferencia.'
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseSendModal = () => {
    setIsSendModalVisible(false);
    setTimeout(() => {
      setVerificationStep('input');
      setRecipientData(null);
      setReceiverUTPId('');
      setAmount('');
      setComment('');
    }, 300);
  };

  return (
    <View 
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      style={{ 
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }} 
    >
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
          paddingBottom: insets.bottom + 80,
          alignItems: 'center',
          width: '100%'
        }}
      >
        <View className={`px-4 sm:px-6 w-full ${isDesktop ? 'max-w-5xl' : ''}`}>
          
            {/* Header */}
            <View className="flex-row justify-between items-center pt-2 pb-6">
              <View>
                <Text className="text-lg font-medium text-gray-500 dark:text-gray-400">Panel de Control {user?.role === 'admin' ? '(Admin)' : ''}</Text>
                <Text className="text-3xl font-bold text-gray-900 dark:text-white">Hola, {user?.name || 'Estudiante'}</Text>
              </View>
              <View className="flex-row items-center">
                {user?.role === 'admin' && (
                  <TouchableOpacity 
                    onPress={() => router.push('/admin')}
                    className="flex-row items-center px-4 py-2 mr-4 bg-purple-100 rounded-full border border-purple-200 shadow-sm dark:bg-purple-900/30 dark:border-purple-800"
                  >
                    <IconSymbol size={18} name="shield.fill" color="#9333ea" />
                    <Text className="ml-2 text-xs font-bold text-purple-700 dark:text-purple-300">PANEL ADMIN</Text>
                  </TouchableOpacity>
                )}
              <TouchableOpacity 
                onPress={checkBackend}
                className="flex-row items-center px-4 py-2 mr-4 bg-white rounded-full border border-gray-100 shadow-sm dark:bg-gray-800 dark:border-gray-700"
              >
                <View className={`h-2 w-2 rounded-full mr-2 ${
                  backendStatus === 'ok' ? 'bg-green-500' : 
                  backendStatus === 'loading' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <Text className="text-xs font-bold text-gray-600 dark:text-gray-300">
                  {backendStatus === 'ok' ? 'API ONLINE' : 
                   backendStatus === 'loading' ? 'CONECTANDO...' : 'REINTENTAR CONEXIÓN'}
                </Text>
              </TouchableOpacity>
              
              <LogoutButton />
            </View>
          </View>

          {/* Main Content Layout */}
          <View className={`flex-1 ${isDesktop ? 'flex-row space-x-8 items-start' : 'flex-col'}`}>
            
            {/* Columna Izquierda: Saldo y Servicios */}
            <View className={isDesktop ? 'flex-[1.5]' : 'w-full'}>
              
              <View className={`${isDesktop ? 'flex-row mb-10 space-x-6' : 'flex-col'}`}>
                {/* Card de Saldo */}
                <View className={`bg-purple-600 rounded-[40px] p-8 shadow-2xl shadow-purple-500/30 ${isDesktop ? 'flex-1 mb-0' : 'mb-6'} min-h-[220px]`}>
                  <Text className="mb-1 text-base font-medium text-purple-100">Saldo disponible</Text>
                  <View className="flex-row items-center mb-2">
                     <UTPSymbol size={40} color="white" containerStyle={{ marginRight: 12 }} />
                     <Text className="text-5xl font-bold text-white">
                       {user?.balance ? parseFloat(user.balance).toFixed(2) : '0.00'}
                     </Text>
                   </View>
                  {user?.balance !== undefined && (
                    <Text className="mb-6 text-xs font-medium text-purple-200/60">
                      Saldo sincronizado ⚡
                    </Text>
                  )}
                  {!blockchainBalance && <View className="mb-6" />}
                  <View className="flex-row space-x-3">
                    <TouchableOpacity className="flex-1 justify-center items-center h-12 rounded-xl bg-white/20">
                      <Text className="font-bold text-white">Recargar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setIsSendModalVisible(true)}
                      className="flex-1 justify-center items-center h-12 bg-white rounded-xl shadow-sm"
                    >
                      <Text className="font-bold text-purple-600">Enviar</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Acciones de PC (Solo se ven en Web al lado del saldo) */}
                {isDesktop && (
                  <View className="flex-1 justify-between py-2">
                    <TouchableOpacity className="flex-row items-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                      <View className="p-3 mr-4 bg-purple-50 rounded-2xl dark:bg-purple-900/20">
                        <IconSymbol name="chevron.left.forwardslash.chevron.right" size={24} color="#9333ea" />
                      </View>
                      <View>
                        <Text className="font-bold text-gray-800 dark:text-white">Ver Estadísticas</Text>
                        <Text className="text-xs text-gray-500">Analiza tus gastos del mes</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-row items-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                      <View className="p-3 mr-4 bg-amber-50 rounded-2xl dark:bg-amber-900/20">
                        <IconSymbol name="payments" size={24} color="#d97706" />
                      </View>
                      <View>
                        <Text className="font-bold text-gray-800 dark:text-white">Beneficios UTP</Text>
                        <Text className="text-xs text-gray-500">Cupones y descuentos activos</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Grid de Servicios */}
              <Text className="mb-6 text-2xl font-bold text-gray-800 dark:text-white">Servicios UTP</Text>
              <View className="flex-row flex-wrap justify-between">
                {[
                  { name: 'Escanear QR', icon: 'qr.code', color: 'bg-purple-100 dark:bg-purple-900/30', iconColor: '#a855f7', action: handleOpenScanner },
                  { name: 'Tareas', icon: 'assignment', color: 'bg-green-100 dark:bg-green-900/30', iconColor: '#22c55e', action: () => router.push('/missions') },
                  { name: 'Transporte', icon: 'bus', color: 'bg-orange-100 dark:bg-orange-900/30', iconColor: '#f97316' },
                  { name: 'Cafetería', icon: 'coffee', color: 'bg-purple-100 dark:bg-purple-900/30', iconColor: '#9333ea' },
                  { name: 'Contactos', icon: 'person.2.fill', color: 'bg-red-100 dark:bg-red-900/30', iconColor: '#ef4444', action: () => setIsContactsModalVisible(true) },
                  { name: 'Mi QR', icon: 'account.circle', color: 'bg-gray-100 dark:bg-gray-800', iconColor: '#6b7280', action: () => setIsQRModalVisible(true) }
                ].map((action, index) => (
                  <TouchableOpacity 
                    key={index} 
                    onPress={action.action}
                    className={`${isDesktop ? 'w-[31%]' : 'w-[48%]'} bg-white dark:bg-gray-800 p-6 rounded-[32px] mb-6 shadow-sm items-center justify-center h-40 border border-gray-50 dark:border-gray-700`}
                  >
                    <View className={`${action.color} p-4 rounded-2xl mb-3`}>
                      <IconSymbol name={action.icon as any} size={32} color={action.iconColor} />
                    </View>
                    <Text className="text-base font-bold text-center text-gray-700 dark:text-gray-200">{action.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Nueva Sección de Mérito y Crédito (Tesis) */}
              <CreditMeritSection />
            </View>

            {/* Columna Derecha: Actividad (Solo en PC) */}
            <View className={isDesktop ? 'flex-1' : 'mt-10 w-full'}>
              {/* Sección de Mi Billetera Blockchain */}
              <View className="p-6 mb-8 w-full bg-white rounded-3xl border border-gray-100 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                <View className="flex-row items-center mb-6">
                  <View className="p-2 mr-3 bg-purple-100 rounded-lg dark:bg-purple-900/30">
                    <IconSymbol name="lock.fill" size={20} color="#9333ea" />
                  </View>
                  <Text className="text-xl font-bold text-gray-900 dark:text-white">Mi Billetera Blockchain</Text>
                </View>
                
                <View className="gap-y-6">
                  <View>
                    <Text className="mb-2 text-xs font-bold tracking-widest text-gray-400 uppercase">Dirección Pública</Text>
                    <View className="flex-row justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 dark:bg-gray-700/50 dark:border-gray-700">
                      <Text className="flex-1 mr-4 font-mono text-xs text-gray-600 dark:text-gray-300" numberOfLines={1}>
                        {user?.walletAddress || 'No generada'}
                      </Text>
                      <TouchableOpacity 
                        style={{ 
                          padding: 10, 
                          backgroundColor: 'rgba(147, 51, 234, 0.1)', 
                          borderRadius: 12 
                        }}
                        onPress={async () => {
                          if (user?.walletAddress) {
                            if (Platform.OS !== 'web') {
                              await Clipboard.setStringAsync(user.walletAddress);
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            } else {
                              navigator.clipboard.writeText(user.walletAddress);
                            }
                            setFeedback({
                              visible: true,
                              type: 'success',
                              title: 'Copiado',
                              message: 'Dirección copiada al portapapeles.'
                            });
                          }
                        }}
                      >
                        <IconSymbol name="doc.on.doc" size={20} color="#9333ea" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity 
                    onPress={() => setShowNoKeyAlert(true)}
                    className={`p-4 rounded-2xl flex-row items-center border ${
                      user?.privateKey 
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/20' 
                        : 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/20'
                    }`}
                  >
                    <View className={`p-2 mr-3 rounded-lg ${user?.privateKey ? 'bg-green-600' : 'bg-purple-600'}`}>
                      <IconSymbol name={user?.privateKey ? 'checkmark.circle.fill' : 'key.fill'} size={16} color="white" />
                    </View>
                    <View className="flex-1">
                      <Text className={`font-bold text-sm ${user?.privateKey ? 'text-green-700 dark:text-green-300' : 'text-purple-700 dark:text-purple-300'}`}>
                        {user?.privateKey ? 'Billetera Vinculada' : 'Importar Frase Secreta'}
                      </Text>
                      <Text className={`text-[10px] ${user?.privateKey ? 'text-green-600/60 dark:text-green-400/60' : 'text-purple-600/60 dark:text-purple-400/60'}`}>
                        {user?.privateKey ? 'Llave cargada y lista para firmar' : 'Para firmar transacciones localmente'}
                      </Text>
                    </View>
                    {user?.privateKey && (
                      <View className="mr-2 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded-full">
                        <Text className="text-[8px] font-bold text-green-700 dark:text-green-300 uppercase">Seguro</Text>
                      </View>
                    )}
                    <IconSymbol name="chevron.right" size={16} color={user?.privateKey ? '#16a34a' : '#9333ea'} />
                  </TouchableOpacity>
                </View>
              </View>
              <View className="bg-white dark:bg-gray-800 rounded-[40px] p-8 shadow-sm border border-gray-50 dark:border-gray-700">
                <Text className="mb-6 text-xl font-bold text-gray-800 dark:text-white">Actividad Reciente</Text>
                
                {isLoadingHistory ? (
                  <ActivityIndicator color="#9333ea" />
                ) : history.length === 0 ? (
                  <Text className="py-4 text-center text-gray-500">No hay transacciones aún</Text>
                ) : (
                  history.map((item, i) => {
                    const isExpense = item.senderId === user?.id;
                    const displayName = isExpense ? `A: ${item.receiverName}` : `De: ${item.senderName}`;
                    return (
                      <TouchableOpacity 
                        key={i} 
                        onPress={() => {
                          setSelectedTransaction(item);
                          setIsDetailModalVisible(true);
                        }}
                        className="flex-row justify-between items-center mb-6 last:mb-0"
                      >
                        <View className="overflow-hidden flex-row flex-1 items-center mr-4">
                          <View className={`h-10 w-10 rounded-full items-center justify-center mr-3 flex-shrink-0 ${!isExpense ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                            <IconSymbol 
                              name={!isExpense ? 'add' : 'remove'} 
                              size={18} 
                              color={!isExpense ? '#22c55e' : '#ef4444'} 
                            />
                          </View>
                          <View className="overflow-hidden flex-1">
                            <Text 
                              className="font-medium text-gray-700 dark:text-gray-300"
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {item.description && (item.description.startsWith('A: ') || item.description.startsWith('De: ')) 
                                ? item.description 
                                : displayName}
                            </Text>
                            <Text className="text-xs text-gray-400" numberOfLines={1}>
                              {new Date(item.createdAt).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>
                        <View className="flex-shrink-0 ml-2 flex-row items-center">
                           <UTPSymbol size={14} color={!isExpense ? '#22c55e' : '#ef4444'} containerStyle={{ marginRight: 4 }} />
                           <Text className={`font-bold ${!isExpense ? 'text-green-500' : 'text-red-500'}`}>
                             {!isExpense ? '+' : '-'}{Number(item.amount || 0).toFixed(2)}
                           </Text>
                         </View>
                      </TouchableOpacity>
                    );
                  })
                )}
                
                <TouchableOpacity 
                  onPress={() => router.push('/explore')}
                  className="items-center py-4 mt-4 border-t border-gray-50 dark:border-gray-700"
                >
                  <Text className="font-bold text-purple-600">Ver todo el historial</Text>
                </TouchableOpacity>
              </View>
            </View>

          </View>
        </View>

        {/* Modal para Enviar Dinero (Con Verificación Estilo Yappy) */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isSendModalVisible}
          onRequestClose={handleCloseSendModal}
        >
          <View className={`flex-1 ${isDesktop ? 'justify-center' : 'justify-end'} items-center px-0 bg-black/50`}>
            <View className={`bg-white dark:bg-gray-800 w-full max-w-md p-8 ${isDesktop ? 'rounded-[40px]' : 'rounded-t-[50px]'} shadow-2xl`}>
              
              {verificationStep === 'input' ? (
                <>
                  <Text className="mb-6 text-2xl font-bold text-center text-gray-900 dark:text-white">Enviar UTP Coins</Text>
                  
                  <Text className="mb-2 ml-2 text-gray-500">Dirección del receptor (Blockchain)</Text>
                  <View className="flex-row items-center p-4 mb-4 bg-gray-50 rounded-2xl dark:bg-gray-700">
                    <TextInput
                      className="flex-1 font-mono text-xs dark:text-white"
                      placeholder="0x..."
                      placeholderTextColor="#9ca3af"
                      value={receiverUTPId}
                      onChangeText={(text) => {
                        setReceiverUTPId(text);
                      }}
                    />
                    <TouchableOpacity 
                      onPress={() => {
                        setIsSendModalVisible(false);
                        setIsContactsModalVisible(true);
                      }}
                      className="p-2 ml-2 bg-purple-100 rounded-lg dark:bg-purple-900/30"
                    >
                      <IconSymbol name="person.2.fill" size={20} color="#9333ea" />
                    </TouchableOpacity>
                  </View>

                  <Text className="mb-2 font-bold text-gray-700 dark:text-gray-300">Monto a enviar (UTP)</Text>
                  <TextInput
                    className="p-4 mb-4 text-2xl font-black text-purple-600 bg-gray-50 rounded-2xl dark:bg-gray-700"
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={handleAmountChange}
                  />

                  <Text className="mb-2 font-bold text-gray-700 dark:text-gray-300">Comentario (Opcional)</Text>
                  <TextInput
                    className="p-4 mb-6 text-gray-700 bg-gray-50 rounded-2xl dark:bg-gray-700 dark:text-white"
                    placeholder="¿Para qué es este envío?"
                    placeholderTextColor="#9ca3af"
                    value={comment}
                    onChangeText={setComment}
                    maxLength={50}
                  />

                  <View className="flex-row space-x-4">
                    <TouchableOpacity 
                      onPress={handleCloseSendModal}
                      className="flex-1 justify-center items-center h-14 bg-gray-100 rounded-2xl dark:bg-gray-700"
                    >
                      <Text className="font-bold text-gray-600 dark:text-gray-300">Cancelar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      onPress={() => handleVerifyRecipient()}
                      disabled={isVerifying}
                      className="justify-center items-center h-14 bg-purple-600 rounded-2xl shadow-lg flex-2 shadow-purple-500/30"
                    >
                      {isVerifying ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text className="px-8 text-lg font-bold text-white">Verificar Receptor</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View className="items-center mb-6">
                    <View className="p-4 mb-4 bg-purple-50 rounded-full dark:bg-purple-900/20">
                      <IconSymbol name="paperplane.fill" size={32} color="#9333ea" />
                    </View>
                    <Text className="text-2xl font-bold text-center text-gray-900 dark:text-white">Confirmar Envío</Text>
                  </View>

                  <View className="p-6 mb-8 bg-gray-50 rounded-3xl dark:bg-gray-700">
                    <View className="flex-row justify-between pb-4 mb-4 border-b border-gray-200 dark:border-gray-600">
                      <Text className="text-gray-500 dark:text-gray-400">Enviar a:</Text>
                      <View className="items-end">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white">{recipientData?.name}</Text>
                        <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">{recipientData?.email}</Text>
                        <Text className="text-[10px] font-mono text-purple-600 truncate w-32" numberOfLines={1}>{receiverUTPId}</Text>
                      </View>
                    </View>

                    {comment ? (
                      <View className="pb-4 mb-4 border-b border-gray-200 dark:border-gray-600">
                        <Text className="mb-1 text-gray-500 dark:text-gray-400">Mensaje:</Text>
                        <Text className="italic text-gray-700 dark:text-gray-300">"{comment}"</Text>
                      </View>
                    ) : null}
                    
                    <View className="flex-row justify-between items-center">
                      <Text className="text-gray-500 dark:text-gray-400">Monto total:</Text>
                      <View className="flex-row items-center">
                        <UTPSymbol size={20} color="#9333ea" containerStyle={{ marginRight: 6 }} />
                        <Text className="text-3xl font-black text-gray-900 dark:text-white">{parseFloat(amount).toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>

                  <View className="flex-row space-x-4">
                    <TouchableOpacity 
                      onPress={() => setVerificationStep('input')}
                      className="flex-1 justify-center items-center h-14 bg-gray-100 rounded-2xl dark:bg-gray-700"
                    >
                      <Text className="font-bold text-gray-600 dark:text-gray-300">Atrás</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      onPress={handleSendMoney}
                      disabled={isSending}
                      className="justify-center items-center h-14 bg-green-600 rounded-2xl shadow-lg flex-2 shadow-green-500/30"
                    >
                      {isSending ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text className="px-8 text-lg font-bold text-white">Confirmar y Enviar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Modal para ver detalles de la transacción */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isDetailModalVisible}
          onRequestClose={() => setIsDetailModalVisible(false)}
        >
          <View className={`flex-1 ${isDesktop ? 'justify-center' : 'justify-end'} items-center bg-black/50`}>
            <View className={`bg-white dark:bg-gray-800 p-8 ${isDesktop ? 'rounded-[40px] max-w-md' : 'rounded-t-[50px]'} w-full shadow-2xl`}>
              <View className="items-center mb-6">
                <View className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-6" />
                <View className={`p-4 mb-4 rounded-full ${selectedTransaction?.senderId === user?.id ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                  <IconSymbol 
                    name={selectedTransaction?.senderId === user?.id ? 'arrow.up.right.circle.fill' : 'arrow.down.left.circle.fill'} 
                    size={40} 
                    color={selectedTransaction?.senderId === user?.id ? '#ef4444' : '#22c55e'} 
                  />
                </View>
                <Text className="text-3xl font-black text-gray-900 dark:text-white flex-row items-center">
                   {selectedTransaction?.senderId === user?.id ? '-' : '+'}
                   <UTPSymbol size={24} color={selectedTransaction?.senderId === user?.id ? '#ef4444' : '#22c55e'} containerStyle={{ marginHorizontal: 4 }} />
                   {Number(selectedTransaction?.amount || 0).toFixed(2)}
                 </Text>
                <Text className="text-gray-500 dark:text-gray-400 mt-1">
                  {selectedTransaction ? new Date(Number(selectedTransaction.createdAt) * 1000).toLocaleString() : ''}
                </Text>
              </View>

              <View className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-3xl mb-8">
                <View className="flex-row justify-between mb-4 border-b border-gray-100 dark:border-gray-600 pb-4">
                  <Text className="text-gray-500">Estado</Text>
                  <View className="flex-row items-center">
                    <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                    <Text className="font-bold text-green-600">Completado</Text>
                  </View>
                </View>

                <View className="flex-row justify-between mb-4 border-b border-gray-100 dark:border-gray-600 pb-4">
                  <Text className="text-gray-500">
                    {selectedTransaction?.senderId === user?.id ? 'Enviado a' : 'Recibido de'}
                  </Text>
                  <Text className="font-bold text-gray-900 dark:text-white">
                    {selectedTransaction?.senderId === user?.id ? selectedTransaction?.receiverName : selectedTransaction?.senderName}
                  </Text>
                </View>

                <View className="mb-4">
                  <Text className="text-gray-500 mb-2">Comentario / Descripción</Text>
                  <Text className="text-gray-800 dark:text-gray-200 italic">
                    "{selectedTransaction?.description || 'Sin comentario'}"
                  </Text>
                </View>

                {selectedTransaction?.txHash && (
                  <View className="mt-2 pt-4 border-t border-gray-100 dark:border-gray-600">
                    <Text className="text-gray-500 mb-1">Hash de Transacción (Blockchain)</Text>
                    <Text className="text-[10px] font-mono text-purple-600 dark:text-purple-400">
                      {selectedTransaction.txHash}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity 
                onPress={() => setIsDetailModalVisible(false)}
                className="justify-center items-center w-full h-14 bg-gray-900 rounded-2xl dark:bg-gray-700"
              >
                <Text className="text-lg font-bold text-white">Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal para Mostrar Mi QR */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={isQRModalVisible}
          onRequestClose={() => setIsQRModalVisible(false)}
        >
          <View className={`flex-1 justify-center items-center px-6 ${isDesktop ? 'bg-black/40' : 'bg-black/50'}`}>
            <View className={`bg-white dark:bg-gray-800 w-full ${isDesktop ? 'max-w-sm' : ''} p-10 rounded-[50px] items-center shadow-2xl`}>
              <View className="p-4 mb-6 bg-purple-50 rounded-3xl dark:bg-purple-900/20">
                <IconSymbol name="qr.code" size={32} color="#9333ea" />
              </View>
              
              <Text className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Mi Código QR</Text>
              <Text className="mb-8 text-center text-gray-500">Muestra este código para recibir transferencias</Text>
              
              <View className="p-6 bg-white rounded-[40px] shadow-sm border border-gray-100">
                <QRCode
                  value={user?.walletAddress || 'no-address'}
                  size={200}
                  color="#1f2937"
                  backgroundColor="white"
                />
              </View>
              
              <View className="px-6 py-3 mt-8 bg-gray-50 rounded-full dark:bg-gray-700">
                <Text className="text-[10px] font-mono text-purple-600 dark:text-purple-400">
                  {user?.walletAddress || 'Sin dirección'}
                </Text>
              </View>
              
              <TouchableOpacity 
                  onPress={() => setIsQRModalVisible(false)}
                  className="justify-center items-center w-full h-14 bg-purple-600 rounded-2xl shadow-sm"
                >
                  <Text className="text-lg font-bold text-white">Cerrar</Text>
                </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal para el Escáner QR */}
        <Modal
          animationType="slide"
          visible={isScannerVisible}
          onRequestClose={() => setIsScannerVisible(false)}
        >
          <View className="flex-1 bg-black">
            <CameraView
              style={StyleSheet.absoluteFillObject}
              onBarcodeScanned={onBarcodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
            />
            
            {/* Overlay del escáner */}
            <View className="flex-1 justify-center items-center">
              <View className="w-64 h-64 rounded-3xl border-2 border-white/50" />
              <Text className="px-6 py-2 mt-10 text-lg font-bold text-white rounded-full bg-black/50">
                Escanea el código QR UTPay
              </Text>
            </View>
            
            {/* Botón para cerrar escáner */}
            <TouchableOpacity 
              onPress={() => setIsScannerVisible(false)}
              style={{ position: 'absolute', top: insets.top + 20, right: 20 }}
              className="p-4 rounded-full bg-white/20"
            >
              <IconSymbol name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Modal de Libreta de Contactos */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isContactsModalVisible}
          onRequestClose={() => setIsContactsModalVisible(false)}
        >
          <View className={`flex-1 ${isDesktop ? 'justify-center items-center' : 'justify-end'} bg-black/50`}>
            <View className={`bg-white dark:bg-gray-800 p-8 ${isDesktop ? 'rounded-[40px] max-w-2xl w-full max-h-[80%]' : 'rounded-t-[50px] h-[80%]'} shadow-2xl`}>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-bold text-gray-900 dark:text-white">Libreta de Contactos</Text>
                <TouchableOpacity 
                  onPress={() => setIsAddContactModalVisible(true)}
                  className="p-2 bg-blue-100 rounded-full dark:bg-blue-900/30"
                >
                  <IconSymbol name="plus" size={20} color="#2563eb" />
                </TouchableOpacity>
              </View>

              <ScrollView className="flex-1">
                {contactsList.length === 0 ? (
                  <View className="items-center py-20">
                    <IconSymbol name="person.crop.circle.badge.plus" size={64} color="#d1d5db" />
                    <Text className="mt-4 text-gray-500 text-center">Aún no tienes contactos guardados</Text>
                  </View>
                ) : (
                  contactsList.map((contact) => (
                    <TouchableOpacity 
                      key={contact.id}
                      onPress={() => {
                        setReceiverUTPId(contact.walletAddress);
                        setIsContactsModalVisible(false);
                        setIsSendModalVisible(true);
                        setVerificationStep('input');
                      }}
                      className="flex-row items-center p-4 mb-4 bg-gray-50 rounded-2xl dark:bg-gray-700/50"
                    >
                      <View className="w-12 h-12 bg-purple-100 rounded-full items-center justify-center mr-4 dark:bg-purple-900/30">
                        <Text className="text-xl font-bold text-purple-600">{contact.contactName[0].toUpperCase()}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white">{contact.contactName}</Text>
                        <Text className="text-xs text-gray-500 font-mono" numberOfLines={1}>{contact.walletAddress}</Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => handleDeleteContact(contact.id)}
                        className="p-2"
                      >
                        <IconSymbol name="trash.fill" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              <TouchableOpacity 
                onPress={() => setIsContactsModalVisible(false)}
                className="justify-center items-center w-full h-14 bg-gray-900 rounded-2xl dark:bg-gray-700 mt-4"
              >
                <Text className="text-lg font-bold text-white">Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal para Agregar Contacto */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={isAddContactModalVisible}
          onRequestClose={() => setIsAddContactModalVisible(false)}
        >
          <View className={`flex-1 justify-center items-center px-6 ${isDesktop ? 'bg-black/40' : 'bg-black/60'}`}>
            <View className={`bg-white dark:bg-gray-800 p-8 rounded-[40px] shadow-2xl ${isDesktop ? 'max-w-md w-full' : 'w-full'}`}>
              <Text className="mb-6 text-2xl font-bold text-center text-gray-900 dark:text-white">Nuevo Contacto</Text>
              
              <Text className="mb-2 ml-2 text-gray-500">Nombre del contacto</Text>
              <TextInput
                className="p-4 mb-4 bg-gray-50 rounded-2xl dark:bg-gray-700 dark:text-white"
                placeholder="Ej: Mi Papá"
                placeholderTextColor="#9ca3af"
                value={newContactName}
                onChangeText={setNewContactName}
              />

              <Text className="mb-2 ml-2 text-gray-500">Dirección Blockchain (0x...)</Text>
              <View className="flex-row items-center p-4 mb-6 bg-gray-50 rounded-2xl dark:bg-gray-700">
                <TextInput
                  className="flex-1 font-mono text-xs dark:text-white"
                  placeholder="0x..."
                  placeholderTextColor="#9ca3af"
                  value={newContactAddress}
                  onChangeText={setNewContactAddress}
                />
                <TouchableOpacity 
                  onPress={() => {
                    setIsAddContactModalVisible(false);
                    handleOpenScanner('add_contact');
                  }}
                  className="p-2 ml-2 bg-purple-100 rounded-lg dark:bg-purple-900/30"
                >
                  <IconSymbol name="qr.code" size={20} color="#a855f7" />
                </TouchableOpacity>
              </View>

              <View className="flex-row space-x-4">
                <TouchableOpacity 
                  onPress={() => setIsAddContactModalVisible(false)}
                  className="flex-1 justify-center items-center h-14 bg-gray-100 rounded-2xl dark:bg-gray-700"
                >
                  <Text className="font-bold text-gray-600 dark:text-gray-300">Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={handleAddContact}
                  disabled={isAddingContact}
                  className="justify-center items-center h-14 bg-purple-600 rounded-2xl flex-2"
                >
                  {isAddingContact ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="px-8 text-lg font-bold text-white">Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal de Resultado de Escaneo (Todo en 1) */}
        <Modal
          visible={isScanResultModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsScanResultModalVisible(false)}
        >
          <View className={`flex-1 justify-center items-center px-6 ${isDesktop ? 'bg-black/40' : 'bg-black/60'}`}>
            <View className={`bg-white dark:bg-gray-800 p-8 rounded-[40px] items-center shadow-2xl ${isDesktop ? 'max-w-md w-full' : 'w-full'}`}>
              <View className="p-4 mb-4 bg-purple-100 rounded-full dark:bg-purple-900/30">
                <IconSymbol name="person.crop.circle.badge.plus" size={40} color="#9333ea" />
              </View>
              
              <Text className="mb-1 text-2xl font-bold text-center text-gray-900 dark:text-white">
                {scannedUser ? scannedUser.name : 'Usuario Desconocido'}
              </Text>
              <Text className="mb-6 font-mono text-xs text-center text-gray-500">
                {scannedAddress}
              </Text>

              <View className="gap-y-4 w-full">
                <TouchableOpacity 
                  onPress={() => {
                    setReceiverUTPId(scannedAddress);
                    setIsScanResultModalVisible(false);
                    setIsSendModalVisible(true);
                    setVerificationStep('input');
                  }}
                  className="justify-center items-center w-full h-14 bg-purple-600 rounded-2xl shadow-sm"
                >
                  <Text className="text-lg font-bold text-white">Enviar UTP Coins</Text>
                </TouchableOpacity>

                {!contactsList.some(c => c.walletAddress === scannedAddress) && (
                  <TouchableOpacity 
                    onPress={() => {
                      setNewContactAddress(scannedAddress);
                      setNewContactName(scannedUser ? scannedUser.name : '');
                      setIsScanResultModalVisible(false);
                      setIsAddContactModalVisible(true);
                    }}
                    className="justify-center items-center w-full h-14 bg-purple-100 rounded-2xl dark:bg-purple-900/30"
                  >
                    <Text className="text-lg font-bold text-purple-600 dark:text-purple-400">Guardar Contacto</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  onPress={() => setIsScanResultModalVisible(false)}
                  className="justify-center items-center w-full h-12"
                >
                  <Text className="font-medium text-gray-500">Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Alerta de Llave Faltante */}
        <Modal
          visible={showNoKeyAlert}
          transparent={true}
          animationType="slide"
        >
          <View className="flex-1 justify-center items-center px-6 bg-black/60">
            <View className="bg-white dark:bg-gray-800 w-full p-8 rounded-[40px] items-center">
              <View className="p-4 mb-4 bg-red-100 rounded-full">
                <IconSymbol name="key.fill" size={40} color="#ef4444" />
              </View>
              <Text className="mb-2 text-2xl font-bold text-center text-gray-900 dark:text-white">
                Billetera no configurada
              </Text>
              <Text className="mb-6 text-center text-gray-500 dark:text-gray-400">
                Tu cuenta no tiene una llave privada local. Ingresa tus 12 palabras para restaurar el acceso.
              </Text>

              <TextInput
                placeholder="palabra1 palabra2 ..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                className="p-4 mb-6 w-full text-gray-900 bg-gray-50 rounded-2xl border border-gray-100 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                value={importingSeed}
                onChangeText={setImportingSeed}
                autoCapitalize="none"
              />
              
              <TouchableOpacity 
                onPress={handleDirectImport}
                disabled={isImporting}
                className="justify-center items-center mb-3 w-full h-14 bg-purple-600 rounded-2xl"
              >
                {isImporting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-lg font-bold text-white">Restaurar Billetera</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setShowNoKeyAlert(false)}
                className="justify-center items-center w-full h-12"
              >
                <Text className="font-medium text-gray-500">Continuar solo lectura</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <FeedbackModal
          isVisible={feedback.visible}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
          onClose={() => setFeedback({ ...feedback, visible: false })}
        />
      </ScrollView>
    </View>
  );
}