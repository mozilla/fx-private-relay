import pathlib

from django.core.management.base import BaseCommand

from emails.utils import download_trackers, shavar_prod_lists_url, store_trackers

EMAILS_FOLDER_PATH = pathlib.Path(__file__).parents[2]
TRACKER_FOLDER_PATH = EMAILS_FOLDER_PATH / "tracker_lists"


class Command(BaseCommand):
    help = "Fetch and store email tracker lists from Shavar Prod List repository"

    def add_arguments(self, parser):
        parser.add_argument(
            "--repo-url",
            default=shavar_prod_lists_url,
            help="Set url that the email tracker lists will be pulled from",
        )
        parser.add_argument(
            "--tracker-level",
            default=1,
            type=int,
            choices=[1, 2],
            help="Choose the level of tracker list desired",
        )

    def handle(self, *args, **options):
        repo_url = options["repo_url"]
        tracker_level = options["tracker_level"]

        category = "Email"
        tracker_list_name = "level-one-trackers"
        if tracker_level == 2:
            category = "EmailAggressive"
            tracker_list_name = "level-two-trackers"

        trackers = download_trackers(repo_url, category)
        file_name = f"{tracker_list_name}.json"

        store_trackers(trackers, TRACKER_FOLDER_PATH, file_name)
        print(f"Added {file_name} in {TRACKER_FOLDER_PATH}")
