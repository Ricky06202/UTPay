import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/auth';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_URL } from '@/constants/api';

type User = {
  id: number;
  email: string;
  name: string;
  walletAddress: string;
  role: string;
  balance: number;
};

export default function UserManagement() {
  const { user: adminUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newWallet, setNewWallet] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMintModalVisible, setIsMintModalVisible] = useState(false);
  const [mintAmount, setMintAmount] = useState('');
  const [isMinting, setIsMinting] = useState(false);
  const [isBurnModalVisible, setIsBurnModalVisible] = useState(false);
  const [burnAmount, setBurnAmount] = useState('');
  const [isBurning, setIsBurning] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/users`);
      const data = await response.json();
      if (Array.isArray(data)) {
        // Ordenar por nombre
        const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
        setUsers(sorted);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWallet = async () => {
    if (!selectedUser || !newWallet) return;
    if (!newWallet.startsWith('0x') || newWallet.length !== 42) {
      Alert.alert('Error', 'Dirección de wallet inválida');
      return;
    }

    try {
      setIsUpdating(true);
      const response = await fetch(`${API_URL}/admin/update-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: selectedUser.email,
          newWallet: newWallet,
          adminId: adminUser?.id
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Éxito', 'Wallet actualizada correctamente');
        setIsModalVisible(false);
        fetchUsers(); // Recargar lista
      } else {
        Alert.alert('Error', data.message || 'No se pudo actualizar la wallet');
      }
    } catch (error) {
      console.error('Error updating wallet:', error);
      Alert.alert('Error', 'Ocurrió un error al conectar con el servidor');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMint = async () => {
    if (!selectedUser || !mintAmount) return;
    const amount = parseFloat(mintAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Monto inválido');
      return;
    }

    try {
      setIsMinting(true);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos de timeout

      const response = await fetch(`${API_URL}/admin/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: selectedUser.email,
          amount: amount,
          adminId: adminUser?.id
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (data.success) {
        Alert.alert(
          'Transacción Enviada', 
          `Se han enviado ${amount} UTP a ${selectedUser.name}. El saldo se actualizará en unos segundos.`
        );
        setIsMintModalVisible(false);
        setMintAmount('');
        
        // Esperar un poco antes de recargar la lista para dar tiempo a la blockchain
        setTimeout(() => fetchUsers(), 3000);
      } else {
        Alert.alert('Error', data.message || 'No se pudo cargar el saldo');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        Alert.alert('Tiempo agotado', 'La transacción se está procesando en el servidor, pero tardó demasiado en responder. Revisa el saldo en unos momentos.');
        setIsMintModalVisible(false);
        setMintAmount('');
      } else {
        console.error('Error minting:', error);
        Alert.alert('Error', 'Ocurrió un error al conectar con el servidor');
      }
    } finally {
      setIsMinting(false);
    }
  };

  const handleBurn = async () => {
    if (!selectedUser || !burnAmount) return;
    const amount = parseFloat(burnAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Monto inválido');
      return;
    }

    try {
      setIsBurning(true);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_URL}/admin/burn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: selectedUser.email,
          amount: amount,
          adminId: adminUser?.id
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (data.success) {
        Alert.alert(
          'Retiro Enviado', 
          `Se han retirado ${amount} UTP de ${selectedUser.name}. El saldo se actualizará en unos segundos.`
        );
        setIsBurnModalVisible(false);
        setBurnAmount('');
        setTimeout(() => fetchUsers(), 3000);
      } else {
        Alert.alert('Error', data.message || 'No se pudo retirar el saldo');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        Alert.alert('Tiempo agotado', 'La transacción se está procesando, revisa el saldo en unos momentos.');
        setIsBurnModalVisible(false);
        setBurnAmount('');
      } else {
        console.error('Error burning:', error);
        Alert.alert('Error', 'Ocurrió un error al conectar con el servidor');
      }
    } finally {
      setIsBurning(false);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.walletAddress || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderUserItem = ({ item }: { item: User }) => (
    <View className="flex-row justify-between items-center p-4 mb-3 bg-white rounded-3xl border border-gray-100 shadow-sm dark:bg-gray-800 dark:border-gray-700">
      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Text className="mr-2 font-bold text-gray-900 dark:text-white">{item.name || 'Sin nombre'}</Text>
          <View className={`px-2 py-0.5 rounded-full ${(item.role || 'student') === 'admin' ? 'bg-purple-100' : 'bg-blue-100'}`}>
            <Text className={`text-[10px] font-bold ${(item.role || 'student') === 'admin' ? 'text-purple-600' : 'text-blue-600'}`}>
              {(item.role || 'student').toUpperCase()}
            </Text>
          </View>
        </View>
        <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">{item.email || 'Sin correo'}</Text>
        <View className="flex-row items-center">
          <IconSymbol name="creditcard.fill" size={10} color="#9ca3af" />
          <Text className="text-[10px] text-gray-500 dark:text-gray-400 ml-1 font-bold">
            Saldo: {Number(item.balance || 0).toFixed(2)} UTP
          </Text>
        </View>
      </View>
      
      <View className="flex-row space-x-2">
        <TouchableOpacity 
          onPress={() => {
            setSelectedUser(item);
            setBurnAmount('');
            setIsBurnModalVisible(true);
          }}
          className="p-3 bg-red-50 rounded-2xl dark:bg-red-900/30"
        >
          <IconSymbol name="minus.circle.fill" size={18} color="#ef4444" />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => {
            setSelectedUser(item);
            setMintAmount('');
            setIsMintModalVisible(true);
          }}
          className="p-3 bg-green-50 rounded-2xl dark:bg-green-900/30"
        >
          <IconSymbol name="plus.circle.fill" size={18} color="#22c55e" />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => {
            setSelectedUser(item);
            setNewWallet(item.walletAddress || '');
            setIsModalVisible(true);
          }}
          className="p-3 bg-gray-50 rounded-2xl dark:bg-gray-700"
        >
          <IconSymbol name="pencil" size={18} color="#6b7280" />
        </TouchableOpacity>
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
            className="p-2 mr-4 bg-white rounded-full shadow-sm dark:bg-gray-800"
          >
            <IconSymbol name="chevron.left" size={24} color="#6b7280" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">Gestión de Usuarios</Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">Total: {users.length} usuarios registrados</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center px-4 py-3 mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm dark:bg-gray-800 dark:border-gray-700">
          <IconSymbol name="magnifyingglass" size={20} color="#9ca3af" />
          <TextInput
            placeholder="Buscar por nombre, correo o wallet..."
            placeholderTextColor="#9ca3af"
            className="flex-1 ml-3 text-gray-900 dark:text-white"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#9333ea" />
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            renderItem={renderUserItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="items-center mt-10">
                <Text className="text-gray-500">No se encontraron usuarios</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Edit Wallet Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center px-6 bg-black/50">
          <View className={`bg-white dark:bg-gray-800 w-full p-6 rounded-3xl shadow-xl ${isDesktop ? 'max-w-md' : ''}`}>
            <Text className="mb-2 text-xl font-bold text-gray-900 dark:text-white">Editar Wallet</Text>
            <Text className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Actualizar la dirección de blockchain para {selectedUser?.name}
            </Text>

            <View className="p-4 mb-6 bg-gray-50 rounded-2xl dark:bg-gray-900">
              <Text className="mb-2 text-xs font-bold text-gray-400 uppercase">Nueva Dirección (Hex)</Text>
              <TextInput
                value={newWallet}
                onChangeText={setNewWallet}
                placeholder="0x..."
                placeholderTextColor="#9ca3af"
                className="font-mono text-gray-900 dark:text-white"
                multiline
              />
            </View>

            <View className="flex-row space-x-3">
              <TouchableOpacity 
                onPress={() => setIsModalVisible(false)}
                className="flex-1 items-center py-4 bg-gray-100 rounded-2xl dark:bg-gray-700"
              >
                <Text className="font-bold text-gray-600 dark:text-gray-300">Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={handleUpdateWallet}
                disabled={isUpdating}
                className="flex-row flex-1 justify-center items-center py-4 bg-purple-600 rounded-2xl"
              >
                {isUpdating ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <IconSymbol name="checkmark.circle.fill" size={18} color="white" />
                    <Text className="ml-2 font-bold text-white">Guardar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mint (Top-up) Modal */}
      <Modal
        visible={isMintModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMintModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center px-6 bg-black/50">
          <View className={`bg-white dark:bg-gray-800 w-full p-6 rounded-3xl shadow-xl ${isDesktop ? 'max-w-md' : ''}`}>
            <View className="flex-row items-center mb-4">
              <View className="p-3 mr-4 bg-green-100 rounded-2xl">
                <IconSymbol name="plus.circle.fill" size={24} color="#22c55e" />
              </View>
              <View>
                <Text className="text-xl font-bold text-gray-900 dark:text-white">Cargar Saldo</Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">Usuario: {selectedUser?.name}</Text>
              </View>
            </View>

            <Text className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Ingresa el monto de UTP que deseas asignar a este estudiante. Esta operación es irreversible en la blockchain.
            </Text>

            <View className="p-4 mb-6 bg-gray-50 rounded-2xl dark:bg-gray-900">
              <Text className="mb-2 text-xs font-bold text-gray-400 uppercase">Monto a Cargar (UTP)</Text>
              <TextInput
                value={mintAmount}
                onChangeText={setMintAmount}
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                className="text-2xl font-bold text-gray-900 dark:text-white"
              />
            </View>

            <View className="flex-row space-x-3">
              <TouchableOpacity 
                onPress={() => setIsMintModalVisible(false)}
                className="flex-1 items-center py-4 bg-gray-100 rounded-2xl dark:bg-gray-700"
              >
                <Text className="font-bold text-gray-600 dark:text-gray-300">Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={handleMint}
                disabled={isMinting}
                className="flex-row flex-1 justify-center items-center py-4 bg-green-600 rounded-2xl"
              >
                {isMinting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <IconSymbol name="bolt.fill" size={18} color="white" />
                    <Text className="ml-2 font-bold text-white">Ejecutar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Burn (Withdraw) Modal */}
      <Modal
        visible={isBurnModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsBurnModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center px-6 bg-black/50">
          <View className={`bg-white dark:bg-gray-800 w-full p-6 rounded-3xl shadow-xl ${isDesktop ? 'max-w-md' : ''}`}>
            <View className="flex-row items-center mb-4">
              <View className="p-3 mr-4 bg-red-100 rounded-2xl">
                <IconSymbol name="minus.circle.fill" size={24} color="#ef4444" />
              </View>
              <View>
                <Text className="text-xl font-bold text-gray-900 dark:text-white">Retirar Saldo</Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">Usuario: {selectedUser?.name}</Text>
              </View>
            </View>

            <Text className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Ingresa el monto de UTP que deseas eliminar de la cuenta de este estudiante.
            </Text>

            <View className="p-4 mb-6 bg-gray-50 rounded-2xl dark:bg-gray-900">
              <Text className="mb-2 text-xs font-bold text-gray-400 uppercase">Monto a Retirar (UTP)</Text>
              <TextInput
                value={burnAmount}
                onChangeText={setBurnAmount}
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                className="text-2xl font-bold text-gray-900 dark:text-white"
              />
            </View>

            <View className="flex-row space-x-3">
              <TouchableOpacity 
                onPress={() => setIsBurnModalVisible(false)}
                className="flex-1 items-center py-4 bg-gray-100 rounded-2xl dark:bg-gray-700"
              >
                <Text className="font-bold text-gray-600 dark:text-gray-300">Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={handleBurn}
                disabled={isBurning}
                className="flex-row flex-1 justify-center items-center py-4 bg-red-600 rounded-2xl"
              >
                {isBurning ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <IconSymbol name="trash.fill" size={18} color="white" />
                    <Text className="ml-2 font-bold text-white">Eliminar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
