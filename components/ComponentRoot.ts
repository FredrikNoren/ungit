declare var ungit: any;

export class ComponentRoot {
  _apiCache: string;

  constructor() { }

  isSamePayload(value: any) {
    const jsonString = JSON.stringify(value);

    if (this._apiCache === jsonString) {
      ungit.logger.warn(`ignoring redraw for same ${this.constructor.name} payload.`);
      return true;
    }

    this._apiCache = jsonString
    return false;
  }
}
