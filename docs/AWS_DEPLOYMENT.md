# AWS Deployment Runbook

Use `infra/production.yml` to create a production deployment with one required parameter:

- `SiteName`: short lowercase site name, for example `bhcaz`.

Optional parameter:

- `AssetsZipS3Uri`: an `s3://bucket/key.zip` URI for private site content/assets. Leave blank to deploy the generic example content from `examples/site-assets`.

## What The Stack Creates

Resource names follow this pattern where AWS supports explicit names:

```text
site-name-resource-type-region-account
```

The stack creates resources in this order:

1. Private S3 content bucket for CMS JSON/media.
2. Private S3 public-site origin bucket.
3. Private S3 Admin app origin bucket.
4. CloudFront origin access controls, distributions, and bucket policies.
5. Cognito user pool and app client.
6. Placeholder CMS API Lambda and HTTP API Gateway.
7. Optional asset seeder for `AssetsZipS3Uri`.
8. CodeBuild project.
9. Initial deployment runner that builds and deploys API, Admin, and public site.

The initial CodeBuild run clones:

```text
https://github.com/EvgeniGenev/community-site-engine.git
```

The repository must be publicly readable, or CodeBuild must be configured in your AWS account with GitHub access before deployment.

## Optional BHCAZ Asset Zip

If deploying real BHCAZ content, create a zip from your private local asset directory. The zip may contain either `content/...`, `site-assets/content/...`, or the content folders directly at the root.

Example:

```powershell
Compress-Archive -Path site-assets/content -DestinationPath bhcaz-assets.zip -Force
```

Upload it to an S3 bucket you control:

```powershell
aws s3 mb s3://bhcaz-deployment-artifacts-ACCOUNT-REGION
aws s3 cp bhcaz-assets.zip s3://bhcaz-deployment-artifacts-ACCOUNT-REGION/bhcaz-assets.zip
```

Use this as `AssetsZipS3Uri`:

```text
s3://bhcaz-deployment-artifacts-ACCOUNT-REGION/bhcaz-assets.zip
```

If `AssetsZipS3Uri` is blank, the stack seeds the CMS content bucket from tracked generic example assets.

## Deploy The Stack

Generic example deployment:

```powershell
aws cloudformation deploy `
  --stack-name bhcaz-prod `
  --template-file infra/production.yml `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides SiteName=bhcaz
```

Deployment with private asset zip:

```powershell
aws cloudformation deploy `
  --stack-name bhcaz-prod `
  --template-file infra/production.yml `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides `
    SiteName=bhcaz `
    AssetsZipS3Uri=s3://bhcaz-deployment-artifacts-ACCOUNT-REGION/bhcaz-assets.zip
```

Get outputs:

```powershell
aws cloudformation describe-stacks `
  --stack-name bhcaz-prod `
  --query "Stacks[0].Outputs"
```

Important outputs:

- `PublicSiteCloudFrontDomain`
- `AdminSiteCloudFrontDomain`
- `ApiEndpoint`
- `CmsContentBucket`
- `CognitoUserPoolId`
- `CognitoAppClientId`
- `CodeBuildProjectName`

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

For code changes:

1. Commit and push to `main`.
2. Start CodeBuild manually, or save published content in Admin to trigger a build.
3. CodeBuild rebuilds the CMS API package, Admin app, and public static site.
4. CodeBuild syncs the Admin and public site buckets and invalidates CloudFront.

Manual build command:

```powershell
aws codebuild start-build --project-name CODEBUILD_PROJECT_NAME_FROM_OUTPUT
```

## Ongoing Content Changes

Preferred path:

1. Use Admin to edit pages, articles, events, gallery, menu, settings, and CSS.
2. Set content to `published` when ready.
3. Save.
4. CMS API writes JSON/media to the private content S3 bucket and starts CodeBuild.
5. CodeBuild rebuilds and publishes the static site.

Direct S3 path:

```powershell
aws s3 sync site-assets/content s3://CMS_CONTENT_BUCKET_FROM_OUTPUT --delete
aws codebuild start-build --project-name CODEBUILD_PROJECT_NAME_FROM_OUTPUT
```

CodeBuild uses `ConcurrentBuildLimit=1`, so overlapping builds queue in order.
