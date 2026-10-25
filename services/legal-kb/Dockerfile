# Hosted MCP server (Streamable HTTP). See docs/deploy.md.
FROM python:3.12-slim
WORKDIR /app
COPY src/ src/
COPY corpus/ corpus/
COPY laws/ laws/
ENV PYTHONPATH=/app/src PYTHONUNBUFFERED=1 PORT=8080
EXPOSE 8080
USER nobody
CMD ["python3", "-m", "neko_legal_kb.http_server"]
