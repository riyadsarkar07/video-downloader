function stamp() {
  return new Date().toISOString();
}

export const logger = {
  info(message, extra) {
    if (extra) {
      console.info(`[${stamp()}] ${message}`, extra);
      return;
    }
    console.info(`[${stamp()}] ${message}`);
  },
  warn(message, extra) {
    if (extra) {
      console.warn(`[${stamp()}] ${message}`, extra);
      return;
    }
    console.warn(`[${stamp()}] ${message}`);
  },
  error(message, extra) {
    if (extra) {
      console.error(`[${stamp()}] ${message}`, extra);
      return;
    }
    console.error(`[${stamp()}] ${message}`);
  },
};
