export const logger = {
  info: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.log(`[${timestamp}] [INFO] ${message}`, typeof meta === 'object' ? JSON.stringify(sanitizeMeta(meta)) : meta);
    } else {
      console.log(`[${timestamp}] [INFO] ${message}`);
    }
  },
  warn: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.warn(`[${timestamp}] [WARN] ${message}`, typeof meta === 'object' ? JSON.stringify(sanitizeMeta(meta)) : meta);
    } else {
      console.warn(`[${timestamp}] [WARN] ${message}`);
    }
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    if (error) {
      console.error(`[${timestamp}] [ERROR] ${message}`, error?.message || error);
    } else {
      console.error(`[${timestamp}] [ERROR] ${message}`);
    }
  },
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      const timestamp = new Date().toISOString();
      if (meta) {
        console.debug(`[${timestamp}] [DEBUG] ${message}`, typeof meta === 'object' ? JSON.stringify(sanitizeMeta(meta)) : meta);
      } else {
        console.debug(`[${timestamp}] [DEBUG] ${message}`);
      }
    }
  },
};


function sanitizeMeta(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = { ...obj };
  const sensitiveKeys = ['email', 'phone', 'rawText', 'password', 'apiKey'];
  for (const key of Object.keys(copy)) {
    if (sensitiveKeys.includes(key)) {
      copy[key] = '[REDACTED]';
    } else if (typeof copy[key] === 'object') {
      copy[key] = sanitizeMeta(copy[key]);
    }
  }
  return copy;
}

