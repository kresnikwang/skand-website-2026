/* Share metadata works everywhere. WeChat SDK activation requires a configured
   same-origin signing endpoint backed by the owner's official account. */
(() => {
  'use strict';
  const entryUrl = typeof WECHAT_ENTRY_URL === 'string' ? WECHAT_ENTRY_URL : location.href.split('#')[0];
  const inWeChat = /MicroMessenger/i.test(navigator.userAgent);
  const onIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const endpoint = document.querySelector('meta[name="wechat-share-endpoint"]')?.content;
  /* ?sharedebug=1 prints every step of the WeChat handshake on the page so a
     real-device failure can be read straight off the screen. */
  const debugOn = /[?&]sharedebug=1/.test(location.search);
  const log = debugOn ? (line) => {
    let box = document.getElementById('share-debug');
    if (!box) {
      box = document.createElement('pre');
      box.id = 'share-debug';
      box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;max-height:60vh;overflow:auto;margin:0;padding:10px 12px;background:rgba(0,0,0,.86);color:#9f9;font:11px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all;';
      document.body.appendChild(box);
    }
    box.textContent += new Date().toISOString().slice(11, 19) + '  ' + line + '\n';
  } : () => {};
  let sdkPromise, generation = 0, configuredUrl = '', ready = false, pending;

  function data() {
    const language = /^zh\b/i.test(document.documentElement.lang || '') ? 'zh' : 'en';
    /* Pages can declare their own share (e.g. the game) via data-share-* on <html>.
       Otherwise fall back to the agency homepage copy. */
    const root = document.documentElement;
    const pick = (name, fallback) => root.getAttribute('data-share-' + name + '-' + language)
      || root.getAttribute('data-share-' + name) || fallback;
    const page = {
      title: pick('title', ''),
      desc: pick('desc', ''),
      link: pick('link', ''),
      image: pick('image', '')
    };
    if (page.title && page.desc) {
      return {
        title: page.title,
        desc: page.desc,
        link: page.link || location.href.split('#')[0],
        imgUrl: page.image || 'https://skandstudio.com/images/share/wechat-cover-v1.jpg'
      };
    }
    return {
      title: 'SKAND｜Create For More',
      desc: language === 'zh'
        ? '上海独立创意机构，让世界看见你的光芒。探索品牌整合营销、产品、数字体验、设计与消费者连接作品。'
        : 'Independent creative agency in Shanghai. Explore our work in Brand IMC, Product, Digital, Design and Consumer experiences.',
      link: 'https://skandstudio.com/?lang=' + language,
      imgUrl: 'https://skandstudio.com/images/share/wechat-cover-v1.jpg'
    };
  }
  function paintMetadata() {
    const share = data();
    for (const [selector, value] of [
      ['meta[property="og:title"]', share.title],
      ['meta[property="og:description"]', share.desc],
      ['meta[property="og:url"]', share.link],
      ['meta[name="twitter:title"]', share.title],
      ['meta[name="twitter:description"]', share.desc]
    ]) {
      const meta = document.querySelector(selector);
      if (meta) meta.content = value;
    }
  }
  function loadSdk() {
    if (window.wx) return Promise.resolve(window.wx);
    if (sdkPromise) return sdkPromise;
    sdkPromise = (async () => {
      for (const host of ['res.wx.qq.com', 'res2.wx.qq.com']) {
        try {
          log('SDK load: ' + host);
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const timer = setTimeout(() => { script.remove(); reject(new Error('SDK timeout')); }, 6000);
            script.src = 'https://' + host + '/open/js/jweixin-1.6.0.js';
            script.async = true;
            script.onload = () => { clearTimeout(timer); window.wx ? resolve() : reject(new Error('SDK unavailable')); };
            script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('SDK unavailable')); };
            document.head.appendChild(script);
          });
          log('SDK loaded, wx=' + typeof window.wx);
          return window.wx;
        } catch (error) { log('SDK failed: ' + error.message); }
      }
      log('SDK unavailable on both CDNs');
      throw new Error('SDK unavailable');
    })();
    return sdkPromise;
  }
  function applyShare() {
    if (!ready || !window.wx) return;
    const share = data();
    log('applyShare: ' + JSON.stringify(share));
    try {
      window.wx.updateAppMessageShareData({ ...share,
        success: r => log('friend share set OK ' + (r && r.errMsg)),
        fail: r => log('friend share set FAIL ' + JSON.stringify(r)) });
      window.wx.updateTimelineShareData({ title: share.title, link: share.link, imgUrl: share.imgUrl,
        success: r => log('timeline share set OK ' + (r && r.errMsg)),
        fail: r => log('timeline share set FAIL ' + JSON.stringify(r)) });
    } catch (error) { log('applyShare threw: ' + error.message); }
  }
  async function configure() {
    paintMetadata();
    log('configure: inWeChat=' + inWeChat + ' iOS=' + onIOS + ' endpoint=' + endpoint);
    if (!inWeChat || !endpoint) return;
    const url = onIOS ? entryUrl : location.href.split('#')[0];
    log('signing url: ' + url);
    if (ready && configuredUrl === url) { applyShare(); return; }
    const current = ++generation;
    pending?.abort();
    pending = new AbortController();
    const controller = pending;
    const timeout = setTimeout(() => controller.abort(), 8000);
    ready = false;
    try {
      log('POST ' + endpoint);
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }), signal: controller.signal, credentials: 'same-origin'
      });
      log('signature HTTP ' + response.status);
      if (!response.ok) throw new Error('Signature unavailable');
      const signature = await response.json();
      log('signature: appId=' + signature.appId + ' timestamp=' + signature.timestamp + ' nonceStr=' + signature.nonceStr + ' sig=' + signature.signature);
      if (!signature.appId || !Number.isInteger(signature.timestamp) || !signature.nonceStr || !/^[a-f0-9]{40}$/.test(signature.signature)) {
        throw new Error('Invalid signature response');
      }
      const wx = await loadSdk();
      if (current !== generation) return;
      log('wx.config appId=' + signature.appId);
      wx.config({ debug: false, appId: signature.appId, timestamp: signature.timestamp,
        nonceStr: signature.nonceStr, signature: signature.signature,
        jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData'] });
      wx.ready(() => {
        if (current !== generation) return;
        log('wx.ready OK');
        configuredUrl = url; ready = true; applyShare();
      });
      wx.error(res => {
        if (current !== generation) return;
        log('wx.error ' + JSON.stringify(res));
        ready = false;
        console.warn('[SKAND share] WeChat account/domain verification failed.');
      });
    } catch (error) {
      log('FAILED: ' + (error && error.message));
      if (current === generation && error.name !== 'AbortError') {
        console.warn('[SKAND share] Custom WeChat sharing is unavailable; page remains usable.');
      }
    } finally { clearTimeout(timeout); }
  }
  window.addEventListener('skand:lang', configure);
  window.addEventListener('popstate', configure);
  configure();
})();
