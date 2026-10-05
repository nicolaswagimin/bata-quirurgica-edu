import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../bin/app.ts';

const infraRoot = resolve(import.meta.dirname, '..');
const cdkContext = (
  JSON.parse(readFileSync(resolve(infraRoot, 'cdk.json'), 'utf8')) as {
    context: Record<string, unknown>;
  }
).context;

function synthStacks(overrides: Record<string, unknown> = {}): {
  api: Template;
  web: Template;
  budget: Template;
} {
  const app = buildApp({ ...cdkContext, ...overrides, 'aws:cdk:bundling-stacks': [] });
  const get = (id: string) => Template.fromStack(app.node.findChild(id) as Stack);
  return { api: get('bata-api-dev'), web: get('bata-web-dev'), budget: get('bata-budget-dev') };
}

const { api, web, budget } = synthStacks();

type CfnResource = { Properties: Record<string, unknown> };
type LambdaProps = {
  Handler: string;
  Runtime: string;
  Architectures: string[];
  VpcConfig?: unknown;
  ReservedConcurrentExecutions?: number;
  Environment?: { Variables?: Record<string, unknown> };
};

function functionsBy(template: Template): Record<string, LambdaProps> {
  return Object.fromEntries(
    Object.entries(
      template.findResources('AWS::Lambda::Function') as Record<string, CfnResource>,
    ).map(([id, res]) => [id, res.Properties as unknown as LambdaProps]),
  );
}

function handlerName(fn: LambdaProps): string {
  const ddHandler = fn.Environment?.Variables?.DD_LAMBDA_HANDLER;
  return typeof ddHandler === 'string' ? ddHandler : fn.Handler;
}

function findFunction(template: Template, name: string): LambdaProps {
  const fn = Object.values(functionsBy(template)).find((f) => handlerName(f) === `index.${name}`);
  if (!fn) throw new Error(`No function for handler ${name}`);
  return fn;
}

describe('bata-api-dev', () => {
  it.each([
    'DEFAULT_4XX',
    'DEFAULT_5XX',
    'UNAUTHORIZED',
    'ACCESS_DENIED',
    'THROTTLED',
    'QUOTA_EXCEEDED',
    'EXPIRED_TOKEN',
    'INVALID_SIGNATURE',
    'MISSING_AUTHENTICATION_TOKEN',
  ])('gateway response %s carries CORS headers', (type) => {
    api.hasResourceProperties('AWS::ApiGateway::GatewayResponse', {
      ResponseType: type,
      ResponseParameters: Match.objectLike({
        'gatewayresponse.header.Access-Control-Allow-Origin': "'http://localhost:5173'",
        'gatewayresponse.header.Vary': "'Origin'",
      }),
      ResponseTemplates: { 'application/json': Match.stringLikeRegexp('"error":\\{"code":') },
    });
  });

  it('streams POST /assistant/chat through an AWS_PROXY integration', () => {
    const chatResource = Object.entries(
      api.findResources('AWS::ApiGateway::Resource', { Properties: { PathPart: 'chat' } }),
    );
    expect(chatResource).toHaveLength(1);
    api.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'POST',
      ResourceId: { Ref: chatResource[0]?.[0] },
      AuthorizationType: 'CUSTOM',
      Integration: Match.objectLike({
        Type: 'AWS_PROXY',
        ResponseTransferMode: 'STREAM',
        TimeoutInMillis: 60000,
      }),
    });
  });

  it('uses a TOKEN authorizer cached for 300 s and leaves OPTIONS unauthenticated', () => {
    api.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      Type: 'TOKEN',
      AuthorizerResultTtlInSeconds: 300,
    });
    const options = Object.values(
      api.findResources('AWS::ApiGateway::Method', { Properties: { HttpMethod: 'OPTIONS' } }),
    ) as CfnResource[];
    expect(options.length).toBeGreaterThan(0);
    for (const method of options) expect(method.Properties.AuthorizationType).toBe('NONE');
  });

  it('throttles stage v1 at 50/100 and the assistant methods at 5/10', () => {
    api.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'v1',
      MethodSettings: Match.arrayWith([
        Match.objectLike({
          HttpMethod: '*',
          ResourcePath: '/*',
          ThrottlingRateLimit: 50,
          ThrottlingBurstLimit: 100,
        }),
        Match.objectLike({
          HttpMethod: 'POST',
          ResourcePath: '/~1assistant~1chat',
          ThrottlingRateLimit: 5,
          ThrottlingBurstLimit: 10,
        }),
        Match.objectLike({
          HttpMethod: 'POST',
          ResourcePath: '/~1assistant~1transcribe',
          ThrottlingRateLimit: 5,
          ThrottlingBurstLimit: 10,
        }),
      ]),
    });
  });

  it('reserves concurrency on chat and transcribe only when the context asks for it', () => {
    for (const name of ['chat', 'transcribe']) {
      expect(findFunction(api, name).ReservedConcurrentExecutions).toBe(5);
    }
    const { api: unreserved } = synthStacks({ assistantReservedConcurrency: 0 });
    for (const name of ['chat', 'transcribe']) {
      expect(findFunction(unreserved, name).ReservedConcurrentExecutions).toBeUndefined();
    }
  });

  it('points every function at an export of entry.ts, on node24/arm64 without VPC', () => {
    const entrySource = readFileSync(
      resolve(infraRoot, '..', 'services', 'api', 'src', 'handlers', 'entry.ts'),
      'utf8',
    );
    const exported = new Set([...entrySource.matchAll(/^export const (\w+)/gm)].map((m) => m[1]));
    const fns = Object.values(functionsBy(api));
    expect(fns).toHaveLength(6);
    for (const fn of fns) {
      expect(fn.VpcConfig).toBeUndefined();
      expect(fn.Runtime).toBe('nodejs24.x');
      expect(fn.Architectures).toEqual(['arm64']);
      const handler = handlerName(fn);
      expect(handler).toMatch(/^index\.\w+$/);
      expect(exported.has(handler.slice('index.'.length))).toBe(true);
    }
  });

  it('grants bedrock:InvokeModel exactly once, on Titan embeddings v2', () => {
    const statements = Object.values(
      api.findResources('AWS::IAM::Policy') as Record<string, CfnResource>,
    )
      .flatMap(
        (policy) =>
          (
            policy.Properties.PolicyDocument as {
              Statement: { Action: unknown; Resource: unknown }[];
            }
          ).Statement,
      )
      .filter((s) => [s.Action].flat().includes('bedrock:InvokeModel'));
    expect(statements).toHaveLength(1);
    expect(statements[0]?.Resource).toBe(
      'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0',
    );
  });
});

describe('bata-web-dev', () => {
  it('keeps the bucket private and serves it through CloudFront OAC with SPA fallback', () => {
    web.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    web.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    web.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Origins: [Match.objectLike({ OriginAccessControlId: Match.anyValue() })],
        CustomErrorResponses: [403, 404].map((code) =>
          Match.objectLike({ ErrorCode: code, ResponseCode: 200, ResponsePagePath: '/index.html' }),
        ),
      }),
    });
  });
});

describe('bata-budget-dev', () => {
  it('caps the monthly cost at 20 USD with ACTUAL alerts at 5, 10 and 20 USD', () => {
    budget.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({
        BudgetType: 'COST',
        TimeUnit: 'MONTHLY',
        BudgetLimit: { Amount: 20, Unit: 'USD' },
      }),
      NotificationsWithSubscribers: [5, 10, 20].map((threshold) =>
        Match.objectLike({
          Notification: Match.objectLike({ NotificationType: 'ACTUAL', Threshold: threshold }),
        }),
      ),
    });
  });
});
