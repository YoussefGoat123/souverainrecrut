# ==========================================
# Sorties Terraform
# ==========================================

output "server_ip" {
  description = "Adresse IP du serveur de déploiement"
  value       = var.server_ip
}

output "ssh_command" {
  description = "Commande de connexion SSH"
  value       = "ssh -i ${var.ssh_private_key_path} ${var.ssh_user}@${var.server_ip}"
}

output "api_url" {
  description = "URL de l'API une fois déployée"
  value       = "http://${var.server_ip}:${var.api_port}"
}

output "health_url" {
  description = "URL de contrôle de santé de l'API"
  value       = "http://${var.server_ip}:${var.api_port}/v1/health"
}

output "ansible_inventory" {
  description = "Inventaire Ansible généré"
  value       = local_file.ansible_inventory.filename
}
