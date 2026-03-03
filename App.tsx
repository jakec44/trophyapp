import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from 'expo-router';
import { GamificationProvider } from '@/src/context/GamificationContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <GamificationProvider>
        <RootNavigator />
      </GamificationProvider>
    </SafeAreaProvider>
  );
}
