@echo off
cd /d D:\LightRAG

set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

echo Comprobando Ollama en http://localhost:11434 ...
:wait_ollama
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo Ollama no disponible, reintentando en 3 segundos...
    timeout /t 3 /nobreak >nul
    goto wait_ollama
)
echo Ollama listo.

echo Iniciando UI en http://localhost:8765 ...
start "LightRAG UI" cmd /c "venv\Scripts\python.exe design_handoff_lightrag_ui\serve_ui.py"

echo Iniciando LightRAG en http://localhost:9621 ...
echo.
venv\Scripts\lightrag-server.exe --port 9621 --working-dir D:\LightRAG\rag_storage ^
  --timeout 600 ^
  --max-async 1 ^
  --summary-max-tokens 600 ^
  --ollama-llm-num_ctx 8192 ^
  --ollama-llm-num_gpu 99 ^
  --ollama-embedding-num_ctx 4096 ^
  --ollama-embedding-num_gpu 99
