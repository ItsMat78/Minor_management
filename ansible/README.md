# Minor Management System — Ansible Provisioning

Provisions the Ubuntu 22.04 production server for the Minor Management System (IIIT Naya Raipur).

---

## Prerequisites

- Ansible 2.14+ (`pip install ansible`)
- Python 3.10+
- SSH key access to the bastion host
- `ssh-agent` running with your key loaded

---

## One-Time Setup

### 1. Configure target hosts

Edit `group_vars/all.yml` — set the two placeholder values:

```yaml
bastion_host: "YOUR_BASTION_IP"       # jump host IP or hostname
```

Edit `inventory/hosts` — set the server's private IP:

```yaml
server:
  ansible_host: "YOUR_SERVER_PRIVATE_IP"
```

### 2. Add SSL certificates

Place your SSL files (git-ignored) at:

```
ssl/certificate.crt
ssl/key.key
```

### 3. Get a GitHub runner registration token

Go to: `https://github.com/YOUR_ORG/REPO → Settings → Actions → Runners → New self-hosted runner`

Copy the token — it is **single-use and expires in 1 hour**.

### 4. Create and populate the vault

```bash
# Create the vault file (prompts for a vault password)
ansible-vault create group_vars/vault.yml
```

Paste this content when the editor opens:

```yaml
vault_github_runner_token: PASTE_TOKEN_HERE
```

Save and close. The file is now AES256-encrypted.

---

## Vault Commands

```bash
# Create vault (first time)
ansible-vault create group_vars/vault.yml

# Edit existing vault (to update the runner token)
ansible-vault edit group_vars/vault.yml

# View vault contents without editing
ansible-vault view group_vars/vault.yml

# Re-encrypt vault with a new password
ansible-vault rekey group_vars/vault.yml

# Decrypt vault to plaintext (only for debugging — re-encrypt immediately after)
ansible-vault decrypt group_vars/vault.yml
ansible-vault encrypt group_vars/vault.yml
```

**Store your vault password in a file to avoid typing it every run:**

```bash
echo "your_vault_password" > ~/.vault_pass
chmod 600 ~/.vault_pass
# Add to global gitignore so it is never committed:
echo ~/.vault_pass >> ~/.gitignore_global
git config --global core.excludesFile ~/.gitignore_global
```

---

## SSH / Bastion Setup

Load your key into ssh-agent before running any Ansible command:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/your_private_key

# Verify bastion connectivity manually first
ssh -J ubuntu@BASTION_IP ubuntu@SERVER_PRIVATE_IP
```

---

## Ansible Commands

### Test connectivity

```bash
# Ping all hosts through bastion
ansible all -m ping

# With vault password file
ansible all -m ping --vault-password-file ~/.vault_pass
```

### Syntax and dry run

```bash
# Check playbook syntax (no connection needed)
ansible-playbook site.yml --syntax-check

# Dry run (shows what would change, no actual changes)
ansible-playbook site.yml --check --vault-password-file ~/.vault_pass
```

### Full provisioning

```bash
# Interactive vault password prompt
ansible-playbook site.yml --ask-vault-pass

# With vault password file (non-interactive)
ansible-playbook site.yml --vault-password-file ~/.vault_pass
```

### Run a single role

```bash
ansible-playbook site.yml --tags base      --vault-password-file ~/.vault_pass
ansible-playbook site.yml --tags nodejs    --vault-password-file ~/.vault_pass
ansible-playbook site.yml --tags pm2       --vault-password-file ~/.vault_pass
ansible-playbook site.yml --tags ssl_certificates --vault-password-file ~/.vault_pass
ansible-playbook site.yml --tags nginx     --vault-password-file ~/.vault_pass
ansible-playbook site.yml --tags github_runner --vault-password-file ~/.vault_pass
ansible-playbook site.yml --tags startup   --vault-password-file ~/.vault_pass
```

### Useful ad-hoc commands

```bash
# Check server uptime
ansible all -m command -a "uptime"

# Check nginx status
ansible all -m command -a "systemctl status nginx" --become

# Gather facts only
ansible all -m setup
```

---

## After Provisioning

SSH into the server (through bastion) and verify:

```bash
# Through bastion
ssh -J ubuntu@BASTION_IP ubuntu@SERVER_PRIVATE_IP

# On the server
pm2 list                          # should show your app running
sudo systemctl status nginx       # nginx active
sudo systemctl status minor-project-startup   # startup service active
curl -k https://localhost/api/    # API reachable via nginx
```

---

## Re-registering the GitHub Runner

Runner tokens expire. To re-register:

1. Get a fresh token from GitHub (Settings → Actions → Runners → New self-hosted runner).
2. Update the vault:
   ```bash
   ansible-vault edit group_vars/vault.yml
   # Update vault_github_runner_token with the new token
   ```
3. Re-run the runner role:
   ```bash
   ansible-playbook site.yml --tags github_runner --vault-password-file ~/.vault_pass
   ```
