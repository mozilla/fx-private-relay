from datetime import datetime, timedelta, timezone
from django.conf import settings
from django.core.management.base import BaseCommand, CommandParser

from privaterelay.fxa_utils import get_phone_subscription_dates
from privaterelay.management.utils import (
    get_free_phone_social_accounts,
    get_phone_subscriber_social_accounts,
)
import logging

logger = logging.getLogger("events")


def sync_phone_related_dates_on_profile(group: str) -> int:
    social_accounts_with_phones = get_phone_subscriber_social_accounts()
    free_phones_social_accounts = get_free_phone_social_accounts()
    if group == "free":
        social_accounts_with_phones = free_phones_social_accounts
    if group == "both":
        social_accounts_with_phones.update(free_phones_social_accounts)

    if not settings.PHONES_ENABLED or len(social_accounts_with_phones) == 0:
        return 0

    num_updated_accounts = 0
    datetime_now = datetime.now(timezone.utc)
    for social_account in social_accounts_with_phones:
        date_subscribed_phone, start_date, end_date = get_phone_subscription_dates(
            social_account
        )
        profile = social_account.user.profile
        if (date_subscribed_phone and start_date and end_date) is None:
            # No subscription info from FxA
            if group == "subscription":
                # Unsure if social account user should have phone subscription
                logger.error(
                    "no_subscription_data_in_fxa_for_user_with_phone_subscription",
                    extra={"fxa_uid": social_account.uid},
                )
            if (
                social_account in free_phones_social_accounts
                and profile.date_phone_subscription_reset is None
            ):
                profile.date_phone_subscription_reset = datetime_now.replace(day=1)
                profile.save()
                num_updated_accounts += 1
            continue

        # User has/had a valid phone subscriptions, populate phone date fields
        profile.date_subscribed_phone = date_subscribed_phone
        profile.date_phone_subscription_start = start_date
        profile.date_phone_subscription_end = end_date
        if profile.date_phone_subscription_reset is None:
            # initialize the reset date for phone subscription users to the start of the subscription
            profile.date_phone_subscription_reset = start_date
        thirtyone_days_ago = datetime_now - timedelta(settings.MAX_DAYS_IN_MONTH)
        while profile.date_phone_subscription_reset < thirtyone_days_ago:
            profile.date_phone_subscription_reset += timedelta(
                settings.MAX_DAYS_IN_MONTH
            )
        profile.save()
        num_updated_accounts += 1
    return num_updated_accounts


class Command(BaseCommand):
    help = "Sync date_subscribed_phone, date_phone_limits_reset, date_phone_subscription_end fields on Profile by syncing with Mozilla Accounts data"

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--group",
            default="subscription",
            choices=["subscription", "free", "both"],
            help="Choose phone subscription users, free phone users, or both. Defaults to subscription users.",
        )

    def handle(self, *args, **options):
        group = options["group"]
        num_updated_accounts = sync_phone_related_dates_on_profile(group)
        self.stdout.write(f"{num_updated_accounts} updated")
