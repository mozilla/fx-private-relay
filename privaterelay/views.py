from django.shortcuts import render

from emails.models import RelayAddress


def home(request):
    return render(request, 'home.html')

def profile(request):
    if (request.user):
        relay_addresses = RelayAddress.objects.filter(user=request.user)
    return render(request, 'profile.html', {'relay_addresses': relay_addresses})
