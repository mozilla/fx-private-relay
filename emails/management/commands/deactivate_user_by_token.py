from django.core.management.base import BaseCommand, CommandError

from ...models import Profile


class Command(BaseCommand):
    help = 'Removes an API token to effectively block access.'

    def add_arguments(self, parser):
        parser.add_argument('api_token', nargs=1)

    def handle(self, *args, **options):
        try:
            profile = Profile.objects.get(api_token=options['api_token'][0])
            profile.user.is_active = False
            profile.user.save()
            self.stdout.write("SUCCESS: deactivated user.")
        except Profile.DoesNotExist:
            self.stdout.write("ERROR: Could not find user with that token.")
