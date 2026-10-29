terraform {
  required_version = ">= 1.15.0"

  # State lives on the platform: the runner exports TF_HTTP_* per job.
  backend "http" {}

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.30"
    }
    external = {
      source  = "hashicorp/external"
      version = "~> 2.3"
    }
  }
}

# Authenticates with CLOUDFLARE_API_TOKEN from the job env: the r2-data token
# (Workers R2 Storage Write), not the fleet's workers-deploy token, which has
# no R2 permission.
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
  default = "cloudflare-r2-cms"
}

variable "stackName" {
  type    = string
  default = "cloudflare-r2-cms"
}

variable "terraformDir" {
  type    = string
  default = "terraform"
}

variable "terraformVersion" {
  type    = string
  default = "1.15.3"
}

locals {
  bucket_name = "${var.namespacePrefix}multi-tenant-saas-2-cms-media-${var.environment}"
}

# --- The CMS's media bucket ---
#
# Private: nothing reads it directly. The CMS Worker binds it as R2_MEDIA,
# Payload's R2 storage adapter writes uploads to it, and Payload serves them
# back through its own access rules at /api/media/file/<filename>.

resource "cloudflare_r2_bucket" "media" {
  account_id = var.cloudflare_account_id
  name       = local.bucket_name
}

# --- Outputs ---

output "wiring" {
  description = "Wiring document for apps/cms's deploy-time R2 binding (pushed to orun secrets)"
  value = jsonencode({
    bucket_name = cloudflare_r2_bucket.media.name
  })
}

output "bucket_name" {
  description = "The media bucket's name"
  value       = cloudflare_r2_bucket.media.name
}
