import {SimpleWebExtensionMessages} from './SimpleWebExtensionMessages.js';
import {SimpleWebExtensionBase} from './SimpleWebExtensionBase.js';


// eslint-disable-next-line no-unused-vars
export class WebExtensionBrowser extends SimpleWebExtensionBase {
  constructor(ns) {
    super();
    this.type = 'browser';
    this.ns = SimpleWebExtensionBase.getNameSpaces(ns);
    this.browserReplyNs = this.ns.browser + 'reply';
    this.nthMessage = 1;
    this.functions = {};
  }

  background(type, ...obj) {
    return SimpleWebExtensionMessages.windowMessage(
      window,
      this.ns.background,
      type,
      obj,
    );
  }

  browser(type, ...obj) {
    return this.functions[type].apply(null, obj);
  }

  content(type, ...obj) {
    return SimpleWebExtensionMessages.windowMessage(window, this.ns.content, type, obj);
  }

  options(type, ...obj) {
    return SimpleWebExtensionMessages.windowMessage(
      window,
      this.ns.options,
      type,
      obj,
    );
  }

  popup(type, ...obj) {
    return SimpleWebExtensionMessages.windowMessage(
      window,
      this.ns.popup,
      type,
      obj,
    );
  }

  fireAfterInit() {
    // need to wait for content script to init
    setTimeout(() => {
      SimpleWebExtensionBase.fireEvents(this.afterInitEvents);
    }, 100);
  }

  initMessages(functions) {
    this.functions = functions;
    this.initWindowMessages(functions);
    this.fireAfterInit();
  }

  initWindowMessages(functions) {
    window.addEventListener('message', evt => {
      const {data} = evt;
      if (data.ns === this.ns.browser) {
        const {nth} = data;
        const f = functions[data.type];
        if (f) {
          try {
            return Promise.resolve(f.apply(null, data.obj)).then(obj => {
              window.postMessage({
                ns: this.browserReplyNs,
                nth,
                ok: true,
                obj,
              });
            });
          } catch (e) {
            console.error(e);
          }
        }

        window.postMessage({ns: this.browserReplyNs, ok: false});
      }
    });
  }
}

