# Logs Dashboard


## Tech Stack

- **Backend**: FastAPI, Pydantic, Psycopg, Alembic
- **Database**: PostgreSQL
- **Frontend**: Next.js (App Router), TypeScript
- **Infra**: Docker Compose
- **Tests**: Pytest (unit + integration)

## Implemented Features

### Backend

- CRUD APIs for logs
- Raw query API with filtering, sorting, pagination
- Aggregation API for dashboard metrics and trend
- CSV export API
- Health endpoints
- CORS for frontend origin
- Alembic migration on container startup

### Frontend

- **Dashboard (main page `/`)**
  - KPI cards (total, errors, critical, latest trend bucket)
  - Trend chart over time
  - Severity histogram
  - Filter panel (date range, severity, source)
  - Recent logs table
- **Logs page (`/logs`)**
  - Search, filter, sort, pagination
  - Row click to open detail page
  - CSV export action
- **Log detail page (`/logs/[id]`)**
  - View and edit log
  - Delete log
- **Log creation page (`/logs/new`)**
  - Create validated log entry

## API Endpoints

Base path: `/api/v1`

- `POST /logs`
- `GET /logs`
- `GET /logs/{id}`
- `PUT /logs/{id}`
- `DELETE /logs/{id}`
- `GET /logs/query/raw`
- `GET /logs/query/aggregate`
- `GET /logs/export/csv`

## Data Model

Table: `logs`

- `id` BIGSERIAL primary key
- `timestamp` timestamptz
- `severity` varchar(16)
- `source` varchar(128)
- `message` text
- `created_at` timestamptz
- `updated_at` timestamptz

Indexes:

- `idx_logs_timestamp (timestamp)`
- `idx_logs_severity_timestamp (severity, timestamp)`
- `idx_logs_source_timestamp (source, timestamp)`

## Technical Decisions

- **FastAPI + Pydantic** for fast API development and strict request validation.
- **Raw SQL with Psycopg** for transparent filtering/aggregation query control.
- **Alembic migrations** to manage schema evolution safely instead of runtime table creation.
- **Docker Compose** for reproducible local setup with one command.
- **TypeScript frontend** for stronger component/state typing and safer refactoring.
- **Server-backed filtering/sorting/pagination** to keep frontend simple and scale with data size.

## Setup and Run

### Prerequisites

- Docker
- Docker Compose (`docker-compose`)

### Start

```bash
docker-compose up --build
```

### Services

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:8000](http://localhost:8000)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- DB host port: `5433` (mapped to container `5432`)

### Stop

```bash
docker-compose down
```

## Test Process

### Backend tests

```bash
cd backend
source .venv/bin/activate
pytest -q
```

### Quick API checks

```bash
curl http://localhost:8000/health
curl "http://localhost:8000/api/v1/logs/query/raw?page=1&size=10"
curl "http://localhost:8000/api/v1/logs/query/aggregate?group_by=day"
curl -OJ "http://localhost:8000/api/v1/logs/export/csv"
```

## Migration Process

- Alembic config: `backend/alembic.ini`
- Migration files: `backend/alembic/versions`
- Docker API container startup runs:
  - `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000`

For local manual migration:

```bash
cd backend
alembic upgrade head
```

## Requirement Coverage 

- [x] CRUD backend for logs
- [x] Raw and aggregated query endpoints
- [x] List/detail/create frontend pages
- [x] Dashboard with filter panel and trend chart
- [x] Docker Compose execution
- [x] Validation and error handling baseline
- [x] README with run/test process and technical decisions
- [x] Bonus: CSV export
- [x] Bonus: Severity histogram
- [x] Bonus: Unit/integration tests

## Results
<img width="950" height="770" alt="image" src="https://github.com/user-attachments/assets/b9ad35db-ace7-444b-b38d-b51ff84e3519" />
<img width="933" height="410" alt="image" src="https://github.com/user-attachments/assets/2492cfc5-468f-4f7e-97c7-5ad1acafa490" />

