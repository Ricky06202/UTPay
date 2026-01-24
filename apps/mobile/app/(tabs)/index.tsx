import { LogoutButton } from '@/components/LogoutButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/context/auth';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const isWeb = Platform.OS === 'web';

export default function HomeScreen() {
  const [backendStatus, setBackendStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [isSendModalVisible, setIsSendModalVisible] = useState(false);
  const [receiverEmail, setReceiverEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const router = useRouter();
  const { user, signOut, updateUser, refreshUser } = useAuth();

  useEffect(() => {
    checkBackend();
    if (user) {
      fetchHistory();
      refreshUser(); // Actualizar saldo al cargar
    }
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

  const handleSendMoney = async () => {
    if (!receiverEmail || !amount) {
      Alert.alert('Error', 'Por favor llena todos los campos');
      return;
    }

    try {
      setIsSending(true);
      const response = await fetch(`${API_URL}/transactions/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user?.id,
          receiverEmail,
          amount: parseFloat(amount),
          description: 'Transferencia UTPay'
        })
      });

      const data = await response.json();

      if (data.success) {
        if (isWeb) {
          alert('Transferencia exitosa');
        } else {
          Alert.alert('Éxito', 'Transferencia realizada');
        }
        
        // Actualizar saldo localmente
        if (user) {
          updateUser({
            ...user,
            balance: user.balance - parseFloat(amount)
          });
        }
        
        setIsSendModalVisible(false);
        setReceiverEmail('');
        setAmount('');
        fetchHistory(); // Recargar historial
      } else {
        if (isWeb) {
          alert(data.message);
        } else {
          Alert.alert('Error', data.message);
        }
      }
    } catch (error) {
      console.error('Error sending money:', error);
      Alert.alert('Error', 'No se pudo procesar la transferencia');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 px-6 pb-10 max-w-[1200px] mx-auto w-full">
          
          {/* Header */}
          <View className="flex-row justify-between items-center py-8">
            <View>
              <Text className="text-gray-500 text-lg dark:text-gray-400 font-medium">Panel de Control</Text>
              <Text className="text-3xl font-bold text-gray-900 dark:text-white">Hola, {user?.name || 'Estudiante'}</Text>
            </View>
            <View className="flex-row items-center">
              <TouchableOpacity 
                onPress={checkBackend}
                className="flex-row items-center bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 mr-4"
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
              
              <View className={`${isWeb ? 'flex-row space-x-6 mb-10' : 'flex-col'}`}>
                {/* Card de Saldo */}
                <View className={`bg-blue-600 rounded-[40px] p-8 shadow-2xl shadow-blue-500/30 ${isWeb ? 'flex-1 mb-0' : 'mb-6'}`}>
                  <Text className="text-blue-100 text-base mb-1 font-medium">Saldo disponible</Text>
                  <Text className="text-5xl font-bold text-white mb-6">$ {user?.balance?.toFixed(2) || '0.00'}</Text>
                  <View className="flex-row space-x-3">
                    <TouchableOpacity className="bg-white/20 h-12 rounded-xl flex-1 items-center justify-center">
                      <Text className="text-white font-bold">Recargar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setIsSendModalVisible(true)}
                      className="bg-white h-12 rounded-xl flex-1 items-center justify-center shadow-sm"
                    >
                      <Text className="text-blue-600 font-bold">Enviar</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Acciones de PC (Solo se ven en Web al lado del saldo) */}
                {isWeb && (
                  <View className="flex-1 justify-between py-2">
                    <TouchableOpacity className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex-row items-center">
                      <View className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl mr-4">
                        <IconSymbol name="chevron.left.forwardslash.chevron.right" size={24} color="#2563eb" />
                      </View>
                      <View>
                        <Text className="font-bold text-gray-800 dark:text-white">Ver Estadísticas</Text>
                        <Text className="text-gray-500 text-xs">Analiza tus gastos del mes</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex-row items-center">
                      <View className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-2xl mr-4">
                        <IconSymbol name="payments" size={24} color="#d97706" />
                      </View>
                      <View>
                        <Text className="font-bold text-gray-800 dark:text-white">Beneficios UTP</Text>
                        <Text className="text-gray-500 text-xs">Cupones y descuentos activos</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Grid de Servicios */}
              <Text className="text-2xl font-bold text-gray-800 mb-6 dark:text-white">Servicios UTP</Text>
              <View className="flex-row flex-wrap justify-between">
                {[
                  { name: 'Escanear QR', icon: 'qr.code', color: 'bg-purple-100 dark:bg-purple-900/30', iconColor: '#a855f7' },
                  { name: 'Pagar', icon: 'payments', color: 'bg-green-100 dark:bg-green-900/30', iconColor: '#22c55e' },
                  { name: 'Transporte', icon: 'bus', color: 'bg-orange-100 dark:bg-orange-900/30', iconColor: '#f97316' },
                  { name: 'Cafetería', icon: 'coffee', color: 'bg-blue-100 dark:bg-blue-900/30', iconColor: '#3b82f6' },
                  { name: 'Biblioteca', icon: 'book', color: 'bg-red-100 dark:bg-red-900/30', iconColor: '#ef4444' },
                  { name: 'Perfil', icon: 'account.circle', color: 'bg-gray-100 dark:bg-gray-800', iconColor: '#6b7280' }
                ].map((action, index) => (
                  <TouchableOpacity 
                    key={index} 
                    className={`${isWeb ? 'w-[23%]' : 'w-[48%]'} bg-white dark:bg-gray-800 p-6 rounded-[32px] mb-6 shadow-sm items-center justify-center h-40 border border-gray-50 dark:border-gray-700`}
                  >
                    <View className={`${action.color} p-4 rounded-2xl mb-3`}>
                      <IconSymbol name={action.icon as any} size={32} color={action.iconColor} />
                    </View>
                    <Text className="font-bold text-gray-700 dark:text-gray-200 text-base text-center">{action.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Columna Derecha: Actividad (Solo en PC) */}
            <View className={isWeb ? 'flex-1' : 'w-full mt-10'}>
              <View className="bg-white dark:bg-gray-800 rounded-[40px] p-8 shadow-sm border border-gray-50 dark:border-gray-700">
                <Text className="text-xl font-bold text-gray-800 dark:text-white mb-6">Actividad Reciente</Text>
                
                {isLoadingHistory ? (
                  <ActivityIndicator color="#2563eb" />
                ) : history.length === 0 ? (
                  <Text className="text-gray-500 text-center py-4">No hay transacciones aún</Text>
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
                  className="mt-4 py-4 border-t border-gray-50 dark:border-gray-700 items-center"
                >
                  <Text className="text-blue-600 font-bold">Ver todo el historial</Text>
                </TouchableOpacity>
              </View>
            </View>

          </View>
        </View>

        {/* Modal para Enviar Dinero */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isSendModalVisible}
          onRequestClose={() => setIsSendModalVisible(false)}
        >
          <View className="flex-1 justify-center items-center bg-black/50 px-6">
            <View className="bg-white dark:bg-gray-800 w-full max-w-md p-8 rounded-[40px] shadow-xl">
              <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">Enviar UTP Coins</Text>
              
              <Text className="text-gray-500 mb-2 ml-2">Correo del receptor</Text>
              <TextInput
                className="bg-gray-50 dark:bg-gray-700 p-4 rounded-2xl mb-4 dark:text-white"
                placeholder="ejemplo@utp.ac.pa"
                placeholderTextColor="#9ca3af"
                value={receiverEmail}
                onChangeText={setReceiverEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text className="text-gray-500 mb-2 ml-2">Monto (UTP)</Text>
              <TextInput
                className="bg-gray-50 dark:bg-gray-700 p-4 rounded-2xl mb-8 dark:text-white text-2xl font-bold"
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />

              <View className="flex-row space-x-4">
                <TouchableOpacity 
                  onPress={() => setIsSendModalVisible(false)}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 h-14 rounded-2xl items-center justify-center"
                >
                  <Text className="text-gray-600 dark:text-gray-300 font-bold">Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={handleSendMoney}
                  disabled={isSending}
                  className="flex-1 bg-blue-600 h-14 rounded-2xl items-center justify-center shadow-lg shadow-blue-500/30"
                >
                  {isSending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-bold text-lg">Enviar Ahora</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}