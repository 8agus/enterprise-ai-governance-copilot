"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

// TypeScript type matching Prisma AuditRun model
type AuditRun = {
  id: string;
  repoUrl: string;
  status: string;
  createdAt: string;
};

const API_URL = "http://localhost:3001";

export default function Home() {
  // State for form input
  const [repoUrl, setRepoUrl] = useState("");
  
  // State for audit runs list
  const [auditRuns, setAuditRuns] = useState<AuditRun[]>([]);
  
  // State for loading and error handling
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch audit runs on page load
  useEffect(() => {
    fetchAuditRuns();
  }, []);

  // Function to fetch all audit runs from API
  const fetchAuditRuns = async () => {
    try {
      const response = await fetch(`${API_URL}/audit-runs`);
      if (!response.ok) {
        throw new Error("Failed to fetch audit runs");
      }
      const data = await response.json();
      setAuditRuns(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
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
      const response = await fetch(`${API_URL}/audit-runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repoUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to create audit run");
      }

      // Clear input and refresh list
      setRepoUrl("");
      await fetchAuditRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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
              disabled={isLoading}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "1rem",
                backgroundColor: "#0070f3",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isLoading ? "not-allowed" : "pointer",
              }}
            >
              {isLoading ? "Starting..." : "Start Audit"}
            </button>
          </form>
          {error && (
            <p style={{ color: "red", marginTop: "0.5rem" }}>{error}</p>
          )}
        </section>

        {/* Audit Runs List */}
        <section style={{ width: "100%", maxWidth: "800px" }}>
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
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <strong>{run.repoUrl}</strong>
                    <span
                      style={{
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        backgroundColor: run.status === "pending" ? "#ffa500" : "#28a745",
                        color: "white",
                        fontSize: "0.875rem",
                      }}
                    >
                      {run.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#666" }}>
                    <div>ID: {run.id}</div>
                    <div>Created: {formatDate(run.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
