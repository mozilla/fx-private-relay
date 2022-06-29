from django.core.management.base import BaseCommand

from emails.models import DomainAddress, Profile, RelayAddress


class Command(BaseCommand):
    help = (
        "Deletes description, generated_for, and used_on data of all addresses that"
        " belong to a Profile with server_storage set to False."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--delete',
            action="store_true",
            help="Delete data"
        )
        return super().add_arguments(parser)

    def handle(self, *args, **kwargs):
        if not kwargs["delete"]:
            print("Dry run. Use --delete to delete data.")

        profiles_without_server_storage = Profile.objects.filter(server_storage=False)
        num_profiles = len(profiles_without_server_storage)

        total_relay_addresses = 0
        total_domain_addresses = 0
        for profile in profiles_without_server_storage:
            relay_addresses = RelayAddress.objects.filter(user=profile.user)
            num_relay_addresses = len(relay_addresses)
            total_relay_addresses += num_relay_addresses
            if kwargs["delete"]:
                for relay_address in relay_addresses:
                    relay_address.description = ""
                    relay_address.generated_for = ""
                    relay_address.used_on = ""
                RelayAddress.objects.bulk_update(
                    relay_addresses, ["description", "generated_for", "used_on"]
                )
            domain_addresses = DomainAddress.objects.filter(user=profile.user)
            num_domain_addresses = len(domain_addresses)
            total_domain_addresses += num_domain_addresses
            if kwargs["delete"]:
                for domain_address in domain_addresses:
                    domain_address.description = ""
                    domain_address.used_on = ""
                DomainAddress.objects.bulk_update(
                    domain_addresses, ["description", "used_on"]
                )
        print(f"Total Profiles without server storage: {num_profiles}")
        print(f"Total Relay Addresses in profiles without server storage: {total_relay_addresses}")
        print(f"Total Domain Addresses in profiles without server storage: {total_domain_addresses}")
