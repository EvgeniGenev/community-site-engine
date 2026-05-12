# AWS Deployment Runbook

Use `infra/production.yml` to create a production deployment with two required parameters:

- `SiteName`: short lowercase site name, for example `bhcaz`.
- `AdminEmail`: email address for the first Cognito admin user.

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
5. Cognito user pool, app client, hosted UI domain, and initial admin user.
6. Placeholder CMS API Lambda and HTTP API Gateway.
7. Optional asset seeder for `AssetsZipS3Uri`.
8. CodeBuild project.
9. Initial deployment runner that starts the first CodeBuild deployment.

The initial CodeBuild run clones:

```text
https://github.com/EvgeniGenev/community-site-engine.git
```

The repository must be publicly readable, or CodeBuild must be configured in your AWS account with GitHub access before deployment.

The initial admin user receives a Cognito invitation email with a temporary password. Use that account to sign in to the Admin app after the initial CodeBuild deployment finishes.

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

## Deployment IAM Policy

Attach [deployment-user-policy.json](../infra/deployment-user-policy.json) to the IAM user or role that performs the CloudFormation deployment.

Create and attach as a managed policy:

```powershell
aws iam create-policy `
  --policy-name CommunitySiteEngineDeploymentPolicy `
  --policy-document file://infra/deployment-user-policy.json

aws iam attach-user-policy `
  --user-name YOUR_DEPLOYMENT_IAM_USER `
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/CommunitySiteEngineDeploymentPolicy
```

This policy grants broad access to only the AWS services used by the template and bootstrap build: CloudFormation, S3, CloudFront, Cognito, Lambda, API Gateway, CodeBuild, CloudWatch Logs, IAM, and STS caller identity. It includes full IAM access because the template creates named roles, inline policies, service-role trust policies, and passes roles to Lambda and CodeBuild.

After deployment is stable, use a separate lower-privilege operator role for routine content work. Content editors should use the Admin app, not AWS IAM.

Generic example deployment:

```powershell
aws cloudformation deploy `
  --stack-name bhcaz-prod `
  --template-file infra/production.yml `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides SiteName=bhcaz AdminEmail=admin@example.com
```

Deployment with private asset zip:

```powershell
aws cloudformation deploy `
  --stack-name bhcaz-prod `
  --template-file infra/production.yml `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides `
    SiteName=bhcaz `
    AdminEmail=admin@example.com `
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
- `CognitoHostedUiDomain`
- `CodeBuildProjectName`

The CloudFormation stack starts the initial CodeBuild deployment but does not wait for the full build to finish. After stack creation completes, check the CodeBuild build status before opening the public site or Admin app.

```powershell
aws codebuild list-builds-for-project --project-name CODEBUILD_PROJECT_NAME_FROM_OUTPUT
```

## Initial Admin User

CloudFormation creates the first Cognito admin user from `AdminEmail` and assigns `custom:role=admin`.

Cognito sends that user an invitation email with a temporary password. On first sign-in, Cognito will require the password to be changed.

To add more users later, sign in to Admin and use the Users screen.

## Production Security & Authentication

When transitioning from local development to production with AWS Cognito, the CMS API enforces a rigorous security architecture:

1. **Strict Disablement of Dev Tokens:** Setting `CMS_ALLOW_DEV_TOKENS=false` in the backend API deployment configuration guarantees that fallback credentials (e.g., `dev-admin-token`) are completely rejected.
2. **Cognito JWT Verification Engine:** The API cryptographically authenticates RS256 token signatures against dynamically fetched AWS Cognito public JWKS sets, validating token usage, audience alignment, and expiry timestamps.
3. **Role Mapping via Custom Attributes:** Users are assigned authorization levels via the `custom:role` string attribute (`admin`, `designer`, or `contributor`). Self-registration or arbitrary attribute updates are strictly forbidden to prevent privilege escalation.
4. **Route Authorization Matrix Middleware:** Every protected endpoint validates access using a strict role check matrix before modifying disk/S3 storage or triggering CodeBuild:
   - **Admin:** Unlimited control across all API routes.
   - **Designer:** Full structural and content access (`read`, `writeContent`, `writeStructure`, `delete`, `media`), blocked from global configuration (`settings`).
   - **Contributor:** Dedicated content editing capabilities (`read`, `writeContent`, `delete`, `media`), blocked from editing layout components (`writeStructure`) or site settings.
5. **Origin Restrictions:** Overriding permissive local CORS headers by explicitly setting `ADMIN_ALLOWED_ORIGINS` to the authenticated production Admin SPA domain blocks malicious cross-origin requests.

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
