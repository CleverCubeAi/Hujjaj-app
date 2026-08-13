import nodemailer from 'nodemailer';
import { encryptSecret, decryptSecret } from '../utils/crypto';

export function encryptPassword(password: string): string {
  return encryptSecret(password);
}

export function decryptPassword(encryptedPassword: string): string {
  try {
    return decryptSecret(encryptedPassword);
  } catch {
    throw new Error('Failed to decrypt email password');
  }
}

export interface EmailConfig {
  provider: 'gmail' | 'outlook' | 'yahoo' | 'custom';
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports
  auth: {
    user: string;
    pass: string; // Encrypted in DB
  };
  from_email: string;
  from_name: string;
}

// Preset configurations
const PRESET_CONFIGS: Record<string, Partial<EmailConfig>> = {
  gmail: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false
  },
  outlook: {
    host: 'smtp.office365.com',
    port: 587,
    secure: false
  },
  yahoo: {
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false
  }
};

// Get preset configuration
export function getPresetConfig(provider: 'gmail' | 'outlook' | 'yahoo'): Partial<EmailConfig> {
  return PRESET_CONFIGS[provider] || {};
}

// Create transporter from config
export function createTransporter(config: EmailConfig) {
  const decryptedPassword = decryptPassword(config.auth.pass);

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.auth.user,
      pass: decryptedPassword
    }
  });
}

// Send email
export async function sendEmail(
  config: EmailConfig,
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<void> {
  try {
    const transporter = createTransporter(config);

    await transporter.sendMail({
      from: `"${config.from_name}" <${config.from_email}>`,
      to,
      subject,
      text: text || html.replace(/<[^>]*>/g, ''),
      html
    });
  } catch (error: any) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

// Test SMTP connection
export async function testConnection(config: EmailConfig, testEmail: string): Promise<boolean> {
  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    
    // Send test email
    await sendEmail(
      config,
      testEmail,
      'Test Email from Hujjaj',
      '<p>This is a test email to verify your SMTP configuration.</p>',
      'This is a test email to verify your SMTP configuration.'
    );
    
    return true;
  } catch (error: any) {
    throw new Error(`Connection test failed: ${error.message}`);
  }
}
