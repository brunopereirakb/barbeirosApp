// Server-safe: a plain string constant the layout can inject as a <script>
// before paint, to prevent the flash-of-wrong-theme. Keep this file free of
// React imports and the "use client" directive so it can be consumed by both
// server and client components.

export const THEME_STORAGE_KEY = "theme";

export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var v = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = v === 'dark' || (v !== 'light' && sysDark);
    if (dark) document.documentElement.classList.add('dark');
  } catch(e){}
})();
`;
