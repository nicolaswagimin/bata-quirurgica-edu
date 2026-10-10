import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// API local: hace de API Gateway (autorizador TOKEN + despacho a los exports de entry.ts).
const HOST = '127.0.0.1';
const PORT = 3001;
const STAGE_PREFIX = '/v1';

type Handler = (event: APIGatewayProxyEvent, res: ServerResponse) => Promise<unknown>;

const ROUTES: [prefix: string, exportName: string][] = [
  ['/me', 'me'],
  ['/quiz', 'quiz'],
  ['/assistant/chat', 'chat'],
  ['/assistant/transcribe', 'transcribe'],
  ['/admin', 'admin'],
];

// Debe existir antes de importar entry.ts. Sin preludio: el servidor local es el gateway.
function installLocalAwslambda(): void {
  (globalThis as Record<string, unknown>).awslambda = {
    streamifyResponse: (fn: unknown) => fn,
    HttpResponseStream: {
      from: (
        res: ServerResponse,
        meta: { statusCode: number; headers?: Record<string, string> },
      ) => {
        res.writeHead(meta.statusCode, meta.headers);
        return res;
      },
    },
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, result: APIGatewayProxyResult): void {
  res.writeHead(result.statusCode, result.headers as Record<string, string> | undefined);
  res.end(result.body);
}

function matchRoute(path: string): string | undefined {
  return ROUTES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1];
}

export async function createDevServer() {
  process.env.WEB_ORIGIN ||= 'http://localhost:5173';
  installLocalAwslambda();
  const entry = (await import('../src/handlers/entry.ts')) as unknown as Record<string, Handler>;
  const { corsHeaders, errorResponse, httpError, json } = await import('../src/lib/http.ts');

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        ...corsHeaders(),
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      });
      res.end();
      return;
    }
    if (method === 'GET' && url.pathname === `${STAGE_PREFIX}/health`) {
      return send(res, json(200, { ok: true }));
    }
    if (!url.pathname.startsWith(`${STAGE_PREFIX}/`)) {
      return send(res, errorResponse(httpError('NOT_FOUND', 'Ruta no encontrada.')));
    }
    const path = url.pathname.slice(STAGE_PREFIX.length);
    const exportName = matchRoute(path);
    const handler = exportName ? entry[exportName] : undefined;
    if (!handler) return send(res, errorResponse(httpError('NOT_FOUND', 'Ruta no encontrada.')));

    let authorizer: Record<string, unknown> | undefined;
    try {
      const authorizerFn = entry.authorizer as unknown as (e: unknown) => Promise<{
        context?: Record<string, unknown>;
      }>;
      authorizer = (
        await authorizerFn({
          type: 'TOKEN',
          authorizationToken: req.headers.authorization ?? '',
          methodArn: `arn:aws:execute-api:us-east-1:000000000000:local/v1/${method}${path}`,
        })
      ).context;
    } catch {
      return send(
        res,
        errorResponse(httpError('UNAUTHORIZED', 'Tu sesión expiró, vuelve a iniciar sesión')),
      );
    }

    const headers = Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : (v ?? '')]),
    );
    const body = await readBody(req);
    const event = {
      httpMethod: method,
      path,
      resource: path,
      headers,
      multiValueHeaders: {},
      queryStringParameters: Object.fromEntries(url.searchParams),
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      body: body === '' ? null : body,
      isBase64Encoded: false,
      requestContext: { authorizer, stage: 'v1', httpMethod: method, path: url.pathname },
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event, res);
    if (!res.headersSent && result && typeof result === 'object' && 'statusCode' in result) {
      send(res, result as APIGatewayProxyResult);
    }
  }

  return createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      if (res.headersSent) return res.end();
      send(res, errorResponse(err));
    });
  });
}

async function main(argv: string[]): Promise<number> {
  const smoke = argv.filter((arg) => arg !== '--').includes('--smoke');
  const server = await createDevServer();
  await new Promise<void>((resolve) => server.listen(PORT, HOST, resolve));
  console.log(`API local en http://${HOST}:${PORT}${STAGE_PREFIX}`);
  if (!smoke) return new Promise<number>(() => {});
  try {
    const res = await fetch(`http://${HOST}:${PORT}${STAGE_PREFIX}/health`);
    const body = (await res.json()) as { ok?: unknown };
    const ok = res.status === 200 && body.ok === true;
    console.log(ok ? 'Smoke OK' : `Smoke falló: ${res.status} ${JSON.stringify(body)}`);
    return ok ? 0 : 1;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    },
  );
}
