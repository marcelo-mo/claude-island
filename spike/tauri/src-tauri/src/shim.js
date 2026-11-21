(() => {
  const toState = (raw) => {
    const { count, session } = JSON.parse(raw);
    if (!session) return { state: 'idle', count: 0 };
    return {
      state: session.state, detail: session.detail, project: session.project, count,
      windowPid: null, context: null, permission: session.permission || null,
    };
  };
  const noop = () => {};
  // Os 11 métodos do preload.js; só onState é real, a casca de medição não interage.
  window.island = {
    // true: a casca paga o mesmo aviso sonoro do Electron (a primeira ilha toca)
    onState: (callback) => window.__TAURI__.event.listen('island:state', (event) => callback(toState(event.payload), true)),
    onCursor: noop, setCapture: noop, focusSession: noop, decide: noop, drag: noop, endDrag: noop, resetPosition: noop,
    openMenu: noop, selectSession: noop, wheel: noop,
  };
})();
