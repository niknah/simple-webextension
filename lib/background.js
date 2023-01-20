import {SimpleWebExtensionMessages} from './SimpleWebExtensionMessages';
import {SimpleWebExtensionBase} from './SimpleWebExtensionBase';

// eslint-disable-next-line no-unused-vars
export class WebExtensionBackground extends SimpleWebExtensionBase {
  constructor(ns) {
    super();
    this.type = 'background';
    this.ns = SimpleWebExtensionBase.getNameSpaces(ns);
    this.functions = {};
  }

  background(type, ...obj) {
    return this.functions[type].apply(this, obj);
  }

  browser(type, ...obj) {
    return SimpleWebExtensionMessages.sendActiveTabMessage(this.ns.browser, type, obj);
  }

  content(type, ...obj) {
    return SimpleWebExtensionMessages.sendActiveTabMessage(this.ns.content, type, obj);
  }

  options(type, ...obj) {
    return SimpleWebExtensionMessages.sendMessage(this.ns.options, type, obj);
  }

  popup(type, ...obj) {
    return SimpleWebExtensionMessages.sendMessage(this.ns.popup, type, obj);
  }

  initMessages(functions) {
    this.functions = functions;
    SimpleWebExtensionMessages.initRuntimeMessages(this.ns.background, functions);
    this.fireAfterInit();
  }
}
