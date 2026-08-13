import { Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../services/supabase';
import {
  EmailConfig,
  encryptPassword,
  decryptPassword,
  sendEmail,
  testConnection as testEmailConnection
} from '../services/email.service';
import {
  SMSConfig,
  encryptSMSData,
  sendSMS,
  testConnection as testSMSConnection
} from '../services/sms.service';

// Get email settings
export const getEmailSettings = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Only agency_admin and super_admin can view email settings
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('email_settings')
      .select('*')
      .forAgency(agencyId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      return res.json(null);
    }

    // Mask password in response
    const response = {
      ...data,
      password_encrypted: data.password_encrypted ? '••••••••' : null
    };

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update email settings
export const updateEmailSettings = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const {
      provider,
      host,
      port,
      secure,
      username,
      password,
      from_email,
      from_name
    } = req.body;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Only agency_admin and super_admin can update email settings
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!provider || !host || !port || !username || !from_email || !from_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if settings already exist
    const { data: existingSettings } = await supabase
      .from('email_settings')
      .select('password_encrypted')
      .forAgency(agencyId)
      .single();

    // If password is provided, encrypt it. Otherwise, keep existing password
    let passwordToStore = existingSettings?.password_encrypted;
    if (password) {
      passwordToStore = encryptPassword(password);
    } else if (!existingSettings) {
      // Password required for new settings
      return res.status(400).json({ error: 'Password is required for new email settings' });
    }

    const settings = {
      agency_id: agencyId,
      provider,
      host,
      port,
      secure: secure || false,
      username,
      password_encrypted: passwordToStore,
      from_email,
      from_name,
      enabled: true,
      updated_at: new Date().toISOString()
    };

    // Upsert email settings
    const { data, error } = await supabase
      .from('email_settings')
      .upsert(settings, { onConflict: 'agency_id' })
      .select()
      .single();

    if (error) throw error;

    // Mask password in response
    const response = {
      ...data,
      password_encrypted: '••••••••'
    };

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Test email
export const testEmail = async (req: Request, res: Response) => {
  const agencyId = req.user?.agency_id;
  try {
    const role = req.user?.role;
    const { test_email } = req.body;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Only agency_admin and super_admin can test email
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!test_email) {
      return res.status(400).json({ error: 'Test email address is required' });
    }

    // Get email settings
    const { data: settings, error } = await supabase
      .from('email_settings')
      .select('*')
      .forAgency(agencyId)
      .single();

    if (error || !settings) {
      return res.status(404).json({ error: 'Email settings not configured' });
    }

    // Decrypt password
    const decryptedPassword = decryptPassword(settings.password_encrypted);

    const emailConfig: EmailConfig = {
      provider: settings.provider as any,
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.username,
        pass: decryptedPassword
      },
      from_email: settings.from_email,
      from_name: settings.from_name
    };

    // Test connection and send email
    await testEmailConnection(emailConfig, test_email);

    // Update test status
    await supabase
      .from('email_settings')
      .update({
        last_tested_at: new Date().toISOString(),
        test_status: 'success'
      })
      .forAgency(agencyId);

    res.json({ message: 'Test email sent successfully' });
  } catch (error: any) {
    // Update test status to failed
    if (agencyId) {
      try {
        await supabase
          .from('email_settings')
          .update({
            last_tested_at: new Date().toISOString(),
            test_status: 'failed'
          })
          .forAgency(agencyId);
      } catch (updateError) {
        // Ignore update errors
      }
    }

    res.status(500).json({ error: error.message });
  }
};

// Get SMS settings
export const getSMSSettings = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Only agency_admin and super_admin can view SMS settings
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('sms_settings')
      .select('*')
      .forAgency(agencyId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      return res.json(null);
    }

    // Mask sensitive data in response
    const response = {
      ...data,
      account_sid_encrypted: data.account_sid_encrypted ? '••••••••' : null,
      auth_token_encrypted: data.auth_token_encrypted ? '••••••••' : null,
      api_key_encrypted: data.api_key_encrypted ? '••••••••' : null,
      api_secret_encrypted: data.api_secret_encrypted ? '••••••••' : null
    };

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update SMS settings
export const updateSMSSettings = async (req: Request, res: Response) => {
  try {
    const agencyId = req.user?.agency_id;
    const role = req.user?.role;
    const {
      provider,
      account_sid,
      auth_token,
      from_number,
      api_url,
      api_key,
      api_secret
    } = req.body;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Only agency_admin and super_admin can update SMS settings
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    const settings: any = {
      agency_id: agencyId,
      provider,
      enabled: true,
      updated_at: new Date().toISOString()
    };

    // Check if settings already exist
    const { data: existingSettings } = await supabase
      .from('sms_settings')
      .select('*')
      .forAgency(agencyId)
      .single();

    if (provider === 'twilio') {
      if (!from_number) {
        return res.status(400).json({ error: 'from_number is required' });
      }
      settings.from_number = from_number;
      
      // Only update credentials if provided, otherwise keep existing
      if (account_sid) {
        settings.account_sid_encrypted = encryptSMSData(account_sid);
      } else if (existingSettings?.account_sid_encrypted) {
        settings.account_sid_encrypted = existingSettings.account_sid_encrypted;
      } else {
        return res.status(400).json({ error: 'account_sid is required for new Twilio settings' });
      }
      
      if (auth_token) {
        settings.auth_token_encrypted = encryptSMSData(auth_token);
      } else if (existingSettings?.auth_token_encrypted) {
        settings.auth_token_encrypted = existingSettings.auth_token_encrypted;
      } else {
        return res.status(400).json({ error: 'auth_token is required for new Twilio settings' });
      }
    } else if (provider === 'custom') {
      if (!api_url || !from_number) {
        return res.status(400).json({ error: 'api_url and from_number are required' });
      }
      settings.api_url = api_url;
      settings.from_number = from_number;
      
      // Only update credentials if provided, otherwise keep existing
      if (api_key) {
        settings.api_key_encrypted = encryptSMSData(api_key);
      } else if (existingSettings?.api_key_encrypted) {
        settings.api_key_encrypted = existingSettings.api_key_encrypted;
      } else {
        return res.status(400).json({ error: 'api_key is required for new custom API settings' });
      }
      
      if (api_secret) {
        settings.api_secret_encrypted = encryptSMSData(api_secret);
      } else if (existingSettings?.api_secret_encrypted) {
        settings.api_secret_encrypted = existingSettings.api_secret_encrypted;
      }
    }

    // Upsert SMS settings
    const { data, error } = await supabase
      .from('sms_settings')
      .upsert(settings, { onConflict: 'agency_id' })
      .select()
      .single();

    if (error) throw error;

    // Mask sensitive data in response
    const response = {
      ...data,
      account_sid_encrypted: data.account_sid_encrypted ? '••••••••' : null,
      auth_token_encrypted: data.auth_token_encrypted ? '••••••••' : null,
      api_key_encrypted: data.api_key_encrypted ? '••••••••' : null,
      api_secret_encrypted: data.api_secret_encrypted ? '••••••••' : null
    };

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Test SMS
export const testSMS = async (req: Request, res: Response) => {
  const agencyId = req.user?.agency_id;
  try {
    const role = req.user?.role;
    const { test_phone_number } = req.body;

    if (!agencyId && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Agency ID not found' });
  }

    // Only agency_admin and super_admin can test SMS
    if (role !== 'agency_admin' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!test_phone_number) {
      return res.status(400).json({ error: 'Test phone number is required' });
    }

    // Get SMS settings
    const { data: settings, error } = await supabase
      .from('sms_settings')
      .select('*')
      .forAgency(agencyId)
      .single();

    if (error || !settings) {
      return res.status(404).json({ error: 'SMS settings not configured' });
    }

    // Decrypt and build config
    const smsConfig: SMSConfig = {
      provider: settings.provider as any
    };

    if (settings.provider === 'twilio') {
      if (!settings.account_sid_encrypted || !settings.auth_token_encrypted) {
        return res.status(400).json({ error: 'Twilio configuration incomplete' });
      }
      smsConfig.account_sid = settings.account_sid_encrypted;
      smsConfig.auth_token = settings.auth_token_encrypted;
      smsConfig.from_number = settings.from_number;
    } else if (settings.provider === 'custom') {
      if (!settings.api_url || !settings.api_key_encrypted) {
        return res.status(400).json({ error: 'Custom API configuration incomplete' });
      }
      smsConfig.api_url = settings.api_url;
      smsConfig.api_key = settings.api_key_encrypted;
      if (settings.api_secret_encrypted) {
        smsConfig.api_secret = settings.api_secret_encrypted;
      }
      smsConfig.from_number = settings.from_number;
    }

    // Test connection and send SMS
    await testSMSConnection(smsConfig, test_phone_number);

    // Update test status
    await supabase
      .from('sms_settings')
      .update({
        last_tested_at: new Date().toISOString(),
        test_status: 'success'
      })
      .forAgency(agencyId);

    res.json({ message: 'Test SMS sent successfully' });
  } catch (error: any) {
    // Update test status to failed
    if (agencyId) {
      try {
        await supabase
          .from('sms_settings')
          .update({
            last_tested_at: new Date().toISOString(),
            test_status: 'failed'
          })
          .forAgency(agencyId);
      } catch (updateError) {
        // Ignore update errors
      }
    }

    res.status(500).json({ error: error.message });
  }
};
