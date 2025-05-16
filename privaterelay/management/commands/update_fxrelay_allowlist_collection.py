from django.conf import settings
from django.core.management.base import BaseCommand

import requests
from kinto_http import Client, KintoException
from kinto_http.patch_type import BasicPatch

BUCKET = settings.REMOTE_SETTINGS_BUCKET
COLLECTION = settings.REMOTE_SETTINGS_COLLECTION


class Command(BaseCommand):
    help = """
    Updates the Firefox Relay allowlist Remote Settings collection from a JSON source.
    """

    def handle(self, *args, **options):
        how_many_changes = 0

        print(f"📥 Loading new allowlist from {settings.ALLOWLIST_INPUT_URL}")
        response = requests.get(settings.ALLOWLIST_INPUT_URL, timeout=30)
        response.raise_for_status()
        new_allowlist = response.content.decode()
        new_domains = set(filter(None, new_allowlist.split("\n")))
        print(
            f"📋 Parsed {len(new_domains)} domains from {settings.ALLOWLIST_INPUT_URL}."
        )

        print(
            "📥 Getting existing domain records from "
            f"{settings.REMOTE_SETTINGS_SERVER}, "
            f"🪣 bucket {BUCKET}, 📁 collection {COLLECTION} ..."
        )
        print(f" ☁️ Connecting to {settings.REMOTE_SETTINGS_SERVER} ...")
        client = Client(
            server_url=settings.REMOTE_SETTINGS_SERVER,
            auth=settings.REMOTE_SETTINGS_AUTH,
        )
        try:
            client.server_info()
            print(" ✅ Connected to Remote Settings server successfully.")
        except Exception as e:
            self.stderr.write(f" ❌ Failed to connect to Remote Settings server: {e}")
            raise e

        print(f" 🪣 Ensuring bucket {BUCKET} exists ...")
        try:
            client.get_bucket(id=BUCKET)
            print(f" ✅ Bucket {BUCKET} already exists.")
        except KintoException:
            print(f" ❓ Bucket {BUCKET} not found. Creating...")
            try:
                client.create_bucket(id=BUCKET)
                print(f" ✅ Bucket {BUCKET} created.")
            except KintoException as e:
                self.stderr.write(f" ❌ Failed to find or create bucket: {e}")
                raise e

        print(f" 📁 Ensuring collection {COLLECTION} exists ...")
        try:
            client.get_collection(id=COLLECTION, bucket=BUCKET)
            print(f" ✅ Collection {COLLECTION} already exists.")
        except KintoException:
            print(f" ❓ Collection {COLLECTION} not found. Creating...")
            try:
                client.create_collection(id=COLLECTION, bucket=BUCKET)
                print(f" ✅ Collection {COLLECTION} created.")
            except KintoException as e:
                self.stderr.write(f" ❌ Failed to find or create collection: {e}")
                raise e

        existing_records = client.get_records(bucket=BUCKET, collection=COLLECTION)
        existing_domains = {rec["domain"] for rec in existing_records}
        print(f"📋 Found {len(existing_domains)} existing domains.")

        # Delete records:
        # 1. no longer in the domain allowlist
        # 2. where id does not match domain (to clear out older existing records)
        print("🔎 Checking for changes ...")
        for existing_record in existing_records:
            if (
                existing_record["domain"] not in new_domains
                or existing_record["domain"].replace(".", "-") != existing_record["id"]
            ):
                print(f' 🗑 removed domain: {existing_record["domain"]}')
                client.delete_record(
                    id=existing_record["id"], bucket=BUCKET, collection=COLLECTION
                )
                how_many_changes += 1

        # Add new records for new domains in allowlist
        for domain in new_domains - existing_domains:
            print(f" ✚ new domain: {domain}")
            record = {
                "domain": domain,
            }
            client.create_record(
                id=domain.replace(".", "-"),
                data=record,
                bucket=BUCKET,
                collection=COLLECTION,
            )
            how_many_changes += 1

        if how_many_changes == 0:
            print(" ⚪️ No changes found.")
            print("✅ Done.")
            return

        print(f" 📝 Made {how_many_changes} changes.")
        # Request review by updating the collection metadata
        try:
            print(f" 📤 Requesting review for collection {COLLECTION}.")
            client.patch_collection(
                id=COLLECTION,
                bucket=BUCKET,
                changes=BasicPatch({"status": "to-review"}),
            )
        except KintoException as e:
            self.stderr.write(f" ❌ Failed to request review: {e}")
            raise e
        print("✅ Done.")
