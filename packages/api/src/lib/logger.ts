export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export function createLogger(name: string): Logger {
  return {
    info(message, data) {
      console.log(JSON.stringify({ level: 'info', logger: name, message, ...data }));
    },
    error(message, data) {
      console.error(JSON.stringify({ level: 'error', logger: name, message, ...data }));
    },
  };
}
