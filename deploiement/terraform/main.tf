# ==========================================
# Ressources Terraform
# ==========================================
# 1. Inventaire Ansible généré à partir des variables (source unique de vérité :
#    changer l'IP du serveur = modifier terraform.tfvars puis "terraform apply").
# 2. Fiche descriptive de l'infrastructure (JSON) réutilisable par d'autres outils.

locals {
  inventory_path = "${path.module}/../ansible/inventory.ini"
}

resource "local_file" "ansible_inventory" {
  filename        = local.inventory_path
  file_permission = "0644"

  content = templatefile("${path.module}/templates/inventory.ini.tftpl", {
    server_name          = var.server_name
    server_ip            = var.server_ip
    ssh_user             = var.ssh_user
    ssh_private_key_path = var.ssh_private_key_path
    deploy_dir           = var.deploy_dir
    api_port             = var.api_port
  })
}

resource "local_file" "infrastructure_description" {
  filename        = "${path.module}/infrastructure.json"
  file_permission = "0644"

  content = jsonencode({
    server = {
      name       = var.server_name
      ip         = var.server_ip
      ssh_user   = var.ssh_user
      deploy_dir = var.deploy_dir
      api_url    = "http://${var.server_ip}:${var.api_port}"
    }
    vm          = var.vm_specs
    provisioned = "manuel (VMware Workstation, sans ESXi/vCenter)"
  })
}
