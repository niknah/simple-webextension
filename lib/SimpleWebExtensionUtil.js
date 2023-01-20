/* globals browser */
/* globals chrome */

export class SimpleWebExtensionUtil {
  static browser = null;

  static getBrowser() {
    if (this.browser) {
      return this.browser;
    }
    try {
      browser.runtime.getManifest();
      this.browser = browser;
    } catch {
      try {
        this.browser = chrome;
      } catch {
        // No browser or chrome object, must be on browser.js
      }
    }
    return this.browser;
  }
}
