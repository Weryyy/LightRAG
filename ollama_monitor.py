import requests
import time
import os
import subprocess
from datetime import datetime

OLLAMA_URL = "http://localhost:11434"
REFRESH = 2

def clear():
    os.system("cls" if os.name == "nt" else "clear")

def get_ps():
    try:
        r = requests.get(f"{OLLAMA_URL}/api/ps", timeout=3)
        return r.json().get("models", [])
    except:
        return None

def get_gpu():
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=3
        )
        if result.returncode == 0:
            parts = [p.strip() for p in result.stdout.strip().split(",")]
            return {
                "name": parts[0],
                "gpu_util": parts[1],
                "mem_util": parts[2],
                "mem_used": parts[3],
                "mem_total": parts[4],
                "temp": parts[5],
            }
    except:
        pass
    return None

def bar(pct, width=20):
    try:
        filled = int(float(pct) / 100 * width)
        return f"[{'█' * filled}{'░' * (width - filled)}] {pct}%"
    except:
        return f"[{'░' * width}] ?%"

def format_size(mb):
    try:
        mb = int(mb)
        return f"{mb/1024:.1f} GB" if mb > 1024 else f"{mb} MB"
    except:
        return mb

print("Iniciando monitor... (Ctrl+C para salir)")
time.sleep(1)

while True:
    try:
        clear()
        now = datetime.now().strftime("%H:%M:%S")
        print(f"╔══════════════════════════════════════════════╗")
        print(f"║         OLLAMA MONITOR  [{now}]         ║")
        print(f"╚══════════════════════════════════════════════╝")

        # GPU
        gpu = get_gpu()
        if gpu:
            print(f"\n  GPU: {gpu['name']}  🌡  {gpu['temp']}°C")
            print(f"  Cómputo : {bar(gpu['gpu_util'])}")
            print(f"  VRAM    : {bar(gpu['mem_util'])}  ({format_size(gpu['mem_used'])} / {format_size(gpu['mem_total'])})")
        else:
            print("\n  GPU: no detectada (nvidia-smi no disponible)")

        # Modelos activos
        models = get_ps()
        print(f"\n  ┌─────────────────────────────────────────┐")
        if models is None:
            print(f"  │  ⚠  Ollama no responde en {OLLAMA_URL}")
        elif not models:
            print(f"  │  💤 Sin modelos activos (idle)")
        else:
            for m in models:
                name = m.get("name", "?")
                size = m.get("size", 0)
                cpu = m.get("size_vram", 0)
                expires = m.get("expires_at", "")[:19].replace("T", " ")
                proc = m.get("details", {})
                print(f"  │  ✅ {name}")
                print(f"  │     Tamaño : {size / 1e9:.2f} GB")
                print(f"  │     VRAM   : {cpu / 1e9:.2f} GB")
                print(f"  │     Expira : {expires}")
        print(f"  └─────────────────────────────────────────┘")

        print(f"\n  Actualizando cada {REFRESH}s  —  Ctrl+C para salir\n")
        time.sleep(REFRESH)

    except KeyboardInterrupt:
        print("\nMonitor detenido.")
        break
    except Exception as e:
        print(f"Error: {e}")
        time.sleep(REFRESH)
