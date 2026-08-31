import Constants from 'expo-constants';
import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Image, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/auth/AuthProvider';
import { persistLanguage } from '@/src/i18n';
import { Button, Card, Chip, Screen, SectionTitle } from '@/src/ui/primitives';
import { colors, space } from '@/src/theme/tokens';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { user, sessionBranding, logout } = useAuth();

  useEffect(() => {
    navigation.setOptions({ title: t('settings') });
  }, [navigation, t]);

  const onLogout = () => {
    Alert.alert(t('logout'), t('confirm_logout'), [
      { text: t('no'), style: 'cancel' },
      { text: t('yes'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <Screen scroll>
      <View style={{ gap: space.md }}>
        <Card style={{ alignItems: 'center', gap: 8 }}>
          {sessionBranding?.logo_url ? (
            <Image source={{ uri: sessionBranding.logo_url }} style={{ width: 96, height: 48 }} resizeMode="contain" />
          ) : null}
          <Text style={{ fontWeight: '700', color: colors.navy, fontSize: 18 }}>
            {sessionBranding?.name_ar || sessionBranding?.name || t('agency')}
          </Text>
          <Text style={{ color: colors.textMuted }}>{user?.user_metadata?.full_name || user?.email}</Text>
        </Card>
        <SectionTitle>{t('language')}</SectionTitle>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={t('arabic')} active={i18n.language.startsWith('ar')} onPress={() => persistLanguage('ar')} />
          <Chip label={t('french')} active={i18n.language.startsWith('fr')} onPress={() => persistLanguage('fr')} />
        </View>
        <Card>
          <Text style={{ color: colors.navy }}>{t('branch')}: {user?.user_metadata?.branch_id || '—'}</Text>
          <Text style={{ color: colors.textMuted, marginTop: 8 }}>
            {t('version')}: {Constants.expoConfig?.version || '1.0.0'}
          </Text>
        </Card>
        <Button label={t('biometric')} variant="ghost" onPress={() => Alert.alert(t('biometric'), t('biometric_later'))} />
        <Button label={t('logout')} variant="danger" onPress={onLogout} />
      </View>
    </Screen>
  );
}
