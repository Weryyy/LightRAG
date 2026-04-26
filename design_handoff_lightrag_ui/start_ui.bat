@echo off
cd /d %~dp0
echo Iniciando LightRAG UI en http://localhost:8765 ...
echo Asegurate de que LightRAG (start_lightrag.bat) este corriendo en el puerto 9621.
echo.
"D:\LightRAG\venv\Scripts\python.exe" serve_ui.py
