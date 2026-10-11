# SKAND WeChat sharing setup

## Prepared
- Square WeChat cover: images/share/wechat-cover-v1.jpg, 600 × 600 JPEG (~26 KB).
- Landscape Twitter cover: images/share/social-cover-v1.jpg, 1200 × 630 JPEG (~37 KB).
- Title: SKAND｜Create For More.
- Chinese friend description: 上海独立创意机构，让世界看见你的光芒。探索品牌整合营销、产品、数字体验、设计与消费者连接作品。
- English friend description follows the site's selected language.
- Timeline uses title/link/image only, per the official API; it has no independent description field.
- scripts/share/wechat.js updates ordinary metadata. With an empty wechat-share-endpoint meta value, SDK loading and signature requests remain disabled.
- Private signer and automated tests are prepared; the private service is deployed; client activation awaits the owner’s platform configuration.

## Required owner configuration
1. Confirm an official account with the necessary JS-SDK share API permissions (check its developer interface permissions; the current official docs describe service accounts).
2. Add skandstudio.com under JS接口安全域名. If a domain verification file is issued, place that exact supplied file at the website root and verify its URL before completing the platform setting.
3. Add server outbound IP 123.57.167.97 to the account API IP whitelist (verify outbound IP during activation).
4. Configure WECHAT_APP_ID and WECHAT_APP_SECRET privately on the server, outside the web root. Do not paste the AppSecret into chat or commit it. Use a protected environment file (owner read only), e.g. /etc/skand/wechat.env.
5. Install server/wechat/signer.cjs under /opt/skand-wechat, never under /opt/1panel/www/wwwroot. The normal static deploy excludes server/ and tests/.
6. Run the signer using Node 22 under a dedicated service account/systemd unit, bound to 127.0.0.1:8790. Keep one process so its token and ticket caches are shared.
7. Configure an exact /api/wechat/signature reverse proxy in 1Panel OpenResty to the private service. The Docker container's network must be checked; do not assume container localhost reaches the host. Apply body/request limits and a rate limit, test nginx configuration, then reload the container.
8. After a real signature request succeeds, set the homepage meta wechat-share-endpoint to /api/wechat/signature and deploy. No secret belongs in index.html or client JavaScript.
9. Test on real iOS/Android WeChat: open the site directly and through forwarded URLs, share to a friend, then Moments, change languages, and confirm the image/title/link in the compose UI. Do not publish a test Moment or send a message without explicit owner authorization. Ordinary browser tests do not establish real WeChat success.

## Implementation verification
Run node --test tests/wechat-signer.test.cjs tests/wechat-client.test.cjs.
Signer tests cover the official SHA-1 example, exact URL preservation, restricted origins/paths, token/ticket cache concurrency and expiry, absent credentials and sanitized HTTP errors. Client tests cover a dormant endpoint, non-WeChat browsing, iOS entry URLs, Android URL changes, payload differences and failures.

Official documentation: https://developers.weixin.qq.com/doc/service/guide/h5/jssdk.html
SDK: https://res.wx.qq.com/open/js/jweixin-1.6.0.js

## Current limit
A cover and ordinary HTML metadata alone cannot guarantee a customized WeChat card. Activation and real-device validation await the owner's account configuration. Existing shares may retain cached previews; test a newly opened page and a fresh share.


## 2026-10-10 activation progress
- Owner supplied AppID/AppSecret in the protected local file; credentials validated and transferred via SSH stdin to /etc/skand/wechat.env (root, mode 600). No secret values are recorded in this repository or public output.
- Verification file MP_verify_Pxe6ckJpC8ebgtFs.txt is installed at the website root. HTTP and HTTPS both return 200 and exactly match the supplied 16 bytes.
- skand-wechat.service is enabled and active under the dedicated skand-wechat account. Node listens only on 127.0.0.1:8790. Port 8787 already belongs to another service and was left alone.
- OpenResty uses host networking. Exact /api/wechat/signature proxy and rate limit are installed; nginx -t and reload succeeded. Foreign URLs and foreign Origin requests return 400/403 as expected.
- WeChat stable-token endpoint returned 40164 and identified outbound IP 123.57.167.97. Owner must add that IP to the official-account IP whitelist and finish saving the JS safe domain skandstudio.com.
- The browser endpoint meta remains empty until a real successful signature response is obtained. After the owner confirms platform settings, test a real signature, enable the meta, deploy, then validate share composition on WeChat devices.
- Proxy config backup: /opt/1panel/backups/skand/before-wechat-proxy-20261010.tar.gz. Private credentials are outside the web root. Verification file is included in ordinary site deployments to prevent accidental deletion.
