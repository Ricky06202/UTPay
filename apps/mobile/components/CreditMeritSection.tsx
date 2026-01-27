import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { IconSymbol } from './ui/icon-symbol';
import { useAuth } from '@/context/auth';
import { API_URL } from '@/constants/api';
import { getWallet } from '@/constants/blockchain';
import { ethers } from 'ethers';

export function CreditMeritSection() {
  const { user, refreshUser } = useAuth();
  const [isLoanModalVisible, setIsLoanModalVisible] = useState(false);
  const [loanAmount, setLoanAmount] = useState('10');
  const [isRequesting, setIsRequesting] = useState(false);

  if (!user) return null;

  const creditScore = user.creditScore || 0;
  const academicIndex = user.academicIndex || 0;
  const runningDistance = user.runningDistance || 0;
  const socialHours = user.socialHours || 0;
  const activeLoan = user.activeLoan || 0;

  const handleRequestLoan = async () => {
    if (creditScore < 80) {
      Alert.alert('Mérito Insuficiente', 'Necesitas un Credit Score de al menos 80 para solicitar un micro-crédito.');
      return;
    }

    if (activeLoan > 0) {
      Alert.alert('Préstamo Activo', 'Ya tienes un préstamo pendiente de pago.');
      return;
    }

    try {
      setIsRequesting(true);
      
      // 1. Obtener wallet local
      const wallet = await getWallet();
      if (!wallet) throw new Error('No se encontró la llave privada');

      // 2. Llamar al contrato (Simulación o llamada real)
      // En este caso, para la tesis, llamaremos al contrato directamente si es posible
      // o a través de un endpoint que facilite la transacción.
      
      // Llamada al endpoint de la API para procesar el préstamo
      const response = await fetch(`${API_URL}/transactions/request-loan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          amount: parseFloat(loanAmount),
          walletAddress: user.walletAddress
        })
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('¡Éxito!', `Tu préstamo de ${loanAmount} UTP ha sido aprobado y depositado.`);
        setIsLoanModalVisible(false);
        refreshUser();
      } else {
        throw new Error(data.message || 'Error al procesar el préstamo');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsRequesting(false);
    }
  };

  const StatBar = ({ label, value, max, color, icon }: any) => {
    const percentage = Math.min((value / max) * 100, 100);
    return (
      <View className="mb-4">
        <View className="flex-row justify-between items-center mb-1">
          <View className="flex-row items-center">
            <IconSymbol name={icon} size={16} color={color} />
            <Text className="ml-2 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{label}</Text>
          </View>
          <Text className="text-sm font-bold text-gray-900 dark:text-white">{value.toFixed(1)}{max === 5 ? '' : max === 50 ? 'km' : 'h'}</Text>
        </View>
        <View className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <View 
            className="h-full rounded-full" 
            style={{ width: `${percentage}%`, backgroundColor: color }} 
          />
        </View>
      </View>
    );
  };

  return (
    <View className="w-full mt-8">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-2xl font-bold text-gray-800 dark:text-white">Mérito y Crédito</Text>
        <View className="bg-purple-100 dark:bg-purple-900/30 px-3 py-1 rounded-full">
          <Text className="text-xs font-bold text-purple-600 dark:text-purple-300">TESIS MODE</Text>
        </View>
      </View>

      <View className="flex-row space-x-4 mb-6">
        {/* Card Score RPG */}
        <View className="flex-1 bg-white dark:bg-gray-800 p-6 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm items-center justify-center">
          <Text className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Credit Score</Text>
          <View className="relative items-center justify-center">
            <Text className={`text-5xl font-black ${creditScore >= 80 ? 'text-green-500' : 'text-purple-600'}`}>
              {creditScore}
            </Text>
            <Text className="text-[10px] font-bold text-gray-400 uppercase">Puntos</Text>
          </View>
          <View className={`mt-4 px-3 py-1 rounded-lg ${creditScore >= 80 ? 'bg-green-50' : 'bg-purple-50'} dark:bg-opacity-10`}>
            <Text className={`text-[10px] font-bold ${creditScore >= 80 ? 'text-green-600' : 'text-purple-600'}`}>
              {creditScore >= 80 ? 'NIVEL: MERITORIO' : 'NIVEL: ESTUDIANTE'}
            </Text>
          </View>
        </View>

        {/* Acciones de Crédito */}
        <View className="flex-1 space-y-3">
          <TouchableOpacity 
            onPress={() => setIsLoanModalVisible(true)}
            className="flex-1 bg-purple-600 p-4 rounded-3xl items-center justify-center shadow-md shadow-purple-500/30"
          >
            <IconSymbol name="creditcard.fill" size={24} color="white" />
            <Text className="text-white font-bold mt-2 text-center">Pedir Préstamo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 rounded-3xl items-center justify-center shadow-sm"
          >
            <IconSymbol name="arrow.up.heart.fill" size={24} color="#9333ea" />
            <Text className="text-purple-600 dark:text-purple-400 font-bold mt-2 text-center">Donar al Fondo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats RPG Grid */}
      <View className="bg-white dark:bg-gray-800 p-6 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm">
        <Text className="text-sm font-bold text-gray-800 dark:text-white mb-4">Estadísticas de Mérito (RPG)</Text>
        
        <StatBar label="Índice Académico" value={academicIndex} max={3} color="#3b82f6" icon="book.fill" />
        <StatBar label="Running (Deporte)" value={runningDistance} max={50} color="#f97316" icon="figure.run" />
        <StatBar label="Horas Sociales" value={socialHours} max={100} color="#22c55e" icon="person.3.fill" />
        
        <View className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
          <View className="flex-row items-center">
            <IconSymbol name="info.circle.fill" size={16} color="#6b7280" />
            <Text className="ml-2 text-[10px] text-gray-500 leading-tight">
              Tu Score se calcula automáticamente combinando tus notas, actividad física y compromiso social. ¡Sube tu score para desbloquear préstamos de mayor monto!
            </Text>
          </View>
        </View>
      </View>

      {/* Modal de Préstamo */}
      <Modal
        visible={isLoanModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsLoanModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-gray-900 rounded-t-[40px] p-8 pb-12">
            <View className="w-12 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full self-center mb-8" />
            
            <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Solicitar Micro-crédito</Text>
            <Text className="text-gray-500 mb-8">El monto solicitado se depositará al instante si cumples con el mérito necesario.</Text>
            
            <View className="mb-8">
              <Text className="text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Monto a solicitar (UTP)</Text>
              <View className="flex-row items-center bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
                <Text className="text-2xl font-bold text-purple-600 mr-2">$</Text>
                <TextInput
                  value={loanAmount}
                  onChangeText={setLoanAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  className="flex-1 text-2xl font-bold text-gray-900 dark:text-white"
                />
              </View>
              <Text className="text-[10px] text-gray-400 mt-2 ml-1">
                Tasa de interés: 0% (Fondo Social UTP)
              </Text>
            </View>

            <View className="flex-row space-x-4">
              <TouchableOpacity 
                onPress={() => setIsLoanModalVisible(false)}
                className="flex-1 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl items-center justify-center"
              >
                <Text className="font-bold text-gray-600 dark:text-gray-300">Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={handleRequestLoan}
                disabled={isRequesting}
                className={`flex-[2] h-14 ${creditScore >= 80 ? 'bg-purple-600' : 'bg-gray-300'} rounded-2xl items-center justify-center shadow-lg shadow-purple-500/30`}
              >
                {isRequesting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-bold text-white">Confirmar Solicitud</Text>
                )}
              </TouchableOpacity>
            </View>
            
            {creditScore < 80 && (
              <Text className="text-center text-red-500 text-[10px] font-bold mt-4">
                ⚠️ Bloqueado: Tu Credit Score ({creditScore}) es menor a 80.
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
