from django.shortcuts import render, redirect

from emails.models import RelayAddress


def home(request):
    if (request.user and not request.user.is_anonymous):
        return redirect('/accounts/profile/')
    return render(request, 'home.html')

def profile(request):
    if (request.user):
        relay_addresses = RelayAddress.objects.filter(user=request.user)
    return render(request, 'profile.html', {'relay_addresses': relay_addresses})
