from datetime import datetime, timedelta, timezone

from django.core.management.base import BaseCommand
from django.db import transaction

from ...models import Reply


class Command(BaseCommand):
    help = "Deletes all Reply objects older than 3 months."

    def add_arguments(self, parser):
        parser.add_argument("days_old", nargs=1, type=int)

    def handle(self, *args, **options):
        delete_date = datetime.now(timezone.utc) - timedelta(options["days_old"][0])
        replies_to_delete = Reply.objects.filter(created_at__lt=delete_date).only("id")
        print(
            f"Deleting {len(replies_to_delete)} reply records "
            f"older than {delete_date}"
        )
        with transaction.atomic():
            replies_to_delete.delete()
