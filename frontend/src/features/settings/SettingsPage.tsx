import React from 'react';
import { Tabs, Container, Title } from '@mantine/core';
import { useAuth } from '../../providers/AuthProvider';
import { AgencySettings } from './AgencySettings';
import { ProfileSettings } from './ProfileSettings';
import { TeamManagement } from './TeamManagement';
import { BranchManagement } from './BranchManagement';
import { PreferencesSettings } from './PreferencesSettings';
import { EmailSettings } from './EmailSettings';
import { SMSSettings } from './SMSSettings';
import { SecuritySettings } from './SecuritySettings';
import { DiscountSettings } from './DiscountSettings';
import { useTranslation } from 'react-i18next';

export function SettingsPage() {
  const { role } = useAuth();
  const { t } = useTranslation();
  const isAdmin = role === 'agency_admin' || role === 'super_admin';

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="xl">
        {t('settings') || 'الإعدادات'}
      </Title>

      <Tabs defaultValue="profile">
        <Tabs.List>
          <Tabs.Tab value="profile">
            {t('profile') || 'الملف الشخصي'}
          </Tabs.Tab>
          {isAdmin && (
            <Tabs.Tab value="security">
              {t('security') || 'الأمان'}
            </Tabs.Tab>
          )}
          {isAdmin && (
            <Tabs.Tab value="agency">
              {t('agency') || 'الوكالة'}
            </Tabs.Tab>
          )}
          {isAdmin && (
            <Tabs.Tab value="team">
              {t('team') || 'الفريق'}
            </Tabs.Tab>
          )}
          {isAdmin && (
            <Tabs.Tab value="branches">
              {t('branches') || 'الفروع'}
            </Tabs.Tab>
          )}
          {isAdmin && (
            <Tabs.Tab value="discounts">
              {t('discounts') || 'الخصومات'}
            </Tabs.Tab>
          )}
          <Tabs.Tab value="preferences">
            {t('preferences') || 'التفضيلات'}
          </Tabs.Tab>
          {isAdmin && (
            <Tabs.Tab value="email">
              {t('email') || 'البريد الإلكتروني'}
            </Tabs.Tab>
          )}
          {isAdmin && (
            <Tabs.Tab value="sms">
              {t('sms') || 'الرسائل النصية'}
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="profile" pt="xl">
          <ProfileSettings />
        </Tabs.Panel>

        {isAdmin && (
          <Tabs.Panel value="security" pt="xl">
            <SecuritySettings />
          </Tabs.Panel>
        )}

        {isAdmin && (
          <Tabs.Panel value="agency" pt="xl">
            <AgencySettings />
          </Tabs.Panel>
        )}

        {isAdmin && (
          <Tabs.Panel value="team" pt="xl">
            <TeamManagement />
          </Tabs.Panel>
        )}

        {isAdmin && (
          <Tabs.Panel value="branches" pt="xl">
            <BranchManagement />
          </Tabs.Panel>
        )}

        {isAdmin && (
          <Tabs.Panel value="discounts" pt="xl">
            <DiscountSettings />
          </Tabs.Panel>
        )}

        <Tabs.Panel value="preferences" pt="xl">
          <PreferencesSettings />
        </Tabs.Panel>

        {isAdmin && (
          <Tabs.Panel value="email" pt="xl">
            <EmailSettings />
          </Tabs.Panel>
        )}

        {isAdmin && (
          <Tabs.Panel value="sms" pt="xl">
            <SMSSettings />
          </Tabs.Panel>
        )}
      </Tabs>
    </Container>
  );
}
