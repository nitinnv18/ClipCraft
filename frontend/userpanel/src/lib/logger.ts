type LogArgs = unknown[];

const isBrowser = typeof window !== "undefined";

const STYLES = {
  badge: "background: #0f172a; color: #38bdf8; padding: 2px 6px; font-weight: 700; border-radius: 2px; font-family: monospace;",
  info: "background: #10b981; color: #ffffff; padding: 2px 6px; font-weight: 600; border-radius: 2px;",
  warn: "background: #f59e0b; color: #000000; padding: 2px 6px; font-weight: 600; border-radius: 2px;",
  error: "background: #ef4444; color: #ffffff; padding: 2px 6px; font-weight: 600; border-radius: 2px;",
  debug: "background: #8b5cf6; color: #ffffff; padding: 2px 6px; font-weight: 600; border-radius: 2px;",
  text: "color: inherit; font-weight: 500;",
};

const isDev = process.env.NODE_ENV !== "production";

/**
 * Clean, modern client/server logger with styled badges and icons.
 */
export const logger = {
  info(message: string, ...args: LogArgs): void {
    if (!isDev) return;
    if (isBrowser) {
      console.log(`%cClipCraft%c ✨ INFO %c ${message}`, STYLES.badge, STYLES.info, STYLES.text, ...args);
    } else {
      console.log(`[ClipCraft] ✨ INFO │ ${message}`, ...args);
    }
  },

  warn(message: string, ...args: LogArgs): void {
    if (isBrowser) {
      console.warn(`%cClipCraft%c ⚠️ WARN %c ${message}`, STYLES.badge, STYLES.warn, STYLES.text, ...args);
    } else {
      console.warn(`[ClipCraft] ⚠️ WARN │ ${message}`, ...args);
    }
  },

  error(message: string, ...args: LogArgs): void {
    if (isBrowser) {
      console.error(`%cClipCraft%c ❌ ERROR %c ${message}`, STYLES.badge, STYLES.error, STYLES.text, ...args);
    } else {
      console.error(`[ClipCraft] ❌ ERROR │ ${message}`, ...args);
    }
  },

  debug(message: string, ...args: LogArgs): void {
    if (!isDev) return;
    if (isBrowser) {
      console.debug(`%cClipCraft%c 🔍 DEBUG %c ${message}`, STYLES.badge, STYLES.debug, STYLES.text, ...args);
    } else {
      console.debug(`[ClipCraft] 🔍 DEBUG │ ${message}`, ...args);
    }
  },
};
