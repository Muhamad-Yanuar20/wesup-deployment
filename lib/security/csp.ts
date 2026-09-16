export interface ContentSecurityPolicy {
  nonce: string;
  policy: string;
}

export interface ContentSecurityPolicyOptions {
  allowMidtrans?: boolean;
}

export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function shouldAllowMidtransCsp(pathname: string): boolean {
  return /^\/pesanan\/[^/]+\/bayar\/?$/.test(pathname);
}
export function buildContentSecurityPolicy(
  nonce: string = generateNonce(),
  options: ContentSecurityPolicyOptions = {},
): ContentSecurityPolicy {
  const isDev = process.env.NODE_ENV === "development";
  const midtransScriptSources = options.allowMidtrans
    ? " https://*.midtrans.com https://*.veritrans.co.id https://*.cloudfront.net"
    : "";
  const midtransConnectSources = options.allowMidtrans
    ? " https://*.midtrans.com https://*.veritrans.co.id https://*.cloudfront.net https://*.mixpanel.com https://*.google-analytics.com"
    : "";
  const midtransImageSources = options.allowMidtrans
    ? " https://*.midtrans.com https://*.veritrans.co.id https://*.cloudfront.net https://*.mixpanel.com https://*.google-analytics.com"
    : "";
  const midtransFontSources = options.allowMidtrans
    ? " https://*.midtrans.com https://*.veritrans.co.id https://*.cloudfront.net"
    : "";
  const midtransFrameSources = options.allowMidtrans
    ? " frame-src https://*.midtrans.com https://*.veritrans.co.id;"
    : "";
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}${midtransScriptSources};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://*.tile.openstreetmap.org${midtransImageSources};
    font-src 'self'${midtransFontSources};
    connect-src 'self' https://*.supabase.co wss://*.supabase.co${midtransConnectSources};
    ${midtransFrameSources}
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `;
  const policy = cspHeader.replace(/\s{2,}/g, " ").trim();
  return { nonce, policy };
}