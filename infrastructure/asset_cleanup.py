"""Recoverable collection of managed assets; unknown/live inventories fail closed."""

import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from urllib.request import urlopen


def retention_expired(receipt, revision, now):
    if receipt["state"] not in ("deployed", "pending"):
        raise ValueError("Unknown release state; collection deferred")
    created = datetime.fromisoformat(receipt["created"].replace("Z", "+00:00"))
    retention = 30 if receipt["state"] == "deployed" else 7
    return receipt["revision"] != revision and now - created > timedelta(days=retention)


def inventory_keys(manifest):
    if manifest["schemaVersion"] != 1:
        raise ValueError("Unknown asset inventory")
    keys = set()
    for record in manifest["sources"].values():
        keys.add(record["key"])
        if record.get("publicKey"):
            keys.add("published/" + record["publicKey"])
    for record in manifest["outputs"].values():
        keys.add("published/" + record["key"])
    keys.update("published/media/" + name for name in manifest["legacy"])
    for key in keys:
        if not re.fullmatch(
            r"(?:originals|published/media|published/sources)/[a-zA-Z0-9][a-zA-Z0-9._-]*", key
        ):
            raise ValueError("Invalid inventory key; collection deferred")
    return keys


def protected_keys(receipts, revision, now):
    """Protect live, thirty-day rollbacks and seven-day pending releases."""
    if not any(record["revision"] == revision for record in receipts):
        raise ValueError("Live deployment has no asset inventory; collection deferred")
    keys = set()
    for receipt in receipts:
        inventory = inventory_keys(receipt["manifest"])
        if not retention_expired(receipt, revision, now):
            keys.update(inventory)
    return keys


def unused_action(key, tags, keep, now):
    """Mark first, then give abandoned objects seven days before soft deletion."""
    if key in keep:
        return "restore" if "asset-unused-since" in tags else "keep"
    if "asset-unused-since" not in tags:
        return "mark"
    since = datetime.fromisoformat(tags["asset-unused-since"].replace("Z", "+00:00"))
    return "quarantine" if now - since >= timedelta(days=7) else "keep"


def objects(client, bucket, prefix):
    for page in client.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        yield from page.get("Contents", [])


def collect(client, bucket, keep, now, dry_run):
    counts = {"mark": 0, "restore": 0, "quarantine": 0}
    for prefix in ("originals/", "published/media/", "published/sources/"):
        for item in objects(client, bucket, prefix):
            key = item["Key"]
            result = client.get_object_tagging(Bucket=bucket, Key=key)
            tags = {tag["Key"]: tag["Value"] for tag in result["TagSet"]}
            if tags.get("asset-managed") != "v1":
                continue
            action = unused_action(key, tags, keep, now)
            if action == "keep":
                continue
            counts[action] += 1
            if dry_run:
                continue
            if action == "quarantine":
                head = client.head_object(Bucket=bucket, Key=key)
                if not head.get("VersionId"):
                    raise ValueError("Versioning is required for recoverable deletion")
                record = {"key": key, "versionId": head["VersionId"], "removed": now.isoformat()}
                client.put_object(
                    Bucket=bucket,
                    Key="asset-trash/" + uuid.uuid4().hex + ".json",
                    Body=json.dumps(record).encode(),
                    ContentType="application/json",
                )
                client.delete_object(Bucket=bucket, Key=key, IfMatch=head["ETag"])
            else:
                if action == "mark":
                    tags["asset-unused-since"] = now.isoformat()
                else:
                    del tags["asset-unused-since"]
                client.put_object_tagging(
                    Bucket=bucket,
                    Key=key,
                    Tagging={"TagSet": [{"Key": k, "Value": v} for k, v in tags.items()]},
                )
    return counts


def acquire_lease(client, bucket, now):
    key = "asset-control/lease.json"
    body = json.dumps(
        {"owner": uuid.uuid4().hex, "expires": (now + timedelta(hours=1)).isoformat()}
    ).encode()
    try:
        return client.put_object(Bucket=bucket, Key=key, Body=body, IfNoneMatch="*")
    except Exception as error:
        if getattr(error, "response", {}).get("ResponseMetadata", {}).get("HTTPStatusCode") != 412:
            raise
    old = client.get_object(Bucket=bucket, Key=key)
    lease = json.loads(old["Body"].read())
    if datetime.fromisoformat(lease["expires"].replace("Z", "+00:00")) > now:
        return None
    return client.put_object(Bucket=bucket, Key=key, Body=body, IfMatch=old["ETag"])


def handler(event, _context):
    import boto3  # AWS Lambda supplies the SDK; no local credentials are bundled.

    client = boto3.client("s3")
    bucket = os.environ["ASSET_BUCKET"]
    now = datetime.now(timezone.utc)  # noqa: UP017 -- Amplify's test runtime is Python 3.10.
    lease_key = "asset-control/lease.json"
    lock = acquire_lease(client, bucket, now)
    if lock is None:
        return {"deferred": "Asset release/cleanup holds the lease"}
    try:
        with urlopen(os.environ["DEPLOYMENT_MARKER"], timeout=15) as response:
            revision = json.load(response)["revision"]
        receipts = []
        receipt_objects = []
        for item in objects(client, bucket, "asset-releases/"):
            record = client.get_object(Bucket=bucket, Key=item["Key"])
            receipt = json.loads(record["Body"].read())
            receipts.append(receipt)
            receipt_objects.append((item["Key"], record["ETag"], receipt))
        keep = protected_keys(receipts, revision, now)
        dry_run = event.get("dryRun", False)
        result = collect(client, bucket, keep, now, dry_run)
        result["expiredInventories"] = 0
        for key, etag, receipt in receipt_objects:
            if retention_expired(receipt, revision, now):
                result["expiredInventories"] += 1
                if not dry_run:
                    client.delete_object(Bucket=bucket, Key=key, IfMatch=etag)
        return result
    finally:
        client.delete_object(Bucket=bucket, Key=lease_key, IfMatch=lock["ETag"])
