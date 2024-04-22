from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create user group."

    def add_arguments(self, parser):
        parser.add_argument("group_name", nargs=1)

    def handle(self, *args, **options):
        new_group, created = Group.objects.get_or_create(name=options["group_name"][0])
        group_details = f"{new_group.name} with Group ID: {new_group.id}."
        if created:
            self.stdout.write("SUCCESS: created " + group_details)
        else:
            self.stdout.write("SUCCESS: fetched " + group_details)
