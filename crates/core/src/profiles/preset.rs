//! プロファイルを追加するときの雛形(vLLM・llama.cpp・LM Studio・Ollama・カスタム)。

use serde::{Deserialize, Serialize};
use specta::Type;

use super::model::ConnectionProfile;
use crate::settings::DEFAULT_MODEL;

/// 追加するプロファイルの種類。名前とURLの初期値だけが違い、追加後は自由に編集できる。
///
/// 通信の仕方はどれも同じ(OpenAI互換の `/completions` と `/models`)。
/// サーバーごとの差は、ここでは吸収しない。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ProfilePreset {
    Vllm,
    LlamaCpp,
    LmStudio,
    Ollama,
    /// 上のどれでもないサーバー。URLは書き換える前提で、vLLMと同じ初期値にしておく
    Custom,
}

impl ProfilePreset {
    pub const ALL: [Self; 5] = [
        Self::Vllm,
        Self::LlamaCpp,
        Self::LmStudio,
        Self::Ollama,
        Self::Custom,
    ];

    /// 一覧に出す名前(プロファイルの初期の名前にもなる)。
    ///
    /// 製品名はそのまま、カスタムだけ日本語。保存される接続先の名前であり、画面の文言ファイルとは別。
    pub fn label(self) -> &'static str {
        match self {
            Self::Vllm => "vLLM",
            Self::LlamaCpp => "llama.cpp",
            Self::LmStudio => "LM Studio",
            Self::Ollama => "Ollama",
            Self::Custom => "カスタム",
        }
    }

    /// 各サーバーの既定のポートで待ち受けるときのベースURL。
    pub fn base_url(self) -> &'static str {
        match self {
            Self::Vllm | Self::Custom => "http://localhost:8000/v1",
            Self::LlamaCpp => "http://localhost:8080/v1",
            Self::LmStudio => "http://localhost:1234/v1",
            Self::Ollama => "http://localhost:11434/v1",
        }
    }

    /// 保存済みのURLが、どの雛形の既定URLか。カスタムはvLLMと同じURLなので、判定には使わない。
    pub fn name_for_url(url: &str) -> &'static str {
        match url {
            url if url == Self::Vllm.base_url() => Self::Vllm.label(),
            url if url == Self::LlamaCpp.base_url() => Self::LlamaCpp.label(),
            url if url == Self::LmStudio.base_url() => Self::LmStudio.label(),
            url if url == Self::Ollama.base_url() => Self::Ollama.label(),
            _ => Self::Custom.label(),
        }
    }

    /// この種類の新しいプロファイル。`id` と `name` は呼び出し側が重ならないように決める。
    /// モデル名の初期値は、このアプリの翻訳モデル。
    pub fn profile(self, id: String, name: String) -> ConnectionProfile {
        ConnectionProfile {
            id,
            name,
            base_url: self.base_url().to_owned(),
            model: DEFAULT_MODEL.to_owned(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::validate_base_url;

    #[test]
    fn every_preset_has_a_valid_url_that_survives_normalization() {
        for preset in ProfilePreset::ALL {
            assert_eq!(
                validate_base_url(preset.base_url()).unwrap(),
                preset.base_url(),
                "{preset:?}"
            );
        }
    }

    #[test]
    fn the_servers_use_their_default_ports() {
        assert!(ProfilePreset::Vllm.base_url().contains(":8000/"));
        assert!(ProfilePreset::LlamaCpp.base_url().contains(":8080/"));
        assert!(ProfilePreset::LmStudio.base_url().contains(":1234/"));
        assert!(ProfilePreset::Ollama.base_url().contains(":11434/"));
        assert_eq!(
            ProfilePreset::Custom.base_url(),
            ProfilePreset::Vllm.base_url()
        );
    }

    #[test]
    fn known_urls_get_the_preset_name_and_the_rest_are_custom() {
        assert_eq!(
            ProfilePreset::name_for_url("http://localhost:8000/v1"),
            "vLLM"
        );
        assert_eq!(
            ProfilePreset::name_for_url("http://localhost:11434/v1"),
            "Ollama"
        );
        assert_eq!(
            ProfilePreset::name_for_url("http://192.168.0.5:8000/v1"),
            "カスタム"
        );
    }

    #[test]
    fn the_profile_starts_from_the_preset_and_the_translate_model() {
        let profile = ProfilePreset::Ollama.profile("p1".into(), "Ollama 2".into());

        assert_eq!(profile.id, "p1");
        assert_eq!(profile.name, "Ollama 2");
        assert_eq!(profile.base_url, "http://localhost:11434/v1");
        assert_eq!(profile.model, DEFAULT_MODEL);
        assert!(profile.validated().is_ok());
    }
}
