import { useEffect, useState } from "react";

interface AnalyzeLog {
  time: string;
  imageUrl: string;
  isAIGenerated: boolean;
  confidence?: number;
}

function Logs(): JSX.Element {
  const [logs, setLogs] = useState<AnalyzeLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadLogs = () => {
    setLoading(true);
    try {
      chrome.storage.local.get(
        ["analyzeLogs"],
        (result: { analyzeLogs?: AnalyzeLog[] }) => {
          console.log("Logs from storage:", result);
          setLogs(Array.isArray(result.analyzeLogs) ? result.analyzeLogs : []);
          setLoading(false);
        }
      );
    } catch (error) {
      console.error("Error loading logs:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const storageListener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (changes.analyzeLogs) {
        console.log("Storage changed, reloading logs");
        loadLogs();
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  const clearLogs = () => {
    if (confirm("Вы уверены, что хотите очистить все логи?")) {
      chrome.storage.local.set({ analyzeLogs: [] }, () => {
        setLogs([]);
        console.log("Logs cleared");
      });
    }
  };

  return (
    <div
      style={{
        padding: 24,
        background: "#232323",
        color: "#fff",
        minHeight: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2>AI Image Analysis Logs</h2>
        <div>
          <button
            onClick={loadLogs}
            style={{
              padding: "8px 16px",
              marginRight: 10,
              background: "#3a8fff",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
          <button
            onClick={clearLogs}
            style={{
              padding: "8px 16px",
              background: "#ff5252",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Clear Logs
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 20 }}>Loading logs...</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 20 }}>
          <p>
            No logs found. Browse some websites with images to detect
            AI-generated content.
          </p>
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "#181818",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid #444" }}>
              <th style={{ color: "#aaa", padding: 8 }}>Time</th>
              <th style={{ color: "#aaa", padding: 8 }}>Image URL</th>
              <th style={{ color: "#aaa", padding: 8 }}>AI Generated?</th>
              <th style={{ color: "#aaa", padding: 8 }}>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #333" }}>
                <td style={{ padding: 8 }}>
                  {new Date(log.time).toLocaleString()}
                </td>
                <td
                  style={{
                    padding: 8,
                    maxWidth: 300,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <a
                    href={log.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#3a8fff" }}
                  >
                    {log.imageUrl.length > 60
                      ? log.imageUrl.substring(0, 57) + "..."
                      : log.imageUrl}
                  </a>
                </td>
                <td
                  style={{
                    padding: 8,
                    color: log.isAIGenerated ? "#ff5252" : "#4caf50",
                  }}
                >
                  {log.isAIGenerated ? "Yes" : "No"}
                </td>
                <td style={{ padding: 8 }}>
                  {log.confidence !== undefined
                    ? `${Math.round(log.confidence * 100)}%`
                    : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div
        style={{
          marginTop: 20,
          fontSize: 12,
          color: "#888",
          textAlign: "center",
        }}
      >
        Note: Images are analyzed using AI detection models and results may not
        be 100% accurate.
      </div>
    </div>
  );
}

export default Logs;
