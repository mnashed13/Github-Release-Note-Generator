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

3. Create a `.env` file in the root directory with the following variables:

   ```env
   GITHUB_TOKEN=your_github_personal_access_token
   GITHUB_OWNER=repository_owner
   GITHUB_REPO=repository_name
   ```

   To get a GitHub Personal Access Token:

   1. Go to GitHub Settings > Developer settings > Personal access tokens
   2. Click "Generate new token"
   3. Select the `repo` scope
   4. Copy the generated token and add it to your `.env` file

## 💻 Usage

### Basic Usage

Run the script with default settings:

```bash
node releaseNoteGenerator.js
```

## 📝 Output Format

The generator creates two outputs:

1. A PDF file named `release-notes-{tagName}.pdf` in your project directory
2. A markdown-formatted string (returned by the generateReleaseNotes method)

The PDF includes:

- Professional formatting with proper headings
- Categorized pull requests
- Generation date
- Pull request numbers and titles

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
Made with ❤️ for the GitHub community
</div>
