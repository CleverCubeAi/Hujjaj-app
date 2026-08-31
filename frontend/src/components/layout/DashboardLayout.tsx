import { useEffect, useState } from 'react';
import { AppShell, Burger, Group, ActionIcon, Box, TextInput, Avatar, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useAuth } from '../../providers/AuthProvider';
import { Sidebar } from './Sidebar';
import { BrandLogo } from '../brand/BrandLogo';
import { useTranslation } from 'react-i18next';
import { Bell, Search, MessageSquare, LogOut } from 'lucide-react';
import { api } from '../../lib/api';
import { brand } from '../../theme/brand';
import { useBranding } from '../../providers/BrandingProvider';

interface AgencyInfo {
  name: string;
  logo_url?: string;
  primary_color?: string | null;
  subscription_status?: string;
}

interface UserProfile {
  full_name?: string;
  avatar_url?: string;
  role?: string;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  const { user, role, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const branding = useBranding();
  const [agency, setAgency] = useState<AgencyInfo | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const isPlatformSuperAdmin = role === 'super_admin';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const profileData = await api.getProfile().catch(() => null);
        if (profileData) setProfile(profileData);
        if (!isPlatformSuperAdmin) {
          const agencyData = await api.getSessionBranding().catch(() => null);
          if (agencyData) setAgency(agencyData);
        }
      } catch (error) {
        console.error('Error fetching header data:', error);
      }
    };
    fetchData();
  }, [isPlatformSuperAdmin]);

  const isRtl = i18n.language === 'ar';
  const platformName = i18n.language === 'fr' ? branding.app_name_fr : branding.app_name_ar;

  const getRoleLabel = () => {
    const userRole = profile?.role;
    if (userRole === 'super_admin') return t('super_admin') || 'مدير المنصة';
    if (userRole === 'agency_admin') return t('agency_admin') || 'مدير الوكالة';
    if (userRole === 'manager') return t('manager') || 'مدير';
    return t('agent') || 'وكيل';
  };

  return (
    <AppShell
      header={{ height: 76 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="lg"
      styles={{
        main: {
          backgroundColor: '#F3F4F6',
          minHeight: '100vh',
        },
        header: {
          backgroundColor: '#FFFFFF',
          borderBottom: 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          borderBottomLeftRadius: '24px',
          borderBottomRightRadius: '24px',
        },
        navbar: {
          border: 'none',
          backgroundColor: 'transparent',
          zIndex: 99,
        },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="xl" justify="space-between" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" color={brand.navy} />
            <BrandLogo variant="horizontal" height={48} alt={platformName} />
          </Group>

          <Box style={{ flex: 1, maxWidth: 420 }} visibleFrom="md" mx="md">
            <TextInput
              placeholder={t('search_trip_or_client')}
              leftSection={!isRtl ? <Search size={16} color={brand.muted} /> : undefined}
              rightSection={isRtl ? <Search size={16} color={brand.muted} /> : undefined}
              radius="xl"
              size="md"
              styles={{
                input: {
                  backgroundColor: '#F3F4F6',
                  border: 'none',
                  textAlign: isRtl ? 'right' : 'left',
                },
              }}
            />
          </Box>

          <Group gap="sm" wrap="nowrap">
            <ActionIcon variant="subtle" color="gray" size="lg" radius="xl" style={{ backgroundColor: '#F3F4F6' }}>
              <MessageSquare size={20} color={brand.navy} />
            </ActionIcon>

            <ActionIcon variant="subtle" color="gray" size="lg" radius="xl" style={{ backgroundColor: '#F3F4F6' }}>
              <Bell size={20} color={brand.navy} />
            </ActionIcon>

            <Group gap="sm" wrap="nowrap">
              <Avatar src={profile?.avatar_url} color="teal" radius="xl" size="md">
                {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'أ'}
              </Avatar>
              <Box visibleFrom="sm">
                <Text size="sm" fw={700} c={brand.navy} lh={1.2}>
                  {profile?.full_name || user?.email || 'أحمد بن علي'}
                </Text>
                <Text size="xs" c={brand.muted}>{getRoleLabel()}</Text>
              </Box>
            </Group>

            <ActionIcon onClick={() => signOut()} title={t('logout')} variant="subtle" color="red" size="lg" radius="xl">
              <LogOut size={20} />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar>
        <Sidebar closeMobile={toggle} />
      </AppShell.Navbar>

      <AppShell.Main>
        <Box style={{ maxWidth: 1400, margin: '0 auto' }}>
          {!isPlatformSuperAdmin && agency?.subscription_status === 'past_due' && (
            <Text mb="md" c="red" fw={600}>{t('subscription_past_due') || 'الاشتراك متأخر عن الدفع'}</Text>
          )}
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
