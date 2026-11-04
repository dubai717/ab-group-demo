# Public Supabase CA certificate (not a secret)

The read-only GitHub job adds this reviewed public root to Node's trust store via NODE_EXTRA_CA_CERTS. TLS certificate/hostname verification remains enabled; no provider keys or database credentials are in this directory.

Official source: https://github.com/supabase/cli/blob/e365ad6b96a2ba4327b9220ecba5e4504e5fbecc/apps/cli/src/commands/gen/types/templates/prod-ca-2021.ts

The official Supabase Studio SSL download template also references the prod-ca-2021 certificate:
https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json

Certificate SHA256 fingerprint:
80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA

Subject/issuer: Supabase Inc, Supabase Root 2021 CA. Valid through 2031-04-26. This is the public certificate only; it contains no private key. The certificate hash is checked in a focused test. Do not replace it with an unverified CA or disable verification to work around connection failures.
