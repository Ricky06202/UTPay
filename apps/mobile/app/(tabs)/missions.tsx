import { IconSymbol } from '@/components/ui/icon-symbol';
import { UTPSymbol } from '@/components/ui/UTPSymbol';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/context/auth';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isWeb = Platform.OS === 'web';

export default function MissionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [missions, setMissions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [reward, setReward] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [viewingApplicationsMissionId, setViewingApplicationsMissionId] = useState<number | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [selectedMissionForApply, setSelectedMissionForApply] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [applyComment, setApplyComment] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  // Alert Modal State
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'confirm';
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' | 'confirm' = 'info', onConfirm?: () => void) => {
    setAlertConfig({ visible: true, title, message, type, onConfirm });
  };

  const validateDecimals = (value: string) => {
    if (!value) return true;
    const parts = value.split('.');
    if (parts.length > 2) return false;
    if (parts.length === 2 && parts[1].length > 2) return false;
    return true;
  };

  const handlePriceChange = (value: string, setter: (val: string) => void) => {
    // Solo permitir números y un punto decimal
    const cleaned = value.replace(/[^0-9.]/g, '');
    
    // Evitar múltiples puntos
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    
    // Limitar a 2 decimales
    if (parts.length === 2 && parts[1].length > 2) return;
    
    setter(cleaned);
  };

  useEffect(() => {
    fetchInitialData();
  }, [user?.id]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    await Promise.all([fetchMissions(), fetchCategories()]);
    setIsLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/missions/categories`);
      const data = await response.json();
      if (data.success) {
        setCategories(data.categories);
        if (data.categories.length > 0 && !selectedCategoryId) {
          setSelectedCategoryId(data.categories[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchMissions = async () => {
    try {
      const [openRes, userRes] = await Promise.all([
        fetch(`${API_URL}/missions/open?userId=${user?.id}`),
        user?.id ? fetch(`${API_URL}/missions/user/${user.id}`) : Promise.resolve(null)
      ]);

      const openData = await openRes.json();
      let allMissions = openData.success ? openData.missions : [];

      if (userRes) {
        const userData = await userRes.json();
        if (userData.success) {
          // Combinar tareas abiertas con las del usuario, evitando duplicados
          const userMissions = userData.missions;
          const openIds = new Set(allMissions.map((m: any) => m.id));
          
          userMissions.forEach((m: any) => {
            if (!openIds.has(m.id)) {
              allMissions.push(m);
            }
          });
          
          // Ordenar por fecha de creación descendente
          allMissions.sort((a: any, b: any) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }
      }

      setMissions(allMissions);
    } catch (error) {
      console.error('Error fetching missions:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateTask = async () => {
    if (!title || !description || !reward || !selectedCategoryId) {
      showAlert('Error', 'Por favor llena los campos obligatorios', 'error');
      return;
    }

    const rewardNum = parseFloat(reward);
    if (isNaN(rewardNum) || rewardNum <= 0) {
      showAlert('Error', 'La recompensa debe ser un número válido mayor a 0', 'error');
      return;
    }

    if (!validateDecimals(reward)) {
      showAlert('Error', 'La recompensa no puede tener más de 2 decimales', 'error');
      return;
    }

    if (!editingTaskId && rewardNum > (user?.balance || 0)) {
      showAlert('Error', 'Saldo insuficiente para crear esta tarea', 'error');
      return;
    }

    try {
      setIsCreating(true);
      const taskData = {
        missionId: editingTaskId,
        userId: user?.id,
        creatorId: user?.id,
        title,
        description,
        categoryId: selectedCategoryId,
        reward: rewardNum,
        whatsapp,
      };
      
      const endpoint = editingTaskId ? '/missions/update' : '/missions/create';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });

      const data = await response.json();

      if (data.success) {
        setIsCreateModalVisible(false);
        resetForm();
        fetchMissions();
        refreshUser();
        showAlert('¡Éxito!', editingTaskId ? 'Tarea actualizada' : 'Tarea creada correctamente', 'success');
      } else {
        showAlert('Error', data.message || 'No se pudo procesar la tarea', 'error');
      }
    } catch (error: any) {
      showAlert('Error', 'Hubo un problema con la conexión: ' + error.message, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelTask = async (mission: any) => {
    const isCompleted = mission.status === 'completed';
    const executeCancel = async () => {
      try {
        const response = await fetch(`${API_URL}/missions/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            missionId: Number(mission.id), 
            userId: Number(user?.id) 
          }),
        });

        const data = await response.json();

        if (data.success) {
          await fetchMissions();
          await refreshUser();
          showAlert('¡Éxito!', data.message || 'Tarea eliminada', 'success');
        } else {
          showAlert('Error', data.message || 'No se pudo eliminar la tarea', 'error');
        }
      } catch (error: any) {
        showAlert('Error', 'No se pudo conectar con el servidor: ' + error.message, 'error');
      }
    };

    showAlert(
      isCompleted ? '¿Eliminar del Historial?' : '¿Eliminar Tarea?',
      isCompleted 
        ? 'Esta tarea ya fue completada. Al eliminarla, desaparecerá de tu vista pero el pago ya fue realizado.' 
        : 'Se eliminará la tarea permanentemente. Si hay postulantes, sus postulaciones también se borrarán y se te devolverá la recompensa a tu saldo.',
      'confirm',
      executeCancel
    );
  };

  const handleAddNewPress = () => {
    resetForm();
    setIsCreateModalVisible(true);
  };

  const handleEditPress = (item: any) => {
    setEditingTaskId(item.id);
    setTitle(item.title);
    setDescription(item.description);
    const category = categories.find(c => c.name === item.categoryName);
    if (category) {
      setSelectedCategoryId(category.id);
    }
    setReward(item.reward.toString());
    setWhatsapp(item.whatsapp || '');
    setIsCreateModalVisible(true);
  };

  const fetchApplications = async (missionId: number) => {
    try {
      setIsLoadingApplications(true);
      setViewingApplicationsMissionId(missionId);
      const response = await fetch(`${API_URL}/missions/applications/${missionId}`);
      const data = await response.json();
      if (data.success) {
        setApplications(data.applications);
      } else {
        showAlert('Error', data.error || 'No se pudieron cargar las postulaciones', 'error');
      }
    } catch (error: any) {
      console.error('Error fetching applications:', error);
      const errorMessage = error instanceof TypeError && error.message === 'Network request failed' 
        ? 'Error de conexión. Verifica tu internet.' 
        : error.message;
      showAlert('Error', 'No se pudieron cargar las postulaciones: ' + errorMessage, 'error');
    } finally {
      setIsLoadingApplications(false);
    }
  };

  const handleAcceptApplication = async (applicationId: number) => {
    try {
      const response = await fetch(`${API_URL}/missions/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      });

      const data = await response.json();
      if (data.success) {
        showAlert('¡Éxito!', 'Has aceptado al estudiante para esta tarea', 'success');
        fetchApplications(viewingApplicationsMissionId!);
        fetchMissions();
      } else {
        showAlert('Error', data.message || 'No se pudo aceptar la postulación', 'error');
      }
    } catch (error) {
      showAlert('Error', 'Error de conexión al aceptar la postulación', 'error');
    }
  };

  const handleCompleteApplication = async (applicationId: number) => {
    const executeComplete = async () => {
      try {
        const response = await fetch(`${API_URL}/missions/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicationId }),
        });

        const data = await response.json();
        if (data.success) {
          showAlert('¡Excelente!', 'Has confirmado el trabajo. El pago ha sido liberado al estudiante.', 'success');
          fetchApplications(viewingApplicationsMissionId!);
          fetchMissions();
          refreshUser();
        } else {
          showAlert('Error', data.message || 'No se pudo completar la tarea', 'error');
        }
      } catch (error) {
        showAlert('Error', 'Error de conexión al completar la tarea', 'error');
      }
    };

    showAlert(
      '¿Confirmar Trabajo?',
      '¿El estudiante ha terminado el trabajo correctamente? Al confirmar, se le transferirá el pago de forma inmediata.',
      'confirm',
      executeComplete
    );
  };

  const handleApply = async () => {
    if (!selectedMissionForApply || !bidAmount) {
      showAlert('Error', 'Por favor ingresa tu oferta', 'error');
      return;
    }

    const bidNum = parseFloat(bidAmount);
    if (isNaN(bidNum) || bidNum <= 0) {
      showAlert('Error', 'La oferta debe ser un número válido mayor a 0', 'error');
      return;
    }

    if (!validateDecimals(bidAmount)) {
      showAlert('Error', 'La oferta no puede tener más de 2 decimales', 'error');
      return;
    }

    try {
      setIsApplying(true);
      const response = await fetch(`${API_URL}/missions/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionId: selectedMissionForApply.id,
          studentId: user?.id,
          comment: applyComment || 'Me postulo para esta tarea',
          bidAmount: bidNum,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setApplyModalVisible(false);
        setBidAmount('');
        setApplyComment('');
        showAlert('¡Postulado!', 'Tu postulación y oferta han sido enviadas', 'success');
      } else {
        showAlert('Info', data.message || 'No se pudo enviar la postulación', 'info');
      }
    } catch (error) {
      showAlert('Error', 'No se pudo enviar la postulación', 'error');
    } finally {
      setIsApplying(false);
    }
  };

  const openApplyModal = (mission: any) => {
    setSelectedMissionForApply(mission);
    // Si ya se postuló, mostrar su oferta actual, si no, la recompensa de la tarea
    const hasApplied = mission.hasApplied > 0;
    setBidAmount(hasApplied ? mission.myBid.toString() : mission.reward.toString());
    setApplyComment(''); // Limpiar comentario previo
    setApplyModalVisible(true);
  };

  const resetForm = () => {
    setEditingTaskId(null);
    setTitle('');
    setDescription('');
    if (categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
    setReward('');
    setWhatsapp('');
  };

  const renderMissionCard = ({ item }: { item: any }) => {
    const isOwner = Number(item.creatorId) === Number(user?.id);
    const hasApplied = item.hasApplied > 0; // Asegurar que el conteo sea mayor a 0
    
    return (
    <View className="bg-white dark:bg-gray-800 rounded-[32px] p-6 mb-6 shadow-sm border border-gray-50 dark:border-gray-700">
      <View className="flex-row justify-between items-start mb-4">
        <View className="flex-1 mr-2">
          <View className="self-start px-3 py-1 mb-2 bg-blue-50 rounded-full dark:bg-blue-900/20">
            <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {item.categoryName}
            </Text>
          </View>
          <Text className="mb-1 text-xl font-bold text-gray-900 dark:text-white">{item.title}</Text>
          <Text className="mb-2 text-sm text-gray-500 dark:text-gray-400" numberOfLines={2}>{item.description}</Text>
          {item.status !== 'open' && (
            <View className={`self-start px-3 py-1 mt-2 rounded-full ${
              item.status === 'assigned' ? 'bg-orange-50 dark:bg-orange-900/20' : 
              item.status === 'completed' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-900/20'
            }`}>
              <Text className={`text-[10px] font-bold uppercase ${
                item.status === 'assigned' ? 'text-orange-600 dark:text-orange-400' : 
                item.status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
              }`}>
                {item.status === 'assigned' ? 'En Curso' : 
                 item.status === 'completed' ? 'Finalizada' : item.status}
              </Text>
            </View>
          )}
        </View>
        <View className="items-center px-4 py-2 bg-green-50 rounded-2xl dark:bg-green-900/20 flex-row">
          <UTPSymbol size={16} color="#16a34a" containerStyle={{ marginRight: 6 }} />
          <Text className="text-lg font-black text-green-600 dark:text-green-400">{item.reward.toFixed(2)}</Text>
        </View>
      </View>

      <View className="flex-row justify-between items-center pt-4 mt-2 border-t border-gray-50 dark:border-gray-700">
        <View className="flex-row items-center">
          <View className="justify-center items-center mr-2 w-8 h-8 bg-gray-100 rounded-full">
            <IconSymbol name="account.circle" size={16} color="#6b7280" />
          </View>
          <Text className="text-xs font-medium text-gray-600 dark:text-gray-300">{item.creatorName}</Text>
        </View>
        
        {isOwner ? (
          <View className="flex-row">
            {item.status === 'open' && (
              <TouchableOpacity 
                onPress={() => fetchApplications(item.id)}
                className="justify-center items-center px-4 mr-2 h-10 bg-purple-50 rounded-full dark:bg-purple-900/20"
              >
                <Text className="text-xs font-bold text-purple-600 dark:text-purple-400">Ver Postulantes</Text>
              </TouchableOpacity>
            )}
            
            {item.status === 'assigned' && (
              <TouchableOpacity 
                onPress={() => fetchApplications(item.id)}
                className="justify-center items-center px-4 mr-2 h-10 bg-green-50 rounded-full dark:bg-green-900/20"
              >
                <Text className="text-xs font-bold text-green-600 dark:text-green-400">Finalizar Tarea</Text>
              </TouchableOpacity>
            )}

            {item.status === 'open' && (
              <>
                <TouchableOpacity 
                  onPress={() => handleEditPress(item)}
                  className="justify-center items-center mr-2 w-10 h-10 bg-purple-50 rounded-full dark:bg-purple-900/20"
                >
                  <IconSymbol name="pencil" size={18} color="#9333ea" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => handleCancelTask(item)}
                  className="justify-center items-center w-10 h-10 bg-red-50 rounded-full dark:bg-red-900/20"
                >
                  <IconSymbol name="trash" size={18} color="#ef4444" />
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <View className="flex-row items-center">
            {hasApplied ? (
              <View className="items-end mr-3">
                <Text className="text-[10px] text-gray-400 uppercase font-bold">Tu Oferta</Text>
                <View className="flex-row items-center">
                  <UTPSymbol size={12} color="#9333ea" containerStyle={{ marginRight: 4 }} />
                  <Text className="text-xs font-bold text-purple-600">{item.myBid?.toFixed(2)}</Text>
                </View>
              </View>
            ) : null}
            <TouchableOpacity 
              onPress={() => openApplyModal(item)}
              className={`px-6 py-2 rounded-full ${hasApplied ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-purple-600'}`}
            >
              <Text className={`text-sm font-bold ${hasApplied ? 'text-orange-600 dark:text-orange-400' : 'text-white'}`}>
                {hasApplied ? 'Modificar Oferta' : 'Postularme'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
    );
  };

  return (
    <View 
      className="flex-1"
      style={{ 
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }} 
    >
      <View className="flex-1 items-center">
        <View className="w-full max-w-[1200px] flex-1">
          <View className="flex-row justify-between items-center px-6 pt-2 pb-6">
          <View>
            <Text className="text-3xl font-bold text-gray-900 dark:text-white">Tareas</Text>
            <Text className="text-gray-500">Ayuda y gana UTP Coins</Text>
          </View>
          
          <View className="flex-row items-center">
            <TouchableOpacity 
              onPress={() => {
                setIsRefreshing(true);
                fetchMissions();
              }}
              className="justify-center items-center mr-3 w-12 h-12 bg-white rounded-full border border-gray-100 shadow-sm dark:bg-gray-800 dark:border-gray-700"
            >
              <IconSymbol name="refresh" size={24} color="#9333ea" />
            </TouchableOpacity>

            {isWeb && (
              <TouchableOpacity 
                onPress={() => router.push('/')}
                className="px-6 py-3 mr-3 bg-white rounded-full border border-gray-100 shadow-sm dark:bg-gray-800 dark:border-gray-700"
              >
                <Text className="font-bold text-purple-600">Volver al Panel</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              onPress={handleAddNewPress}
              className="justify-center items-center w-12 h-12 bg-blue-600 rounded-full shadow-lg shadow-blue-500/30"
            >
              <IconSymbol name="add" size={28} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {isLoading && !isRefreshing ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : (
          <FlatList
            data={missions}
            renderItem={renderMissionCard}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl 
                refreshing={isRefreshing} 
                onRefresh={() => {
                  setIsRefreshing(true); 
                  fetchMissions();
                }} 
              />
            }
            ListEmptyComponent={
              <View className="justify-center items-center py-20">
                <IconSymbol name="assignment" size={64} color="#d1d5db" />
                <Text className="px-10 mt-4 text-center text-gray-400">No hay tareas disponibles por el momento. ¡Crea la primera!</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Modal para Crear Tarea */}
      <Modal
        visible={isCreateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setIsCreateModalVisible(false);
          resetForm();
        }}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-gray-800 rounded-t-[50px] p-8 max-h-[90%]">
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="mb-8 text-2xl font-bold text-center text-gray-900 dark:text-white">
                {editingTaskId ? 'Editar Tarea' : 'Nueva Tarea'}
              </Text>
              
              <Text className="mb-2 ml-2 text-gray-500">Título de la tarea</Text>
              <TextInput
                className="p-4 mb-4 font-bold bg-gray-50 rounded-2xl dark:bg-gray-700 dark:text-white"
                placeholder="Ej: Tutoría de Cálculo I"
                placeholderTextColor="#9ca3af"
                value={title}
                onChangeText={setTitle}
              />

              <Text className="mb-2 ml-2 text-gray-500">Descripción detallada</Text>
              <TextInput
                className="p-4 mb-4 h-32 bg-gray-50 rounded-2xl dark:bg-gray-700 dark:text-white"
                placeholder="Explica qué necesitas..."
                placeholderTextColor="#9ca3af"
                multiline
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
              />

              <Text className="mb-2 ml-2 text-gray-500">Categoría</Text>
              <View className="flex-row flex-wrap mb-4">
                {categories.map((cat) => (
                  <TouchableOpacity 
                      key={cat.id} 
                      onPress={() => setSelectedCategoryId(cat.id)}
                      className={`px-4 py-2 rounded-full mr-2 mb-2 ${selectedCategoryId === cat.id ? 'bg-purple-600' : 'bg-gray-100 dark:bg-gray-700'}`}
                    >
                      <Text className={`font-bold text-xs ${selectedCategoryId === cat.id ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>{cat.name}</Text>
                    </TouchableOpacity>
                ))}
              </View>

              <View className="flex-row mb-4">
                <View className="flex-1 mr-2">
                  <Text className="mb-2 ml-2 text-gray-500">Recompensa</Text>
                  <TextInput
                    className="p-4 text-xl font-black bg-gray-50 rounded-2xl dark:bg-gray-700 dark:text-white"
                    placeholder="5.00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={reward}
                    onChangeText={(val) => handlePriceChange(val, setReward)}
                  />
                </View>

                <View className="flex-1 ml-2">
                  <Text className="mb-2 ml-2 text-gray-500">WhatsApp</Text>
                  <TextInput
                    className="p-4 font-bold bg-gray-50 rounded-2xl dark:bg-gray-700 dark:text-white"
                    placeholder="+507..."
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                    value={whatsapp}
                    onChangeText={setWhatsapp}
                  />
                </View>
              </View>

              <View className="flex-row mt-6">
                <TouchableOpacity 
                  onPress={() => {
                    setIsCreateModalVisible(false);
                    resetForm();
                  }}
                  className="flex-1 justify-center items-center mr-2 h-14 bg-gray-100 rounded-2xl dark:bg-gray-700"
                >
                  <Text className="font-bold text-gray-600 dark:text-gray-300">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleCreateTask}
                  disabled={isCreating}
                  className="flex-1 justify-center items-center ml-2 h-14 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/30"
                >
                  {isCreating ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="px-8 text-lg font-bold text-white">
                      {editingTaskId ? 'Guardar Cambios' : 'Publicar Tarea'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal para Ver Postulantes */}
      <Modal
        visible={viewingApplicationsMissionId !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setViewingApplicationsMissionId(null)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-gray-800 rounded-t-[50px] p-8 h-[70%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-gray-900 dark:text-white">Postulantes</Text>
              <TouchableOpacity onPress={() => setViewingApplicationsMissionId(null)}>
                <IconSymbol name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {isLoadingApplications ? (
              <ActivityIndicator size="large" color="#2563eb" className="mt-10" />
            ) : applications.length === 0 ? (
              <View className="justify-center items-center py-20">
                <IconSymbol name="assignment" size={64} color="#d1d5db" />
                <Text className="mt-4 text-center text-gray-400">Aún no hay postulantes para esta tarea.</Text>
              </View>
            ) : (
              <FlatList
                data={applications}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <View className="flex-row justify-between items-center p-4 mb-4 bg-gray-50 rounded-3xl dark:bg-gray-700">
                    <View className="flex-1 mr-4">
                      <Text className="text-lg font-bold text-gray-900 dark:text-white">{item.studentName}</Text>
                      <View className="flex-row items-center mb-1">
                        <Text className="mr-2 text-sm font-black text-green-600 dark:text-green-400">${item.bidAmount.toFixed(2)}</Text>
                        <Text className="text-[10px] text-gray-400 uppercase font-bold">Oferta</Text>
                      </View>
                      <Text className="text-sm text-gray-500 dark:text-gray-400" numberOfLines={2}>
                        {item.comment || 'Sin comentario'}
                      </Text>
                    </View>
                    
                    {item.status === 'pending' ? (
                      <TouchableOpacity 
                        onPress={() => handleAcceptApplication(item.id)}
                        className="px-4 py-2 bg-green-500 rounded-full"
                      >
                        <Text className="text-xs font-bold text-white">Aceptar</Text>
                      </TouchableOpacity>
                    ) : item.status === 'accepted' ? (
                      <TouchableOpacity 
                        onPress={() => handleCompleteApplication(item.id)}
                        className="px-4 py-2 bg-blue-600 rounded-full"
                      >
                        <Text className="text-xs font-bold text-white">Finalizar</Text>
                      </TouchableOpacity>
                    ) : (
                      <View className="px-3 py-1 bg-gray-200 rounded-full dark:bg-gray-600">
                        <Text className="text-xs font-medium text-gray-500 capitalize dark:text-gray-300">{item.status === 'completed' ? 'Completado' : item.status}</Text>
                      </View>
                    )}
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Modal para Postularse con Oferta */}
      <Modal
        visible={applyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setApplyModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-gray-800 rounded-t-[50px] p-8">
            <Text className="mb-6 text-2xl font-bold text-center text-gray-900 dark:text-white">Postularse a la Tarea</Text>
            
            <View className="mb-6">
              <Text className="mb-2 ml-2 text-gray-500">Tu Oferta (UTP)</Text>
              <TextInput
                className="p-4 text-xl font-black bg-gray-50 rounded-2xl dark:bg-gray-700 dark:text-white"
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={bidAmount}
                onChangeText={(val) => handlePriceChange(val, setBidAmount)}
              />
              <Text className="mt-2 ml-2 text-xs text-gray-400">Puedes ofrecer más o menos de la recompensa sugerida.</Text>
            </View>

            <View className="mb-6">
              <Text className="mb-2 ml-2 text-gray-500">Comentario (opcional)</Text>
              <TextInput
                className="p-4 h-24 bg-gray-50 rounded-2xl dark:bg-gray-700 dark:text-white"
                placeholder="¿Por qué eres el ideal?"
                placeholderTextColor="#9ca3af"
                multiline
                textAlignVertical="top"
                value={applyComment}
                onChangeText={setApplyComment}
              />
            </View>

            <View className="flex-row mt-4">
              <TouchableOpacity 
                onPress={() => setApplyModalVisible(false)}
                className="flex-1 justify-center items-center mr-2 h-14 bg-gray-100 rounded-2xl dark:bg-gray-700"
              >
                <Text className="font-bold text-gray-600 dark:text-gray-300">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleApply}
                disabled={isApplying}
                className="flex-1 justify-center items-center ml-2 h-14 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/30"
              >
                {isApplying ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-lg font-bold text-white">Enviar Oferta</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Alerta Personalizado */}
      <Modal
        visible={alertConfig.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAlertConfig({ ...alertConfig, visible: false })}
      >
        <View className="flex-1 justify-center items-center px-6 bg-black/50">
          <View className="p-8 w-full bg-white dark:bg-gray-800 rounded-[40px] items-center">
            <View className={`w-20 h-20 rounded-full justify-center items-center mb-6 ${
              alertConfig.type === 'success' ? 'bg-green-100' : 
              alertConfig.type === 'error' ? 'bg-red-100' : 
              alertConfig.type === 'confirm' ? 'bg-orange-100' : 'bg-blue-100'
            }`}>
              <IconSymbol 
                name={
                  alertConfig.type === 'success' ? 'checkmark.circle' : 
                  alertConfig.type === 'error' ? 'exclamationmark.circle' : 
                  alertConfig.type === 'confirm' ? 'questionmark.circle' : 'info.circle'
                } 
                size={40} 
                color={
                  alertConfig.type === 'success' ? '#10b981' : 
                  alertConfig.type === 'error' ? '#ef4444' : 
                  alertConfig.type === 'confirm' ? '#f59e0b' : '#3b82f6'
                } 
              />
            </View>
            
            <Text className="mb-2 text-2xl font-bold text-center text-gray-900 dark:text-white">
              {alertConfig.title}
            </Text>
            <Text className="mb-8 text-center text-gray-500 dark:text-gray-400">
              {alertConfig.message}
            </Text>

            <View className="flex-row w-full">
              {alertConfig.type === 'confirm' ? (
                <>
                  <TouchableOpacity 
                    onPress={() => setAlertConfig({ ...alertConfig, visible: false })}
                    className="flex-1 justify-center items-center mr-2 h-14 bg-gray-100 rounded-2xl dark:bg-gray-700"
                  >
                    <Text className="font-bold text-gray-600 dark:text-gray-300">No, cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setAlertConfig({ ...alertConfig, visible: false });
                      alertConfig.onConfirm?.();
                    }}
                    className="flex-1 justify-center items-center ml-2 h-14 bg-red-500 rounded-2xl shadow-lg shadow-red-500/30"
                  >
                    <Text className="font-bold text-white">Sí, continuar</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity 
                  onPress={() => setAlertConfig({ ...alertConfig, visible: false })}
                  className="flex-1 justify-center items-center h-14 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/30"
                >
                  <Text className="text-lg font-bold text-white">Entendido</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </View>
  );
}
