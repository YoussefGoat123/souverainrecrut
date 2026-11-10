# ==========================================
# Variables : description du serveur de déploiement
# ==========================================

variable "server_name" {
  description = "Nom d'hôte du serveur de déploiement"
  type        = string
  default     = "souverainrecrut-srv"
}

variable "server_ip" {
  description = "Adresse IPv4 du serveur (VM Ubuntu sur VMware Workstation, réseau NAT)"
  type        = string

  validation {
    condition     = can(regex("^((25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])\\.){3}(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])$", var.server_ip))
    error_message = "server_ip doit être une adresse IPv4 valide."
  }
}

variable "ssh_user" {
  description = "Utilisateur SSH utilisé par Ansible et GitLab CI/CD"
  type        = string
  default     = "deploy"
}

variable "ssh_private_key_path" {
  description = "Chemin de la clé privée SSH sur le poste de contrôle (jamais versionnée)"
  type        = string
  default     = "~/.ssh/souverainrecrut_deploy"
}

variable "deploy_dir" {
  description = "Répertoire de déploiement sur le serveur"
  type        = string
  default     = "/opt/souverainrecrut"
}

variable "api_port" {
  description = "Port exposé par l'API Backend"
  type        = number
  default     = 4000
}

variable "vm_specs" {
  description = "Caractéristiques de la VM créée manuellement (documentation et contrôle)"
  type = object({
    os        = string
    vcpu      = number
    memory_mb = number
    disk_gb   = number
    network   = string
  })
  default = {
    os        = "Ubuntu Server 24.04 LTS"
    vcpu      = 2
    memory_mb = 2048
    disk_gb   = 30
    network   = "NAT"
  }
}
