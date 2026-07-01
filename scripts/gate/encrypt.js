// encrypt.js — wrap a plaintext HTML deck in a client-side AES-256-GCM password gate.
// The published file contains ONLY ciphertext + a Web Crypto decryptor. Nothing
// confidential is served in the clear. Matches browser crypto.subtle exactly
// (PBKDF2-SHA256 250k iters -> AES-256-GCM; ciphertext has the 16-byte tag appended).
//
// Usage: node encrypt.js <plaintext.html> <password> <out.html> "<deck title>"
"use strict";
const crypto = require("crypto");
const fs = require("fs");

const [, , srcFile, password, outFile, titleArg] = process.argv;
if (!srcFile || !password || !outFile) {
  console.error("usage: node encrypt.js <plaintext.html> <password> <out.html> [title]");
  process.exit(1);
}
const ITER = 250000;
const plain = fs.readFileSync(srcFile);
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(password, salt, ITER, 32, "sha256");
const c = crypto.createCipheriv("aes-256-gcm", key, iv);
const ct = Buffer.concat([c.update(plain), c.final()]);
const payload = Buffer.concat([ct, c.getAuthTag()]).toString("base64"); // ct||tag for Web Crypto
const title = (titleArg || "Protected deck").replace(/</g, "&lt;");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="robots" content="noindex,nofollow">
<style>
  :root{--blue:#2929E2;--ink:#26262B;--paper:#F4F4F4}
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{font-family:"DM Sans",system-ui,-apple-system,sans-serif;background:var(--paper);color:var(--ink);
       display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{width:min(92vw,380px);text-align:center;padding:36px 32px}
  .bar{height:8px;background:var(--blue);border-radius:4px;width:56px;margin:0 auto 28px}
  h1{font-size:20px;font-weight:700;margin:0 0 6px}
  p{font-size:14px;color:#7F7F7F;margin:0 0 22px;line-height:1.5}
  input{width:100%;padding:12px 14px;font-size:15px;border:1px solid #D9D6DB;border-radius:8px;outline:none}
  input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(41,41,226,.18)}
  button{width:100%;margin-top:12px;padding:12px 14px;font-size:15px;font-weight:600;color:#fff;
         background:var(--blue);border:0;border-radius:8px;cursor:pointer}
  button:disabled{opacity:.6;cursor:default}
  .err{color:#F43A2C;font-size:13px;margin-top:12px;min-height:16px}
</style></head>
<body>
  <form class="card" id="f" autocomplete="off">
    <div class="bar"></div>
    <h1>${title}</h1>
    <p>This deck is password-protected. Enter the password you were given to view it.</p>
    <input id="pw" type="password" placeholder="Password" autofocus>
    <button id="go" type="submit">View deck</button>
    <div class="err" id="err"></div>
  </form>
  <script>
    const SALT="${salt.toString("base64")}", IV="${iv.toString("base64")}", CT="${payload}", ITER=${ITER};
    const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
    async function unlock(pw){
      const enc=new TextEncoder();
      const base=await crypto.subtle.importKey("raw",enc.encode(pw),"PBKDF2",false,["deriveKey"]);
      const key=await crypto.subtle.deriveKey(
        {name:"PBKDF2",salt:b64(SALT),iterations:ITER,hash:"SHA-256"},
        base,{name:"AES-GCM",length:256},false,["decrypt"]);
      const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64(IV)},key,b64(CT));
      return new TextDecoder().decode(pt);
    }
    document.getElementById("f").addEventListener("submit",async e=>{
      e.preventDefault();
      const err=document.getElementById("err"), go=document.getElementById("go");
      err.textContent=""; go.disabled=true; go.textContent="Unlocking\\u2026";
      try{
        const doc=await unlock(document.getElementById("pw").value);
        // Render the decrypted deck in an isolated iframe (executes the deck's
        // scripts; relative asset paths resolve against this page's URL).
        const frame=document.createElement("iframe");
        frame.setAttribute("allow","fullscreen");
        frame.setAttribute("title",${JSON.stringify(title)});
        frame.style.cssText="position:fixed;inset:0;width:100%;height:100%;border:0;margin:0";
        document.body.replaceChildren(frame);
        frame.srcdoc=doc;
      }catch(_){ err.textContent="Wrong password. Try again."; go.disabled=false; go.textContent="View deck"; }
    });
  </script>
</body></html>`;
fs.writeFileSync(outFile, html);
console.log("gated:", outFile);
