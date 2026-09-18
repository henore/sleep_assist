import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import { I18nProvider } from './src/components/I18nProvider';
import { useI18n } from './src/i18n';
import { useProStatus } from './src/hooks/useProStatus';
import { TrialExpiredOverlay } from './src/components/TrialExpiredOverlay';
import { DailyInsightScreen } from './src/screens/DailyInsightScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { Colors, FontSize } from './src/constants/theme';

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    DailyInsight: '◉',
    History: '☰',
    Stats: '◫',
    More: '⋯',
  };
  return (
    <Text
      style={{
        fontSize: 20,
        color: focused ? Colors.lavenderDark : Colors.textTertiary,
      }}
    >
      {icons[label] ?? '·'}
    </Text>
  );
}

function AppNavigator() {
  const { t } = useI18n();
  const { showExpiredOverlay, dismissExpiredOverlay } = useProStatus();

  return (
    <>
    <TrialExpiredOverlay
      visible={showExpiredOverlay}
      onDismiss={dismissExpiredOverlay}
      onUpgrade={() => {
        dismissExpiredOverlay();
        // TODO: open IAP / paywall
      }}
      t={t}
    />
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: Colors.lavenderDark,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.lavenderLight,
          borderTopWidth: 0.5,
          paddingTop: 4,
          height: 80,
        },
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen
        name="DailyInsight"
        component={DailyInsightScreen}
        options={{ tabBarLabel: t.tabDailyInsight }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarLabel: t.tabHistory }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{ tabBarLabel: t.tabStats }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{ tabBarLabel: t.tabMore }}
      />
    </Tab.Navigator>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <NavigationBar hidden />
          <AppNavigator />
        </NavigationContainer>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
