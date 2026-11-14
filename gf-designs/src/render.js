const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:2000}});
for(const file of ['artes.html','artes-pos.html']){await p.goto('file://'+path.join(__dirname,file));await p.evaluate(()=>document.fonts.ready);
const ids=await p.$$eval('.art',a=>a.map(x=>x.id));
for(const id of ids){await (await p.$('[id="'+id+'"]')).screenshot({path:path.join(__dirname,'..',id+'.png')});console.log(id);}
}await b.close();})();
