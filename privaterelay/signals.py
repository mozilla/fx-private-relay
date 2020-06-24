from datetime import datetime, timezone

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.contrib.auth.models import User
from django.db.models import Q

from allauth.socialaccount.models import SocialAccount

from .models import Invitations, get_invitation


ALLOWED_SIGNUP_DOMAINS = [
    'getpocket.com', 'mozilla.com', 'mozillafoundation.org'
]


def invitations_only(sender, **kwargs):
    sociallogin = kwargs['sociallogin']
    email = sociallogin.account.extra_data['email']
    fxa_uid = sociallogin.account.extra_data['uid']

    # Mozilla domain FXA's should always be allowed
    domain_part = email.split('@')[1]
    for allowed_domain in ALLOWED_SIGNUP_DOMAINS:
        if domain_part == allowed_domain:
            return True

    # Accounts that have already used Private Relay should always be allowed
    try:
        User.objects.get(email=email)
        return True
    except User.DoesNotExist:
        pass

    try:
        social_account = SocialAccount.objects.get(uid=fxa_uid)
        social_account.user.email = social_account['email']
        social_account.user.save()
        return True
    except SocialAccount.DoesNotExist:
        pass

    # Explicit invitations for an email address can get in
    try:
        active_invitation = get_invitation(
            email=email, fxa_uid=fxa_uid, active=True
        )
        if not active_invitation.fxa_uid:
            active_invitation.fxa_uid = fxa_uid
            active_invitation.save()
        if not active_invitation.date_redeemed:
            active_invitation.date_redeemed = datetime.now(timezone.utc)
            active_invitation.save()
        return True

    except Invitations.DoesNotExist:
        waitlist_invite = = get_invitation(
            email=email, fxa_uid=fxa_uid, active=False
        )
        inactive_invitation = waitlist_invite.first()

        # Not mozilla domain; no invitation
        if settings.WAITLIST_OPEN:
            kwargs['request'].session['waitlist_open'] = True
            kwargs['request'].session['waitlist_fxa_uid'] = fxa_uid
            kwargs['request'].session['waitlist_email'] = email
            kwargs['request'].session['waitlist_avatar'] = (
                sociallogin.account.extra_data['avatar']
            )
            if inactive_invitation:
                kwargs['request'].session['already_on_waitlist'] = True
                if not inactive_invitation.fxa_uid:
                    inactive_invitation.fxa_uid = fxa_uid
                    inactive_invitation.save()
            else:
                kwargs['request'].session['already_on_waitlist'] = False
        else:
            kwargs['request'].session['waitlist_open'] = False

        # If we're not doing token-based invites; reject immediately
        if settings.ALPHA_INVITE_TOKEN:
            # Token invitations are subject to max accounts limit
            active_accounts_count = User.objects.count()
            if active_accounts_count >= settings.MAX_ACTIVE_ACCOUNTS:
                raise PermissionDenied("There are too many active accounts on "
                                       "Relay. Please try again later.")

            # Must have visited the invitation link which put the token in
            # their session
            if 'alpha_token' not in kwargs['request'].session:
                raise PermissionDenied(
                    "Private Relay is currently invite-only. "
                    "If you received an invitation email, "
                    "you must visit the invitation link in your invite email "
                    "to sign up for Relay.")

            # Check the token in their session matches the setting
            session_token = kwargs['request'].session['alpha_token']
            if (session_token == settings.ALPHA_INVITE_TOKEN):
                if inactive_invitation:
                    inactive_invitation.delete()
                Invitations.objects.create(
                    email=email, fxa_uid=fxa_uid, active=True,
                    date_redeemed=datetime.now(timezone.utc)
                )
                del kwargs['request'].session['alpha_token']
                return True

    # Deny-by-default in case the logic above missed anything
    raise PermissionDenied(
        "Private Relay is currently invite-only. "
        "Please check back again later to join the wait-list."
    )
