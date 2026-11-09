import { router } from 'expo-router';
import { Alert } from 'react-native';

export function showUpsell(featureName: string) {
  Alert.alert('Moto+ özelliği', `${featureName} Moto+ üyeliğine dahildir.`, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: "Moto+'ı incele", onPress: () => router.push('/premium') },
  ]);
}
