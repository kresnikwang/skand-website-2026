const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync(require.resolve('../scripts/share/wechat.js'),'utf8');
async function setup({ua='Safari',endpoint='/api/wechat/signature',fail=false,attrs={}}={}) {
  const metas=new Map(),events={},calls={fetch:[],config:[],friends:[],timeline:[],warnings:[]};
  const documentElement={lang:'en',getAttribute:name=>attrs[name]??null};
  const document={documentElement,querySelector:selector=>{
    if(selector==='meta[name="wechat-share-endpoint"]')return {content:endpoint};
    if(!metas.has(selector))metas.set(selector,{content:''});return metas.get(selector);
  }};
  const wx={config:c=>calls.config.push(c),ready:cb=>cb(),error:()=>{},updateAppMessageShareData:d=>calls.friends.push(d),updateTimelineShareData:d=>calls.timeline.push(d)};
  const location={href:'https://skandstudio.com/?from=singlemessage#work'};
  const window={wx,addEventListener:(name,cb)=>{events[name]=cb;}};
  const sandbox={document,window,location,navigator:{userAgent:ua},WECHAT_ENTRY_URL:location.href.split('#')[0],console:{warn:m=>calls.warnings.push(m)},Promise,AbortController,setTimeout,clearTimeout,
    fetch:async(url,options)=>{calls.fetch.push(JSON.parse(options.body).url);return {ok:!fail,json:async()=>({appId:'public-app-id',timestamp:1770000000,nonceStr:'nonce',signature:'a'.repeat(40)})};}
  };
  vm.runInNewContext(code,sandbox);await new Promise(setImmediate);
  return {calls,document,documentElement,metas,events,location};
}
test('a page with data-share-* attributes shares its own title, copy, link and image',async()=>{
  const s=await setup({ua:'Android MicroMessenger',attrs:{
    'data-share-title-zh':'梵高世界｜走进梵高的画布','data-share-desc-zh':'可以走进去的世界。',
    'data-share-link':'https://skandstudio.com/play/','data-share-image':'https://skandstudio.com/images/share/vgworld-cover-v1.jpg'}});
  s.documentElement.lang='zh-CN';await s.events['skand:lang']();
  const friend=s.calls.friends.at(-1),timeline=s.calls.timeline.at(-1);
  assert.equal(friend.title,'梵高世界｜走进梵高的画布');assert.equal(friend.desc,'可以走进去的世界。');
  assert.equal(friend.link,'https://skandstudio.com/play/');assert(friend.imgUrl.endsWith('vgworld-cover-v1.jpg'));
  assert.equal(timeline.link,'https://skandstudio.com/play/');
  assert.equal(s.metas.get('meta[property="og:title"]').content,'梵高世界｜走进梵高的画布');
  assert.equal(s.metas.get('meta[property="og:url"]').content,'https://skandstudio.com/play/');
});
test('ordinary browsers update metadata without fetching WeChat configuration',async()=>{
  const s=await setup();assert.equal(s.calls.fetch.length,0);assert.equal(s.metas.get('meta[property="og:title"]').content,'SKAND｜Create For More');
});
test('WeChat remains dormant until the account endpoint is enabled',async()=>{
  const s=await setup({ua:'MicroMessenger',endpoint:''});assert.equal(s.calls.fetch.length,0);assert.equal(s.calls.config.length,0);
});
test('WeChat configures friend and timeline payloads, without a timeline description',async()=>{
  const s=await setup({ua:'Android MicroMessenger'});assert.equal(s.calls.fetch[0],'https://skandstudio.com/?from=singlemessage');assert.equal(s.calls.config.length,1);
  assert.equal(s.calls.friends[0].link,'https://skandstudio.com/?lang=en');assert(s.calls.friends[0].desc);assert(!('desc' in s.calls.timeline[0]));assert(s.calls.timeline[0].imgUrl.endsWith('wechat-cover-v1.jpg'));
});
test('iOS keeps entry URL signature while language changes the shared link',async()=>{
  const s=await setup({ua:'iPhone MicroMessenger'});s.document.documentElement.lang='zh';s.location.href='https://skandstudio.com/?lang=zh#work';await s.events['skand:lang']();
  assert.equal(s.calls.fetch.length,1);assert.equal(s.calls.timeline.at(-1).link,'https://skandstudio.com/?lang=zh');assert(s.calls.friends.at(-1).desc.includes('上海'));
});
test('Android signs the new URL after language changes',async()=>{
  const s=await setup({ua:'Android MicroMessenger'});s.document.documentElement.lang='zh';s.location.href='https://skandstudio.com/?lang=zh#work';await s.events['skand:lang']();assert.equal(s.calls.fetch.at(-1),'https://skandstudio.com/?lang=zh');assert.equal(s.calls.config.length,2);
});
test('signature failure leaves metadata usable and never initializes the SDK',async()=>{
  const s=await setup({ua:'MicroMessenger',fail:true});assert.equal(s.calls.config.length,0);assert.equal(s.calls.warnings.length,1);assert(s.metas.get('meta[property="og:title"]').content);
});
