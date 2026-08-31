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
import { SubscriptionSettings } from './SubscriptionSettings';
import { BrandingSettings } from '../platform/BrandingSettings';
import { PlatformEmailSettings } from '../platform/PlatformEmailSettings';
import { LlmSettings } from '../platform/LlmSettings';
import { PaymentGatewaySettings } from '../platform/PaymentGatewaySettings';
import { RoleGuard } from '../../components/common/RoleGuard';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { MessagesPage } from '../messages/MessagesPage';

export function SettingsPage() {
  const { role } = useAuth();
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const isAgencyAdmin = role === 'agency_admin';
  const isSuperAdmin = role === 'super_admin';
  const isAgencyStaff = role === 'agency_admin' || role === 'manager' || role === 'agent';
  const canSecurity = isAgencyAdmin;
  const defaultTab = params.get('tab') || 'profile';

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="xl">
        {t('settings') || 'الإعدادات'}
      </Title>

      <Tabs defaultValue={defaultTab}>
        <Tabs.List>
          <Tabs.Tab value="profile">{t('profile') || 'الملف الشخصي'}</Tabs.Tab>
          {canSecurity && <Tabs.Tab value="security">{t('security') || 'الأمان'}</Tabs.Tab>}
          {isAgencyAdmin && <Tabs.Tab value="agency">{t('agency') || 'الوكالة'}</Tabs.Tab>}
          {isAgencyAdmin && <Tabs.Tab value="subscription">{t('subscription') || 'الاشتراك'}</Tabs.Tab>}
          {isAgencyAdmin && <Tabs.Tab value="team">{t('team') || 'الفريق'}</Tabs.Tab>}
          {isAgencyAdmin && <Tabs.Tab value="branches">{t('branches') || 'الفروع'}</Tabs.Tab>}
          {isAgencyAdmin && <Tabs.Tab value="discounts">{t('discounts') || 'الخصومات'}</Tabs.Tab>}
          <Tabs.Tab value="preferences">{t('preferences') || 'التفضيلات'}</Tabs.Tab>
          {isAgencyAdmin && <Tabs.Tab value="email">{t('email') || 'البريد الإلكتروني'}</Tabs.Tab>}
          {isAgencyAdmin && <Tabs.Tab value="sms">{t('sms') || 'الرسائل النصية'}</Tabs.Tab>}
          {isAgencyStaff && <Tabs.Tab value="messages">{t('messages') || 'الرسائل'}</Tabs.Tab>}
          {isSuperAdmin && <Tabs.Tab value="branding">{t('platform_branding') || 'العلامة'}</Tabs.Tab>}
          {isSuperAdmin && <Tabs.Tab value="platform_email">{t('platform_email') || 'بريد المنصة'}</Tabs.Tab>}
          {isSuperAdmin && <Tabs.Tab value="llm">{t('llm_settings') || 'LLM'}</Tabs.Tab>}
          {isSuperAdmin && <Tabs.Tab value="gateways">{t('payment_gateways') || 'بوابات الدفع'}</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="profile" pt="xl"><ProfileSettings /></Tabs.Panel>
        {canSecurity && <Tabs.Panel value="security" pt="xl"><SecuritySettings /></Tabs.Panel>}
        {isAgencyAdmin && <Tabs.Panel value="agency" pt="xl"><AgencySettings /></Tabs.Panel>}
        {isAgencyAdmin && <Tabs.Panel value="subscription" pt="xl"><SubscriptionSettings /></Tabs.Panel>}
        {isAgencyAdmin && (
          <Tabs.Panel value="team" pt="xl">
            <RoleGuard allowed={['agency_admin']}><TeamManagement /></RoleGuard>
          </Tabs.Panel>
        )}
        {isAgencyAdmin && <Tabs.Panel value="branches" pt="xl"><BranchManagement /></Tabs.Panel>}
        {isAgencyAdmin && <Tabs.Panel value="discounts" pt="xl"><DiscountSettings /></Tabs.Panel>}
        <Tabs.Panel value="preferences" pt="xl"><PreferencesSettings /></Tabs.Panel>
        {isAgencyAdmin && <Tabs.Panel value="email" pt="xl"><EmailSettings /></Tabs.Panel>}
        {isAgencyAdmin && <Tabs.Panel value="sms" pt="xl"><SMSSettings /></Tabs.Panel>}
        {isAgencyStaff && (
          <Tabs.Panel value="messages" pt="xl">
            <MessagesPage hideTitle />
          </Tabs.Panel>
        )}
        {isSuperAdmin && <Tabs.Panel value="branding" pt="xl"><BrandingSettings /></Tabs.Panel>}
        {isSuperAdmin && <Tabs.Panel value="platform_email" pt="xl"><PlatformEmailSettings /></Tabs.Panel>}
        {isSuperAdmin && <Tabs.Panel value="llm" pt="xl"><LlmSettings /></Tabs.Panel>}
        {isSuperAdmin && <Tabs.Panel value="gateways" pt="xl"><PaymentGatewaySettings /></Tabs.Panel>}
      </Tabs>
    </Container>
  );
}
