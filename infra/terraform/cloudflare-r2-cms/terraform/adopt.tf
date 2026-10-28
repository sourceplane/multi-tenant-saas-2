# --- Self-healing adoption (AWS-free state seeding) ---
#
# Same pattern as cloudflare-hyperdrive-cms/terraform/adopt.tf: when the
# platform state does not yet track the bucket but Cloudflare already has one
# under this name, import it at plan time instead of failing with "already
# exists". A bucket's name is its id, so the lookup is a single GET: 200 means
# adopt, anything else means create. A resource already in state
# short-circuits the lookup.

data "external" "adopt_r2_bucket" {
  program = ["bash", "-c", <<-EOT
    set -euo pipefail
    name="$(jq -r .name)"
    state_file="$(mktemp)"
    trap 'rm -f "$state_file"' EXIT
    code="$(curl -s -o "$state_file" -w '%%{http_code}' \
      -u "$TF_HTTP_USERNAME:$TF_HTTP_PASSWORD" "$TF_HTTP_ADDRESS" || echo 000)"
    if [ "$code" = "200" ] && jq -e \
        '[.resources[]? | select(.type == "cloudflare_r2_bucket" and .name == "media")] | length > 0' \
        "$state_file" >/dev/null 2>&1; then
      jq -n '{name: ""}'
      exit 0
    fi
    code="$(curl -s -o /dev/null -w '%%{http_code}' --retry 3 \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets/$name" || echo 000)"
    if [ "$code" = "200" ]; then
      jq -n --arg n "$name" '{name: $n}'
    else
      jq -n '{name: ""}'
    fi
  EOT
  ]
  query = {
    name = local.bucket_name
  }
}

import {
  for_each = toset(compact([data.external.adopt_r2_bucket.result.name]))
  to       = cloudflare_r2_bucket.media
  id       = "${var.cloudflare_account_id}/${each.value}"
}
