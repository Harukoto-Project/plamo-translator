pub mod bindings;
mod commands;
mod state;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = bindings::builder();

    tauri::Builder::default()
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            // 設定ファイルの置き場所。OSごとのアプリのデータディレクトリ
            let data_dir = app.path().app_data_dir()?;
            app.manage(state::AppState::new(data_dir)?);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("アプリの起動に失敗しました");
}
