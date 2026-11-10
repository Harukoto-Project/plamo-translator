//! TypeScript の型(`src/types/bindings.ts`)を生成する。ウィンドウは開かない。
//!
//! 実行: `pnpm bindings`(`cargo run -p plamo-translator --bin export-bindings`)。
//! CI では、実行後に差分がないことを確認する。

fn main() {
    let builder = plamo_translator_lib::bindings::builder();
    if let Err(error) = plamo_translator_lib::bindings::export(&builder) {
        eprintln!("TypeScript の型を書き出せませんでした: {error}");
        std::process::exit(1);
    }
    println!("src/types/bindings.ts を生成しました");
}
