# Error catalogue

This catalogue expands [api/README.md](api/README.md), [13-rest-conventions.md](13-rest-conventions.md), and [AGENTS.md](../AGENTS.md). Errors must use stable machine-readable codes, safe messages, correlation IDs, optional field violations, and retry guidance.

## Envelope

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request contains invalid fields.",
    "correlation_id": "corr_opaque",
    "fields": [
      {
        "name": "subject",
        "code": "REQUIRED",
        "message": "Subject is required."
      }
    ],
    "retry": {
      "retryable": false
    }
  }
}
```

## HTTP and platform errors

| HTTP | Code                       | Category             | Safe message                              | Retry guidance                                              |
| ---: | -------------------------- | -------------------- | ----------------------------------------- | ----------------------------------------------------------- |
|  400 | `VALIDATION_FAILED`        | Validation           | Invalid fields were provided.             | Correct request.                                            |
|  400 | `MALFORMED_REQUEST`        | Validation           | Request format is invalid.                | Correct request.                                            |
|  401 | `AUTH_REQUIRED`            | Authentication       | Authentication is required.               | Sign in or refresh token.                                   |
|  401 | `AUTH_INVALID_CREDENTIALS` | Authentication       | Credentials are invalid.                  | Do not reveal which factor failed; throttle.                |
|  401 | `AUTH_MFA_REQUIRED`        | Authentication       | Additional verification is required.      | Complete challenge.                                         |
|  401 | `AUTH_TOKEN_REVOKED`       | Authentication       | Session is no longer valid.               | Reauthenticate.                                             |
|  403 | `AUTH_FORBIDDEN`           | Authorization        | You do not have access to this resource.  | Do not retry without permission change.                     |
|  404 | `NOT_FOUND`                | Enumeration-safe     | The resource was not found.               | Do not disclose foreign tenant existence.                   |
|  409 | `CONFLICT`                 | Business/concurrency | The request conflicts with current state. | Reload and retry if appropriate.                            |
|  412 | `PRECONDITION_FAILED`      | Concurrency          | The resource version is stale.            | Fetch latest version and retry.                             |
|  413 | `PAYLOAD_TOO_LARGE`        | Validation           | Payload exceeds the allowed size.         | Reduce size.                                                |
|  415 | `UNSUPPORTED_MEDIA_TYPE`   | Validation           | File or media type is not allowed.        | Use allowed type.                                           |
|  422 | `BUSINESS_RULE_FAILED`     | Business             | The action violates a business rule.      | Change action/state.                                        |
|  423 | `RESOURCE_LOCKED`          | Business             | Resource is temporarily locked.           | Retry after lock expires if safe.                           |
|  429 | `RATE_LIMITED`             | Abuse/rate           | Too many requests.                        | Retry after indicated delay.                                |
|  500 | `INTERNAL_ERROR`           | Internal             | An unexpected error occurred.             | Retry only if operation is idempotent and guidance says so. |
|  503 | `DEPENDENCY_UNAVAILABLE`   | Transient dependency | A required service is unavailable.        | Retry with backoff when retryable.                          |
|  503 | `OPERATION_DEGRADED`       | Degraded mode        | Operation is temporarily degraded.        | Follow response guidance.                                   |

## Business errors

| Code                            | Meaning                                                   | Typical HTTP | Retry guidance                            |
| ------------------------------- | --------------------------------------------------------- | -----------: | ----------------------------------------- |
| `TENANT_SUSPENDED`              | Tenant lifecycle denies action.                           |          403 | No retry until tenant restored.           |
| `TENANT_CONTEXT_MISSING`        | Trusted tenant context absent.                            |          403 | Select tenant or fix routing.             |
| `TENANT_CONTEXT_MISMATCH`       | Resource does not match tenant context.                   |      404/403 | No retry; security signal.                |
| `LAST_ADMIN_REQUIRED`           | Action would remove last active Tenant Admin.             |          409 | Assign replacement admin first.           |
| `PERMISSION_GRANT_NOT_ALLOWED`  | Actor cannot grant requested permission.                  |          403 | Requires higher privilege.                |
| `INVALID_TRANSITION`            | Ticket status transition is not allowed.                  |          422 | Choose allowed transition.                |
| `APPROVAL_REQUIRED`             | Action requires approval.                                 |      409/422 | Start approval flow.                      |
| `SLA_RECALCULATION_NOT_ALLOWED` | SLA target cannot be recalculated by policy.              |          422 | Requires policy/approval change.          |
| `ATTACHMENT_NOT_CLEAN`          | Attachment is pending, infected, blocked, or failed scan. |      423/422 | Wait for scan or remove file.             |
| `QUOTA_EXCEEDED`                | Tenant/user quota exceeded.                               |      429/422 | Reduce usage or increase quota.           |
| `EXPORT_TOO_LARGE`              | Export exceeds limits.                                    |          422 | Narrow filters or use approved bulk path. |
| `DOMAIN_UNVERIFIED`             | Email/domain setting cannot activate.                     |          422 | Complete verification.                    |
| `REPLAY_DETECTED`               | Webhook/token/idempotency replay rejected.                |          409 | Do not retry same replay.                 |

## Database errors

Database internals are never exposed. Map uniqueness violations to `CONFLICT`, optimistic version misses to `PRECONDITION_FAILED`, unavailable datastore to `DEPENDENCY_UNAVAILABLE`, and migration/constraint surprises to `INTERNAL_ERROR` plus high-severity telemetry.

## Retry policy

Retry only transient, idempotent operations with bounded exponential backoff and jitter. Never automatically retry non-idempotent mutations without an idempotency key. Client retries must preserve idempotency key and payload.
