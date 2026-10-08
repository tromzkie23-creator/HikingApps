import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { C } from '../../lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IconName) {
  const Icon = ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
  Icon.displayName = `TabIcon-${name}`;
  return Icon;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.spruce,
        tabBarInactiveTintColor: C.mute,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginBottom: 4 },
        tabBarStyle: {
          height: 66,
          paddingTop: 7,
          backgroundColor: C.white,
          borderTopColor: C.line,
        },
        tabBarItemStyle: { paddingHorizontal: 1 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Explore', tabBarIcon: tabIcon('compass-outline') }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans', tabBarIcon: tabIcon('bookmark-outline') }} />
      <Tabs.Screen name="record" options={{ title: 'Record', tabBarIcon: tabIcon('radio-button-on-outline') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: tabIcon('time-outline') }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: tabIcon('people-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-outline') }} />
    </Tabs>
  );
}
