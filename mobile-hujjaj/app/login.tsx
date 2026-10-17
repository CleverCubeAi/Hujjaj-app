import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/auth/AuthProvider';
import { persistLanguage } from '@/src/i18n';
import { Button, Screen, TextField } from '@/src/ui/primitives';
import { colors, radius, shadow, space } from '@/src/theme/tokens';

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { login, publicBranding, blockedSuperAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const appName = i18n.language.startsWith('fr')
    ? publicBranding?.app_name_fr || 'Hujjaj'
    : publicBranding?.app_name_ar || 'حجاج';
  const primary = publicBranding?.primary_color || colors.tealDeep;

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (e: any) {
      if (e?.message === 'super_admin') setError(t('use_web_console'));
      else setError(e?.message || t('invalid_credentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.wrap}>
        <View style={[styles.hero, { backgroundColor: colors.navy }]}>
          {publicBranding?.logo_url ? (
            <Image source={{ uri: publicBranding.logo_url }} style={styles.logo} resizeMode="contain" />
          ) : (
            <Text style={styles.wordmark}>{appName}</Text>
          )}
          <Text style={styles.tag}>{t('login')}</Text>
        </View>

        <View style={styles.langs}>
          <Pressable
            accessibilityRole="button"
            onPress={() => persistLanguage('ar')}
            style={[styles.lang, i18n.language.startsWith('ar') && styles.langOn]}
          >
            <Text style={styles.langText}>{t('arabic')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => persistLanguage('fr')}
            style={[styles.lang, i18n.language.startsWith('fr') && styles.langOn]}
          >
            <Text style={styles.langText}>{t('french')}</Text>
          </Pressable>
        </View>

        <View style={{ gap: 12 }}>
          <TextField label={t('email')} value={email} onChangeText={setEmail} keyboardType="email-address" />
          <TextField label={t('password')} value={password} onChangeText={setPassword} secure />
          {(error || blockedSuperAdmin) ? (
            <Text style={styles.err}>{blockedSuperAdmin ? t('use_web_console') : error}</Text>
          ) : null}
          <Button label={t('login')} onPress={onSubmit} loading={loading} />
          <View style={[styles.ctaDot, { backgroundColor: primary }]} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg, paddingTop: 12 },
  hero: {
    borderRadius: radius.xl,
    padding: 28,
    alignItems: 'center',
    ...shadow.lg,
  },
  logo: { width: 160, height: 64 },
  wordmark: { color: colors.ivory, fontSize: 32, fontWeight: '700' },
  tag: { color: colors.gold, marginTop: 8, fontWeight: '600' },
  langs: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  lang: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.ivory,
    justifyContent: 'center',
  },
  langOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  langText: { color: colors.navy, fontWeight: '700' },
  err: { color: colors.danger, fontWeight: '600' },
  ctaDot: { height: 3, width: 48, alignSelf: 'center', borderRadius: 2, opacity: 0.4 },
});
