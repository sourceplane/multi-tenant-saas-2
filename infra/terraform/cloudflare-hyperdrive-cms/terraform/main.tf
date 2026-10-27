terraform {
  required_version = ">= 1.15.0"

  # State lives on the platform: the runner exports TF_HTTP_* per job.
  backend "http" {}

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.30"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    external = {
      source  = "hashicorp/external"
      version = "~> 2.3"
    }
  }
}

# Authenticates with CLOUDFLARE_API_TOKEN from the job env (brokered per run).
provider "cloudflare" {}

# --- Variables (standard Orun parameters) ---

variable "cloudflare_account_id" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Cloudflare account ID (from CLOUDFLARE_ACCOUNT_ID)"
}

variable "orgName" {
  type    = string
  default = "sourceplane"
}

variable "owner" {
  type    = string
  default = "sourceplane"
}

variable "repo" {
  type    = string
  default = "multi-tenant-saas-2"
}

variable "namespace" {
  type    = string
  default = "sourceplane"
}

variable "namespacePrefix" {
  type    = string
  default = ""
}

variable "lane" {
  type    = string
  default = "verify"
}

variable "environment" {
  type    = string
  default = "stage"
}

variable "component" {
  type    = string
  default = "cloudflare-hyperdrive-cms"
}

variable "stackName" {
  type    = string
  default = "cloudflare-hyperdrive-cms"
}

variable "terraformDir" {
  type    = string
  default = "terraform"
}

variable "terraformVersion" {
  type    = string
  default = "1.15.3"
}

# --- Supabase origin (published by the supabase component) ---

variable "supabase_project_ref" {
  type        = string
  description = "Supabase project reference (from SUPABASE_PROJECT_REF)"
}

variable "supabase_db_password" {
  type        = string
  sensitive   = true
  description = "Supabase database password (from SUPABASE_DB_PASSWORD)"
}

locals {
  database_host = "db.${var.supabase_project_ref}.supabase.co"
  database_port = 5432
  database_name = "postgres"
  database_user = "postgres"

  hyperdrive_name = "${var.namespacePrefix}multi-tenant-saas-2-cms-${var.environment}"
}

# --- The CMS's Hyperdrive config ---
#
# Same origin as cloudflare-hyperdrive, one difference: query caching is
# DISABLED. Hyperdrive does not invalidate a cached read when the application
# writes (default max_age 60 s), and an editor reads back what they just
# saved. Cloudflare's guidance for reads that must be fresh is a second,
# cache-disabled config over the same database, which is this.

resource "cloudflare_hyperdrive_config" "cms" {
  account_id = var.cloudflare_account_id
  name       = local.hyperdrive_name

  origin = {
    scheme   = "postgres"
    host     = local.database_host
    port     = local.database_port
    database = local.database_name
    user     = local.database_user
    password = var.supabase_db_password
  }

  caching = {
    disabled = true
  }
}

# --- Payload's secret ---
#
# Payload signs its sessions and encrypts its secrets with this. Generated
# here so no person ever chooses or sees it; published as CMS_PAYLOAD_SECRET
# and pushed to the Worker as PAYLOAD_SECRET by the CMS deploy. Replacing it
# signs every staff member out, nothing more.

resource "random_password" "payload_secret" {
  length  = 48
  special = false
}

# --- Outputs ---

output "wiring" {
  description = "Wiring document for apps/cms's deploy-time binding (pushed to orun secrets)"
  value = jsonencode({
    hyperdrive_id   = cloudflare_hyperdrive_config.cms.id
    hyperdrive_name = cloudflare_hyperdrive_config.cms.name
  })
}

output "payload_secret" {
  description = "Payload's secret (sensitive; pushed to orun secrets as CMS_PAYLOAD_SECRET)"
  value       = random_password.payload_secret.result
  sensitive   = true
}

output "hyperdrive_id" {
  description = "Cloudflare Hyperdrive config ID"
  value       = cloudflare_hyperdrive_config.cms.id
}

output "hyperdrive_name" {
  description = "Cloudflare Hyperdrive config name"
  value       = cloudflare_hyperdrive_config.cms.name
}
