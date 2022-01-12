
export class RootComponents {
  __cachedValue: string;

  isTriggerEvent(value: any) {
    const jsonString = JSON.stringify(value);

    if (this.__cachedValue === jsonString) {
      return false;
    }

    this.__cachedValue = jsonString;
    return true;
  }
}
