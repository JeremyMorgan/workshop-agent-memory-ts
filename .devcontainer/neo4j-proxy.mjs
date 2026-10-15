
import http from "node:http";

const TARGET_HOST = "neo4j";
const TARGET_PORT = 7474;
const LISTEN_PORT = 7474;

http.createServer((req, res) => {
  const origin = `https://${req.headers.host}`;

  const upstream = http.request(
    {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${TARGET_HOST}:${TARGET_PORT}`,
        "accept-encoding": "identity",
      },
    },
    (response) => {
      if (req.method === "GET" && req.url === "/") {
        const chunks = [];

        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          try {
            const discovery = JSON.parse(
              Buffer.concat(chunks).toString("utf8")
            );

            discovery.query =
              `${origin}/db/{databaseName}/query/v2`;
            discovery.transaction =
              `${origin}/db/{databaseName}/tx`;

            const body = JSON.stringify(discovery);

            res.writeHead(200, {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
              "cache-control": "no-store",
            });
            res.end(body);
          } catch {
            res.writeHead(502);
            res.end("Failed to rewrite discovery response");
          }
        });
        return;
      }

      const headers = { ...response.headers };
      delete headers["transfer-encoding"];

      res.writeHead(response.statusCode ?? 502, headers);
      response.pipe(res);
    }
  );

  upstream.on("error", (err) => {
    if (!res.headersSent) res.writeHead(502);
    res.end(err.message);
  });

  req.pipe(upstream);
}).listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`Neo4j proxy listening on ${LISTEN_PORT}`);
});
