// Only the official app shell is a theme target. Authentication websites,
// embedded MCP apps and arbitrary pages must keep their own rendering.
export function isClientPage(target) {
  if (target?.type !== 'page' || typeof target.url !== 'string') return false;
  try {
    const url = new URL(target.url);
    return url.protocol === 'app:' && url.hostname === '-' && url.port === '' &&
      url.username === '' && url.password === '' && url.pathname === '/index.html' &&
      !target.url.toLowerCase().includes('avatar-overlay');
  } catch { return false; }
}

// Target enumeration can precede a navigation. Check the actual document again
// when the renderer runs the expression, including on-new-document callbacks.
export function inClientDocument(expression) {
  const predicate = isClientPage.toString();
  return `(() => {
    if (window !== window.top || !(${predicate})({type: 'page', url: location.href})) return;
    return (
${expression.trim().replace(/;+$/, '')}
);
  })()`;
}

// Installed only in the verified official shell, before loading its artwork.
// The official renderer can temporarily mount its spinner outside #root.
export function addLoadingPreview() {
  const id='spider-codex-loading-preview';
  const install=()=>{
    if(window.__SPIDER_THEME_DISABLED__||document.getElementById(id))return;
    const parent=document.head??document.documentElement;
    if(!parent)return;
    const style=document.createElement('style');
    style.id=id;
    const view='html:not([data-spider-codex]):has(:is(#root,body)>div>svg):not(:has(main,h1,h2,[contenteditable]))';
    const spinners=':is(#root,body)>div:has(>svg)';
    style.textContent=`${view}{background:#211722!important;color-scheme:dark!important}
     ${view} :is(body,#root,${spinners}){background:transparent!important;color:#fff5ee}
     ${view} ${spinners}>svg{color:#fff5ee!important}`;
    parent.append(style);
  };
  if(document.documentElement)install();
  else addEventListener('DOMContentLoaded',install,{once:true});
}
