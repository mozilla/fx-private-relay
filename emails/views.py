import json

from decouple import config
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from django.core.exceptions import PermissionDenied
from django.http import HttpResponse
from django.shortcuts import redirect, render, get_object_or_404
from django.views.decorators.csrf import csrf_exempt

from .models import RelayAddress, Message


def index(request):
    if not request.user:
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
    email_to = request.POST.get('to')
    local_portion = email_to.split('@')[0]
    from_address = request.POST.get('from')
    subject = request.POST.get('subject')
    text = request.POST.get('text')

    relay_address = get_object_or_404(RelayAddress, address=local_portion)

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
