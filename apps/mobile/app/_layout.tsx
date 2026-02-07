import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../lib/theme';

export default function TabLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.neuShadow,
            borderTopWidth: 0,
            elevation: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
          },
          headerStyle: {
            backgroundColor: colors.background,
            shadowColor: '#1F2687',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 4,
          },
          headerTintColor: colors.primary,
          headerTitleStyle: {
            fontWeight: '700',
            color: colors.primary,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: '피드',
            headerTitle: 'OneJellyInvest',
            tabBarLabel: '피드',
          }}
        />
        <Tabs.Screen
          name="valuations"
          options={{
            title: '밸류에이션',
            headerTitle: '밸류에이션',
            tabBarLabel: '밸류에이션',
          }}
        />
        <Tabs.Screen
          name="company/[corp_code]"
          options={{
            href: null,
            headerTitle: '회사 상세',
          }}
        />
      </Tabs>
    </>
  );
}
