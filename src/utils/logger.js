function timestamp() {
  return new Date().toISOString();
}

export function info(message) {
  console.log(`[INFO]  ${timestamp()} — ${message}`);
}

export function warn(message) {
  console.warn(`[WARN]  ${timestamp()} — ${message}`);
}

export function error(message) {
  console.error(`[ERROR] ${timestamp()} — ${message}`);
}
