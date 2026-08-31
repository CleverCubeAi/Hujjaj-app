import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Home, Plane, Plus, Wallet, Menu } from 'lucide-react-native';
import { colors } from '@/src/theme/tokens';

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.ivory,
        headerTitleStyle: { fontWeight: '700', color: colors.ivory },
        tabBarStyle: {
          backgroundColor: colors.navy,
          borderTopColor: colors.navy,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: 'rgba(248,246,240,0.85)',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          tabBarLabel: t('home'),
          tabBarIcon: ({ color }) => <Home color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: t('book'),
          tabBarLabel: t('book'),
          tabBarIcon: ({ color, focused }) => (
            <Plus color={focused ? colors.navy : color} size={22} />
          ),
          tabBarActiveBackgroundColor: colors.gold,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: t('trips'),
          tabBarLabel: t('trips'),
          tabBarIcon: ({ color }) => <Plane color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t('reports'),
          tabBarLabel: t('reports'),
          tabBarIcon: ({ color }) => <Wallet color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('more'),
          tabBarLabel: t('more'),
          tabBarIcon: ({ color }) => <Menu color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
