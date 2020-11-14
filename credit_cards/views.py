from django.http import HttpResponse
from django.shortcuts import redirect
from django.views.decorators.csrf import csrf_exempt

from credit_cards.models import FundingSource
from credit_cards.forms import FundingSourceForm, RelayCardForm


@csrf_exempt
def index(request):
    if request.method == 'POST':
        # Create a form instance and populate it with data from the request (binding):
        funding_sources = FundingSource.objects.filter(
            user=request.user
        ).values_list('token_uuid', 'account_name').order_by('account_name')
        form = RelayCardForm(choices=funding_sources, data=request.POST)
        # Check if the form is valid:
        if form.is_valid():
            # process the data in form.cleaned_data as required (here we just write it to the model due_back field)
            data = form.cleaned_data
            cc = FundingSource.make_credit_card(
                memo=data['card_name'], token_uuid=data['funding_source'])
            # redirect to a new URL:
            # return HttpResponse(status=201)
        if 'moz-extension' in request.headers.get('Origin', ''):
            memo = ''
            import ipdb; ipdb.set_trace()
            cc = FundingSource.make_credit_card(
                memo=memo, token_uuid='708bf7a3-7c86-48b7-990d-a20f44afda28'
            )
            return JsonResponse({
                'id': 'test',
                'address': cc['pan']
            }, status=201)
    return redirect('profile')

def funding_source(request):
    # If this is a POST request then process the Form data
    if request.method == 'POST':
        # Create a form instance and populate it with data from the request (binding):
        form = FundingSourceForm(request.POST)

        # Check if the form is valid:
        if form.is_valid():
            # process the data in form.cleaned_data as required (here we just write it to the model due_back field)
            data = form.cleaned_data
            fs = FundingSource.make_funding_source(
                user=request.user,
                routing_number=data['routing_number'],
                account_number=data['account_number'],
                account_name=data['account_name'],
            )
            # redirect to a new URL:
            # return HttpResponse(status=201)
    return redirect('profile')

#
# @csrf_exempt
# def index(request):
#     incr_if_enabled('emails_index', 1)
#     request_data = get_post_data_from_request(request)
#     is_validated_create = (
#         request_data.get('method_override', None) is None and
#         request_data.get("api_token", False)
#     )
#     is_validated_user = (
#         request.user.is_authenticated and
#         request_data.get("api_token", False)
#     )
#     if is_validated_create:
#         return _index_POST(request)
#     if not is_validated_user:
#         return redirect('profile')
#     if request.method == 'POST':
#         return _index_POST(request)
#     incr_if_enabled('emails_index_get', 1)
#     return redirect('profile')
#
#
# def _get_user_profile(request, api_token):
#     if not request.user.is_authenticated:
#         return Profile.objects.get(api_token=api_token)
#     return request.user.profile_set.first()
#
#
# def _index_POST(request):
#     request_data = get_post_data_from_request(request)
#     api_token = request_data.get('api_token', None)
#     if not api_token:
#         raise PermissionDenied
#     user_profile = _get_user_profile(request, api_token)
#     if request_data.get('method_override', None) == 'PUT':
#         return _index_PUT(request_data, user_profile)
#     if request_data.get('method_override', None) == 'DELETE':
#         return _index_DELETE(request_data, user_profile)
#
#     incr_if_enabled('emails_index_post', 1)
#
#     with transaction.atomic():
#         locked_profile = Profile.objects.select_for_update().get(
#             user=user_profile.user
#         )
#         if locked_profile.num_active_address >= settings.MAX_NUM_BETA_ALIASES:
#             if 'moz-extension' in request.headers.get('Origin', ''):
#                 return HttpResponse('Payment Required', status=402)
#             messages.error(
#                 request, "You already have 5 email addresses. Please upgrade."
#             )
#             return redirect('profile')
#         relay_address = RelayAddress.make_relay_address(locked_profile.user)
#
#     if 'moz-extension' in request.headers.get('Origin', ''):
#         address_string = '%s@%s' % (
#             relay_address.address, relay_from_domain(request)['RELAY_DOMAIN']
#         )
#         return JsonResponse({
#             'id': relay_address.id,
#             'address': address_string
#         }, status=201)
#
#     return redirect('profile')
#
#
# def _get_relay_address_from_id(request_data, user_profile):
#     try:
#         relay_address = RelayAddress.objects.get(
#             id=request_data['relay_address_id'],
#             user=user_profile.user
#         )
#         return relay_address
#     except RelayAddress.DoesNotExist:
#         return HttpResponse("Address does not exist")
#
#
# def _index_PUT(request_data, user_profile):
#     incr_if_enabled('emails_index_put', 1)
#     relay_address = _get_relay_address_from_id(request_data, user_profile)
#     if not isinstance(relay_address, RelayAddress):
#         return relay_address
#     if request_data.get('enabled') == 'Disable':
#         # TODO?: create a soft bounce receipt rule for the address?
#         relay_address.enabled = False
#     elif request_data.get('enabled') == 'Enable':
#         # TODO?: remove soft bounce receipt rule for the address?
#         relay_address.enabled = True
#     relay_address.save()
#
#     forwardingStatus = {'enabled': relay_address.enabled}
#     return JsonResponse(forwardingStatus)
#
#
# def _index_DELETE(request_data, user_profile):
#     incr_if_enabled('emails_index_delete', 1)
#     relay_address = _get_relay_address_from_id(request_data, user_profile)
#     if isinstance(relay_address, RelayAddress):
#         # TODO?: create hard bounce receipt rule for the address
#         relay_address.delete()
#     return redirect('profile')
#
#
# @csrf_exempt
# def sns_inbound(request):
#     incr_if_enabled('sns_inbound', 1)
#     # We can check for some invalid values in headers before processing body
#     # Grabs message information for validation
#     topic_arn = request.headers.get('X-Amz-Sns-Topic-Arn', None)
#     message_type = request.headers.get('X-Amz-Sns-Message-Type', None)
#
#     # Validates header
#     validate_sns_header(topic_arn, message_type)
#
#     json_body = json.loads(request.body)
#     verified_json_body = verify_from_sns(json_body)
#
#     return _sns_inbound_logic(topic_arn, message_type, verified_json_body)
#
#
# def validate_sns_header(topic_arn, message_type):
#     if not topic_arn:
#         logger.error('SNS inbound request without X-Amz-Sns-Topic-Arn')
#         return HttpResponse(
#             'Received SNS request without Topic ARN.', status=400
#         )
#     if topic_arn != settings.AWS_SNS_TOPIC:
#         logger.error(
#             'SNS message for wrong ARN',
#             extra={
#                 'configured_arn': settings.AWS_SNS_TOPIC,
#                 'received_arn': topic_arn,
#             }
#         )
#         return HttpResponse(
#             'Received SNS message for wrong topic.', status=400
#         )
#
#     if not message_type:
#         logger.error('SNS inbound request without X-Amz-Sns-Message-Type')
#         return HttpResponse(
#             'Received SNS request without Message Type.', status=400
#         )
#     if message_type not in SUPPORTED_SNS_TYPES:
#         logger.error(
#             'SNS message for unsupported type',
#             extra={
#                 'supported_sns_types': SUPPORTED_SNS_TYPES,
#                 'message_type': message_type,
#             }
#         )
#         return HttpResponse(
#             'Received SNS message for unsupported Type: %s' % message_type,
#             status=400
#         )
