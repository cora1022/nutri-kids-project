"""다운로드한 Google 웹 OAuth JSON을 비밀값 출력 없이 환경 파일에 반영한다."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import tempfile


def configure(credentials: Path, env_file: Path, redirect_uri: str) -> None:
    document = json.loads(credentials.read_text(encoding="utf-8-sig"))
    client = document.get("web", {})
    if not client.get("client_id") or not client.get("client_secret"):
        raise ValueError("웹 애플리케이션 OAuth 클라이언트 파일이 필요합니다.")
    if redirect_uri not in client.get("redirect_uris", []):
        raise ValueError("운영 콜백 주소가 발급 파일의 등록 목록에 없습니다.")
    original = env_file.read_text(encoding="utf-8-sig") if env_file.exists() else ""
    match = re.search(r"^OAUTH_SESSION_SECRET=(.+)$", original, re.MULTILINE)
    existing = match.group(1).strip().strip('"\'') if match else ""
    values = {
        "GOOGLE_CLIENT_ID": client["client_id"],
        "GOOGLE_CLIENT_SECRET": client["client_secret"],
        "GOOGLE_REDIRECT_URI": redirect_uri,
        "FRONTEND_URL": "https://nutri.cora1022.com",
        "COOKIE_SECURE": "true",
        "OAUTH_SESSION_SECRET": existing if len(existing) >= 32 else secrets.token_urlsafe(48),
    }
    lines = [line for line in original.splitlines()
             if not any(re.match(rf"^(?:export\s+)?{name}\s*=", line) for name in values)]
    lines.extend(f"{name}={json.dumps(value)}" for name, value in values.items())
    env_file.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=".oauth-env-", dir=env_file.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
            output.write("\n".join(lines) + "\n")
        os.chmod(temporary, 0o600)
        os.replace(temporary, env_file)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print("Google OAuth environment configured; secret values were not printed.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--credentials", type=Path, required=True)
    parser.add_argument("--env", type=Path, required=True)
    parser.add_argument("--redirect-uri", default="https://nutri.cora1022.com/api/v1/auth/google/callback")
    args = parser.parse_args()
    configure(args.credentials, args.env, args.redirect_uri)


if __name__ == "__main__":
    main()
