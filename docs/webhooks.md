# Webhooks

Webhooks notify other systems when published content changes, for example a static site that needs to rebuild or a cache that should be purged. Servitor sends a signed `POST` request with a small JSON body; the body never contains content, so the receiver fetches what it needs through the [REST API](api.md).

## Adding a webhook

Staff manage webhooks under **Integrations → Webhooks**:

1. Enter the **Endpoint URL**. It must use `https`, see [Allowed targets](#allowed-targets).
2. Select the **Events** the endpoint wants.
3. Keep **Send events to this endpoint** on, or turn it off to stop deliveries for a while.
4. Choose **Add webhook** and confirm with your password, and a current code when two-factor authentication is on.
5. Copy the **Signing secret**. It starts with `whsec_` and is shown only once.

An installation can have up to 50 webhooks. The list shows for each webhook whether it is enabled and how many deliveries are waiting or failed.

## Events

| Event              | Sent when                                                          |
| ------------------ | ------------------------------------------------------------------ |
| `post.published`   | A translation went live for the first time or was published again. |
| `post.updated`     | The live version of a published translation changed.               |
| `post.unpublished` | A translation was unpublished.                                     |
| `post.hidden`      | A moderator hid a post.                                            |
| `post.unhidden`    | A moderator made a post visible again.                             |
| `post.deleted`     | A post was deleted.                                                |

Changes to drafts and submissions do not send events, because readers cannot see them.

## The request

Every delivery is a `POST` with `Content-Type: application/json` and these headers:

| Header                 | Content                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `X-Servitor-Event`     | The event, for example `post.published`.                                              |
| `X-Servitor-Delivery`  | The ID of this delivery. Retries of the same delivery use the same ID.                |
| `X-Servitor-Signature` | `t=<unix seconds>,v1=<hex>`, see [Verifying the signature](#verifying-the-signature). |
| `User-Agent`           | `Servitor-Webhooks/1.0`                                                               |

The body:

```json
{
  "event": "post.published",
  "delivery_id": "0f6c9a55-7a4e-4f21-9f8d-2d0f6f3b9b1a",
  "timestamp": "2026-09-24T12:00:00.000Z",
  "post_id": "8b1d1c52-5d0e-4e0f-9c1b-3f7a2b6e4d10",
  "languages": ["en", "de"],
  "slugs": { "en": "hello-world", "de": "hallo-welt" }
}
```

`languages` and `slugs` describe the translations the event concerns. Fetch the post with `GET /api/v1/posts/{post_id}` when you need its content.

## Verifying the signature

`v1` is the HMAC-SHA256 of `<t>.<raw body>`, computed with the webhook's signing secret. Verify it against the raw request body before parsing it, compare in constant time, and reject timestamps older than five minutes so that captured requests cannot be replayed.

In Node.js:

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

export function isValidServitorRequest(rawBody, header, secret, now = Date.now()) {
  const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header ?? '');

  if (!match) {
    return false;
  }

  const timestamp = Number(match[1]);

  if (Math.abs(now / 1000 - timestamp) > 300) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
  const received = Buffer.from(match[2], 'hex');

  return received.length === expected.length && timingSafeEqual(received, expected);
}
```

In Python:

```python
import hashlib
import hmac
import re
import time


def is_valid_servitor_request(raw_body: bytes, header: str, secret: str) -> bool:
    match = re.fullmatch(r"t=(\d+),v1=([0-9a-f]{64})", header or "")

    if match is None:
        return False

    timestamp = int(match.group(1))

    if abs(time.time() - timestamp) > 300:
        return False

    message = f"{timestamp}.".encode() + raw_body
    expected = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()

    return hmac.compare_digest(expected, match.group(2))
```

Answer with any `2xx` status as soon as the request is verified, and do slow work, such as a site rebuild, afterwards. A delivery can arrive more than once when an earlier answer was lost; use `delivery_id` to ignore duplicates.

## Deliveries and retries

Deliveries are queued in the database and sent by a worker inside the application, so they survive restarts.

- A request times out after 10 seconds. Redirects are not followed.
- Anything other than a `2xx` answer counts as a failure and is retried up to five times, after 30 seconds and then 1, 2, 4 and 8 minutes. After the last retry, the delivery is marked **Failed**.
- Turning off **Send events to this endpoint** stops new deliveries; deliveries that are still waiting are marked **Failed**.

Open a webhook to see its **Recent deliveries** with status, attempts, response code, duration, the next attempt and the error, if any. Deliveries are kept for 30 days.

## Rotating the secret

**Rotate secret** on the webhook page creates a new signing secret, shows it once and invalidates the old one immediately. Rotating requires your password, and a current code when two-factor authentication is on. Update the receiver right after rotating; deliveries signed with the old secret will fail verification.

Webhook secrets are stored encrypted with AES-256-GCM under a key derived from `BETTER_AUTH_SECRET`, see [Rotating the secret](operations.md#rotating-the-secret).

## Allowed targets

To protect your network, Servitor resolves the host name before every delivery and refuses to connect when it points to:

- loopback addresses, such as `127.0.0.1` and `::1`;
- link-local addresses, including the cloud metadata address `169.254.169.254`;
- private networks: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, carrier-grade NAT `100.64.0.0/10` and IPv6 unique local addresses `fc00::/7`;
- multicast and reserved ranges of IPv4 and IPv6, including IPv4 addresses embedded in IPv6.

It then connects to exactly the address it checked, so a DNS change between the check and the connection cannot redirect the request. Addresses with a user name, password or fragment are rejected.

When the receiver runs in your own network, set `WEBHOOK_ALLOW_PRIVATE=true`. Private networks are then allowed, including plain `http` to them; loopback, link-local and reserved addresses stay blocked.
