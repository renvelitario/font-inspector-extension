const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const browser = spawn(process.argv[2] || process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'font-inspector-test-'))}`, 'about:blank'
], { windowsHide: true });
let socket;
const timeout = setTimeout(() => { browser.kill(); process.exit(1); }, 45000);

(async () => {
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    browser.on('error', reject);
    browser.on('exit', code => reject(new Error('Browser exited: ' + code + '\n' + output)));
    browser.stderr.on('data', chunk => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
  });
  console.log('Browser started');
  socket = new WebSocket(endpoint);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const handler = pending.get(message.id);
    if (handler) {
      pending.delete(message.id);
      message.error ? handler.reject(message.error) : handler.resolve(message.result);
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await call('Page.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.testWindow = { id: 1, width: 480, type: 'popup', state: 'normal' };
    window.updates = [];
    window.copiedValues = [];
    window.savedFonts = [{
      id: 'saved-1',
      name: 'Homepage Body',
      savedAt: '2026-09-06T00:00:00.000Z',
      source: { title: 'Example page', url: 'https://example.com' },
      elementName: 'p',
      sampleText: 'Good typography starts with the details.',
      typography: {
        fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '16px', fontWeight: '400',
        fontStyle: 'normal', lineHeight: '24px', letterSpacing: '0px', color: '#242628',
        backgroundColor: 'transparent', textAlign: 'left', textTransform: 'none', textDecorationLine: 'none'
      }
    }];
    window.prompt = () => 'Body Text';
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async value => { window.copiedValues.push(value); } },
      configurable: true
    });
    window.chrome = {
      storage: {
        session: { get: async () => ({ fontInspectorLatestInspection: {
          ok: true, selectedText: 'Good typography starts with the details.',
          source: { title: 'Example page', url: 'https://example.com' },
          styles: [{ elementName: 'p', typography: {
            fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '16px', fontWeight: '400',
            fontStyle: 'normal', lineHeight: '24px', letterSpacing: '0px', color: '#242628',
            backgroundColor: 'transparent', textAlign: 'left', textTransform: 'none', textDecorationLine: 'none'
          } }]
        } }) },
        local: {
          get: async key => ({ [key]: window.savedFonts }),
          set: async data => {
            if (data.fontInspectorSavedFonts) window.savedFonts = data.fontInspectorSavedFonts;
          }
        },
        onChanged: { addListener: () => {} }
      },
      windows: {
        getCurrent: async () => { if (window.fail) throw Error('test'); return { ...window.testWindow }; },
        update: async (id, data) => { window.updates.push(data); Object.assign(window.testWindow, data); }
      }
    };
  ` });
  await call('Page.navigate', { url: pathToFileURL(resolve('src/window/inspector.html')).href });
  await evaluate(`new Promise(resolve => {
    const timer = setInterval(() => { if (document.querySelector('dd')) { clearInterval(timer); resolve(); } }, 20);
  })`);
  assert.equal(await evaluate(`Promise.all([...document.querySelectorAll('img')].map(img => img.decode())).then(() => document.querySelectorAll('img').length)`), 17);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.font-inspector-window__section-icon')].map(img => img.getAttribute('src'))`), [
    '../icons/Font.svg',
    '../icons/Color.svg',
    '../icons/Format.svg'
  ]);
  assert.equal(await evaluate(`document.querySelectorAll('.font-inspector-window__panel-header button').length`), 2);
  assert.equal(await evaluate(`document.querySelectorAll('.font-inspector-window__property-list button').length`), 11);
  assert.deepEqual(await evaluate(`(async () => {
    document.querySelector('.font-inspector-window__save-button').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    return [window.savedFonts.length, window.savedFonts[0].name, window.savedFonts[0].typography.fontSize];
  })()`), [2, 'Body Text', '16px']);
  assert.equal(await evaluate(`(async () => {
    const button = document.querySelector('.font-inspector-window__property-list button');
    button.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    return window.copiedValues.at(-1);
  })()`), 'Arial, Helvetica, sans-serif');
  assert.equal(await evaluate(`document.querySelector('.font-inspector-window__property-list button').classList.contains('font-inspector-window__icon-button--pressed')`), true);
  await evaluate(`new Promise(resolve => setTimeout(resolve, 1200))`);
  assert.equal(await evaluate(`document.querySelectorAll('.font-inspector-window__copy-button--copied, .font-inspector-window__copy-button--failed').length`), 0);
  for (const width of [220, 280, 360, 380, 480, 720, 1100]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false });
    const dimensions = await evaluate(`({ viewport: innerWidth, content: document.documentElement.scrollWidth,
      font: getComputedStyle(document.body).fontFamily })`);
    assert.ok(dimensions.content <= dimensions.viewport, JSON.stringify(dimensions));
    assert.ok(dimensions.font.includes('Arial') || dimensions.font.includes('system-ui'));
    if (width === 380 || width === 480) {
      const { data } = await call('Page.captureScreenshot');
      writeFileSync(join(tmpdir(), 'font-inspector-' + width + '.png'), Buffer.from(data, 'base64'));
    }
  }
  await evaluate(`document.querySelector('dd span').textContent = 'LongFontFamily'.repeat(30)`);
  await call('Emulation.setDeviceMetricsOverride', { width: 280, height: 800, deviceScaleFactor: 1, mobile: false });
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  for (const [width, state, expected] of [[250, 'normal', 380], [950, 'normal', 720], [500, 'normal', 500], [1100, 'maximized', 1100], [1100, 'fullscreen', 1100]]) {
    const actual = await evaluate(`(async () => {
      Object.assign(testWindow, { width: ${width}, state: '${state}' });
      dispatchEvent(new Event('resize'));
      await new Promise(resolve => setTimeout(resolve, 250));
      return testWindow.width;
    })()`);
    assert.equal(actual, expected);
  }
  await evaluate(`(async () => {
    window.fail = true; dispatchEvent(new Event('resize'));
    await new Promise(resolve => setTimeout(resolve, 250));
    window.fail = false; Object.assign(testWindow, { width: 200, state: 'normal' });
    dispatchEvent(new Event('resize'));
    await new Promise(resolve => setTimeout(resolve, 250));
  })()`);
  assert.equal(await evaluate('testWindow.width'), 380);
  await call('Page.navigate', { url: pathToFileURL(resolve('src/popup/index.html')).href });
  await evaluate(`new Promise(resolve => {
    const timer = setInterval(() => { if (document.querySelector('.font-inspector-popup__card')) { clearInterval(timer); resolve(); } }, 20);
  })`);
  assert.equal(await evaluate(`document.querySelector('.font-inspector-popup__header h1').textContent`), 'Saved Fonts');
  assert.equal(await evaluate(`document.querySelectorAll('.font-inspector-popup__card').length`), 1);
  assert.equal(await evaluate(`document.querySelectorAll('.font-inspector-popup__property-list button').length`), 11);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.font-inspector-popup__section-icon')].map(img => img.getAttribute('src'))`), [
    '../icons/Font.svg',
    '../icons/Color.svg',
    '../icons/Format.svg'
  ]);
  assert.equal(await evaluate(`(async () => {
    const button = document.querySelector('.font-inspector-popup__property-list button');
    button.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    return window.copiedValues.at(-1);
  })()`), 'Arial, Helvetica, sans-serif');
  await call('Emulation.setDeviceMetricsOverride', { width: 400, height: 800, deviceScaleFactor: 1, mobile: false });
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  assert.ok(await evaluate(`document.body.getBoundingClientRect().width >= 400`));
  {
    const { data } = await call('Page.captureScreenshot');
    writeFileSync(join(tmpdir(), 'font-inspector-popup-toolbar.png'), Buffer.from(data, 'base64'));
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 900, height: 800, deviceScaleFactor: 1, mobile: false });
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  assert.ok(await evaluate(`document.querySelector('.font-inspector-popup').getBoundingClientRect().width <= 720`));
  {
    const { data } = await call('Page.captureScreenshot');
    writeFileSync(join(tmpdir(), 'font-inspector-popup.png'), Buffer.from(data, 'base64'));
  }
  assert.deepEqual(await evaluate(`(async () => {
    document.querySelector('.font-inspector-popup__delete-button').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    return [window.savedFonts.length, document.querySelector('.font-inspector-popup__empty').textContent];
  })()`), [0, 'No saved fonts yet.']);
  console.log('Passed: save font, toolbar popup, row copy buttons, press animation, seven viewport widths, Arial, min/max bounds, maximize/fullscreen, API error recovery. Screenshots in ' + tmpdir());
  await send('Browser.close');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  clearTimeout(timeout);
  socket?.close();
  browser.kill();
});
