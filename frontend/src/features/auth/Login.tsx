import React, { useState } from 'react';
import { 
  TextInput, 
  PasswordInput, 
  Paper, 
  Title, 
  Text, 
  Container, 
  Button, 
  Box,
  Stack,
  Center,
  Group,
  Checkbox
} from '@mantine/core';
import { useAuth } from '../../providers/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, User } from 'lucide-react';
import bgImage from '../../assets/img/bg.jpg';
import { useBranding } from '../../providers/BrandingProvider';

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const branding = useBranding();
  const primary = branding.primary_color || '#8B7355';
  const accent = branding.accent_color || '#6F5C45';
  const bg = branding.login_background_url || bgImage;
  const appName = i18n.language === 'fr' ? branding.app_name_fr : branding.app_name_ar;
  const tagline = i18n.language === 'fr' ? branding.tagline_fr : branding.tagline_ar;
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
      const { error } = await signIn(email, password);
      if (error) throw error;
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box 
      style={{ 
        minHeight: '100vh',
        backgroundImage: `url(${bg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative'
      }}
    >
      {/* Overlay for better contrast */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          zIndex: 0
        }}
      />

      <Container size={800} style={{ position: 'relative', zIndex: 1 }}>
        {/* Login Form */}
        <Paper 
          p={40} 
          radius={0}
          style={{ 
            backgroundColor: 'rgba(45, 45, 45, 0.6)',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${primary}4D`,
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}
        >
          <Stack align="center" gap="lg" mb="xl">
            {branding.logo_url && (
              <img src={branding.logo_url} alt={appName} style={{ height: 48 }} />
            )}
            <Title order={2} fw={700} c="white" ta="center">
              {appName || t('sign_in') || 'تسجيل الدخول'}
            </Title>
            {tagline && <Text c="white" size="sm" ta="center">{tagline}</Text>}
            <Text c="white" size="sm" ta="center">{t('sign_in') || 'تسجيل الدخول'}</Text>
          </Stack>

          <form onSubmit={handleLogin}>
            <Stack gap="lg">
              {/* Username/Email Field */}
              <Box>
                <Text c="white" size="sm" fw={500} mb={8}>
                  {t('email') || 'البريد الإلكتروني'}
                </Text>
                <Box style={{ display: 'flex', alignItems: 'stretch', borderRadius: '0', overflow: 'hidden' }}>
                  <Box
                    style={{
                      width: 4,
                      backgroundColor: primary
                    }}
                  />
                  <Box
                    style={{
                      width: 40,
                      backgroundColor: primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <User size={18} color="white" />
                  </Box>
                  <TextInput 
                    placeholder="username" 
                    required 
                    size="md"
                    value={email}
                    onChange={(e) => setEmail(e.currentTarget.value)}
                    style={{ flex: 1 }}
                    styles={{
                      input: {
                        backgroundColor: 'white',
                        border: 'none',
                        borderRadius: '0',
                        '&:focus': {
                          borderColor: primary,
                          outline: 'none'
                        }
                      },
                      root: {
                        flex: 1
                      }
                    }}
                  />
                </Box>
              </Box>

              {/* Password Field */}
              <Box>
                <Text c="white" size="sm" fw={500} mb={8}>
                  {t('password') || 'كلمة المرور'}
                </Text>
                <Box style={{ display: 'flex', alignItems: 'stretch', borderRadius: '0', overflow: 'hidden' }}>
                  <Box
                    style={{
                      width: 4,
                      backgroundColor: primary
                    }}
                  />
                  <Box
                    style={{
                      width: 40,
                      backgroundColor: primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Lock size={18} color="white" />
                  </Box>
                  <PasswordInput 
                    placeholder="password" 
                    required 
                    size="md"
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    style={{ flex: 1 }}
                    styles={{
                      input: {
                        backgroundColor: 'white',
                        border: 'none',
                        borderRadius: '0',
                        flex: 1,
                        '&:focus': {
                          borderColor: primary,
                          outline: 'none'
                        }
                      },
                      root: {
                        flex: 1
                      }
                    }}
                  />
                </Box>
              </Box>

              {/* Remember Me */}
              <Checkbox
                label={<Text c="white" size="sm">{t('remember_me') || 'تذكرني'}</Text>}
                styles={{
                  input: {
                    backgroundColor: 'transparent',
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                    '&:checked': {
                      backgroundColor: primary,
                      borderColor: primary
                    }
                  }
                }}
              />
              
              {error && (
                <Paper p="sm" radius={0} style={{ backgroundColor: 'rgba(255, 0, 0, 0.2)', border: '1px solid rgba(255, 0, 0, 0.5)' }}>
                  <Text c="red" size="sm">{error}</Text>
                </Paper>
              )}

              {/* Login Button */}
              <Group justify="flex-end" mt="md">
                <Button 
                  size="lg" 
                  type="submit"
                  loading={loading}
                  styles={{
                    root: {
                      backgroundColor: primary,
                      color: '#2D2D2D',
                      fontWeight: 600,
                      width: '100%',
                      '&:hover': {
                        backgroundColor: accent
                      }
                    }
                  }}
                >
                  {t('login') || 'تسجيل الدخول'}
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>

        <Center mt="xl">
          <Text size="xs" c="rgba(255, 255, 255, 0.7)">
            {copyright}
          </Text>
        </Center>
      </Container>
    </Box>
  );
}
