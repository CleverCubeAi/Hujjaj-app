import React, { useEffect, useState } from 'react';
import { AppShell, Burger, Group, Text, ActionIcon, Avatar, Box, Badge, Image } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useAuth } from '../../providers/AuthProvider';
import { Sidebar } from './Sidebar';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { LogOut, Bell } from 'lucide-react';
import { api } from '../../lib/api';

interface AgencyInfo {
  name: string;
  logo_url?: string;
}

interface UserProfile {
  full_name?: string;
  avatar_url?: string;
  role?: string;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  const { signOut, user } = useAuth();
  const { t } = useTranslation();
  const [agency, setAgency] = useState<AgencyInfo | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agencyData, profileData] = await Promise.all([
          api.getAgency().catch(() => null),
          api.getProfile().catch(() => null)
        ]);
        if (agencyData) setAgency(agencyData);
        if (profileData) setProfile(profileData);
      } catch (error) {
        console.error('Error fetching header data:', error);
      }
    };
    fetchData();
  }, []);

  const getRoleLabel = () => {
    const role = profile?.role;
    if (role === 'super_admin') return t('super_admin') || 'مدير عام';
    if (role === 'agency_admin') return t('agency_admin') || 'مدير الوكالة';
    if (role === 'manager') return t('manager') || 'مدير';
    return t('agent') || 'وكيل';
  };

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 220,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="lg"
      styles={{
        main: {
          backgroundColor: '#F5EFE6',
          minHeight: '100vh',
        },
        header: {
          backgroundColor: '#FEFBF6',
          borderBottom: '1px solid #E8DFD0',
        },
        navbar: {
          backgroundColor: '#FEFBF6',
          borderLeft: '1px solid #E8DFD0',
        }
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            {agency?.logo_url ? (
              <Image
                src={agency.logo_url}
                h={36}
                w="auto"
                fit="contain"
                style={{ maxWidth: 120 }}
              />
            ) : (
              <Text size="lg" fw={700} c="#8B7355">
                {agency?.name || t('app_name')}
              </Text>
            )}
          </Group>
          <Group gap="sm">
            <LanguageSwitcher />
            <ActionIcon 
              variant="subtle" 
              color="brown" 
              size="md"
              title="الإشعارات"
            >
              <Bell size={18} />
            </ActionIcon>
            <Group gap="xs">
              <Avatar 
                src={profile?.avatar_url} 
                color="brown" 
                radius="xl" 
                size="sm"
              >
                {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
              </Avatar>
              <Box visibleFrom="md">
                <Text size="xs" fw={500}>{profile?.full_name || user?.email}</Text>
                <Text size="xs" c="dimmed">{getRoleLabel()}</Text>
              </Box>
            </Group>
            <ActionIcon 
              onClick={() => signOut()} 
              title={t('logout')}
              variant="subtle"
              color="brown"
              size="md"
            >
              <LogOut size={18} />
            </ActionIcon>
            <Burger 
              opened={opened} 
              onClick={toggle} 
              hiddenFrom="sm" 
              size="sm" 
              color="#8B7355"
            />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <Sidebar closeMobile={toggle} />
      </AppShell.Navbar>

      <AppShell.Main>
        <Box style={{ maxWidth: 1400, margin: '0 auto' }}>
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
