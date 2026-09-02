import { chromium } from 'playwright'
import { createServer } from 'http'
import { readFileSync } from 'fs'
const html = readFileSync('/Users/sehajbirgrewal/AI Brain | Sehaj Personal/onyx-landing/index.html','utf8')
// Serve locally so localStorage has a real origin and nothing touches the live sheet.
const srv = createServer((req,res)=>{ res.writeHead(200,{'Content-Type':'text/html'}); res.end(html) }).listen(4599)
let fail=0
const check=(l,ok,d)=>{ if(ok){console.log('  ✓ '+l)} else {fail++;console.log('  ✗ FAIL: '+l+(d===undefined?'':'  → '+JSON.stringify(d)))} }
const b = await chromium.launch()
const ctx = await b.newContext()
const p = await ctx.newPage()
// Capture what the form would POST, without letting it out.
await p.route('**script.google.com**', route => {
  const req = route.request()
  if (req.method()==='POST') { globalThis.__posted = req.postData() }
  route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ok:true,count:42}) })
})
console.log('\nReferral capture\n')
await p.goto('http://localhost:4599/?ref=enrique')
const stored = await p.evaluate(()=>localStorage.getItem('onyx_ref'))
check('a ?ref= is remembered', !!stored && JSON.parse(stored).code==='enrique', stored)

// Come back later with NO ref - the whole reason to persist it.
await p.goto('http://localhost:4599/')
const after = await p.evaluate(()=>localStorage.getItem('onyx_ref'))
check('it survives a later visit with no ?ref', !!after && JSON.parse(after).code==='enrique')

// A second partner must not steal first-touch credit.
await p.goto('http://localhost:4599/?ref=someoneelse')
const ft = await p.evaluate(()=>JSON.parse(localStorage.getItem('onyx_ref')).code)
check('first touch wins over a later ref', ft==='enrique', ft)

// Junk is cleaned, not trusted into a spreadsheet.
const p2 = await (await b.newContext()).newPage()
await p2.goto('http://localhost:4599/?ref=%3Cscript%3Ealert(1)%3C/script%3E')
const cleaned = await p2.evaluate(()=>{const v=localStorage.getItem('onyx_ref');return v?JSON.parse(v).code:null})
check('a junk ref is stripped to safe characters', cleaned===null || /^[a-z0-9_-]*$/.test(cleaned), cleaned)

// The real thing: does it reach the payload?
await p.goto('http://localhost:4599/?ref=enrique&utm_campaign=call')
await p.waitForTimeout(1200)
const vis = await p.evaluate(()=>{const e=document.getElementById('wlName');const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return {w:r.width,h:r.height,display:cs.display,vis:cs.visibility,op:cs.opacity}})
console.log('  (wlName box:', JSON.stringify(vis), ')')
// Fill via the DOM and dispatch the events the page listens for: the fields sit
// inside a reveal-on-scroll wrapper that headless never triggers.
await p.evaluate(()=>{
  const set=(id,v)=>{const e=document.getElementById(id);
    const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(e,v);
    e.dispatchEvent(new Event('input',{bubbles:true}));
    e.dispatchEvent(new Event('change',{bubbles:true}));}
  set('wlName','Test Person'); set('wlBiz','Test Coatings')
  set('wlPhone','412345678'); set('wlEmail','test@realbusiness.com.au')
})
await p.evaluate(()=>document.getElementById('wlForm').requestSubmit())
await p.waitForTimeout(1500)
const posted = await p.evaluate(()=>window.__lastPost||null)
console.log('  (posted body captured by route:', globalThis.__posted ? 'yes' : 'no', ')')
const body = globalThis.__posted ? JSON.parse(globalThis.__posted) : null
check('the signup POST carries the ref', body && body.ref==='enrique', body)
check('and still carries name/email/phone/business', body && body.name && body.email && body.phone && body.business, body)
// The campaign belongs to the FIRST touch, so it has to be tested on a visitor
// whose first touch carried one. Asserting it on the page above was wrong: that
// browser first arrived on a plain ?ref=enrique, and overwriting the stored
// campaign later is exactly what first-touch must not do.
check('a later visit does NOT overwrite the first-touch campaign', !body.campaign, body.campaign)
const fresh = await (await b.newContext()).newPage()
await fresh.goto('http://localhost:4599/?ref=enrique&utm_campaign=call&utm_medium=dm')
const firstTouch = await fresh.evaluate(()=>JSON.parse(localStorage.getItem('onyx_ref')))
check('a fresh visitor records the campaign', firstTouch.campaign==='call', firstTouch)
check('and the medium', firstTouch.medium==='dm', firstTouch)
await b.close(); srv.close()
console.log(fail? `\n${fail} FAILED\n` : '\nAll referral checks passed.\n')
process.exit(fail?1:0)
