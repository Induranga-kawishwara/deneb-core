#!/usr/bin/env node
const q=require("node:crypto"),m=require("node:fs"),T=require("node:http"),h=require("node:path"),{spawn:$}=require("node:child_process"),ee=4174,te=4173,W=96*1024,ae=10*1024*1024,g="127.0.0.1",B="/__fivora_local_preview",ne=`(()=>{const m=["market","place"].join(""),O="__"+m.toUpperCase()+"_LOCAL_VISUAL_BRIDGE__",Y=m.toUpperCase()+"_PREVIEW_",v=t=>Y+t;if(window.__FIVORA_LOCAL_VISUAL_BRIDGE__||window[O])return;window.__FIVORA_LOCAL_VISUAL_BRIDGE__=!0,window[O]=!0;const F="FIVORA_PREVIEW_EDIT_MODE",K=v("EDIT_MODE"),N="FIVORA_PREVIEW_ELEMENT_CLICKED",W=v("ELEMENT_CLICKED"),k="FIVORA_PREVIEW_READY",j=v("READY"),R="data-preview-field-path",V="data-preview-list-path",x="data-preview-item-path",C="data-fivora-local-edit-target",_="data-fivora-local-selected-target",P="data-"+m+"-local-edit-target",h="data-"+m+"-local-selected-target",H="[data-preview-field-path], [data-preview-list-path], [data-preview-item-path]";let l=window.parent!==window,f=new Map,s=null,o=null,g="*";const T=document.createElement("style");T.setAttribute("data-fivora-local-visual-bridge",""),T.setAttribute("data-"+m+"-local-visual-bridge",""),T.textContent=["["+C+"], ["+P+"] {","  outline: 2px solid #06b6d4 !important;","  outline-offset: 3px !important;","  cursor: pointer !important;","  box-shadow: 0 0 0 5px rgba(6, 182, 212, 0.16) !important;","}","["+_+"], ["+h+"] {","  outline: 2px dashed #06b6d4 !important;","  outline-offset: 3px !important;","  box-shadow: 0 0 0 5px rgba(6, 182, 212, 0.18) !important;","}",'html[data-fivora-local-edit-mode="true"] [data-preview-field-path],','html[data-fivora-local-edit-mode="true"] [data-preview-list-path],','html[data-fivora-local-edit-mode="true"] [data-preview-item-path],','html[data-fivora-local-edit-mode="true"] [data-preview-field-path],','html[data-fivora-local-edit-mode="true"] [data-preview-list-path],','html[data-fivora-local-edit-mode="true"] [data-preview-item-path] {',"  cursor: pointer !important;","}"].join(\`
\`),document.head.appendChild(T),document.documentElement.setAttribute("data-fivora-local-edit-mode",String(l)),document.documentElement.setAttribute("data-fivora-local-edit-mode",String(l));function $(t){return t.source!==window.parent?!1:(g==="*"&&t.origin&&t.origin!=="null"&&(g=t.origin),g==="*"||t.origin===g)}function I(t){window.parent.postMessage(t,g)}function L(){s&&(s.removeAttribute(C),s.removeAttribute(P)),s=null}function X(t){o&&o!==t&&(o.removeAttribute(_),o.removeAttribute(h)),o=t,o.setAttribute(_,"true"),o.setAttribute(h,"true")}function q(){o&&(o.removeAttribute(_),o.removeAttribute(h)),o=null}function G(t){return t instanceof Element?t.closest(H):null}function z(t,e){const d=f.get(e);return d&&["string","number","boolean"].includes(typeof d.value)?d.value:t instanceof HTMLImageElement?t.currentSrc||t.src||"":(t.textContent||"").trim()}function J(t){if(!l)return;const e=G(t.target);!e||e===s||(L(),s=e,s.setAttribute(C,"true"))}function Q(t){if(!l||!s)return;const e=t.relatedTarget;e instanceof Node&&s.contains(e)||L()}function Z(t,e,d){const A=[],p=new Set(e?[e]:[]),n=d||e&&e.replace(/(\\[\\d+\\])?\\.\\w+$/,"").replace(/\\[\\d+\\]$/,"");if(n)for(const[i,a]of f)i!==e&&!p.has(i)&&(i.startsWith(n+".")||i.startsWith(n+"["))&&a?.kind!=="collection"&&(p.add(i),A.push({path:i,label:a.label||i.split(".").pop()||"Content",type:a.type||"text"}));let r=t instanceof Element?t:null,c=0;for(;r&&r!==document.body&&c<3;){const i=r.getAttribute(R);if(i&&i!==e&&!p.has(i)){const a=f.get(i);a?.kind!=="collection"&&(p.add(i),A.push({path:i,label:a?.label||i.split(".").pop()||"Content",type:a?.type||"text"}))}r=r.parentElement,c+=1}return A}function tt(t){if(!l)return;const e=G(t.target);if(!e)return;t.preventDefault(),t.stopPropagation(),t.stopImmediatePropagation(),X(e);const d=e.closest("["+R+"]"),A=e.closest("["+V+"]"),p=e.closest("["+x+"]"),n=d?.getAttribute(R)||null,r=A?.getAttribute(V)||null,c=p?.getAttribute(x)||null,i=n?f.get(n):null,a=e.getBoundingClientRect(),U=c?.match(/\\[(\\d+)\\](?!.*\\[\\d+\\])/),y=[],E=(M,w,b)=>{!w||y.some(S=>S.key===w)||y.push({kind:M,key:w,label:b})};E("element",n,"This element"),E("card",c,"This card"),E("grid",r,"Entire grid");const D=e.closest("[data-preview-page-key]")?.getAttribute("data-preview-page-key")||"",u=e.closest("section,[data-design-section],[data-section-id]");if(u){const M=u.getAttribute("data-design-section")||u.getAttribute("data-section-id")||u.id,b=(u.parentElement?Array.from(u.parentElement.children).filter(et=>et.tagName==="SECTION"):[]).indexOf(u)+1,S=M||(b>0?"nth-"+b:"");E("section",S?"section:"+(D||"all")+":"+S:null,"This section")}E("page",D?"page:"+D:null,"Current page"),E("site","site:all","Whole website");const B={type:N,fieldPath:n,fieldValue:n?z(d||e,n):"",elementTag:e.tagName.toLowerCase(),isImage:e instanceof HTMLImageElement||i?.type==="image",boundingRect:{top:a.top,left:a.left,width:a.width,height:a.height},collectionPath:r,listPath:r,itemPath:c,itemIndex:U?Number(U[1]):null,descriptorKind:n?"field":r?"collection":null,relatedFields:Z(e,n,c),styleScopes:y};I(B),I({...B,type:W})}window.addEventListener("message",t=>{!$(t)||!t.data||typeof t.data!="object"||t.data.type!==F&&t.data.type!==K||(l=t.data.editMode===!0,f=new Map(Array.isArray(t.data.fields)?t.data.fields.filter(e=>e&&typeof e.path=="string").map(e=>[e.path,e]):[]),document.documentElement.setAttribute("data-fivora-local-edit-mode",String(l)),document.documentElement.setAttribute("data-fivora-local-edit-mode",String(l)),l||(L(),q()))}),document.addEventListener("mouseover",J,!0),document.addEventListener("mouseout",Q,!0),document.addEventListener("click",tt,!0),I({type:k,pathname:window.location.pathname}),I({type:j,pathname:window.location.pathname})})();`;let E=ne;try{const e=require("./template-preview-focus-bridge.cjs");typeof e=="string"&&e.trim()&&(E=e)}catch{}const re=`var __name = typeof __name === "function" ? __name : ((target, value) => (typeof Object.defineProperty === "function" ? Object.defineProperty(target, "name", { value, configurable: true }) : target));
`;E.includes("__name")&&!E.includes("var __name")&&(E=`${re}${E}`);function u(e){process.stderr.write(`Local Template Lab: ${e}
`),process.exit(1)}try{new Function(E)}catch(e){u(`Visual editor bridge is invalid: ${e.message}`)}function j(e,t,n){if(e===void 0)return n;const a=Number(e);return(!Number.isInteger(a)||a<1024||a>65535)&&u(`${t} must be a port between 1024 and 65535.`),a}function ie(e){const t=[...e];let n="",a,r,s=!1;for(let c=0;c<t.length;c+=1){const o=t[c];o==="--api-port"?(a=t[c+1],c+=1):o.startsWith("--api-port=")?a=o.slice(11):o==="--preview-port"?(r=t[c+1],c+=1):o.startsWith("--preview-port=")?r=o.slice(15):o==="--skip-install"?s=!0:o==="--help"||o==="-h"?(process.stdout.write(["Fivora Local Template Lab","","Usage:","  npm run lab -- <template-directory> [options]","","Options:","  --api-port <port>      Loopback controller port (default: 4174)","  --preview-port <port>  Template dev-server port (default: 4173)","  --skip-install         Do not install missing local dependencies",""].join(`
`)),process.exit(0)):o.startsWith("-")?u(`Unknown option: ${o}`):n?u(`Unexpected argument: ${o}`):n=o}return n||u("A template directory is required. Run with --help for usage."),{templatePath:h.resolve(n),apiPort:j(a,"--api-port",ee),previewPort:j(r,"--preview-port",te),skipInstall:s}}function x(e,t){try{return JSON.parse(m.readFileSync(e,"utf8"))}catch(n){u(`${t} is missing or invalid at ${e}: ${n instanceof Error?n.message:"unknown error"}`)}}const i=ie(process.argv.slice(2));m.existsSync(i.templatePath)||u(`Template directory does not exist: ${i.templatePath}`),m.statSync(i.templatePath).isDirectory()||u(`Template path must be a directory: ${i.templatePath}`);const oe=["fivora-template.json","fivora-template.json"].find(e=>m.existsSync(h.join(i.templatePath,e)))||"fivora-template.json",H=h.join(i.templatePath,oe),se=h.join(i.templatePath,"package.json"),p=x(H,"Template manifest"),I=x(se,"package.json");p.framework!=="nextjs-static-export"&&u('Template manifest framework must be "nextjs-static-export".'),(!I.scripts||typeof I.scripts.dev!="string")&&u("Template package.json must define a dev script for live preview."),(typeof p.siteDataFile!="string"||!p.siteDataFile.trim())&&u("Template manifest siteDataFile is required.");const _=h.resolve(i.templatePath,p.siteDataFile.trim()),k=h.relative(i.templatePath,_);(k.startsWith("..")||h.isAbsolute(k))&&u("Template manifest siteDataFile must stay inside the template directory.");const G=q.randomBytes(24).toString("base64url"),P=`http://${g}:${i.apiPort}`,J=`http://${g}:${i.previewPort}`,V=`${P}${B}`,le=h.join(__dirname,"deneb-template-validator.cjs");let A=!1,f=null,w=null,S=null,b=null,R=0;const X=5;let M="",O="";const l={protocolVersion:2,connected:!0,templateName:typeof p.name=="string"&&p.name.trim()?p.name.trim():typeof I.name=="string"?I.name:h.basename(i.templatePath),templatePath:i.templatePath,previewUrl:V,apiUrl:P,devStatus:"starting",devError:null,startedAt:new Date().toISOString(),validation:{status:"idle",startedAt:null,completedAt:null,exitCode:null}};function d(e,t){const n=t.toString();e==="dev"?M=`${M}${n}`.slice(-W):O=`${O}${n}`.slice(-W),process.stdout.write(n)}function Y(){return{...l,devLog:M,validationLog:O}}function de(e,t){const n=e.headers.origin;n&&/^(https?:\/\/|null$)/.test(n)&&(t.setHeader("Access-Control-Allow-Origin",n),t.setHeader("Vary","Origin")),t.setHeader("Access-Control-Allow-Headers","Authorization, Content-Type"),t.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS"),t.setHeader("Access-Control-Allow-Private-Network","true"),t.setHeader("Cache-Control","no-store"),t.setHeader("X-Content-Type-Options","nosniff")}function v(e,t,n){const a=JSON.stringify(n);e.statusCode=t,e.setHeader("Content-Type","application/json; charset=utf-8"),e.setHeader("Content-Length",Buffer.byteLength(a)),e.end(a)}function ce(e){return e.headers.authorization===`Bearer ${G}`}function pe(){try{return JSON.parse(m.readFileSync(_,"utf8"))}catch(e){throw new Error(`Unable to read ${p.siteDataFile}: ${e instanceof Error?e.message:"unknown error"}`)}}function ue(e,t=ae){return new Promise((n,a)=>{const r=[];let s=0,c=!1;e.on("data",o=>{if(!c){if(s+=o.length,s>t){c=!0,a(new Error(`Request body is too large. Local site data must be ${Math.floor(t/1024/1024)} MB or less.`));return}r.push(o)}}),e.on("end",()=>{if(!c)try{const o=Buffer.concat(r).toString("utf8");n(JSON.parse(o))}catch{a(new Error("Request body must be valid JSON."))}}),e.on("error",o=>{c||(c=!0,a(o))})})}function F(e){return!!e&&typeof e=="object"&&!Array.isArray(e)}function me(e){const t=`${_}.${process.pid}.${Date.now()}.tmp`,n=m.existsSync(_)?m.statSync(_).mode:420;try{m.writeFileSync(t,`${JSON.stringify(e,null,2)}
`,{encoding:"utf8",flag:"wx",mode:n}),m.renameSync(t,_)}catch(a){if(m.existsSync(t))try{m.unlinkSync(t)}catch{}throw a}}function fe(){return w?!1:(O="",l.validation={status:"running",startedAt:new Date().toISOString(),completedAt:null,exitCode:null},w=$(process.execPath,[le,"validate",i.templatePath],{cwd:__dirname,env:process.env,stdio:["ignore","pipe","pipe"]}),w.stdout.on("data",e=>d("validation",e)),w.stderr.on("data",e=>d("validation",e)),w.on("error",e=>{d("validation",`
Unable to start validation: ${e.message}
`)}),w.on("close",e=>{l.validation={...l.validation,status:e===0?"passed":"failed",completedAt:new Date().toISOString(),exitCode:e},w=null}),!0)}function U(){if(A||l.devStatus==="ready")return;const e=T.get(J,t=>{if(t.resume(),t.statusCode&&t.statusCode<500){l.devStatus="ready",l.devError=null,R=0,process.stdout.write(`
Live preview ready: ${V}
`);return}S=setTimeout(U,600)});e.setTimeout(900,()=>e.destroy()),e.on("error",()=>{S=setTimeout(U,600)})}function ve(e){if(!(A||b)){if(R>=X){l.devStatus="failed",l.devError=e;return}R+=1,l.devStatus="starting",l.devError=null,d("dev",`
Preview server stopped during navigation (${e}). Restarting (${R}/${X})...
`),b=setTimeout(()=>{b=null,N()},900)}}function he(){const e=h.join(i.templatePath,"node_modules");if(!i.skipInstall&&!m.existsSync(e)){l.devStatus="installing";const t=typeof p.installCommand=="string"&&p.installCommand.trim()?p.installCommand.trim():"npm install";d("dev",`Installing local dependencies with: ${t}
`);const n=$(t,{cwd:i.templatePath,env:process.env,shell:!0,stdio:["ignore","pipe","pipe"]});f=n,n.stdout.on("data",a=>d("dev",a)),n.stderr.on("data",a=>d("dev",a)),n.on("error",a=>{l.devStatus="failed",l.devError=a.message,f=null}),n.on("close",a=>{if(f=null,a!==0){l.devStatus="failed",l.devError=`Dependency installation exited with code ${a}.`;return}N()});return}N()}function N(){l.devStatus="starting",l.devError=null,d("dev",`Starting template source server on ${J}. Source edits will hot reload.
`);const e=process.platform==="win32"?"npm.cmd":"npm";f=$(e,["run","dev","--","--hostname",g,"--port",String(i.previewPort)],{cwd:i.templatePath,env:{...process.env,NEXT_PUBLIC_SITE_BASE_PATH:""},shell:process.platform==="win32",stdio:["ignore","pipe","pipe"]}),f.stdout.on("data",t=>d("dev",t)),f.stderr.on("data",t=>d("dev",t)),f.on("error",t=>{l.devStatus="failed",l.devError=t.message,f=null}),f.on("close",(t,n)=>{if(f=null,!A){const a=n?`signal ${n}`:`exit code ${t}`;ve(a)}}),U()}function ge(){return`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    html, body, #template-preview { width: 100%; height: 100%; margin: 0; border: 0; }
    body { overflow: hidden; background: #080808; }
    #template-preview { display: block; }
    #bridge-error { position: fixed; inset: 16px; z-index: 10; display: none;
      padding: 16px; color: #fecaca; background: #450a0a; font: 14px system-ui; }
  </style>
</head>
<body>
  <div id="bridge-error"></div>
  <iframe id="template-preview" title="Local template preview"></iframe>
  <script>
    (() => {
      const BRIDGE_SOURCE = ${JSON.stringify(E)};
      const preview = document.getElementById('template-preview');
      const errorBox = document.getElementById('bridge-error');
      const PREVIOUS_PREVIEW_PREFIX = ['MARKET', 'PLACE'].join('') + '_PREVIEW_';
      const previousPreviewMessage = (suffix) => PREVIOUS_PREVIEW_PREFIX + suffix;
      const savedMessages = new Map();
      let childReady = false;
      let portalOrigin = '*';
      let installTimer = null;

      function sendToChild(payload) {
        preview.contentWindow?.postMessage(payload, '*');
      }

      function sendToPortal(payload) {
        window.parent.postMessage(payload, portalOrigin);
      }

      window.addEventListener('message', (event) => {
        if (!event.data || typeof event.data !== 'object') return;
        if (event.source === window.parent) {
          if (portalOrigin === '*' && event.origin && event.origin !== 'null') {
            portalOrigin = event.origin;
          }
          if (portalOrigin !== '*' && event.origin !== portalOrigin) return;
          if (event.data.type === 'FIVORA_PREVIEW_STYLE_PATCH') {
            const key = 'STYLE_PATCH:' + (event.data.fieldPath || event.data.targetPath || 'default');
            savedMessages.set(key, event.data);
          } else if (event.data.type === 'FIVORA_PREVIEW_EDIT_MODE' ||
              event.data.type === previousPreviewMessage('EDIT_MODE') ||
              event.data.type === 'FIVORA_PREVIEW_SITE_DATA' ||
              event.data.type === previousPreviewMessage('SITE_DATA') ||
              event.data.type === 'FIVORA_PREVIEW_FOCUS_PAGE' ||
              event.data.type === previousPreviewMessage('FOCUS_PAGE') ||
              event.data.type === 'FIVORA_PREVIEW_CONTENT_PATCH') {
            savedMessages.set(event.data.type, event.data);
          }
          if (String(event.data.type || '').startsWith('FIVORA_PREVIEW_') || String(event.data.type || '').startsWith(PREVIOUS_PREVIEW_PREFIX)) {
            sendToChild(event.data);
          }
          return;
        }
        if (event.source !== preview.contentWindow) return;
        if (event.data.type === 'FIVORA_PREVIEW_READY' || event.data.type === previousPreviewMessage('READY')) {
          childReady = true;
          savedMessages.forEach(sendToChild);
          sendToPortal(event.data);
          return;
        }
        if (String(event.data.type || '').startsWith('FIVORA_PREVIEW_') || String(event.data.type || '').startsWith(PREVIOUS_PREVIEW_PREFIX)) {
          sendToPortal(event.data);
        }
      });

      function installBridge() {
        if (
          !preview.contentDocument ||
          preview.contentDocument.readyState !== 'complete' ||
          preview.contentWindow.__FIVORA_LOCAL_VISUAL_BRIDGE_ATTACHED__ === true
        ) {
          return;
        }
        try {
          const script = preview.contentDocument.createElement('script');
          script.setAttribute('data-fivora-local-visual-bridge', '');
          const NAME_SHIM = "var __name = typeof __name === 'function' ? __name : ((target, value) => (typeof Object.defineProperty === 'function' ? Object.defineProperty(target, 'name', { value, configurable: true }) : target)); ";
          script.textContent = (BRIDGE_SOURCE.includes('__name') && !BRIDGE_SOURCE.includes('var __name') ? NAME_SHIM : '') + BRIDGE_SOURCE;
          preview.contentDocument.head.appendChild(script);
          preview.contentWindow.__FIVORA_LOCAL_VISUAL_BRIDGE_ATTACHED__ = true;
          script.remove();
        } catch (error) {
          errorBox.style.display = 'block';
          errorBox.textContent = 'Unable to attach the local visual editor: ' + error.message;
        }
      }

      preview.addEventListener('load', () => {
        childReady = false;
        window.clearTimeout(installTimer);
        // Next development hydration can continue briefly after load. Attach
        // after it settles, while the wrapper watchdog below keeps the bridge
        // present after a hard reload or development refresh.
        installTimer = window.setTimeout(installBridge, 600);
      });

      window.setInterval(installBridge, 900);

      preview.src = '/';
    })();
  <\/script>
</body>
</html>`}function y(e){if(!e||typeof e!="object")return!1;const t="code"in e?String(e.code):"";return t==="ECONNRESET"||t==="ECONNABORTED"||t==="EPIPE"||t==="ERR_STREAM_DESTROYED"}function we(e,t){const n={...e.headers};n.host=`${g}:${i.previewPort}`,delete n["accept-encoding"],delete n.authorization;const a=T.request({hostname:g,port:i.previewPort,method:e.method,path:e.url,headers:n},r=>{t.writeHead(r.statusCode||502,r.statusMessage,r.headers),r.on("error",s=>{y(s)||d("dev",`
Preview proxy upstream error: ${s.message}
`),t.writableEnded||t.destroy()}),t.on("error",s=>{y(s)||d("dev",`
Preview proxy response error: ${s.message}
`),r.destroy()}),r.pipe(t)});a.on("error",r=>{y(r)||d("dev",`
Preview proxy request error: ${r.message}
`),t.headersSent?t.writableEnded||t.destroy():v(t,502,{message:`Local preview is not ready: ${r.message}`})}),e.on("error",r=>{y(r)||d("dev",`
Preview proxy client error: ${r.message}
`),a.destroy()}),e.pipe(a)}const C=T.createServer(async(e,t)=>{const n=new URL(e.url||"/",P);if(e.method==="GET"&&n.pathname===B){const a=ge();t.writeHead(200,{"Cache-Control":"no-store","Content-Length":Buffer.byteLength(a),"Content-Type":"text/html; charset=utf-8"}),t.end(a);return}if(!n.pathname.startsWith("/api/")){we(e,t);return}if(de(e,t),e.method==="OPTIONS"){t.statusCode=204,t.end();return}if(!ce(e)){v(t,401,{message:"Invalid Local Template Lab token."});return}if(e.method==="GET"&&n.pathname==="/api/status"){v(t,200,Y());return}if(e.method==="GET"&&n.pathname==="/api/site-data"){try{let a=p;try{a=x(H,"Template manifest")}catch{}v(t,200,{manifest:a,siteData:pe(),siteDataFile:a.siteDataFile||p.siteDataFile})}catch(a){v(t,500,{message:a instanceof Error?a.message:"Unable to read site data."})}return}if(e.method==="POST"&&n.pathname==="/api/site-data"){try{const a=await ue(e),r=F(a)?a.siteData:null;if(!F(r)||!F(r.content)){v(t,400,{message:"siteData must be a JSON object with a content object."});return}me(r),v(t,200,{saved:!0,siteData:r,siteDataFile:p.siteDataFile})}catch(a){v(t,400,{message:a instanceof Error?a.message:"Unable to save local site data."})}return}if(e.method==="POST"&&n.pathname==="/api/validate"){if(!fe()){v(t,409,{message:"Validation is already running."});return}v(t,202,Y());return}v(t,404,{message:"Local Template Lab endpoint not found."})});function Ee(e,t){const n=()=>{e.destroyed||e.destroy(),t.destroyed||t.destroy()},a=r=>{y(r)||d("dev",`
Preview proxy socket error: ${r.message}
`),n()};e.on("error",a),t.on("error",a),e.on("close",()=>{t.destroyed||t.end()}),t.on("close",()=>{e.destroyed||e.end()}),t.pipe(e),e.pipe(t)}C.on("upgrade",(e,t,n)=>{if(e.url?.startsWith("/api/")){t.destroy();return}t.on("error",s=>{y(s)||d("dev",`
Preview proxy upgrade client error: ${s.message}
`)});const a={...e.headers};a.host=`${g}:${i.previewPort}`;const r=T.request({hostname:g,port:i.previewPort,method:e.method,path:e.url,headers:a});r.on("upgrade",(s,c,o)=>{const Q=Object.entries(s.headers).flatMap(([Z,L])=>(Array.isArray(L)?L:[L]).filter(D=>D!==void 0).map(D=>`${Z}: ${D}`)).join(`\r
`);t.write(`HTTP/1.1 ${s.statusCode||101} ${s.statusMessage||"Switching Protocols"}\r
${Q}\r
\r
`),n.length&&c.write(n),o.length&&t.write(o),Ee(t,c)}),r.on("error",s=>{y(s)||d("dev",`
Preview proxy upgrade upstream error: ${s.message}
`),t.destroyed||t.destroy()}),r.end()});function z(e){!e||e.killed||e.kill("SIGTERM")}function K(){A||(A=!0,S&&clearTimeout(S),b&&clearTimeout(b),z(w),z(f),C.close(()=>process.exit(0)),setTimeout(()=>process.exit(0),1500).unref())}C.on("error",e=>{u(`Unable to start loopback controller at ${P}: ${e instanceof Error?e.message:"unknown error"}`)}),C.listen(i.apiPort,g,()=>{process.stdout.write(["","Fivora Local Template Lab is running.",`Template: ${l.templateName}`,`Controller URL: ${P}`,`Connection token: ${G}`,`Preview URL: ${V}`,"","Paste the controller URL and connection token into Developer Portal > Local Test Lab.","Use Save local in the portal to write edits to the template site-data file.","Press Ctrl+C to stop. No template files are uploaded by this process.",""].join(`
`)),he()}),process.on("SIGINT",K),process.on("SIGTERM",K);
