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

type ComparableRun = AuditRun & {
  findings: NonNullable<AuditRun["findings"]> & {
    auditSummary: NonNullable<NonNullable<AuditRun["findings"]>["auditSummary"]>;
  };
};

type ReportFinding = NonNullable<AuditRun["findings"]>["items"][number];

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
  const [baselineRunId, setBaselineRunId] = useState<string>("");
  const [comparisonRunId, setComparisonRunId] = useState<string>("");

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

  const comparableRuns: ComparableRun[] = auditRuns
    .filter(
      (run): run is ComparableRun =>
        run.status === "completed" &&
        run.findings !== null &&
        run.findings.auditSummary !== undefined,
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  useEffect(() => {
    if (comparableRuns.length < 2) {
      setBaselineRunId("");
      setComparisonRunId("");
      return;
    }

    const latest = comparableRuns[0];
    const previous = comparableRuns[1];

    if (!latest || !previous) {
      return;
    }

    const baselineExists = comparableRuns.some((run) => run.id === baselineRunId);
    const comparisonExists = comparableRuns.some((run) => run.id === comparisonRunId);

    if (!baselineExists || !comparisonExists || baselineRunId === comparisonRunId) {
      setBaselineRunId(previous.id);
      setComparisonRunId(latest.id);
    }
  }, [comparableRuns, baselineRunId, comparisonRunId]);

  const baselineRun = comparableRuns.find((run) => run.id === baselineRunId) ?? null;
  const comparisonRun = comparableRuns.find((run) => run.id === comparisonRunId) ?? null;

  const getCategoryCounts = (run: ComparableRun): Record<FindingCategory, number> => {
    return run.findings.items.reduce<Record<FindingCategory, number>>(
      (counts, finding) => {
        counts[finding.category] += 1;
        return counts;
      },
      { security: 0, privacy: 0, "responsible-ai": 0 },
    );
  };

  const formatSignedDelta = (value: number): string => (value > 0 ? `+${value}` : String(value));

  const getComparisonRiskText = (baseline: ComparableRun, comparison: ComparableRun): string => {
    const baselineRisk = baseline.findings.auditSummary.riskLevel;
    const comparisonRisk = comparison.findings.auditSummary.riskLevel;

    if (baselineRisk === comparisonRisk) {
      return `Risk unchanged at ${comparisonRisk}.`;
    }

    const baselineRank = toRiskRank(baselineRisk);
    const comparisonRank = toRiskRank(comparisonRisk);

    if (comparisonRank < baselineRank) {
      return `Risk improved from ${baselineRisk} to ${comparisonRisk}.`;
    }

    return `Risk worsened from ${baselineRisk} to ${comparisonRisk}.`;
  };

  const buildReportText = (run: ComparableRun): string => {
    const findings = run.findings;
    const summary = findings.summary;
    const auditSummary = findings.auditSummary;

    const groupedFindings = findings.items.reduce<Record<FindingCategory, ReportFinding[]>>(
      (groups, finding) => {
        groups[finding.category].push(finding);
        return groups;
      },
      { security: [], privacy: [], "responsible-ai": [] },
    );

    const heatmap = findings.items.reduce<HeatmapMatrix>((matrix, finding) => {
      matrix[finding.category][finding.severity] += 1;
      return matrix;
    }, createEmptyHeatmap());

    const lines: string[] = [
      "Enterprise AI Governance Copilot - Audit Report",
      `Generated: ${new Date().toLocaleString()}`,
      `Run ID: ${run.id}`,
      `Repository: ${run.repoUrl}`,
      `Audit Date: ${formatDate(run.createdAt)}`,
      "",
      "Executive Summary",
      `- Score: ${auditSummary.score}`,
      `- Risk Level: ${auditSummary.riskLevel}`,
      `- Total Findings: ${auditSummary.totalFindings}`,
      `- High: ${auditSummary.highCount}`,
      `- Medium: ${auditSummary.mediumCount}`,
      `- Low: ${auditSummary.lowCount}`,
      "",
      "Findings Summary",
      `- Total: ${summary.total}`,
      `- High: ${summary.high}`,
      `- Medium: ${summary.medium}`,
      `- Low: ${summary.low}`,
      "",
      "Governance Heatmap Summary",
      `- Security: High ${heatmap.security.high}, Medium ${heatmap.security.medium}, Low ${heatmap.security.low}`,
      `- Privacy: High ${heatmap.privacy.high}, Medium ${heatmap.privacy.medium}, Low ${heatmap.privacy.low}`,
      `- Responsible AI: High ${heatmap["responsible-ai"].high}, Medium ${heatmap["responsible-ai"].medium}, Low ${heatmap["responsible-ai"].low}`,
      "",
    ];

    HEATMAP_CATEGORIES.forEach((category) => {
      const sectionFindings = groupedFindings[category];
      lines.push(`${getCategoryLabel(category)} Findings`);

      if (sectionFindings.length === 0) {
        lines.push("No findings.");
        lines.push("");
        return;
      }

      sectionFindings.forEach((finding, index) => {
        lines.push(`${index + 1}. [${finding.severity}] ${finding.title}`);
        lines.push(`   Evidence: ${finding.evidence}`);
        lines.push(`   Recommendation: ${finding.recommendation}`);
      });
      lines.push("");
    });

    return lines.join("\n");
  };

  const downloadAuditReport = (run: ComparableRun) => {
    const reportText = buildReportText(run);
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `audit-report-${run.id}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(downloadUrl);
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

        <section style={{ width: "100%", maxWidth: "800px", marginBottom: "1rem" }}>
          <h2>Compare Audit Runs</h2>
          {comparableRuns.length < 2 ? (
            <p style={{ fontSize: "0.9rem", color: "#666" }}>
              Comparison requires at least 2 completed audit runs with summary data.
            </p>
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
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.82rem" }}>
                  Baseline Run
                  <select
                    value={baselineRunId}
                    onChange={(e) => {
                      const nextBaselineId = e.target.value;
                      setBaselineRunId(nextBaselineId);
                      if (nextBaselineId === comparisonRunId) {
                        const alternate = comparableRuns.find((run) => run.id !== nextBaselineId);
                        setComparisonRunId(alternate?.id ?? "");
                      }
                    }}
                    style={{ padding: "0.35rem", border: "1px solid #ccc", borderRadius: "4px", minWidth: "260px" }}
                  >
                    {comparableRuns
                      .filter((run) => run.id !== comparisonRunId)
                      .map((run) => (
                        <option key={run.id} value={run.id}>
                          {formatDate(run.createdAt)} - {run.repoUrl}
                        </option>
                      ))}
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.82rem" }}>
                  Comparison Run
                  <select
                    value={comparisonRunId}
                    onChange={(e) => {
                      const nextComparisonId = e.target.value;
                      setComparisonRunId(nextComparisonId);
                      if (nextComparisonId === baselineRunId) {
                        const alternate = comparableRuns.find((run) => run.id !== nextComparisonId);
                        setBaselineRunId(alternate?.id ?? "");
                      }
                    }}
                    style={{ padding: "0.35rem", border: "1px solid #ccc", borderRadius: "4px", minWidth: "260px" }}
                  >
                    {comparableRuns
                      .filter((run) => run.id !== baselineRunId)
                      .map((run) => (
                        <option key={run.id} value={run.id}>
                          {formatDate(run.createdAt)} - {run.repoUrl}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              {baselineRun && comparisonRun && baselineRun.id !== comparisonRun.id ? (
                (() => {
                  const baselineSummary = baselineRun.findings.auditSummary;
                  const comparisonSummary = comparisonRun.findings.auditSummary;

                  const scoreDeltaValue = comparisonSummary.score - baselineSummary.score;
                  const totalFindingsDeltaValue = comparisonSummary.totalFindings - baselineSummary.totalFindings;
                  const highDeltaValue = comparisonSummary.highCount - baselineSummary.highCount;
                  const mediumDeltaValue = comparisonSummary.mediumCount - baselineSummary.mediumCount;
                  const lowDeltaValue = comparisonSummary.lowCount - baselineSummary.lowCount;

                  const baselineCategory = getCategoryCounts(baselineRun);
                  const comparisonCategory = getCategoryCounts(comparisonRun);

                  const categoryRows: Array<{ key: FindingCategory; label: string }> = [
                    { key: "security", label: "Security" },
                    { key: "privacy", label: "Privacy" },
                    { key: "responsible-ai", label: "Responsible AI" },
                  ];

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", padding: "0.35rem", borderBottom: "1px solid #e6e6e6" }}>Metric</th>
                            <th style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #e6e6e6" }}>Baseline</th>
                            <th style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #e6e6e6" }}>Comparison</th>
                            <th style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #e6e6e6" }}>Delta</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>Score</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>{baselineSummary.score}</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>{comparisonSummary.score}</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0", fontWeight: 600, color: scoreDeltaValue >= 0 ? "#157347" : "#b02a37" }}>
                              {formatSignedDelta(scoreDeltaValue)}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>Risk Level</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0", textTransform: "capitalize" }}>{baselineSummary.riskLevel}</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0", textTransform: "capitalize" }}>{comparisonSummary.riskLevel}</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>-</td>
                          </tr>
                          <tr>
                            <td style={{ padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>Total Findings</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>{baselineSummary.totalFindings}</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>{comparisonSummary.totalFindings}</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0", fontWeight: 600, color: totalFindingsDeltaValue <= 0 ? "#157347" : "#b02a37" }}>
                              {formatSignedDelta(totalFindingsDeltaValue)}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>High Severity</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>{baselineSummary.highCount}</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>{comparisonSummary.highCount}</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0", fontWeight: 600, color: highDeltaValue <= 0 ? "#157347" : "#b02a37" }}>
                              {formatSignedDelta(highDeltaValue)}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>Medium Severity</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>{baselineSummary.mediumCount}</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>{comparisonSummary.mediumCount}</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0", fontWeight: 600, color: mediumDeltaValue <= 0 ? "#157347" : "#b02a37" }}>
                              {formatSignedDelta(mediumDeltaValue)}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>Low Severity</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>{baselineSummary.lowCount}</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>{comparisonSummary.lowCount}</td>
                            <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0", fontWeight: 600, color: lowDeltaValue <= 0 ? "#157347" : "#b02a37" }}>
                              {formatSignedDelta(lowDeltaValue)}
                            </td>
                          </tr>
                          {categoryRows.map((categoryRow) => {
                            const baselineValue = baselineCategory[categoryRow.key];
                            const comparisonValue = comparisonCategory[categoryRow.key];
                            const delta = comparisonValue - baselineValue;

                            return (
                              <tr key={categoryRow.key}>
                                <td style={{ padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>{categoryRow.label}</td>
                                <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>{baselineValue}</td>
                                <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0" }}>{comparisonValue}</td>
                                <td style={{ textAlign: "center", padding: "0.35rem", borderBottom: "1px solid #f0f0f0", fontWeight: 600, color: delta <= 0 ? "#157347" : "#b02a37" }}>
                                  {formatSignedDelta(delta)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <div style={{ fontSize: "0.82rem", color: "#333" }}>
                        <strong>{getComparisonRiskText(baselineRun, comparisonRun)}</strong>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div style={{ fontSize: "0.82rem", color: "#666" }}>
                  Select two different runs to view comparison.
                </div>
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
                    const exportableRun = comparableRuns.find((candidate) => candidate.id === run.id) ?? null;

                    return (
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <strong>{run.repoUrl}</strong>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          {exportableRun ? (
                            <button
                              onClick={() => downloadAuditReport(exportableRun)}
                              style={{
                                padding: "0.25rem 0.6rem",
                                fontSize: "0.75rem",
                                backgroundColor: "#495057",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            >
                              Export Report
                            </button>
                          ) : null}
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
                      </div>
                    );
                  })()}

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
