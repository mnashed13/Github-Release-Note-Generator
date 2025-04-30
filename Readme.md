<div align="center">

<img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub Logo" width="100" height="100">

# GitHub Release Notes Generator

🚀 Automatically generate beautifully formatted release notes from your GitHub pull requests

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2012.0.0-brightgreen.svg)](https://nodejs.org/en/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

## ✨ Features

- 📝 Automatically fetches merged pull requests from GitHub
- 🏷️ Categorizes pull requests based on labels (Features, Bug Fixes, Documentation, etc.)
- 📄 Generates formatted markdown output
- ⚙️ Customizable categorization logic
- 🔧 Simple configuration using environment variables
- 📧 Email notification support with customizable templates
- 📄 Attachments of generated release notes (PDF and Markdown)
- 🔄 Support for generating release notes between any two versions
- 🎯 Flexible version specification via .env or command line

## 📋 Prerequisites

- Node.js (v12 or higher)
- GitHub Personal Access Token with `repo` scope
- npm or yarn package manager

## 🚀 Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd github-release-notes-generator
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env-example` to `.env` and configure your environment variables:

   ```bash
   cp .env-example .env
   ```

## ⚙️ Configuration

### Required Environment Variables

Create or modify your `.env` file with the following required settings:

```env
# GitHub Configuration (Required)
GITHUB_OWNER=your-username-or-org
GITHUB_REPO=your-repository-name
GITHUB_TOKEN=your-github-personal-access-token

# Release Versions (Optional)
END_VERSION=v2.0.0
START_VERSION=v1.0.0  # Optional - if not specified, will use previous release

# Email Settings (Optional - for email notifications)
EMAIL_FROM=release-bot@example.com
EMAIL_TO=team@example.com
EMAIL_CC=optional@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
```

To get a GitHub Personal Access Token:

1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Click "Generate new token"
3. Select the `repo` scope
4. Copy the generated token and add it to your `.env` file

## 💻 Usage

### Basic Usage

You can specify release versions in three ways:

1. **Using Command Line Arguments** (Highest Priority):

   ```bash
   # Generate notes between two specific versions
   node releaseNoteGenerator.js v2.0.0 v1.0.0

   # Generate notes from previous release to v2.0.0
   node releaseNoteGenerator.js v2.0.0
   ```

2. **Using Environment Variables** in `.env` file:

   ```env
   END_VERSION=v2.0.0
   START_VERSION=v1.0.0  # Optional
   ```

   Then run:

   ```bash
   node releaseNoteGenerator.js
   ```

3. **Mix and Match**:

   - Set default versions in `.env`
   - Override when needed via command line

   ```bash
   # Override both versions
   node releaseNoteGenerator.js v2.1.0 v2.0.0

   # Override only end version (will use START_VERSION from .env)
   node releaseNoteGenerator.js v2.1.0
   ```

### Output

The generator will create two files in the `output` directory:

- `release-notes-{version}.md` - Markdown format
- `release-notes-{version}.pdf` - PDF format with styling

### Email Notifications

If email settings are configured in `.env`, you can send release notes via email:

```javascript
const generator = new ReleaseNoteGenerator(owner, repo, token);
await generator.generateReleaseNotes(endVersion, startVersion, {
	generateEmail: true,
	sendEmail: true,
});
```

## 📝 Pull Request Categorization

Pull requests are automatically categorized based on their labels:

- **Features**: PRs with 'feature' or 'enhancement' labels
- **Bug Fixes**: PRs with 'bug' or 'fix' labels
- **Documentation**: PRs with 'documentation' label
- **Other**: PRs without any of the above labels

## 🎨 Customization

- Add your logo at `./assets/logo.png`
- Add header background at `./assets/header-bg.png`
- Customize email template in `./Template/email-template.eml`
- Modify categorization logic in `categorizePullRequests()` method

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
Made with ❤️ for the GitHub community
</div>
