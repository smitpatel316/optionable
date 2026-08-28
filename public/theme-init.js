// Apply dark mode immediately to prevent flash (dark is default unless the
// user explicitly chose light). External file because the server CSP is
// `script-src 'self'` — an inline copy of this used to be blocked in prod.
(function () {
    var theme = localStorage.getItem('theme');
    if (theme !== 'light') {
        document.documentElement.classList.add('dark');
    }
})();
