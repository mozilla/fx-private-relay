from django.conf import settings
from django.core.management.base import BaseCommand

from kinto_http import Client, KintoException
import requests

BUCKET = settings.KINTO_BUCKET
COLLECTION = settings.KINTO_COLLECTION


class Command(BaseCommand):
    help = "Updates the Firefox Relay allowlist Kinto collection from a JSON source."

    def handle(self, *args, **options):
        print(f"Connecting to ☁️ {settings.KINTO_SERVER}...")
        client = Client(server_url=settings.KINTO_SERVER, auth=settings.KINTO_AUTH_TOKEN)
        try:
            client.server_info()
            print("Connected to Kinto server successfully.")
        except Exception as e:
            self.stderr.write(f"❌ Failed to connect to Kinto server: {e}")
            return

        print(f"Ensuring 🪣 bucket {BUCKET} exists.")
        try:
            client.get_bucket(id=BUCKET)
            print(f"Bucket {BUCKET} already exists.")
        except KintoException:
            print(f"Bucket {BUCKET} not found. Creating...")
            try:
                client.create_bucket(id=BUCKET)
                print(f"Bucket {BUCKET} created.")
            except KintoException as e:
                self.stderr.write(f"❌ Failed to find or create bucket: {e}")
                return

        print(f"Ensuring 📁 collection {COLLECTION} exists.")
        try:
            client.get_collection(id=COLLECTION, bucket=BUCKET)
            print(f"Collection {COLLECTION} already exists.")
        except KintoException:
            print(f"Collection {COLLECTION} not found. Creating...")
            try:
                client.create_collection(id=COLLECTION, bucket=BUCKET)
                print(f"Collection {COLLECTION} created.")
            except KintoException as e:
                self.stderr.write(f"❌ Failed to find or create collection: {e}")
                return

        print(f"Loading new allowlist from 🌐 {settings.ALLOWLIST_JSON_INPUT_URL}.")
        response = requests.get(settings.ALLOWLIST_JSON_INPUT_URL)
        response.raise_for_status()
        new_allowlist = response.content.decode()

        new_domains = set(filter(None, new_allowlist.split("\n")))
        print(f"Parsed {len(new_domains)} from {settings.ALLOWLIST_JSON_INPUT_URL}.")

        print(f"Getting existing domain records from ☁️ {settings.KINTO_SERVER}, 🪣 bucket {BUCKET}, 📁 collection {COLLECTION}")
        existing_records = client.get_records(bucket=BUCKET, collection=COLLECTION)
        existing_domains = {rec['domain'] for rec in existing_records}
        print(f"Found {len(existing_domains)} existing domains.")

        # Delete records no longer in the domain allowlist
        for existing_record in existing_records:
            if existing_record["domain"] not in new_domains:
                print(f'🗑 removed domain: {existing_record["domain"]}')
                client.delete_record(id=existing_record["id"], bucket=BUCKET, collection=COLLECTION)


        # Add new records for new domains in allowlist
        for domain in new_domains:
            if domain not in existing_domains:
                print(f"✚ new domain: {domain}")
                record = {
                    "domain": domain,
                }
                client.create_record(data=record, bucket=BUCKET, collection=COLLECTION)

        print("Allowlist synchronized 🔄 successfully. ✅")
