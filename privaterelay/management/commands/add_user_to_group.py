from django.contrib.auth.models import Group, User
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Add a user (by email address) to a group (by name)"

    def add_arguments(self, parser):
        parser.add_argument("email", nargs=1)
        parser.add_argument("group", nargs=1)

    def handle(self, *args, **options):
        user = User.objects.get(email=options["email"][0])
        group = Group.objects.get(name=options["group"][0])
        group.user_set.add(user)
        print(f"Added {user} to {group}")
