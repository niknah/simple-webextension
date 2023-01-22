/* eslint no-await-in-loop: 0 */

import {SimpleWebExtensionUtil} from './SimpleWebExtensionUtil.js';

// eslint-disable-next-line no-unused-vars
export class SimpleWebExtensionMessages {
  static getActiveTab() {
//    return browser.tabs.getCurrent();
    return SimpleWebExtensionUtil.getBrowser().tabs
      .query({
        currentWindow: true,
        active: true,
      })
      .then(async tabs => tabs[0]);
  }

  static sendActiveTabMessage(ns, type, obj) {
    return this.getActiveTab().then(
      tab => {
        if (!tab) {
          console.error('active tab not found', new Error());
          return null;
        }

        return this.sendTabMessage(tab.id, ns, type, obj);
      });
  }

  static sendTabMessage(tabId, ns, type, obj) {
    if (!tabId) {
      console.error('no tab id', new Error());
    }
    return SimpleWebExtensionUtil.getBrowser().tabs.sendMessage(
      tabId,
      {
        ns,
        type,
        obj,
      },
    ).then(reply => {
      if (!reply || !reply.ok) {
        console.error(
          'Reply failed',
          reply,
          `tabId:${tabId}, ns:${ns}, type:${type}, reply: ${JSON.stringify(reply)}`
        );
      }

      return reply.obj;
    }).catch(e => {
      console.error(
        'Could not send message',
        e,
        `tabId:${tabId}, ns:${ns}, type:${type}`
      );
      return null;
    });
  }

  static sendMessage(ns, type, obj) {
    return SimpleWebExtensionUtil.getBrowser().runtime.sendMessage({
      type,
      ns,
      obj,
    }).then(reply => {
      if (!reply || !reply.ok) {
        console.error('failed reply:', reply, 'ns:', ns, 'type:', type);
        return null;
      }

      return reply.obj;
    });
  }

  static getActiveWindow() {
    return this.getActiveTab().then(
      tab => {
        if (!tab) {

          console.error('active tab not found', new Error());
          return null;
        }
        return SimpleWebExtensionUtil.getBrowser().windows.get(tab.windowId);
      });
  }

  static sendActiveWindowMessage(ns, type, obj) {
    return this.getActiveTab().then(
      tab => {
        if (!tab) {

          console.error('active tab not found', new Error());
          return null;
        }

        return SimpleWebExtensionUtil.getBrowser().windows.get(tab.windowId).then((win) => {
          return this.windowMessage(win, ns, type, obj);
        });
      });
  }


  static nthMessage = 0;

  static windowMessage(win, sendNs, type, obj) {
    const recvNs = sendNs + 'reply';

    if (!this.nthMessage) {
      this.nthMessage = Math.floor(Math.random()*10000000);
    }

    const nth = this.nthMessage;
    ++this.nthMessage;
    return new Promise(resolve => {
      function contentEvent(evt) {
        const {data} = evt;
        if (data.ns === recvNs && data.nth === nth) {
          win.removeEventListener('message', contentEvent);
          resolve(data.obj);
        }
      }

      win.addEventListener('message', contentEvent);

      win.postMessage({ns: sendNs, type, nth, obj});
    });
  }

  static initRuntimeMessages(ns, functions) {
    SimpleWebExtensionUtil.getBrowser().runtime.onMessage.addListener(
      (message, sender, sendResponse) => {
        if (message.ns !== ns) {
          return false;
        }

        const f = functions[message.type];
        if (f) {
          try {
            Promise.resolve(f.apply(null, message.obj)).then(obj => {
              sendResponse({ok: true, obj});
            });

            return true;
          } catch (e) {
            console.error(e, message);
          }
        }

        console.error('Unknown message type:', message.type);

        return false;
      }
    );
  }
}
