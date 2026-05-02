"use client";

import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type LogItem = {
  id: number;
  timestamp: string;
  severity: string;
  source: string;
  message: string;
};

type LogsResponse = {
  items: LogItem[];
  page: number;
  size: number;
  total: number;
};

type QueryState = {
  severity: string;
  source: string;
  search: string;
  page: number;
  size: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, size: 10, total: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<QueryState>({
    severity: "",
    source: "",
    search: "",
    page: 1,
    size: 10,
    sortBy: "timestamp",
    sortOrder: "desc",
  });

  async function fetchLogs(nextQuery: QueryState = query) {
    setLoading(true);
    const params = new URLSearchParams();
    if (nextQuery.severity) params.set("severity", nextQuery.severity);
    if (nextQuery.source) params.set("source", nextQuery.source);
    if (nextQuery.search) params.set("search", nextQuery.search);
    params.set("page", String(nextQuery.page));
    params.set("size", String(nextQuery.size));
    params.set("sort_by", nextQuery.sortBy);
    params.set("sort_order", nextQuery.sortOrder);

    const response = await fetch(`${API_BASE_URL}/api/v1/logs/query/raw?${params.toString()}`);
    const data: LogsResponse = await response.json();
    setLogs(data.items || []);
    setMeta({
      page: data.page || nextQuery.page,
      size: data.size || nextQuery.size,
      total: data.total || 0,
    });
    setLoading(false);
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (query.severity) params.set("severity", query.severity);
    if (query.source) params.set("source", query.source);
    if (query.search) params.set("search", query.search);
    window.open(`${API_BASE_URL}/api/v1/logs/export/csv?${params.toString()}`, "_blank");
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  function applyFilters() {
    const nextQuery = { ...query, page: 1 };
    setQuery(nextQuery);
    fetchLogs(nextQuery);
  }

  function clearFilters() {
    const nextQuery: QueryState = {
      severity: "",
      source: "",
      search: "",
      page: 1,
      size: query.size,
      sortBy: "timestamp",
      sortOrder: "desc",
    };
    setQuery(nextQuery);
    fetchLogs(nextQuery);
  }

  function changePage(nextPage: number) {
    if (nextPage < 1) return;
    const maxPage = Math.max(1, Math.ceil(meta.total / meta.size));
    if (nextPage > maxPage) return;
    const nextQuery = { ...query, page: nextPage };
    setQuery(nextQuery);
    fetchLogs(nextQuery);
  }

  const maxPage = Math.max(1, Math.ceil(meta.total / meta.size));

  function openLogDetail(logId: number) {
    window.location.href = `/logs/${logId}`;
  }

  return (
    <main>
      <h1>Logs</h1>
      <p>
        <a href="/logs/new">Create Log</a> | <a href="/dashboard">Dashboard</a>
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <select
          value={query.sortBy}
          onChange={(event) => setQuery((prev) => ({ ...prev, sortBy: event.target.value, page: 1 }))}
        >
          <option value="timestamp">Sort by Timestamp</option>
          <option value="severity">Sort by Severity</option>
          <option value="source">Sort by Source</option>
          <option value="created_at">Sort by Created At</option>
        </select>
        <select
          value={query.sortOrder}
          onChange={(event) =>
            setQuery((prev) => ({ ...prev, sortOrder: event.target.value as "asc" | "desc", page: 1 }))
          }
        >
          <option value="desc">Order: Descending</option>
          <option value="asc">Order: Ascending</option>
        </select>
        <select
          value={query.size}
          onChange={(event) => {
            const nextQuery = { ...query, size: Number(event.target.value), page: 1 };
            setQuery(nextQuery);
            fetchLogs(nextQuery);
          }}
        >
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={applyFilters}>
          Apply Filters
        </button>
        <button type="button" onClick={clearFilters}>
          Clear
        </button>
        <button type="button" onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      {loading ? <p>Loading...</p> : null}
      {!loading && logs.length === 0 ? <p>No logs found.</p> : null}
      {!loading ? (
        <p className="muted">
          Showing page {meta.page} of {maxPage} ({meta.total} logs)
        </p>
      ) : null}
      {logs.length > 0 ? (
        <table border={1} cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Timestamp</th>
              <th>Severity</th>
              <th>Source</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} onClick={() => openLogDetail(log.id)} style={{ cursor: "pointer" }}>
                <td>{log.id}</td>
                <td>{new Date(log.timestamp).toLocaleString()}</td>
                <td>{log.severity}</td>
                <td>{log.source}</td>
                <td>{log.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" onClick={() => changePage(meta.page - 1)} disabled={meta.page <= 1}>
          Previous
        </button>
        <button type="button" onClick={() => changePage(meta.page + 1)} disabled={meta.page >= maxPage}>
          Next
        </button>
      </div>
    </main>
  );
}
