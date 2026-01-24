import { LogoutButton } from '@/components/LogoutButton';
import { FeedbackModal } from '@/components/ui/FeedbackModal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/context/auth';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isWeb = Platform.OS === 'web';

// Función para decorar el ID: 1 -> UTP-0001
const formatUTPId = (id: number | string | undefined) => {
  if (!id) return 'UTP-0000';
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
  if (isNaN(numericId)) return 'UTP-0000';
  return `UTP-${numericId.toString().padStart(4, '0')}`;
};

// Función para revertir la decoración: acepta "UTP-0001", "0001" o "1"
const parseUTPId = (id: string) => {
  // Eliminar el prefijo UTP- si existe
  const cleanId = id.replace('UTP-', '');
  const numericId = parseInt(cleanId, 10);
  return isNaN(numericId) ? null : numericId;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [backendStatus, setBackendStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [isSendModalVisible, setIsSendModalVisible] = useState(false);
  const [isQRModalVisible, setIsQRModalVisible] = useState(false);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [verificationStep, setVerificationStep] = useState<'input' | 'confirm'>('input');
  const [isVerifying, setIsVerifying] = useState(false);
  const [recipientData, setRecipientData] = useState<{ name: string; email: string } | null>(null);
  const [receiverUTPId, setReceiverUTPId] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

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

  useEffect(() => {
    checkBackend();
    if (user) {
      fetchHistory();
      refreshUser(); // Actualizar saldo al cargar
    }

    // Intervalo para refrescar el historial automáticamente cada 15 segundos
    const historyInterval = setInterval(() => {
      if (user) {
        fetchHistory();
      }
    }, 15000);

    return () => clearInterval(historyInterval);
  }, [user?.id]);

  const checkBackend = async () => {
    try {
      setBackendStatus('loading');
      const response = await fetch(`${API_URL}/`);
      await response.json();
      setBackendStatus('ok');
      if (user) {
        fetchHistory();
        refreshUser();
      }
    } catch (error) {
      setBackendStatus('error');
    }
  };

  const fetchHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const response = await fetch(`${API_URL}/transactions/history/${user?.id}`);
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

  const onBarcodeScanned = ({ data }: { data: string }) => {
    setIsScannerVisible(false);
    // Verificar si el código escaneado es un ID de UTPay válido
    if (data.startsWith('UTP-')) {
      const numericId = data.replace('UTP-', '');
      setReceiverUTPId(numericId);
      // Solo abrimos el modal para que el usuario ingrese el monto
      setIsSendModalVisible(true);
      setVerificationStep('input');
    } else {
      setFeedback({
        visible: true,
        type: 'error',
        title: 'QR Inválido',
        message: 'El código QR escaneado no es un identificador válido de UTPay.'
      });
    }
  };

  const handleVerifyRecipient = async (idToVerify?: string) => {
    const targetId = idToVerify || receiverUTPId;
    const numericId = parseUTPId(targetId);

    if (!numericId || !amount) {
      setFeedback({
        visible: true,
        type: 'error',
        title: 'Campos incompletos',
        message: 'Por favor ingresa un Número UTPay válido y un monto.'
      });
      return;
    }

    if (numericId === user?.id) {
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
      const response = await fetch(`${API_URL}/auth/me/${numericId}`);
      const data = await response.json();

      if (data.success) {
        setRecipientData(data.user);
        setVerificationStep('confirm');
        setIsSendModalVisible(true);
      } else {
        setFeedback({
          visible: true,
          type: 'error',
          title: 'Usuario no encontrado',
          message: 'No existe ningún usuario con ese Número UTPay.'
        });
      }
    } catch (error) {
      console.error('Error verifying recipient:', error);
      setFeedback({
        visible: true,
        type: 'error',
        title: 'Error de conexión',
        message: 'No se pudo verificar el usuario.'
      });
    } finally {
       setIsVerifying(false);
     }
   };

   const handleOpenScanner = async () => {
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

   const handleSendMoney = async () => {
    const numericReceiverId = parseUTPId(receiverUTPId);
    
    if (!numericReceiverId || !amount) return;

    try {
      setIsSending(true);
      const response = await fetch(`${API_URL}/transactions/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user?.id,
          receiverId: numericReceiverId,
          amount: parseFloat(amount),
          description: 'Transferencia UTPay'
        })
      });

      const data = await response.json();

      if (data.success) {
        setIsSendModalVisible(false);
        setVerificationStep('input');
        setRecipientData(null);
        setReceiverUTPId('');
        setAmount('');
        
        // Actualizar saldo localmente
        if (user) {
          updateUser({
            ...user,
            balance: user.balance - parseFloat(amount)
          });
        }
        
        setFeedback({
          visible: true,
          type: 'success',
          title: '¡Transferencia Exitosa!',
          message: `Has enviado $${parseFloat(amount).toFixed(2)} correctamente.`
        });
        
        fetchHistory(); // Recargar historial
      } else {
        setFeedback({
          visible: true,
          type: 'error',
          title: 'Error en el envío',
          message: data.message || 'No se pudo completar la transferencia.'
        });
      }
    } catch (error) {
      console.error('Error sending money:', error);
      setFeedback({
        visible: true,
        type: 'error',
        title: 'Error de conexión',
        message: 'Hubo un problema al conectar con el servidor.'
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
    }, 300);
  };

  return (
    <View 
      style={{ 
        flex: 1, 
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }} 
      className="bg-gray-50 dark:bg-gray-900"
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-6 pb-10 max-w-[1200px] mx-auto w-full">
          
          {/* Header */}
          <View className="flex-row justify-between items-center py-8">
            <View>
              <Text className="text-lg font-medium text-gray-500 dark:text-gray-400">Panel de Control</Text>
              <Text className="text-3xl font-bold text-gray-900 dark:text-white">Hola, {user?.name || 'Estudiante'}</Text>
            </View>
            <View className="flex-row items-center">
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
          <View className={`flex-1 ${isWeb ? 'flex-row space-x-8' : 'flex-col'}`}>
            
            {/* Columna Izquierda: Saldo y Servicios */}
            <View className={isWeb ? 'flex-[2]' : 'w-full'}>
              
              <View className={`${isWeb ? 'flex-row mb-10 space-x-6' : 'flex-col'}`}>
                {/* Card de Saldo */}
                <View className={`bg-blue-600 rounded-[40px] p-8 shadow-2xl shadow-blue-500/30 ${isWeb ? 'flex-1 mb-0' : 'mb-6'}`}>
                  <Text className="mb-1 text-base font-medium text-blue-100">Saldo disponible</Text>
                  <Text className="mb-6 text-5xl font-bold text-white">$ {user?.balance?.toFixed(2) || '0.00'}</Text>
                  <View className="flex-row space-x-3">
                    <TouchableOpacity className="flex-1 justify-center items-center h-12 rounded-xl bg-white/20">
                      <Text className="font-bold text-white">Recargar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setIsSendModalVisible(true)}
                      className="flex-1 justify-center items-center h-12 bg-white rounded-xl shadow-sm"
                    >
                      <Text className="font-bold text-blue-600">Enviar</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Acciones de PC (Solo se ven en Web al lado del saldo) */}
                {isWeb && (
                  <View className="flex-1 justify-between py-2">
                    <TouchableOpacity className="flex-row items-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm dark:bg-gray-800 dark:border-gray-700">
                      <View className="p-3 mr-4 bg-blue-50 rounded-2xl dark:bg-blue-900/20">
                        <IconSymbol name="chevron.left.forwardslash.chevron.right" size={24} color="#2563eb" />
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
                  { name: 'Cafetería', icon: 'coffee', color: 'bg-blue-100 dark:bg-blue-900/30', iconColor: '#3b82f6' },
                  { name: 'Biblioteca', icon: 'book', color: 'bg-red-100 dark:bg-red-900/30', iconColor: '#ef4444' },
                  { name: 'Mi QR', icon: 'account.circle', color: 'bg-gray-100 dark:bg-gray-800', iconColor: '#6b7280', action: () => setIsQRModalVisible(true) }
                ].map((action, index) => (
                  <TouchableOpacity 
                    key={index} 
                    onPress={action.action}
                    className={`${isWeb ? 'w-[23%]' : 'w-[48%]'} bg-white dark:bg-gray-800 p-6 rounded-[32px] mb-6 shadow-sm items-center justify-center h-40 border border-gray-50 dark:border-gray-700`}
                  >
                    <View className={`${action.color} p-4 rounded-2xl mb-3`}>
                      <IconSymbol name={action.icon as any} size={32} color={action.iconColor} />
                    </View>
                    <Text className="text-base font-bold text-center text-gray-700 dark:text-gray-200">{action.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Columna Derecha: Actividad (Solo en PC) */}
            <View className={isWeb ? 'flex-1' : 'mt-10 w-full'}>
              <View className="bg-white dark:bg-gray-800 rounded-[40px] p-8 shadow-sm border border-gray-50 dark:border-gray-700">
                <Text className="mb-6 text-xl font-bold text-gray-800 dark:text-white">Actividad Reciente</Text>
                
                {isLoadingHistory ? (
                  <ActivityIndicator color="#2563eb" />
                ) : history.length === 0 ? (
                  <Text className="py-4 text-center text-gray-500">No hay transacciones aún</Text>
                ) : (
                  history.map((item, i) => {
                    const isExpense = item.senderId === user?.id;
                    const displayName = isExpense ? `A: ${item.receiverName}` : `De: ${item.senderName}`;
                    return (
                      <View key={i} className="flex-row justify-between items-center mb-6 last:mb-0">
                        <View className="flex-row items-center">
                          <View className={`h-10 w-10 rounded-full items-center justify-center mr-3 ${!isExpense ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                            <IconSymbol 
                              name={!isExpense ? 'add' : 'remove'} 
                              size={18} 
                              color={!isExpense ? '#22c55e' : '#ef4444'} 
                            />
                          </View>
                          <View>
                            <Text className="font-medium text-gray-700 dark:text-gray-300">
                              {item.description === 'Transferencia UTPay' ? displayName : item.description}
                            </Text>
                            <Text className="text-xs text-gray-400">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>
                        <Text className={`font-bold ${!isExpense ? 'text-green-500' : 'text-red-500'}`}>
                          {!isExpense ? '+' : '-'}${item.amount.toFixed(2)}
                        </Text>
                      </View>
                    );
                  })
                )}
                
                <TouchableOpacity 
                  onPress={() => router.push('/explore')}
                  className="items-center py-4 mt-4 border-t border-gray-50 dark:border-gray-700"
                >
                  <Text className="font-bold text-blue-600">Ver todo el historial</Text>
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
          <View className="flex-1 justify-end items-center px-0 bg-black/50">
            <View className="bg-white dark:bg-gray-800 w-full max-w-md p-8 rounded-t-[50px] shadow-2xl">
              
              {verificationStep === 'input' ? (
                <>
                  <Text className="mb-6 text-2xl font-bold text-center text-gray-900 dark:text-white">Enviar UTP Coins</Text>
                  
                  <Text className="mb-2 ml-2 text-gray-500">Número UTPay del receptor</Text>
                  <View className="flex-row items-center p-4 mb-4 bg-gray-50 rounded-2xl dark:bg-gray-700">
                    <Text className="text-gray-400 font-bold text-lg mr-1">UTP-</Text>
                    <TextInput
                      className="flex-1 text-lg font-bold dark:text-white"
                      placeholder="0000"
                      placeholderTextColor="#9ca3af"
                      value={receiverUTPId}
                      onChangeText={(text) => {
                        // Solo permitir números y limitar longitud a 4 dígitos
                        const numericText = text.replace(/[^0-9]/g, '').slice(0, 4);
                        setReceiverUTPId(numericText);
                      }}
                      keyboardType="numeric"
                    />
                  </View>

                  <Text className="mb-2 ml-2 text-gray-500">Monto (UTP)</Text>
                  <TextInput
                    className="p-4 mb-8 text-2xl font-bold bg-gray-50 rounded-2xl dark:bg-gray-700 dark:text-white"
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    value={amount}
                    onChangeText={handleAmountChange}
                    keyboardType="numeric"
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
                      className="flex-2 justify-center items-center h-14 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/30"
                    >
                      {isVerifying ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text className="text-lg font-bold text-white px-8">Verificar Receptor</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View className="items-center mb-6">
                    <View className="p-4 mb-4 bg-blue-50 rounded-full dark:bg-blue-900/20">
                      <IconSymbol name="paperplane.fill" size={32} color="#2563eb" />
                    </View>
                    <Text className="text-2xl font-bold text-gray-900 dark:text-white text-center">Confirmar Envío</Text>
                  </View>

                  <View className="bg-gray-50 dark:bg-gray-700 p-6 rounded-3xl mb-8">
                    <View className="flex-row justify-between mb-4 border-b border-gray-200 dark:border-gray-600 pb-4">
                      <Text className="text-gray-500 dark:text-gray-400">Enviar a:</Text>
                      <View className="items-end">
                        <Text className="font-bold text-gray-900 dark:text-white text-lg">{recipientData?.name}</Text>
                        <Text className="text-gray-500 dark:text-gray-400 text-xs mb-1">{recipientData?.email}</Text>
                        <Text className="text-blue-600 font-bold tracking-widest">{formatUTPId(receiverUTPId)}</Text>
                      </View>
                    </View>
                    
                    <View className="flex-row justify-between items-center">
                      <Text className="text-gray-500 dark:text-gray-400">Monto total:</Text>
                      <Text className="text-3xl font-black text-gray-900 dark:text-white">$ {parseFloat(amount).toFixed(2)}</Text>
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
                      className="flex-2 justify-center items-center h-14 bg-green-600 rounded-2xl shadow-lg shadow-green-500/30"
                    >
                      {isSending ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text className="text-lg font-bold text-white px-8">Confirmar y Enviar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Modal para mostrar mi QR */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={isQRModalVisible}
          onRequestClose={() => setIsQRModalVisible(false)}
        >
          <View className="flex-1 justify-center items-center px-6 bg-black/50">
            <View className="bg-white dark:bg-gray-800 w-full max-w-sm p-10 rounded-[50px] items-center shadow-2xl">
              <View className="mb-6 p-4 bg-blue-50 rounded-3xl dark:bg-blue-900/20">
                <IconSymbol name="qr.code" size={32} color="#2563eb" />
              </View>
              
              <Text className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Mi Código QR</Text>
              <Text className="mb-8 text-gray-500 text-center">Muestra este código para recibir transferencias</Text>
              
              <View className="p-6 bg-white rounded-[40px] shadow-sm border border-gray-100">
                <QRCode
                  value={formatUTPId(user?.id)}
                  size={200}
                  color="#1f2937"
                  backgroundColor="white"
                />
              </View>
              
              <View className="mt-8 bg-gray-50 px-6 py-3 rounded-full dark:bg-gray-700">
                <Text className="text-xl font-black text-blue-600 dark:text-blue-400 tracking-widest">
                  {formatUTPId(user?.id)}
                </Text>
              </View>
              
              <TouchableOpacity 
                onPress={() => setIsQRModalVisible(false)}
                className="mt-10 w-full h-14 bg-gray-900 rounded-2xl items-center justify-center dark:bg-gray-700"
              >
                <Text className="text-white font-bold text-lg">Cerrar</Text>
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
            <View className="flex-1 items-center justify-center">
              <View className="w-64 h-64 border-2 border-white/50 rounded-3xl" />
              <Text className="mt-10 text-white font-bold text-lg bg-black/50 px-6 py-2 rounded-full">
                Escanea el código QR UTPay
              </Text>
            </View>
            
            {/* Botón para cerrar escáner */}
            <TouchableOpacity 
              onPress={() => setIsScannerVisible(false)}
              style={{ position: 'absolute', top: insets.top + 20, right: 20 }}
              className="bg-white/20 p-4 rounded-full"
            >
              <IconSymbol name="close" size={24} color="white" />
            </TouchableOpacity>
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