# Backend Development Guide

Backend guidance for Relay python Django codebase.

See [agents.md](agents.md) for project overview and global principles.

## Technology Stack

- **Backend**: Python 3, Django, Django REST Framework (DRF)
- **Database**: PostgreSQL via `psycopg[c]` and Django ORM models
- **API**: REST API served via DRF
- **Caching**: Redis via django-redis
- **Email**: AWS SES/SNS/SQS via boto3
- **Phone**: Twilio
- **Auth**: Mozilla Accounts OAuth via django-allauth
- **Testing**: pytest-django, model-bakery, responses library
- **Code Quality**: Ruff, mypy (strict mode)

## Common Commands

```bash
# Code quality
ruff check .  # Lint
ruff format .  # Format
mypy .  # Type check

# Testing
pytest  # All tests
pytest api/  # Test specific app
pytest -k test_name  # Run specific test
```

## Django Apps Structure

The backend is organized into Django apps.

Check for an `.agents.md` file in an app directory for detailed guidance for that app.

## Runtime data for front-end

1. **Django serves static files** via Whitenoise
2. **Frontend fetches runtime config** from `/api/runtime_data/` endpoint

## Runtime operations

1. **Email forwarding** happens via background process (NOT in web request cycle)
2. **Phone masking** happens synchronously in web requests

## Django Migrations

### Adding New Fields

New columns need database default or allow `NULL` to prevent errors when old code runs against new database.

**Why:** During rollout, old code runs against new database. Omitted columns in INSERT statements must have defaults.

**Example:**

```python
# Good
new_field = models.CharField(max_length=100, default="")
# or
new_field = models.CharField(max_length=100, null=True, blank=True)

# Bad (will fail during rollout)
new_field = models.CharField(max_length=100)
```

### Deleting Fields/Models

**Rollout process:**

1. Remove all references in code
2. Deploy code changes to production
3. Then remove from `models.py` and create migration
4. Deploy model changes and migration

**Why:** Prevents errors when code references deleted columns during rollout.

## Management Commands

Django apps have management commands in their `management/commands/` directory. See app-specific .agents.md files for detailed guidance on each app's management commands.

## Backend Testing

See [agents.testing.md](agents.testing.md) for full testing guidance.

**Quick reference:**

```bash
pytest  # Run all tests
pytest api/  # Test specific app
pytest -k test_name  # Run specific test
```

**Framework:** pytest with pytest-django
**Fixtures:** model-bakery for model factories
**Mocking:** responses library for HTTP mocks
**Coverage:** coverage.py with HTML reports

## Code Quality Guidelines

See [agents.md](agents.md) for global code quality rules.

**Backend-specific:**

- Type hints required (mypy strict mode)
- Use Django ORM over raw SQL
- Prefer built-in functions over custom implementations
- Extract functions when indented too many levels (Python-specific)

## Further Reading

### App-Specific Guidance

- [../privaterelay/agents.md](../privaterelay/agents.md) - Core Django, settings, middleware, management commands
- [../api/agents.md](../api/agents.md) - REST API, authentication, serializers
- [../emails/agents.md](../emails/agents.md) - Email masking, AWS integration, metrics
- [../phones/agents.md](../phones/agents.md) - Phone masking, Twilio integration

### Cross-Cutting Guidance

- [agents.md](agents.md) - Project overview and global principles
- [agents.frontend.md](agents.frontend.md) - Frontend development
- [agents.testing.md](agents.testing.md) - Testing guidance

### Additional Resources

- `docs/` - Comprehensive architecture documentation
- `README.md` - Full setup instructions
