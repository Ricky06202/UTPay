import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { 
  ActivityIndicator, 
  Alert, 
  FlatList, 
  Text, 
  TouchableOpacity, 
  View,
  useWindowDimensions 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_URL } from '@/constants/api';

type Mission = {
  id: number;
  title: string;
  description: string;
  reward: number;
  status: string;
  creatorName: string;
  categoryName: string;
  createdAt: number;
};

export default function MissionManagement() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMissions();
  }, []);

  const fetchMissions = async () => {
    try {
      setLoading(true);
      // Usamos el endpoint de misiones abiertas, pero un admin podría ver todas
      // Por ahora usamos /missions/open para simplificar
      const response = await fetch(`${API_URL}/missions/open`);
      const data = await response.json();
      if (data.success) {
        setMissions(data.missions);
      }
    } catch (error) {
      console.error('Error fetching missions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (missionId: number, action: string) => {
    Alert.alert(
      'Acción de Moderación',
      `¿Estás seguro de que deseas ${action} esta misión?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Confirmar', 
          style: 'destructive',
          onPress: () => {
            // Aquí iría la lógica para cancelar o moderar misiones
            Alert.alert('Info', 'Funcionalidad de moderación en desarrollo');
          }
        }
      ]
    );
  };

  const renderMissionItem = ({ item }: { item: Mission }) => (
    <View className="bg-white dark:bg-gray-800 p-5 rounded-3xl mb-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <View className="bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg mr-2">
              <Text className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                {item.categoryName?.toUpperCase()}
              </Text>
            </View>
            <Text className="text-xs text-gray-400">ID: {item.id}</Text>
          </View>
          <Text className="text-lg font-bold text-gray-900 dark:text-white">{item.title}</Text>
        </View>
        <Text className="text-xl font-bold text-purple-600 dark:text-purple-400">
          {item.reward} UTP
        </Text>
      </View>

      <Text className="text-sm text-gray-500 dark:text-gray-400 mb-4" numberOfLines={2}>
        {item.description}
      </Text>

      <View className="flex-row items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-700">
        <View>
          <Text className="text-xs text-gray-400">Creado por:</Text>
          <Text className="text-xs font-bold text-gray-700 dark:text-gray-300">{item.creatorName}</Text>
        </View>
        
        <View className="flex-row space-x-2">
          <TouchableOpacity 
            onPress={() => handleAction(item.id, 'cancelar')}
            className="px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-xl"
          >
            <Text className="text-xs font-bold text-red-600">Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => Alert.alert('Detalles', item.description)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl"
          >
            <Text className="text-xs font-bold text-gray-600 dark:text-gray-300">Ver más</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View 
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      style={{ paddingTop: insets.top }}
    >
      <View className={`flex-1 px-6 w-full self-center ${isDesktop ? 'max-w-5xl' : ''}`}>
        {/* Header */}
        <View className="flex-row items-center py-6">
          <TouchableOpacity 
            onPress={() => router.replace('/admin')}
            className="mr-4 p-2 rounded-full bg-white dark:bg-gray-800 shadow-sm"
          >
            <IconSymbol name="chevron.left" size={24} color="#6b7280" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">Moderación de Misiones</Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">Supervisión de tareas comunitarias</Text>
          </View>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#9333ea" />
          </View>
        ) : (
          <FlatList
            data={missions}
            renderItem={renderMissionItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="items-center mt-10">
                <Text className="text-gray-500">No hay misiones activas para moderar</Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}
