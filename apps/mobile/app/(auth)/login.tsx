import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/context/auth';
import { ethers, Wallet } from 'ethers';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isWeb = Platform.OS === 'web';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState('');
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
      // Intentar recuperar llave temporal si existe para enviarla al login
      let tempWalletAddress = undefined;
      try {
        let tempKey;
        if (Platform.OS === 'web') {
          tempKey = localStorage.getItem('temp_private_key');
        } else {
          const SecureStore = require('expo-secure-store');
          tempKey = await SecureStore.getItemAsync('temp_private_key');
        }
        
        if (tempKey) {
           const wallet = new Wallet(tempKey);
           tempWalletAddress = wallet.address;
         }
       } catch (e) {
         console.log('No temp key found or error reading it');
       }
 
       const controller = new AbortController();
       const timeoutId = setTimeout(() => controller.abort(), 10000);

       const response = await fetch(`${API_URL}/auth/login`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ 
           email, 
           password,
           walletAddress: tempWalletAddress // Enviamos la dirección si la importó antes
         }),
         signal: controller.signal
       });
       
       clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success) {
        // Verificar si tenemos una llave importada temporalmente
        let finalUser = data.user;
        try {
          let tempKey, tempSeed;
          if (Platform.OS === 'web') {
            tempKey = localStorage.getItem('temp_private_key');
            tempSeed = localStorage.getItem('temp_seed_phrase');
            localStorage.removeItem('temp_private_key');
            localStorage.removeItem('temp_seed_phrase');
          } else {
            const SecureStore = require('expo-secure-store');
            tempKey = await SecureStore.getItemAsync('temp_private_key');
            tempSeed = await SecureStore.getItemAsync('temp_seed_phrase');
            await SecureStore.deleteItemAsync('temp_private_key');
            await SecureStore.deleteItemAsync('temp_seed_phrase');
          }

          if (tempKey && tempSeed) {
            finalUser = { ...finalUser, privateKey: tempKey, seedPhrase: tempSeed };
          }
        } catch (storageErr) {
          console.error('Error recuperando llave temporal:', storageErr);
        }

        await signIn(data.token, finalUser);
        if (finalUser.role === 'admin') {
          router.replace('/admin');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        setError(data.message || 'Error al iniciar sesión');
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleImportWallet = async () => {
    if (!seedPhrase || seedPhrase.trim().split(/\s+/).length !== 12) {
      alert('Por favor ingresa una frase semilla válida de 12 palabras');
      return;
    }

    setIsImporting(true);
    try {
      // Limpiar la frase
      const cleanSeed = seedPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
      const words = cleanSeed.split(' ');
      
      if (words.length !== 12) {
        alert(`La frase debe tener exactamente 12 palabras. (Ingresaste ${words.length})`);
        return;
      }

      // Intentar el método estándar (BIP-39), si falla generar llave determinística
      let wallet;
      try {
        wallet = Wallet.fromMnemonic(cleanSeed);
      } catch (e) {
        // Generar llave a partir del hash del texto (acepta cualquier frase de 12 palabras)
        const hash = ethers.utils.id(cleanSeed);
        wallet = new Wallet(hash);
      }
      
      if (Platform.OS === 'web') {
        localStorage.setItem('temp_private_key', wallet.privateKey);
        localStorage.setItem('temp_seed_phrase', cleanSeed);
      } else {
        const SecureStore = require('expo-secure-store');
        await SecureStore.setItemAsync('temp_private_key', wallet.privateKey);
        await SecureStore.setItemAsync('temp_seed_phrase', cleanSeed);
      }
      
      alert('Billetera restaurada correctamente. Ahora inicia sesión para entrar a tu cuenta.');
      setShowImportModal(false);
      setSeedPhrase('');
    } catch (err) {
      alert('Error al procesar la frase. Intenta de nuevo.');
    } finally {
      setIsImporting(false);
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
              <View className="justify-center items-center mb-4 w-28 h-28 bg-white rounded-[32px] shadow-lg overflow-hidden p-4">
                <Image 
                  source={require('@/assets/images/icon.png')} 
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                />
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
                className="justify-center items-center mt-10 h-16 bg-purple-600 rounded-2xl shadow-lg shadow-purple-500/30"
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
                  <Text className="text-lg font-bold text-purple-600">Regístrate</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <TouchableOpacity 
              onPress={() => setShowImportModal(true)}
              className="mt-6 items-center"
            >
              <Text className="text-gray-500 dark:text-gray-400 underline">Recuperar billetera con frase semilla</Text>
            </TouchableOpacity>
          </View>
          
        </View>
      </ScrollView>

      {/* Modal de Importación */}
      <Modal
        visible={showImportModal}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-gray-900 rounded-t-[40px] p-8 h-[70%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-gray-900 dark:text-white">Recuperar Cuenta</Text>
              <TouchableOpacity onPress={() => setShowImportModal(false)}>
                <IconSymbol name="xmark.circle.fill" size={30} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <Text className="text-gray-600 dark:text-gray-400 mb-6">
              Ingresa las 12 palabras de tu frase semilla para recuperar el acceso a tus fondos.
            </Text>

            <TextInput
              placeholder="palabra1 palabra2 ..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              className="p-6 text-lg text-gray-900 bg-gray-50 rounded-2xl border border-gray-100 dark:bg-gray-800 dark:text-white dark:border-gray-700 h-32"
              value={seedPhrase}
              onChangeText={setSeedPhrase}
              autoCapitalize="none"
            />

            <TouchableOpacity 
              onPress={handleImportWallet}
              disabled={loading}
              className="justify-center items-center mt-8 h-16 bg-purple-600 rounded-2xl shadow-lg shadow-purple-500/30"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-xl font-bold text-white">Importar Billetera</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
