# YU Automations

Automated workflows for YU events and gym shift tracking, running on GitHub Actions.

## 🚀 Workflows

| Workflow | Schedule | Description |
|----------|----------|-------------|
| **YU Event Alerts** | Daily at 9 AM ET | Checks for new YU events, emails notifications |
| **YU Gym Shifts** | Thursday 11:45 PM ET | Sends weekly pay period summary |

## ⚙️ Setup

### 1. Create GitHub Repository

```bash
cd "C:\Users\kfirs\PycharmProjects\N8N Automations"
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/yu-automations.git
git push -u origin main
```

### 2. Add Secrets

Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `GMAIL_USER` | `kfirslon@gmail.com` |
| `GMAIL_APP_PASSWORD` | Your Gmail app password |
| `GYM_SHIFTS_SHEET_ID` | `11AudHMD7PdzuSxRe-lci32qeoWN5sr-VU8jpbxhVa5U` |

### 3. Enable Actions

Go to **Actions** tab → Enable workflows

### 4. Test Manually

Click on any workflow → **Run workflow** → **Run workflow**

## 📁 Files

- `.github/workflows/` - GitHub Actions workflow definitions
- `yu-event-alerts-gh.js` - Event alerts (GitHub version)
- `yu-gym-shifts-gh.js` - Gym shifts (GitHub version)
- `package.json` - Node.js dependencies

## 🔧 Local Development

For local testing:
```bash
npm install
node yu-event-alerts.js
node yu-gym-shifts.js
```
