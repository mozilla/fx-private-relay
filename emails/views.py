from email.utils import parseaddr
import json

from decouple import config
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from django.core.exceptions import PermissionDenied
from django.http import HttpResponse
from django.shortcuts import redirect, render, get_object_or_404
from django.views.decorators.csrf import csrf_exempt

from .models import RelayAddress, Message


@csrf_exempt
def index(request):
    if not request.user:
        raise PermissionDenied
    user_profile = request.user.profile_set.first()
    if not request.POST['api_token']:
        raise PermissionDenied
    if not str(request.POST['api_token']) == str(user_profile.api_token):
        raise PermissionDenied
    RelayAddress.objects.create(user=request.user)
    return redirect('profile')


def messages(request):
    if not request.user:
        raise PermissionDenied
    relay_address_id = request.GET.get('relay_address_id', False)
    if not relay_address_id:
        raise Http404("Relay address not found")
    relay_address = RelayAddress.objects.get(id=relay_address_id)
    if relay_address.user != request.user:
        raise PermissionDenied
    messages = Message.objects.filter(relay_address=relay_address)
    return render(request, 'emails/messages.html',{
        'messages': messages,
        'relay_address': relay_address
    })


@csrf_exempt
def inbound(request):
    email_to = parseaddr(request.POST.get('to'))[1]
    local_portion = email_to.split('@')[0]
    from_address = parseaddr(request.POST.get('from'))[1]
    subject = request.POST.get('subject')
    text = request.POST.get('text')
    print("email_to: %s" % email_to)
    print("from_address: %s" % from_address)

    # 404s make sendgrid retry the email, so respond with 200 even if
    # the address isn't found
    try:
        relay_address = RelayAddress.objects.get(address=local_portion)
    except RelayAddress.DoesNotExist as e:
        print(e)
        return HttpResponse("Address does not exist")

    # Store in local DB
    message = Message.objects.create(
        relay_address=relay_address,
        from_address=from_address,
        subject=subject,
        message=text
    )

    # Forward to real email address
    try:
        message = Mail(
            from_email='inbound@privaterelay.groovecoder.com',
            to_emails=relay_address.user.email,
            subject='Forwarding email from %s sent to %s' % (
                from_address, local_portion
            ),
            html_content=text
        )
        sendgrid_client = SendGridAPIClient(config('SENDGRID_API_KEY'))
        response = sendgrid_client.send(message)
        print(response)
    except Exception as e:
        print(e.message)

    return HttpResponse(message)
