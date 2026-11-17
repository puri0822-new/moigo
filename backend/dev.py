"""개발용 백엔드 실행기: backend/app의 .py 파일이 바뀌면 서버를 다시 띄운다.

uvicorn --reload는 Windows에서 서버 프로세스에 CTRL_C_EVENT를 보내 재시작하는데, 이 신호는 콘솔 창이 붙은
프로세스에만 전달된다. 그래서 콘솔 없이 띄우면(백그라운드 실행, .claude/launch.json 등) 서버가 끝나지 않고
"Reloading..."에서 영원히 멈춘다. 여기서는 서버를 자식 프로세스로 띄우고 바뀌면 직접 종료한 뒤 다시 띄운다.

사용법 (저장소 루트에서): backend/venv/Scripts/python.exe backend/dev.py [--port 8000]
"""
import argparse
import subprocess
import sys
from pathlib import Path

from watchfiles import PythonFilter, watch

BACKEND_DIR = Path(__file__).resolve().parent
APP_DIR = BACKEND_DIR / "app"
STOP_TIMEOUT_SECONDS = 5


def start(port: int) -> subprocess.Popen:
    return subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--app-dir", str(BACKEND_DIR), "--port", str(port)],
    )


def stop(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    # Windows에서는 terminate가 곧 강제 종료다 (개발용이라 lifespan 정리를 건너뛰어도 괜찮다.
    # DB는 끊긴 연결의 트랜잭션을 되돌린다). 다른 OS에서는 SIGTERM이라 정상 종료를 기다린다
    proc.terminate()
    try:
        proc.wait(STOP_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()


def main() -> None:
    parser = argparse.ArgumentParser(description="모이고 백엔드 개발 서버 (자동 재시작)")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    proc = start(args.port)
    try:
        for changes in watch(APP_DIR, watch_filter=PythonFilter()):
            names = ", ".join(sorted({Path(path).name for _, path in changes}))
            print(f"[dev] 변경 감지: {names} → 서버 재시작", flush=True)
            stop(proc)
            proc = start(args.port)
    except KeyboardInterrupt:
        pass
    finally:
        stop(proc)


if __name__ == "__main__":
    main()
