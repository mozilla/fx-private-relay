import json
import requests
import pathlib

from django.core.management.base import BaseCommand, CommandError

emails_folder = pathlib.Path(__file__).parents[2]
tracker_folder = emails_folder / "tracker_lists"

shavar_prod_lists_url = "https://raw.githubusercontent.com/mozilla-services/shavar-prod-lists/master/disconnect-blacklist.json"


def get_trackers(repo_url, category="Email"):
    print(f"Grabbing email tracker from: {repo_url}")
    # email tracker lists from shavar-prod-list as per agreed use under license:
    resp = requests.get(repo_url)
    json_resp = resp.json()
    formatted_trackers = json_resp["categories"][category]
    trackers = []
    for entity in formatted_trackers:
        for _, resources in entity.items():
            for _, domains in resources.items():
                trackers.extend(domains)
    return trackers


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
        tracker_list_name = "level-one-tracker"
        if tracker_level == 2:
            category = "EmailAggressive"
            tracker_list_name = "level-two-tracker"

        trackers = get_trackers(repo_url, category)
        file_name = f"{tracker_list_name}.json"

        with open(tracker_folder / file_name, "w+") as f:
            json.dump(trackers, f, indent=4)
        print(f"Added {file_name} in {tracker_folder}")
