from django.core.validators import RegexValidator
from django.forms import (
    CharField,
    ChoiceField,
    Form,
    ModelForm,
    MultiValueField,
    MultiWidget,
    TextInput
)

from credit_cards.models import FundingSource


class SensitiveNumberMultiWidget(MultiWidget):
    """
    A Widget that splits US Phone number input into three <input type='text'> boxes.
    """
    def __init__(self,attrs=None):
        widgets = (
            TextInput(attrs={'size':'9','maxlength':'9'}),
            TextInput(attrs={'size':'12','maxlength':'12'}),
        )
        super(SensitiveNumberMultiWidget, self).__init__(widgets, attrs)

    def decompress(self, value):
        if value:
            return values.split('-')
        return (None,None)

    def value_from_datadict(self, data, files, name):
        values = super(
            SensitiveNumberMultiWidget, self
        ).value_from_datadict(data, files, name)
        return f'{values[0]}-{values[1]}'


class FundingSourceField(MultiValueField):
    def __init__(self, **kwargs):
        # Define one message for all fields.
        error_messages = {
            'incomplete': 'Check information on your check or banking site.',
        }
        # Or define a different message for each field.
        fields = (
            CharField(
                max_length=9,
                error_messages={'incomplete': 'Enter a routing number.'},
                validators=[
                    RegexValidator(
                        r'^[0-9]+$', 'Enter a valid routing number.'
                    ),
                ],
            ),
            CharField(
                max_length=12,
                error_messages={'incomplete': 'Enter an account number.'},
                validators=[
                    RegexValidator(
                        r'^[0-9]+$', 'Enter a valid account number.'
                    )
                ],
            ),
        )
        super().__init__(
            error_messages=error_messages, fields=fields,
            require_all_fields=True, **kwargs
        )

    def decompress(self, value):
        import ipdb; ipdb.set_trace()
        return value or None


class FundingSourceForm(ModelForm):
    routing_number = CharField(
        max_length=9,
        required=True,
        error_messages={'incomplete': 'Enter a routing number.'},
        validators=[
            RegexValidator(
                r'^[0-9]+$', 'Enter a valid routing number.'
            ),
        ],
    )
    account_number = CharField(
        max_length=12,
        required=True,
        error_messages={'incomplete': 'Enter an account number.'},
        validators=[
            RegexValidator(
                r'^[0-9]+$', 'Enter a valid account number.'
            )
        ],
    )
    # funding_information = FundingSourceField(
    #     widget=SensitiveNumberMultiWidget()
    # )

    class Meta:
        model = FundingSource
        fields = ['account_name', 'routing_number', 'account_number']
        field_classes = {
            'routing_number': CharField,
            'account_number': CharField,
        }

        # def save(self, commit=True, *args, **kwargs):
        #     import ipdb; ipdb.set_trace()
        #     print('Form being saved')
        #     # fs = FundingSource.make_funding_source(
        #     #     api_token, user, api_token, routing_number,
        #     #     account_number, account_name
        #     # )
        #     # fs = super(FundingSourceForm, self).save(
        #     #     commit=False, *args, **kwargs
        #     # )
        #     # results = []
        #     # for cr in self.callResult:
        #     #     for c in self.campain:
        #     #         for ct in self.callType:
        #     #             m_new = copy_model_instance(m)
        #     #             m_new.callResult = cr
        #     #             m_new.campaign = c
        #     #             m_new.calltype = ct
        #     #             if commit:
        #     #                 m_new.save()
        #     #             results.append(m_new)
        #     return None

class RelayCardForm(Form):
    card_name = CharField(
        max_length=24,
        error_messages={'incomplete': 'Something went wrong.'}
    )
    funding_source = ChoiceField(required=True)

    class Meta:
        fields = ['card_name', 'funding_source']
        field_classes = {
            'routing_number': CharField,
            'account_number': ChoiceField,
        }

    def __init__(self, choices, *args, **kwargs):
        super(RelayCardForm, self).__init__(*args, **kwargs)
        self.fields['funding_source'].choices = choices
