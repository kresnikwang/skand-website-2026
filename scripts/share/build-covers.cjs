const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../..');
async function main() {
  const logo = await fs.readFile(path.join(root, 'logo_white.png'));

  const outfit = await fs.readFile(path.join(root, 'fonts/QGYyz_MVcBeNP4NjuGObqx1XmO1I4deyC4E.ttf'));
  const cormorant = await fs.readFile(path.join(root, 'fonts/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd58jDOjw.ttf'));
  const songti = await fs.readFile(path.join(root, 'fonts/songti-sc-black-share-subset.ttf'));
  const defs = `<style>@font-face{font-family:Outfit;src:url(data:font/ttf;base64,${outfit.toString('base64')})} @font-face{font-family:Cormorant;src:url(data:font/ttf;base64,${cormorant.toString('base64')})} @font-face{font-family:Songti;src:url(data:font/ttf;base64,${songti.toString('base64')})}</style>`;
  const mark = (x,y,w,h) => `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${logo.toString('base64')}"/>`;
  // The same central composition works at card size and as a small square icon.
  const square = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">${defs}<rect width="600" height="600" fill="#0a0a0a"/>${mark(70,76,460,178)}<text x="300" y="352" text-anchor="middle" fill="#e8563a" font-family="Cormorant,Georgia" font-style="italic" font-size="74">Create For More</text><path d="M110 414H490" stroke="#f0ede8" stroke-opacity=".2"/><text x="300" y="478" text-anchor="middle" fill="#f0ede8" font-family="Outfit,Arial" font-size="25" letter-spacing="2">skandstudio.com</text></svg>`;
  const landscape = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">${defs}<rect width="1200" height="630" fill="#0a0a0a"/>${mark(76,70,245,95)}<text x="76" y="310" fill="#f0ede8" font-family="Outfit,Arial" font-weight="700" font-size="128">CREATE</text><text x="76" y="464" fill="#e8563a" font-family="Cormorant,Georgia" font-style="italic" font-size="142">For More</text><text x="80" y="555" fill="#f0ede8" font-family="Outfit,Arial" font-size="24">and be seen by the world</text><text x="1124" y="555" text-anchor="end" fill="#f0ede8" font-family="Outfit,Arial" font-size="19">skandstudio.com</text></svg>`;
  // VG World share cover: the swirling sky of The Starry Night fills the square;
  // the lower third darkens to carry the title so it stays legible at thumbnail size.
  const starry = await sharp(path.join(root, 'scripts/share/src/starry-night.jpg'))
    .resize(600, 600, { fit: 'cover', position: 'top' }).jpeg({ quality: 90 }).toBuffer();
  const vgworld = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">${defs}
    <image width="600" height="600" href="data:image/jpeg;base64,${starry.toString('base64')}"/>
    <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#070b18" stop-opacity="0"/><stop offset=".5" stop-color="#070b18" stop-opacity=".62"/>
      <stop offset="1" stop-color="#070b18" stop-opacity=".96"/></linearGradient></defs>
    <rect x="0" y="260" width="600" height="340" fill="url(#fade)"/>
    <text x="48" y="476" fill="#f2c14e" font-family="Songti,serif" font-size="96" letter-spacing="6">梵高世界</text>
    <text x="50" y="522" fill="#e8e2cf" font-family="Cormorant,Georgia" font-style="italic" font-size="30" letter-spacing="7">STARRY WANDERER</text>
    <image x="50" y="548" width="118" height="30" href="data:image/png;base64,${logo.toString('base64')}"/>
    <text x="552" y="572" text-anchor="end" fill="#9fb0d8" font-family="Outfit,Arial" font-size="17" letter-spacing="1">skandstudio.com/play</text>
  </svg>`;
  const out = path.join(root, 'images/share');
  await fs.mkdir(out,{recursive:true});
  for (const [name,svg] of [['wechat-cover-v1.jpg',square],['social-cover-v1.jpg',landscape],['vgworld-cover-v1.jpg',vgworld]]) {
    await sharp(Buffer.from(svg)).jpeg({quality:92,mozjpeg:true}).toFile(path.join(out,name));
    console.log(name,(await fs.stat(path.join(out,name))).size,'bytes');
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
