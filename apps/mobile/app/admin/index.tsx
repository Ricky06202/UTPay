import { LogoutButton } from '@/components/LogoutButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/auth';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_URL } from '@/constants/api';

export default function AdminPanel() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [stats, setStats] = useState({
    totalUsers: 0,
    todayTransactions: 0,
    totalVolume: 0,
    activeMissions: 0
  });
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/admin/stats`);
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, [fetchStats]);

  if (user?.role !== 'admin') {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <Text className="text-xl font-bold text-red-500">Acceso Denegado</Text>
        <TouchableOpacity 
          onPress={() => router.replace('/(tabs)')}
          className="mt-4 px-6 py-2 bg-blue-500 rounded-full"
        >
          <Text className="text-white font-bold">Volver al Inicio</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const adminStats = [
    { title: 'Usuarios Totales', value: stats.totalUsers.toString(), icon: 'person.2.fill', color: 'text-blue-500', bg: 'bg-blue-100' },
    { title: 'Transacciones Hoy', value: stats.todayTransactions.toString(), icon: 'arrow.up.arrow.down.circle.fill', color: 'text-green-500', bg: 'bg-green-100' },
    { title: 'Volumen (UTP)', value: Number(stats.totalVolume || 0).toFixed(2), icon: 'cart.fill', color: 'text-purple-500', bg: 'bg-purple-100' },
    { title: 'Misiones Activas', value: stats.activeMissions.toString(), icon: 'assignment.fill', color: 'text-orange-500', bg: 'bg-orange-100' },
  ];

  const adminActions = [
    { name: 'Gestionar Usuarios', icon: 'person.crop.circle.badge.plus', description: 'Ver, editar o recuperar wallets de estudiantes.', route: '/admin/users' },
    { name: 'Aprobar Misiones', icon: 'checkmark.seal.fill', description: 'Revisar y validar misiones universitarias.', route: '/admin/missions' },
    { name: 'Reportes y Auditoría', icon: 'doc.text.magnifyingglass', description: 'Ver historial completo de transacciones en la red.', route: '/admin/audit' },
  ];

  return (
    <ScrollView 
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      contentContainerStyle={{ 
        paddingTop: insets.top, 
        paddingBottom: insets.bottom + 20,
        alignItems: 'center'
      }}
    >
      <View className={`px-6 w-full ${isDesktop ? 'max-w-5xl' : ''}`}>
        {/* Header */}
        <View className="flex-row justify-between items-center py-6">
          <View>
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">Panel Admin</Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">Gestión Central de UTPay</Text>
          </View>
          <LogoutButton />
        </View>

        {/* Stats Grid */}
        <View className="flex-row flex-wrap justify-between mb-8">
          {adminStats.map((stat, index) => (
            <View 
              key={index} 
              className={`${isDesktop ? 'w-[23.5%]' : 'w-[48%]'} bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm mb-4`}
            >
              <View className={`${stat.bg} w-10 h-10 rounded-2xl items-center justify-center mb-3`}>
                <IconSymbol 
                  name={stat.icon as any} 
                  size={20} 
                  color={stat.color.includes('blue') ? '#3b82f6' : stat.color.includes('green') ? '#22c55e' : stat.color.includes('purple') ? '#a855f7' : '#f97316'} 
                />
              </View>
              <Text className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">{stat.title}</Text>
            </View>
          ))}
        </View>

        <View className={`${isDesktop ? 'flex-row space-x-8' : 'flex-col'}`}>
          {/* Quick Actions */}
          <View className={isDesktop ? 'flex-1' : 'w-full'}>
            <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4">Acciones Rápidas</Text>
            <View className="space-y-4">
              {adminActions.map((action, index) => (
                <TouchableOpacity 
                  key={index}
                  onPress={() => router.push(action.route as any)}
                  className="flex-row items-center p-4 bg-white dark:bg-gray-800 rounded-3xl shadow-sm mb-3"
                >
                  <View className="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl mr-4">
                    <IconSymbol name={action.icon as any} size={24} color="#6b7280" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-gray-900 dark:text-white">{action.name}</Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400">{action.description}</Text>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color="#d1d5db" />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* System Status */}
          <View className={isDesktop ? 'w-[350px]' : 'w-full mt-8'}>
            <View className="p-6 bg-purple-600 rounded-3xl shadow-lg h-full">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-white font-bold text-lg">Estado del Sistema</Text>
                <View className="px-3 py-1 bg-white/20 rounded-full">
                  <Text className="text-white text-xs font-bold">OPERATIVO</Text>
                </View>
              </View>
              <View className="space-y-4">
                <View className="flex-row justify-between items-center pb-4 border-b border-purple-500/30">
                  <View className="flex-row items-center">
                    <IconSymbol name="network" size={16} color="#e9d5ff" />
                    <Text className="text-purple-100 text-sm ml-2">Nodo Besu</Text>
                  </View>
                  <Text className="text-white text-sm font-medium">Sincronizado</Text>
                </View>
                <View className="flex-row justify-between items-center pb-4 border-b border-purple-500/30">
                  <View className="flex-row items-center">
                    <IconSymbol name="checkmark.seal.fill" size={16} color="#e9d5ff" />
                    <Text className="text-purple-100 text-sm ml-2">Contrato UTPay</Text>
                  </View>
                  <Text className="text-white text-sm font-medium">v1.2.0</Text>
                </View>
                <View className="flex-row justify-between items-center pb-4 border-b border-purple-500/30">
                  <View className="flex-row items-center">
                    <IconSymbol name="lock.fill" size={16} color="#e9d5ff" />
                    <Text className="text-purple-100 text-sm ml-2">D1 Database</Text>
                  </View>
                  <Text className="text-white text-sm font-medium">Conectado</Text>
                </View>
              </View>
              
              <View className="mt-auto pt-6">
                <Text className="text-purple-200 text-[10px] text-center uppercase tracking-widest">
                  Blockchain UTPay Network v2.0
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
