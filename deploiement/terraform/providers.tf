# ==========================================
# Providers Terraform
# ==========================================
# Pas d'ESXi/vCenter disponible (cf. documentation) : la VM a été créée manuellement
# dans VMware Workstation. Terraform décrit ici les ressources réellement disponibles :
# la cible de déploiement et les fichiers de configuration qui en découlent.
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

provider "local" {}
