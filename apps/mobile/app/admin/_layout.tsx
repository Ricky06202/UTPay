import { useAuth } from '@/context/auth';
import { Slot, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Esperar a que el auth cargue
  if (isLoading) return null;

  // Protección de ruta: Solo admins
  if (!user || user.role !== 'admin') {
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

  const isDesktop = width >= 768;

  // Si no ha montado, no renderizamos el contenedor con max-width para evitar saltos visuales (flicker)
  if (!mounted) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-gray-900" style={{ paddingTop: insets.top }}>
        <Slot />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900" style={{ paddingTop: insets.top }}>
      <View className={`flex-1 w-full self-center ${isDesktop ? 'max-w-5xl' : ''}`}>
        <Slot />
      </View>
    </View>
  );
}
