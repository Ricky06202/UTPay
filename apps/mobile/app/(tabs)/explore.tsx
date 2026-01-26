import { IconSymbol } from '@/components/ui/icon-symbol';
import { UTPSymbol } from '@/components/ui/UTPSymbol';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/context/auth';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isWeb = Platform.OS === 'web';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

  useEffect(() => {
    if (user) {
      fetchFullHistory();
    }

    // Intervalo para refrescar el historial completo automáticamente cada 15 segundos
    const historyInterval = setInterval(() => {
      if (user) {
        fetchFullHistory();
      }
    }, 15000);

    return () => clearInterval(historyInterval);
  }, [user?.id]);

  const fetchFullHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/transactions/history/${user?.id}`);
      const data = await response.json();
      if (data.success) {
        setHistory(data.history);
      }
    } catch (error) {
      console.error('Error fetching full history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View 
      className="flex-1"
      style={{ 
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }} 
    >
      <View className="flex-1 items-center">
        <View className="w-full max-w-[1200px] flex-1 px-6 pt-2">
        <View className="flex-row justify-between items-center pt-4 mb-8">
          <Text className="text-3xl font-bold text-gray-900 dark:text-white">Historial</Text>
          <View className="flex-row">
            <TouchableOpacity 
              onPress={fetchFullHistory}
              className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 mr-2"
            >
              <IconSymbol name="refresh" size={24} color="#9333ea" />
            </TouchableOpacity>
            {isWeb && (
              <TouchableOpacity 
                onPress={() => router.push('/')}
                className="bg-white dark:bg-gray-800 px-6 py-3 rounded-full shadow-sm border border-gray-100 dark:border-gray-700"
              >
                <Text className="font-bold text-purple-600">Volver al Panel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#9333ea" />
          </View>
        ) : history.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-gray-500 text-lg">Aún no tienes transacciones</Text>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => {
              const isExpense = item.senderId === user?.id;
              const displayName = isExpense ? `A: ${item.receiverName}` : `De: ${item.senderName}`;
              
              return (
                <TouchableOpacity 
                  onPress={() => {
                    setSelectedTransaction(item);
                    setIsDetailModalVisible(true);
                  }}
                  className="bg-white dark:bg-gray-800 p-6 rounded-[32px] mb-4 flex-row justify-between items-center shadow-sm border border-gray-50 dark:border-gray-700"
                >
                  <View className="flex-row items-center flex-1 mr-4 overflow-hidden">
                    <View className={`h-14 w-14 rounded-2xl items-center justify-center mr-4 flex-shrink-0 ${
                      !isExpense ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      <IconSymbol 
                        name={!isExpense ? 'add' : 'remove'} 
                        size={28} 
                        color={!isExpense ? '#22c55e' : '#ef4444'} 
                      />
                    </View>
                    <View className="flex-1 overflow-hidden">
                      <Text 
                        className="font-bold text-gray-800 dark:text-gray-100 text-lg"
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {item.description && (item.description.startsWith('A: ') || item.description.startsWith('De: ')) 
                          ? item.description 
                          : displayName}
                      </Text>
                      <Text className="text-gray-500 dark:text-gray-400 text-sm" numberOfLines={1}>
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-shrink-0 ml-2 flex-row items-center">
                    <UTPSymbol size={18} color={!isExpense ? '#22c55e' : '#ef4444'} containerStyle={{ marginRight: 6 }} />
                    <Text className={`font-bold text-2xl ${!isExpense ? 'text-green-500' : 'text-red-500'}`}>
                      {!isExpense ? '+' : '-'}{item.amount.toFixed(2)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* Modal para ver detalles de la transacción */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isDetailModalVisible}
        onRequestClose={() => setIsDetailModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-gray-800 p-8 rounded-t-[50px] shadow-2xl">
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
                {selectedTransaction?.amount?.toFixed(2)}
              </Text>
              <Text className="text-gray-500 dark:text-gray-400 mt-1">
                {selectedTransaction ? new Date(selectedTransaction.createdAt).toLocaleString() : ''}
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
                  <Text className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
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
    </View>
    </View>
  );
}
