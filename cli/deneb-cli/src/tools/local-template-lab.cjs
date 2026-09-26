#!/usr/bin/env node
const Z=require("node:crypto"),_=require("node:fs"),T=require("node:http"),f=require("node:path"),{spawn:D}=require("node:child_process"),q=4174,ee=4173,U=96*1024,v="127.0.0.1",W="/__fivora_local_preview",te=`(()=>{const m=["market","place"].join(""),O="__"+m.toUpperCase()+"_LOCAL_VISUAL_BRIDGE__",Y=m.toUpperCase()+"_PREVIEW_",v=t=>Y+t;if(window.__FIVORA_LOCAL_VISUAL_BRIDGE__||window[O])return;window.__FIVORA_LOCAL_VISUAL_BRIDGE__=!0,window[O]=!0;const F="FIVORA_PREVIEW_EDIT_MODE",K=v("EDIT_MODE"),N="FIVORA_PREVIEW_ELEMENT_CLICKED",W=v("ELEMENT_CLICKED"),k="FIVORA_PREVIEW_READY",j=v("READY"),R="data-preview-field-path",V="data-preview-list-path",x="data-preview-item-path",C="data-fivora-local-edit-target",_="data-fivora-local-selected-target",P="data-"+m+"-local-edit-target",h="data-"+m+"-local-selected-target",H="[data-preview-field-path], [data-preview-list-path], [data-preview-item-path]";let l=window.parent!==window,f=new Map,s=null,o=null,g="*";const T=document.createElement("style");T.setAttribute("data-fivora-local-visual-bridge",""),T.setAttribute("data-"+m+"-local-visual-bridge",""),T.textContent=["["+C+"], ["+P+"] {","  outline: 2px solid #06b6d4 !important;","  outline-offset: 3px !important;","  cursor: pointer !important;","  box-shadow: 0 0 0 5px rgba(6, 182, 212, 0.16) !important;","}","["+_+"], ["+h+"] {","  outline: 2px dashed #06b6d4 !important;","  outline-offset: 3px !important;","  box-shadow: 0 0 0 5px rgba(6, 182, 212, 0.18) !important;","}",'html[data-fivora-local-edit-mode="true"] [data-preview-field-path],','html[data-fivora-local-edit-mode="true"] [data-preview-list-path],','html[data-fivora-local-edit-mode="true"] [data-preview-item-path],','html[data-fivora-local-edit-mode="true"] [data-preview-field-path],','html[data-fivora-local-edit-mode="true"] [data-preview-list-path],','html[data-fivora-local-edit-mode="true"] [data-preview-item-path] {',"  cursor: pointer !important;","}"].join(\`
\`),document.head.appendChild(T),document.documentElement.setAttribute("data-fivora-local-edit-mode",String(l)),document.documentElement.setAttribute("data-fivora-local-edit-mode",String(l));function $(t){return t.source!==window.parent?!1:(g==="*"&&t.origin&&t.origin!=="null"&&(g=t.origin),g==="*"||t.origin===g)}function I(t){window.parent.postMessage(t,g)}function L(){s&&(s.removeAttribute(C),s.removeAttribute(P)),s=null}function X(t){o&&o!==t&&(o.removeAttribute(_),o.removeAttribute(h)),o=t,o.setAttribute(_,"true"),o.setAttribute(h,"true")}function q(){o&&(o.removeAttribute(_),o.removeAttribute(h)),o=null}function G(t){return t instanceof Element?t.closest(H):null}function z(t,e){const d=f.get(e);return d&&["string","number","boolean"].includes(typeof d.value)?d.value:t instanceof HTMLImageElement?t.currentSrc||t.src||"":(t.textContent||"").trim()}function J(t){if(!l)return;const e=G(t.target);!e||e===s||(L(),s=e,s.setAttribute(C,"true"))}function Q(t){if(!l||!s)return;const e=t.relatedTarget;e instanceof Node&&s.contains(e)||L()}function Z(t,e,d){const A=[],p=new Set(e?[e]:[]),n=d||e&&e.replace(/(\\[\\d+\\])?\\.\\w+$/,"").replace(/\\[\\d+\\]$/,"");if(n)for(const[i,a]of f)i!==e&&!p.has(i)&&(i.startsWith(n+".")||i.startsWith(n+"["))&&a?.kind!=="collection"&&(p.add(i),A.push({path:i,label:a.label||i.split(".").pop()||"Content",type:a.type||"text"}));let r=t instanceof Element?t:null,c=0;for(;r&&r!==document.body&&c<3;){const i=r.getAttribute(R);if(i&&i!==e&&!p.has(i)){const a=f.get(i);a?.kind!=="collection"&&(p.add(i),A.push({path:i,label:a?.label||i.split(".").pop()||"Content",type:a?.type||"text"}))}r=r.parentElement,c+=1}return A}function tt(t){if(!l)return;const e=G(t.target);if(!e)return;t.preventDefault(),t.stopPropagation(),t.stopImmediatePropagation(),X(e);const d=e.closest("["+R+"]"),A=e.closest("["+V+"]"),p=e.closest("["+x+"]"),n=d?.getAttribute(R)||null,r=A?.getAttribute(V)||null,c=p?.getAttribute(x)||null,i=n?f.get(n):null,a=e.getBoundingClientRect(),U=c?.match(/\\[(\\d+)\\](?!.*\\[\\d+\\])/),y=[],E=(M,w,b)=>{!w||y.some(S=>S.key===w)||y.push({kind:M,key:w,label:b})};E("element",n,"This element"),E("card",c,"This card"),E("grid",r,"Entire grid");const D=e.closest("[data-preview-page-key]")?.getAttribute("data-preview-page-key")||"",u=e.closest("section,[data-design-section],[data-section-id]");if(u){const M=u.getAttribute("data-design-section")||u.getAttribute("data-section-id")||u.id,b=(u.parentElement?Array.from(u.parentElement.children).filter(et=>et.tagName==="SECTION"):[]).indexOf(u)+1,S=M||(b>0?"nth-"+b:"");E("section",S?"section:"+(D||"all")+":"+S:null,"This section")}E("page",D?"page:"+D:null,"Current page"),E("site","site:all","Whole website");const B={type:N,fieldPath:n,fieldValue:n?z(d||e,n):"",elementTag:e.tagName.toLowerCase(),isImage:e instanceof HTMLImageElement||i?.type==="image",boundingRect:{top:a.top,left:a.left,width:a.width,height:a.height},collectionPath:r,listPath:r,itemPath:c,itemIndex:U?Number(U[1]):null,descriptorKind:n?"field":r?"collection":null,relatedFields:Z(e,n,c),styleScopes:y};I(B),I({...B,type:W})}window.addEventListener("message",t=>{!$(t)||!t.data||typeof t.data!="object"||t.data.type!==F&&t.data.type!==K||(l=t.data.editMode===!0,f=new Map(Array.isArray(t.data.fields)?t.data.fields.filter(e=>e&&typeof e.path=="string").map(e=>[e.path,e]):[]),document.documentElement.setAttribute("data-fivora-local-edit-mode",String(l)),document.documentElement.setAttribute("data-fivora-local-edit-mode",String(l)),l||(L(),q()))}),document.addEventListener("mouseover",J,!0),document.addEventListener("mouseout",Q,!0),document.addEventListener("click",tt,!0),I({type:k,pathname:window.location.pathname}),I({type:j,pathname:window.location.pathname})})();`;let w=te;try{const e=require("./template-preview-focus-bridge.cjs");typeof e=="string"&&e.trim()&&(w=e)}catch{}const ae=`var __name = typeof __name === "function" ? __name : ((target, value) => (typeof Object.defineProperty === "function" ? Object.defineProperty(target, "name", { value, configurable: true }) : target));
`;w.includes("__name")&&!w.includes("var __name")&&(w=`${ae}${w}`);function p(e){process.stderr.write(`Local Template Lab: ${e}
`),process.exit(1)}try{new Function(w)}catch(e){p(`Visual editor bridge is invalid: ${e.message}`)}function N(e,t,a){if(e===void 0)return a;const n=Number(e);return(!Number.isInteger(n)||n<1024||n>65535)&&p(`${t} must be a port between 1024 and 65535.`),n}function ne(e){const t=[...e];let a="",n,r,s=!1;for(let m=0;m<t.length;m+=1){const d=t[m];d==="--api-port"?(n=t[m+1],m+=1):d.startsWith("--api-port=")?n=d.slice(11):d==="--preview-port"?(r=t[m+1],m+=1):d.startsWith("--preview-port=")?r=d.slice(15):d==="--skip-install"?s=!0:d==="--help"||d==="-h"?(process.stdout.write(["Fivora Local Template Lab","","Usage:","  npm run lab -- <template-directory> [options]","","Options:","  --api-port <port>      Loopback controller port (default: 4174)","  --preview-port <port>  Template dev-server port (default: 4173)","  --skip-install         Do not install missing local dependencies",""].join(`
`)),process.exit(0)):d.startsWith("-")?p(`Unknown option: ${d}`):a?p(`Unexpected argument: ${d}`):a=d}return a||p("A template directory is required. Run with --help for usage."),{templatePath:f.resolve(a),apiPort:N(n,"--api-port",q),previewPort:N(r,"--preview-port",ee),skipInstall:s}}function $(e,t){try{return JSON.parse(_.readFileSync(e,"utf8"))}catch(a){p(`${t} is missing or invalid at ${e}: ${a instanceof Error?a.message:"unknown error"}`)}}const i=ne(process.argv.slice(2));_.existsSync(i.templatePath)||p(`Template directory does not exist: ${i.templatePath}`),_.statSync(i.templatePath).isDirectory()||p(`Template path must be a directory: ${i.templatePath}`);const re=["fivora-template.json","fivora-template.json"].find(e=>_.existsSync(f.join(i.templatePath,e)))||"fivora-template.json",B=f.join(i.templatePath,re),ie=f.join(i.templatePath,"package.json"),c=$(B,"Template manifest"),I=$(ie,"package.json");c.framework!=="nextjs-static-export"&&p('Template manifest framework must be "nextjs-static-export".'),(!I.scripts||typeof I.scripts.dev!="string")&&p("Template package.json must define a dev script for live preview."),(typeof c.siteDataFile!="string"||!c.siteDataFile.trim())&&p("Template manifest siteDataFile is required.");const j=f.resolve(i.templatePath,c.siteDataFile.trim()),H=f.relative(i.templatePath,j);(H.startsWith("..")||f.isAbsolute(H))&&p("Template manifest siteDataFile must stay inside the template directory.");const G=Z.randomBytes(24).toString("base64url"),y=`http://${v}:${i.apiPort}`,k=`http://${v}:${i.previewPort}`,x=`${y}${W}`,oe=f.join(__dirname,"deneb-template-validator.cjs");let P=!1,u=null,g=null,b=null,A=null,R=0;const X=5;let V="",C="";const o={protocolVersion:2,connected:!0,templateName:typeof c.name=="string"&&c.name.trim()?c.name.trim():typeof I.name=="string"?I.name:f.basename(i.templatePath),templatePath:i.templatePath,previewUrl:x,apiUrl:y,devStatus:"starting",devError:null,startedAt:new Date().toISOString(),validation:{status:"idle",startedAt:null,completedAt:null,exitCode:null}};function l(e,t){const a=t.toString();e==="dev"?V=`${V}${a}`.slice(-U):C=`${C}${a}`.slice(-U),process.stdout.write(a)}function J(){return{...o,devLog:V,validationLog:C}}function se(e,t){const a=e.headers.origin;a&&/^(https?:\/\/|null$)/.test(a)&&(t.setHeader("Access-Control-Allow-Origin",a),t.setHeader("Vary","Origin")),t.setHeader("Access-Control-Allow-Headers","Authorization, Content-Type"),t.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS"),t.setHeader("Access-Control-Allow-Private-Network","true"),t.setHeader("Cache-Control","no-store"),t.setHeader("X-Content-Type-Options","nosniff")}function h(e,t,a){const n=JSON.stringify(a);e.statusCode=t,e.setHeader("Content-Type","application/json; charset=utf-8"),e.setHeader("Content-Length",Buffer.byteLength(n)),e.end(n)}function le(e){return e.headers.authorization===`Bearer ${G}`}function de(){try{return JSON.parse(_.readFileSync(j,"utf8"))}catch(e){throw new Error(`Unable to read ${c.siteDataFile}: ${e instanceof Error?e.message:"unknown error"}`)}}function pe(){return g?!1:(C="",o.validation={status:"running",startedAt:new Date().toISOString(),completedAt:null,exitCode:null},g=D(process.execPath,[oe,"validate",i.templatePath],{cwd:__dirname,env:process.env,stdio:["ignore","pipe","pipe"]}),g.stdout.on("data",e=>l("validation",e)),g.stderr.on("data",e=>l("validation",e)),g.on("error",e=>{l("validation",`
Unable to start validation: ${e.message}
`)}),g.on("close",e=>{o.validation={...o.validation,status:e===0?"passed":"failed",completedAt:new Date().toISOString(),exitCode:e},g=null}),!0)}function M(){if(P||o.devStatus==="ready")return;const e=T.get(k,t=>{if(t.resume(),t.statusCode&&t.statusCode<500){o.devStatus="ready",o.devError=null,R=0,process.stdout.write(`
Live preview ready: ${x}
`);return}b=setTimeout(M,600)});e.setTimeout(900,()=>e.destroy()),e.on("error",()=>{b=setTimeout(M,600)})}function ce(e){if(!(P||A)){if(R>=X){o.devStatus="failed",o.devError=e;return}R+=1,o.devStatus="starting",o.devError=null,l("dev",`
Preview server stopped during navigation (${e}). Restarting (${R}/${X})...
`),A=setTimeout(()=>{A=null,F()},900)}}function ue(){const e=f.join(i.templatePath,"node_modules");if(!i.skipInstall&&!_.existsSync(e)){o.devStatus="installing";const t=typeof c.installCommand=="string"&&c.installCommand.trim()?c.installCommand.trim():"npm install";l("dev",`Installing local dependencies with: ${t}
`);const a=D(t,{cwd:i.templatePath,env:process.env,shell:!0,stdio:["ignore","pipe","pipe"]});u=a,a.stdout.on("data",n=>l("dev",n)),a.stderr.on("data",n=>l("dev",n)),a.on("error",n=>{o.devStatus="failed",o.devError=n.message,u=null}),a.on("close",n=>{if(u=null,n!==0){o.devStatus="failed",o.devError=`Dependency installation exited with code ${n}.`;return}F()});return}F()}function F(){o.devStatus="starting",o.devError=null,l("dev",`Starting template source server on ${k}. Source edits will hot reload.
`);const e=process.platform==="win32"?"npm.cmd":"npm";u=D(e,["run","dev","--","--hostname",v,"--port",String(i.previewPort)],{cwd:i.templatePath,env:{...process.env,NEXT_PUBLIC_SITE_BASE_PATH:""},shell:process.platform==="win32",stdio:["ignore","pipe","pipe"]}),u.stdout.on("data",t=>l("dev",t)),u.stderr.on("data",t=>l("dev",t)),u.on("error",t=>{o.devStatus="failed",o.devError=t.message,u=null}),u.on("close",(t,a)=>{if(u=null,!P){const n=a?`signal ${a}`:`exit code ${t}`;ce(n)}}),M()}function me(){return`<!doctype html>
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
      const BRIDGE_SOURCE = ${JSON.stringify(w)};
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
</html>`}function E(e){if(!e||typeof e!="object")return!1;const t="code"in e?String(e.code):"";return t==="ECONNRESET"||t==="ECONNABORTED"||t==="EPIPE"||t==="ERR_STREAM_DESTROYED"}function fe(e,t){const a={...e.headers};a.host=`${v}:${i.previewPort}`,delete a["accept-encoding"],delete a.authorization;const n=T.request({hostname:v,port:i.previewPort,method:e.method,path:e.url,headers:a},r=>{t.writeHead(r.statusCode||502,r.statusMessage,r.headers),r.on("error",s=>{E(s)||l("dev",`
Preview proxy upstream error: ${s.message}
`),t.writableEnded||t.destroy()}),t.on("error",s=>{E(s)||l("dev",`
Preview proxy response error: ${s.message}
`),r.destroy()}),r.pipe(t)});n.on("error",r=>{E(r)||l("dev",`
Preview proxy request error: ${r.message}
`),t.headersSent?t.writableEnded||t.destroy():h(t,502,{message:`Local preview is not ready: ${r.message}`})}),e.on("error",r=>{E(r)||l("dev",`
Preview proxy client error: ${r.message}
`),n.destroy()}),e.pipe(n)}const S=T.createServer((e,t)=>{const a=new URL(e.url||"/",y);if(e.method==="GET"&&a.pathname===W){const n=me();t.writeHead(200,{"Cache-Control":"no-store","Content-Length":Buffer.byteLength(n),"Content-Type":"text/html; charset=utf-8"}),t.end(n);return}if(!a.pathname.startsWith("/api/")){fe(e,t);return}if(se(e,t),e.method==="OPTIONS"){t.statusCode=204,t.end();return}if(!le(e)){h(t,401,{message:"Invalid Local Template Lab token."});return}if(e.method==="GET"&&a.pathname==="/api/status"){h(t,200,J());return}if(e.method==="GET"&&a.pathname==="/api/site-data"){try{let n=c;try{n=$(B,"Template manifest")}catch{}h(t,200,{manifest:n,siteData:de(),siteDataFile:n.siteDataFile||c.siteDataFile})}catch(n){h(t,500,{message:n instanceof Error?n.message:"Unable to read site data."})}return}if(e.method==="POST"&&a.pathname==="/api/validate"){if(!pe()){h(t,409,{message:"Validation is already running."});return}h(t,202,J());return}h(t,404,{message:"Local Template Lab endpoint not found."})});function ve(e,t){const a=()=>{e.destroyed||e.destroy(),t.destroyed||t.destroy()},n=r=>{E(r)||l("dev",`
Preview proxy socket error: ${r.message}
`),a()};e.on("error",n),t.on("error",n),e.on("close",()=>{t.destroyed||t.end()}),t.on("close",()=>{e.destroyed||e.end()}),t.pipe(e),e.pipe(t)}S.on("upgrade",(e,t,a)=>{if(e.url?.startsWith("/api/")){t.destroy();return}t.on("error",s=>{E(s)||l("dev",`
Preview proxy upgrade client error: ${s.message}
`)});const n={...e.headers};n.host=`${v}:${i.previewPort}`;const r=T.request({hostname:v,port:i.previewPort,method:e.method,path:e.url,headers:n});r.on("upgrade",(s,m,d)=>{const z=Object.entries(s.headers).flatMap(([Q,O])=>(Array.isArray(O)?O:[O]).filter(L=>L!==void 0).map(L=>`${Q}: ${L}`)).join(`\r
`);t.write(`HTTP/1.1 ${s.statusCode||101} ${s.statusMessage||"Switching Protocols"}\r
${z}\r
\r
`),a.length&&m.write(a),d.length&&t.write(d),ve(t,m)}),r.on("error",s=>{E(s)||l("dev",`
Preview proxy upgrade upstream error: ${s.message}
`),t.destroyed||t.destroy()}),r.end()});function Y(e){!e||e.killed||e.kill("SIGTERM")}function K(){P||(P=!0,b&&clearTimeout(b),A&&clearTimeout(A),Y(g),Y(u),S.close(()=>process.exit(0)),setTimeout(()=>process.exit(0),1500).unref())}S.on("error",e=>{p(`Unable to start loopback controller at ${y}: ${e instanceof Error?e.message:"unknown error"}`)}),S.listen(i.apiPort,v,()=>{process.stdout.write(["","Fivora Local Template Lab is running.",`Template: ${o.templateName}`,`Controller URL: ${y}`,`Connection token: ${G}`,`Preview URL: ${x}`,"","Paste the controller URL and connection token into Developer Portal > Local Test Lab.","Press Ctrl+C to stop. No template files are uploaded by this process.",""].join(`
`)),ue()}),process.on("SIGINT",K),process.on("SIGTERM",K);
