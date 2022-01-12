const map = new Map<string, string>();

export function isSamePayload(key: string, value: any) {
  const jsonString = JSON.stringify(value);

  if (map.get(key) === jsonString) {
    return true;
  }

  map.set(key, jsonString);
  return false;
}