"use client";

import { useState } from "react";
import type { FormEvent } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type NewLogForm = {
  timestamp: string;
  severity: string;
  source: string;
  message: string;
};

type CreatedLogResponse = {
  id: number;
};

export default function NewLogPage() {
  const [form, setForm] = useState<NewLogForm>({
    timestamp: new Date().toISOString(),
    severity: "INFO",
    source: "web",
    message: "",
  });
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
    return "Failed to create log";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!form.timestamp || !form.source.trim() || !form.message.trim()) {
      setError("Timestamp, source, and message are required.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/v1/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(parseApiError(data));
      return;
    }
    const data: CreatedLogResponse = await response.json();
    window.location.href = `/logs/${data.id}`;
  }

  return (
    <main>
      <h1>Create Log</h1>
      <p>
        <a href="/logs">Back to logs</a>
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8, maxWidth: 600 }}>
        <label>
          Timestamp
          <input
            type="datetime-local"
            value={form.timestamp.slice(0, 16)}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, timestamp: normalizeDatetimeLocal(event.target.value) }))
            }
            required
          />
        </label>
        <label>
          Severity
          <select
            value={form.severity}
            onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value }))}
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
            onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))}
            required
          />
        </label>
        <label>
          Message
          <textarea
            rows={4}
            value={form.message}
            onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
            required
          />
        </label>
        {error ? <p style={{ color: "red" }}>{error}</p> : null}
        <button type="submit">Create</button>
      </form>
    </main>
  );
}
