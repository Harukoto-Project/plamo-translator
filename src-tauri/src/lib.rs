pub mod bindings;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = bindings::builder();

    tauri::Builder::default()
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("アプリの起動に失敗しました");
}
