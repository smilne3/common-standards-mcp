export const metadata = {
  title: "Common Standards MCP",
  description: "An MCP server for U.S. academic standards, via the Common Standards Project.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
