import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_URL } from '@/constants/api';

const isWeb = Platform.OS === 'web';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError('Por favor llena todos los campos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirigir al login después de un registro exitoso
        router.replace('/login');
      } else {
        setError(data.message || 'Error al registrarse');
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className={`flex-1 justify-center items-center px-6 py-12 ${isWeb ? 'max-w-[1200px] mx-auto w-full' : ''}`}>
          
          <View className={`${isWeb ? 'w-[450px] bg-gray-50 dark:bg-gray-800 p-10 rounded-[40px] shadow-xl' : 'w-full'}`}>
            <View className="items-center mb-10">
              <Text className="text-3xl font-bold text-gray-900 dark:text-white text-center">Crea tu cuenta</Text>
              <Text className="text-gray-500 dark:text-gray-400 mt-2 text-center">Únete a la economía digital de la UTP</Text>
            </View>

            {error ? (
              <View className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl mb-6 border border-red-100 dark:border-red-900/30">
                <Text className="text-red-600 dark:text-red-400 text-center font-medium">{error}</Text>
              </View>
            ) : null}

            <View className="space-y-6">
              <View>
                <Text className="text-gray-700 dark:text-gray-300 font-bold mb-2 ml-1">Nombre Completo</Text>
                <TextInput
                  placeholder="Juan Pérez"
                  placeholderTextColor="#9ca3af"
                  className="bg-white dark:bg-gray-700 h-16 rounded-2xl px-6 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-600 text-lg shadow-sm"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View className="mt-6">
                <Text className="text-gray-700 dark:text-gray-300 font-bold mb-2 ml-1">Correo UTP</Text>
                <TextInput
                  placeholder="ejemplo@utp.ac.pa"
                  placeholderTextColor="#9ca3af"
                  className="bg-white dark:bg-gray-700 h-16 rounded-2xl px-6 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-600 text-lg shadow-sm"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View className="mt-6">
                <Text className="text-gray-700 dark:text-gray-300 font-bold mb-2 ml-1">Contraseña</Text>
                <TextInput
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  className="bg-white dark:bg-gray-700 h-16 rounded-2xl px-6 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-600 text-lg shadow-sm"
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <TouchableOpacity 
                onPress={handleRegister}
                disabled={loading}
                className="bg-blue-600 h-16 rounded-2xl items-center justify-center mt-10 shadow-lg shadow-blue-500/30"
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-xl">Registrarse</Text>
                )}
              </TouchableOpacity>
            </View>

            <View className="flex-row justify-center mt-8">
              <Text className="text-gray-500 dark:text-gray-400 text-lg">¿Ya tienes cuenta? </Text>
              <Link href="/login" asChild>
                <TouchableOpacity>
                  <Text className="text-blue-600 font-bold text-lg">Inicia sesión</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
          
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
