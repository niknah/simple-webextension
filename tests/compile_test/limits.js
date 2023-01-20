/* eslint-disable capitalized-comments */
/* globals browser */

import {SimpleWebExtensionUtil} from 'simple-webextension';


function isArrTrue(arr) {
  for (const row of arr) {
    if (row[1] !== true) {
      return false;
    }
  }
  return true;
}

function messageTests(webExtension, testObj, thisTest) {
  const arr = [];
  const text = `${webExtension.type} to ...`;
  function testTo(type, reply) {
    const mess = `${webExtension.type} to ${type} script`;
    if (webExtension[type]) {
      console.log(`${webExtension.type}: reply from ${type}.echo`, reply);
      if (reply) {
        console.log('reply.text', reply.text === text, 'reply.from', reply.from == type);
      }

      const ok = reply
        && reply.text === text && reply.from == type;
      arr.push([
        mess,
        ok
      ]);
    } else {
      arr.push([mess, 'N/A']);
    }
    return null;
  }

  const arg1 = 'a1', arg2 = 'a2';

  function addThisResult(scriptType, newThis, result) {
    const mess = `Passing this to ${scriptType}`;
    if(result) {
      const argOk = result.arg1 == arg1
        && result.arg2 == arg2;
      arr.push([mess,
        argOk && newThis.changed == 1 && result.from == scriptType
      ]);
    } else {
      arr.push([mess, 'N/A']);
    }
  }

  return thisTest.this_background(arg1, arg2)
  .then((result) => addThisResult('background', thisTest, result)
  ).then(() =>  thisTest.this_browser(arg1, arg2)
  ).then((result) => addThisResult('browser', thisTest, result)
  ).then(() => thisTest.this_content(arg1, arg2)
  ).then((result) => addThisResult('content', thisTest, result)
  ).then(() => thisTest.this_popup(arg1, arg2)
  ).then((result) => addThisResult('popup', thisTest, result)
  ).then(() => thisTest.this_options(arg1, arg2)
  ).then((result) => addThisResult('options', thisTest, result)
  ).then(() => testObj.echo_background({text})
  ).then((reply) => testTo('background', reply)
  ).then(() => testObj.echo_browser({text})
  ).then((reply) => testTo('browser', reply)
  ).then(() => testObj.echo_content({text})
  ).then((reply) => testTo('content', reply)
  ).then(() => testObj.echo_options({text})
  ).then((reply) => testTo('options', reply)
  ).then(() => testObj.echo_popup({text})
  ).then((reply) => testTo('popup', reply)
  ).then(() => arr
  );
}

// eslint-disable-next-line no-unused-vars
export async function windowLimits(webExtension, testObj, thisTest) {
  const arr = [];
  //  arr.push(['document', document !== undefined]);
  //  arr.push(['window', window !== undefined]);
  try {
    arr.push(['window.??? variables', window.webExtensionBrowser !== undefined]);
  } catch {
    arr.push(['window.??? variables', false]);
  }

  try {
    arr.push(['browser', browser !== undefined]);
  } catch {
    arr.push(['browser', false]);
  }

  var browserChrome = null;
  try {
    browserChrome = await SimpleWebExtensionUtil.getBrowser();
    arr.push(['browser/chrome.browserAction', browserChrome.browserAction !== undefined]);
  } catch {
    arr.push(['browser/chrome.browserAction', false]);
  }

  arr.push(['browser/chrome.tabs', (browserChrome && browserChrome.tabs) ? true : false]);

  try {
    //    const tab = await browser.tabs.getCurrent();
    const tab = await browser.tabs
      .query({
        currentWindow: true,
        active: true,
      })
      .then(async tabs => tabs[0]);
    if (tab) {
      await browser.tabs.sendMessage(tab.id, {fromLimits: true, test: true});
      arr.push(['browser.tabs.sendMessage to active tab', true]);
    }
  } catch {
    arr.push(['browser.tabs.sendMessage to active tab', false]);
  }

  var activeWindow = null;
  try {
    activeWindow = await SimpleWebExtensionUtil.getActiveWindow();
    arr.push(['get active window', activeWindow ? true : false]);
  } catch(e) {
    arr.push(['get active window', false]);
  }

  try {
    // Chrome background.js has no access to document, firefox is ok.
    arr.push(['document', (document) ? true : false]);

    try {
      arr.push(['options.html', (document && document.getElementById('optionsDiv')) ? true : false]);
      arr.push(['popup.html', (document && document.getElementById('popupDiv')) ? true : false]);
    // eslint-disable-next-line no-empty
    } catch(e) {
    }

  } catch(e) {
    arr.push(['document', 'N/A']);
  }

//  arr.push([
//    'active window.addEventListener',
//    (activeWindow && activeWindow.addEventListener) ? true : false
//  ]);


  const messagesArr = await messageTests(webExtension, testObj, thisTest);
  const messagesOk = isArrTrue(messagesArr);
  messagesArr.push(['Messages', messagesOk? true : 'X']);

  return arr.concat(messagesArr);
}

