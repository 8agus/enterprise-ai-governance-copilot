"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import type { AuditRun, FindingCategory, FindingSeverity, RiskLevel } from "../lib/api";
import { ApiError, createAuditRun, getAuditRuns, runPendingAudit } from "../lib/api";

const HEATMAP_CATEGORIES: FindingCategory[] = ["security", "privacy", "responsible-ai"];
const HEATMAP_SEVERITIES: FindingSeverity[] = ["high", "medium", "low"];

type HeatmapMatrix = Record<FindingCategory, Record<FindingSeverity, number>>;

type TrendRun = {
  id: string;
  repoUrl: string;
  createdAt: string;
  score: number;
  riskLevel: RiskLevel;
  totalFindings: number;
};

const createEmptyHeatmap = (): HeatmapMatrix => ({
  security: { high: 0, medium: 0, low: 0 },
  privacy: { high: 0, medium: 0, low: 0 },
  "responsible-ai": { high: 0, medium: 0, low: 0 },
});

const getCategoryLabel = (category: FindingCategory): string => {
  if (category === "responsible-ai") {
    return "Responsible AI";
  }

  return category.charAt(0).toUpperCase() + category.slice(1);
};

const toRiskRank = (riskLevel: RiskLevel): number => {
  if (riskLevel === "high") {
    return 3;
  }

  if (riskLevel === "moderate") {
    return 2;
  }

  return 1;
};

export default function Home() {
  // State for form input
  const [repoUrl, setRepoUrl] = useState("");
  
  // State for audit runs list
  const [auditRuns, setAuditRuns] = useState<AuditRun[]>([]);
  
  // State for loading and error handling
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingRuns, setIsFetchingRuns] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track which audit run is currently being executed
  const [runningAuditId, setRunningAuditId] = useState<string | null>(null);
  
  // Track which audit runs have expanded findings
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());

  const dismissError = () => setError(null);

  // Fetch audit runs on page load
  useEffect(() => {
    fetchAuditRuns();
  }, []);

  // Function to fetch all audit runs from API
  const fetchAuditRuns = async () => {
    setIsFetchingRuns(true);
    try {
      const data = await getAuditRuns();
      setAuditRuns(data);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError) {
        const msg =
          e.status === 0
            ? "Network error. Please check your connection."
            : e.status >= 500
              ? "Server error. Please try again shortly."
              : e.status === 404
                ? "Service not found. Please check the API URL configuration."
                : e.message || "Request failed.";

        setError(msg);
      } else {
        setError("Unexpected error. Please try again.");
      }
    } finally {
      setIsFetchingRuns(false);
    }
  };

  // Function to start a new audit
  const handleStartAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!repoUrl.trim()) {
      setError("Please enter a repository URL");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await createAuditRun(repoUrl);
      setError(null);

      // Clear input and refresh list
      setRepoUrl("");
      await fetchAuditRuns();
    } catch (e) {
      if (e instanceof ApiError) {
        const msg =
          e.status === 0
            ? "Network error. Please check your connection."
            : e.status >= 500
              ? "Server error. Please try again shortly."
              : e.status === 404
                ? "Service not found. Please check the API URL configuration."
                : e.message || "Request failed.";

        setError(msg);
      } else {
        setError("Unexpected error. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Function to run an audit
  const handleRunNow = async (id: string) => {
    setRunningAuditId(id);
    setError(null);

    try {
      await runPendingAudit(id);
      setError(null);

      // Refresh the list to show updated status
      await fetchAuditRuns();
    } catch (e) {
      if (e instanceof ApiError) {
        const msg =
          e.status === 0
            ? "Network error. Please check your connection."
            : e.status >= 500
              ? "Server error. Please try again shortly."
              : e.status === 404
                ? "Service not found. Please check the API URL configuration."
                : e.message || "Request failed.";

        setError(msg);
      } else {
        setError("Unexpected error. Please try again.");
      }
    } finally {
      setRunningAuditId(null);
    }
  };

  // Get badge color based on status
  const getStatusColor = (status: AuditRun["status"]) => {
    switch (status) {
      case "pending":
        return "#ffa500"; // orange
      case "running":
        return "#0070f3"; // blue
      case "completed":
        return "#28a745"; // green
      default:
        return "#6c757d"; // gray
    }
  };

  // Get badge color based on severity
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "#dc3545"; // red
      case "medium":
        return "#ffc107"; // yellow
      case "low":
        return "#17a2b8"; // teal
      default:
        return "#6c757d"; // gray
    }
  };

  const getRiskLevelColor = (riskLevel: RiskLevel) => {
    switch (riskLevel) {
      case "high":
        return "#dc3545";
      case "moderate":
        return "#ffc107";
      case "low":
        return "#28a745";
      default:
        return "#6c757d";
    }
  };

  // Toggle findings visibility for a specific audit run
  const toggleFindings = (id: string) => {
    setExpandedFindings((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const buildHeatmap = (run: AuditRun): HeatmapMatrix | null => {
    if (run.status !== "completed" || !run.findings || run.findings.items.length === 0) {
      return null;
    }

    return run.findings.items.reduce<HeatmapMatrix>((matrix, finding) => {
      matrix[finding.category][finding.severity] += 1;
      return matrix;
    }, createEmptyHeatmap());
  };

  const completedTrendRuns: TrendRun[] = auditRuns
    .filter((run) => run.status === "completed" && Boolean(run.findings?.auditSummary))
    .map((run) => {
      const summary = run.findings?.auditSummary;

      if (!summary) {
        return null;
      }

      return {
        id: run.id,
        repoUrl: run.repoUrl,
        createdAt: run.createdAt,
        score: summary.score,
        riskLevel: summary.riskLevel,
        totalFindings: summary.totalFindings,
      };
    })
    .filter((run): run is TrendRun => run !== null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const trendRowsForDisplay = [...completedTrendRuns].reverse();
  const latestTrendRun = completedTrendRuns.at(-1) ?? null;
  const previousTrendRun = completedTrendRuns.at(-2) ?? null;

  const scoreDelta = latestTrendRun && previousTrendRun ? latestTrendRun.score - previousTrendRun.score : null;
  const findingsDelta =
    latestTrendRun && previousTrendRun ? latestTrendRun.totalFindings - previousTrendRun.totalFindings : null;

  const getRiskChangeSummary = (): string => {
    if (!latestTrendRun || !previousTrendRun) {
      return "Trend comparison requires at least 2 completed audit runs.";
    }

    if (latestTrendRun.riskLevel === previousTrendRun.riskLevel) {
      return `Risk unchanged at ${latestTrendRun.riskLevel}.`;
    }

    const latestRank = toRiskRank(latestTrendRun.riskLevel);
    const previousRank = toRiskRank(previousTrendRun.riskLevel);

    if (latestRank < previousRank) {
      return `Risk improved from ${previousTrendRun.riskLevel} to ${latestTrendRun.riskLevel}.`;
    }

    return `Risk worsened from ${previousTrendRun.riskLevel} to ${latestTrendRun.riskLevel}.`;
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Enterprise AI Governance Copilot</h1>

        {/* Start Audit Form */}
        <section style={{ marginBottom: "2rem", width: "100%", maxWidth: "600px" }}>
          <h2>Start New Audit</h2>
          <form onSubmit={handleStartAudit} style={{ display: "flex", gap: "1rem" }}>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="Enter GitHub repository URL"
              disabled={isLoading}
              style={{
                flex: 1,
                padding: "0.5rem",
                fontSize: "1rem",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
            <button
              type="submit"
              disabled={isLoading || isFetchingRuns || runningAuditId !== null}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "1rem",
                backgroundColor: "#0070f3",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isLoading || isFetchingRuns || runningAuditId !== null ? "not-allowed" : "pointer",
              }}
            >
              {isLoading ? "Starting..." : "Start Audit"}
            </button>
          </form>
        </section>

        <section style={{ width: "100%", maxWidth: "800px", marginBottom: "1rem" }}>
          <h2>Audit History &amp; Trends</h2>
          {trendRowsForDisplay.length === 0 ? (
            <p style={{ fontSize: "0.9rem", color: "#666" }}>No completed audit runs yet to display history.</p>
          ) : (
            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                padding: "0.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.35rem", borderBottom: "1px solid #e6e6e6" }}>Run / Repo</th>
                    <th style={{ textAlign: "left", padding: "0.35rem", borderBottom: "1px solid #e6e6e6" }}>Date</th>
                    <th style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #e6e6e6" }}>Score</th>
                    <th style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #e6e6e6" }}>Risk Level</th>
                    <th style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #e6e6e6" }}>Total Findings</th>
                  </tr>
                </thead>
                <tbody>
                  {trendRowsForDisplay.map((run) => (
                    <tr key={run.id}>
                      <td style={{ padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>
                        <div style={{ fontWeight: 600 }}>{run.repoUrl}</div>
                        <div style={{ color: "#777", fontSize: "0.74rem" }}>Run {run.id}</div>
                      </td>
                      <td style={{ padding: "0.35rem", borderBottom: "1px solid #f0f0f0", color: "#555" }}>
                        {formatDate(run.createdAt)}
                      </td>
                      <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0", fontWeight: 600 }}>
                        {run.score}
                      </td>
                      <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>
                        <span
                          style={{
                            backgroundColor: getRiskLevelColor(run.riskLevel),
                            color: "white",
                            borderRadius: "10px",
                            padding: "0.15rem 0.45rem",
                            fontSize: "0.73rem",
                            textTransform: "capitalize",
                          }}
                        >
                          {run.riskLevel}
                        </span>
                      </td>
                      <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0", fontWeight: 600 }}>
                        {run.totalFindings}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {latestTrendRun && previousTrendRun ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                    alignItems: "center",
                    fontSize: "0.82rem",
                    color: "#333",
                  }}
                >
                  <div>
                    <strong>Score Delta:</strong>{" "}
                    <span style={{ color: (scoreDelta ?? 0) >= 0 ? "#157347" : "#b02a37", fontWeight: 600 }}>
                      {scoreDelta !== null && scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta}
                    </span>
                  </div>
                  <div>
                    <strong>Findings Delta:</strong>{" "}
                    <span style={{ color: (findingsDelta ?? 0) <= 0 ? "#157347" : "#b02a37", fontWeight: 600 }}>
                      {findingsDelta !== null && findingsDelta >= 0 ? `+${findingsDelta}` : findingsDelta}
                    </span>
                  </div>
                  <div>
                    <strong>{getRiskChangeSummary()}</strong>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "0.82rem", color: "#666" }}>{getRiskChangeSummary()}</div>
              )}
            </div>
          )}
        </section>

        {/* Audit Runs List */}
        <section style={{ width: "100%", maxWidth: "800px" }}>
          {isFetchingRuns && (
            <div
              style={{
                background: "#e6f0ff",
                border: "1px solid #bfdbfe",
                color: "#1d4ed8",
                padding: "10px 12px",
                borderRadius: 8,
                marginBottom: 12,
              }}
            >
              Loading latest audit runs...
            </div>
          )}
          {error && (
            <div
              style={{
                background: "#fee2e2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                padding: "10px 12px",
                borderRadius: 8,
                marginBottom: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
              role="alert"
            >
              <div>{error}</div>
              <button
                type="button"
                onClick={dismissError}
                style={{
                  background: "transparent",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  padding: "6px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
                aria-label="Dismiss error"
              >
                Dismiss
              </button>
            </div>
          )}
          <h2>Recent Audit Runs</h2>
          {auditRuns.length === 0 ? (
            <p>No audit runs yet. Start your first audit above!</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {auditRuns.map((run) => (
                <div
                  key={run.id}
                  style={{
                    padding: "1rem",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    backgroundColor: "#f9f9f9",
                  }}
                >
                  {(() => {
                    const heatmap = buildHeatmap(run);
                    return heatmap ? (
                      <div
                        style={{
                          marginBottom: "0.75rem",
                          backgroundColor: "#fff",
                          border: "1px solid #e0e0e0",
                          borderRadius: "6px",
                          padding: "0.5rem",
                        }}
                      >
                        <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#333", marginBottom: "0.35rem" }}>
                          Governance Risk Heatmap
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: "left", padding: "0.3rem", borderBottom: "1px solid #e6e6e6" }}>
                                Category
                              </th>
                              <th style={{ textAlign: "center", padding: "0.3rem", borderBottom: "1px solid #e6e6e6" }}>
                                High
                              </th>
                              <th style={{ textAlign: "center", padding: "0.3rem", borderBottom: "1px solid #e6e6e6" }}>
                                Medium
                              </th>
                              <th style={{ textAlign: "center", padding: "0.3rem", borderBottom: "1px solid #e6e6e6" }}>
                                Low
                              </th>
                              <th style={{ textAlign: "center", padding: "0.3rem", borderBottom: "1px solid #e6e6e6" }}>
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {HEATMAP_CATEGORIES.map((category) => {
                              const rowTotal = HEATMAP_SEVERITIES.reduce(
                                (sum, severity) => sum + heatmap[category][severity],
                                0,
                              );

                              return (
                                <tr key={category}>
                                  <td style={{ padding: "0.3rem", borderBottom: "1px solid #f0f0f0" }}>
                                    {getCategoryLabel(category)}
                                  </td>
                                  <td style={{ textAlign: "center", padding: "0.3rem", borderBottom: "1px solid #f0f0f0" }}>
                                    {heatmap[category].high}
                                  </td>
                                  <td style={{ textAlign: "center", padding: "0.3rem", borderBottom: "1px solid #f0f0f0" }}>
                                    {heatmap[category].medium}
                                  </td>
                                  <td style={{ textAlign: "center", padding: "0.3rem", borderBottom: "1px solid #f0f0f0" }}>
                                    {heatmap[category].low}
                                  </td>
                                  <td
                                    style={{
                                      textAlign: "center",
                                      padding: "0.3rem",
                                      borderBottom: "1px solid #f0f0f0",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {rowTotal}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null;
                  })()}

                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <strong>{run.repoUrl}</strong>
                    <span
                      style={{
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        backgroundColor: getStatusColor(run.status),
                        color: "white",
                        fontSize: "0.875rem",
                      }}
                    >
                      {run.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#666", marginBottom: "0.5rem" }}>
                    <div>ID: {run.id}</div>
                    <div>Created: {formatDate(run.createdAt)}</div>
                  </div>
                  {run.status === "pending" && (
                    <button
                      onClick={() => handleRunNow(run.id)}
                      disabled={runningAuditId !== null || isLoading || isFetchingRuns}
                      style={{
                        padding: "0.5rem 1rem",
                        fontSize: "0.875rem",
                        backgroundColor: "#0070f3",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: runningAuditId !== null || isLoading || isFetchingRuns ? "not-allowed" : "pointer",
                        opacity: runningAuditId !== null || isLoading || isFetchingRuns ? 0.6 : 1,
                      }}
                    >
                      {runningAuditId === run.id ? "Running..." : "Run Now"}
                    </button>
                  )}

                  {/* Display Findings */}
                  {run.findings && (
                    <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #ddd" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        {expandedFindings.has(run.id) ? (
                          <div style={{ fontSize: "0.875rem", fontWeight: "bold" }}>Findings</div>
                        ) : (
                          <div style={{ fontSize: "0.875rem", fontWeight: "bold" }}>
                            Findings: {run.findings.summary.total}
                            {" ("}
                            High {run.findings.summary.high},
                            {" "}
                            Medium {run.findings.summary.medium},
                            {" "}
                            Low {run.findings.summary.low}
                            {")"}
                          </div>
                        )}
                        <button
                          onClick={() => toggleFindings(run.id)}
                          style={{
                            padding: "0.25rem 0.75rem",
                            fontSize: "0.75rem",
                            backgroundColor: "#6c757d",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          {expandedFindings.has(run.id) ? "Hide findings" : "Show findings"}
                        </button>
                      </div>
                      
                      {expandedFindings.has(run.id) && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          {(() => {
                            const securityFindings = run.findings.items.filter(
                              (finding) => finding.category === "security",
                            );
                            const privacyFindings = run.findings.items.filter(
                              (finding) => finding.category === "privacy",
                            );
                            const responsibleAiFindings = run.findings.items.filter(
                              (finding) => finding.category === "responsible-ai",
                            );

                            const sections = [
                              { heading: "Security Findings", items: securityFindings },
                              { heading: "Privacy Findings", items: privacyFindings },
                              { heading: "Responsible AI Findings", items: responsibleAiFindings },
                            ];

                            return sections
                              .filter((section) => section.items.length > 0)
                              .map((section) => (
                                <div key={section.heading} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                  <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: "#333" }}>{section.heading}</div>
                                  {section.items.map((finding) => (
                                    <div
                                      key={finding.id}
                                      style={{
                                        padding: "0.75rem",
                                        backgroundColor: "#fff",
                                        borderRadius: "4px",
                                        border: "1px solid #e0e0e0",
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: "0.5rem",
                                          alignItems: "center",
                                          marginBottom: "0.5rem",
                                        }}
                                      >
                                        <span
                                          style={{
                                            padding: "0.125rem 0.5rem",
                                            borderRadius: "4px",
                                            backgroundColor: getSeverityColor(finding.severity),
                                            color: "white",
                                            fontSize: "0.75rem",
                                            fontWeight: "bold",
                                            textTransform: "uppercase",
                                          }}
                                        >
                                          {finding.severity}
                                        </span>
                                        <strong style={{ fontSize: "0.875rem" }}>{finding.title}</strong>
                                      </div>
                                      <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: "0.25rem" }}>
                                        <strong>Evidence:</strong> {finding.evidence}
                                      </div>
                                      <div style={{ fontSize: "0.8rem", color: "#666" }}>
                                        <strong>Recommendation:</strong> {finding.recommendation}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ));
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
