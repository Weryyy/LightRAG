"""
Reintenta la ingesta de documentos en estado FAILED/PENDING/PROCESSING.

Usa el endpoint nativo /documents/reprocess_failed (corre en background) y
monitoriza /documents/pipeline_status hasta que termina.

Uso:
    python retry_failed.py [--poll-interval 10] [--no-follow]
"""

import argparse
import sys
import time
from typing import Any

import requests

API_URL = "http://localhost:9621"


def get_status_counts() -> dict[str, int]:
    r = requests.get(f"{API_URL}/documents/status_counts", timeout=10)
    r.raise_for_status()
    return r.json()["status_counts"]


def get_pipeline_status() -> dict[str, Any]:
    r = requests.get(f"{API_URL}/documents/pipeline_status", timeout=10)
    r.raise_for_status()
    return r.json()


def trigger_reprocess() -> dict[str, Any]:
    r = requests.post(f"{API_URL}/documents/reprocess_failed", timeout=15)
    r.raise_for_status()
    return r.json()


def print_counts(counts: dict[str, int], header: str) -> None:
    print(f"\n{header}")
    total = counts.get("all", 0)
    for key in ("processed", "failed", "pending", "processing"):
        val = counts.get(key, 0)
        pct = (val / total * 100) if total else 0
        print(f"  {key:>12}: {val:>4} ({pct:5.1f}%)")
    print(f"  {'total':>12}: {total:>4}")


def follow_pipeline(poll_interval: float) -> None:
    last_message = ""
    started_at = time.time()
    while True:
        try:
            status = get_pipeline_status()
        except requests.RequestException as e:
            print(f"  [warn] no se pudo consultar pipeline_status: {e}")
            time.sleep(poll_interval)
            continue

        busy = status.get("busy", False)
        job = status.get("job_name") or "—"
        cur = status.get("cur_batch", 0)
        total = status.get("batchs", 0)
        docs = status.get("docs", 0)
        msg = status.get("latest_message", "") or ""
        elapsed = int(time.time() - started_at)

        progress = f"batch {cur}/{total}" if total else "—"
        if msg and msg != last_message:
            print(f"  [{elapsed:>4}s] {job} · {progress} · docs={docs} · {msg}")
            last_message = msg
        else:
            print(f"  [{elapsed:>4}s] {job} · {progress} · docs={docs}")

        if not busy and elapsed > 5:
            print("\n[done] pipeline ya no está ocupado.")
            return

        time.sleep(poll_interval)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reintentar documentos fallidos en LightRAG via endpoint nativo"
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=10.0,
        help="Segundos entre consultas a pipeline_status (default: 10)",
    )
    parser.add_argument(
        "--no-follow",
        action="store_true",
        help="Solo disparar el reprocess y salir (no esperar a que termine)",
    )
    args = parser.parse_args()

    try:
        before = get_status_counts()
    except requests.RequestException as e:
        print(f"[error] No se puede conectar a {API_URL}: {e}")
        print("¿Está corriendo el servidor? Lanza start_lightrag.bat primero.")
        return 1

    print_counts(before, "Estado inicial:")

    failed = before.get("failed", 0)
    pending = before.get("pending", 0)
    processing = before.get("processing", 0)
    if failed + pending + processing == 0:
        print("\nNo hay documentos que reprocesar. Nada que hacer.")
        return 0

    print(f"\nDisparando reprocess_failed ({failed} failed, {pending} pending, {processing} stuck)...")
    try:
        resp = trigger_reprocess()
    except requests.RequestException as e:
        print(f"[error] Fallo al disparar reprocess: {e}")
        return 1

    print(f"  status : {resp.get('status')}")
    print(f"  message: {resp.get('message')}")

    if args.no_follow:
        print("\n[--no-follow] No se monitoriza el progreso. Usa python monitor.py o:")
        print(f"  curl {API_URL}/documents/pipeline_status")
        return 0

    print(f"\nMonitorizando pipeline (poll cada {args.poll_interval}s, Ctrl+C para salir)...")
    try:
        follow_pipeline(args.poll_interval)
    except KeyboardInterrupt:
        print("\n[interrupt] El reprocesamiento sigue corriendo en background.")

    try:
        after = get_status_counts()
        print_counts(after, "Estado final:")
        recovered = after.get("processed", 0) - before.get("processed", 0)
        still_failed = after.get("failed", 0)
        print(f"\nDocumentos recuperados: {recovered}")
        print(f"Siguen en failed      : {still_failed}")
    except requests.RequestException as e:
        print(f"[warn] No se pudo obtener estado final: {e}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
