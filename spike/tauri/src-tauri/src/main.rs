// Casca de medição do spike da Fase 1: não é o produto. Lê o mesmo estado na mesma cadência do main.js
// (poller de 400 ms, batimento de 2 s) e desenha a mesma index.html, mas não decide permissões.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{
    fs,
    path::PathBuf,
    sync::{Arc, Mutex},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{webview::PageLoadEvent, Emitter, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

// Gerenciadores de janela em mosaico (komorebi) ignoram WS_EX_TOOLWINDOW, como o Electron faz com skipTaskbar.
#[cfg(windows)]
fn make_tool_window(window: &tauri::WebviewWindow) {
    #[link(name = "user32")]
    extern "system" {
        fn GetWindowLongPtrW(hwnd: isize, index: i32) -> isize;
        fn SetWindowLongPtrW(hwnd: isize, index: i32, value: isize) -> isize;
    }
    const GWL_EXSTYLE: i32 = -20;
    const WS_EX_TOOLWINDOW: isize = 0x80;
    const WS_EX_APPWINDOW: isize = 0x40000;
    if let Ok(hwnd) = window.hwnd() {
        let hwnd = hwnd.0 as isize;
        unsafe {
            let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, (style | WS_EX_TOOLWINDOW) & !WS_EX_APPWINDOW);
        }
    }
}

const SHIM: &str = include_str!("shim.js");
const EMPTY: &str = r#"{"count":0}"#;

// Mesma regra do state.js: USERPROFILE/.claude/island
fn state_dir() -> PathBuf {
    let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).unwrap_or_default();
    PathBuf::from(home).join(".claude").join("island")
}

// Mesma carga do main.js: lista a pasta e lê os .json
fn read_state(dir: &PathBuf) -> String {
    let (mut count, mut first) = (0, String::new());
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            if let Ok(raw) = fs::read_to_string(&path) {
                if first.is_empty() {
                    first = raw;
                }
                count += 1;
            }
        }
    }
    if count == 0 {
        EMPTY.to_string()
    } else {
        format!(r#"{{"count":{count},"session":{first}}}"#)
    }
}

fn main() {
    let last = Arc::new(Mutex::new(EMPTY.to_string()));
    let for_pages = last.clone();
    tauri::Builder::default()
        .setup(move |app| {
            let all = std::env::var("ISLAND_WINDOWS").map(|v| v == "all").unwrap_or(false);
            let mut monitors = app.available_monitors()?;
            if !all {
                if let Some(primary) = app.primary_monitor()? {
                    monitors = vec![primary];
                }
            }
            for (index, monitor) in monitors.iter().enumerate() {
                let scale = monitor.scale_factor();
                let state_for_page = for_pages.clone();
                let window = WebviewWindowBuilder::new(app, format!("island-{index}"), WebviewUrl::App("index.html".into()))
                    .inner_size(440.0, 324.0)
                    .transparent(true)
                    .decorations(false)
                    .shadow(false)
                    .resizable(false)
                    .always_on_top(true)
                    .skip_taskbar(true)
                    .focusable(false)
                    .visible(false)
                    .initialization_script(SHIM)
                    .on_page_load(move |webview, payload| {
                        // O estado inicial só chega depois que a página registrou o ouvinte (fim do load).
                        if let PageLoadEvent::Finished = payload.event() {
                            let _ = webview.emit("island:state", state_for_page.lock().unwrap().clone());
                        }
                    })
                    .build()?;
                // Pixels físicos do monitor-alvo; a posição lógica do builder usa a escala errada em multi-DPI.
                let work = monitor.work_area();
                let size = PhysicalSize::new((440.0 * scale).round() as u32, (324.0 * scale).round() as u32);
                let position = PhysicalPosition::new(
                    work.position.x + (work.size.width as i32 - size.width as i32) / 2,
                    work.position.y,
                );
                let _ = window.set_size(size);
                let _ = window.set_position(position);
                let _ = window.show();
                // O Tao regrava o estilo estendido ao mostrar: aplicar depois, e reaplicar a geometria.
                let delayed = window.clone();
                thread::spawn(move || {
                    thread::sleep(Duration::from_millis(300));
                    #[cfg(windows)]
                    make_tool_window(&delayed);
                    let _ = delayed.set_size(size);
                    let _ = delayed.set_position(position);
                });
            }
            let handle = app.handle().clone();
            let shared = last.clone();
            thread::spawn(move || {
                let dir = state_dir();
                let _ = fs::create_dir_all(&dir);
                let mut tick = 0u64;
                loop {
                    // Batimento de 2 s, como o main.js
                    if tick % 5 == 0 {
                        let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
                        let _ = fs::write(dir.join(".heartbeat"), now.to_string());
                    }
                    let state = read_state(&dir);
                    if *shared.lock().unwrap() != state {
                        *shared.lock().unwrap() = state.clone();
                        let _ = handle.emit("island:state", state);
                    }
                    tick += 1;
                    thread::sleep(Duration::from_millis(400));
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("falha ao iniciar o Tauri");
}
