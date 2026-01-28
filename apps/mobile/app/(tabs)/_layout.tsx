import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colorScheme === 'dark' ? '#111827' : '#f9fafb',
    },
    content: {
      flex: 1,
      maxWidth: 1200,
      width: '100%',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
            headerShown: false,
            tabBarButton: HapticTab,
            tabBarStyle: Platform.select({
              ios: {
                position: 'absolute',
              },
              web: {
                display: 'none',
              },
              default: {},
            }) as any,
          }}>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Wallet',
              tabBarIcon: ({ color }) => <IconSymbol size={28} name="wallet.pass.fill" color={color} />,
            }}
          />
          <Tabs.Screen
            name="missions"
            options={{
              title: 'Tareas',
              tabBarIcon: ({ color }) => <IconSymbol size={28} name="assignment" color={color} />,
            }}
          />
          <Tabs.Screen
            name="explore"
            options={{
              title: 'Historial',
              tabBarIcon: ({ color }) => <IconSymbol size={28} name="clock.fill" color={color} />,
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}
