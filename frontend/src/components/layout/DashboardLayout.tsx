import { useEffect, useState, type FormEvent } from 'react';
import { AppShell, Burger, Group, ActionIcon, Box, TextInput, Text, Button, Indicator } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';
import { Sidebar } from './Sidebar';
import { BrandLogo } from '../brand/BrandLogo';
import { HeaderNotifications } from './HeaderNotifications';
import { HeaderUserMenu } from './HeaderUserMenu';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Plus, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { brand } from '../../theme/brand';
import { useBranding } from '../../providers/BrandingProvider';
import { useInbox } from '../../hooks/useInbox';

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
  const navigate = useNavigate();
  const branding = useBranding();
  const [agency, setAgency] = useState<AgencyInfo | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const isPlatformSuperAdmin = role === 'super_admin';
  const isAgencyStaff = role === 'agency_admin' || role === 'manager' || role === 'agent';
  const inbox = useInbox(isAgencyStaff);

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

  const submitSearch = (event?: FormEvent) => {
    event?.preventDefault();
    const q = searchQuery.trim();
    if (!q || !isAgencyStaff) return;
    navigate(`/bookings?q=${encodeURIComponent(q)}`);
  };

  const displayName = profile?.full_name || user?.email || '';
  const initial = displayName?.[0]?.toUpperCase() || 'أ';

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
            <Link
              to="/"
              title={platformName}
              style={{ display: 'block', textDecoration: 'none', lineHeight: 0 }}
            >
              <BrandLogo variant="horizontal" height={48} alt={platformName} />
            </Link>
          </Group>

          {isAgencyStaff && (
            <Box style={{ flex: 1, maxWidth: 420 }} visibleFrom="md" mx="md">
              <form onSubmit={submitSearch}>
                <TextInput
                  placeholder={t('search_trip_or_client')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
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
              </form>
            </Box>
          )}

          <Group gap="sm" wrap="nowrap">
            {isAgencyStaff && (
              <>
                <Button
                  component={Link}
                  to="/bookings/new"
                  leftSection={<Plus size={16} />}
                  visibleFrom="sm"
                  size="sm"
                >
                  {t('new_booking')}
                </Button>
                <ActionIcon
                  component={Link}
                  to="/bookings/new"
                  hiddenFrom="sm"
                  variant="filled"
                  size="lg"
                  radius="xl"
                  title={t('new_booking')}
                >
                  <Plus size={18} />
                </ActionIcon>

                <Indicator
                  inline
                  size={18}
                  offset={4}
                  color="teal"
                  disabled={inbox.failed_messages_count === 0}
                  label={inbox.failed_messages_count > 9 ? '9+' : inbox.failed_messages_count}
                >
                  <ActionIcon
                    component={Link}
                    to="/messages"
                    variant="subtle"
                    color="gray"
                    size="lg"
                    radius="xl"
                    style={{ backgroundColor: '#F3F4F6' }}
                    title={t('messages')}
                  >
                    <MessageSquare size={20} color={brand.navy} />
                  </ActionIcon>
                </Indicator>

                <HeaderNotifications
                  items={inbox.items}
                  unreadCount={inbox.unread_count}
                  onOpen={inbox.markSeen}
                />
              </>
            )}

            <HeaderUserMenu
              name={displayName}
              roleLabel={getRoleLabel()}
              avatarUrl={profile?.avatar_url}
              initial={initial}
              onLogout={() => signOut()}
            />
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
