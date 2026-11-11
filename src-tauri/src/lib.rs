pub mod bindings;
mod commands;
mod state;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = bindings::builder();

    tauri::Builder::default()
        // ファイル選択のダイアログは、Rust側のコマンド(`import_pick_file`)からだけ使う。
        // 画面(JS)にはこのプラグインの権限を与えない
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            // 自動更新(GitHub Releasesのlatest.jsonを見る)と、更新後の再起動。
            // デスクトップだけ。公開鍵は設定にあり、秘密鍵はリポジトリに置かない
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            // 設定ファイルの置き場所。OSごとのアプリのデータディレクトリ
            let data_dir = app.path().app_data_dir()?;
            app.manage(state::AppState::new(data_dir)?);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("アプリの起動に失敗しました");
}
