import twilio from 'twilio';
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

export interface SMSConfig {
  provider: 'twilio' | 'custom';
  // Twilio
  account_sid?: string; // Encrypted
  auth_token?: string; // Encrypted
  from_number?: string;
  // Custom API
  api_url?: string;
  api_key?: string; // Encrypted
  api_secret?: string; // Encrypted
}

// Encrypt sensitive data before storing
export function encryptSMSData(data: string): string {
  return encrypt(data);
}

// Decrypt sensitive data from storage
export function decryptSMSData(encryptedData: string): string {
  try {
    return decrypt(encryptedData);
  } catch (error) {
    throw new Error('Failed to decrypt SMS data');
  }
}

// Send SMS using Twilio
async function sendViaTwilio(config: SMSConfig, to: string, message: string): Promise<void> {
  if (!config.account_sid || !config.auth_token || !config.from_number) {
    throw new Error('Twilio configuration incomplete');
  }

  const accountSid = decryptSMSData(config.account_sid);
  const authToken = decryptSMSData(config.auth_token);

  const client = twilio(accountSid, authToken);

  try {
    await client.messages.create({
      body: message,
      from: config.from_number,
      to
    });
  } catch (error: any) {
    throw new Error(`Twilio error: ${error.message}`);
  }
}

// Send SMS using custom API
async function sendViaCustomAPI(config: SMSConfig, to: string, message: string): Promise<void> {
  if (!config.api_url || !config.api_key) {
    throw new Error('Custom API configuration incomplete');
  }

  const apiKey = decryptSMSData(config.api_key);
  const apiSecret = config.api_secret ? decryptSMSData(config.api_secret) : undefined;

  try {
    const response = await fetch(config.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(apiSecret && { 'X-API-Secret': apiSecret })
      },
      body: JSON.stringify({
        to,
        message,
        from: config.from_number
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Custom API error: ${error}`);
    }
  } catch (error: any) {
    throw new Error(`Failed to send SMS via custom API: ${error.message}`);
  }
}

// Send SMS
export async function sendSMS(config: SMSConfig, to: string, message: string): Promise<void> {
  if (config.provider === 'twilio') {
    await sendViaTwilio(config, to, message);
  } else if (config.provider === 'custom') {
    await sendViaCustomAPI(config, to, message);
  } else {
    throw new Error(`Unsupported SMS provider: ${config.provider}`);
  }
}

// Test SMS connection
export async function testConnection(config: SMSConfig, testPhoneNumber: string): Promise<boolean> {
  try {
    await sendSMS(
      config,
      testPhoneNumber,
      'Test SMS from Hujjaj - Your SMS configuration is working correctly!'
    );
    return true;
  } catch (error: any) {
    throw new Error(`SMS test failed: ${error.message}`);
  }
}
