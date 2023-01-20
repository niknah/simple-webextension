/* global simpleWebExt */
/* global browser */
import {windowLimits} from './limits';

class ThisTest {
  // simplewebext content
  this_content(arg1, arg2) {
    this.changed = 1;
    return Promise.resolve({
      arg1, arg2,
      from: 'content',
    });
  }
  // simplewebext background
  this_background(arg1, arg2) {
    this.changed = 1;
    return Promise.resolve({
      arg1, arg2,
      from: 'background',
    });
  }

  // simplewebext popup
  this_popup(arg1, arg2) {
    this.changed = 1;
    return Promise.resolve({
      arg1, arg2,
      from: 'popup',
    });
  }

  // simplewebext options
  this_options(arg1, arg2) {
    this.changed = 1;
    return Promise.resolve({
      arg1, arg2,
      from: 'options',
    });
  }

  // simplewebext browser
  this_browser(arg1, arg2) {
    this.changed = 1;
    return Promise.resolve({
      arg1, arg2,
      from: 'browser',
    });
  }
}


class WebExtTest {
  // simplewebext browser
  static makeTable(title, arr) {
    const table = document.createElement('table');
    const titleId = title.replace(/\s+/g,'-');
    const existingTable = document.getElementById(titleId);
    if (existingTable) {
      existingTable.parentNode.removeChild(existingTable);
    }

    table.id = titleId;
    const trHead = table.insertRow(-1);
    const th = document.createElement('th');
    trHead.appendChild(th);
    th.colSpan = 2;
    th.innerHTML = title;

    for (const row of arr) {
      const tr = table.insertRow(-1);
      for (const cell of row) {
        const td = tr.insertCell(-1);
        if (typeof(cell) === 'string') {
          td.innerHTML = cell;
        } else {
          td.innerHTML = JSON.stringify(cell);
        }
      }
    }

    document.body.appendChild(table);
  }

  static echo(message) {
    return Promise.resolve({
      fromBrowser: true, message,
    });
  }

  // simplewebext browser
  static test_browser() {
    return windowLimits(simpleWebExt, WebExtTest, new ThisTest()).then(limits => {
      this.makeTable('browser', limits);
    }).then(
      () => this.test_content() 
    ).then((limits) => {
      this.makeTable('content', limits);
    }).then(
      () => this.test_background() 
    ).then((limits) => {
      this.makeTable('background', limits);
    }).then(
      () => this.test_options() 
    ).then((limits) => {
      this.makeTable('options', limits);
    });
  }

  // simplewebext content
  static test_content() {
    return windowLimits(simpleWebExt, WebExtTest, new ThisTest());
  }

  // simplewebext background
  static test_background() {
    return windowLimits(simpleWebExt, WebExtTest, new ThisTest());
  }

  // simplewebext options
  static test_options() {
    return windowLimits(simpleWebExt, WebExtTest, new ThisTest());
  }

  // simplewebext background
  static echo_background(message) {
    return Promise.resolve({
      text: message.text,
      from: 'background',
    });
  }

  // simplewebext browser
  static print_limits_table(from, limits) {
    WebExtTest.makeTable(from, limits);
    return Promise.resolve({ ok: true });
  }

  // simplewebext content
  static echo_content(message) {
    return Promise.resolve({
      text: message.text,
      from: 'content',
    });
  }

  // simplewebext browser
  static echo_browser(message) {
    return Promise.resolve({
      text: message.text,
      from: 'browser',
    });
  }

  // simplewebext options
  static echo_options(message) {
    return Promise.resolve({
      text: message.text,
      from: 'options',
    });
  }

  // simplewebext popup
  static echo_popup(message) {
    return Promise.resolve({
      text: message.text,
      from: 'popup',
    });
  }

  static send_limits_to_browser(from) {
    return windowLimits(simpleWebExt, WebExtTest, new ThisTest()).then(limits => {
      this.print_limits_table(from, limits);
    });
  }

  // simplewebext background
  static start_tests() {
    const url = 'https://dunno.com/blank.html';
console.log('open options');
    return browser.runtime.openOptionsPage().then(() => {
      return browser.tabs.query({url});
    }).then((tabs) => {
      if(tabs && tabs.length>0) {
        const tabId = tabs[0].id;
        return browser.tabs.update(tabId,  {active: true}).then(() => {
          return browser.tabs.reload(tabId)
        });
      }
      return browser.tabs.create({url, active: true});
    });
  }
}

// simplewebext background
simpleWebExt.onAfterInit(() => {
  setTimeout(() => {
    WebExtTest.start_tests();
  }, 1000);
});

// simplewebext browser
simpleWebExt.onAfterInit(() => {
  WebExtTest.test_browser();
  document.body.appendChild(document.createTextNode("Click on the \u{1f9e9} extensions menu and start the extension."));
});

// simplewebext background
//simpleWebExt.onAfterInit(() => {
//  if (browser && browser.browserAction && browser.browserAction.openPopup) {
//    browser.browserAction.openPopup();
//  }
//});

// simplewebext userAgent=firefox
{
  console.log('firefox');
}

// simplewebext userAgent=chrome
{
  console.log('chrome');
}

// simplewebext popup
simpleWebExt.onAfterInit(() => {
  return WebExtTest.send_limits_to_browser(simpleWebExt.type).then(() => {
    WebExtTest.test_browser();
  });
});

