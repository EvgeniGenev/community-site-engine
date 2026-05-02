# Monthly Cost Estimate

For 1,000 visits per month, expected AWS operating cost is usually under `$5/month`, excluding domain registration.

Typical components:

- CloudFront: `$0` at this traffic level.
- Public S3 origin: `$0.05-$0.25`.
- Private CMS S3 content/media: `$0.10-$1.00`, depending on images and versioning.
- Lambda CMS API: usually `$0`.
- CodeBuild static-site builds: usually `$0-$3` if builds are occasional and use small Linux compute.
- Cognito/auth, if added: usually `$0` for a small admin team.
- Route 53 hosted zone: about `$0.50/month`.
- ACM public certificate: `$0` for non-exportable public certs used with CloudFront.

Main cost risks:

- Large unoptimized images.
- Excessive S3 version history.
- Triggering many CodeBuild deployments for small edits instead of batching editorial changes.
- Accidentally exposing origin buckets directly instead of using CloudFront.
- Adding always-on compute or a managed database.
