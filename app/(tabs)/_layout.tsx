import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';
import { colors } from '../../src/theme';

type Icon = keyof typeof MaterialIcons.glyphMap;
const icon = (name: Icon) => ({ color, size }: { color: ColorValue; size: number }) => (
  <MaterialIcons name={name} color={color as string} size={size} />
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Harita', headerShown: false, tabBarIcon: icon('map') }} />
      <Tabs.Screen name="places" options={{ title: 'Mekanlar', tabBarIcon: icon('local-gas-station') }} />
      <Tabs.Screen
        name="premium"
        options={{ title: 'Moto+', tabBarIcon: icon('workspace-premium'), tabBarActiveTintColor: colors.premium }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
