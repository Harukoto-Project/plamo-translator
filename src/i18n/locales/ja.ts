/**
 * 日本語の文言。UI の文言はここにキーで定義し、コンポーネントには直書きしない。
 * 言語を足すときは、このファイルと同じ形のファイルを `locales/` に追加し、`resources.ts` に登録する。
 */
export const ja = {
  app: {
    name: "PLaMo Translator",
    tagline: "PLaMo翻訳モデル向けの翻訳アプリ",
  },
  // 翻訳の言語名。アプリのUI言語に関わらず、その言語の自称で表示する
  languages: {
    ja: "日本語",
    en: "English",
    ko: "한국어",
  },
  translate: {
    sourceLanguage: "原文の言語",
    targetLanguage: "訳文の言語",
    sourceLabel: "原文",
    targetLabel: "訳文",
    sourcePlaceholder: "翻訳したい文章を入力してください",
    targetPlaceholder: "ここに訳文が表示されます",
    languageAuto: "自動",
    detected: "{{language}}を検出",
    swap: "言語と文章を入れ替える",
    copy: "コピー",
    copied: "コピーしました",
    copyFailed: "コピーできませんでした",
    retranslate: "再翻訳",
    translate: "翻訳",
    stop: "停止",
    shortcut: "{{modifier}} + Enter で翻訳",
    status: {
      running: "翻訳しています…",
      done: "翻訳が完了しました",
      stopped: "翻訳を停止しました",
      error: "翻訳できませんでした",
    },
    statsExact: "{{speed}} tokens/s",
    statsEstimated: "約 {{speed}} tokens/s",
    warnings: {
      delimiterRemoved:
        "原文に含まれていた「<|plamo:op|>」は、モデルへの指示と区別できないため取り除きました。",
      outputTruncated:
        "最大出力トークン数に達したため、訳文が途中で切れている可能性があります。設定で上限を増やしてください。",
    },
    errorTitle: "翻訳できませんでした",
  },
  settings: {
    open: "設定",
    title: "設定",
    description:
      "接続先を登録して切り替えます。APIキーはOSの資格情報ストアに保存され、画面には戻りません。",
    profiles: "接続先",
    active: "使用中",
    use: "使用する",
    add: "追加",
    preset: "追加する種類",
    delete: "削除",
    deleteConfirm: "削除する",
    deleteCancel: "やめる",
    lastProfile: "最後の接続先は削除できません。",
    name: "名前",
    baseUrl: "接続先URL",
    baseUrlHint: "例: http://localhost:8000/v1",
    model: "モデル名",
    modelHint: "空にすると、サーバーの既定のモデルを使います。",
    modelFetch: "モデル一覧を取得",
    modelFetching: "取得しています…",
    modelEmpty: "モデルが見つかりませんでした。名前を入力してください。",
    modelUnavailable:
      "モデル一覧を取得できませんでした。名前を入力してください。",
    modelPick: "取得したモデル",
    modelServerDefault: "サーバーの既定",
    modelSavedHint:
      "一覧は、保存済みのURLとAPIキーで取得します。変えたあとは、一度保存してから取得してください。",
    apiKey: "APIキー",
    apiKeyHint: "不要なサーバーなら空のままにします。",
    apiKeySaved: "保存済み(入力すると置き換えます)",
    apiKeyClear: "削除する",
    apiKeyWillClear: "保存すると削除されます",
    apiKeyUndoClear: "削除を取り消す",
    apiKeyUnsaved:
      "キーはメモリにだけあります。OSの資格情報ストアに書けなかったため、アプリを終了すると失われます。",
    maxTokens: "最大出力トークン数",
    maxTokensHint:
      "1回の翻訳で出力するトークン数の上限です。すべての接続先で共通です。",
    save: "保存",
    saving: "保存しています…",
    cancel: "キャンセル",
    loading: "読み込んでいます…",
    loadFailed: "設定を読み込めませんでした",
    version: "バージョン {{version}}",
    presets: {
      vllm: "vLLM",
      llamaCpp: "llama.cpp",
      lmStudio: "LM Studio",
      ollama: "Ollama",
      custom: "カスタム",
    },
  },
  // 自動更新。リリースノートは出さない(ビルド時点の本文で固定され、後から直しても届かない)
  update: {
    title: "新しいバージョンがあります",
    availableDescription:
      "v{{current}}からv{{next}}に更新できます。更新するとアプリが再起動します。",
    later: "あとで",
    installAndRestart: "更新して再起動",
    retry: "もう一度試す",
    downloading: "ダウンロード中",
    percent: "{{percent}}%",
    installFailed: "更新できませんでした: {{detail}}",
    installFailedUnknown: "更新できませんでした。",
    missing: "更新が見つかりません。",
  },
  // Rust が返すエラーの種別ごとの文言(`lib/app-error.ts` が引く)
  errors: {
    connectionFailed:
      "サーバーに接続できません({{url}})。サーバーが起動しているか、設定のURLを確認してください。",
    invalidUrl: {
      empty: "URLを入力してください。",
      containsWhitespace: "URLに空白を含めることはできません。",
      malformed:
        "URLの形式が正しくありません。http://localhost:8000/v1 のように、http:// または https:// で始めてください。",
      missingHost: "URLにホスト名がありません。",
      queryOrFragment: "URLに「?」や「#」を含めることはできません。",
      credentials:
        "URLにユーザー名やパスワードを含めることはできません。APIキーの欄に入力してください。",
    },
    timeout: "サーバーからの応答がタイムアウトしました。",
    http: "サーバーがエラーを返しました: {{detail}}",
    httpWithStatus: "サーバーがエラーを返しました(HTTP {{status}}): {{detail}}",
    contextLengthExceeded:
      "原文が長すぎて、モデルのコンテキスト長を超えました。原文を短くするか、サーバーのコンテキスト長を増やしてください。({{detail}})",
    invalidResponse: "サーバーの応答を解釈できませんでした: {{detail}}",
    emptyText: "翻訳する文章を入力してください。",
    invalidMaxTokens: "最大出力トークン数は、1以上の整数で入力してください。",
    invalidProfileName: {
      empty: "接続先の名前を入力してください。",
      tooLong: "接続先の名前は60文字以内にしてください。",
    },
    profileNotFound: "接続先が見つかりません。",
    duplicateProfile: "同じ接続先が既にあります。",
    lastProfile: "最後の接続先は削除できません。",
    settingsReadFailed: "設定ファイルを読み込めませんでした: {{detail}}",
    settingsWriteFailed: "設定ファイルを保存できませんでした: {{detail}}",
    settingsVersionUnsupported:
      "設定ファイルが、このアプリより新しいバージョン(v{{version}})で作られています。アプリを更新してください。",
    secret: "OSの資格情報ストアを利用できません: {{detail}}",
    internal: "内部エラーが発生しました: {{detail}}",
  },
} as const;
