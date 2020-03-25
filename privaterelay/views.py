import json
import os

from django.conf import settings
from django.db import connections
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect

from emails.models import RelayAddress


def version(request):
    # If version.json is available (from Circle job), serve that
    VERSION_JSON_PATH = os.path.join(settings.BASE_DIR, 'version.json')
    if os.path.isfile(VERSION_JSON_PATH):
        with open(VERSION_JSON_PATH) as version_file:
            return JsonResponse(json.load(version_file))

    # Generate version.json contents
    git_dir = os.path.join(settings.BASE_DIR, '.git')
    with open(os.path.join(git_dir, 'HEAD')) as head_file:
        ref = head_file.readline().split(' ')[-1].strip()

    with open(os.path.join(git_dir, ref)) as git_hash_file:
        git_hash = git_hash_file.readline().strip()

    version_data = {
        'source': 'https://github.com/groovecoder/private-relay',
        'version': git_hash,
        'commit': git_hash,
        'build': 'uri to CI build job',
    }
    return JsonResponse(version_data)


def heartbeat(request):
    db_conn = connections['default']
    c = db_conn.cursor()
    return HttpResponse('200 OK', status=200)


def lbheartbeat(request):
    return HttpResponse('200 OK', status=200)


def home(request):
    if (request.user and not request.user.is_anonymous):
        return redirect('/accounts/profile/')
    return render(request, 'home.html')


def profile(request):
    if (not request.user or request.user.is_anonymous):
        return redirect('/')
    relay_addresses = RelayAddress.objects.filter(user=request.user)
    return render(request, 'profile.html', {'relay_addresses': relay_addresses})
