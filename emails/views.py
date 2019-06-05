from django.core.exceptions import PermissionDenied
from django.shortcuts import redirect, render

from .models import RelayAddress, Messages


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
    messages = Messages.objects.filter(relay_address=relay_address)
    return render(request, 'emails/messages.html',{
        'messages': messages,
        'relay_address': relay_address
    })
