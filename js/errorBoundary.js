// Error boundary and recovery system for components
import { logger } from './logger.js';
import { CONSTANTS } from './constants.js';

export class ErrorBoundary {
  constructor(componentName, recoveryCallback = null) {
    this.componentName = componentName;
    this.recoveryCallback = recoveryCallback;
    this.errorCount = 0;
    this.lastErrorTime = 0;
    this.isRecovering = false;
    this.consecutiveErrors = 0;
  }

  /**
   * Wrap a function with error boundary protection
   */
  wrap(fn, context = null) {
    return async (...args) => {
      try {
        const result = await fn.apply(context, args);
        this.onSuccess();
        return result;
      } catch (error) {
        return this.handleError(error, fn.name);
      }
    };
  }

  /**
   * Handle errors with recovery logic
   */
  async handleError(error, functionName = 'unknown') {
    this.errorCount++;
    this.consecutiveErrors++;
    this.lastErrorTime = Date.now();

    logger.error(`${this.componentName}.${functionName} error:`, error);

    // Check if we've exceeded maximum consecutive errors
    if (this.consecutiveErrors >= CONSTANTS.MAX_CONSECUTIVE_ERRORS) {
      logger.error(`${this.componentName} has exceeded maximum consecutive errors (${CONSTANTS.MAX_CONSECUTIVE_ERRORS})`);
      this.enterFailsafeMode();
      return null;
    }

    // Attempt recovery if callback is provided and not already recovering
    if (this.recoveryCallback && !this.isRecovering) {
      return this.attemptRecovery(error);
    }

    // Default behavior: return null and log error
    return null;
  }

  /**
   * Attempt to recover from error
   */
  async attemptRecovery(error) {
    if (this.isRecovering) {
      logger.debug(`${this.componentName} already recovering, skipping`);
      return null;
    }

    this.isRecovering = true;
    logger.info(`${this.componentName} attempting recovery...`);

    try {
      // Add delay before recovery attempt
      await new Promise(resolve => setTimeout(resolve, CONSTANTS.ERROR_RECOVERY_DELAY_MS));

      // Set timeout for recovery operation
      const recoveryPromise = Promise.resolve(this.recoveryCallback(error));
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Recovery timeout')), CONSTANTS.COMPONENT_RECOVERY_TIMEOUT_MS);
      });

      await Promise.race([recoveryPromise, timeoutPromise]);
      
      logger.info(`${this.componentName} recovery successful`);
      this.onRecoverySuccess();
      return true;
    } catch (recoveryError) {
      logger.error(`${this.componentName} recovery failed:`, recoveryError);
      this.onRecoveryFailure(recoveryError);
      return null;
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Called when operation succeeds (resets error counters)
   */
  onSuccess() {
    if (this.consecutiveErrors > 0) {
      logger.debug(`${this.componentName} recovered from ${this.consecutiveErrors} consecutive errors`);
    }
    this.consecutiveErrors = 0;
  }

  /**
   * Called when recovery succeeds
   */
  onRecoverySuccess() {
    this.consecutiveErrors = 0;
    this.isRecovering = false;
  }

  /**
   * Called when recovery fails
   */
  onRecoveryFailure(error) {
    this.consecutiveErrors++;
    logger.error(`${this.componentName} recovery failure (attempt ${this.consecutiveErrors}):`, error);
  }

  /**
   * Enter failsafe mode (stop all operations)
   */
  enterFailsafeMode() {
    logger.error(`${this.componentName} entering failsafe mode - operations suspended`);
    
    // Emit custom event for failsafe mode
    const event = new CustomEvent('component-failsafe', {
      detail: {
        component: this.componentName,
        errorCount: this.errorCount,
        consecutiveErrors: this.consecutiveErrors
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * Check if component is in healthy state
   */
  isHealthy() {
    return this.consecutiveErrors < CONSTANTS.MAX_CONSECUTIVE_ERRORS && !this.isRecovering;
  }

  /**
   * Get error statistics
   */
  getStats() {
    return {
      componentName: this.componentName,
      totalErrors: this.errorCount,
      consecutiveErrors: this.consecutiveErrors,
      isRecovering: this.isRecovering,
      lastErrorTime: this.lastErrorTime,
      isHealthy: this.isHealthy()
    };
  }

  /**
   * Reset error counters (for manual recovery)
   */
  reset() {
    logger.info(`${this.componentName} error boundary reset`);
    this.errorCount = 0;
    this.consecutiveErrors = 0;
    this.isRecovering = false;
    this.lastErrorTime = 0;
  }
}