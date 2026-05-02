"use client";

import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type AggregateSeriesItem = {
  bucket: string;
  count: number;
};

type Totals = {
  all: number;
  by_severity: Record<string, number>;
};

type LogItem = {
  id: number;
  timestamp: string;
  severity: string;
  source: string;
  message: string;
};

type DashboardData = {
  series: AggregateSeriesItem[];
  totals: Totals;
  recent: LogItem[];
};

type FilterState = {
  severity: string;
  source: string;
  dateRange: "all" | "24h" | "7d" | "30d";
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    series: [],
    totals: { all: 0, by_severity: {} },
    recent: [],
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    severity: "",
    source: "",
    dateRange: "all",
  });

  async function fetchDashboard(nextFilters: FilterState = filters) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    params.set("group_by", "day");
    if (nextFilters.severity) params.set("severity", nextFilters.severity);
    if (nextFilters.source) params.set("source", nextFilters.source);

    const now = new Date();
    if (nextFilters.dateRange !== "all") {
      const fromDate = new Date(now);
      if (nextFilters.dateRange === "24h") {
        fromDate.setHours(now.getHours() - 24);
      } else if (nextFilters.dateRange === "7d") {
        fromDate.setDate(now.getDate() - 7);
      } else if (nextFilters.dateRange === "30d") {
        fromDate.setDate(now.getDate() - 30);
      }
      params.set("from", fromDate.toISOString());
      params.set("to", now.toISOString());
    }

    const listParams = new URLSearchParams();
    listParams.set("page", "1");
    listParams.set("size", "8");
    listParams.set("sort_by", "timestamp");
    listParams.set("sort_order", "desc");
    if (nextFilters.severity) listParams.set("severity", nextFilters.severity);
    if (nextFilters.source) listParams.set("source", nextFilters.source);
    if (nextFilters.dateRange !== "all") {
      const fromDate = new Date(now);
      if (nextFilters.dateRange === "24h") {
        fromDate.setHours(now.getHours() - 24);
      } else if (nextFilters.dateRange === "7d") {
        fromDate.setDate(now.getDate() - 7);
      } else if (nextFilters.dateRange === "30d") {
        fromDate.setDate(now.getDate() - 30);
      }
      listParams.set("from", fromDate.toISOString());
      listParams.set("to", now.toISOString());
    }

    const [aggregateResponse, recentResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/v1/logs/query/aggregate?${params.toString()}`),
      fetch(`${API_BASE_URL}/api/v1/logs/query/raw?${listParams.toString()}`),
    ]);

    if (!aggregateResponse.ok || !recentResponse.ok) {
      setError("Failed to load dashboard data");
      setLoading(false);
      return;
    }

    const aggregate: { series?: AggregateSeriesItem[]; totals?: Totals } = await aggregateResponse.json();
    const recent: { items?: LogItem[] } = await recentResponse.json();
    setData({
      series: aggregate.series || [],
      totals: aggregate.totals || { all: 0, by_severity: {} },
      recent: recent.items || [],
    });
    setLoading(false);
  }

  useEffect(() => {
    fetchDashboard();
  }, []);

  function onApplyFilters() {
    fetchDashboard(filters);
  }

  const trendMax = Math.max(...data.series.map((row) => row.count || 0), 1);
  const latestTrendCount = data.series.length > 0 ? data.series[data.series.length - 1].count : 0;
  const errorCount = data.totals.by_severity?.ERROR || 0;
  const criticalCount = data.totals.by_severity?.CRITICAL || 0;

  return (
    <main className="dashboard-home">
      <h1>Dashboard</h1>
      <p>
        <a href="/logs">Logs</a> | <a href="/logs/new">Create Log</a>
      </p>

      <section className="panel">
        <h2>Filters</h2>
        <div className="filters-grid">
          <label>
            Severity
            <select
              value={filters.severity}
              onChange={(event) => setFilters((prev) => ({ ...prev, severity: event.target.value }))}
            >
              <option value="">All</option>
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </label>
          <label>
            Source
            <select
              value={filters.source}
              onChange={(event) => setFilters((prev) => ({ ...prev, source: event.target.value }))}
            >
              <option value="">All</option>
              <option value="api">api</option>
              <option value="web">web</option>
              <option value="worker">worker</option>
              <option value="system">system</option>
            </select>
          </label>
          <label>
            Date Range
            <select
              value={filters.dateRange}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, dateRange: event.target.value as FilterState["dateRange"] }))
              }
            >
              <option value="all">All time</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </label>
        </div>
        <div style={{ marginTop: 10 }}>
          <button type="button" onClick={onApplyFilters}>
            Apply Filters
          </button>
        </div>
      </section>

      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p>Loading dashboard...</p> : null}

      {!loading ? (
        <>
          <section className="kpi-grid">
            <article className="kpi-card">
              <p className="kpi-label">Total Logs</p>
              <p className="kpi-value">{data.totals.all}</p>
            </article>
            <article className="kpi-card">
              <p className="kpi-label">Errors</p>
              <p className="kpi-value danger">{errorCount}</p>
            </article>
            <article className="kpi-card">
              <p className="kpi-label">Critical</p>
              <p className="kpi-value danger">{criticalCount}</p>
            </article>
            <article className="kpi-card">
              <p className="kpi-label">Latest Trend Bucket</p>
              <p className="kpi-value">{latestTrendCount}</p>
            </article>
          </section>

          <section className="panel-grid">
            <article className="panel">
              <h3>Trend Chart</h3>
              <div className="trend-chart">
                {data.series.length === 0 ? (
                  <p className="muted">No trend points available.</p>
                ) : (
                  data.series.map((item) => {
                    const heightPercent = (item.count / trendMax) * 100;
                    return (
                      <div key={item.bucket} className="trend-point">
                        <div className="trend-bar" style={{ height: `${Math.max(heightPercent, 6)}%` }} />
                        <small>{new Date(item.bucket).toLocaleDateString()}</small>
                      </div>
                    );
                  })
                )}
              </div>
            </article>

            <article className="panel">
              <h3>Severity Histogram</h3>
              <div className="severity-chart">
                {Object.entries(data.totals.by_severity).length === 0 ? (
                  <p className="muted">No severity data available.</p>
                ) : (
                  Object.entries(data.totals.by_severity).map(([severity, count]) => {
                    const values = Object.values(data.totals.by_severity);
                    const maxCount = Math.max(...values, 1);
                    const widthPercent = (count / maxCount) * 100;
                    return (
                      <div key={severity} className="severity-row">
                        <div className="severity-label">{severity}</div>
                        <div className="severity-bar-wrap">
                          <div className="severity-bar" style={{ width: `${Math.max(widthPercent, 8)}%` }} />
                        </div>
                        <div className="severity-count">{count}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </article>
          </section>

          <section className="panel">
            <h3>Recent Logs</h3>
            {data.recent.length === 0 ? (
              <p className="muted">No logs found for selected filters.</p>
            ) : (
              <table>
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
                  {data.recent.map((log) => (
                    <tr key={log.id}>
                      <td>{log.id}</td>
                      <td>{new Date(log.timestamp).toLocaleString()}</td>
                      <td>{log.severity}</td>
                      <td>{log.source}</td>
                      <td>{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
