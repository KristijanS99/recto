export interface AuthorizePageParams {
  clientName: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  error?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderAuthorizePage(params: AuthorizePageParams): string {
  const errorHtml = params.error ? `<p class="error">${escapeHtml(params.error)}</p>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize — Recto</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #333;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      padding: 2rem;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    .client-name { color: #6366f1; font-weight: 600; }
    .description { color: #666; font-size: 0.875rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem; }
    input[type="password"] {
      width: 100%;
      padding: 0.625rem 0.75rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }
    input[type="password"]:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }
    button {
      width: 100%;
      padding: 0.625rem;
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
    }
    button:hover { background: #4f46e5; }
    .error { color: #dc2626; font-size: 0.813rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize</h1>
    <p class="description">
      <span class="client-name">${escapeHtml(params.clientName)}</span>
      wants to access your Recto journal. Enter your API key to authorize.
    </p>
    ${errorHtml}
    <form method="POST" action="/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}" />
      <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}" />
      <input type="hidden" name="state" value="${escapeHtml(params.state)}" />
      <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}" />
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.codeChallengeMethod)}" />
      <label for="api_key">API key</label>
      <input type="password" id="api_key" name="api_key" required autocomplete="off" />
      <button type="submit">Authorize</button>
    </form>
  </div>
</body>
</html>`;
}
