// 蓝域出海 BlueReach — Cloudflare Worker
// 隐藏后端域名，用户全程只看到 lanyu.one
// 部署: Cloudflare Dashboard → Workers → Create → 粘贴此代码 → Deploy
// 然后绑定路由: lanyu.one/*

const API_HOST = 'lanyu888888.com';
const RATE_LIMIT_MAP = new Map();

// 简易限流：每个 IP 每分钟最多 10 次 /api/admin/login
function checkRateLimit(ip, path) {
  if (!path.startsWith('/api/admin/login')) return true;
  const now = Date.now();
  const key = `login:${ip}`;
  const entry = RATE_LIMIT_MAP.get(key) || { count: 0, reset: now + 60000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 60000; }
  entry.count++;
  RATE_LIMIT_MAP.set(key, entry);
  return entry.count <= 10;
}

// 拦截恶意请求
function isMalicious(url) {
  const blocked = ['/.env', '/.git', '/wp-admin', '/admin.php', '/config', '/.well-known', '/phpmyadmin', '/sql', '/backup', '/node_modules', '/package.json'];
  return blocked.some(p => url.pathname.toLowerCase().includes(p));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const method = request.method;

    // 拦截恶意路径扫描
    if (isMalicious(url)) {
      return new Response('Not Found', { status: 404 });
    }

    // 阻止非 GET/POST 的异常请求
    if (!['GET', 'POST', 'OPTIONS'].includes(method)) {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // 登录接口限流
    if (!checkRateLimit(ip, url.pathname)) {
      return new Response(JSON.stringify({ error: '请求过于频繁' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // CORS 预检
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // API 请求转发到后端
    if (url.pathname.startsWith('/api/')) {
      url.hostname = API_HOST;
      const backendReq = new Request(url.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'follow',
      });

      const response = await fetch(backendReq);

      // 复制响应并添加安全头（不暴露后端信息）
      const res = new Response(response.body, response);
      res.headers.set('X-Content-Type-Options', 'nosniff');
      res.headers.set('X-Frame-Options', 'DENY');
      res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.headers.delete('X-Powered-By');
      res.headers.delete('Server');
      return res;
    }

    // 其他请求返回前端静态文件
    url.hostname = API_HOST;
    const frontendReq = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      redirect: 'follow',
    });
    return fetch(frontendReq);
  },
};
