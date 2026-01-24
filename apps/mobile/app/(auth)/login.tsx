import { API_URL } from '@/constants/api';
import { useAuth } from '@/context/auth';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isWeb = Platform.OS === 'web';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
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
    <View 
      style={{ 
        flex: 1, 
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }} 
      className="bg-white dark:bg-gray-900"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className={`flex-1 justify-center items-center px-6 py-12 ${isWeb ? 'mx-auto w-full max-w-[1200px]' : ''}`}>
          
          <View className={`${isWeb ? 'p-10 bg-gray-50 shadow-xl w-[450px] dark:bg-gray-800 rounded-[40px]' : 'w-full'}`}>
            <View className="items-center mb-10">
              <View className="justify-center items-center mb-4 w-20 h-20 bg-blue-600 rounded-3xl shadow-lg shadow-blue-500/50">
                <Text className="text-4xl font-bold text-white">U</Text>
              </View>
              <Text className="text-3xl font-bold text-gray-900 dark:text-white">Bienvenido a UTPay</Text>
              <Text className="mt-2 text-center text-gray-500 dark:text-gray-400">Inicia sesión con tu cuenta institucional</Text>
            </View>

            {error ? (
              <View className="p-4 mb-6 bg-red-50 rounded-2xl border border-red-100 dark:bg-red-900/20 dark:border-red-900/30">
                <Text className="font-medium text-center text-red-600 dark:text-red-400">{error}</Text>
              </View>
            ) : null}

            <View className="space-y-6">
              <View>
                <Text className="mb-2 ml-1 font-bold text-gray-700 dark:text-gray-300">Correo Electrónico</Text>
                <TextInput
                  placeholder="ejemplo@utp.ac.pa"
                  placeholderTextColor="#9ca3af"
                  className="px-6 h-16 text-lg text-gray-900 bg-white rounded-2xl border border-gray-100 shadow-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View className="mt-6">
                <Text className="mb-2 ml-1 font-bold text-gray-700 dark:text-gray-300">Contraseña</Text>
                <TextInput
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  className="px-6 h-16 text-lg text-gray-900 bg-white rounded-2xl border border-gray-100 shadow-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <TouchableOpacity 
                onPress={handleLogin}
                disabled={loading}
                className="justify-center items-center mt-10 h-16 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/30"
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-xl font-bold text-white">Entrar</Text>
                )}
              </TouchableOpacity>
            </View>

            <View className="flex-row justify-center mt-8">
              <Text className="text-lg text-gray-500 dark:text-gray-400">¿No tienes cuenta? </Text>
              <Link href="/register" asChild>
                <TouchableOpacity>
                  <Text className="text-lg font-bold text-blue-600">Regístrate</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
          
        </View>
      </ScrollView>
    </View>
  );
}
