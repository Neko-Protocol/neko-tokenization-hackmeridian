# Hosted MCP server (Streamable HTTP). Build from repo root (-f services/legal-kb/Dockerfile .)
# or from services/legal-kb (docker build .). See docs/deploy.md.
FROM python:3.12-slim
WORKDIR /app
COPY . /ctx
RUN if [ -d /ctx/services/legal-kb ]; then cp -r /ctx/services/legal-kb/src /ctx/services/legal-kb/corpus /ctx/services/legal-kb/laws /app/; else cp -r /ctx/src /ctx/corpus /ctx/laws /app/; fi && rm -rf /ctx
ENV PYTHONPATH=/app/src PYTHONUNBUFFERED=1 PORT=8080
EXPOSE 8080
USER nobody
CMD ["python3", "-m", "neko_legal_kb.http_server"]
