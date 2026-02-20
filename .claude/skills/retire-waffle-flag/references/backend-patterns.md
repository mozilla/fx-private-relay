# Backend Patterns for Django Waffle Flag Retirement

Detailed patterns for retiring waffle flags in Django/Python code.

## Flag Check Functions

### flag_is_active_in_task

Used in background tasks and non-request contexts:

```python
from privaterelay.utils import flag_is_active_in_task

# Pattern: Simple check
if flag_is_active_in_task("flag_name", None):
    do_something()

# Pattern: With user context
if flag_is_active_in_task("flag_name", user):
    do_user_specific_thing()

# Pattern: In property
@property
def feature_enabled(self):
    return flag_is_active_in_task("flag_name", self.user)
```

**Retirement:**
Remove conditional, keep flag-enabled behavior.

### flag_is_active

Used in view/request contexts:

```python
from waffle import flag_is_active

def my_view(request):
    if flag_is_active(request, "flag_name"):
        return new_response()
    else:
        return old_response()
```

**Retirement:**
Remove conditional, keep flag-enabled path.

## Common Backend Patterns

### Pattern 1: Validation Logic

```python
# BEFORE
def valid_address(address, domain, subdomain=None):
    # ... other checks ...
    address_already_deleted = 0

    # TODO: Remove flag_name flag, assume on
    if not subdomain or flag_is_active_in_task("flag_name", None):
        address_already_deleted = DeletedAddress.objects.filter(
            address_hash=hash_address(address, domain, subdomain)
        ).count()

    if address_already_deleted > 0:
        return False
    return True

# AFTER
def valid_address(address, domain, subdomain=None):
    # ... other checks ...
    address_already_deleted = DeletedAddress.objects.filter(
        address_hash=hash_address(address, domain, subdomain)
    ).count()

    if address_already_deleted > 0:
        return False
    return True
```

### Pattern 2: Model Methods

```python
# BEFORE
class MyModel(models.Model):
    def should_process(self):
        if flag_is_active_in_task("flag_name", self.user):
            return self.new_criteria()
        else:
            return self.old_criteria()

# AFTER
class MyModel(models.Model):
    def should_process(self):
        return self.new_criteria()
```

### Pattern 3: View Logic

```python
# BEFORE
def my_api_view(request):
    if flag_is_active(request, "flag_name"):
        data = process_new_way(request.data)
    else:
        data = process_old_way(request.data)
    return Response(data)

# AFTER
def my_api_view(request):
    data = process_new_way(request.data)
    return Response(data)
```

### Pattern 4: Early Returns

```python
# BEFORE
def process_email(email):
    # Skip if flag disabled
    if not flag_is_active_in_task("flag_name", email.user):
        return

    # New processing logic
    check_spam(email)
    filter_trackers(email)
    forward(email)

# AFTER
def process_email(email):
    # Always do new processing
    check_spam(email)
    filter_trackers(email)
    forward(email)
```

### Pattern 5: Configuration/Settings

```python
# BEFORE
def get_feature_config(user):
    config = BASE_CONFIG.copy()

    if flag_is_active_in_task("flag_name", user):
        config.update(NEW_SETTINGS)
    else:
        config.update(OLD_SETTINGS)

    return config

# AFTER
def get_feature_config(user):
    config = BASE_CONFIG.copy()
    config.update(NEW_SETTINGS)
    return config
```

## Import Cleanup

### Removing flag_is_active_in_task

```python
# Check if used elsewhere in file
grep -n "flag_is_active_in_task" filename.py

# If only used for retired flag, remove import
from privaterelay.utils import flag_is_active_in_task  # DELETE
```

### Removing flag_is_active

```python
# Check usage
grep -n "flag_is_active" filename.py

# Remove if not used
from waffle import flag_is_active  # DELETE
```

## Test Patterns

### Pattern 1: Remove decorator, keep test

Tests that verify new (desired) behavior:

```python
# BEFORE
from waffle.testutils import override_flag

class MyTestCase(TestCase):
    @override_flag("flag_name", active=True)
    def test_new_behavior_works(self):
        result = do_thing()
        assert result == expected_new_result

# AFTER
class MyTestCase(TestCase):
    def test_new_behavior_works(self):
        result = do_thing()
        assert result == expected_new_result
```

### Pattern 2: Delete entire test

Tests that verify old (deprecated) behavior:

```python
# DELETE THIS ENTIRE TEST
@override_flag("flag_name", active=False)
def test_old_behavior_works(self):
    result = do_thing()
    assert result == expected_old_result
```

### Pattern 3: Test pairs

Often you'll find paired tests:

```python
# DELETE: Tests old behavior
@override_flag("flag_name", active=False)
def test_can_reuse_deleted_address(self):
    address = create_address()
    address.delete()
    # Should succeed
    new_address = create_address()
    assert new_address.address == address.address

# KEEP: Tests new behavior (remove decorator)
@override_flag("flag_name", active=True)  # DELETE THIS LINE
def test_cannot_reuse_deleted_address(self):
    address = create_address()
    address.delete()
    # Should fail
    with pytest.raises(ValidationError):
        create_address()
```

### Pattern 4: Import cleanup

```python
# BEFORE
from django.test import TestCase
from waffle.testutils import override_flag

from ..models import MyModel

# Check if override_flag used elsewhere
grep -n "override_flag" test_file.py

# AFTER (if not used elsewhere)
from django.test import TestCase

from ..models import MyModel
```

## API Test Patterns

### Pattern 1: DRF test decorators

```python
# BEFORE
@pytest.mark.django_db
@override_flag("flag_name", active=True)
def test_api_endpoint_behavior(api_client, user):
    response = api_client.post("/api/endpoint/", data)
    assert response.status_code == 200

# AFTER
@pytest.mark.django_db
def test_api_endpoint_behavior(api_client, user):
    response = api_client.post("/api/endpoint/", data)
    assert response.status_code == 200
```

### Pattern 2: Multiple decorators

```python
# BEFORE
@override_settings(DEBUG=True)
@override_flag("flag_name", active=True)
@pytest.mark.django_db
def test_complex_scenario():
    # Test body
    pass

# AFTER
@override_settings(DEBUG=True)
@pytest.mark.django_db
def test_complex_scenario():
    # Test body
    pass
```

## Edge Cases

### Case 1: Flag used in multiple conditions

```python
# BEFORE
def process(item, user):
    if flag_is_active_in_task("flag_name", user):
        validate_new_way(item)

    # ... other logic ...

    if flag_is_active_in_task("flag_name", user):
        format_new_way(item)

    return item

# AFTER
def process(item, user):
    validate_new_way(item)

    # ... other logic ...

    format_new_way(item)

    return item
```

### Case 2: Nested conditionals

```python
# BEFORE
if user.has_premium:
    if flag_is_active_in_task("flag_name", user):
        return premium_new_feature()
    else:
        return premium_old_feature()
else:
    return free_feature()

# AFTER
if user.has_premium:
    return premium_new_feature()
else:
    return free_feature()
```

### Case 3: Flag in complex boolean

```python
# BEFORE
if user.is_active and flag_is_active_in_task("flag_name", user):
    do_thing()

# AFTER
if user.is_active:
    do_thing()
```

## Validation Steps

After modifying backend code:

1. **Run unit tests:**

```bash
pytest path/to/modified_file_tests.py -v
```

2. **Run integration tests:**

```bash
pytest api/tests/ -v
```

3. **Check for remaining references:**

```bash
grep -r "flag_name" --include="*.py" .
```

4. **Verify imports cleaned up:**

```bash
grep -r "flag_is_active" --include="*.py" modified_files/
```

5. **Run full test suite:**

```bash
pytest
```
