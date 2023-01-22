import {SimpleWebExtensionMessages} from './SimpleWebExtensionMessages.js';
import {SimpleWebExtensionBase} from './SimpleWebExtensionBase.js';

export class WebExtensionOptions extends SimpleWebExtensionBase {
  constructor(ns) {
    super();
    this.type = 'options';
    this.ns = SimpleWebExtensionBase.getNameSpaces(ns);
    this.functions = {};
  }

  background(type, ...obj) {
    return SimpleWebExtensionMessages.sendMessage(this.ns.background, type, obj);
  }

  browser(type, ...obj) {
    return SimpleWebExtensionMessages.sendActiveTabMessage(this.ns.browser, type, obj);
  }

  content(type, ...obj) {
    return SimpleWebExtensionMessages.sendActiveTabMessage(this.ns.content, type, obj);
  }

  options(type, ...obj) {
    return this.functions[type].apply(null, obj)
  }

  popup(type, ...obj) {
    return SimpleWebExtensionMessages.sendMessage(this.ns.popup, type, obj);
  }

  initMessages(functions) {
    this.functions = functions;
    SimpleWebExtensionMessages.initRuntimeMessages(this.ns.options, functions);
    this.fireAfterInit();
  }
}
