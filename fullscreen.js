// Sensor do primeiro plano do Windows para a tela cheia (TELA-01, D-17). Fica separado de window.js de
// propósito: os hooks fazem require de window.js, e um pacote nativo ali poderia quebrar a sessão do Claude
// Code. Só o main carrega este arquivo, e o pacote nativo só entra na primeira sondagem, no Windows.
// Só lê: nunca envia clique, tecla nem mensagem a outras janelas.

// Índice de GetWindowLongPtrW para o estilo estendido da janela.
const GWL_EXSTYLE = -20;
// MonitorFromWindow: se a janela não toca nenhum monitor, devolve o mais próximo.
const MONITOR_DEFAULTTONEAREST = 2;
// Atributo do DWM que diz se a janela está "cloaked" (por exemplo, em outra área de trabalho virtual).
const DWMWA_CLOAKED = 14;
// sizeof(MONITORINFO): 4 (cbSize) + 16 (rcMonitor) + 16 (rcWork) + 4 (dwFlags).
const MONITORINFO_SIZE = 40;
// Limite do nome de classe de janela, em caracteres (WNDCLASS: 256).
const CLASS_NAME_LIMIT = 256;

// API do pacote nativo já carregada, e o sinal de que a carga já falhou (não tenta de novo).
let nativeApi = null;
let loadFailed = false;

// Devolve as chamadas do Windows prontas, ou null fora do Windows e se o pacote nativo não carregou.
// O require fica aqui dentro, na guarda de plataforma e num try, para nada mais depender dele.
function loadNativeApi() {
  if (nativeApi) return nativeApi;
  if (loadFailed || process.platform !== 'win32') return null;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const dwmapi = koffi.load('dwmapi.dll');
    const RECT = koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' });
    const POINT = koffi.struct('POINT', { x: 'long', y: 'long' });
    const MONITORINFO = koffi.struct('MONITORINFO', {
      cbSize: 'uint32', rcMonitor: RECT, rcWork: RECT, dwFlags: 'uint32',
    });
    // HWND e HMONITOR como intptr_t: o handle chega como inteiro JS, que o nextFullscreen exige. Todo BOOL
    // do Win32 tem 4 bytes, então volta como int (o bool do koffi lê só 1 byte).
    nativeApi = {
      GetForegroundWindow: user32.func('intptr_t __stdcall GetForegroundWindow()'),
      IsWindow: user32.func('int __stdcall IsWindow(intptr_t hwnd)'),
      IsWindowVisible: user32.func('int __stdcall IsWindowVisible(intptr_t hwnd)'),
      IsIconic: user32.func('int __stdcall IsIconic(intptr_t hwnd)'),
      GetClientRect: user32.func('int __stdcall GetClientRect(intptr_t hwnd, _Out_ RECT* rect)'),
      ClientToScreen: user32.func('int __stdcall ClientToScreen(intptr_t hwnd, _Inout_ POINT* point)'),
      MonitorFromWindow: user32.func('intptr_t __stdcall MonitorFromWindow(intptr_t hwnd, uint32 flags)'),
      GetMonitorInfoW: user32.func('int __stdcall GetMonitorInfoW(intptr_t monitor, _Inout_ MONITORINFO* info)'),
      GetClassNameW: user32.func('int __stdcall GetClassNameW(intptr_t hwnd, _Out_ uint8_t* buffer, int max)'),
      GetWindowThreadProcessId: user32.func('uint32 __stdcall GetWindowThreadProcessId(intptr_t hwnd, _Out_ uint32_t* pid)'),
      GetWindowLongPtrW: user32.func('intptr_t __stdcall GetWindowLongPtrW(intptr_t hwnd, int index)'),
      DwmGetWindowAttribute: dwmapi.func('long __stdcall DwmGetWindowAttribute(intptr_t hwnd, uint32 attribute, _Out_ int32_t* value, uint32 size)'),
    };
    return nativeApi;
  } catch (error) {
    loadFailed = true;
    console.error('Sensor de tela cheia desligado: não foi possível carregar o pacote nativo:', error.message);
    return null;
  }
}

// true se a janela está cloaked, false se não, null se o DWM não respondeu.
function isCloaked(api, hwnd) {
  const value = [0];
  return api.DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, value, 4) === 0 ? value[0] !== 0 : null;
}

// Um HWND lembrado "sumiu" se fechou, minimizou, ficou invisível ou cloaked (troca de área de trabalho
// virtual): a ilha não deve ficar escondida sobre nada que o usuário não vê.
function isGone(api, hwnd) {
  return api.IsWindow(hwnd) === 0 || api.IsWindowVisible(hwnd) === 0 || api.IsIconic(hwnd) !== 0
    || isCloaked(api, hwnd) === true;
}

function readForeground(api) {
  // Os handles de janela cabem em 32 bits, então Number não perde nada se o pacote devolver BigInt.
  const hwnd = Number(api.GetForegroundWindow());
  if (!Number.isInteger(hwnd) || hwnd <= 0) return null;

  const nameBuffer = Buffer.alloc(CLASS_NAME_LIMIT * 2);
  const nameLength = api.GetClassNameW(hwnd, nameBuffer, CLASS_NAME_LIMIT);
  const className = nameLength > 0 ? nameBuffer.toString('utf16le', 0, nameLength * 2) : '';
  const pidOut = [0];
  api.GetWindowThreadProcessId(hwnd, pidOut);
  // O estilo estendido usa só os 32 bits baixos do LONG_PTR.
  const exStyle = Number(BigInt.asUintN(32, BigInt(api.GetWindowLongPtrW(hwnd, GWL_EXSTYLE))));

  const size = {};
  const origin = { x: 0, y: 0 };
  const clientRect = api.GetClientRect(hwnd, size) !== 0 && api.ClientToScreen(hwnd, origin) !== 0
    ? { left: origin.x, top: origin.y, right: origin.x + size.right, bottom: origin.y + size.bottom }
    : null;
  const info = { cbSize: MONITORINFO_SIZE };
  const monitorRect = api.GetMonitorInfoW(api.MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST), info) !== 0
    ? { left: info.rcMonitor.left, top: info.rcMonitor.top, right: info.rcMonitor.right, bottom: info.rcMonitor.bottom }
    : null;

  return {
    hwnd,
    className,
    pid: pidOut[0],
    exStyle,
    visible: api.IsWindowVisible(hwnd) !== 0,
    minimized: api.IsIconic(hwnd) !== 0,
    cloaked: isCloaked(api, hwnd),
    clientRect,
    monitorRect,
  };
}

/**
 * Amostra do primeiro plano no formato que o nextFullscreen (state.js) espera: { foreground, gone }.
 * `foreground` é null ou { hwnd, className, pid, exStyle, visible, minimized, cloaked, clientRect,
 * monitorRect } em pixels físicos; `gone` lista os HWND de `rememberedHwnds` que sumiram. Devolve null fora
 * do Windows, sem o pacote nativo ou se uma chamada falhar. Nunca lança e nunca registra dados da amostra:
 * nome de classe e pid de janelas de outros apps ficam só em memória.
 */
function probeForeground(rememberedHwnds) {
  const api = loadNativeApi();
  if (!api) return null;
  const remembered = Array.isArray(rememberedHwnds) ? rememberedHwnds.filter(Number.isInteger) : [];
  try {
    return {
      foreground: readForeground(api),
      gone: remembered.filter((hwnd) => isGone(api, hwnd)),
    };
  } catch {
    // falha de uma chamada do Windows: sem amostra, o nextFullscreen não muda o mapa
    return null;
  }
}

module.exports = { probeForeground };
