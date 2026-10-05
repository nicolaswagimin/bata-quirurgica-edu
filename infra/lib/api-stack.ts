import { resolve } from 'node:path';
import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import {
  AuthorizationType,
  EndpointType,
  LambdaIntegration,
  MockIntegration,
  PassthroughBehavior,
  type Resource,
  ResponseTransferMode,
  ResponseType,
  RestApi,
  TokenAuthorizer,
} from 'aws-cdk-lib/aws-apigateway';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, type IFunction, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { type ISecret, Secret } from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';
import { DatadogLambda } from 'datadog-cdk-constructs-v2';

export interface ApiStackProps extends StackProps {
  stage: string;
  webOrigin: string;
  ddSite: string;
  firebaseProjectId: string;
  assistantReservedConcurrency: number;
}

type HandlerName = 'authorizer' | 'me' | 'quiz' | 'chat' | 'transcribe' | 'admin';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const ENTRY = resolve(repoRoot, 'services', 'api', 'src', 'handlers', 'entry.ts');
const TITAN_EMBED_ARN = 'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0';
const DD_EXTENSION_LAYER_ARN =
  'arn:aws:lambda:us-east-1:464622532012:layer:Datadog-Extension-ARM:99';
const ALLOW_HEADERS = 'Authorization,Content-Type';

const GATEWAY_RESPONSES: { type: ResponseType; code: string; statusCode?: string }[] = [
  { type: ResponseType.DEFAULT_4XX, code: 'BAD_REQUEST' },
  { type: ResponseType.DEFAULT_5XX, code: 'INTERNAL' },
  { type: ResponseType.UNAUTHORIZED, code: 'UNAUTHORIZED' },
  { type: ResponseType.ACCESS_DENIED, code: 'FORBIDDEN' },
  { type: ResponseType.THROTTLED, code: 'THROTTLED' },
  { type: ResponseType.QUOTA_EXCEEDED, code: 'QUOTA_EXCEEDED' },
  { type: ResponseType.EXPIRED_TOKEN, code: 'UNAUTHORIZED' },
  { type: ResponseType.INVALID_SIGNATURE, code: 'FORBIDDEN' },
  { type: ResponseType.MISSING_AUTHENTICATION_TOKEN, code: 'NOT_FOUND', statusCode: '404' },
];

const ASSISTANT_THROTTLE = { throttlingRateLimit: 5, throttlingBurstLimit: 10 };

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { stage, webOrigin } = props;

    const firebaseSa = Secret.fromSecretNameV2(
      this,
      'FirebaseSaSecret',
      `/bata/${stage}/firebase-service-account`,
    );
    const groqKey = Secret.fromSecretNameV2(this, 'GroqSecret', `/bata/${stage}/groq-api-key`);
    const datadogKey = Secret.fromSecretNameV2(
      this,
      'DatadogSecret',
      `/bata/${stage}/datadog-api-key`,
    );

    const baseEnv = {
      STAGE: stage,
      WEB_ORIGIN: webOrigin,
      FIREBASE_PROJECT_ID: props.firebaseProjectId,
      FIREBASE_SA_SECRET_ID: firebaseSa.secretName,
    };
    const groqEnv = {
      GROQ_SECRET_ID: groqKey.secretName,
      GROQ_CHAT_MODEL: 'openai/gpt-oss-120b',
      GROQ_STT_MODEL: 'whisper-large-v3-turbo',
    };
    const reserved =
      props.assistantReservedConcurrency > 0 ? props.assistantReservedConcurrency : undefined;

    const makeFn = (
      handler: HandlerName,
      opts: {
        env?: Record<string, string>;
        secrets?: ISecret[];
        timeout?: number;
        memorySize?: number;
        reservedConcurrentExecutions?: number;
      } = {},
    ): NodejsFunction => {
      const fn = new NodejsFunction(this, `${handler}Fn`, {
        entry: ENTRY,
        handler,
        projectRoot: repoRoot,
        depsLockFilePath: resolve(repoRoot, 'pnpm-lock.yaml'),
        runtime: Runtime.NODEJS_24_X,
        architecture: Architecture.ARM_64,
        timeout: Duration.seconds(opts.timeout ?? 10),
        memorySize: opts.memorySize ?? 512,
        reservedConcurrentExecutions: opts.reservedConcurrentExecutions,
        environment: { ...baseEnv, ...opts.env },
        bundling: {
          format: OutputFormat.CJS,
          target: 'node24',
          externalModules: ['datadog-lambda-js', 'dd-trace'],
        },
      });
      for (const secret of [firebaseSa, ...(opts.secrets ?? [])]) secret.grantRead(fn);
      return fn;
    };

    const authorizerFn = makeFn('authorizer');
    const meFn = makeFn('me');
    const quizFn = makeFn('quiz', {
      env: { SHOW_DRAFT_QUESTIONS: stage === 'prod' ? 'false' : 'true' },
    });
    const adminFn = makeFn('admin');
    const transcribeFn = makeFn('transcribe', {
      env: groqEnv,
      secrets: [groqKey],
      timeout: 30,
      reservedConcurrentExecutions: reserved,
    });
    const chatFn = makeFn('chat', {
      env: {
        ...groqEnv,
        KB_MAX_DISTANCE: '0.35',
        DD_SITE: props.ddSite,
        DD_API_KEY_SECRET_ARN: datadogKey.secretArn,
        DD_SERVICE: 'bata-api',
        DD_ENV: stage,
      },
      secrets: [groqKey, datadogKey],
      timeout: 60,
      memorySize: 1024,
      reservedConcurrentExecutions: reserved,
    });
    chatFn.addToRolePolicy(
      new PolicyStatement({ actions: ['bedrock:InvokeModel'], resources: [TITAN_EMBED_ARN] }),
    );
    // The streaming chat handler is not wrapped by the Datadog construct: only the extension layer.
    chatFn.addLayers(LayerVersion.fromLayerVersionArn(this, 'DdExtension', DD_EXTENSION_LAYER_ARN));

    new DatadogLambda(this, 'Datadog', {
      nodeLayerVersion: 143,
      extensionLayerVersion: 99,
      site: props.ddSite,
      apiKeySecretArn: datadogKey.secretArn,
      service: 'bata-api',
      env: stage,
      captureLambdaPayload: false,
    }).addLambdaFunctions([authorizerFn, meFn, quizFn, adminFn, transcribeFn]);

    const api = new RestApi(this, 'Api', {
      restApiName: `bata-api-${stage}`,
      endpointConfiguration: { types: [EndpointType.REGIONAL] },
      deployOptions: {
        stageName: 'v1',
        throttlingRateLimit: 50,
        throttlingBurstLimit: 100,
        methodOptions: {
          '/assistant/chat/POST': ASSISTANT_THROTTLE,
          '/assistant/transcribe/POST': ASSISTANT_THROTTLE,
        },
      },
      defaultCorsPreflightOptions: {
        allowOrigins: [webOrigin],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ALLOW_HEADERS.split(','),
      },
    });

    for (const { type, code, statusCode } of GATEWAY_RESPONSES) {
      api.addGatewayResponse(`Gw${type.responseType}`, {
        type,
        statusCode,
        responseHeaders: {
          'Access-Control-Allow-Origin': `'${webOrigin}'`,
          'Access-Control-Allow-Headers': `'${ALLOW_HEADERS}'`,
          Vary: "'Origin'",
        },
        templates: {
          'application/json': `{"error":{"code":"${code}","message":$context.error.messageString}}`,
        },
      });
    }

    const authorizer = new TokenAuthorizer(this, 'TokenAuthorizer', {
      handler: authorizerFn,
      resultsCacheTtl: Duration.seconds(300),
    });
    // Assigned per method so CORS preflight (OPTIONS) stays unauthenticated.
    const authed = { authorizer, authorizationType: AuthorizationType.CUSTOM };
    const route = (resource: Resource, method: string, fn: IFunction): void => {
      resource.addMethod(method, new LambdaIntegration(fn), authed);
    };

    api.root.addResource('health').addMethod(
      'GET',
      new MockIntegration({
        passthroughBehavior: PassthroughBehavior.NEVER,
        requestTemplates: { 'application/json': '{"statusCode": 200}' },
        integrationResponses: [
          { statusCode: '200', responseTemplates: { 'application/json': '{"ok":true}' } },
        ],
      }),
      { methodResponses: [{ statusCode: '200' }] },
    );

    const me = api.root.addResource('me');
    for (const method of ['GET', 'POST', 'DELETE']) route(me, method, meFn);
    route(me.addResource('group'), 'POST', meFn);

    route(api.root.addResource('quiz').addResource('answer'), 'POST', quizFn);

    const assistant = api.root.addResource('assistant');
    assistant.addResource('chat').addMethod(
      'POST',
      new LambdaIntegration(chatFn, {
        responseTransferMode: ResponseTransferMode.STREAM,
        timeout: Duration.seconds(60),
      }),
      authed,
    );
    route(assistant.addResource('transcribe'), 'POST', transcribeFn);

    const admin = api.root.addResource('admin');
    const questions = admin.addResource('questions');
    route(questions, 'GET', adminFn);
    route(questions, 'POST', adminFn);
    const question = questions.addResource('{id}');
    route(question, 'PUT', adminFn);
    route(question.addResource('validate'), 'POST', adminFn);
    const groups = admin.addResource('groups');
    route(groups, 'POST', adminFn);
    route(groups.addResource('{groupId}').addResource('progress'), 'GET', adminFn);

    new CfnOutput(this, 'ApiUrl', { value: api.url });
  }
}
