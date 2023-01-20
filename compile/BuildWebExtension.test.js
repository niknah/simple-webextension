
/* global test */
/* global expect */

//import {jest} from '@jest/globals'
import os from 'os';
import { ESLint } from 'eslint';
import {BuildWebExtension} from './BuildWebExtension.js';
import { chromium, firefox } from 'playwright';
import { connect } from '../node_modules/web-ext/lib/firefox/remote.js';
import path from 'path';
import fsPromises from 'node:fs/promises';




function testUserAgent(userAgent) {
  const headless = false;
  const buildDir = path.join(os.tmpdir(), 'BuildWebExtensionTest.'+Math.random());
  const userDataDir = `/tmp/test-user-data-dir-${userAgent}`;
  const eslint = new ESLint({
    overrideConfig: {
      "rules": {
        "no-unused-vars": "off",
        "no-empty": "off"
      },
      "globals": {
        "browser": "readonly",
        "chrome": "readonly"
      },
      "env": {
        es2022: true
      }
    }
  });

  return BuildWebExtension.compileFromDir(
    {
      srcDir: 'tests/compile_test', 
      buildDir
    }
  ).then(
    // check files are ok.
    () => eslint.lintFiles([buildDir + "/**/extension/*.js"])
  ).then(async (results) => {
    // 3. Format the results.
    const formatter = await eslint.loadFormatter("stylish");
    const resultText = formatter.format(results);

    // 4. Output it.
    expect(resultText).toBe('');
  }).then(async () => {
    const pathToExtension = buildDir + `/${userAgent}/extension`;
    let browser, browserContext;
    let blankPage = null;
    if (userAgent === 'chrome') {
      browser = await chromium.launchPersistentContext(userDataDir,{
        headless,
        args: [
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`
        ]
      });
      browserContext = browser;
    } else if (userAgent === 'firefox') {
      const RDP_PORT = 12345;


      await (async () => {
        browser = await firefox.launch({
          headless,
          args: [ '-start-debugger-server', String(RDP_PORT) ],
          firefoxUserPrefs: {
            'devtools.debugger.remote-enabled': true,
            'devtools.debugger.prompt-connection': false,
          }
        });

        const client = await connect(RDP_PORT);
//        const resp = 
        await client.installTemporaryAddon( pathToExtension);
        //console.log("Installed addon with ID", resp.addon.id);

        browserContext = await browser.newContext();
        blankPage = await browser.newPage();
        await blankPage.goto('https://dunno.com/blank.html');
//        await blankPage.goto('about:blank');

        // ...
      })();



    }

    return new Promise((resolve) => {
//      page.on('domcontentloaded', async () => {
        const a = async () => {
          try {
            let page = null;
            if(blankPage) {
              page = blankPage;
            } else {
              const pages = browserContext.pages();
//console.log('page',pages);
              for (const page1 of pages) {
                if (page1.url() === 'https://dunno.com/blank.html') {
                  page = page1;
                  break;
                }
              }
            }

            expect(page).not.toBeNull();

            const trs = page.locator('tr', {hasText: "Messages"});
            const cnt = await trs.count();

            expect(cnt).toBeGreaterThan(4);
            for (let i = 0; i < cnt; ++i) {
              const tr = await trs.nth(i);
              const tds = tr.locator('td');
              const tdsCount = await tds.count();
              expect(tdsCount).toBeGreaterThan(0);
              const lastTdDom = await tds.nth(tdsCount-1);
              const lastTd = await lastTdDom.innerText();
              expect(lastTd.valueOf()).toBe('true');
            }
          } catch(e) {
            console.error(e);
          } finally {
            await browser.close();
            await fsPromises.rm(buildDir, { recursive: true, force: true});
            await fsPromises.rm(userDataDir, { recursive: true, force: true});
          }
          return resolve();
        }
        setTimeout(() => {
          a();
        },8000);
//      });
    });

  });
}

test('test firefox', () => {
  return testUserAgent('firefox');
}, 15000);

test('test chrome', () => {
  return testUserAgent('chrome');
}, 15000);

