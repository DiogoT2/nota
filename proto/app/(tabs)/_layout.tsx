import { Tabs } from 'expo-router';
import { TabBar } from '@/components';
import { color } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.bgBase } }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="procurar" />
      <Tabs.Screen name="ranking" />
      <Tabs.Screen name="eu" />
    </Tabs>
  );
}
