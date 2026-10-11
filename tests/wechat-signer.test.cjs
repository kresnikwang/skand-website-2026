const test = require('node:test');
const assert = require('node:assert/strict');
const { signatureFor, createSigner, validateUrl, createHandler } = require('../server/wechat/signer.cjs');
const { createServer } = require('node:http');
test('matches the official JS-SDK signature example', () => {
  assert.equal(signatureFor('sM4AOVdWfPE4DxkXGEs8VMCPGGVi4C3VM0P37wVUCFvkVAy_90u5h9nbSlYy3-Sl-HhTdfl2fzFy1AOcHKP7qg', 'Wm3WZYTPz0wzccnW', 1414587457, 'http://mp.weixin.qq.com?params=value'), '0f9de62fce790f9a083d5c99e95740ceb90c27ed');
});
test('rejects foreign, insecure and non-homepage URLs; preserves query bytes', () => {
  for (const url of ['https://skandstudio.com.evil.test/', 'http://skandstudio.com/', 'https://user@skandstudio.com/', 'https://skandstudio.com:8888/', 'https://skandstudio.com/private', 'https://skandstudio.com/#work', 'https://skandstudio.com/\n']) assert.throws(()=>validateUrl(url));
  const url='https://skandstudio.com/?lang=zh&from=singlemessage&x=%2f';assert.equal(validateUrl(url),url);
});
test('coalesces concurrent token/ticket requests and refreshes before expiry', async () => {
  let calls=[],time=1000000;
  const signer=createSigner({appId:'test-id',appSecret:'test-secret',now:()=>time,fetchImpl:async url=>{
    calls.push(url);return {ok:true,json:async()=>url.includes('stable_token')?{access_token:'private-token',expires_in:7200}:{ticket:'private-ticket',expires_in:7200}};
  }});
  const results=await Promise.all(Array.from({length:20},()=>signer('https://skandstudio.com/?lang=en')));
  assert.equal(calls.length,2);assert.equal(new Set(results.map(r=>r.nonceStr)).size,20);
  assert.equal(results[0].signature,signatureFor('private-ticket',results[0].nonceStr,results[0].timestamp,'https://skandstudio.com/?lang=en'));
  assert(!JSON.stringify(results).includes('private-'));time+=7000*1000;await signer('https://skandstudio.com/?lang=zh');assert.equal(calls.length,4);
});
test('unconfigured signer makes no upstream requests',async()=>{
  let calls=0;const signer=createSigner({fetchImpl:async()=>{calls++;}});
  await assert.rejects(signer('https://skandstudio.com/'));assert.equal(calls,0);
});
test('HTTP errors never expose credentials or upstream details', async t => {
  const server=createServer(createHandler(async()=>{throw Error('private-ticket secret');}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/wechat/signature',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://skandstudio.com/'})});
  assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(await response.text(),'{"error":"Sharing configuration unavailable"}');
});
