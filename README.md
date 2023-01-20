
### Simple web extensions

An easy way to call the different scripts in a web extension.


In a web browser extension there are things that you can do in some scripts but not other scripts.  This a way to easily access everything from one script.


| Can use? | Browser | Content | Background | Options | Popup |
| ------------- | ------------ | ----- | ----- | ----- | ----- |
| Non built-in window.* objects (jQuery, etc.) | Y | N | N | N | N |
| Browser / chrome objects | N | [Some](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts) | Y | Y | Y |
| Browser.tabs / chrome.tabs | N | N | Y | Y | Y |
| Options page | N | N | N | Y | N |
| Popup page | N | N | N | N | Y |



### Example

`npm i simple-webextension`

Save this as index.js...

```
class MyWebExtension {
    // This will run in the browser script...
    // simplewebext browser
    static inBrowser() {
        this.inBackground().then((tabsCount) => {
            document.body.appendChild(
                document.createTextNode(`Number of tabs opened: ${tabsCount}`)
            );
        });
    }

    // This will run in the background script...
    // simplewebext background
    static inBackground() {
        // browser / content scripts cannot access tabs
        return browser.tabs.query({}).then((tabs) => {
            return tabs.count;
        });
    }
}

// This will only run in the browser script...
// simplewebext browser
simpleWebExt.onAfterInit(() => {
    MyWebExtension.inBrowser();
});
```

Run `webext-cli index.js` to compile it.  The final extension will be built in the build/chrome/extension, build/firefox/extension directories.

The manifest.json file will be in the extension folder.


### extension/manifest.json

* There is a "userAgents" key in this file.  Change this to make browser specific settings.

### package.json

* Add any extra scripts to `"webextension": { "scripts": [] }`


### Restrictions

* It only supports top level static functions or class functions.  It won't process any functions declared with a variable.  

These WILL NOT work...
```
// simplewebext browser
// Will not run for functions that are assigned to a variable because we need to call it from another script.
xx = function() {}

// simplewebext browser
yy = () => {}

function zz() {
    // simplewebext browser
    // Will not run for functions that are not globally availble because we need to call it from another script.
    function ww() {
    }
}
```

* To use on multiple lines.  Surround it with `{}`
```
// simplewebext browser
{
    console.log('web browser only');
}
```


* All functions marked with `simplewebext`  will return a promise.

* When using non static class methods, it'll copy the `this` object transfer it to the object in the script and then send it back to the calling script.  


* DOM elements cannot be sent to different scripts.  This won't work...

```
// simplewebext browser
function get_browser_dom() {
    return document.body;
}

// simplewebext background
function dosomething(html) {
    get_browser_dom().innerHTML = html; // *** This will not work.  
}
```

Do what you need to do in the browser script instead, send what you need to the browser script and have that script do things to the DOM instead.
This works...
```
// simplewebext browser
function set_body(html) {
    document.body.innerHTML = html;
}

// simplewebext background
function dosomething(html) {
    set_body(html);
}
```


### What it does

* Any function or line you mark as `simplewebext xxx` will be executed in the script in 'xxx'.  Where 'xxx' can be one of browser, content, background, options, popup.

* The script will be split up into different files.  See the tests/compile_test/extension/manifest.json file to see how to enable these in your manifest files.

* Sending a message from a background script to a browser script will send a message to the active tab.  If you wish to send it to any other tab, use [browser.tabs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs).



### Other useful stuff...


