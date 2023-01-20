

export class SimpleWebExtensionBase {
  constructor() {
    this.afterInitEvents = [];
  }

  onAfterInit(func) {
    SimpleWebExtensionBase.addEvent(this.afterInitEvents, func);
  }

  fireAfterInit() {
    SimpleWebExtensionBase.fireEvents(this.afterInitEvents);
  }

  static addEvent(events, func) {
    events.push(func);
  }

  static fireEvents(events) {
    for(const e of events) {
      e();
    }
  }

  static getNameSpaces(ns) {
    return {
      ns,
      content: ns + '_content',
      background: ns + '_background',
      options: ns + '_options',
      browser: ns + '_browser',
      popup: ns + '_popup',
    };
  }
}
