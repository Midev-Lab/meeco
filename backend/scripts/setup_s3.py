"""One-time S3 setup: browser upload CORS + 1-day expiry for audio.

    python scripts/setup_s3.py --bucket meeco-prod --origin https://meeco.onrender.com

Needs AWS credentials in the environment. Transcripts (transcripts/, sessions/) are kept; only audio/ expires.
S3 lifecycle is day-granular: objects are removed 1 to 2 days after upload, not at the 24 h mark exactly.
"""
import argparse

import boto3


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bucket", required=True)
    ap.add_argument("--origin", action="append", required=True, help="front-end origin; repeat for several")
    ap.add_argument("--region", default=None)
    a = ap.parse_args()
    s3 = boto3.client("s3", region_name=a.region)
    s3.put_bucket_cors(
        Bucket=a.bucket,
        CORSConfiguration={"CORSRules": [{
            "AllowedMethods": ["PUT"], "AllowedOrigins": a.origin, "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600,
        }]},
    )
    s3.put_bucket_lifecycle_configuration(
        Bucket=a.bucket,
        LifecycleConfiguration={"Rules": [{
            "ID": "expire-audio-after-1-day", "Status": "Enabled", "Filter": {"Prefix": "audio/"},
            "Expiration": {"Days": 1}, "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 1},
        }]},
    )
    s3.put_public_access_block(Bucket=a.bucket, PublicAccessBlockConfiguration={
        "BlockPublicAcls": True, "IgnorePublicAcls": True, "BlockPublicPolicy": True, "RestrictPublicBuckets": True})
    print("CORS, 1-day audio expiry and public-access block applied to", a.bucket)


if __name__ == "__main__":
    main()
