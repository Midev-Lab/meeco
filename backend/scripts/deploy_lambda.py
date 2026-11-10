"""Deploy (or update) the backend as an AWS Lambda function with a public Function URL.

    export AWS_PROFILE=... (or AWS credentials)   # an admin-ish identity, only needed to deploy
    export ASSEMBLYAI_API_KEY=... GROQ_API_KEY=...
    python scripts/deploy_lambda.py --bucket meeco-prod --origin https://meeco-web.onrender.com

Safe to re-run: it updates the code and settings and prints the same URL. Creates: an IAM role limited to the bucket,
the function (python3.12, 1 GB, 15 min), and a Function URL. CORS is handled by the app, so none is set on the URL.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import boto3
from botocore.exceptions import ClientError, ParamValidationError

ROOT = Path(__file__).resolve().parent.parent


def ensure_role(iam, name: str, bucket: str) -> str:
    trust = {"Version": "2012-10-17", "Statement": [{"Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"}, "Action": "sts:AssumeRole"}]}
    try:
        arn = iam.get_role(RoleName=name)["Role"]["Arn"]
        created = False
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "NoSuchEntity":
            raise
        arn = iam.create_role(RoleName=name, AssumeRolePolicyDocument=json.dumps(trust), Description="meeco API")["Role"]["Arn"]
        created = True
    iam.attach_role_policy(RoleName=name, PolicyArn="arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole")
    s3 = {"Version": "2012-10-17", "Statement": [
        {"Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": f"arn:aws:s3:::{bucket}/*"},
        {"Effect": "Allow", "Action": "s3:ListBucket", "Resource": f"arn:aws:s3:::{bucket}"}]}
    iam.put_role_policy(RoleName=name, PolicyName="meeco-bucket", PolicyDocument=json.dumps(s3))
    if created:
        time.sleep(10)  # a new role takes a few seconds to become usable by Lambda
    return arn


def wait_ready(lam, name: str) -> None:
    lam.get_waiter("function_active_v2").wait(FunctionName=name)
    lam.get_waiter("function_updated_v2").wait(FunctionName=name)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bucket", required=True)
    ap.add_argument("--origin", required=True, help="front-end origin allowed by CORS, e.g. https://meeco-web.onrender.com (comma separate several)")
    ap.add_argument("--name", default="meeco-api")
    ap.add_argument("--region", default=os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "us-east-1")
    ap.add_argument("--no-build", action="store_true")
    a = ap.parse_args()

    missing = [k for k in ("ASSEMBLYAI_API_KEY", "GROQ_API_KEY") if not os.environ.get(k)]
    if missing:
        sys.exit(f"set {', '.join(missing)} in the environment first")
    if not a.no_build:
        subprocess.run([str(ROOT / "scripts" / "build_lambda.sh")], check=True)
    code = (ROOT / "build" / "meeco-api.zip").read_bytes()

    session = boto3.Session(region_name=a.region)
    iam, lam = session.client("iam"), session.client("lambda")
    role = ensure_role(iam, f"{a.name}-role", a.bucket)
    env = {
        "STORAGE_BACKEND": "s3", "S3_BUCKET": a.bucket, "ALLOWED_ORIGINS": a.origin,
        "TRANSCRIBER": "assemblyai", "ASSEMBLYAI_API_KEY": os.environ["ASSEMBLYAI_API_KEY"],
        "LLM_PROVIDER": "groq", "GROQ_API_KEY": os.environ["GROQ_API_KEY"],
        # AWS_REGION and credentials are supplied by Lambda itself (reserved names, not set here)
    }
    cfg = dict(Runtime="python3.12", Role=role, Handler="lambda_handler.handler", Timeout=900, MemorySize=1024, Environment={"Variables": env})
    try:
        lam.get_function(FunctionName=a.name)
        lam.update_function_code(FunctionName=a.name, ZipFile=code)
        wait_ready(lam, a.name)
        lam.update_function_configuration(FunctionName=a.name, **cfg)
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ResourceNotFoundException":
            raise
        for attempt in range(6):  # IAM propagation can still reject a brand-new role for a moment
            try:
                lam.create_function(FunctionName=a.name, Code={"ZipFile": code}, Architectures=["x86_64"], **cfg)
                break
            except ClientError as e2:
                if e2.response["Error"]["Code"] != "InvalidParameterValueException" or attempt == 5:
                    raise
                time.sleep(5)
    wait_ready(lam, a.name)

    try:
        url = lam.get_function_url_config(FunctionName=a.name)["FunctionUrl"]
    except ClientError:
        url = lam.create_function_url_config(FunctionName=a.name, AuthType="NONE", InvokeMode="BUFFERED")["FunctionUrl"]
    # A public Function URL needs both permissions (the second one is required for URLs created after Oct 2025)
    for sid, kwargs in (
        ("meeco-url-public", dict(Action="lambda:InvokeFunctionUrl", FunctionUrlAuthType="NONE")),
        ("meeco-url-invoke", dict(Action="lambda:InvokeFunction", InvokedViaFunctionUrl=True)),
    ):
        try:
            lam.add_permission(FunctionName=a.name, StatementId=sid, Principal="*", **kwargs)
        except ClientError as exc:
            if exc.response["Error"]["Code"] != "ResourceConflictException":
                raise
        except ParamValidationError:
            print(f"note: this boto3 is too old to set {sid}; run `pip install -U boto3` and re-run if the URL answers 403")
    print(f"\nAPI URL: {url.rstrip('/')}\nSet VITE_API_URL to that value for the front end, and run scripts/setup_s3.py --origin <front-end URL>.")


if __name__ == "__main__":
    main()
