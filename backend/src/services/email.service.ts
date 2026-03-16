import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Encryption key from environment (should be set in production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
const ALGORITHM = 'aes-256-cbc';

// Helper to encrypt sensitive data
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf8'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Helper to decrypt sensitive data
function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf8'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
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

// Encrypt password before storing
export function encryptPassword(password: string): string {
  return encrypt(password);
}

// Decrypt password from storage
export function decryptPassword(encryptedPassword: string): string {
  try {
    return decrypt(encryptedPassword);
  } catch (error) {
    throw new Error('Failed to decrypt password');
  }
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
      'Test Email from Ashamel',
      '<p>This is a test email to verify your SMTP configuration.</p>',
      'This is a test email to verify your SMTP configuration.'
    );
    
    return true;
  } catch (error: any) {
    throw new Error(`Connection test failed: ${error.message}`);
  }
}
