//! 使い捨てのローカルHTTPサーバーを使うテスト用の補助。

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;
use std::time::Duration;

/// リクエストを最後まで読む(ヘッダーと、Content-Length 分の本文)。
fn read_request(socket: &mut TcpStream) -> String {
    let mut received = Vec::new();
    let mut buf = [0u8; 4096];
    loop {
        let n = socket.read(&mut buf).unwrap();
        received.extend_from_slice(&buf[..n]);
        let text = String::from_utf8_lossy(&received);
        if let Some((head, body)) = text.split_once("\r\n\r\n") {
            let length = head
                .lines()
                .find_map(|l| {
                    l.to_ascii_lowercase()
                        .strip_prefix("content-length:")
                        .map(|v| v.trim().parse::<usize>().unwrap())
                })
                .unwrap_or(0);
            if body.len() >= length {
                break;
            }
        }
        if n == 0 {
            break;
        }
    }
    String::from_utf8_lossy(&received).into_owned()
}

/// 1回だけリクエストを受け、指定した生のレスポンスを返して終了する。
/// ベースURLと、受け取ったリクエスト全文を返すハンドルを返す。
pub fn serve_once(response: String) -> (String, thread::JoinHandle<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}/v1", listener.local_addr().unwrap());
    let handle = thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        let request = read_request(&mut socket);
        socket.write_all(response.as_bytes()).unwrap();
        request
    });
    (url, handle)
}

/// リクエストを受けて `initial` だけ返したあと、クライアントが切断するまで接続を保つ。
/// 中断のテスト用(切断しないまま15秒経ったら諦める)。
pub fn serve_hanging(initial: String) -> (String, thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}/v1", listener.local_addr().unwrap());
    let handle = thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        read_request(&mut socket);
        let _ = socket.write_all(initial.as_bytes());
        let _ = socket.set_read_timeout(Some(Duration::from_secs(15)));
        let mut buf = [0u8; 64];
        // クライアントが切断すると 0 かエラーが返る
        let _ = socket.read(&mut buf);
    });
    (url, handle)
}

/// 正しい `Content-Length` 付きの、JSONの生のレスポンスを作る。
pub fn json_response(status_line: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {status_line}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
}
