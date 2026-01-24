import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/context/auth';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const isWeb = Platform.OS === 'web';

export default function ExploreScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFullHistory();
    }
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
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <View className={`flex-1 px-6 pt-6 ${isWeb ? 'max-w-[1200px] mx-auto w-full' : ''}`}>
        <View className="flex-row justify-between items-center mb-8">
          <Text className="text-3xl font-bold text-gray-900 dark:text-white">Historial</Text>
          <View className="flex-row">
            <TouchableOpacity 
              onPress={fetchFullHistory}
              className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 mr-2"
            >
              <IconSymbol name="refresh" size={24} color="#2563eb" />
            </TouchableOpacity>
            {isWeb && (
              <TouchableOpacity 
                onPress={() => router.push('/')}
                className="bg-white dark:bg-gray-800 px-6 py-3 rounded-full shadow-sm border border-gray-100 dark:border-gray-700"
              >
                <Text className="font-bold text-blue-600">Volver al Panel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#2563eb" />
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
                <View className="bg-white dark:bg-gray-800 p-6 rounded-[32px] mb-4 flex-row justify-between items-center shadow-sm border border-gray-50 dark:border-gray-700">
                  <View className="flex-row items-center">
                    <View className={`h-14 w-14 rounded-2xl items-center justify-center mr-4 ${
                      !isExpense ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      <IconSymbol 
                        name={!isExpense ? 'add' : 'remove'} 
                        size={28} 
                        color={!isExpense ? '#22c55e' : '#ef4444'} 
                      />
                    </View>
                    <View>
                      <Text className="font-bold text-gray-800 dark:text-gray-100 text-lg">
                        {item.description === 'Transferencia UTPay' ? displayName : item.description}
                      </Text>
                      <Text className="text-gray-500 dark:text-gray-400 text-sm">
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  <Text className={`font-bold text-2xl ${!isExpense ? 'text-green-500' : 'text-red-500'}`}>
                    {!isExpense ? '+' : '-'}${item.amount.toFixed(2)}
                  </Text>
                </View>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
