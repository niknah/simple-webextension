import {SimpleWebExtensionMessages} from './SimpleWebExtensionMessages.js';
import {SimpleWebExtensionBase} from './SimpleWebExtensionBase.js';
import {SimpleWebExtensionUtil} from './SimpleWebExtensionUtil.js';

// eslint-disable-next-line no-unused-vars
export class WebExtensionContent extends SimpleWebExtensionBase {
  constructor(ns) {
    super();
    this.type = 'content';
    this.ns = SimpleWebExtensionBase.getNameSpaces(ns);

    this.contentReplyNs = this.ns.content + 'reply';
    this.browserScriptAdded = false;
    this.functions = {};
  }

  background(type, ...obj) {
    return SimpleWebExtensionMessages.sendMessage(this.ns.background, type, obj);
  }

  browser(type, ...obj) {
    return SimpleWebExtensionMessages.windowMessage(window, this.ns.browser, type, obj);
  }

  content(type, ...obj) {
    return this.functions[type].apply(null, obj);
  }

  options(type, ...obj) {
    return SimpleWebExtensionMessages.sendMessage(this.ns.options, type, obj);
  }

  popup(type, ...obj) {
    return SimpleWebExtensionMessages.sendMessage(this.ns.popup, type, obj);
  }

  fireAfterInit() {
    // need to wait for browser script to init
    setTimeout(() => {
      SimpleWebExtensionBase.fireEvents(this.afterInitEvents);
    }, 100);
  }

  static addScript(src) {
    const id = 'webext_' + src.replace(/[^a-zA-Z0-9_-]/g, '');
    if (document.getElementById(id)) {
      return;
    }

    const s = document.createElement('script');
    s.id = id;
    s.src = SimpleWebExtensionUtil.getBrowser().runtime.getURL(src);
    (document.head || document.documentElement).appendChild(s);
  }

  addBrowserScript() {
    if (this.browserScriptAdded) {
      return;
    }

    WebExtensionContent.addScript('./browser.js');
    WebExtensionContent.browserScriptAdded = true;
  }

  startRuntimeMessages() {
    SimpleWebExtensionUtil.getBrowser().runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Browser can't get runtime messages, we'll pass it on
      if (message.ns === this.ns.browser) {
        Promise.resolve(this.browser.apply(this, [message.type, ...message.obj])).then(obj => {
          sendResponse({ok: true, obj});
        });
        return true;
      }
    });
  }

  initMessages(functions) {
    this.functions = functions;
    this.startRuntimeMessages();
    this.initWindowMessages(functions);
    SimpleWebExtensionMessages.initRuntimeMessages(this.ns.content, functions);
    this.addBrowserScript();
    this.fireAfterInit();
  }

  initWindowMessages(functions) {
    window.addEventListener('message', evt => {
      const {data} = evt;
      const {nth} = data;
      if (data.ns === this.ns.background) {
        // browser is sending message to background script
        return Promise.resolve(this.background.apply(this, [data.type, ...data.obj])).then(obj => {
          // send reply back to browser
          window.postMessage({
            ns: this.ns.background + 'reply',
            nth,
            ok: true,
            obj,
          });
        });
      }

      if (data.ns === this.ns.options) {
        return Promise.resolve(this.options.apply(this, [data.type, ...data.obj])).then(obj => {
          window.postMessage({
            ns: this.ns.options + 'reply',
            nth,
            ok: true,
            obj,
          });
        });
      }

      if (data.ns === this.ns.popup) {
        return Promise.resolve(this.popup.apply(this, [data.type, ...data.obj])).then(obj => {
          window.postMessage({
            ns: this.ns.popup + 'reply',
            nth,
            ok: true,
            obj,
          });
        });
      }

      if (data.ns === this.ns.content) {
        const f = functions[data.type];
        if (f) {
          try {
            return Promise.resolve(f.apply(this, data.obj)).then(obj => {
              window.postMessage({
                ns: this.contentReplyNs,
                nth,
                ok: true,
                obj,
              });
            });
          } catch (e) {
            console.error(e);
          }
        } else {
          console.error('Unknown func', data.type);
        }

        window.postMessage({ns: this.contentReplyNs, ok: false});
      }
    });
  }
}
