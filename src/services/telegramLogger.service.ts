import TelegramBot from 'node-telegram-bot-api';
import { Request } from 'express';
import { extractRequestMetadata } from '../utils/request.metadata';

export interface TelegramLoggerConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export class TelegramLogger {
  private bot: TelegramBot;
  private chatId: string;
  private enabled: boolean;

  constructor(config: TelegramLoggerConfig) {
    this.bot = new TelegramBot(config.botToken);
    this.chatId = config.chatId;
    this.enabled = config.enabled;
  }

  private formatErrorMessage(error: Error, req?: Request): string {
    const timestamp = new Date().toISOString();
    const emoji = '🚨';
    
    let message = `${emoji} *Exception Alert*\n\n`;
    message += `📅 *Timestamp:* ${timestamp}\n`;
    
    if (req) {
      const metadata = extractRequestMetadata(req);
      message += `🌐 *Request Info:*\n`;
      message += `• Method: ${req.method}\n`;
      message += `• URL: ${req.originalUrl}\n`;
      message += `• IP: ${metadata.ip}\n`;
      message += `• Browser: ${metadata.browser}\n`;
      message += `• OS: ${metadata.os}\n`;
      message += `• Device: ${metadata.device}\n`;
      
      if (req.userId) {
        message += `• User ID: ${req.userId}\n`;
      }
      if (req.businessId) {
        message += `• Business ID: ${req.businessId}\n`;
      }
      if (metadata.location) {
        message += `• Location: ${metadata.location}\n`;
      }
      message += '\n';
    }
    
    message += `❌ *Error Details:*\n`;
    message += `• Name: ${error.name}\n`;
    message += `• Message: ${error.message}\n`;
    
    if (error.stack) {
      message += `\n📋 *Stack Trace:*\n\`\`\`\n${error.stack}\n\`\`\``;
    }
    
    message += `\n🏷️ *Environment:* ${process.env.NODE_ENV || 'unknown'}`;
    
    return message;
  }

  async logException(error: Error, req?: Request): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const message = this.formatErrorMessage(error, req);
      
      // Telegram has a 4096 character limit for messages
      if (message.length > 4000) {
        // Split message if too long
        const parts = message.match(/.{1,4000}/g) || [];
        for (const part of parts) {
          await this.bot.sendMessage(this.chatId, part, {
            parse_mode: 'Markdown',
          });
        }
      } else {
        await this.bot.sendMessage(this.chatId, message, {
          parse_mode: 'Markdown',
        });
      }
    } catch (telegramError) {
      // Fallback to console logging if Telegram fails
      console.error('Failed to send error to Telegram:', telegramError);
      console.error('Original error:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      await this.bot.getMe();
      const testMessage = '✅ Telegram logger is now active and ready to receive exception alerts!';
      await this.bot.sendMessage(this.chatId, testMessage);
      return true;
    } catch (error) {
      console.error('Telegram connection test failed:', error);
      return false;
    }
  }
}

// Singleton instance
let telegramLoggerInstance: TelegramLogger | null = null;

export const getTelegramLogger = (): TelegramLogger => {
  if (!telegramLoggerInstance) {
    const config: TelegramLoggerConfig = {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
      enabled: process.env.TELEGRAM_LOGGING_ENABLED === 'true',
    };

    if (!config.botToken || !config.chatId) {
      console.warn('Telegram logger configuration missing. Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables.');
      config.enabled = false;
    }

    telegramLoggerInstance = new TelegramLogger(config);
  }

  return telegramLoggerInstance;
};

export const logExceptionToTelegram = async (error: Error, req?: Request): Promise<void> => {
  const logger = getTelegramLogger();
  await logger.logException(error, req);
};
