import { useEffect, useState } from 'react';
import { AppShell, Burger, Group, Text, ActionIcon, Avatar, Box, Image } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useAuth } from '../../providers/AuthProvider';
import { Sidebar } from './Sidebar';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { BrandLogo } from '../brand/BrandLogo';
import { useTranslation } from 'react-i18next';
import { LogOut, Bell } from 'lucide-react';
import { api } from '../../lib/api';
import { useBranding } from '../../providers/BrandingProvider';
import { brand } from '../../theme/brand';
import kaabaDay from '../../assets/img/kaaba-day.png';

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
  const { signOut, user, role } = useAuth();
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
      header={{ height: 64 }}
      navbar={{
        width: 248,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
      styles={{
        main: {
          backgroundColor: brand.sand,
          minHeight: '100vh',
        },
        header: {
          backgroundColor: brand.ivory,
          borderBottom: `1px solid ${brand.border}`,
          overflow: 'hidden',
          position: 'relative',
        },
        navbar: {
          backgroundColor: brand.navy,
          borderInlineEnd: 'none',
          borderInlineStart: 'none',
        },
      }}
    >
      <AppShell.Header>
        <Box
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${kaabaDay})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 42%',
            opacity: 0.14,
            pointerEvents: 'none',
          }}
        />
        <Group h="100%" px="md" justify="space-between" style={{ position: 'relative', zIndex: 1 }}>
          <Group gap="sm">
            {isPlatformSuperAdmin ? (
              branding.logo_url ? (
                <Image src={branding.logo_url} h={40} w="auto" fit="contain" style={{ maxWidth: 180 }} />
              ) : (
                <BrandLogo variant="horizontal" height={40} alt={platformName} />
              )
            ) : agency?.logo_url ? (
              <Image
                src={agency.logo_url}
                h={40}
                w="auto"
                fit="contain"
                style={{ maxWidth: 160 }}
              />
            ) : (
              <Text size="lg" fw={700} c={brand.navy}>
                {agency?.name || t('app_name')}
              </Text>
            )}
          </Group>
          <Group gap="sm">
            <LanguageSwitcher variant="on-ivory" />
            <ActionIcon
              variant="subtle"
              color="teal"
              size="md"
              title={t('notifications') || 'الإشعارات'}
            >
              <Bell size={18} color={brand.navy} />
            </ActionIcon>
            <Group gap="xs">
              <Avatar
                src={profile?.avatar_url}
                color="teal"
                radius="xl"
                size="sm"
              >
                {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
              </Avatar>
              <Box visibleFrom="md">
                <Text size="xs" fw={600} c={brand.navy}>{profile?.full_name || user?.email}</Text>
                <Text size="xs" c={brand.muted}>{getRoleLabel()}</Text>
              </Box>
            </Group>
            <ActionIcon
              onClick={() => signOut()}
              title={t('logout')}
              variant="subtle"
              color="teal"
              size="md"
            >
              <LogOut size={18} color={brand.navy} />
            </ActionIcon>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              color={brand.navy}
            />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
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
