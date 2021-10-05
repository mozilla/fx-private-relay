from django import template

register = template.Library()

def do_notification(parser, token):
    nodelist = parser.parse(('endnotification',))
    parser.delete_first_token()
    _tag_name, level = token.split_contents()
    return NotificationNode(nodelist, level[1:-1])

class NotificationNode(template.Node):
    def __init__(self, nodelist, level):
        self.nodelist = nodelist
        self.level = 'info'
        if (level == 'warning'):
            self.level = 'warning'

    def render(self, context):
        content = self.nodelist.render(context)

        theme = 't-info'
        if (self.level == 'warning'):
            theme = 't-warning'

        # Note: the img[src] is currently root-relative; not sure how to make that use {% static %}:
        output = '''
            <div class="c-data-notification-banner js-notification {theme}">
                <div class="dismiss-wrapper">
                    <button class="data-notification-dismiss js-dismiss"><img src="/static/images/x-close.svg" alt="Close"></button>
                </div>
                <div class="data-notification-banner-bg">
                    <div class="data-notification-banner-content">
                        <div class="data-notification-banner-copy">
                            {notification_content}
                        </div>
                    </div>
                </div>
            </div>'''.format(notification_content=content, theme=theme)
        return output

register.tag('notification', do_notification)
