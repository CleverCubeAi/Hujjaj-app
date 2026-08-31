import { Linking } from 'react-native';

export async function shareWhatsApp(text: string) {
  const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
  const can = await Linking.canOpenURL(url);
  if (can) {
    await Linking.openURL(url);
    return;
  }
  await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
}
