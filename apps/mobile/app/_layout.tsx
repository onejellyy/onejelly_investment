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
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
          headerStyle: {
            backgroundColor: colors.card,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: '600',
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
