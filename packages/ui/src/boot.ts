// Pure (no React Native): the web <head> script that applies the saved theme before the bundle loads.
import { themes } from './tokens';

export const THEME_STORAGE_KEY = 'erre:theme';

export const themeBootScript = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var s=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';var n=p==='light'?'light':p==='system'?s:'dark';var c=n==='light'?'${themes.light.bg.canvas}':'${themes.dark.bg.canvas}';var r=document.documentElement;r.style.colorScheme=n;r.style.backgroundColor=c;r.dataset.theme=n;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',c);}catch(e){}})();`;
