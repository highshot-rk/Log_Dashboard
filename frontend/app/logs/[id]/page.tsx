"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type LogForm = {
  timestamp: string;
  severity: string;
  source: string;
  message: string;
};

export default function LogDetailPage() {
  const params = useParams<{ id: string }>();
  const logId = params?.id ?? "";
  const [log, setLog] = useState<LogForm | null>(null);
  const [form, setForm] = useState<LogForm | null>(null);
  const [error, setError] = useState("");

  function normalizeDatetimeLocal(value: string): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
  }

  function parseApiError(payload: unknown): string {
    if (typeof payload === "object" && payload !== null && "detail" in payload) {
      const detail = (payload as { detail: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0] as { msg?: string };
        if (first?.msg) return first.msg;
      }
    }
    return "Request failed";
  }

  async function fetchLog() {
    if (!logId) return;
    const response = await fetch(`${API_BASE_URL}/api/v1/logs/${logId}`);
    if (!response.ok) {
      setError("Log not found");
      return;
    }
    const data: LogForm = await response.json();
    setLog(data);
    setForm({
      timestamp: data.timestamp,
      severity: data.severity,
      source: data.source,
      message: data.message,
    });
  }

  useEffect(() => {
    if (!logId) return;
    fetchLog();
  }, [logId]);

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!form?.timestamp || !form.source.trim() || !form.message.trim()) {
      setError("Timestamp, source, and message are required.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/v1/logs/${logId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(parseApiError(data));
      return;
    }
    fetchLog();
  }

  async function handleDelete() {
    if (!window.confirm("Delete this log?")) return;
    const response = await fetch(`${API_BASE_URL}/api/v1/logs/${logId}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Delete failed");
      return;
    }
    window.location.href = "/logs";
  }

  if (error && !log) {
    return (
      <main>
        <h1>Log Detail</h1>
        <p style={{ color: "red" }}>{error}</p>
        <p>
          <a href="/logs">Back to logs</a>
        </p>
      </main>
    );
  }

  if (!form) {
    return (
      <main>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Log #{logId}</h1>
      <p>
        <a href="/logs">Back to logs</a>
      </p>
      <form onSubmit={handleUpdate} style={{ display: "grid", gap: 8, maxWidth: 600 }}>
        <label>
          Timestamp
          <input
            type="datetime-local"
            value={new Date(form.timestamp).toISOString().slice(0, 16)}
            onChange={(event) =>
              setForm((prev) => (prev ? { ...prev, timestamp: normalizeDatetimeLocal(event.target.value) } : prev))
            }
            required
          />
        </label>
        <label>
          Severity
          <select
            value={form.severity}
            onChange={(event) => setForm((prev) => (prev ? { ...prev, severity: event.target.value } : prev))}
          >
            <option>DEBUG</option>
            <option>INFO</option>
            <option>WARN</option>
            <option>ERROR</option>
            <option>CRITICAL</option>
          </select>
        </label>
        <label>
          Source
          <input
            value={form.source}
            onChange={(event) => setForm((prev) => (prev ? { ...prev, source: event.target.value } : prev))}
            required
          />
        </label>
        <label>
          Message
          <textarea
            rows={4}
            value={form.message}
            onChange={(event) => setForm((prev) => (prev ? { ...prev, message: event.target.value } : prev))}
            required
          />
        </label>
        {error ? <p style={{ color: "red" }}>{error}</p> : null}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit">Save</button>
          <button type="button" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </form>
    </main>
  );
}
