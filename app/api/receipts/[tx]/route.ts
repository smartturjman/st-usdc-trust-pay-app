export async function GET(_req: Request, context: any): Promise<Response> {
  const { tx } = context.params as { tx: string };

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Verified Transaction Certificate</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;margin:40px;}
    .title{font-weight:700;font-size:20px;}
    .box{border:1px solid #ccc;padding:20px;border-radius:12px;margin-top:16px;}
    code{word-break:break-all}
  </style>
</head>
<body>
  <div class="title">Smart Turjman — Verified Transaction Certificate</div>
  <p><b>Tx Hash:</b> <code>${tx}</code></p>
  <div class="box">
    <p>Service: Legal Translation – MOFA</p>
    <p>Amount: 75.00 USDC</p>
    <p>Status: Verified</p>
    <p>Network: Testnet (Demo)</p>
  </div>
  <p>Verify on-chain with the hash above (demo mode).</p>
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
