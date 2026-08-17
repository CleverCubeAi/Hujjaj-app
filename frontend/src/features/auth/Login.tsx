import { useState } from 'react';
import {
  TextInput,
  PasswordInput,
  Paper,
  Title,
  Text,
  Button,
  Box,
  Stack,
  Center,
  Checkbox,
} from '@mantine/core';
import { useAuth } from '../../providers/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Mail } from 'lucide-react';
import haramEvening from '../../assets/img/haram-evening.png';
import { useBranding } from '../../providers/BrandingProvider';
import { BrandLogo } from '../../components/brand/BrandLogo';
import { brand } from '../../theme/brand';

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const branding = useBranding();
  const primary = branding.primary_color || brand.teal;
  const hero = branding.login_background_url || haramEvening;
  const appName = i18n.language === 'fr' ? branding.app_name_fr : branding.app_name_ar;
  const year = new Date().getFullYear();
  const copyright = (branding.copyright || `© {year} ${appName}`).replace('{year}', String(year));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error: signError } = await signIn(email, password);
      if (signError) throw signError;
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyles = {
    input: {
      backgroundColor: '#fff',
      border: `1px solid ${brand.border}`,
      borderRadius: 12,
      minHeight: 46,
      color: brand.navy,
      '&:focus': {
        borderColor: brand.teal,
      },
    },
    label: {
      color: brand.navy,
      fontWeight: 600,
      marginBottom: 6,
    },
  };

  return (
    <Box
      style={{
        minHeight: '100vh',
        backgroundColor: brand.sand,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 320,
          backgroundImage: `url(${hero})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          opacity: 0.42,
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        }}
      />

      <Box style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440 }}>
        <Paper
          radius={24}
          p={36}
          style={{
            backgroundColor: brand.ivory,
            border: `1px solid ${brand.border}`,
            boxShadow: '0 12px 32px rgba(7, 29, 53, 0.08)',
          }}
        >
          <Stack align="center" gap={4} mb={28}>
            <BrandLogo variant="stacked" alt={appName} height={200} />
          </Stack>

          <Box
            mb="lg"
            style={{
              height: 1,
              background: `linear-gradient(90deg, transparent, ${brand.gold}, ${brand.goldLight}, ${brand.gold}, transparent)`,
            }}
          />

          <Title order={3} fw={700} ta="center" c={brand.tealDeep} mb="lg" style={{ fontSize: 22 }}>
            {t('sign_in') || 'تسجيل الدخول'}
          </Title>

          <form onSubmit={handleLogin}>
            <Stack gap="md">
              <TextInput
                label={t('email') || 'البريد الإلكتروني'}
                placeholder={t('email') || 'البريد الإلكتروني'}
                required
                size="md"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                leftSection={<Mail size={18} color={brand.teal} />}
                styles={inputStyles}
              />

              <PasswordInput
                label={t('password') || 'كلمة المرور'}
                placeholder={t('password') || 'كلمة المرور'}
                required
                size="md"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                leftSection={<Lock size={18} color={brand.teal} />}
                styles={inputStyles}
              />

              <Checkbox
                label={
                  <Text size="sm" c={brand.navy}>
                    {t('remember_me') || 'تذكرني'}
                  </Text>
                }
                styles={{
                  input: {
                    backgroundColor: '#fff',
                    borderColor: brand.border,
                    '&:checked': {
                      backgroundColor: brand.teal,
                      borderColor: brand.teal,
                    },
                  },
                }}
              />

              {error && (
                <Paper
                  p="sm"
                  radius="md"
                  style={{
                    backgroundColor: 'rgba(196, 71, 58, 0.08)',
                    border: `1px solid ${brand.danger}55`,
                  }}
                >
                  <Text c={brand.danger} size="sm">
                    {error}
                  </Text>
                </Paper>
              )}

              <Button
                size="lg"
                type="submit"
                loading={loading}
                fullWidth
                mt={4}
                styles={{
                  root: {
                    backgroundColor: primary,
                    color: brand.ivory,
                    fontWeight: 700,
                    height: 48,
                    borderRadius: 12,
                    '&:hover': {
                      backgroundColor: brand.tealDeep,
                    },
                  },
                }}
              >
                {t('login') || 'تسجيل الدخول'}
              </Button>
            </Stack>
          </form>
        </Paper>

        <Center mt="lg">
          <Text size="xs" c={brand.muted}>
            {copyright}
          </Text>
        </Center>
      </Box>
    </Box>
  );
}
