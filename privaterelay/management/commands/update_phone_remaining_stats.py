import logging
from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from emails.models import Profile
from privaterelay.management.utils import (
    get_free_phone_social_accounts,
    get_phone_subscriber_social_accounts,
)

if settings.PHONES_ENABLED:
    from phones.models import RelayNumber

logger = logging.getLogger("events")


def reset_phone_remaining_stats(user: User) -> None:
    # re-set remaining_texts and remaining_seconds to the maximum value
    try:
        relay_number = RelayNumber.objects.get(user=user)
    except RelayNumber.DoesNotExist:
        # no RelayNumber set, do nothing
        return
    relay_number.remaining_texts = settings.MAX_TEXTS_PER_BILLING_CYCLE
    relay_number.remaining_seconds = settings.MAX_MINUTES_PER_BILLING_CYCLE * 60
    relay_number.save()


def get_next_reset_date(profile: Profile) -> datetime:
    # TODO: consider moving this as a property in Profile model
    # assumes that profile being passed have already been checked to have
    # phone subscription or a free phone user
    if profile.date_phone_subscription_reset is None:
        # there is a problem with the sync_phone_related_dates_on_profile
        # or a new foxfooder whose date_phone_subscription_reset did not get set in
        logger.error(
            "phone_user_profile_dates_not_set",
            extra={
                "fxa_uid": profile.fxa.uid,
                "date_subscribed_phone": profile.date_phone_subscription_end,
                "date_phone_subscription_start": profile.date_phone_subscription_start,
                "date_phone_subscription_reset": profile.date_phone_subscription_reset,
                "date_phone_subscription_end": profile.date_phone_subscription_end,
            },
        )
        return datetime.now(timezone.utc) - timedelta(minutes=15)

    calculated_next_reset_date = profile.date_phone_subscription_reset + timedelta(
        settings.MAX_DAYS_IN_MONTH
    )
    if profile.date_phone_subscription_end is None:
        return calculated_next_reset_date
    if profile.date_phone_subscription_end < calculated_next_reset_date:
        # return the past or the closest next reset date
        return profile.date_phone_subscription_end
    return calculated_next_reset_date


def update_phone_remaining_stats() -> tuple[int, int]:
    social_accounts_with_phones = get_phone_subscriber_social_accounts()
    free_phones_social_accounts = get_free_phone_social_accounts()
    social_accounts_with_phones.update(free_phones_social_accounts)

    if not settings.PHONES_ENABLED or len(social_accounts_with_phones) == 0:
        return 0, 0

    updated_profiles = []
    datetime_now = datetime.now(timezone.utc)
    for social_account in social_accounts_with_phones:
        profile = social_account.user.profile
        next_reset_date = get_next_reset_date(profile)
        if next_reset_date > datetime_now:
            continue
        # next reset day is now or in the past
        reset_phone_remaining_stats(profile.user)
        profile.date_phone_subscription_reset = datetime_now
        profile.save()
        updated_profiles.append(profile)
    return len(social_accounts_with_phones), len(updated_profiles)


class Command(BaseCommand):
    help = "Update all phone users' subscription and stats."

    def handle(self, *args, **options):
        num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()
        print(
            f"Out of {num_profiles_w_phones} profiles,"
            f" {num_profiles_updated} limits were reset"
        )
