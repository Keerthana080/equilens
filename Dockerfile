# Multi-stage build:
# 1) Build React web frontend
# 2) Run FastAPI backend and serve the static web

FROM node:20-alpine AS web-build

WORKDIR /work/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build


FROM python:3.12-slim AS app

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./backend/app
COPY --from=web-build /work/frontend/dist ./backend/static

ENV PORT=8080
EXPOSE 8080

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8080"]

