use std::fs;
use std::path::Path;

#[tauri::command]
fn validate_project(path: String) -> bool {
    Path::new(&path).join(".kbz").join("config.yaml").exists()
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct DirEntry {
    name: String,
    is_dir: bool,
}

#[tauri::command]
fn read_directory(path: String) -> Result<Vec<DirEntry>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        if let Some(name) = entry.file_name().to_str() {
            result.push(DirEntry {
                name: name.to_string(),
                is_dir: entry.file_type().map(|t| t.is_dir()).unwrap_or(false),
            });
        }
    }
    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            use tauri::{
                menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
                Emitter, Manager,
            };

            // ── App menu (macOS app menu) ─────────────────────────────
            let settings_item = MenuItemBuilder::new("Settings…")
                .id("settings")
                .enabled(false)
                .build(app)?;

            let app_menu = SubmenuBuilder::new(app, "KBZV")
                .item(&PredefinedMenuItem::about(app, Some("About KBZV"), None)?)
                .separator()
                .item(&settings_item)
                .separator()
                .item(&PredefinedMenuItem::hide(app, Some("Hide KBZV"))?)
                .item(&PredefinedMenuItem::hide_others(app, None)?)
                .item(&PredefinedMenuItem::show_all(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, Some("Quit KBZV"))?)
                .build()?;

            // ── File menu ─────────────────────────────────────────────
            let open_item = MenuItemBuilder::new("Open Project…")
                .id("open_project")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;

            let close_item = MenuItemBuilder::new("Close")
                .id("close_window")
                .accelerator("CmdOrCtrl+W")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&open_item)
                .separator()
                .item(&close_item)
                .build()?;

            // ── Edit menu (standard text-editing shortcuts) ───────────
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            // ── Window menu ───────────────────────────────────────────
            let window_menu = SubmenuBuilder::new(app, "Window")
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::fullscreen(app, None)?)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&window_menu)
                .build()?;

            app.set_menu(menu)?;

            // ── Menu event handler ────────────────────────────────────
            app.on_menu_event(move |app, event| match event.id().as_ref() {
                "open_project" => {
                    // Notify the frontend to trigger the folder-picker dialog
                    app.emit("menu:open-project", ()).ok();
                }
                "close_window" => {
                    if let Some(window) = app.get_webview_window("main") {
                        window.hide().ok();
                    }
                }
                _ => {}
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            validate_project,
            read_text_file,
            read_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
