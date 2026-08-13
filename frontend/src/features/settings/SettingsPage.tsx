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
import { RoleGuard } from '../../components/common/RoleGuard';
import { useTranslation } from 'react-i18next';

export function SettingsPage() {
  const { role, agencyId } = useAuth();
  const { t } = useTranslation();
  const isSuperAdmin = role === 'super_admin';
  // Agency-scoped admin tabs — hidden for platform super admin (no agency)
  const isAgencyAdmin = role === 'agency_admin' || (isSuperAdmin && !!agencyId);
  const canSecurity = isAgencyAdmin || isSuperAdmin;

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
          {canSecurity && (
            <Tabs.Tab value="security">
              {t('security') || 'الأمان'}
            </Tabs.Tab>
          )}
          {isAgencyAdmin && (
            <Tabs.Tab value="agency">
              {t('agency') || 'الوكالة'}
            </Tabs.Tab>
          )}
          {isAgencyAdmin && (
            <Tabs.Tab value="team">
              {t('team') || 'الفريق'}
            </Tabs.Tab>
          )}
          {isAgencyAdmin && (
            <Tabs.Tab value="branches">
              {t('branches') || 'الفروع'}
            </Tabs.Tab>
          )}
          {isAgencyAdmin && (
            <Tabs.Tab value="discounts">
              {t('discounts') || 'الخصومات'}
            </Tabs.Tab>
          )}
          <Tabs.Tab value="preferences">
            {t('preferences') || 'التفضيلات'}
          </Tabs.Tab>
          {isAgencyAdmin && (
            <Tabs.Tab value="email">
              {t('email') || 'البريد الإلكتروني'}
            </Tabs.Tab>
          )}
          {isAgencyAdmin && (
            <Tabs.Tab value="sms">
              {t('sms') || 'الرسائل النصية'}
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="profile" pt="xl">
          <ProfileSettings />
        </Tabs.Panel>

        {canSecurity && (
          <Tabs.Panel value="security" pt="xl">
            <SecuritySettings />
          </Tabs.Panel>
        )}

        {isAgencyAdmin && (
          <Tabs.Panel value="agency" pt="xl">
            <AgencySettings />
          </Tabs.Panel>
        )}

        {isAgencyAdmin && (
          <Tabs.Panel value="team" pt="xl">
            <RoleGuard allowed={['agency_admin', 'super_admin']}>
              <TeamManagement />
            </RoleGuard>
          </Tabs.Panel>
        )}

        {isAgencyAdmin && (
          <Tabs.Panel value="branches" pt="xl">
            <BranchManagement />
          </Tabs.Panel>
        )}

        {isAgencyAdmin && (
          <Tabs.Panel value="discounts" pt="xl">
            <DiscountSettings />
          </Tabs.Panel>
        )}

        <Tabs.Panel value="preferences" pt="xl">
          <PreferencesSettings />
        </Tabs.Panel>

        {isAgencyAdmin && (
          <Tabs.Panel value="email" pt="xl">
            <EmailSettings />
          </Tabs.Panel>
        )}

        {isAgencyAdmin && (
          <Tabs.Panel value="sms" pt="xl">
            <SMSSettings />
          </Tabs.Panel>
        )}
      </Tabs>
    </Container>
  );
}
