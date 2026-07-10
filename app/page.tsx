export default function Home() {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "3rem 1.25rem", lineHeight: 1.6 }}>
      <h1 style={{ marginBottom: ".25rem" }}>Common Standards MCP</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        An MCP server that lets an AI assistant look up U.S. academic standards on demand,
        via the <a href="https://commonstandardsproject.com/">Common Standards Project</a>.
      </p>
      <h2>Connect</h2>
      <p>Add this server to an MCP client (e.g. Claude) using its URL:</p>
      <pre style={{ background: "#f4f4f4", padding: "1rem", borderRadius: 8, overflowX: "auto" }}>
        <code>{`/api/mcp  (this deployment's origin + /api/mcp)`}</code>
      </pre>
      <h2>Tools</h2>
      <ul>
        <li><strong>list_jurisdictions</strong> — states &amp; organizations that publish standards</li>
        <li><strong>list_standard_sets</strong> — a jurisdiction&apos;s sets (subject × grade)</li>
        <li><strong>get_standard_set</strong> — every standard in a set, with attribution</li>
        <li><strong>get_standard</strong> — one standard by id, with crosswalks</li>
      </ul>
      <p style={{ color: "#777", fontSize: ".9rem" }}>
        Read-only. Standards data is licensed per set (typically CC BY); see each result&apos;s attribution.
      </p>
    </main>
  );
}
