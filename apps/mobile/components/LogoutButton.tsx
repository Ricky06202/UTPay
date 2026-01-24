import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { useAuth } from '@/context/auth';
import { IconSymbol } from './ui/icon-symbol';

export function LogoutButton() {
  const { signOut } = useAuth();

  return (
    <TouchableOpacity 
      onPress={() => signOut()}
      className="h-10 w-10 bg-white dark:bg-gray-800 rounded-full items-center justify-center shadow-sm border border-gray-100 dark:border-gray-700"
      activeOpacity={0.7}
    >
      <IconSymbol name="logout" size={20} color="#ef4444" />
    </TouchableOpacity>
  );
}
