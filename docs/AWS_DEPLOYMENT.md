# AWS Deployment Runbook

Use `infra/production.yml` to create the AWS resources for a production deployment.

The stack creates:

- private S3 bucket for CMS JSON/media content
- private S3 bucket for public static-site origin
- private S3 bucket for Admin app origin
- CloudFront distributions for public site and Admin app
- Cognito user pool and app client with `custom:role`
- CMS API Lambda and HTTP API Gateway
- CodeBuild project for static-site builds/deploys
- IAM roles and bucket policies

## Manual Decisions Before Deployment

Choose these values first:

- `ProjectName`: short lowercase project name, for example `s3cms`.
- `CmsContentBucketName`: globally unique private content bucket.
- `PublicSiteBucketName`: globally unique public-site origin bucket.
- `AdminSiteBucketName`: globally unique Admin app origin bucket.
- `CodeBuildSourceLocation`: repository HTTPS URL.
- `CodeBuildSourceVersion`: branch or commit to build.
- `AdminAllowedOrigins`: exact Admin origin, for example `https://admin.example.com`.

Manual items not created by the template:

- CodeBuild source connection or source credential for your repository host.
- ACM certificates and DNS aliases for your real domains.
- Optional API Gateway custom domain.
- Initial Cognito Admin user.
- Built-in Cognito login UX for the Admin app. Until added, Admin accepts a bearer token field.

## Package And Upload The CMS API Lambda

Run from the repo root:

```powershell
npm ci
npm run build

$stage = "tmp/cms-api-lambda"
Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$stage/packages/shared/dist" | Out-Null

Copy-Item apps/cms-api/dist/* $stage -Recurse
Copy-Item packages/shared/package.json "$stage/packages/shared/package.json"
Copy-Item packages/shared/dist/* "$stage/packages/shared/dist" -Recurse

@'
{
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-codebuild": "^3.1040.0",
    "@aws-sdk/client-cognito-identity-provider": "^3.1039.0",
    "@aws-sdk/client-s3": "^3.946.0",
    "@community-site-engine/shared": "file:packages/shared",
    "@hono/node-server": "^1.19.6",
    "hono": "^4.10.6",
    "mime": "^4.1.0",
    "zod": "^4.1.12"
  }
}
'@ | Set-Content "$stage/package.json"

Push-Location $stage
npm install --omit=dev
Compress-Archive -Path * -DestinationPath ../cms-api-lambda.zip -Force
Pop-Location
```

Upload the zip to an S3 artifact bucket:

```powershell
aws s3 mb s3://YOUR_ARTIFACT_BUCKET
aws s3 cp tmp/cms-api-lambda.zip s3://YOUR_ARTIFACT_BUCKET/releases/cms-api-lambda.zip
```

Use these template parameters:

- `ApiLambdaCodeS3Bucket=YOUR_ARTIFACT_BUCKET`
- `ApiLambdaCodeS3Key=releases/cms-api-lambda.zip`

## Deploy The Stack

Example:

```powershell
aws cloudformation deploy `
  --stack-name s3cms-prod `
  --template-file infra/production.yml `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides `
    ProjectName=s3cms `
    CmsContentBucketName=my-cms-content-prod-ACCOUNTID `
    PublicSiteBucketName=my-site-origin-prod-ACCOUNTID `
    AdminSiteBucketName=my-admin-origin-prod-ACCOUNTID `
    ApiLambdaCodeS3Bucket=YOUR_ARTIFACT_BUCKET `
    ApiLambdaCodeS3Key=releases/cms-api-lambda.zip `
    CodeBuildSourceLocation=https://github.com/YOUR_ORG/YOUR_REPO.git `
    CodeBuildSourceVersion=main `
    AdminAllowedOrigins=https://admin.example.com
```

Get outputs:

```powershell
aws cloudformation describe-stacks --stack-name s3cms-prod --query "Stacks[0].Outputs"
```

## Seed CMS Content

Sync private content from the local asset root:

```powershell
aws s3 sync site-assets/content s3://CMS_CONTENT_BUCKET_FROM_OUTPUT --delete
```

If you deployed with `CmsContentPrefix`, sync to that prefix:

```powershell
aws s3 sync site-assets/content s3://CMS_CONTENT_BUCKET_FROM_OUTPUT/YOUR_PREFIX --delete
```

## Deploy The Admin App

Build Admin with the API endpoint from stack outputs:

```powershell
$env:VITE_CMS_API_URL="https://API_ID.execute-api.REGION.amazonaws.com"
npm --workspace apps/cms-admin run build
aws s3 sync apps/cms-admin/dist s3://ADMIN_SITE_BUCKET_FROM_OUTPUT --delete
```

If you use the generated CloudFront domain instead of a custom Admin domain, update `AdminAllowedOrigins` to that exact origin and update the stack.

## Build And Deploy The Public Site

Start CodeBuild:

```powershell
aws codebuild start-build --project-name CODEBUILD_PROJECT_NAME_FROM_OUTPUT
```

CodeBuild will:

1. install dependencies
2. sync CMS content from private S3 to `site-assets/content`
3. run `npm run seed:media`
4. run `npm run build:site`
5. sync `apps/site/dist` to the public-origin S3 bucket
6. invalidate the public CloudFront distribution

## Create Initial Admin User

Create a Cognito user and assign the CMS role:

```powershell
aws cognito-idp admin-create-user `
  --user-pool-id COGNITO_USER_POOL_ID_FROM_OUTPUT `
  --username admin@example.com `
  --user-attributes Name=email,Value=admin@example.com Name=email_verified,Value=true Name=name,Value="Admin" Name=custom:role,Value=admin
```

Set a permanent password:

```powershell
aws cognito-idp admin-set-user-password `
  --user-pool-id COGNITO_USER_POOL_ID_FROM_OUTPUT `
  --username admin@example.com `
  --password "REPLACE_WITH_STRONG_PASSWORD" `
  --permanent
```

## Ongoing Code Changes

For public-site code changes:

1. commit/push code to the branch configured by `CodeBuildSourceVersion`
2. start CodeBuild manually or by saving content in Admin
3. CodeBuild deploys the static site and invalidates CloudFront

For CMS API code changes:

1. run `npm run check`
2. run `npm run build`
3. repackage the Lambda zip
4. upload it under a new S3 key
5. update the CloudFormation stack parameter `ApiLambdaCodeS3Key`

For Admin app code changes:

1. set `VITE_CMS_API_URL`
2. run `npm --workspace apps/cms-admin run build`
3. sync `apps/cms-admin/dist` to the Admin S3 bucket
4. invalidate the Admin CloudFront distribution if needed

## Ongoing Content Changes

Content editors should use Admin:

1. edit page/article/event/gallery content
2. set status to `published` when ready
3. save
4. CMS API writes to S3 and starts CodeBuild
5. CodeBuild rebuilds and deploys the public static site

If editing content directly outside Admin, update `site-assets/content`, sync it to the private content bucket, and start CodeBuild.

CodeBuild uses `ConcurrentBuildLimit=1`, so overlapping builds queue in order. If many saves happen in a short period, add a debounce layer before `StartBuild`.
