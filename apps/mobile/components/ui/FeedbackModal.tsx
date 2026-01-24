import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from './icon-symbol';

interface FeedbackModalProps {
  isVisible: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  onClose: () => void;
}

export function FeedbackModal({ isVisible, type, title, message, onClose }: FeedbackModalProps) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return { name: 'checkmark.circle.fill' as const, color: '#22c55e' };
      case 'error':
        return { name: 'exclamationmark.circle.fill' as const, color: '#ef4444' };
      case 'info':
        return { name: 'info.circle.fill' as const, color: '#3b82f6' };
    }
  };

  const icon = getIcon();

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50 px-6">
        <View className="bg-white dark:bg-gray-800 w-full max-w-sm p-8 rounded-[40px] shadow-xl items-center">
          <View className="mb-4">
            <IconSymbol name={icon.name as any} size={64} color={icon.color} />
          </View>
          
          <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
            {title}
          </Text>
          
          <Text className="text-gray-500 dark:text-gray-400 text-center mb-8">
            {message}
          </Text>
          
          <TouchableOpacity 
            onPress={onClose}
            className="w-full bg-gray-900 dark:bg-white h-14 rounded-2xl items-center justify-center"
          >
            <Text className="text-white dark:text-gray-900 font-bold text-lg">Entendido</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
