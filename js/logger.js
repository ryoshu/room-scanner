// Simple logging utility with levels
export class Logger {
  constructor(level = 'info') {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    this.currentLevel = this.levels[level] || 2;
  }

  setLevel(level) {
    this.currentLevel = this.levels[level] || 2;
  }

  error(message, ...args) {
    if (this.currentLevel >= this.levels.error) {
      console.error(message, ...args);
    }
  }

  warn(message, ...args) {
    if (this.currentLevel >= this.levels.warn) {
      console.warn(message, ...args);
    }
  }

  info(message, ...args) {
    if (this.currentLevel >= this.levels.info) {
      console.log(message, ...args);
    }
  }

  debug(message, ...args) {
    if (this.currentLevel >= this.levels.debug) {
      console.log(message, ...args);
    }
  }
}

// Export a default instance
export const logger = new Logger(
  // Use debug level in development, info in production
  typeof __DEV__ !== 'undefined' && __DEV__ ? 'debug' : 'info'
);