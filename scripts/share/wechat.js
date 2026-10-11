/* Share metadata works everywhere. WeChat SDK activation requires a configured
   same-origin signing endpoint backed by the owner's official account. */
(() => {
  'use strict';
  const entryUrl = typeof WECHAT_ENTRY_URL === 'string' ? WECHAT_ENTRY_URL : location.href.split('#')[0];
  const inWeChat = /MicroMessenger/i.test(navigator.userAgent);
  const onIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const endpoint = document.querySelector('meta[name="wechat-share-endpoint"]')?.content;
  let sdkPromise, generation = 0, configuredUrl = '', ready = false, pending;

  function data() {
    const language = document.documentElement.lang === 'zh' ? 'zh' : 'en';
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
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const timer = setTimeout(() => { script.remove(); reject(new Error('SDK timeout')); }, 6000);
            script.src = 'https://' + host + '/open/js/jweixin-1.6.0.js';
            script.async = true;
            script.onload = () => { clearTimeout(timer); window.wx ? resolve() : reject(new Error('SDK unavailable')); };
            script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('SDK unavailable')); };
            document.head.appendChild(script);
          });
          return window.wx;
        } catch (_) { /* Try the official secondary CDN. */ }
      }
      throw new Error('SDK unavailable');
    })();
    return sdkPromise;
  }
  function applyShare() {
    if (!ready || !window.wx) return;
    const share = data();
    window.wx.updateAppMessageShareData(share);
    window.wx.updateTimelineShareData({ title: share.title, link: share.link, imgUrl: share.imgUrl });
  }
  async function configure() {
    paintMetadata();
    if (!inWeChat || !endpoint) return;
    const url = onIOS ? entryUrl : location.href.split('#')[0];
    if (ready && configuredUrl === url) { applyShare(); return; }
    const current = ++generation;
    pending?.abort();
    pending = new AbortController();
    const controller = pending;
    const timeout = setTimeout(() => controller.abort(), 8000);
    ready = false;
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }), signal: controller.signal, credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('Signature unavailable');
      const signature = await response.json();
      if (!signature.appId || !Number.isInteger(signature.timestamp) || !signature.nonceStr || !/^[a-f0-9]{40}$/.test(signature.signature)) {
        throw new Error('Invalid signature response');
      }
      const wx = await loadSdk();
      if (current !== generation) return;
      wx.config({ debug: false, appId: signature.appId, timestamp: signature.timestamp,
        nonceStr: signature.nonceStr, signature: signature.signature,
        jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData'] });
      wx.ready(() => {
        if (current !== generation) return;
        configuredUrl = url; ready = true; applyShare();
      });
      wx.error(() => {
        if (current !== generation) return;
        ready = false;
        console.warn('[SKAND share] WeChat account/domain verification failed.');
      });
    } catch (error) {
      if (current === generation && error.name !== 'AbortError') {
        console.warn('[SKAND share] Custom WeChat sharing is unavailable; page remains usable.');
      }
    } finally { clearTimeout(timeout); }
  }
  window.addEventListener('skand:lang', configure);
  window.addEventListener('popstate', configure);
  configure();
})();
