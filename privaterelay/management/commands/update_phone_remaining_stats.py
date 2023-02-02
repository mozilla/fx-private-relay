from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.core.management.base import BaseCommand

from allauth.socialaccount.models import SocialAccount
from waffle.models import Flag

from privaterelay.fxa_utils import (
    get_phone_subscription_dates,
)
from privaterelay.views import update_fxa

if settings.PHONES_ENABLED:
    from phones.models import RelayNumber


def reset_phone_remaining_stats(user):
    # re-set remaining_texts and remaining_seconds to the maximum value
    try:
        relay_number = RelayNumber.objects.get(user=user)
    except RelayNumber.DoesNotExist:
        # no RelayNumber set, do nothing
        return
    relay_number.remaining_texts = settings.MAX_TEXTS_PER_BILLING_CYCLE
    relay_number.remaining_seconds = settings.MAX_MINUTES_PER_BILLING_CYCLE * 60
    relay_number.save()


def update_phone_remaining_stats() -> tuple[int, int]:
    if not settings.PHONES_ENABLED:
        return 0, 0
    accounts_with_phones = []
    for sub_with_phone in settings.SUBSCRIPTIONS_WITH_PHONE:
        social_accounts = SocialAccount.objects.filter(
            extra_data__icontains=sub_with_phone
        )
        accounts_with_phones.extend(list(social_accounts))

    updated_profiles = []
    free_phones_flag = Flag.objects.filter(name="free_phones").first()
    for social_account in accounts_with_phones:
        profile = social_account.user.profile
        date_subscribed_phone, start_date, end_date = get_phone_subscription_dates(
            social_account
        )
        datetime_now = datetime.now(timezone.utc)
        if not (date_subscribed_phone and start_date and end_date):
            if free_phones_flag and free_phones_flag.is_active_for_user(profile.user):
                if profile.date_phone_subscription_checked is None:
                    profile.date_phone_subscription_checked = datetime_now
                profile.save()
                days_until_end_date = (
                    datetime_now - profile.date_phone_subscription_checked
                ).days
            else:
                continue
        else:
            days_until_end_date = (end_date - start_date).days

        max_num_of_days = 31
        if profile.date_subscribed_phone is None:
            profile.date_subscribed_phone = date_subscribed_phone
        # subscription could have changed, update end date
        profile.date_phone_subscription_end = end_date
        profile.save()

        # Re-fetch all FXA data into profile so we can see if the user still has
        # a phone subscription.
        update_fxa(social_account)
        profile.refresh_from_db()
        if end_date < datetime_now:
            if profile.has_phone:
                reset_phone_remaining_stats(profile.user)
                profile.date_phone_subscription_checked = datetime_now
                updated_profiles.append(profile)
        elif days_until_end_date > max_num_of_days:
            # could be an yearly date use the date_phone_subscription_checked value
            reset_limits = False
            if profile.date_phone_subscription_checked is None:
                # first time phone subscription is checked for the yearly subscription
                profile.date_phone_subscription_checked = date_subscribed_phone
            next_time_subscription_should_be_checked = (
                profile.date_phone_subscription_checked
                + timedelta(settings.DAYS_PER_BILLING_CYCLE)
            )
            if next_time_subscription_should_be_checked <= datetime_now:
                if profile.has_phone:
                    reset_phone_remaining_stats(profile.user)
                    profile.date_phone_subscription_checked = datetime_now
                    updated_profiles.append(profile)
        profile.save()
    return len(accounts_with_phones), len(updated_profiles)


class Command(BaseCommand):
    help = "Update all phone users' subscription and stats."

    def handle(self, *args, **options):
        num_profiles_w_phones, num_profiles_updated = update_phone_remaining_stats()
        print(
            f"Out of {num_profiles_w_phones} profiles, {num_profiles_updated} limits were reset"
        )
