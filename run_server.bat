@echo off
cd /d D:\LightRAG
venv\Scripts\lightrag-server.exe --port 9621 --working-dir D:\LightRAG\rag_storage --timeout 600 --max-async 1 --ollama-llm-num_ctx 4096 --ollama-llm-num_gpu 99 --ollama-embedding-num_ctx 4096 --ollama-embedding-num_gpu 99
