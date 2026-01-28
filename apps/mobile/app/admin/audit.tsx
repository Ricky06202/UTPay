import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_URL } from '@/constants/api';

type Transaction = {
  txHash: string;
  senderEmail: string;
  receiverEmail: string;
  amount: number;
  description: string;
  status: string;
  createdAt: number;
};

export default function TransactionAudit() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/admin/transactions`);
      const data = await response.json();
      if (data.success) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => 
    (tx.senderEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (tx.receiverEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tx.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tx.txHash || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderTxItem = ({ item }: { item: Transaction }) => {
    let dateStr = 'Fecha desconocida';
    try {
      if (item.createdAt) {
        const timestamp = typeof item.createdAt === 'number' 
          ? item.createdAt * 1000 
          : new Date(item.createdAt).getTime();
        dateStr = new Date(timestamp).toLocaleString();
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }
    const isSuccess = (item.status || '') === 'confirmed' || (item.status || '') === 'success';

    return (
      <View className="p-4 mb-3 bg-white rounded-3xl border border-gray-100 shadow-sm dark:bg-gray-800 dark:border-gray-700">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text className="text-[10px] text-gray-400 font-mono" numberOfLines={1}>{item.txHash}</Text>
            <Text className="mt-1 text-xs text-gray-500">{dateStr}</Text>
          </View>
          <View className={`px-2 py-1 rounded-lg ${isSuccess ? 'bg-green-100' : 'bg-orange-100'}`}>
            <Text className={`text-[10px] font-bold ${isSuccess ? 'text-green-600' : 'text-orange-600'}`}>
              {(item.status || 'unknown').toUpperCase()}
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center mt-2">
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="w-12 text-xs font-bold text-gray-700 dark:text-gray-300">De:</Text>
              <Text className="flex-1 text-xs text-gray-500 dark:text-gray-400">{item.senderEmail || 'Desconocido'}</Text>
            </View>
            <View className="flex-row items-center mt-1">
              <Text className="w-12 text-xs font-bold text-gray-700 dark:text-gray-300">Para:</Text>
              <Text className="flex-1 text-xs text-gray-500 dark:text-gray-400">{item.receiverEmail || 'Desconocido'}</Text>
            </View>
          </View>
          <Text className="ml-4 text-lg font-bold text-gray-900 dark:text-white">
            {Number(item.amount || 0).toFixed(2)} UTP
          </Text>
        </View>

        {item.description ? (
          <View className="pt-3 mt-3 border-t border-gray-50 dark:border-gray-700">
            <Text className="text-xs italic text-gray-400">{item.description}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View className="flex-1 px-6">
        {/* Header */}
      <View className="flex-row items-center justify-between py-6">
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => router.replace('/admin')}
            className="p-2 mr-4 bg-white rounded-full shadow-sm dark:bg-gray-800"
          >
            <IconSymbol name="chevron.left" size={24} color="#6b7280" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">Auditoría de Red</Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">Historial global de transacciones</Text>
          </View>
        </View>

        <TouchableOpacity 
          onPress={fetchTransactions}
          disabled={loading}
          className="p-3 bg-white rounded-2xl shadow-sm dark:bg-gray-800"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#9333ea" />
          ) : (
            <IconSymbol name="arrow.clockwise" size={20} color="#9333ea" />
          )}
        </TouchableOpacity>
      </View>

        {/* Search Bar */}
        <View className="flex-row items-center px-4 py-3 mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm dark:bg-gray-800 dark:border-gray-700">
          <IconSymbol name="magnifyingglass" size={20} color="#9ca3af" />
          <TextInput
            placeholder="Buscar por correo, hash o descripción..."
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
            data={filteredTransactions}
            renderItem={renderTxItem}
            keyExtractor={item => item.txHash}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="items-center mt-10">
                <Text className="text-gray-500">No hay transacciones registradas</Text>
              </View>
            }
          />
        )}
      </View>
    );
  }
