/*
 Match Meter V4 — Telegram Mini App backend
 Node 18+.

 Required environment variables:
   BOT_TOKEN
   OWNER_CHAT_ID

 Optional:
   PORT

 The Mini App POSTs results to /submit. The backend validates Telegram
 Web App initData before sending the result to OWNER_CHAT_ID.

 The /telegram-webhook endpoint is retained for compatibility with the
 existing Telegram webhook, but the Mini App no longer depends on
 sendData()/web_app_data for result delivery.
*/

const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const token = process.env.BOT_TOKEN;
const owner = process.env.OWNER_CHAT_ID;
const port = Number(process.env.PORT || 3000);

if (!token || !owner) {
  console.warn("WARNING: Set BOT_TOKEN and OWNER_CHAT_ID.");
}

function tg(method, body) {
  return new Promise((resolve, reject) => {
    if (!token) return reject(new Error("BOT_TOKEN is missing"));

    const data = JSON.stringify(body);
    const request = https.request(
      {
        hostname: "api.telegram.org",
        path: "/bot" + token + "/" + method,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data)
        }
      },
      response => {
        let text = "";
        response.on("data", chunk => text += chunk);
        response.on("end", () => {
          try {
            const parsed = JSON.parse(text);
            resolve({ status: response.statusCode, ...parsed });
          } catch {
            resolve({ status: response.statusCode, ok: false, description: text });
          }
        });
      }
    );

    request.on("error", reject);
    request.write(data);
    request.end();
  });
}

// Validate Telegram Web App initData according to Telegram's HMAC rules.
function validateInitData(initData) {
  if (!initData || !token) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;

    params.delete("hash");

    const dataCheck = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => k + "=" + v)
      .join("\n");

    const secret = crypto
      .createHmac("sha256", "WebAppData")
      .update(token)
      .digest();

    const expected = crypto
      .createHmac("sha256", secret)
      .update(dataCheck)
      .digest("hex");

    if (expected.length !== hash.length) return null;
    if (!crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(hash, "utf8")
    )) return null;

    // Reject very old initData.
    const authDate = Number(params.get("auth_date"));
    if (!Number.isFinite(authDate)) return null;
    const maxAge = 24 * 60 * 60;
    if (Math.abs(Math.floor(Date.now() / 1000) - authDate) > maxAge) return null;

    return Object.fromEntries(params.entries());
  } catch (error) {
    console.error("initData validation error:", error.message);
    return null;
  }
}

function parseUser(validated) {
  try {
    const user = JSON.parse(validated.user || "null");
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

function validatePayload(body) {
  const allowedModes = [
    "love",
    "bestfriend",
    "fwb",
    "sex",
    "living",
    "timepass",
    "intimate"
  ];

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const theirName = typeof body.their_name === "string" ? body.their_name.trim() : "";
  const mode = body.mode;
  const score = Number(body.score);

  if (!name || !theirName) throw new Error("Invalid names");
  if (name.length > 40 || theirName.length > 40) throw new Error("Name too long");
  if (!allowedModes.includes(mode)) throw new Error("Invalid mode");
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new Error("Invalid score");
  }

  return {
    name,
    their_name: theirName,
    mode,
    score
  };
}

async function sendOwner(payload, user) {
  if (!owner) throw new Error("OWNER_CHAT_ID is missing");

  const text =
    "💘 Match Meter V4\n\n" +
    "Category: " + payload.mode + "\n" +
    "Name: " + payload.name.slice(0, 40) + "\n" +
    "Their name: " + payload.their_name.slice(0, 40) + "\n" +
    "Score: " + Number(payload.score) + "%\n" +
    "Telegram user: " + (user?.id || "unknown");

  const result = await tg("sendMessage", {
    chat_id: owner,
    text
  });

  if (!result.ok) {
    throw new Error(
      "Telegram sendMessage failed: " +
      (result.description || "unknown error")
    );
  }

  return result;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    const maxSize = 10000;

    req.on("data", chunk => {
      size += chunk.length;
      if (size > maxSize) {
        reject(new Error("Request too large"));
        req.destroy();
        return;
      }
      raw += chunk;
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      const file = fs.readFileSync(path.join(__dirname, "index.html"));
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      });
      return res.end(file);
    }

    // Main Mini App result endpoint.
    if (req.method === "POST" && req.url === "/submit") {
      console.log("[submit] Incoming Match Meter result");

      const body = await readJson(req);
      const validated = validateInitData(body.initData);

      if (!validated) {
        console.error("[submit] Invalid Telegram initData");
        return sendJson(res, 401, {
          ok: false,
          error: "Invalid Telegram initData"
        });
      }

      const user = parseUser(validated);
      if (!user) {
        console.error("[submit] Telegram user missing from initData");
        return sendJson(res, 401, {
          ok: false,
          error: "Telegram user missing"
        });
      }

      const payload = validatePayload(body);

      console.log(
        "[submit] Valid result from Telegram user " +
        user.id +
        ": " +
        payload.mode +
        " / " +
        payload.score +
        "%"
      );

      await sendOwner(payload, user);

      console.log("[submit] Owner message sent successfully");

      return sendJson(res, 200, {
        ok: true
      });
    }

    // Retained for compatibility with the existing Telegram webhook.
    if (req.method === "POST" && req.url === "/telegram-webhook") {
      const body = await readJson(req);
      const message = body.message;
      const data = message?.web_app_data?.data;

      console.log("[webhook] Telegram webhook received");

      if (data) {
        try {
          const payload = validatePayload(JSON.parse(data));
          await sendOwner(payload, message.from);
          console.log("[webhook] Owner message sent successfully");
        } catch (error) {
          console.error("[webhook] Processing error:", error.message);
        }
      }

      res.writeHead(200);
      return res.end("ok");
    }

    res.writeHead(404);
    res.end("Not found");
  } catch (error) {
    console.error("[server] Request error:", error.message);

    if (!res.headersSent) {
      sendJson(res, 500, {
        ok: false,
        error: "Server error"
      });
    }
  }
});

server.listen(port, () => {
  console.log("Match Meter V4 listening on " + port);
  console.log("Direct result endpoint: POST /submit");
});
