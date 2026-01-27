import { API_URL } from '@/constants/api';
import { useAuth } from '@/context/auth';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from './ui/icon-symbol';

export function CreditMeritSection() {
  const { user, refreshUser } = useAuth();
  const [isLoanModalVisible, setIsLoanModalVisible] = useState(false);
  const [isEvidenceModalVisible, setIsEvidenceModalVisible] = useState(false);
  const [loanAmount, setLoanAmount] = useState('10');
  const [isRequesting, setIsRequesting] = useState(false);

  // Estados para Carga de Evidencias
  const [evidenceData, setEvidenceData] = useState({
    statIntellect: '',
    statStrengthConsistency: '',
    statStrengthPR5k: '',
    statStrengthPR10k: '',
    statStrengthPR21k: '',
    statStrategy: '',
    statZen: '',
    statService: '',
    statHonor: ''
  });
  const [isSubmittingEvidence, setIsSubmittingEvidence] = useState(false);

  if (!user) return null;

  const creditScore = user.creditScore || 0;
  const statIntellect = user.statIntellect || 0;
  const statStrengthConsistency = user.statStrengthConsistency || 0;
  const statStrengthPR5k = user.statStrengthPR5k || 0;
  const statStrengthPR10k = user.statStrengthPR10k || 0;
  const statStrengthPR21k = user.statStrengthPR21k || 0;
  const statStrategy = user.statStrategy || 1200;
  const statZen = user.statZen || 0;
  const statService = user.statService || 0;
  const statHonor = user.statHonor || 5.0;
  const activeLoan = user.activeLoan || 0;

  // Formatear segundos a mm:ss
  const formatTime = (seconds: number) => {
    if (!seconds || seconds === 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  const handleSubmitEvidence = async () => {
    try {
      setIsSubmittingEvidence(true);
      const response = await fetch(`${API_URL}/users/update-merit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          statIntellect: parseFloat(evidenceData.statIntellect || user.statIntellect?.toString() || '0'),
          statStrengthConsistency: parseInt(evidenceData.statStrengthConsistency || user.statStrengthConsistency?.toString() || '0'),
          statStrengthPR5k: parseInt(evidenceData.statStrengthPR5k || user.statStrengthPR5k?.toString() || '0'),
          statStrengthPR10k: parseInt(evidenceData.statStrengthPR10k || user.statStrengthPR10k?.toString() || '0'),
          statStrengthPR21k: parseInt(evidenceData.statStrengthPR21k || user.statStrengthPR21k?.toString() || '0'),
          statStrategy: parseInt(evidenceData.statStrategy || user.statStrategy?.toString() || '1200'),
          statZen: parseInt(evidenceData.statZen || user.statZen?.toString() || '0'),
          statService: parseInt(evidenceData.statService || user.statService?.toString() || '0'),
          statHonor: parseFloat(evidenceData.statHonor || user.statHonor?.toString() || '5.0')
        })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('¡Éxito!', 'Tus métricas han sido actualizadas y sincronizadas.');
        setIsEvidenceModalVisible(false);
        refreshUser();
      } else {
        throw new Error(data.error || 'Error al actualizar mérito');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsSubmittingEvidence(false);
    }
  };

  const StatBar = ({ label, value, max, color, icon, suffix = "", detail = "" }: any) => {
    const percentage = Math.min((value / max) * 100, 100);
    return (
      <View className="mb-4">
        <View className="flex-row justify-between items-center mb-1">
          <View className="flex-row items-center">
            <IconSymbol name={icon} size={14} color={color} />
            <Text className="ml-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</Text>
          </View>
          <View className="items-end">
            <Text className="text-xs font-bold text-gray-900 dark:text-white">{value}{suffix}</Text>
            {detail ? <Text className="text-[8px] text-gray-400">{detail}</Text> : null}
          </View>
        </View>
        <View className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
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
        <Text className="text-2xl font-bold text-gray-800 dark:text-white">Hexágono de Mérito</Text>
        <View className="bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full">
          <Text className="text-xs font-bold text-blue-600 dark:text-blue-300">UTPay CORE</Text>
        </View>
      </View>

      <View className="flex-row space-x-4 mb-6">
        {/* Card Score RPG */}
        <View className="flex-1 bg-white dark:bg-gray-800 p-6 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-sm items-center justify-center">
          <Text className="text-[10px] font-bold text-gray-400 uppercase mb-2">Puntaje Total</Text>
          <View className="relative items-center justify-center">
            <Text className={`text-5xl font-black ${creditScore >= 80 ? 'text-green-500' : 'text-blue-600'}`}>
              {creditScore}
            </Text>
            <View className="absolute -top-1 -right-4">
              <IconSymbol name="star.fill" size={16} color="#eab308" />
            </View>
          </View>
          <Text className={`text-[10px] font-bold mt-2 ${creditScore >= 80 ? 'text-green-600' : 'text-blue-500'}`}>
            {creditScore >= 80 ? 'MERITORIO' : 'EN PROGRESO'}
          </Text>
        </View>

        {/* Card Acción */}
        <View className="flex-1 space-y-3">
          <TouchableOpacity 
            onPress={() => setIsLoanModalVisible(true)}
            className={`flex-1 p-4 rounded-[24px] items-center justify-center ${creditScore >= 80 ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            <IconSymbol name="banknote.fill" size={24} color={creditScore >= 80 ? 'white' : '#9ca3af'} />
            <Text className={`text-[10px] font-bold mt-2 ${creditScore >= 80 ? 'text-white' : 'text-gray-400'}`}>SOLICITAR PRÉSTAMO</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => setIsEvidenceModalVisible(true)}
            className="flex-1 bg-blue-600 p-4 rounded-[24px] items-center justify-center"
          >
            <IconSymbol name="plus.circle.fill" size={24} color="white" />
            <Text className="text-[10px] font-bold text-white mt-2">CARGAR EVIDENCIA</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="bg-white dark:bg-gray-800 p-6 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-sm">
        <StatBar 
          label="🧠 Intelecto" 
          value={statIntellect} 
          max={3} 
          color="#3b82f6" 
          icon="brain.fill" 
          suffix="" 
          detail="Índice Académico"
        />
        <StatBar 
          label="🏃 Fortaleza" 
          value={statStrengthConsistency} 
          max={12} 
          color="#ef4444" 
          icon="figure.run" 
          suffix=" ses/mes"
          detail={`PR 5K: ${formatTime(statStrengthPR5k)}`}
        />
        <StatBar 
          label="♟️ Estrategia" 
          value={statStrategy} 
          max={2000} 
          color="#8b5cf6" 
          icon="checkerboard.shield" 
          suffix=" ELO"
          detail="Lichess / Chess.com"
        />
        <StatBar 
          label="🧘 Zen" 
          value={statZen} 
          max={300} 
          color="#10b981" 
          icon="leaf.fill" 
          suffix=" min"
          detail="Meditación mensual"
        />
        <StatBar 
          label="🤝 Servicio" 
          value={statService} 
          max={100} 
          color="#f59e0b" 
          icon="hands.sparkles.fill" 
          suffix=" h"
          detail="Servicio Social"
        />
        <StatBar 
          label="⭐ Honor" 
          value={statHonor} 
          max={5} 
          color="#eab308" 
          icon="shield.fill" 
          suffix=""
          detail="Feedback P2P"
        />
        
        <View className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
          <Text className="text-[10px] text-blue-600 dark:text-blue-400 leading-tight italic">
            "Tu perfil no vale por cuánto dinero tienes, sino por quién eres y qué haces."
          </Text>
        </View>
      </View>

      {/* Modal de Préstamo */}
      <Modal
        visible={isLoanModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsLoanModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-gray-900 p-8 rounded-t-[40px]">
            <View className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full self-center mb-8" />
            <Text className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Solicitar Micro-crédito</Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-6">Monto máximo sugerido: 20 UTP</Text>
            
            <View className="bg-gray-100 dark:bg-gray-800 p-4 rounded-2xl mb-6">
              <TextInput
                className="text-3xl font-bold text-center text-gray-800 dark:text-white"
                value={loanAmount}
                onChangeText={setLoanAmount}
                keyboardType="numeric"
                placeholder="0"
              />
              <Text className="text-center text-gray-400 font-bold uppercase mt-1">UTP Tokens</Text>
            </View>

            <TouchableOpacity 
              onPress={handleRequestLoan}
              disabled={isRequesting}
              className={`w-full py-5 rounded-3xl items-center shadow-lg ${isRequesting ? 'bg-gray-400' : 'bg-blue-600 shadow-blue-500/40'}`}
            >
              {isRequesting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-lg">Confirmar Solicitud</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setIsLoanModalVisible(false)}
              className="w-full mt-4 py-4 items-center"
            >
              <Text className="text-gray-500 font-bold">Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Carga de Evidencias */}
      <Modal
        visible={isEvidenceModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsEvidenceModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-gray-900 p-8 rounded-t-[40px] max-h-[90%]">
            <View className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full self-center mb-8" />
            <Text className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Cargar Evidencias</Text>
            <Text className="text-gray-500 dark:text-gray-400 mb-6">Actualiza tus métricas de mérito UTPay</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
              <View className="space-y-4">
                <View>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">🧠 Índice Académico (0.0 - 3.0)</Text>
                  <TextInput
                    className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl text-gray-800 dark:text-white font-bold"
                    placeholder={statIntellect.toString()}
                    value={evidenceData.statIntellect}
                    onChangeText={(val) => setEvidenceData({...evidenceData, statIntellect: val})}
                    keyboardType="numeric"
                  />
                </View>

                <View>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">🏃 Sesiones Running / Mes</Text>
                  <TextInput
                    className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl text-gray-800 dark:text-white font-bold"
                    placeholder={statStrengthConsistency.toString()}
                    value={evidenceData.statStrengthConsistency}
                    onChangeText={(val) => setEvidenceData({...evidenceData, statStrengthConsistency: val})}
                    keyboardType="numeric"
                  />
                </View>

                <View className="flex-row space-x-2">
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">5K (Seg)</Text>
                    <TextInput
                      className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl text-gray-800 dark:text-white font-bold"
                      placeholder={statStrengthPR5k.toString()}
                      value={evidenceData.statStrengthPR5k}
                      onChangeText={(val) => setEvidenceData({...evidenceData, statStrengthPR5k: val})}
                      keyboardType="numeric"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">10K (Seg)</Text>
                    <TextInput
                      className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl text-gray-800 dark:text-white font-bold"
                      placeholder={statStrengthPR10k.toString()}
                      value={evidenceData.statStrengthPR10k}
                      onChangeText={(val) => setEvidenceData({...evidenceData, statStrengthPR10k: val})}
                      keyboardType="numeric"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">21K (Seg)</Text>
                    <TextInput
                      className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl text-gray-800 dark:text-white font-bold"
                      placeholder={statStrengthPR21k.toString()}
                      value={evidenceData.statStrengthPR21k}
                      onChangeText={(val) => setEvidenceData({...evidenceData, statStrengthPR21k: val})}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">♟️ Rating ELO Ajedrez</Text>
                  <TextInput
                    className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl text-gray-800 dark:text-white font-bold"
                    placeholder={statStrategy.toString()}
                    value={evidenceData.statStrategy}
                    onChangeText={(val) => setEvidenceData({...evidenceData, statStrategy: val})}
                    keyboardType="numeric"
                  />
                </View>

                <View>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">🧘 Minutos Meditación</Text>
                  <TextInput
                    className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl text-gray-800 dark:text-white font-bold"
                    placeholder={statZen.toString()}
                    value={evidenceData.statZen}
                    onChangeText={(val) => setEvidenceData({...evidenceData, statZen: val})}
                    keyboardType="numeric"
                  />
                </View>

                <View>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">🤝 Horas Servicio Social</Text>
                  <TextInput
                    className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl text-gray-800 dark:text-white font-bold"
                    placeholder={statService.toString()}
                    value={evidenceData.statService}
                    onChangeText={(val) => setEvidenceData({...evidenceData, statService: val})}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity 
              onPress={handleSubmitEvidence}
              disabled={isSubmittingEvidence}
              className={`w-full py-5 rounded-3xl items-center shadow-lg ${isSubmittingEvidence ? 'bg-gray-400' : 'bg-blue-600 shadow-blue-500/40'}`}
            >
              {isSubmittingEvidence ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-lg">Guardar Cambios</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setIsEvidenceModalVisible(false)}
              className="w-full mt-4 py-4 items-center"
            >
              <Text className="text-gray-500 font-bold">Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
