import {SimpleWebExtensionMessages} from './SimpleWebExtensionMessages';
import {SimpleWebExtensionBase} from './SimpleWebExtensionBase';

export class WebExtensionPopup extends SimpleWebExtensionBase {
  constructor(ns) {
    super();
    this.type = 'popup';
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
    return SimpleWebExtensionMessages.sendMessage(this.ns.options, type, obj);
  }

  popup(type, ...obj) {
    return this.functions[type].apply(null, obj)
  }

  initMessages(functions) {
    this.functions = functions;
    SimpleWebExtensionMessages.initRuntimeMessages(this.ns.popup, functions);
    this.fireAfterInit();
  }
}

