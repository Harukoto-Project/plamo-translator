//! ベースURLの検査。

use reqwest::Url;

use crate::error::{AppError, UrlProblem};

/// 保存するURL(前後の空白と末尾のスラッシュを除いたもの)を返す。不正ならその理由。
pub fn validate_base_url(input: &str) -> Result<String, AppError> {
    let invalid = |reason| Err(AppError::InvalidUrl { reason });

    let text = input.trim();
    if text.is_empty() {
        return invalid(UrlProblem::Empty);
    }
    if text.chars().any(char::is_whitespace) {
        return invalid(UrlProblem::ContainsWhitespace);
    }
    let Ok(url) = Url::parse(text) else {
        return invalid(UrlProblem::Malformed);
    };
    if !matches!(url.scheme(), "http" | "https") {
        return invalid(UrlProblem::Malformed);
    }
    // `http:///v1` は "v1" がホストとして解釈されるが、意図はホストの欠落
    let after_scheme = text.split_once("://").map_or("", |(_, rest)| rest);
    if after_scheme.starts_with('/') || url.host_str().is_none_or(str::is_empty) {
        return invalid(UrlProblem::MissingHost);
    }
    if url.query().is_some() || url.fragment().is_some() {
        return invalid(UrlProblem::QueryOrFragment);
    }
    // 認証情報はエラーメッセージやログに出てしまうため、URLには入れさせない
    if !url.username().is_empty() || url.password().is_some() {
        return invalid(UrlProblem::Credentials);
    }
    Ok(text.trim_end_matches('/').to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn problem(input: &str) -> UrlProblem {
        match validate_base_url(input) {
            Err(AppError::InvalidUrl { reason }) => reason,
            other => panic!("エラーになるはずが {other:?}"),
        }
    }

    #[test]
    fn accepts_http_and_https_and_trims() {
        assert_eq!(
            validate_base_url("  http://localhost:8000/v1  ").unwrap(),
            "http://localhost:8000/v1"
        );
        assert_eq!(
            validate_base_url("https://api.example.com/v1").unwrap(),
            "https://api.example.com/v1"
        );
    }

    #[test]
    fn trailing_slashes_are_removed() {
        assert_eq!(
            validate_base_url("http://localhost:8000/v1//").unwrap(),
            "http://localhost:8000/v1"
        );
        assert_eq!(
            validate_base_url("http://localhost:8000/").unwrap(),
            "http://localhost:8000"
        );
    }

    #[test]
    fn blank_input_is_empty() {
        assert_eq!(problem(""), UrlProblem::Empty);
        assert_eq!(problem("   "), UrlProblem::Empty);
    }

    #[test]
    fn other_schemes_and_bare_hosts_are_malformed() {
        assert_eq!(problem("ftp://example.com/v1"), UrlProblem::Malformed);
        assert_eq!(problem("localhost:8000/v1"), UrlProblem::Malformed);
        assert_eq!(problem("example.com"), UrlProblem::Malformed);
        assert_eq!(problem("file:///tmp/x"), UrlProblem::Malformed);
    }

    #[test]
    fn missing_host_is_reported() {
        assert_eq!(problem("http://"), UrlProblem::Malformed);
        assert_eq!(problem("http:///v1"), UrlProblem::MissingHost);
    }

    #[test]
    fn whitespace_inside_is_reported() {
        assert_eq!(
            problem("http://local host/v1"),
            UrlProblem::ContainsWhitespace
        );
    }

    #[test]
    fn query_and_fragment_are_reported() {
        assert_eq!(
            problem("http://localhost/v1?x=1"),
            UrlProblem::QueryOrFragment
        );
        assert_eq!(
            problem("http://localhost/v1#top"),
            UrlProblem::QueryOrFragment
        );
    }

    #[test]
    fn credentials_in_the_url_are_reported() {
        assert_eq!(
            problem("http://user:pass@localhost/v1"),
            UrlProblem::Credentials
        );
        assert_eq!(problem("http://user@localhost/v1"), UrlProblem::Credentials);
    }
}
