// Vercel Serverless Function Proxy for Google Apps Script Web App
export default async function handler(req, res) {
  // CORS Preflight Handler
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const GAS_URL = process.env.GAS_API_URL || "DAN_URL_WEB_APP_GAS_VAO_DAY";

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}),
      redirect: "follow" // Tự động đi theo HTTP 302 của Apps Script
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Proxy Error: Không thể kết nối tới Google Apps Script Web App",
      error: error.message
    });
  }
}
