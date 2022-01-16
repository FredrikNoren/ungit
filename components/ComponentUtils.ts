declare var ungit: any;

const map = new Map<string, string>();

export function isSamePayload(key: string, value: any) {
  const jsonString = JSON.stringify(value);

  if (map.get(key) === jsonString) {
    ungit.logger.warn(`ignoring redraw for same ${key} payload.`);
    return true;
  }

  map.set(key, jsonString);
  return false;
}