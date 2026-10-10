// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Fix for WebKitGTK solid gray blank window on Linux (CachyOS/Arch, Wayland, XWayland, NVIDIA/Mesa)
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
        // If Wayland session is active and GDK_BACKEND was forced to x11 (by AppImage AppRun),
        // restore native Wayland with x11 fallback
        if std::env::var("WAYLAND_DISPLAY").is_ok() {
            std::env::set_var("GDK_BACKEND", "wayland,x11");
        }
    }

    app_lib::run();
}
