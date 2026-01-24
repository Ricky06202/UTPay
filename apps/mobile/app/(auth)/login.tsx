import { API_URL } from '@/constants/api';
import { useAuth } from '@/context/auth';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const isWeb = Platform.OS === 'web';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Por favor llena todos los campos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        await signIn(data.token, data.user);
        router.replace('/(tabs)');
      } else {
        setError(data.message || 'Error al iniciar sesión');
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
              <View className="h-20 w-20 bg-blue-600 rounded-3xl items-center justify-center mb-4 shadow-lg shadow-blue-500/50">
                <Text className="text-white text-4xl font-bold">U</Text>
              </View>
              <Text className="text-3xl font-bold text-gray-900 dark:text-white">Bienvenido a UTPay</Text>
              <Text className="text-gray-500 dark:text-gray-400 mt-2 text-center">Inicia sesión con tu cuenta institucional</Text>
            </View>

            {error ? (
              <View className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl mb-6 border border-red-100 dark:border-red-900/30">
                <Text className="text-red-600 dark:text-red-400 text-center font-medium">{error}</Text>
              </View>
            ) : null}

            <View className="space-y-6">
              <View>
                <Text className="text-gray-700 dark:text-gray-300 font-bold mb-2 ml-1">Correo Electrónico</Text>
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
                onPress={handleLogin}
                disabled={loading}
                className="bg-blue-600 h-16 rounded-2xl items-center justify-center mt-10 shadow-lg shadow-blue-500/30"
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-xl">Entrar</Text>
                )}
              </TouchableOpacity>
            </View>

            <View className="flex-row justify-center mt-8">
              <Text className="text-gray-500 dark:text-gray-400 text-lg">¿No tienes cuenta? </Text>
              <Link href="/register" asChild>
                <TouchableOpacity>
                  <Text className="text-blue-600 font-bold text-lg">Regístrate</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
          
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
