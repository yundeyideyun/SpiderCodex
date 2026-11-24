/* Native client appearance, calibrated against the supplied reference. */
(function installSpiderTheme(config) {
  'use strict';
  const KEY='__SPIDER_CODEX_V3__',VERSION=109,stylesheetRevision=installSpiderTheme.toString();
  const validRepairAttribute=name=>/^data-[a-z][a-z0-9-]{1,63}$/.test(name??'');
  const mainAnchor='main[data-app-shell-main-surface]'+(validRepairAttribute(config.layoutRepair?.mainAttribute)?',main['+config.layoutRepair.mainAttribute+']':'');
  const composerAnchor='[data-codex-composer]'+(validRepairAttribute(config.layoutRepair?.composerAttribute)?',['+config.layoutRepair.composerAttribute+']':'');
  const mainSelector=mainAnchor+', main.main-surface, main[class*="MainContentSurface-"]';
  const composerSelector=composerAnchor+',.composer-surface-chrome,[class*="ComposerLayoutRoot-"]';
  const primaryActionSelector='button:is(.bg-composer-primary,.size-token-button-composer.bg-codex-icon,.size-token-button-composer[data-composer-voice-start])';
  const menuMaterial='linear-gradient(150deg,#18111b1f,#1f142429) fixed,var(--spider-frost-layer),rgba(35,25,34,.14)';
  const opaquePopupMaterial='linear-gradient(150deg,#18111b1f,#1f142429) fixed,var(--spider-frost-layer),#30222d';
  const settingsDialogSelector='[role="dialog"].settings-dialog';
  const profileHeadingSelector='h1[class*="identityHeading-"]';
  const profileSectionSelector='section[class~="group/profile-section"]';
  const settingsSelector='main:is(.no-drag.bg-surface,[data-app-shell-main-surface]),'+settingsDialogSelector;
  const visibleSettingsDialog=e=>e.matches(settingsDialogSelector)&&visibleSettingsShell(e)&&
    !!e.querySelector('.settings-dialog-nav-list')&&!!e.querySelector('.settings-dialog-content');
  const settingsSectionSelector='div[class*="/settings:"][class*="rounded-2xl"]';
  const settingsPaneSelector='div[class*="electron:bg-surface"][class*="windows:rounded-tl"],'+settingsDialogSelector+' .settings-dialog-content';
  const settingsBackSelector='button[aria-label^="返回"],button[aria-label^="Back to"]';
  const embeddedSettingsBack='header button:is([aria-label="返回 ChatGPT"],[aria-label="返回 Codex"],[aria-label="Back to ChatGPT"],[aria-label="Back to Codex"])';
  const visibleSettingsShell=e=>e.checkVisibility({visibilityProperty:true,opacityProperty:true})&&e.getBoundingClientRect().width>0;
  const embeddedSettingsHost=e=>e.matches('main.no-drag.bg-surface')&&visibleSettingsShell(e)&&
    [...e.querySelectorAll(embeddedSettingsBack)].some(visibleSettingsShell)&&[...e.querySelectorAll('webview')].some(visibleSettingsShell);
  const railSelector='aside.app-shell-left-panel nav[class*="group/sidebar-rail"]';
  const composerPopupSelector='[data-composer-overlay-floating-ui] > [class*="suggestionMenu-"]';
  const floatingDiscoverySelector='[role="menu"],[role="dialog"],[role="alertdialog"],[role="tooltip"],[role="listbox"],[data-spider-popup-panel],[data-spider-attachment-panel],[cmdk-root]:has([cmdk-list]),[data-radix-popper-content-wrapper]>:not([data-state="closed"]),[data-state="open"][data-side][data-align],:is([data-slot="popover-content"],[data-slot="dropdown-menu-content"],[data-slot="select-content"]):not([data-state="closed"]),'+composerPopupSelector;
  const floatingSelector='[role="menu"],[role="dialog"],[role="alertdialog"],[role="tooltip"],[role="listbox"],[data-spider-floating-surface]';
  const popupChangeSelector='[role="menu"],[role="listbox"],[role="dialog"],[role="alertdialog"],[data-radix-popper-content-wrapper],[data-floating-ui-portal],[data-composer-overlay-floating-ui],[data-slot="popover-content"],[data-slot="dropdown-menu-content"],[data-slot="select-content"]';
  const attachmentTrigger='button[aria-label="添加文件等内容"],button[aria-label^="Add files" i],button[aria-label^="Add attachments" i]';
  const attachmentRow='button,[role="option"],[role^="menuitem"],[cmdk-item],[tabindex="0"]';
  const transcriptContent='[data-markdown-text-style],[data-local-conversation-final-assistant]';
  const transcriptStructure=[
    'diffs-container','[class~="group/turn-diff-header"]','[class~="group/activity-header"]',
    '.bg-surface-elevated-secondary.rounded-3xl','[role="button"].size-20',composerSelector
  ].join(',');
  const sliderSurfaces='[role="slider"],[data-slot="slider"],[data-spider-slider-shell]';
  const tooltipSelector='[role="tooltip"],[data-radix-popper-content-wrapper]>:is([data-state="delayed-open"],[data-state="instant-open"])';
  const usageTrigger='aside button:is([aria-label="用量"],[aria-label="Usage"])';
  const embeddedAnchorSelector='[data-radix-popper-content-wrapper]:not([hidden],[aria-hidden="true"])>:not([data-state="closed"],[hidden],[aria-hidden="true"]),[data-state="open"][data-side][data-align]:not([hidden],[aria-hidden="true"])';
  const settingsControls='button[aria-haspopup],button[aria-controls],[role="combobox"],select,[data-slot="select-trigger"],button[class*="select-trigger" i],button[class*="SelectTrigger-"],button.bg-white,button.bg-surface';
  const searchInputs='input[type="search"],input[role="searchbox"],input[aria-label*="搜索"],input[aria-label^="Search" i],input[placeholder*="搜索"],input[placeholder^="Search" i]';
  const quotaProgressSelector='progress[aria-label*="剩余"],progress[aria-label*="remaining" i]';
  const sidebarLabels='.sidebar-item,[data-app-action-sidebar-thread-selected="true"],.sidebar-navigation button[aria-haspopup="menu"],[aria-label^="切换模式"],[aria-label^="Switch mode"]';
  const interactiveSelector='button,a[href],input,textarea,select,[role="button"],[role="combobox"],[role="switch"],[role="option"],[role^="menuitem"],[role="tab"],summary';
  const rowActionSelector='[data-spider-row-action],button.w-full,[role="button"].w-full,.sidebar-item,button[class*="resource-card-row-padding-x"]';
  const knownRowSelector='button[class*="resource-card-row-padding-x"],.sidebar-item[role="button"],button.sidebar-item';
  const hoverControlSelector='button,select,[role="button"],[role="combobox"],[role="switch"],[role="checkbox"],[role="radio"],[role^="menuitem"],[role="option"],[role="tab"],[data-list-navigation-item],summary';
  const unavailableControlSelector=':disabled,[aria-disabled="true"],[data-disabled]:not([data-disabled="false"])';
  const floatingControlSelector='button,[role="button"],[role^="menuitem"],[role="option"],[data-list-navigation-item]';
  const attachmentControlSelector='[data-spider-attachment-panel] [data-list-navigation-item]';
  const floatingRowSelector=':is([role^="menuitem"],[role="option"],[data-list-navigation-item],button:is([aria-haspopup="menu"],[aria-haspopup="listbox"])):not(:where([role="switch"],[role="slider"],[class~="rounded-full"]))';
  const standaloneControlSelector='[aria-haspopup],[aria-controls],[class*="Button-"],[data-spider-native-edge],[data-spider-media-preview],[data-spider-activity-hit],[role="combobox"],[role="switch"],[role="checkbox"],[role="radio"],[role="slider"],select,input,textarea,[data-sidebar-destination],[data-spider-avatar-button]';
  const railVariables=['--spider-rail-left','--spider-rail-top','--spider-rail-width','--spider-rail-height'];
  const supportedSurfaces=new Set(['workspace','login','workspace-picker','settings','profile']);
  if(!document.body)return {ok:false,reason:'document-not-ready'};
  const root=document.documentElement,observedBody=document.body,bg=config.wallpaper;
  const shown=e=>e.checkVisibility()&&e.getBoundingClientRect().width>0;
  const profileMain=e=>e?.matches('main[data-app-shell-main-surface]')&&shown(e)&&
    [...e.querySelectorAll(profileHeadingSelector)].some(shown)&&[...e.querySelectorAll(profileSectionSelector)].some(shown);
  const hasSettingsNavigation=e=>shown(e)&&(
    visibleSettingsDialog(e)||[...e.querySelectorAll(settingsBackSelector+','+settingsSectionSelector)].some(shown)||
    e.matches('[data-app-shell-main-surface]')&&[...document.querySelectorAll('aside h1,aside h2')]
      .some(title=>shown(title)&&/^(设置|Settings)$/.test(title.textContent.trim()))
  );
  function surface(){
    const app=document.getElementById('root');
    if(!app)return 'loading';
    const headings=[...app.querySelectorAll('h1,h2')];
    const hasHeading=pattern=>headings.some(e=>pattern.test(e.textContent.trim())&&shown(e));
    // Settings is a portal modal on newer official builds. The workspace
    // remains mounted underneath, so check the visible modal before the chat.
    if([...document.querySelectorAll(settingsDialogSelector)].some(visibleSettingsDialog))return 'settings';
    const settingsViews=[...app.querySelectorAll(settingsSelector)];
    // The official desktop can show remote settings above a still-mounted chat.
    // Recognize its outer frame without styling or interacting with the guest.
    if(settingsViews.some(embeddedSettingsHost))return 'settings-host';
    const settings=settingsViews.find(hasSettingsNavigation);
    if(settings&&(hasHeading(/^(设置|Settings)$/)||
      [...settings.querySelectorAll(settingsSectionSelector)].some(shown)))return 'settings';
    if(hasHeading(/^(选择工作空间|选择空间|选择你的工作空间|Select a workspace|Choose a workspace|Choose your workspace)$/)&&[...app.querySelectorAll('button')].some(shown))
      return 'workspace-picker';
    const main=[...app.querySelectorAll(mainSelector)].find(shown);
    // A shared side rail can stay visible while a new, unreviewed view replaces the workspace.
    if(main&&[...main.querySelectorAll(composerSelector+',.thread-scroll-container')].some(shown))return 'workspace';
    // A profile has its own identity heading and structured profile sections.
    // Requiring both keeps other future destinations on the native appearance.
    if(profileMain(main))return 'profile';
    const buttons=[...app.querySelectorAll('button')];
    if(hasHeading(/^(登录 ChatGPT|登录 Codex|欢迎回来|Welcome back|Sign in to ChatGPT|Log in to ChatGPT|Continue to ChatGPT)$/)||
      buttons.some(e=>/^(继续登录|使用其他方式登录|取消登录|复制登录链接|Cancel login|Cancel sign-in|Copy login link)$/.test(e.textContent.trim())&&shown(e)))
      return 'login';
    return headings.some(shown)||buttons.some(shown)?'other':'loading';
  }
  function supportsSurface(page){
    if(!config.adaptive)return supportedSurfaces.has(page);
    if(page==='workspace'){
      const main=[...document.querySelectorAll(mainAnchor)].find(shown);
      return !!main&&[...main.querySelectorAll(composerAnchor)].some(shown)&&
        [...document.querySelectorAll(railSelector)].some(shown);
    }
    if(page==='login'){
      return [...document.querySelectorAll('#root :is(button.bg-primary-solid,button.bg-surface)')].some(shown);
    }
    return false;
  }
  const previous=window[KEY];
  const initialSurface=config.adaptive?surface():null;
  if(config.adaptive&&!supportsSurface(initialSurface)){
    if(previous?.adaptive)previous.refresh();
    return {ok:false,active:false,readyForHandoff:false,reason:initialSurface==='loading'?'native-page-loading':'unrecognized-native-surface'};
  }
  const layoutRevision=mainAnchor+'|'+composerAnchor;
  if(previous?.version===VERSION&&previous.stylesheetRevision===stylesheetRevision&&previous.healthy?.()&&previous.artworkCache?.source===config.wallpaper&&previous.adaptive===!!config.adaptive&&previous.layoutRevision===layoutRevision){previous.refresh();return previous.diagnose();}
  const inheritedArtwork=previous?.healthy?.()&&config.wallpaper.startsWith('data:image/png;base64,')&&previous.artworkCache?.source===config.wallpaper?previous.artworkCache:null;
  previous?.remove({preserveArtwork:!!inheritedArtwork});window.__SPIDER_CODEX_V2__?.remove();
  // Keep CSS image references short while reusing the original PNG bytes.
  let artUrl=inheritedArtwork?.url??bg,ownedArtUrl=inheritedArtwork?.owned??false;
  if(!inheritedArtwork&&bg.startsWith('data:image/png;base64,')){
    const raw=atob(bg.slice(bg.indexOf(',')+1)),bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    artUrl=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));ownedArtUrl=true;
  }
  const artworkCache={source:bg,url:artUrl,owned:ownedArtUrl,frostTexture:inheritedArtwork?.frostTexture??null,frostUrl:inheritedArtwork?.frostUrl??null,clearTexture:inheritedArtwork?.clearTexture??null,clearUrl:inheritedArtwork?.clearUrl??null,clearRevision:inheritedArtwork?.clearRevision??0};
  let removed=false,queued=false,scheduled=0,queuedDelay=0,surfaceStatus=null,lastDiagnosis=null;
  function publishTexture(kind,blob,property){
    if(removed||!blob)return false;
    const url=URL.createObjectURL(blob);
    if(artworkCache[kind+'Url'])URL.revokeObjectURL(artworkCache[kind+'Url']);
    artworkCache[kind+'Url']=url;artworkCache[kind+'Texture']=`url(${JSON.stringify(url)})`;
    root.style.setProperty(property,artworkCache[kind+'Texture']);return true;
  }
  function cacheTexture(kind,data,property){
    const comma=data.indexOf(','),header=data.slice(0,comma),mime=header.slice(5,header.indexOf(';'));
    if(comma<0||!header.startsWith('data:image/')||!header.endsWith(';base64'))return false;
    const raw=atob(data.slice(comma+1)),bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return publishTexture(kind,new Blob([bytes],{type:mime}),property);
  }
  function reuseTexture(kind,property){
    const texture=artworkCache[kind+'Texture'];if(!texture)return false;
    // Upgrade old cached data URLs once. Short shared URLs avoid resolving
    // the entire encoded wallpaper during every surface style calculation.
    if(!artworkCache[kind+'Url'])try{return cacheTexture(kind,JSON.parse(texture.slice(4,-1)),property)}catch{return false;}
    root.style.setProperty(property,texture);return true;
  }
  let artworkDecode;
  function decodedArtwork(){
    if(!artworkDecode){
      const image=new Image();image.src=artUrl;
      artworkDecode=image.decode().then(()=>image,()=>null);
    }
    return artworkDecode;
  }
  async function encodeTexture(canvas,quality,kind,property){
    // Encode the same pixels without serializing a data URL on the UI thread.
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
    return publishTexture(kind,blob,property);
  }
  // Frost the artwork once. Scrolling chat no longer re-blurs an area of the
  // live transcript on every compositor frame.
  async function prepareGlassArtwork(){
    if(reuseTexture('frost','--spider-frosted-art'))return;
    const image=await decodedArtwork();
    if(removed||!image)return;
    const canvas=document.createElement('canvas');canvas.width=768;
    canvas.height=Math.max(1,Math.round(canvas.width*image.naturalHeight/image.naturalWidth));
    const context=canvas.getContext('2d',{alpha:false});if(!context)return;
    context.filter='blur(1.4px) brightness(.72)';
    context.drawImage(image,0,0,canvas.width,canvas.height);
    // Keep the artwork's hue and midtone detail. Roll only its brightest
    // highlights down so light controls stay readable on the frosted layer.
    try{
      const backplate=context.getImageData(0,0,canvas.width,canvas.height);
      const pixels=backplate.data;
      for(let i=0;i<pixels.length;i+=4){
        const light=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];
        if(light<=82)continue;
        const gain=(82+(light-82)*.22)/light;
        pixels[i]*=gain;pixels[i+1]*=gain;pixels[i+2]*=gain;
      }
      context.putImageData(backplate,0,0);
    }catch{return;}
    try{
      await encodeTexture(canvas,.88,'frost','--spider-frosted-art');
    }catch{}
  }
  async function prepareClearArtwork(){
    if(artworkCache.clearRevision===2&&reuseTexture('clear','--spider-clear-art'))return;
    const image=await decodedArtwork();
    if(removed||!image)return;
    const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=Math.max(1,Math.round(canvas.width*image.naturalHeight/image.naturalWidth));
    const context=canvas.getContext('2d');if(!context)return;
    context.filter='blur(.25px)';context.drawImage(image,0,0,canvas.width,canvas.height);
    try{
      const data=context.getImageData(0,0,canvas.width,canvas.height),pixels=data.data;
      const linear=Float32Array.from({length:256},(_,i)=>{const x=i/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});
      const encoded=Uint8Array.from({length:4097},(_,i)=>{const x=i/4096;return Math.round(255*(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055))});
      for(let i=0;i<pixels.length;i+=4){
        const r=linear[pixels[i]],g=linear[pixels[i+1]],b=linear[pixels[i+2]],light=.2126*r+.7152*g+.0722*b;
        if(light>.11){const gain=(.11+(light-.11)*.025)/light;pixels[i]=encoded[Math.round(r*gain*4096)];pixels[i+1]=encoded[Math.round(g*gain*4096)];pixels[i+2]=encoded[Math.round(b*gain*4096)];}
        pixels[i+3]=230;
      }
      context.putImageData(data,0,0);
      if(await encodeTexture(canvas,.92,'clear','--spider-clear-art'))artworkCache.clearRevision=2;
    }catch{}
  }
  const nativePreference=matchMedia('(prefers-color-scheme:dark)');
  const setRoot=(name,value)=>{if(root.getAttribute(name)!==value)root.setAttribute(name,value)};
  function syncNativePreference(page){
    if(typeof page!=='string')page=surface();
    setRoot('data-spider-surface',page);
    setRoot('data-spider-native-dark',String(nativePreference.matches));
    const appearance=supportsSurface(page)?'on':page==='loading'&&!config.adaptive?'loading':'suspended';
    setRoot('data-spider-codex',window.__SPIDER_THEME_DISABLED__?'suspended':appearance);
  }
  syncNativePreference();
  nativePreference.addEventListener('change',syncNativePreference);
  const style=document.createElement('style');style.id=`spider-codex-v${VERSION}-style`;
  const feedbackColors={
    danger:{text:'#ffb0a8',solid:'#9d3037',tint:'#ed615a'},
    warning:{text:'#ffd0a8',solid:'#854014',tint:'#f58b48'},
    caution:{text:'#ffe3a2',solid:'#665016',tint:'#d9ae45'},
    success:{text:'#a4e7bc',solid:'#205d3d',tint:'#5dc98a'},
    info:{text:'#a6d6ff',solid:'#285280',tint:'#6fb4f4'},
    discovery:{text:'#dfc4ff',solid:'#613d8a',tint:'#b58ae8'}
  };
  const feedbackTokens=Object.entries(feedbackColors).map(([name,color])=>`
    --color-text-${name}:${color.text};
    --color-text-${name}-solid:#fffaf6;
    --color-text-${name}-outline:${color.text};--color-text-${name}-outline-hover:${color.text};
    --color-text-${name}-ghost:${color.text};--color-text-${name}-ghost-hover:${color.text};--color-text-${name}-soft:${color.text};
    --color-background-${name}-solid:${color.solid};--color-background-${name}-solid-hover:${color.solid};--color-background-${name}-solid-active:${color.solid};
    --color-background-${name}-soft:${color.tint}1f;--color-background-${name}-soft-hover:${color.tint}30;--color-background-${name}-soft-active:${color.tint}43;
    --color-border-${name}-outline:${color.tint}a6;--color-border-${name}-outline-hover:${color.text};
  `).join('');
  style.textContent=`
  @property --spider-glass-left{syntax:"<length>";inherits:false;initial-value:0px}
  @property --spider-glass-top{syntax:"<length>";inherits:false;initial-value:0px}
  @property --spider-frost-layer{syntax:"*";inherits:false;initial-value:none}
  @property --spider-action-light{syntax:"<number>";inherits:false;initial-value:.35}
  @property --spider-attachment-light{syntax:"<number>";inherits:false;initial-value:0}
  html[data-spider-codex="on"] :is(${floatingSelector},${composerSelector},[data-spider-glass-panel],[data-spider-glass-aligned],[data-spider-code-surface]){
    --spider-frost-layer:var(--spider-glass-art) var(--spider-bg-position)/var(--spider-bg-size) no-repeat fixed
  }
  html:is([data-spider-codex="on"],[data-spider-codex="loading"]){color-scheme:dark!important;background:#111013!important;--spider-art:url(${JSON.stringify(artUrl)});
    background-image:var(--spider-art)!important;background-size:var(--spider-bg-size)!important;background-position:var(--spider-bg-position)!important;background-repeat:no-repeat!important;
    --spider-header-height:calc(36px * var(--codex-window-zoom,1));
    --spider-bg-width:max(100vw,calc(100vh * 1.572916666666667));--spider-bg-height:max(100vh,calc(100vw * .635761589403974));
    --spider-bg-natural-x:calc(100vw - var(--spider-bg-width));
    /* Keep the original right edge whenever the face is already visible.
       A tall, narrow window still needs horizontal crop at cover scale. */
    --spider-face-inset:clamp(22px,12vw,172px);
    --spider-bg-x:clamp(var(--spider-bg-natural-x),calc(var(--spider-face-inset) - .332 * var(--spider-bg-width)),0px);
    --spider-bg-y:calc((100vh - var(--spider-bg-height)) * .5);
    --spider-bg-size:var(--spider-bg-width) var(--spider-bg-height);--spider-bg-position:var(--spider-bg-x) var(--spider-bg-y);
    --spider-rail-bg-position:calc(var(--spider-bg-x) - var(--spider-rail-left,0px)) calc(var(--spider-bg-y) - var(--spider-rail-top,0px));
    --spider-text:#fff5ee;--spider-text-secondary:#f0ded3;--spider-text-tertiary:#ead8cd;
    --spider-control:rgba(31,23,31,.76);--spider-control-edge:#ab8a87;--spider-focus:#ffbe9f;
    --spider-radius-control:8px;--spider-radius-card:12px;--spider-radius-composer:20px;--spider-radius-pill:999px;
    --spider-focus-inset:#ffe3d4c0;--spider-lift-easing:cubic-bezier(.18,.9,.25,1.18);--spider-lift-duration:320ms;
    --spider-hover-shadow:inset 0 1px 1px #fff4e691,inset 0 -1px 1px #240c283d,0 3px 5px #17091c73,0 8px 16px #10091e70;
    --spider-menu-hover-shadow:inset 0 1px 1px #fff4e67a,inset 0 -1px 1px #210b2638,0 3px 6px #16081c70,0 6px 11px #10091e47;
    --spider-accent:#ffac87;--spider-accent-base:#a4312e;--spider-accent-hover:#c44133;--spider-accent-pressed:#8e2829;
    --spider-glass-art:var(--spider-clear-art,var(--spider-frosted-art,linear-gradient(#222431,#222431)));
    --spider-frost-layer:var(--spider-glass-art) var(--spider-bg-position)/var(--spider-bg-size) no-repeat fixed;
    --color-text:var(--spider-text);--color-text-emphasis:var(--spider-text);--color-text-secondary:var(--spider-text-secondary);--color-text-tertiary:var(--spider-text-tertiary);
    --color-token-foreground:var(--spider-text);--color-token-text-secondary:var(--spider-text-secondary);--color-token-text-tertiary:var(--spider-text-tertiary);
    --color-accent:var(--spider-accent-base);--color-button-accent:var(--spider-accent-base);--color-button-accent-hover:var(--spider-accent-hover);--color-button-accent-active:var(--spider-accent-pressed);
    --codex-theme-accent:var(--spider-accent-base);--codex-theme-accent-color:var(--spider-accent);--codex-theme-accent-icon:var(--spider-accent);--codex-theme-accent-background:#f16a531f;--codex-theme-accent-background-subtle:#f16a530f;--codex-theme-accent-background-hover:#f16a5330;--codex-theme-accent-background-pressed:#f16a533d;--codex-theme-accent-text:var(--spider-accent);
    --app-color-icon-accent:#d498ad;--app-color-text-accent:#e4b1c2;--app-color-text-on-accent:#fff;--app-color-background-accent:rgba(119,81,91,.20);--app-color-background-accent-hover:rgba(119,81,91,.28);--app-color-background-accent-active:rgba(119,81,91,.35);
    --color-background-composer-primary:#77515b;--color-text-on-chat-accent:#fff;--color-token-accent:#bb8395;
    --color-text-accent:#e4b1c2;--color-text-accent-hover:#f0c7d4;--link-primary-text-color:#e4b1c2;--color-text-composer-reference:#e4b1c2;
    --color-ring:#bb8395;--color-ring-accent:#bb8395;--focus-outline-color:#bb8395;--app-color-border-focus:#bb8395;
    --color-background-user-message:rgba(37,32,36,.86);--color-text-user-message:#f0ecee;--user-message-background-color:rgba(37,32,36,.86);
    --color-background-composer-surface:#323434;--color-background-composer-action-bar:#323434;--input-placeholder-text-color:rgba(238,238,238,.5);
    --color-codex-terminal-background:#191a1c;--color-codex-terminal-foreground:#e9e9eb;--app-color-background-editor-opaque:#191a1c;
    --codeblock-background-color:#191a1c;--color-codex-editor-inline-code-background:rgba(255,255,255,.07);
    --color-background-control-opaque:#28292b;--color-background-callout-surface:#222326;
  }
  /* The native workspace switch renders a full-viewport spinner before the
     next workspace mounts. Keep its interaction and use the same backdrop. */
  html[data-spider-codex="loading"] body{
    min-height:100vh;background:rgba(21,15,25,.23)!important;color:var(--spider-text)
  }
  html[data-spider-codex="loading"] :is(#root,:is(#root,body)>div:has(>svg)){background:transparent!important}
  html[data-spider-codex="loading"] :is(#root svg,body>div>svg){color:var(--spider-text)!important}
  html[data-spider-codex="on"] body{min-height:100vh;background:rgba(21,15,25,.23)!important;color:var(--spider-text);isolation:isolate}
  html[data-spider-codex="on"] main{text-shadow:0 1px 2px #12070da6,0 2px 5px #0007}
  html[data-spider-codex="on"] [role="menubar"]{text-shadow:0 1px 3px #12070db3}

  html[data-spider-codex="on"] body::before{content:none}
  html[data-spider-codex="on"] #root{position:relative;z-index:0;background:transparent!important}
  html[data-spider-codex="on"] :is(${mainSelector},[data-app-shell-header-edge-scroll],.app-header-tint,.thread-scroll-container,[data-app-shell-main-content-top-fade],.app-shell-main-content-top-fade){background:transparent!important;background-image:none!important}
  html[data-spider-codex="on"] aside.app-shell-left-panel{background:linear-gradient(rgba(6,4,9,.16),rgba(6,4,9,.07))!important;border-right:0;box-shadow:inset -1px 0 #ffffff12;--app-shell-navigation-rail-width:48px;--sidebar-navigation-header-height:44px;scrollbar-color:#b69eb449 transparent;scrollbar-width:thin}
  html[data-spider-codex="on"] aside.app-shell-left-panel[data-app-shell-left-panel-appearance="default"] .sidebar-navigation{border-radius:0!important}
  html[data-spider-codex="on"] aside.app-shell-left-panel nav[class*="group/sidebar-rail"]{width:48px!important;padding-inline:6px!important}
  html[data-spider-codex="on"] aside.app-shell-left-panel [aria-label^="切换模式"]{font-size:14px;line-height:20px;font-weight:600}
  html[data-spider-codex="on"] aside [data-sidebar-destination]::before{border-radius:8px!important;background:transparent!important}
  html[data-spider-codex="on"] aside [data-sidebar-destination]:hover::before{background:#ffffff12!important;opacity:1!important}
  html[data-spider-codex="on"] aside [data-sidebar-destination][data-selected]::before{inset:2px!important;background:#ffffff29!important;opacity:1!important;box-shadow:inset 0 0 0 1px #ffffff12}
  html[data-spider-codex="on"] aside [data-sidebar-destination][data-selected]{color:#f5eef4!important;--button-text-color:#f5eef4}
  html[data-spider-codex="on"] [data-spider-home-svg]{visibility:hidden!important}
  html[data-spider-codex="on"] aside [data-sidebar-destination="builtin:home"]::after{content:"";position:absolute;inset:auto!important;left:50%!important;top:50%!important;width:20px;height:20px;transform:translate(-50%,-50%);background:currentColor;mask:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22M3%2010.5%2012%203l9%207.5V21h-6v-7H9v7H3z%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat;pointer-events:none;border:0;box-shadow:none}
  html[data-spider-codex="on"] aside [class^="header-"]::after{content:none!important;background:none!important}
  html[data-spider-codex="on"] aside .sidebar-resize-handle-line{background:transparent!important;opacity:0!important}
  html[data-spider-codex="on"] main nav:is([aria-label="用户消息"],[aria-label="User messages"]){filter:opacity(0)!important;transition:none!important}
  html[data-spider-codex="on"] main nav:is([aria-label="用户消息"],[aria-label="User messages"]):is(:hover,:focus-within){filter:opacity(1)!important}
  html[data-spider-codex="on"] aside :is(.sidebar-item,[class^="header-"]){text-shadow:0 1px 3px #12070da6}
  html[data-spider-codex="on"][data-spider-native-dark="true"] body::after{background-image:linear-gradient(90deg,transparent calc(100% - 230px),rgba(15,8,13,.48) calc(100% - 138px)),var(--spider-art);background-size:100% 100%,var(--spider-bg-size);background-position:0 0,var(--spider-bg-position)}
  html[data-spider-codex="on"][data-spider-native-dark="false"] body::after{background-image:linear-gradient(90deg,transparent calc(100% - 230px),rgba(242,211,188,.52) calc(100% - 138px)),var(--spider-art);background-size:100% 100%,var(--spider-bg-size);background-position:0 0,var(--spider-bg-position)}
  html[data-spider-codex="on"] aside .sidebar-item{border-radius:6px}
  html[data-spider-codex="on"] aside .sidebar-item:hover{background:#ffffff10}
  html[data-spider-codex="on"] aside [data-app-action-sidebar-thread-selected="true"]{background:rgba(142,100,129,.38)!important;box-shadow:inset 2px 0 #c68ba6,inset 0 0 0 1px #dfb0c51c}
  html[data-spider-codex="on"] aside [class*="section-toggle"]{font-size:12px;--color-text:#bdb2c3;color:#bdb2c3}
  html[data-spider-codex="on"] aside :is([data-sidebar-destination],.sidebar-item):focus-visible{outline:2px solid #d9a7be!important;outline-offset:1px}
  html[data-spider-codex="on"] [class*="MainContentLeftBorder-"]{border-left-color:transparent!important}
  html[data-spider-codex="on"] [data-slate-sidebar-peeking="true"] .sidebar-navigation{background:transparent!important;border-radius:0!important;box-shadow:none!important}

  html[data-spider-codex="on"] [class*="MainContentTopFade-"]{opacity:0!important}
  html[data-spider-codex="on"] [class*="shiftWithTranscript-"]::before,html[data-spider-codex="on"] [class*="shiftWithTranscript-"]::after{background:none!important}
  html[data-spider-codex="on"] :is([class*="ComposerLayoutRoot-"],.composer-surface-chrome){background:#323434!important;border:0!important;border-radius:var(--spider-radius-composer)!important;box-shadow:0 4px 16px #0001;backdrop-filter:none}
  html[data-spider-codex="on"] [class*="ComposerLayoutRoot-"] .composer-surface-chrome{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none}
  html[data-spider-codex="on"] [class*="ComposerLayoutBody-"]{border-radius:var(--spider-radius-composer)!important;box-shadow:none!important}
  html[data-spider-codex="on"] [data-codex-composer] [data-placeholder]::before{color:#949696!important;opacity:1!important}
  html[data-spider-codex="on"] [data-spider-home-main] [data-testid="home-icon"]{visibility:hidden!important}
  html[data-spider-codex="on"] [data-spider-home-composer]{display:block!important;position:fixed!important;z-index:2;--composer-editor-min-height:34px}
  html[data-spider-codex="on"] [data-spider-home-heading]{position:fixed!important;transform:translateX(-50%);z-index:2;font-size:24px!important;line-height:1.2!important}
  html[data-spider-codex="on"] [data-spider-home-composer] [class*="ContainedEditor-"]{--composer-editor-min-height:34px!important}
  html[data-spider-codex="on"] [data-spider-home-composer] [data-codex-composer] [data-placeholder]::before{font-size:12px}
  html[data-spider-codex="on"] [data-spider-home-composer] [data-composer-utility-rail]{zoom:.85}
  html[data-spider-codex="on"] [data-spider-home-composer] [data-codex-composer-root]{display:flex!important;flex-direction:column!important}
  html[data-spider-codex="on"] [data-spider-home-composer] [data-codex-composer-reference-drop-target]{order:1}
  html[data-spider-codex="on"] [data-spider-home-composer] [data-composer-rail]{order:2;margin:0 12px!important;padding:0!important;height:auto!important;width:auto!important;border-radius:0 0 12px 12px!important;background:rgba(12,12,14,.75)!important}
  html[data-spider-codex="on"] [data-spider-home-composer] [data-composer-rail-item]{background:transparent!important;border-radius:0 0 12px 12px!important;margin:0!important}
  html[data-spider-codex="on"] [data-spider-home-composer] [data-composer-rail]::before,html[data-spider-codex="on"] [data-spider-home-composer] [data-composer-rail]::after{display:none!important}
  html[data-spider-codex="on"] main :is([contenteditable="true"],textarea){color:#e9e9e9!important;caret-color:#e9e9e9}
  html[data-spider-codex="on"] [data-local-conversation-final-assistant]{background:transparent!important;border-radius:0;padding:0;backdrop-filter:none}
  html[data-spider-codex="on"] :is([role="menu"],[role="dialog"],[data-radix-popper-content-wrapper]){--color-token-dropdown-background:#252527;--color-token-foreground:#ededed;--color-token-text-secondary:#c3c3c5;--color-token-bg-primary:#242426;color-scheme:dark}
  html[data-spider-codex="on"] [data-spider-structural]{background:transparent!important;background-image:none!important}

  /* One continuous artwork. Chrome only raises image brightness; the input has light frost.
     Tint samples from client-clear.png: shadow 32/21/27, brick 106/57/52,
     warm city light 127/90/66 and 135/114/94. See the delivered palette record. */
  html[data-spider-codex="on"]{--color-surface:rgba(32,21,27,.12);--color-surface-card:rgba(32,21,27,.16);--color-surface-elevated:rgba(32,21,27,.66);--color-background-panel:rgba(32,21,27,.16);--color-background-primary-soft:rgba(106,57,52,.15);--color-background-primary-soft-alpha:rgba(106,57,52,.15);--color-background-secondary-soft:rgba(127,90,66,.16);--color-background-composer-surface:rgba(32,21,27,.26);--color-background-composer-action-bar:rgba(32,21,27,.10);--color-background-user-message:rgba(106,57,52,.10);--user-message-background-color:rgba(106,57,52,.10);--color-text-user-message:#f7f1ee;--color-text-accent:#efd4c5;--link-primary-text-color:#efd4c5;--color-background-control-opaque:rgba(32,21,27,.30);--color-background-callout-surface:rgba(32,21,27,.14);--codeblock-background-color:rgba(32,21,27,.14);--color-codex-terminal-background:rgba(32,21,27,.38);--app-color-background-editor-opaque:rgba(32,21,27,.30);
    --color-accent:var(--spider-accent-base);--color-button-accent:var(--spider-accent-base);--color-button-accent-hover:var(--spider-accent-hover);--color-button-accent-active:var(--spider-accent-pressed);
    --codex-theme-accent:var(--spider-accent-base);--codex-theme-accent-color:var(--spider-accent);--codex-theme-accent-icon:var(--spider-accent);
    --codex-theme-accent-background:#f16a5333;--codex-theme-accent-background-subtle:#f16a531a;--codex-theme-accent-background-hover:#f16a5343;--codex-theme-accent-background-pressed:#f16a5352;
    --codex-theme-accent-text:var(--spider-accent);--app-color-icon-accent:var(--spider-accent);--app-color-text-accent:var(--spider-accent);--app-color-background-accent:#f16a5333;--app-color-background-accent-hover:#f16a5343;--app-color-background-accent-active:#f16a5352;
    --color-background-composer-primary:var(--spider-accent-base);--color-token-accent:var(--spider-accent);--color-text-accent:var(--spider-accent);--color-text-accent-hover:#ffdfcb;--color-text-composer-reference:var(--spider-accent);--link-primary-text-color:var(--spider-accent);
    --color-ring:var(--spider-focus);--color-ring-accent:var(--spider-focus);--focus-outline-color:var(--spider-focus);--app-color-border-focus:var(--spider-focus)}
  html[data-spider-codex="on"] body::before{
    content:"";position:fixed;z-index:-1;pointer-events:none;
    left:var(--spider-rail-left,0px);top:var(--spider-rail-top,0px);
    width:var(--spider-rail-width,0px);height:var(--spider-rail-height,0px);
    border-radius:8px;background-image:var(--spider-art);background-repeat:no-repeat;
    background-size:var(--spider-bg-size);background-position:var(--spider-rail-bg-position);
    mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 14px),transparent 100%),linear-gradient(180deg,transparent,#000 14px,#000 calc(100% - 20px),transparent);
    mask-composite:intersect;filter:brightness(1.18) saturate(1.24);backdrop-filter:none
  }
  html[data-spider-codex="on"] body::after{content:"";position:fixed;top:0;left:0;right:0;height:calc(var(--spider-header-height) + 16px);z-index:-1;pointer-events:none;border-radius:10px 10px 0 0;background-image:var(--spider-art);background-repeat:no-repeat;background-size:var(--spider-bg-size,cover);background-position:var(--spider-bg-position,center);mask-image:linear-gradient(180deg,#000 0,#000 calc(var(--spider-header-height) - 5px),transparent calc(var(--spider-header-height) + 16px));filter:brightness(1.18) saturate(1.24);backdrop-filter:none;box-shadow:none}
  html[data-spider-codex="on"] [role="menubar"] [role="menuitem"]{
    color:var(--spider-text);text-shadow:0 1px 2px #150e19,0 1px 5px #150e19e0;border-radius:6px
  }
  html[data-spider-codex="on"] [role="menubar"] [role="menuitem"]:hover{background-color:#ffffff14}
  html[data-spider-codex="on"] aside.app-shell-left-panel{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important}
  html[data-spider-codex="on"] aside.app-shell-left-panel{text-shadow:0 1px 2px #12070de0,0 2px 4px #12070db3}
  html[data-spider-codex="on"] aside.app-shell-left-panel .sidebar-navigation{
    background:transparent!important;
    border:0!important;border-radius:0!important;box-shadow:none!important;backdrop-filter:none!important
  }
  html[data-spider-codex="on"] aside.app-shell-left-panel :is(${sidebarLabels}):not(:disabled,[aria-disabled="true"],[data-disabled]),
  html[data-spider-codex="on"] aside.app-shell-left-panel :is(${sidebarLabels}):not(:disabled,[aria-disabled="true"],[data-disabled]) span[class*="text-"]{
    --text-color:var(--spider-text);--text-color-hover:var(--spider-text);--button-text-color:var(--spider-text);
    color:var(--spider-text)!important
  }
  html[data-spider-codex="on"] aside.app-shell-left-panel .sidebar-item:not(:disabled,[aria-disabled="true"],[data-disabled]) :is(.text-secondary,.text-tertiary,[class*="section-toggle"]){
    color:var(--spider-text-secondary)!important
  }
  html[data-spider-codex="on"] aside.app-shell-left-panel .sidebar-navigation [data-marquee-content]:not(:is([aria-disabled="true"],[data-disabled],:disabled) *),
  html[data-spider-codex="on"] aside.app-shell-left-panel .sidebar-navigation [data-marquee-content]:not(:is([aria-disabled="true"],[data-disabled],:disabled) *) span{
    color:var(--spider-text)!important;text-shadow:0 1px 2px #160f1a,0 1px 4px #160f1ac7
  }
  html[data-spider-codex="on"] aside.app-shell-left-panel nav[class*="group/sidebar-rail"]{position:relative;isolation:isolate;background:transparent!important;border:0!important;box-shadow:none;backdrop-filter:none!important}
  html[data-spider-codex="on"] aside [data-sidebar-destination]{color:#eee3dc!important;--button-text-color:#eee3dc}
  html[data-spider-codex="on"] aside [data-sidebar-destination][data-selected]{color:#fff6ff!important;--button-text-color:#fff6ff}
  html[data-spider-codex="on"] aside [data-sidebar-destination][data-selected]::before{
    background:linear-gradient(145deg,#ffe3eb63,#dcc4dc17)!important;
    backdrop-filter:blur(8px) saturate(1.1);
    box-shadow:inset 0 1px 0 #fff1f048,0 2px 10px #190b224d
  }
  html[data-spider-codex="on"] aside [data-app-action-sidebar-thread-selected="true"]{background:rgba(247,221,224,.14)!important;border-radius:6px;box-shadow:none!important;border:0!important}
  html[data-spider-codex="on"] aside [class*="section-toggle"]{--color-text:#e0d1c9;color:#e0d1c9}
  html[data-spider-codex="on"] aside :is([data-sidebar-destination],.sidebar-item):focus-visible{outline-color:#d8b696!important}
  html[data-spider-codex="on"] aside [role="separator"],html[data-spider-codex="on"] aside [role="separator"]::before,html[data-spider-codex="on"] aside [role="separator"]::after,html[data-spider-codex="on"] aside [role="separator"]>div::after{background:transparent!important;border:0!important;box-shadow:none!important}
  html[data-spider-codex="on"] aside [class*="group/nav-list"] .sidebar-item::after{border-bottom:0!important;background:none!important}
  html[data-spider-codex="on"] aside nav[class*="group/sidebar-rail"] .border-t{border-top:0!important}
  html[data-spider-codex="on"] [class*="MainContentLeftBorder-"]{border-inline-start:0!important;box-shadow:none!important}
  html[data-spider-codex="on"] [class*="MainContentSurface-"]{border-color:transparent!important;box-shadow:none!important}
  html[data-spider-codex="on"] :is([class*="ComposerLayoutRoot-"],.composer-surface-chrome){background:${opaquePopupMaterial}!important;backdrop-filter:none;box-shadow:0 6px 16px #1013282b,inset 0 1px 0 #fff0e23d,inset 0 0 0 1px #fff1e51c;--spider-text-secondary:#fff5ee;--spider-text-tertiary:#fff5ee}
  html[data-spider-codex="on"] [class*="ComposerLayoutBody-"]{background:transparent!important;box-shadow:none!important}
  html[data-spider-codex="on"] [data-spider-home-composer] [data-composer-rail]{background:rgba(32,21,27,.10)!important;backdrop-filter:none;box-shadow:none}
  html[data-spider-codex="on"] [data-codex-composer] [data-placeholder]::before,
  html[data-spider-codex="on"] textarea[data-codex-composer]::placeholder{color:var(--spider-text-tertiary)!important;opacity:1!important}
  html[data-spider-codex="on"] :is(.bg-user-message,[data-markdown-text-style="user-message"]){--color-text-user-message:var(--spider-text);color:var(--spider-text)!important;text-shadow:0 1px 2px #12070d99}
  html[data-spider-codex="on"] .bg-user-message,
  html[data-spider-codex="on"] [data-markdown-text-style="user-message"]:not(.bg-user-message *){background:rgba(31,25,37,.57)!important;border-radius:14px;backdrop-filter:none;box-shadow:none}
  html[data-spider-codex="on"] [data-local-conversation-final-assistant]{background:transparent!important;backdrop-filter:none;padding:0;border-radius:0;box-shadow:none}
  html[data-spider-codex="on"] [data-markdown-text-style="assistant-message"]{color:#f7f1ee;text-shadow:0 1px 2px #12070db3,0 2px 6px #0008}
  html[data-spider-codex="on"] main [class~="group/activity-header"]{
    --agent-activity-summary-color:var(--spider-text-secondary)
  }
  html[data-spider-codex="on"] main :is([class~="group/activity-header"] .block span,
    [class*="/turn-diff-file-row"] .text-codex-description,
    button.text-codex-description .text-codex-description.tabular-nums){
    color:var(--spider-text-secondary)!important;
    text-shadow:0 1px 2px #1b121e,0 1px 5px #1b121ec0
  }
  html[data-spider-codex="on"] main :is(.text-codex-git-added,.text-codex-git-deleted){
    text-shadow:0 1px 2px #1b121e,0 1px 5px #1b121ec0
  }
  html[data-spider-codex="on"] main .text-codex-git-added{color:#a8edc0!important}
  html[data-spider-codex="on"] main .text-codex-git-deleted{color:#ffb7ad!important}
  html[data-spider-codex="on"] [data-markdown-text-style] pre{background:var(--spider-control)!important;backdrop-filter:none;border-color:#fff2e529}
  html[data-spider-codex="on"] :is(${floatingSelector}){
    --spider-glass-art:var(--spider-clear-art,var(--spider-frosted-art,linear-gradient(#222431,#222431)));
    background:${menuMaterial}!important;border-radius:var(--spider-radius-card)!important;backdrop-filter:blur(4px) saturate(1.12);
    box-shadow:0 8px 24px #1e071a3d,inset 0 1px 0 #fff0e23d;
    --spider-text-secondary:#fff5ee;--spider-text-tertiary:#fff5ee;
    --color-text:var(--spider-text);--color-text-secondary:var(--spider-text-secondary);--color-text-tertiary:var(--spider-text-tertiary);
    --color-token-foreground:var(--spider-text);--color-token-dropdown-background:#2a222d;
    --color-token-text-secondary:var(--spider-text-secondary);color:var(--spider-text)!important;text-shadow:0 1px 1px #190c1999
  }
  html[data-spider-codex="on"] :is(${floatingSelector}){transition-property:opacity!important}
  html[data-spider-codex="on"] :is(${tooltipSelector},[data-spider-usage-popover]){
    background:${opaquePopupMaterial}!important;backdrop-filter:none!important
  }
  [data-spider-usage-tooltip]{position:fixed;z-index:2147482999;pointer-events:none;display:none;
    max-width:min(300px,calc(100vw - 16px));padding:8px 12px;border-radius:10px;color:var(--spider-text);
    background:#30222d;box-shadow:0 3px 9px #18081f55,inset 0 1px 0 #fff4e63d;font:12px/1.5 system-ui}
  html[data-spider-codex="on"][data-spider-surface="workspace"] [data-spider-usage-tooltip]:not([hidden]){display:block}
  html[data-spider-codex="on"][data-reduced-motion="false"] :is(${floatingSelector}){animation-duration:110ms!important;transition-duration:110ms!important}
  html[data-spider-codex="on"] :is(${floatingSelector}) :is([role^="menuitem"],[role="option"],button) :is(.text-default,.text-primary,.text-foreground){color:var(--spider-text)!important}
  html[data-spider-codex="on"] :is(${floatingSelector}) :is([role^="menuitem"],[role="option"]) :is(.truncate,.text-ellipsis){
    min-inline-size:0;white-space:normal!important;overflow-wrap:anywhere
  }
  html[data-spider-codex="on"] :is([role="menu"],[role="listbox"]):not([data-spider-embedded-anchor]){
    overflow-y:auto!important;overscroll-behavior-y:contain
  }
  @layer utilities{
    html[data-spider-codex="on"][data-spider-surface="settings"] [data-radix-popper-content-wrapper] [role="listbox"]{
      max-height:min(var(--radix-popper-available-height,90dvh),max(40px,calc(100dvh - var(--spider-glass-top) - 8px)))!important;
      overflow-y:auto!important;overscroll-behavior-y:contain
    }
  }
  html[data-spider-codex="on"] [data-radix-popper-content-wrapper]>:is([data-state="delayed-open"],[data-state="instant-open"]){font-size:12px!important;line-height:1.5;white-space:normal;max-width:320px;padding:8px 12px!important}
  html[data-spider-codex="on"][data-spider-surface="login"] .text-codex-description{color:#fff5ee!important;text-shadow:0 1px 4px #000b}
  html[data-spider-codex="on"] [data-spider-auth-link],html[data-spider-codex="on"][data-spider-surface="login"] :is(a,button).text-codex-description{color:#fff5ee!important;text-decoration:underline;text-underline-offset:3px;text-shadow:0 1px 4px #000b}
  html[data-spider-codex="on"] [data-spider-auth-heading]{color:#fff5ee!important;text-shadow:0 2px 8px #0009}
  html[data-spider-codex="on"] :is([data-spider-auth-primary],html[data-spider-surface="login"] button.bg-primary-solid){background:rgba(222,185,164,.94)!important;color:#291e24!important;border-radius:12px!important;box-shadow:0 6px 20px #10080728}
  html[data-spider-codex="on"] :is([data-spider-auth-secondary],html[data-spider-surface="login"] button.bg-surface){background:rgba(32,21,27,.76)!important;color:#fff5ee!important;border-color:#ead0bd55!important;border-radius:12px!important}
  html[data-spider-codex="on"] [data-spider-settings]{background:transparent!important}
  html[data-spider-codex="on"][data-spider-surface="profile"] [data-spider-settings] .text-token-text-primary{
    color:var(--spider-text)!important;text-shadow:0 1px 3px #1b0f18a8
  }
  html[data-spider-codex="on"] ${settingsDialogSelector}[data-spider-settings]{
    background:${opaquePopupMaterial}!important;backdrop-filter:none!important
  }
  html[data-spider-codex="on"] ${settingsDialogSelector}[data-spider-settings] .settings-dialog-sidebar{
    background:#281b2870;color:var(--spider-text)
  }
  html[data-spider-codex="on"] [data-spider-settings-pane]{background:transparent!important;border:0!important}
  html[data-spider-codex="on"] [data-spider-glass-panel]{background:${menuMaterial}!important;backdrop-filter:none;border:0!important;border-radius:var(--spider-radius-card)!important;box-shadow:0 6px 17px #10132826,inset 0 1px 0 #fff0e23d,inset 0 0 0 1px #fff1e51c;text-shadow:0 1px 2px #131522bd;--spider-text-secondary:#fff5ee;--spider-text-tertiary:#fff5ee}
  html[data-spider-codex="on"] [data-spider-settings-pane]{--switch-track-color-checked:var(--spider-accent-base);--switch-thumb-color-checked:#eafafa}
  html[data-spider-codex="on"] [role="switch"][aria-checked="true"]>span[data-state="checked"]{background-color:var(--spider-accent-base)!important}
  html[data-spider-codex="on"] [role="switch"]{border-radius:var(--spider-radius-pill)!important;border:0!important;background:transparent!important}
  html[data-spider-codex="on"] summary{border-radius:var(--spider-radius-control)}
  html[data-spider-codex="on"] [data-spider-glass-panel]>:not(:last-child)::after{background:#ffffff0a!important}
  html[data-spider-codex="on"] [data-spider-settings] section.bg-surface:not([role],[data-state]){background:transparent!important}
  html[data-spider-codex="on"] :is([data-spider-settings],[data-spider-settings-pane],[data-spider-glass-panel],${floatingSelector}) :is(.text-secondary,.text-codex-description,.text-token-text-secondary){color:var(--spider-text-secondary)!important}
  html[data-spider-codex="on"] :is([data-spider-settings],[data-spider-settings-pane],[data-spider-glass-panel],${floatingSelector}) :is(.text-tertiary,.text-token-text-tertiary){color:var(--spider-text-tertiary)!important}
  html[data-spider-codex="on"] :is([class*="ComposerLayoutRoot-"],.composer-surface-chrome,[data-composer-rail],${floatingSelector}) :where(${interactiveSelector}):not(:disabled,[aria-disabled="true"],[data-disabled]){
    --button-text-color:var(--spider-text);color:var(--spider-text)
  }
  html[data-spider-codex="on"] :is([data-spider-settings],[data-spider-settings-pane],[data-spider-glass-panel]) :is(button.bg-surface,[role="combobox"],select,input:not([type="checkbox"],[type="radio"],[type="range"],[type="color"]),textarea):not(:disabled,[aria-disabled="true"],[data-disabled]),
  html[data-spider-codex="on"][data-spider-surface="workspace-picker"] #root button:not(:disabled,[aria-disabled="true"],[data-disabled]){
    --button-text-color:var(--spider-text);background:var(--spider-control)!important;color:var(--spider-text)!important;
    border:1px solid var(--spider-control-edge)!important;border-radius:var(--spider-radius-control)
  }
  html[data-spider-codex="on"] :is([data-spider-settings],[data-spider-settings-pane],[data-spider-glass-panel]) :is(input,textarea)::placeholder{color:var(--spider-text-tertiary);opacity:1}
  html[data-spider-codex="on"] :is([data-spider-settings],[data-spider-settings-pane],[data-spider-glass-panel]) :is(${settingsControls}){
    background:transparent!important;color:var(--spider-text)!important;--button-text-color:var(--spider-text);
    border:1px solid #f5ded425!important;border-radius:var(--spider-radius-control);box-shadow:none!important
  }
  html[data-spider-codex="on"] :is([data-spider-settings],[data-spider-settings-pane],[data-spider-glass-panel]) :is(${settingsControls}):is(:hover,[aria-expanded="true"]):not(:disabled,[aria-disabled="true"],[data-disabled]){
    background:linear-gradient(145deg,#f9e1ee19,#e7cad709)!important;border-color:#f5ded448!important
  }
  html[data-spider-codex="on"] :is([data-spider-settings],[data-spider-settings-pane],[data-spider-glass-panel]) :is(${settingsControls}) :is(span,svg):not([style*="background-color" i]){color:inherit!important}
  html[data-spider-codex="on"] :is([data-spider-settings],[data-spider-settings-pane],[data-spider-glass-panel]) :is(${settingsControls}):is(:disabled,[aria-disabled="true"],[data-disabled]){color:var(--spider-text-tertiary)!important;opacity:.6!important}
  html[data-spider-codex="on"] :is([data-spider-settings],[data-spider-settings-pane]) button.p-0.border-0:not(.w-full){
    display:inline-flex;align-items:center;justify-content:center;min-block-size:28px;padding:4px 8px!important;gap:6px;
    line-height:1.5;border:0!important;border-radius:var(--spider-radius-control)!important;background:transparent!important
  }
  html[data-spider-codex="on"] :is(${composerSelector},[data-composer-rail]) :is([class*="text-orange"],[aria-label*="权限"],[aria-label*="access" i]){
    color:#ffe5bc!important;--button-text-color:#ffe5bc;text-shadow:0 1px 3px #200a12
  }
  html[data-spider-codex="on"] :is(${composerSelector},[data-composer-rail]) button:is([aria-label*="权限"],[aria-label*="access" i]) :is([class*="ComposerDropdownLabelIcon-"],[class*="ComposerDropdownLabelValue-"],[class*="ComposerDropdownLabelValueContent-"]){
    color:inherit!important
  }
  html[data-spider-codex="on"][data-spider-surface] ${primaryActionSelector}{
    --spider-action-light:.35;--spider-action-icon:#fff7f0;
    --spider-action-glint:255 211 183;--spider-action-tint:249 107 115;
    background:linear-gradient(155deg,rgb(var(--spider-action-glint) / calc(.16 + var(--spider-action-light)*.18)),
      rgb(var(--spider-action-tint) / calc(.045 + var(--spider-action-light)*.08)) 50%,
      rgb(var(--spider-action-tint) / calc(.08 + var(--spider-action-light)*.09)))!important;
    color:var(--spider-action-icon)!important;border:1px solid rgb(var(--spider-action-glint) / calc(.31 + var(--spider-action-light)*.20))!important;
    box-shadow:inset 0 1px 0 rgb(var(--spider-action-glint) / .49),inset 0 -1px 0 #3a102329,0 2px 7px #130a1c29;
    backdrop-filter:blur(2.5px) saturate(1.45) brightness(1.10)
  }
  html[data-spider-codex="on"][data-spider-surface] ${primaryActionSelector}:is([aria-label^="停止"],[aria-label^="Stop" i]){
    --spider-action-icon:#ffc0c2;--spider-action-glint:255 187 177;--spider-action-tint:250 85 100
  }
  html[data-spider-codex="on"][data-spider-surface] ${primaryActionSelector}:is([data-composer-voice-start],[aria-label*="语音"],[aria-label*="voice" i]){
    --spider-action-glint:255 222 190;--spider-action-tint:252 144 117
  }
  html[data-spider-codex="on"][data-spider-surface] body ${primaryActionSelector}:hover:not(:where(${unavailableControlSelector})){
    --spider-action-light:1;translate:0 -4px;scale:1.13;
    box-shadow:inset 0 1px 1px #ffe4d4e6,inset 0 -2px 2px #380f234d,0 3px 5px #250a2199,0 11px 22px #18091f80!important
  }
  html[data-spider-codex="on"][data-spider-surface] body ${primaryActionSelector}:active:not(:where(${unavailableControlSelector})){--spider-action-light:.5;translate:0 0;scale:.98;box-shadow:inset 0 1px 3px #10091433!important}
  html[data-spider-codex="on"][data-spider-surface] ${primaryActionSelector}:is(${unavailableControlSelector}){
    /* Keep the native disabled state obvious without making its symbol illegible. */
    --spider-action-light:0;--spider-action-icon:#d9c5ca;
    background:linear-gradient(155deg,#cdb7c02b,#9e879a0e)!important;
    border-color:#e2c9d42e!important;
    box-shadow:inset 0 1px 0 #fff0ed22;
    backdrop-filter:none
  }
  html[data-spider-codex="on"][data-spider-surface] body ${primaryActionSelector} svg{color:var(--spider-action-icon)!important;filter:drop-shadow(0 1px 1px #10091455)}
  html[data-spider-codex="on"] :is(${composerSelector},[data-composer-rail]) button[data-spider-permission-button]:not(:hover,:focus-visible){
    background-color:transparent!important
  }
  html[data-spider-codex="on"] :is(${floatingSelector}) :is([role="option"],[role^="menuitem"]):is([aria-selected="true"],[aria-checked="true"],[data-highlighted]):not([aria-disabled="true"],[data-disabled]){
    background:rgba(255,255,255,.06)!important;color:var(--spider-text)!important;box-shadow:none!important
  }
  html[data-spider-codex="on"] :is(${floatingSelector}) :is(${floatingRowSelector}){border-radius:var(--spider-radius-control)!important}
  /* A wallpaper-backed outer surface does not move a fixed-position submenu. */
  html[data-spider-codex="on"] :is(${floatingSelector})[data-spider-embedded-anchor]{
    background:${menuMaterial}!important;backdrop-filter:none!important
  }
  html[data-spider-codex="on"] :where(${interactiveSelector}):focus-visible:not(:where(${unavailableControlSelector})),
  html[data-spider-codex="on"] [data-spider-settings] :is(input:not([type="checkbox"],[type="radio"],[type="range"],[type="color"]),textarea):focus:not(:disabled){
    outline:2px solid var(--spider-focus)!important;outline-offset:2px
  }
  html[data-spider-codex="on"] :is(${floatingSelector}) :is(${floatingRowSelector}){
    outline-offset:-2px
  }
  html[data-spider-codex="on"] :is(${floatingSelector}) :is(${floatingRowSelector}):focus-visible:not(:where(${unavailableControlSelector})){
    outline:1.5px solid var(--spider-focus-inset)!important
  }
  html[data-spider-codex="on"][data-spider-surface][data-spider-native-dark] body :is(${rowActionSelector}):focus-visible:not(:where(${unavailableControlSelector},:is(${floatingSelector}) *)){
    outline:1.5px solid #ffe3d4c0!important;outline-offset:-2px!important;box-shadow:none!important
  }
  html[data-spider-codex="on"] :is(main,aside,${floatingSelector}) :is([role="search"],${searchInputs}){
    background:transparent!important;color:var(--spider-text)!important;
    border-color:#f5ded42d!important;box-shadow:none
  }
  html[data-spider-codex="on"] :is(main,aside,${floatingSelector}) :is(${searchInputs})::placeholder{
    color:var(--spider-text-tertiary)!important;opacity:1
  }
  html[data-spider-codex="on"] :is(main,aside,[data-spider-settings],[data-spider-settings-pane],${floatingSelector}) :is(${searchInputs}):not(:disabled,[aria-disabled="true"]),
  html[data-spider-codex="on"] :is(main,aside,[data-spider-settings],[data-spider-settings-pane],${floatingSelector}) :is(${searchInputs}):not(:disabled,[aria-disabled="true"]):focus{
    border-color:transparent!important;outline:none!important;box-shadow:none!important;
    background:transparent!important
  }
  html[data-spider-codex="on"] :is(main,aside,[data-spider-settings],[data-spider-settings-pane],${floatingSelector}) :is(${searchInputs}):not(:disabled,[aria-disabled="true"]):focus{
    box-shadow:inset 0 -1px 0 #ffbe9f9e!important
  }
  html[data-spider-codex="on"][data-spider-surface="settings"] :is(aside,nav,[role="tablist"],[data-spider-settings],[data-spider-settings-pane]) :is(button,a,[role="tab"],[role="button"]) svg{
    color:var(--spider-text-secondary)!important;filter:drop-shadow(0 1px 2px #1a101bdb)
  }
  html[data-spider-codex="on"][data-spider-surface="settings"] :is(aside,nav,[role="tablist"]) :is(button,a,[role="tab"],[role="button"]):not(:disabled,[aria-disabled="true"],[data-disabled]) svg{
    opacity:1!important
  }
  html[data-spider-codex="on"] :is(${floatingSelector}) :is(${sliderSurfaces}):not(:where(.react-colorful,.react-colorful *)){
    outline:none!important;background-color:transparent!important;border-color:transparent!important;box-shadow:none!important
  }
  html[data-spider-codex="on"] :is(${floatingSelector}) :is([role="slider"],input[type="range"]):not(:where(.react-colorful *)):focus-visible{
    outline:1px solid #f5d9ca9e!important;outline-offset:2px;border-radius:999px
  }
  /* The reasoning picker focuses a menu item wrapping a separate slider. */
  html[data-spider-codex="on"] :is(${floatingSelector}) [data-reasoning-slider][role]:is(*,:focus-visible,[data-highlighted]),
  html[data-spider-codex="on"] [data-reasoning-slider],
  html[data-spider-codex="on"] [data-reasoning-slider] [data-model-picker-power-slider]{
    outline:none!important;border-color:transparent!important;background:transparent!important;box-shadow:none!important
  }
  html[data-spider-codex="on"] :is(${floatingSelector}) [data-reasoning-slider]:focus-visible [role="slider"],
  html[data-spider-codex="on"] :is(${floatingSelector}) [data-model-picker-power-slider][data-keyboard-focused="true"] [role="slider"]{
    border-radius:50%!important;outline:2px solid var(--spider-focus)!important;outline-offset:1px
  }
  /* Nested command palettes can inherit an empty backdrop from the composer.
     Composite wallpaper here without exposing the conversation under its labels. */
  html[data-spider-codex="on"] :is([cmdk-root][data-spider-floating-surface],:is(${composerSelector}) :is([role="menu"],[role="listbox"],[data-spider-popup-panel])):not([data-spider-embedded-anchor]){
    background:${menuMaterial}!important;
    backdrop-filter:none;color:var(--spider-text)!important
  }
  html[data-spider-codex="on"] [class~="group/turn-diff-header"] :is(button.bg-background-neutral-soft-alpha,[class~="bg-surface-secondary/92"]){
    background-color:rgba(29,34,47,.58)!important;color:var(--spider-text)!important;border-color:#bce2e647!important
  }
  html[data-spider-codex="on"] [class~="group/turn-diff-header"] button.bg-background-neutral-soft-alpha{border-radius:var(--spider-radius-control)!important}
  html[data-spider-codex="on"] [class~="group/turn-diff-header"] button.bg-background-neutral-soft-alpha:is(:hover,:focus-visible):not(:disabled,[aria-disabled="true"]){
    background-color:rgba(45,83,89,.86)!important
  }
  html[data-spider-codex="on"][data-spider-surface] [class~="group/turn-diff-header"] [class~="bg-surface-secondary/92"]{
    background:rgba(255,245,238,.10)!important;border:1px solid #fff5ee26!important;border-radius:var(--spider-radius-control)!important;color:var(--spider-text)!important
  }
  html[data-spider-codex="on"] [class~="group/turn-diff-header"] [class~="bg-surface-secondary/92"] svg{color:var(--spider-text)!important;opacity:1!important}
  html[data-spider-codex="on"] [data-spider-diff-card]{border-radius:var(--spider-radius-card)!important;overflow:hidden}
  html[data-spider-codex="on"] [data-spider-diff-card] button[class*="resource-card-row-padding-x"]{border-radius:0!important}
  html[data-spider-codex="on"] [data-spider-diff-card] button[data-spider-diff-end]{border-radius:0 0 var(--spider-radius-card) var(--spider-radius-card)!important}
  html[data-spider-codex="on"] [data-spider-media-preview]{border-radius:var(--spider-radius-card)!important}
  html[data-spider-codex="on"] [data-spider-media-preview] img{border-radius:calc(var(--spider-radius-card) - 1px)!important}
  html[data-spider-codex="on"] [data-spider-media-sent]{overflow:hidden!important}
  html[data-spider-codex="on"] [data-spider-activity-surface]{padding:2px 6px;min-block-size:25px;border-radius:var(--spider-radius-control);transition:box-shadow 240ms ease,translate 300ms cubic-bezier(.18,.9,.25,1.18)}
  html[data-spider-codex="on"] [data-spider-activity-surface]:hover{translate:0 -1px;background:linear-gradient(155deg,#fff2db15,#ffffff00 50%,#180b2812);box-shadow:0 1px 2px #18081f52,0 4px 9px #10091e47}
  html[data-spider-codex="on"][data-spider-surface][data-spider-native-dark] body button[data-spider-activity-hit]:is(:hover,:active){translate:none!important;scale:none!important;box-shadow:none!important;outline:none!important;border-radius:inherit}
  html[data-spider-codex="on"][data-spider-surface][data-spider-native-dark] body button[data-spider-activity-hit]:focus-visible{box-shadow:none!important;outline:1.5px solid var(--spider-focus)!important;outline-offset:-2px!important;border-radius:inherit}
  html[data-spider-codex="on"] :is(main,aside,[role="menubar"]) :is(button[aria-label],[role="button"][aria-label])>svg{
    filter:drop-shadow(0 1px 2px #12070dd9)
  }
  html[data-spider-codex="on"] :is(aside .sidebar-item,[data-spider-settings] :is(button,a,[role="tab"],[role="button"])):not(:disabled,[aria-disabled="true"],[data-disabled],${primaryActionSelector}) svg{
    color:var(--spider-text)!important;opacity:1!important;filter:drop-shadow(0 1px 2px #12070dd9)
  }
  html[data-spider-codex="on"] [data-spider-attachment-panel]{
    background:${menuMaterial}!important;
    color:var(--spider-text)!important;isolation:isolate;border-radius:var(--spider-radius-card)!important
  }
  html[data-spider-codex="on"] [data-spider-attachment-panel] :is(${attachmentRow}) :is(.text-secondary,.text-tertiary,.text-codex-description){
    color:var(--spider-text-secondary)!important
  }
  html[data-spider-codex="on"] [data-spider-attachment-panel] [data-list-navigation-item]{border-radius:var(--spider-radius-control)!important}
  html[data-spider-codex="on"] [data-spider-attachment-panel] [data-list-navigation-item]:not(:disabled,[aria-disabled="true"],[data-disabled]){opacity:1!important}
  html[data-spider-codex="on"] [data-spider-attachment-panel] [data-mention-section-id]>:first-child:not([data-mention-section-items]){
    background:${menuMaterial}!important;backdrop-filter:blur(7px)
  }
  html[data-spider-codex="on"] [data-spider-monochrome-icon]{filter:brightness(0) invert(1)}
  /* Native mini-window previews and plugin logos also appear inside settings. */
  html[data-spider-codex="on"][data-spider-surface="settings"] main button>.pointer-events-none>[class*="Material-"]{
    background:${menuMaterial}!important;color:var(--spider-text)!important;backdrop-filter:blur(4px) saturate(1.1);
    box-shadow:inset 0 1px 0 #fff4e64d,0 2px 6px #10091e33
  }
  html[data-spider-codex="on"][data-spider-surface="settings"] main .size-9>img.object-contain{
    filter:drop-shadow(0 0 .65px #fff5eed9) drop-shadow(0 1px 1px #12070d99)
  }
  html[data-spider-codex="on"] [data-spider-glass-aligned]{
    --spider-frost-layer:var(--spider-glass-art) calc(var(--spider-bg-x) - var(--spider-glass-left)) calc(var(--spider-bg-y) - var(--spider-glass-top))/var(--spider-bg-size) no-repeat scroll border-box
  }
  /* Native controls use several parallel token families. Keep their foreground
     and background pairs coherent even when a page has never been opened. */
  html[data-spider-codex="on"]{
    ${feedbackTokens}
    --app-color-text-foreground:var(--spider-text);--app-color-text-foreground-secondary:var(--spider-text-secondary);--app-color-text-foreground-tertiary:var(--spider-text-tertiary);
    --app-color-text-button-primary:#fffaf6;--app-color-text-button-secondary:var(--spider-text);--app-color-text-button-tertiary:var(--spider-text-secondary);
    --app-color-icon-primary:var(--spider-text);--app-color-icon-secondary:var(--spider-text-secondary);--app-color-icon-tertiary:var(--spider-text-tertiary);
    --color-codex-icon:var(--spider-text-secondary);--color-codex-icon-active:var(--spider-text);
    --color-token-dropdown-foreground:var(--spider-text);--color-token-description-foreground:var(--spider-text-secondary);
    --color-text-secondary-solid:var(--spider-text);--color-text-primary-solid:#fffaf6;--color-text-neutral-solid:#fffaf6;
    --color-text-accent-solid:#fffaf6;--color-text-accent-action:var(--spider-accent);--color-text-on-accent:#fffaf6;
    --color-text-disabled:#d0bbb0;--color-codex-editor-inline-code-foreground:var(--spider-text-secondary);
    --color-surface-secondary:rgba(255,238,226,.10);--color-surface-tertiary:rgba(255,238,226,.15);
    --color-background-neutral-soft-alpha:rgba(30,24,32,.76);--app-color-background-control:rgba(30,24,32,.76);--input-soft-background-color:rgba(30,24,32,.76);
    --app-color-background-elevated-secondary:rgba(30,24,32,.92);--app-color-background-elevated-tertiary-opaque:#241e27;
    --app-color-background-button-primary:var(--spider-accent-base);--app-color-background-button-primary-hover:var(--spider-accent-hover);--app-color-background-button-primary-active:var(--spider-accent-pressed);
    --color-background-primary-solid:var(--spider-accent-base);--color-background-primary-solid-hover:var(--spider-accent-hover);--color-background-primary-solid-active:var(--spider-accent-pressed);
    --color-background-accent-solid:var(--spider-accent-base);--color-background-accent-solid-hover:var(--spider-accent-hover);--color-background-accent-solid-active:var(--spider-accent-pressed);
    --color-background-neutral-solid:#52404b;--color-background-neutral-solid-hover:#66515c;--color-background-neutral-solid-active:#44343e;
    --color-background-secondary-solid:#ffffff12;--color-background-secondary-solid-hover:#ffffff20;--color-background-secondary-solid-active:#ffffff2b;
    --color-background-primary-ghost-hover:#ffffff15;--color-background-secondary-ghost-hover:#ffffff15;--color-background-accent-ghost-hover:#f16a5326;
    --color-background-primary-soft-hover:#f16a5326;--color-background-primary-soft-active:#f16a5338;--color-background-secondary-soft-hover:#ffffff15;--color-background-secondary-soft-active:#ffffff22;
    --color-background-button-outline-hover:#ffffff15;--menu-item-background-color:#ffffff15;
    --app-color-background-button-secondary:#ffffff0d;--app-color-background-button-secondary-hover:#ffffff1b;--app-color-background-button-secondary-active:#ffffff29;
    --app-color-background-button-tertiary-hover:#ffffff15;--app-color-background-button-tertiary-active:#ffffff24;
    --app-color-background-application-menu:#241e27;--app-color-foreground-application-menu:var(--spider-text);
    --color-background-tooltip-classic:#241e27;--color-text-tooltip-classic:var(--spider-text);--color-token-dropdown-background:#241e27;
    --color-border-button-outline:#f6ded34a;
    --color-border-primary-outline:#f6ded34a;--color-border-secondary-outline:#f6ded34a;--color-border-accent-outline:#ffac8766;
    --color-token-border-default:#f6ded326;--color-token-border-heavy:#f6ded34a;--color-token-input-border:#f6ded34a;
    --input-outline-border-color:#f6ded34a;--button-surface-border-color:#f6ded326;--radio-group-indicator-border-color:#f6ded34a;
    --radio-group-indicator-background-color:var(--spider-accent);--radio-group-indicator-hole-background-color:#241e27;
    --app-color-border-application-menu-separator:#f6ded326;--menu-separator-background-color:#f6ded326;
    --color-token-scrollbar-slider-background:#f6ded349;--color-token-scrollbar-slider-hover-background:#f6ded37a;--color-token-scrollbar-slider-active-background:#f6ded394
  }
  html[data-spider-codex="on"] [data-spider-home-svg]{visibility:visible!important;opacity:0!important}
  html[data-spider-codex="on"] diffs-container[data-spider-code-surface]{
    --spider-glass-art:var(--spider-frosted-art,linear-gradient(#222431,#222431));
    background:linear-gradient(150deg,#16162326,#14182448) fixed,var(--spider-frost-layer),#232330!important;
    color:var(--spider-text)!important;color-scheme:dark!important;text-shadow:none!important;border-radius:10px
  }
  html[data-spider-codex="on"] :is(${quotaProgressSelector}){
    appearance:none;height:8px!important;border-radius:999px;border:0;background:#fff0e61c;color:#ffb58b
  }
  html[data-spider-codex="on"] :is(${quotaProgressSelector})::-webkit-progress-bar{
    background:#fff0e61c!important;border-radius:999px;box-shadow:inset 0 1px 2px #210c1d45
  }
  html[data-spider-codex="on"] :is(${quotaProgressSelector})::-webkit-progress-value{
    background:linear-gradient(90deg,#e95656,#ffb58b)!important;border-radius:999px;box-shadow:inset 0 1px 1px #ffe8cba6,0 0 5px #ef6c5e36
  }
  html[data-spider-codex="on"] :is(${quotaProgressSelector})::-moz-progress-bar{
    background:linear-gradient(90deg,#e95656,#ffb58b)!important;border-radius:999px
  }
  html[data-spider-codex="on"] [data-spider-quota-row] .text-end{color:#ffdcbe!important;font-weight:650;text-shadow:0 1px 3px #2b1026cc}
  html[data-spider-codex="on"] [data-spider-quota-group]::after{
    content:"Bright bar = remaining · Dim track = used";display:block;padding:0 16px 12px;color:var(--spider-text-secondary);font-size:11px;line-height:1.5
  }
  html[data-spider-codex="on"]:lang(zh) [data-spider-quota-group]::after{content:"亮色：剩余额度 · 暗色：已用额度"}
  /* Local movement and reflected light; no permanent compositing layers. */
  @media(hover:hover){
    html[data-spider-codex="on"][data-spider-surface][data-spider-native-dark] body :is(${hoverControlSelector}):not(:where(${unavailableControlSelector},[data-reasoning-slider],.react-colorful *)){
      transition:--spider-action-light 240ms ease,box-shadow 260ms ease,translate var(--spider-lift-duration) var(--spider-lift-easing),scale var(--spider-lift-duration) var(--spider-lift-easing)
    }
    html[data-spider-codex="on"][data-spider-surface][data-spider-native-dark] body :is(${hoverControlSelector}):not(:where(${unavailableControlSelector},[data-reasoning-slider],.react-colorful *,${primaryActionSelector})):hover{
      translate:0 -2px;scale:1.055;
      box-shadow:var(--spider-hover-shadow)!important
    }
    html[data-spider-codex="on"][data-spider-surface][data-spider-native-dark] body aside :is([data-sidebar-destination],[data-spider-avatar-button]):not(:disabled,[aria-disabled="true"]):hover{translate:0 -3px;scale:1.11}
    html[data-spider-codex="on"][data-spider-surface][data-spider-native-dark] body :is(${floatingSelector}) :is(${floatingControlSelector}):not(:where(${unavailableControlSelector},[data-reasoning-slider],[data-reasoning-slider] *,.react-colorful *)):hover{
      translate:none;scale:none;box-shadow:var(--spider-menu-hover-shadow)!important
    }
    html[data-spider-codex="on"][data-spider-surface][data-spider-native-dark] body :is(${rowActionSelector}):not(:where(${standaloneControlSelector},:is(${floatingSelector}) *,[data-reasoning-slider],[data-reasoning-slider] *,.react-colorful *)):is(:hover,:active){
      translate:none!important;scale:none!important;
      box-shadow:none!important
    }
    /* The scrollable attachment list can move when its native keyboard focus follows the pointer.
       Paint the light on the row itself so it stays clipped and follows the row without a second overlay. */
    html[data-spider-codex="on"][data-spider-surface][data-spider-native-dark] body ${attachmentControlSelector}:not(:where(${unavailableControlSelector})){
      background-image:linear-gradient(106deg,rgba(255,226,200,calc(var(--spider-attachment-light)*.15)),transparent 72%)!important;
      transition:--spider-attachment-light var(--spider-lift-duration) var(--spider-lift-easing),box-shadow 260ms ease
    }
    html[data-spider-codex="on"] ${attachmentControlSelector}:not(:where(${unavailableControlSelector})):hover{--spider-attachment-light:1}
    html[data-spider-codex="on"] :is(${floatingSelector}) :is(${floatingControlSelector}):not(:where([data-reasoning-slider],[data-reasoning-slider] *,.react-colorful *))>:is(svg,span,div){transition:translate var(--spider-lift-duration) var(--spider-lift-easing),scale var(--spider-lift-duration) var(--spider-lift-easing)}
    html[data-spider-codex="on"] :is(${floatingSelector}) :is(${floatingControlSelector}):not(:where(${unavailableControlSelector},[data-reasoning-slider],[data-reasoning-slider] *,.react-colorful *)):hover>:is(svg,span,div){translate:0 -2px}
    html[data-spider-codex="on"] :is(${floatingSelector}) :is(${floatingControlSelector}):not(:where(${unavailableControlSelector},[data-reasoning-slider],[data-reasoning-slider] *,.react-colorful *)):hover>svg{scale:1.12}
    html[data-spider-codex="on"][data-spider-surface][data-spider-native-dark] body :is(${hoverControlSelector}):not(:where(${unavailableControlSelector},[data-reasoning-slider],.react-colorful *,${primaryActionSelector})):active{
      translate:0 0;scale:.98;box-shadow:inset 0 1px 3px #10091c26!important
    }
  }
  @media(prefers-reduced-motion:reduce){
    html[data-spider-codex="on"] :where(${hoverControlSelector}){transition:none!important;translate:none!important;scale:none!important}
  }
  html[data-spider-codex="on"][data-reduced-motion="true"] :is(${hoverControlSelector}){transition:none!important;translate:none!important;scale:none!important}
  @media(prefers-reduced-motion:reduce){html[data-spider-codex="on"] :is(${floatingSelector}) :is(button,[role="button"],[role^="menuitem"],[role="option"])>:is(svg,span,div){transition:none!important;translate:none!important;scale:none!important}}
  html[data-spider-codex="on"][data-reduced-motion="true"] :is(${floatingSelector}) :is(button,[role="button"],[role^="menuitem"],[role="option"])>:is(svg,span,div){transition:none!important;translate:none!important;scale:none!important}
  [data-spider-hover-light]{position:fixed;z-index:2147483000;pointer-events:none!important;overflow:hidden;contain:strict;
    opacity:0;visibility:hidden;mix-blend-mode:screen;
    background:radial-gradient(ellipse 80px 45px at var(--spider-light-x,50%) var(--spider-light-y,50%),#fff9ed26,transparent 75%);
    transition:opacity 150ms ease,visibility 0s 150ms}
  [data-spider-hover-light][data-active="true"]{opacity:1;visibility:visible;transition:opacity 130ms ease}
  [data-spider-hover-light]::after{content:"";position:absolute;inset:-60%;pointer-events:none;
    background:linear-gradient(110deg,transparent 40%,#fff7e829 49%,transparent 58%);opacity:0}
  html:not([data-spider-codex="on"]) [data-spider-hover-light],[data-spider-hover-light][data-detached]{display:none}
  [data-spider-hover-light][data-active="true"][data-cycle="0"]::after{animation:spider-light-sweep-a 760ms ease-out both}
  [data-spider-hover-light][data-active="true"][data-cycle="1"]::after{animation:spider-light-sweep-b 760ms ease-out both}
  @keyframes spider-light-sweep-a{0%{transform:translateX(-55%);opacity:0}20%{opacity:1}100%{transform:translateX(55%);opacity:0}}
  @keyframes spider-light-sweep-b{0%{transform:translateX(-55%);opacity:0}20%{opacity:1}100%{transform:translateX(55%);opacity:0}}
  @media(prefers-reduced-motion:reduce){[data-spider-hover-light]::after{animation:none!important}[data-spider-hover-light]{transition:none!important}}
  html[data-reduced-motion="true"] [data-spider-hover-light]::after{animation:none!important}
  html[data-reduced-motion="true"] [data-spider-hover-light]{transition:none!important}
  html[data-spider-codex="on"] [data-spider-raised-static]{position:relative}
  html[data-spider-codex="on"] [data-spider-raised-row]{isolation:isolate}
  html[data-spider-codex="on"][data-spider-surface][data-spider-native-dark] body [data-spider-raised-row]{transition:opacity 180ms ease}
  html[data-spider-codex="on"][data-spider-surface][data-spider-native-dark] body [data-spider-raised-row]:is(:hover,:active){translate:none!important;scale:none!important;box-shadow:none!important}
  html[data-spider-codex="on"] [data-spider-raised-row]::before{
    content:"";position:absolute;inset:2px 4px!important;z-index:-1!important;pointer-events:none!important;border-radius:var(--spider-radius-control)!important;
    opacity:0;translate:0 1px;background:linear-gradient(155deg,#fff2db15,#f9dfca06 44%,#180b2824)!important;
    box-shadow:inset 0 1px 1px #fff4e694,inset 0 -1px 1px #21102a66,0 2px 3px #18081f66,0 5px 9px #10091e55;
    transition:opacity 180ms ease,translate 300ms cubic-bezier(.18,.9,.25,1.18)
  }
  html[data-spider-codex="on"] [data-spider-raised-row]:is([data-spider-raised-active],:hover):not(:where(${unavailableControlSelector}))::before{opacity:1;translate:0 -1px}
  html[data-spider-codex="on"] [data-spider-raised-row]>:is(span,div,svg):not(.sr-only){transition:translate 300ms cubic-bezier(.18,.9,.25,1.18)}
  html[data-spider-codex="on"] [data-spider-raised-row]:is([data-spider-raised-active],:hover):not(:where(${unavailableControlSelector}))>:is(span,div,svg):not(.sr-only){translate:0 -1px}
  html[data-spider-codex="on"] [class~="group/summary-panel-item"]{border-radius:var(--spider-radius-control)!important}
  html[data-spider-codex="on"] [class~="group/summary-panel-item"]::before{border-radius:inherit!important;transition:box-shadow 240ms ease,translate 300ms cubic-bezier(.18,.9,.25,1.18)}
  html[data-spider-codex="on"] [class~="group/summary-panel-item"]:hover::before{translate:0 -1px;background:linear-gradient(155deg,#fff2db15,#f9dfca06 44%,#180b2824)!important;box-shadow:inset 0 1px 1px #fff4e67a,0 2px 3px #18081f66,0 5px 9px #10091e55!important}
  html[data-spider-codex="on"][data-spider-surface][data-spider-native-dark] body button[class~="group/summary-panel-item"]:is(:hover,:active){translate:none!important;scale:none!important;box-shadow:none!important}
  /* These controls already have one visual owner. Keep generic menu/button
     effects from adding a second moving outline to the transparent hit box. */
  @layer spider-surface-owner{
    html[data-spider-codex="on"] :is(button[data-spider-activity-hit],button[data-spider-compact-hit],button[class~="group/summary-panel-item"]):is(:hover,:active){translate:none!important;scale:none!important;box-shadow:none!important}
  }
  html[data-spider-codex="on"] [data-spider-compact-surface]{transition:box-shadow 240ms ease}
  html[data-spider-codex="on"] [data-spider-compact-surface]:has([data-spider-compact-hit]:hover){box-shadow:inset 0 1px 1px #fff4e64d,inset 0 -1px 1px #18081f1a,0 1px 2px #10091e26}
  @media(prefers-reduced-motion:reduce){html[data-spider-codex="on"] [data-spider-raised-row]::before,html[data-spider-codex="on"] [data-spider-raised-row]>:is(span,div,svg){transition:none!important;translate:none!important}}
  html[data-spider-codex="on"][data-reduced-motion="true"] [data-spider-raised-row]::before,html[data-spider-codex="on"][data-reduced-motion="true"] [data-spider-raised-row]>:is(span,div,svg){transition:none!important;translate:none!important}
  @media(prefers-reduced-motion:reduce){html[data-spider-codex="on"] [class~="group/summary-panel-item"]::before{transition:none!important;translate:none!important}}
  html[data-spider-codex="on"][data-reduced-motion="true"] [class~="group/summary-panel-item"]::before{transition:none!important;translate:none!important}
  html[data-spider-codex="on"] [data-spider-raised-row]:is([data-spider-raised-active],:hover){background-color:transparent!important;opacity:1!important}
  html[data-spider-codex="on"][data-spider-surface][data-spider-native-dark] body [data-spider-native-edge]:not(:where(${primaryActionSelector},${unavailableControlSelector})):hover{box-shadow:0 1px 2px #18081f40,0 3px 8px #10091e59!important}
  /* Thin status labels need a contact shadow, not the tall button's deep base. */
  @layer spider-surface-owner{
    html[data-spider-codex="on"] [data-spider-compact-hover]:hover{
      box-shadow:inset 0 1px .5px #fff4e64d,0 1px 2px #18081f33,0 3px 6px #10091e33!important
    }
    @media(prefers-reduced-motion:no-preference){html[data-spider-codex="on"]:not([data-reduced-motion="true"]) [data-spider-compact-hover]:hover{translate:0 -1px!important;scale:1.025!important}}
  }
  @media(prefers-reduced-motion:reduce){html[data-spider-codex="on"] [data-spider-activity-surface]{transition:none!important;translate:none!important}}
  html[data-spider-codex="on"][data-reduced-motion="true"] [data-spider-activity-surface]{transition:none!important;translate:none!important}
  `;
  document.head.append(style);
  // Shipped textures are derived from the exact wallpaper bytes. An older
  // customized installation can still generate its own matching textures.
  const prepared=config.preparedGlass;
  const frostReady=reuseTexture('frost','--spider-frosted-art')||
    !!prepared?.frost&&cacheTexture('frost',prepared.frost,'--spider-frosted-art');
  const clearReady=artworkCache.clearRevision===2&&reuseTexture('clear','--spider-clear-art')||
    !!prepared?.clear&&cacheTexture('clear',prepared.clear,'--spider-clear-art');
  if(clearReady)artworkCache.clearRevision=2;
  artworkCache.preparedOnDisk=!!prepared&&frostReady&&clearReady;
  Promise.allSettled([frostReady||prepareGlassArtwork(),clearReady||prepareClearArtwork()])
    .then(()=>{artworkDecode=undefined;});
  const tagged=new Set(),homeTagged=new Set(),iconTagged=new Set(),settingsTagged=new Set(),glassTagged=new Set(),paneTagged=new Set(),popupTagged=new Set(),attachmentTagged=new Set(),floatingTagged=new Set(),monochromeTagged=new Set(),quotaRowsTagged=new Set(),quotaGroupsTagged=new Set(),embeddedTagged=new Set(),sliderShellsTagged=new Set(),permissionsTagged=new Set();
  const placedGlass=new Map();
  const avatarTagged=new Set();
  const usagePopoversTagged=new Set();
  let usageTooltip,usageTimer=0,usageTarget;
  function hideUsageTooltip(){
    clearTimeout(usageTimer);usageTimer=0;usageTarget=null;
    if(usageTooltip)usageTooltip.hidden=true;
  }
  function scheduleUsageTooltip(event){
    const button=event.target.closest?.(usageTrigger);
    if(!button||button===usageTarget||event.type==='focusin'&&!button.matches(':focus-visible'))return;
    hideUsageTooltip();usageTarget=button;
    usageTimer=setTimeout(()=>{
      usageTimer=0;
      if(removed||!button.isConnected||!button.matches(':hover,:focus-visible')||
         button.matches('[aria-expanded="true"],[aria-describedby]')||root.dataset.spiderCodex!=='on')return;
      const description=button.getAttribute('aria-description')?.trim();
      if(!description)return;
      if(!usageTooltip){
        usageTooltip=document.createElement('div');usageTooltip.setAttribute('data-spider-usage-tooltip','');
        usageTooltip.setAttribute('aria-hidden','true');document.body.append(usageTooltip);
      }
      usageTooltip.textContent=description;
      usageTooltip.hidden=false;
      const anchor=button.getBoundingClientRect(),tip=usageTooltip.getBoundingClientRect();
      usageTooltip.style.left=Math.max(8,Math.min(anchor.right+8,innerWidth-tip.width-8))+'px';
      usageTooltip.style.top=Math.max(8,Math.min(anchor.top+(anchor.height-tip.height)/2,innerHeight-tip.height-8))+'px';
    },380);
  }
  function leaveUsageTooltip(event){if(usageTarget&&!usageTarget.contains(event.relatedTarget))hideUsageTooltip();}
  document.addEventListener('pointerover',scheduleUsageTooltip,true);
  document.addEventListener('focusin',scheduleUsageTooltip,true);
  document.addEventListener('pointerout',leaveUsageTooltip,true);
  document.addEventListener('focusout',leaveUsageTooltip,true);
  document.addEventListener('pointerdown',hideUsageTooltip,true);
  window.addEventListener('resize',hideUsageTooltip);
  window.addEventListener('blur',hideUsageTooltip);
  const rowActionsTagged=new Set(),diffCardsTagged=new Set(),diffEndsTagged=new Set(),raisedRowsTagged=new Set(),raisedStaticsTagged=new Set(),mediaTagged=new Set(),sentMediaTagged=new Set(),activitySurfacesTagged=new Set(),activityHitsTagged=new Set(),nativeEdgesTagged=new Set(),compactHoversTagged=new Set(),compactSurfacesTagged=new Set(),compactHitsTagged=new Set();
  const hoverLight=document.createElement('div');hoverLight.setAttribute('data-spider-hover-light','');hoverLight.setAttribute('aria-hidden','true');document.body.append(hoverLight);
  let hoverTarget=null,hoverFrame=0,hoverCycle=0,hoverX=0,hoverY=0,hoverFollowUntil=0,hoverClipRoot=null,activeRaisedRow=null;
  const hoverSelector=hoverControlSelector+',a[href]';
  function standaloneHoverControl(node){
    return node.matches('[data-spider-native-edge],[data-spider-media-preview],[data-spider-activity-hit],[role="combobox"],[role="switch"],[role="checkbox"],[role="radio"],[role="slider"],select,input,textarea,[data-sidebar-destination],[data-spider-avatar-button]')||!node.matches(knownRowSelector)&&node.matches(standaloneControlSelector);
  }
  function raiseRowFor(target){
    let row=target.closest('[data-spider-activity-surface],[data-spider-compact-surface]')?null:target.closest(rowActionSelector);
    if(row&&row!==target&&standaloneHoverControl(target)&&!row.matches(knownRowSelector))row=null;
    if(row&&(!row.matches(hoverControlSelector)||row.matches(unavailableControlSelector)||standaloneHoverControl(row)||row.closest('[data-spider-floating-surface],.react-colorful,[data-reasoning-slider]')||row.getBoundingClientRect().height<25))row=null;
    if(row===activeRaisedRow)return;
    if(activeRaisedRow){activeRaisedRow.removeAttribute('data-spider-raised-active');activeRaisedRow=null;}
    if(!row)return;
    if(!raisedRowsTagged.has(row)){
      const before=getComputedStyle(row,'::before');if(!['none','normal'].includes(before.content))return;
      if(getComputedStyle(row).position==='static'){row.setAttribute('data-spider-raised-static','');raisedStaticsTagged.add(row);}
      row.setAttribute('data-spider-raised-row','');raisedRowsTagged.add(row);
      // Resolve the transparent initial surface before starting its transition.
      getComputedStyle(row,'::before').opacity;
    }
    activeRaisedRow=row;row.setAttribute('data-spider-raised-active','');
  }
  function paintHoverLight(){
    hoverFrame=0;
    if(removed||!hoverTarget?.isConnected||hoverTarget.closest(unavailableControlSelector)||!hoverTarget.matches(':hover')||root.getAttribute('data-spider-codex')!=='on'){hideHoverLight(true);return;}
    const visualTarget=hoverTarget.matches('[data-spider-activity-hit]')?hoverTarget.closest('[data-spider-activity-surface]'):hoverTarget.matches('[data-spider-compact-hit]')?hoverTarget.closest('[data-spider-compact-surface]'):hoverTarget;
    const hit=visualTarget.getBoundingClientRect(),s=getComputedStyle(visualTarget);
    let r=hit,radius=s.borderRadius;
    if(visualTarget===activeRaisedRow||visualTarget.matches('[class~="group/summary-panel-item"]')){
      const face=getComputedStyle(visualTarget,'::before'),parts=face.translate.split(' '),lift=parseFloat(parts[parts.length-1])||0;
      const left=parseFloat(face.left)||0,right=parseFloat(face.right)||0,top=parseFloat(face.top)||0,bottom=parseFloat(face.bottom)||0;
      r={left:hit.left+left,top:hit.top+top+lift,width:Math.max(0,hit.width-left-right),height:Math.max(0,hit.height-top-bottom)};r.right=r.left+r.width;r.bottom=r.top+r.height;radius=face.borderRadius;
    }
    // Reflect only inside the native hit target. Menu rows never grow past
    // their parent card, and the overlay cannot intercept a click.
    Object.assign(hoverLight.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',borderRadius:radius});
    if(hoverClipRoot?.isConnected){const c=hoverClipRoot.getBoundingClientRect();hoverLight.style.clipPath=`inset(${c.top-r.top}px ${r.right-c.right}px ${r.bottom-c.bottom}px ${c.left-r.left}px round ${getComputedStyle(hoverClipRoot).borderRadius})`;}
    else hoverLight.style.removeProperty('clip-path');
    hoverLight.style.setProperty('--spider-light-x',Math.max(0,Math.min(r.width,hoverX-r.left))+'px');
    hoverLight.style.setProperty('--spider-light-y',Math.max(0,Math.min(r.height,hoverY-r.top))+'px');
    hoverLight.setAttribute('data-active','true');
    hoverLight.removeAttribute('data-detached');
    if(performance.now()<hoverFollowUntil)hoverFrame=requestAnimationFrame(paintHoverLight);
  }
  function hideHoverLight(immediate=false){hoverTarget=null;hoverClipRoot=null;if(activeRaisedRow){activeRaisedRow.removeAttribute('data-spider-raised-active');activeRaisedRow=null;}for(const layer of [hoverLight]){layer.removeAttribute('data-active');if(immediate)layer.setAttribute('data-detached','');}}
  function moveHoverLight(event){
    if(event.pointerType==='touch')return;
    if(root.getAttribute('data-spider-codex')!=='on')return;
    const target=event.composedPath().find(node=>node?.nodeType===1&&node.matches(hoverSelector))??event.target?.closest?.(hoverSelector);
    if(!target||target.closest(unavailableControlSelector)||target.closest('.react-colorful,[data-reasoning-slider]')){hideHoverLight();return;}
    if(target.closest(attachmentControlSelector)){if(hoverTarget)hideHoverLight(true);return;}
    hoverX=event.clientX;hoverY=event.clientY;
    if(hoverTarget!==target){
      const style=getComputedStyle(target),color=style.borderTopColor;
      const slash=color.match(/\/\s*([\d.]+)(%)?\s*\)/),rgba=color.match(/^rgba\(.+,\s*([\d.]+)\)$/);
      const alpha=color==='transparent'?0:slash?Number(slash[1])/(slash[2]?100:1):rgba?Number(rgba[1]):1;
      const nativeEdge=!target.matches(primaryActionSelector)&&(target.matches('[class*="Button-"]')&&!target.matches(knownRowSelector)||parseFloat(style.borderTopWidth)>0&&alpha>.05);
      if(nativeEdge){target.setAttribute('data-spider-native-edge','');nativeEdgesTagged.add(target);}else if(nativeEdgesTagged.delete(target))target.removeAttribute('data-spider-native-edge');
      const r=target.getBoundingClientRect(),parent=target.parentElement;
      const fullRow=!target.closest(floatingSelector)&&!standaloneHoverControl(target)&&r.height>=25&&r.width>=160&&parent&&r.width>=parent.getBoundingClientRect().width*.78;
      if(fullRow){target.setAttribute('data-spider-row-action','');rowActionsTagged.add(target);}
      else if(rowActionsTagged.delete(target))target.removeAttribute('data-spider-row-action');
      const compact=target.clientHeight>0&&target.clientHeight<28&&target.clientWidth>=48&&!nativeEdge&&!fullRow&&!target.matches(primaryActionSelector+',[data-spider-row-action],[data-spider-media-preview],[data-spider-activity-hit],[data-spider-compact-hit],[role="switch"],[role="checkbox"],[role="radio"],[role="slider"],input,select,summary,[class~="group/summary-panel-item"]')&&!target.closest('[data-spider-floating-surface]');
      if(compact){target.setAttribute('data-spider-compact-hover','');compactHoversTagged.add(target);}else if(compactHoversTagged.delete(target))target.removeAttribute('data-spider-compact-hover');
      hoverClipRoot=null;
      for(let p=target.parentElement;p&&p!==document.body;p=p.parentElement){
        if(!p.matches('[class*="rounded"],[data-spider-diff-card],[data-spider-glass-panel],'+floatingSelector+','+composerSelector))continue;
        const s=getComputedStyle(p);
        const bounded=p.matches('[data-spider-diff-card],[data-spider-glass-panel],[data-spider-floating-surface],[data-spider-activity-surface],'+composerSelector),clipped=[s.overflowX,s.overflowY].some(v=>!['visible','unset'].includes(v));
        if(!bounded&&!clipped)continue;
        const frame=p.getBoundingClientRect();if(!clipped&&(r.left<frame.left-.6||r.right>frame.right+.6||r.top<frame.top-.6||r.bottom>frame.bottom+.6))continue;
        if([s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomLeftRadius,s.borderBottomRightRadius].some(v=>parseFloat(v)>0)){hoverClipRoot=p;break;}
      }
      hoverTarget=target;hoverFollowUntil=performance.now()+1050;hoverCycle=1-hoverCycle;hoverLight.setAttribute('data-cycle',String(hoverCycle));
    }
    raiseRowFor(target);
    if(!hoverFrame)hoverFrame=requestAnimationFrame(paintHoverLight);
  }
  function leaveHoverLight(event){if(event.relatedTarget!==null)return;hideHoverLight();}
  function scrollHoverLight(event){
    if(!hoverTarget)return;
    if(event.target===document||event.target===window||event.target?.contains?.(hoverTarget)){hideHoverLight();return;}
    if(!hoverFrame)hoverFrame=requestAnimationFrame(paintHoverLight);
  }
  document.addEventListener('pointermove',moveHoverLight,{passive:true});
  document.addEventListener('pointerover',moveHoverLight,{passive:true});
  document.addEventListener('pointerout',leaveHoverLight,{passive:true});
  document.addEventListener('scroll',scrollHoverLight,{capture:true,passive:true});
  addEventListener('blur',hideHoverLight);
  const codeSurfaces=new Map();
  const codeSurfaceCSS=`
    :host,pre{color-scheme:dark!important;color:#fff5ee!important;text-shadow:none!important;
      --color-surface:transparent!important;--diffs-bg:transparent!important;--diffs-fg:#fff5ee!important;
      --diffs-fg-number:#decfc5!important;--diffs-addition-color:#a4e7bc!important;--diffs-deletion-color:#ffb7ae!important;
      --diffs-bg-context-override:transparent!important;--diffs-bg-separator-override:#fff0e60a!important;--diffs-bg-hover-override:#ffcda91a!important;
      --diffs-editor-selection-bg:#ff916e4d!important;--diffs-editor-line-highlight-bg:#ffd2b912!important;
      --diffs-editor-line-number-active-bg:#ffd2b912!important;--diffs-editor-cursor-fg:#fff5ee!important;
      --diffs-widget-fg:#fff5ee!important;--diffs-widget-bg:#281e28ed!important;--diffs-widget-border:#f6ded34a!important
    }
    pre,[data-file],[data-diff]{background-color:transparent!important;text-shadow:none!important}
    button,[role="button"]{color:#fff5ee!important}
    @media(hover:hover){button:not(:disabled,[aria-disabled="true"]):hover,[role="button"]:not([aria-disabled="true"]):hover{
      background-color:#ffffff0a!important;box-shadow:none!important
    }}
  `;
  function readableCodeColor(value){
    let rgb;
    if(/^#[\da-f]{6}$/i.test(value))rgb=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
    else if(/^#[\da-f]{3}$/i.test(value))rgb=[...value.slice(1)].map(c=>parseInt(c+c,16));
    else return null;
    const luminance=channels=>channels.map(x=>x/255).map((x,i)=>(x<=.04045?x/12.92:((x+.055)/1.055)**2.4)*[.2126,.7152,.0722][i]).reduce((a,b)=>a+b,0);
    if(luminance(rgb)>=.62)return value;
    if(Math.max(...rgb)-Math.min(...rgb)<18)return Math.max(...rgb)<60?'#fff5ee':'#ded0c8';
    const original=rgb;
    for(let mix=.1;mix<=1;mix+=.05){rgb=original.map(x=>Math.round(x+(255-x)*mix));if(luminance(rgb)>=.62)break;}
    return '#'+rgb.map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  function syncCodeSurfaces(supported){
    const hosts=new Set(supported?[...document.querySelectorAll('diffs-container')]:[]);
    for(const [host,state] of codeSurfaces)if(!hosts.has(host)||host.shadowRoot!==state.shadow){
      state.observer.disconnect();clearTimeout(state.timer);state.style.remove();host.removeAttribute('data-spider-code-surface');codeSurfaces.delete(host);
    }
    for(const host of hosts){
      if(codeSurfaces.has(host)||!host.shadowRoot)continue;
      const shadow=host.shadowRoot,style=document.createElement('style');style.id='spider-code-surface';
      const state={shadow,style,palette:new Map(),timer:0,observer:null};
      const collect=node=>{
        if(node.nodeType!==1)return false;
        const spans=[...(node.matches('span[style]')?[node]:[]),...node.querySelectorAll('span[style]')];let changed=false;
        for(const span of spans){
          const raw=span.getAttribute('style')?.match(/(?:^|;)\s*(color\s*:\s*([^;]+))/i);if(!raw||state.palette.has(raw[1]))continue;
          const color=readableCodeColor(raw[2].trim());if(color){state.palette.set(raw[1],color);changed=true;}
        }
        return changed;
      };
      const publish=()=>{
        state.timer=0;if(removed||codeSurfaces.get(host)!==state)return;
        const rules=[...state.palette].map(([raw,color])=>'span[style*='+JSON.stringify(raw)+']{color:'+color+'!important}').join('\n');
        const css=codeSurfaceCSS+rules;if(style.textContent!==css)style.textContent=css;
        if(!style.isConnected)shadow.append(style);
      };
      state.observer=new MutationObserver(records=>{
        let changed=!style.isConnected;
        for(const record of records){
          if(record.target===style||style.contains(record.target))continue;
          if(record.type==='attributes')changed=collect(record.target)||changed;
          else for(const node of record.addedNodes)if(node!==style)changed=collect(node)||changed;
        }
        if(changed&&!state.timer)state.timer=setTimeout(publish,0);
      });
      codeSurfaces.set(host,state);host.setAttribute('data-spider-code-surface','');
      const pre=shadow.querySelector('pre');if(pre)collect(pre);
      publish();state.observer.observe(shadow,{subtree:true,childList:true,attributes:true,attributeFilter:['style']});
    }
    return [...hosts].filter(host=>codeSurfaces.has(host));
  }
  const review={clicks:0,slowClicks:0,maxClickMs:0,scrollSessions:0,scrollFrames:0,slowScrollFrames:0,maxScrollMs:0,surfaceRefreshes:0,
    attachmentOpened:0,attachmentMissed:0,attachmentGlass:0,menuOpened:0,submenuOpened:0,alignedMenus:0,maxMenuMs:0};
  let pendingMenu=null,menuTimer=0,scrollFrame=0,lastScroll=0,previousScrollFrame=0;
  const reviewing=()=>document.visibilityState==='visible'&&surfaceStatus==='workspace';
  function beginMenuReview(event){
    if(!event.isTrusted||!reviewing())return;
    const trigger=event.target.closest?.('button,[role="button"],[role^="menuitem"]');
    if(!trigger||trigger.matches('[aria-expanded="true"]'))return;
    const attachment=trigger.matches(attachmentTrigger);
    if(attachment&&attachmentTagged.size)return;
    if(!attachment&&!trigger.matches('[aria-haspopup="menu"],[aria-haspopup="listbox"]'))return;
    clearTimeout(menuTimer);
    pendingMenu={attachment,started:performance.now()};
    menuTimer=setTimeout(()=>{if(pendingMenu?.attachment)review.attachmentMissed++;pendingMenu=null},1400);
    scheduleRefresh(0);
  }
  function reviewNewPanel(panel){
    if(!reviewing())return;
    const attachment=panel.hasAttribute('data-spider-attachment-panel');
    if(attachment){
      review.attachmentOpened++;
      if([artworkCache.clearUrl,artworkCache.frostUrl].some(url=>url&&getComputedStyle(panel).backgroundImage.includes(url)))review.attachmentGlass++;
    }else if(panel.closest('[data-radix-popper-content-wrapper],[data-floating-ui-portal]')||panel.matches('[role="menu"],[role="listbox"]')){
      review.menuOpened++;
      if(panel.matches('[data-side="left"],[data-side="right"]')||panel.parentElement?.closest('[role="menu"]'))review.submenuOpened++;
      if(panel.hasAttribute('data-spider-glass-aligned'))review.alignedMenus++;
    }
    if(pendingMenu&&pendingMenu.attachment===attachment){
      review.maxMenuMs=Math.max(review.maxMenuMs,Math.round(performance.now()-pendingMenu.started));
      clearTimeout(menuTimer);pendingMenu=null;
    }
  }
  function sampleScrollFrame(at){
    scrollFrame=0;
    if(!reviewing()||at-lastScroll>125){previousScrollFrame=0;return;}
    if(previousScrollFrame){
      const elapsed=Math.round(at-previousScrollFrame);
      review.scrollFrames++;
      if(elapsed>32)review.slowScrollFrames++;
      review.maxScrollMs=Math.max(review.maxScrollMs,elapsed);
    }
    previousScrollFrame=at;
    scrollFrame=requestAnimationFrame(sampleScrollFrame);
  }
  function beginScrollReview(event){
    if(!event.isTrusted||!reviewing()||!event.target.closest?.('.thread-scroll-container,[data-app-shell-main-surface],aside.app-shell-left-panel'))return;
    lastScroll=performance.now();
    if(scrollFrame)return;
    review.scrollSessions++;
    scrollFrame=requestAnimationFrame(sampleScrollFrame);
  }
  const clickReview=PerformanceObserver.supportedEntryTypes.includes('event')?new PerformanceObserver(list=>{
    if(!reviewing())return;
    for(const e of list.getEntries())if(e.name==='click'&&e.interactionId){
      review.clicks++;
      if(e.duration>32)review.slowClicks++;
      review.maxClickMs=Math.max(review.maxClickMs,e.duration);
    }
  }):null;
  clickReview?.observe({type:'event',durationThreshold:16});
  document.addEventListener('pointerdown',beginMenuReview,{capture:true,passive:true});
  document.addEventListener('scroll',beginScrollReview,{capture:true,passive:true});
  const authTagged={heading:new Set(),primary:new Set(),secondary:new Set(),link:new Set()};
  const layoutStyle=document.createElement('style');layoutStyle.id='spider-codex-home-layout';document.head.append(layoutStyle);
  const visibleFirst=selector=>[...document.querySelectorAll(selector)].find(e=>{const r=e.getBoundingClientRect();return e.checkVisibility()&&r.width>0&&r.height>0});
  function layoutChrome(){
    const rail=visibleFirst(railSelector);
    const bounds=rail?.getBoundingClientRect();
    const left=bounds?Math.max(0,bounds.left):0;
    const top=bounds?Math.max(0,bounds.top-5):0;
    const width=bounds?Math.max(0,Math.min(innerWidth,bounds.right+6)-left):0;
    const height=bounds?Math.max(0,Math.min(innerHeight,bounds.bottom+4)-top):0;
    [left,top,width,height].forEach((value,index)=>{
      const key=railVariables[index],pixels=value+'px';
      if(root.style.getPropertyValue(key)!==pixels)root.style.setProperty(key,pixels);
    });
  }
  function layoutHome(){
    const main=visibleFirst(mainSelector),feed=main?.querySelector('[data-home-feed-composer]'),heading=main?.querySelector('[data-feature="game-source"]');
    const r=main?.getBoundingClientRect();
    const left=Math.max(0,r?.left??0),top=Math.max(0,r?.top??0);
    const width=Math.min(innerWidth,r?.right??0)-left,height=Math.min(innerHeight,r?.bottom??0)-top;
    const ready=!!(feed&&heading&&height>=600&&width>=500);
    const roles=ready?new Map([[main,'data-spider-home-main'],[feed,'data-spider-home-composer'],[heading,'data-spider-home-heading']]):new Map();
    for(const e of homeTagged)if(!roles.has(e)){
      e.removeAttribute('data-spider-home-main');e.removeAttribute('data-spider-home-composer');e.removeAttribute('data-spider-home-heading');
      homeTagged.delete(e);
    }
    if(!ready){if(layoutStyle.textContent)layoutStyle.textContent='';return}
    for(const [e,attr] of roles){if(!e.hasAttribute(attr))e.setAttribute(attr,'');homeTagged.add(e)}
    const composerWidth=Math.min(600,width-48);
    const minimumTop=top+12;
    const composerTop=Math.max(minimumTop,Math.min(top+height*.38,top+height-feed.offsetHeight-16));
    const headingTop=Math.max(top,Math.min(top+height*.325,composerTop-heading.offsetHeight-10));
    const css='html[data-spider-codex="on"] [data-spider-home-composer]{left:'+(left+(width-composerWidth)/2)+'px!important;top:'+composerTop+'px!important;width:'+composerWidth+'px!important}html[data-spider-codex="on"] [data-spider-home-heading]{left:'+(left+width/2)+'px!important;top:'+headingTop+'px!important}';
    if(layoutStyle.textContent!==css)layoutStyle.textContent=css;
  }
  function reconcileMarkers(previous,attribute,current){
    for(const e of previous)if(!current.has(e)){e.removeAttribute(attribute);previous.delete(e);}
    for(const e of current)if(!previous.has(e)){e.setAttribute(attribute,'');previous.add(e);}
  }
  function openControlledPopups(){
    const panels=new Set();
    for(const trigger of document.querySelectorAll('[aria-haspopup][aria-expanded="true"][aria-controls]')){
      if(!shown(trigger)||!['true','menu','listbox','dialog'].includes(trigger.getAttribute('aria-haspopup')))continue;
      const panel=document.getElementById(trigger.getAttribute('aria-controls'));
      if(!panel||!panel.matches('div,section,ul,dialog')||panel.contains(trigger)||!shown(panel))continue;
      const bounds=panel.getBoundingClientRect();
      if(bounds.width>=innerWidth*.9&&bounds.height>=innerHeight*.9)continue;
      if(panel.querySelector('[role="menu"],[role="listbox"],[role="dialog"]'))continue;
      panels.add(panel);
    }
    return panels;
  }
  function openAttachmentPanel(){
    const trigger=document.querySelector(attachmentTrigger);
    if(trigger?.matches('[data-state="closed"]')&&!pendingMenu?.attachment&&!trigger.matches('[aria-expanded="true"]'))return null;
    const composer=trigger?.closest('[class*="ComposerLayoutRoot-"]')??trigger?.closest('.composer-surface-chrome');
    if(!composer||!shown(trigger))return null;
    const bounds=composer.getBoundingClientRect();
    const overlay=[...document.querySelectorAll(composerPopupSelector)].find(panel=>shown(panel)&&panel.querySelector('[data-mention-list-scroll-area]'));
    if(overlay)return overlay;
    const roots=trigger.matches('[data-state="open"],[aria-expanded="true"]')?[document.body]:[composer.parentElement,...document.querySelectorAll('[data-floating-ui-portal],[data-radix-popper-content-wrapper]')];
    const toolRow=/^(计划模式|绘图|画图|附加 Google Chrome|Plan mode|Draw|Attach Google Chrome)$/i;
    const fileRow=/^(文件和文件夹|文件与文件夹|Files and folders|File and folder)$/i;
    const label=e=>(e.getAttribute('aria-label')||e.querySelector('[data-menu-row-content] .truncate')?.innerText||e.innerText).trim().split('\n')[0];
    for(const root of new Set(roots)){
      const rows=[...root.querySelectorAll(attachmentRow)];
      const file=rows.find(e=>fileRow.test(label(e))&&shown(e));
      if(!file)continue;
      const tool=rows.find(e=>toolRow.test(label(e))&&shown(e));
      if(!tool)continue;
      for(let panel=file.parentElement;panel&&panel!==document.body&&!panel.contains(trigger);panel=panel.parentElement){
        if(!panel.contains(tool))continue;
        const box=panel.getBoundingClientRect();
        if(box.width<100||box.width>bounds.width+100||box.height<60||box.bottom>bounds.bottom+44||Math.abs(box.left-bounds.left)>160)break;
        const style=getComputedStyle(panel);
        if(panel.matches(floatingDiscoverySelector)||style.position==='absolute'||style.position==='fixed'||style.overflowY==='auto')return panel;
      }
    }
    return null;
  }
  function clearGlassPosition(panel){
    panel.removeAttribute('data-spider-glass-aligned');
    panel.style.removeProperty('--spider-glass-left');panel.style.removeProperty('--spider-glass-top');
    glassResize.unobserve(panel);
  }
  function positionGlass(){
    const updates=[];
    for(const panel of placedGlass.keys()){
      const box=panel.getBoundingClientRect();
      for(const [key,value] of [['--spider-glass-left',box.left+'px'],['--spider-glass-top',box.top+'px']])
        if(panel.style.getPropertyValue(key)!==value)updates.push({panel,key,value});
    }
    // Collect geometry before changing styles so the next panel's read does
    // not force the renderer to resolve the previous panel's style update.
    for(const {panel,key,value} of updates)panel.style.setProperty(key,value);
  }
  let glassFrame=0;
  function scheduleGlassPosition(){
    if(!glassFrame&&placedGlass.size)glassFrame=requestAnimationFrame(()=>{glassFrame=0;positionGlass()});
  }
  const glassResize=new ResizeObserver(positionGlass),glassMovement=new MutationObserver(positionGlass);
  function syncGlassPositions(panels){
    let changed=false;
    const opened=[];
    for(const panel of placedGlass.keys())if(!panels.has(panel)){clearGlassPosition(panel);placedGlass.delete(panel);changed=true;}
    for(const panel of panels)if(!placedGlass.has(panel)){
      const composerOverlay=panel.closest('[data-composer-overlay-floating-ui]');
      const anchor=composerOverlay?.parentElement??panel.closest('[data-radix-popper-content-wrapper],[data-floating-ui-portal]')??panel.parentElement;
      placedGlass.set(panel,anchor);glassResize.observe(panel);panel.setAttribute('data-spider-glass-aligned','');changed=true;
      opened.push(panel);
    }
    if(changed){
      glassMovement.disconnect();
      for(const anchor of new Set([...placedGlass.keys(),...placedGlass.values()]))if(anchor)glassMovement.observe(anchor,{attributes:true,attributeFilter:['style']});
      positionGlass();
      for(const panel of opened)reviewNewPanel(panel);
    }
  }
  let persistentGlassPanels=[];
  function refreshFloatingSurfaces(page){
    const supported=supportsSurface(page);
    reconcileMarkers(popupTagged,'data-spider-popup-panel',supported?openControlledPopups():new Set());
    const attachment=supported&&page==='workspace'?openAttachmentPanel():null;
    reconcileMarkers(attachmentTagged,'data-spider-attachment-panel',new Set(attachment?[attachment]:[]));
    const monochrome=new Set();
    if(attachment)for(const row of attachment.querySelectorAll('[data-list-navigation-item]')){
      // The native title block may also contain a second line of description.
      const title=[...row.querySelectorAll('[data-menu-row-content] :is(.truncate,span)')]
        .find(node=>node.childElementCount===0&&node.textContent.trim())?.textContent.trim();
      if(title==='GitHub')for(const image of row.querySelectorAll('[data-leading-icon-slot="menu"] img'))monochrome.add(image);
    }
    reconcileMarkers(monochromeTagged,'data-spider-monochrome-icon',monochrome);
    // Classify once per structural update instead of expanding every CSS rule
    // into the full set of native popup selectors during every style recalculation.
    reconcileMarkers(floatingTagged,'data-spider-floating-surface',supported?new Set(document.querySelectorAll(floatingDiscoverySelector)):new Set());
    const floating=supported?[...document.querySelectorAll(floatingSelector)].filter(shown):[];
    const usagePopovers=new Set();
    if(page==='workspace')for(const panel of floating){
      if(panel.getAttribute('role')!=='menu')continue;
      const trigger=document.getElementById(panel.getAttribute('aria-labelledby'));
      if(trigger?.matches(usageTrigger))usagePopovers.add(panel);
    }
    reconcileMarkers(usagePopoversTagged,'data-spider-usage-popover',usagePopovers);
    const embedded=new Set(),sliderShells=new Set();
    for(const panel of floating){
      if(panel.querySelector(embeddedAnchorSelector))embedded.add(panel);
      for(const input of panel.querySelectorAll('input[type="range"],[role="slider"]')){
        const parent=input.parentElement;
        if(parent&&(parent.matches('div')&&parent.children.length===1||input.matches('input[type="range"]')&&parent.matches('[role="group"]')))sliderShells.add(parent);
      }
    }
    reconcileMarkers(embeddedTagged,'data-spider-embedded-anchor',embedded);
    reconcileMarkers(sliderShellsTagged,'data-spider-slider-shell',sliderShells);
    const sectionHeaders=attachment?[...attachment.querySelectorAll('[data-mention-section-id]>:first-child:not([data-mention-section-items])')].filter(shown):[];
    syncGlassPositions(new Set([...floating,...sectionHeaders,...persistentGlassPanels.filter(panel=>panel.isConnected)]));
  }
  function clearSurfaces(){
    review.surfaceRefreshes++;
    if(usageTarget&&(!usageTarget.isConnected||usageTarget.getAttribute('aria-expanded')==='true'))hideUsageTooltip();
    if(hoverTarget&&!hoverTarget.isConnected)hideHoverLight(true);
    for(const control of nativeEdgesTagged)if(!control.isConnected){control.removeAttribute('data-spider-native-edge');nativeEdgesTagged.delete(control);}
    for(const control of compactHoversTagged)if(!control.isConnected){control.removeAttribute('data-spider-compact-hover');compactHoversTagged.delete(control);}
    for(const row of raisedRowsTagged)if(!row.isConnected){row.removeAttribute('data-spider-raised-active');row.removeAttribute('data-spider-raised-row');raisedRowsTagged.delete(row);if(raisedStaticsTagged.delete(row))row.removeAttribute('data-spider-raised-static');}
    const page=surface();syncNativePreference(page);
    if(observingWorkspace!==(page==='workspace')){
      observingWorkspace=page==='workspace';
      observeChanges();
    }
    surfaceStatus=page;
    lastDiagnosis=null;
    observeCurrentLayout();
    const supported=supportsSurface(page);
    const media=new Set(),sentMedia=new Set(),activitySurfaces=new Set(),activityHits=new Set(),compactSurfaces=new Set(),compactHits=new Set();
    if(supported){
      for(const image of document.querySelectorAll('main [role="button"].size-20>img,:is('+composerSelector+') img')){
        const control=image.closest('button,[role="button"]');if(!control)continue;
        const composer=control.closest(composerSelector);
        if(composer){
          if(control.matches('[class~="group/summary-panel-item"],[data-list-navigation-item],[role^="menuitem"]')||control.closest('[data-spider-floating-surface]'))continue;
          const picture=image.getBoundingClientRect(),frame=control.getBoundingClientRect();
          if(Math.max(picture.width,picture.height)<48||frame.width>180||frame.height>180)continue;
        }
        media.add(control);if(!composer)sentMedia.add(control);
      }
      for(const button of document.querySelectorAll('[class~="group/activity-header"]>button.absolute')){activityHits.add(button);activitySurfaces.add(button.parentElement);}
      for(const shell of document.querySelectorAll('main .bg-surface-elevated-secondary.rounded-3xl')){
        for(const button of shell.querySelectorAll('button'))if(button.clientHeight>0&&button.clientHeight<28&&button.clientWidth>=48&&!button.matches(primaryActionSelector)){compactSurfaces.add(shell);compactHits.add(button);}
      }
    }
    reconcileMarkers(mediaTagged,'data-spider-media-preview',media);reconcileMarkers(sentMediaTagged,'data-spider-media-sent',sentMedia);
    reconcileMarkers(activitySurfacesTagged,'data-spider-activity-surface',activitySurfaces);reconcileMarkers(activityHitsTagged,'data-spider-activity-hit',activityHits);
    reconcileMarkers(compactSurfacesTagged,'data-spider-compact-surface',compactSurfaces);reconcileMarkers(compactHitsTagged,'data-spider-compact-hit',compactHits);
    for(const row of rowActionsTagged)if(!row.isConnected){row.removeAttribute('data-spider-row-action');rowActionsTagged.delete(row);}
    const diffCards=new Set(),diffEnds=new Set();
    if(supported)for(const header of document.querySelectorAll('[class~="group/turn-diff-header"]')){
      const card=header.parentElement;if(!card?.matches('[class*="resource-card-row-padding-x"]'))continue;
      diffCards.add(card);const rows=card.querySelectorAll('button[class*="resource-card-row-padding-x"]');if(rows.length)diffEnds.add(rows[rows.length-1]);
    }
    reconcileMarkers(diffCardsTagged,'data-spider-diff-card',diffCards);reconcileMarkers(diffEndsTagged,'data-spider-diff-end',diffEnds);
    const structures=new Set();
    const addAncestors=anchor=>{for(let p=anchor?.parentElement;p&&p!==document.body;p=p.parentElement)structures.add(p);};
    const settingsRoots=new Set(supported?[...document.querySelectorAll(settingsSelector)].filter(hasSettingsNavigation):[]);
    const settingsPanels=new Set(supported?[...document.querySelectorAll(settingsSectionSelector)].filter(shown):[]);
    if(page==='profile'){
      const profile=[...document.querySelectorAll('main[data-app-shell-main-surface]')].find(profileMain);
      if(profile){
        settingsRoots.add(profile);
        for(const panel of profile.querySelectorAll(profileSectionSelector))if(shown(panel))settingsPanels.add(panel);
      }
    }
    const settingsPanes=new Set(supported?[...document.querySelectorAll(settingsPaneSelector)].filter(shown):[]);
    reconcileMarkers(settingsTagged,'data-spider-settings',settingsRoots);
    reconcileMarkers(glassTagged,'data-spider-glass-panel',settingsPanels);
    reconcileMarkers(paneTagged,'data-spider-settings-pane',settingsPanes);
    const quotaRows=new Set(),quotaGroups=new Set();
    if(supported)for(const progress of document.querySelectorAll(quotaProgressSelector))if(shown(progress)){
      const row=progress.closest('[class*="settings-row"]');
      if(row){quotaRows.add(row);if(row.parentElement?.matches('[data-spider-glass-panel],.rounded-2xl'))quotaGroups.add(row.parentElement);}
    }
    reconcileMarkers(quotaRowsTagged,'data-spider-quota-row',quotaRows);
    reconcileMarkers(quotaGroupsTagged,'data-spider-quota-group',quotaGroups);
    const composerGlass=supported?[...document.querySelectorAll('[class*="ComposerLayoutRoot-"],.composer-surface-chrome')]
      .filter(panel=>shown(panel)&&!panel.parentElement?.closest('[class*="ComposerLayoutRoot-"],.composer-surface-chrome')):[];
    const permissionButtons=new Set();
    for(const composer of composerGlass)for(const button of composer.querySelectorAll('button'))
      if(button.matches('[class*="text-orange"],[aria-label*="权限"],[aria-label*="access" i],[aria-label*="permission" i]')||button.querySelector('[class*="text-orange"]'))permissionButtons.add(button);
    reconcileMarkers(permissionsTagged,'data-spider-permission-button',permissionButtons);
    const codeHosts=syncCodeSurfaces(supported);
    persistentGlassPanels=[...settingsPanels,...composerGlass,...codeHosts];
    refreshFloatingSurfaces(page);
    const homeIcons=new Set(supported?[...document.querySelectorAll('aside [data-sidebar-destination="builtin:home"]')]
      .map(button=>button.querySelector('svg')).filter(Boolean):[]);
    reconcileMarkers(iconTagged,'data-spider-home-svg',homeIcons);
    const avatarButtons=new Set(supported?[...document.querySelectorAll('aside img')].filter(e=>{const r=e.getBoundingClientRect();return shown(e)&&r.left<90&&r.top>innerHeight-100}).map(e=>e.closest('button')).filter(Boolean):[]);
    reconcileMarkers(avatarTagged,'data-spider-avatar-button',avatarButtons);
    const auth={heading:new Set(),primary:new Set(),secondary:new Set(),link:new Set()};
    if(page==='login'||page==='workspace-picker'){
      const anchor=[...document.querySelectorAll('h1,h2,button')].find(e=>shown(e)&&/^(登录 ChatGPT|登录 Codex|欢迎回来|Welcome back|继续登录|使用其他方式登录|取消登录|复制登录链接|Cancel login|Cancel sign-in|Copy login link|Sign in to ChatGPT|Log in to ChatGPT|Continue to ChatGPT|Log in|Sign in|选择工作空间|选择空间|Select a workspace|Choose a workspace)$/.test(e.textContent.trim()));
      if(anchor&&/^H[12]$/.test(anchor.tagName))auth.heading.add(anchor);
      addAncestors(anchor);
      for(const e of document.querySelectorAll('button'))if(shown(e)){
        const label=e.textContent.trim();
        if(/^(继续登录|Continue to ChatGPT|Continue|Log in|Sign in)$/.test(label))auth.primary.add(e);
        if(/^(注册|复制登录链接|Copy login link|Sign up|Create account)$/.test(label))auth.link.add(e);
        if(/^(使用其他方式登录|使用其他账户|取消登录|Use another method|Log in another way|Cancel login|Cancel sign-in)$/.test(label))auth.secondary.add(e);
      }
    }
    for(const name of Object.keys(auth))reconcileMarkers(authTagged[name],'data-spider-auth-'+name,auth[name]);
    if(!supported){
      reconcileMarkers(tagged,'data-spider-structural',structures);
      return;
    }
    // Settings portals can sit outside the native settings main element.
    for(const settings of settingsRoots)addAncestors(settings);
    for(const anchor of document.querySelectorAll(mainSelector+',aside.app-shell-left-panel'))if(shown(anchor))addAncestors(anchor);
    reconcileMarkers(tagged,'data-spider-structural',structures);
    layoutHome();
    layoutChrome();
  }
  function scheduleRefresh(delay=0){
    if(queued&&delay>=queuedDelay)return;
    clearTimeout(scheduled);
    queued=true;queuedDelay=delay;
    // A streamed reply can mutate at display refresh speed. Batch element
    // changes and ignore transcript text-only changes in the workspace.
    scheduled=setTimeout(()=>{
      queued=false;
      if(!removed)clearSurfaces();
    },delay);
  }
  let observingWorkspace=null;
  function changesPopup(change){
    if(change.type==='attributes')return ['aria-expanded','role','data-state','hidden','aria-hidden'].includes(change.attributeName)&&
      change.target.matches(popupChangeSelector+',[aria-haspopup],[data-spider-floating-surface]');
    return change.type==='childList'&&[...change.addedNodes,...change.removedNodes].some(node=>node.nodeType===1&&
      (node.matches(popupChangeSelector)||node.querySelector(popupChangeSelector)));
  }
  function opensPopup(change){
    if(change.type==='childList')return [...change.addedNodes].some(node=>node.nodeType===1&&(node.matches(popupChangeSelector)||node.querySelector(popupChangeSelector)));
    if(!changesPopup(change))return false;
    if(change.attributeName==='aria-expanded')return change.target.getAttribute('aria-expanded')==='true';
    if(change.attributeName==='data-state')return /^(open|instant-open|delayed-open)$/.test(change.target.getAttribute('data-state'));
    if(change.attributeName==='hidden')return !change.target.hidden;
    if(change.attributeName==='aria-hidden')return change.target.getAttribute('aria-hidden')!=='true';
    return change.attributeName==='role';
  }
  function transcriptNeedsRefresh(target,change){
    if(target.closest(transcriptStructure)||target.closest('[data-spider-diff-card]'))return true;
    if(change.type!=='childList')return false;
    return [...change.addedNodes,...change.removedNodes].some(node=>node.nodeType===1&&
      (node.matches(transcriptStructure)||node.querySelector(transcriptStructure)));
  }
  const observer=new MutationObserver(records=>{
    const workspace=root.getAttribute('data-spider-surface')==='workspace';
    const popupChanged=records.some(changesPopup);
    if(popupChanged&&records.some(opensPopup)){
      // Popup placement must be ready in this microtask, before the first paint.
      // A zero-delay timer can still run after a visible unaligned frame.
      if(removed)return;
      if(workspace&&surface()==='workspace'){
        refreshFloatingSurfaces('workspace');
        // React may insert a new composer or a card in the same commit.
        // Keep its full scan out of the popup's first paint.
        if(records.some(change=>change.type==='childList'&&!changesPopup(change)&&
          change.target.nodeType===1&&change.target.closest(mainSelector+',aside.app-shell-left-panel')&&
          !change.target.closest(floatingSelector)))scheduleRefresh(75);
      }else{
        clearTimeout(scheduled);queued=false;clearSurfaces();
      }
      return;
    }
    const relevantAttribute=change=>change.attributeName!=='class'||settingsTagged.has(change.target)||
      glassTagged.has(change.target)||paneTagged.has(change.target)||
      change.target.matches(settingsSelector+','+settingsSectionSelector+','+settingsPaneSelector);
    if(!workspace||popupChanged||hoverTarget&&!hoverTarget.isConnected||records.some(change=>{
      const target=change.target.nodeType===1?change.target:change.target.parentElement;
      if(target?.closest('.thread-scroll-container,'+transcriptContent)&&!transcriptNeedsRefresh(target,change))return false;
      return (change.type==='attributes'&&relevantAttribute(change))||
        (change.type==='childList'&&[...change.addedNodes,...change.removedNodes].some(node=>node.nodeType===1));
    }))scheduleRefresh(workspace&&!pendingMenu?75:0);
  });
  function observeChanges(){
    observer.observe(observedBody,{childList:true,subtree:true,characterData:!observingWorkspace,attributes:true,
      attributeFilter:['data-state','role','data-app-shell-left-panel-appearance','data-sidebar-destination','aria-hidden','hidden','aria-label','aria-expanded','aria-controls','class']});
  }
  const onResize=()=>{if(!removed){layoutHome();layoutChrome();scheduleGlassPosition()}};
  const resize=new ResizeObserver(onResize);
  const railPlacement=new MutationObserver(()=>{if(!removed)layoutChrome()});
  // Keep watching the current rail even when the native shell replaces it.
  const watched=new Set();
  const observeCurrentLayout=()=>{
    const current=new Set(document.querySelectorAll(mainSelector+',aside.app-shell-left-panel,'+railSelector+', [data-home-feed-composer]'));
    for(const element of watched)if(!current.has(element)){resize.unobserve(element);watched.delete(element)}
    for(const element of current)if(!watched.has(element)){resize.observe(element);watched.add(element)}
    railPlacement.disconnect();
    for(const element of current)if(element.matches('aside.app-shell-left-panel,'+railSelector))
      railPlacement.observe(element,{attributes:true,attributeFilter:['style','class','hidden','aria-hidden']});
  };
  addEventListener('resize',onResize);
  document.addEventListener('scroll',scheduleGlassPosition,{capture:true,passive:true});
  const appearance=new MutationObserver(()=>{if(removed)return;syncNativePreference();});
  appearance.observe(root,{attributes:true,attributeFilter:['data-theme','data-spider-codex','data-spider-surface','data-spider-native-dark']});
  function diagnose(){
    const appearance=root.getAttribute('data-theme'),nativeDark=nativePreference.matches;
    if(lastDiagnosis&&lastDiagnosis.appearance===appearance&&lastDiagnosis.nativeDark===nativeDark)return lastDiagnosis;
    const input=visibleFirst(composerSelector),editable=input?.matches('[contenteditable="true"],textarea,input')?input:input?.querySelector('[contenteditable="true"],textarea,input,[role="textbox"]');
    const prose=visibleFirst('[data-markdown-text-style="assistant-message"]');
    const page=surfaceStatus??surface(),compatible=supportsSurface(page);
    const active=compatible&&root.getAttribute('data-spider-codex')==='on';
    const ready=compatible&&(page!=='login'||!!visibleFirst('[data-spider-auth-primary],[data-spider-auth-secondary],[data-spider-auth-link],button.bg-primary-solid,button.bg-surface'));
    lastDiagnosis={ok:active&&ready,readyForHandoff:active&&ready,surface:page,compatible,
      reason:!compatible?(page==='loading'?'native-page-loading':'unrecognized-native-surface'):!ready?'native-controls-loading':!active?'theme-suspended':null,
      version:VERSION,adaptive:!!config.adaptive,main:!!visibleFirst(mainSelector),composer:!!input,editable:!!editable,background:!!bg,clickEffects:false,appearance,nativeDark,active,proseColor:prose?getComputedStyle(prose).color:null};
    return lastDiagnosis;
  }
  function remove({preserveArtwork=false}={}){
    if(removed)return;removed=true;
    hideHoverLight(true);
    hideUsageTooltip();usageTooltip?.remove();
    document.removeEventListener('pointerover',scheduleUsageTooltip,true);
    document.removeEventListener('focusin',scheduleUsageTooltip,true);
    document.removeEventListener('pointerout',leaveUsageTooltip,true);
    document.removeEventListener('focusout',leaveUsageTooltip,true);
    document.removeEventListener('pointerdown',hideUsageTooltip,true);
    window.removeEventListener('resize',hideUsageTooltip);
    window.removeEventListener('blur',hideUsageTooltip);
    syncCodeSurfaces(false);
    clearTimeout(scheduled);clearTimeout(menuTimer);
    if(hoverFrame)cancelAnimationFrame(hoverFrame);
    document.removeEventListener('pointermove',moveHoverLight);document.removeEventListener('pointerover',moveHoverLight);document.removeEventListener('pointerout',leaveHoverLight);document.removeEventListener('scroll',scrollHoverLight,true);removeEventListener('blur',hideHoverLight);hoverLight.remove();
    if(scrollFrame)cancelAnimationFrame(scrollFrame);
    clickReview?.disconnect();
    document.removeEventListener('pointerdown',beginMenuReview,true);
    document.removeEventListener('scroll',beginScrollReview,true);
    for(const name of Object.keys(authTagged))reconcileMarkers(authTagged[name],'data-spider-auth-'+name,new Set());
    for(const [elements,attribute] of [
      [settingsTagged,'data-spider-settings'],[glassTagged,'data-spider-glass-panel'],
      [paneTagged,'data-spider-settings-pane'],[popupTagged,'data-spider-popup-panel'],
      [attachmentTagged,'data-spider-attachment-panel'],[floatingTagged,'data-spider-floating-surface'],
      [monochromeTagged,'data-spider-monochrome-icon'],[quotaRowsTagged,'data-spider-quota-row'],
      [embeddedTagged,'data-spider-embedded-anchor'],[sliderShellsTagged,'data-spider-slider-shell'],[permissionsTagged,'data-spider-permission-button'],
      [quotaGroupsTagged,'data-spider-quota-group'],[iconTagged,'data-spider-home-svg'],[tagged,'data-spider-structural']
      ,[avatarTagged,'data-spider-avatar-button']
      ,[usagePopoversTagged,'data-spider-usage-popover']
      ,[rowActionsTagged,'data-spider-row-action'],[diffCardsTagged,'data-spider-diff-card'],[diffEndsTagged,'data-spider-diff-end']
      ,[raisedRowsTagged,'data-spider-raised-row'],[raisedStaticsTagged,'data-spider-raised-static']
      ,[mediaTagged,'data-spider-media-preview'],[sentMediaTagged,'data-spider-media-sent'],[activitySurfacesTagged,'data-spider-activity-surface'],[activityHitsTagged,'data-spider-activity-hit']
      ,[nativeEdgesTagged,'data-spider-native-edge']
      ,[compactHoversTagged,'data-spider-compact-hover']
      ,[compactSurfacesTagged,'data-spider-compact-surface'],[compactHitsTagged,'data-spider-compact-hit']
    ])for(const element of elements)element.removeAttribute(attribute);
    document.removeEventListener('scroll',scheduleGlassPosition,true);
    if(glassFrame)cancelAnimationFrame(glassFrame);
    syncGlassPositions(new Set());glassResize.disconnect();glassMovement.disconnect();
    nativePreference.removeEventListener('change',syncNativePreference);
    for(const name of ['data-spider-native-dark','data-spider-surface','data-spider-poster-layout','data-spider-codex'])root.removeAttribute(name);
    for(const key of railVariables)root.style.removeProperty(key);
    observer.disconnect();appearance.disconnect();resize.disconnect();railPlacement.disconnect();watched.clear();
    removeEventListener('resize',onResize);style.remove();layoutStyle.remove();
    if(ownedArtUrl&&!preserveArtwork)URL.revokeObjectURL(artUrl);
    if(!preserveArtwork)for(const key of ['frostUrl','clearUrl'])if(artworkCache[key])URL.revokeObjectURL(artworkCache[key]);
    root.style.removeProperty('--spider-frosted-art');
    root.style.removeProperty('--spider-clear-art');
    for(const e of homeTagged){e.removeAttribute('data-spider-home-main');e.removeAttribute('data-spider-home-composer');e.removeAttribute('data-spider-home-heading')}
    delete window[KEY];
  }
  clearSurfaces();
  window[KEY]={remove,diagnose,review:()=>({...review}),refresh:clearSurfaces,healthy:()=>!removed&&root===document.documentElement&&observedBody===document.body&&style.isConnected&&layoutStyle.isConnected&&hoverLight.isConnected,version:VERSION,stylesheetRevision,wallpaperUrl:artUrl,artworkCache,adaptive:!!config.adaptive,layoutRevision};return diagnose();
})
