import json

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
    print('email_to: %s' % email_to)
    local_portion = email_to.split('@')[0]
    print('local_portion: %s' % local_portion)
    relay_address = get_object_or_404(RelayAddress, address=local_portion)
    print('relay_address: %s' % relay_address)
    from_address = request.POST.get('from')
    print('from_address: %s' % from_address)
    subject = request.POST.get('subject')
    print('subject: %s' % subject)
    text = request.POST.get('text')
    print('text: %s' % text)

    message = Message.objects.create(
        relay_address=relay_address,
        from_address=from_address,
        subject=subject,
        message=text
    )
    return HttpResponse(message)
