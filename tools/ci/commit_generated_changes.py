from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path


def run(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    print("+", " ".join(args))
    return subprocess.run(args, check=check, text=True)


def capture(args: list[str]) -> str:
    return subprocess.check_output(args, text=True).strip()


def set_output(name: str, value: str) -> None:
    output_path = os.environ.get("GITHUB_OUTPUT")
    if output_path:
        with Path(output_path).open("a", encoding="utf-8") as handle:
            handle.write(f"{name}={value}\n")


def current_ref() -> str:
    return capture(["git", "rev-parse", "HEAD"])


def target_branch() -> str:
    return os.environ.get("GITHUB_REF_NAME") or capture(["git", "branch", "--show-current"]) or "main"


def has_staged_changes() -> bool:
    return subprocess.run(["git", "diff", "--staged", "--quiet"], check=False).returncode != 0


def snapshot_generated_paths(paths: list[str]) -> dict[str, bytes | None]:
    snapshot: dict[str, bytes | None] = {}
    for item in paths:
        path = Path(item)
        if path.is_file():
            snapshot[str(path)] = path.read_bytes()
            continue
        if path.is_dir():
            for child in sorted(path.rglob("*")):
                if child.is_file():
                    snapshot[str(child)] = child.read_bytes()
            continue
        snapshot[str(path)] = None
    return snapshot


def restore_generated_snapshot(paths: list[str], snapshot: dict[str, bytes | None]) -> None:
    for item in paths:
        path = Path(item)
        if path.exists():
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
    for name, payload in snapshot.items():
        path = Path(name)
        if payload is None:
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)


def recreate_generated_commit(branch: str, paths: list[str], snapshot: dict[str, bytes | None], message: str) -> bool:
    print(f"Reapplying generated snapshot onto origin/{branch} after rebase conflict.")
    run(["git", "reset", "--hard", f"origin/{branch}"])
    restore_generated_snapshot(paths, snapshot)
    run(["git", "add", *paths])
    if not has_staged_changes():
        print("origin already contains the generated changes after refresh.")
        return False
    run(["git", "commit", "-m", message])
    return True


def push_with_rebase(branch: str, attempts: int, paths: list[str], snapshot: dict[str, bytes | None], message: str) -> None:
    for attempt in range(1, attempts + 1):
        push = run(["git", "push", "origin", f"HEAD:{branch}"], check=False)
        if push.returncode == 0:
            return
        if attempt == attempts:
            raise SystemExit(f"git push failed after {attempts} attempts")
        print(f"Push failed on attempt {attempt}; rebasing onto origin/{branch} before retry.")
        run(["git", "fetch", "origin", branch])
        rebase = run(["git", "rebase", f"origin/{branch}"], check=False)
        if rebase.returncode != 0:
            run(["git", "rebase", "--abort"], check=False)
            if not recreate_generated_commit(branch, paths, snapshot, message):
                return
        time.sleep(2)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--message", required=True)
    parser.add_argument("--add", nargs="+", required=True)
    parser.add_argument("--attempts", type=int, default=3)
    parser.add_argument("--changed-output", default="changed")
    parser.add_argument("--ref-output")
    args = parser.parse_args()

    run(["git", "config", "--global", "user.name", "github-actions[bot]"])
    run(["git", "config", "--global", "user.email", "github-actions[bot]@users.noreply.github.com"])
    run(["git", "add", *args.add])

    if not has_staged_changes():
        print("No generated changes.")
        set_output(args.changed_output, "false")
        if args.ref_output:
            set_output(args.ref_output, current_ref())
        return 0

    snapshot = snapshot_generated_paths(args.add)
    run(["git", "commit", "-m", args.message])
    push_with_rebase(target_branch(), args.attempts, args.add, snapshot, args.message)
    set_output(args.changed_output, "true")
    if args.ref_output:
        set_output(args.ref_output, current_ref())
    return 0


if __name__ == "__main__":
    sys.exit(main())
