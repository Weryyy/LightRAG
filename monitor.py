#!/usr/bin/env python3
"""
LightRAG progress monitor with ETA.
Run: python D:/LightRAG/monitor.py
Updates every 10 seconds. Ctrl+C to stop.
"""

import json
import re
import time
from collections import deque
from datetime import datetime, timedelta
from pathlib import Path

STATUS_FILE = Path("D:/LightRAG/rag_storage/kv_store_doc_status.json")
LOG_FILE    = Path("D:/LightRAG/lightrag.log")

# Regex to extract completion timestamps from log
RE_COMPLETED = re.compile(
    r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+ - lightrag - INFO - Completed processing"
)
RE_FAILED = re.compile(
    r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+ - lightrag - ERROR - Failed to extract document"
)
RE_STARTED = re.compile(
    r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+ - lightrag - INFO - Processing d-id:"
)

BAR_WIDTH = 35
ROLLING_WINDOW = 10  # docs for rolling average


def parse_log_timings() -> list[float]:
    """Return list of seconds-per-doc using time between consecutive completions."""
    if not LOG_FILE.exists():
        return []

    lines = LOG_FILE.read_text(encoding="utf-8", errors="ignore").splitlines()
    completions: list[datetime] = []

    for line in lines:
        m = RE_COMPLETED.search(line)
        if m:
            completions.append(datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S"))

    if len(completions) < 2:
        return []

    timings = []
    for i in range(1, len(completions)):
        elapsed = (completions[i] - completions[i - 1]).total_seconds()
        if 5 < elapsed < 900:
            timings.append(elapsed)

    return timings


def read_status() -> dict:
    if not STATUS_FILE.exists():
        return {}
    return json.loads(STATUS_FILE.read_text(encoding="utf-8"))


def fmt_duration(seconds: float) -> str:
    if seconds < 0:
        return "--"
    s = int(seconds)
    if s < 60:
        return f"{s}s"
    m, s = divmod(s, 60)
    if m < 60:
        return f"{m}m {s:02d}s"
    h, m = divmod(m, 60)
    return f"{h}h {m:02d}m"


def progress_bar(done: int, total: int, width: int = BAR_WIDTH) -> str:
    if total == 0:
        return "[" + " " * width + "]"
    filled = int(width * done / total)
    pct = 100 * done / total
    bar = "█" * filled + "░" * (width - filled)
    return f"[{bar}] {pct:5.1f}%"


def clear_lines(n: int):
    for _ in range(n):
        print("\033[F\033[K", end="")


def main():
    print("LightRAG Monitor — Ctrl+C para salir\n")
    prev_lines = 0
    recent_times: deque = deque(maxlen=ROLLING_WINDOW)

    while True:
        try:
            docs = read_status()
            from collections import Counter
            counts = Counter(v.get("status", "?") for v in docs.values())

            total     = len(docs)
            processed = counts.get("processed", 0)
            pending   = counts.get("pending", 0)
            failed    = counts.get("failed", 0)
            processing = counts.get("processing", 0)
            done      = processed + failed

            # Update timings from log
            timings = parse_log_timings()
            if timings:
                for t in timings[-ROLLING_WINDOW:]:
                    recent_times.append(t)

            avg_sec = sum(recent_times) / len(recent_times) if recent_times else None
            remaining = pending + processing

            if avg_sec and remaining > 0:
                eta_sec = avg_sec * remaining
                eta_abs = datetime.now() + timedelta(seconds=eta_sec)
                eta_str = fmt_duration(eta_sec)
                eta_clock = eta_abs.strftime("%H:%M")
            else:
                eta_str = "calculando..."
                eta_clock = "--:--"

            # Build display
            now = datetime.now().strftime("%H:%M:%S")
            lines = [
                f"  {'─'*50}",
                f"  📊 LightRAG — {now}",
                f"  {'─'*50}",
                f"  {progress_bar(done, total)}  {done}/{total} docs",
                f"",
                f"  ✅ Procesados : {processed:>4}",
                f"  ⏳ Pendientes : {pending:>4}",
                f"  🔄 En curso   : {processing:>4}",
                f"  ❌ Fallidos   : {failed:>4}",
                f"",
            ]

            if avg_sec:
                lines += [
                    f"  ⚡ Vel. media : {fmt_duration(avg_sec)}/doc  (últimos {len(recent_times)})",
                    f"  🕐 ETA        : {eta_str}  (termina ~{eta_clock})",
                ]
            else:
                lines += [
                    f"  ⚡ Vel. media : midiendo...",
                    f"  🕐 ETA        : esperando datos...",
                ]

            lines += [f"  {'─'*50}"]

            # Clear previous output and print new
            if prev_lines:
                clear_lines(prev_lines)

            for line in lines:
                print(line)
            prev_lines = len(lines)

            if pending == 0 and processing == 0:
                print(f"\n  ✨ Completado! {processed} docs indexados, {failed} fallidos.\n")
                break

            time.sleep(10)

        except KeyboardInterrupt:
            print("\n  Monitor detenido.")
            break
        except Exception as e:
            print(f"\r  [error: {e}]", end="", flush=True)
            time.sleep(5)


if __name__ == "__main__":
    main()
