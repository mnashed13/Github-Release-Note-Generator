const axios = require('axios');
require('dotenv').config();
const PDFDocument = require('pdfkit');
const fs = require('fs');

class ReleaseNoteGenerator {
	constructor(owner, repo, token) {
		this.owner = owner;
		this.repo = repo;
		this.token = token;
		this.apiBaseUrl = 'https://api.github.com';
	}

	async generateReleaseNotes(tagName) {
		try {
			// Get all pull requests merged between the previous release and this one
			const pullRequests = await this.getMergedPullRequests(tagName);

			// Categorize pull requests
			const categorizedPRs = this.categorizePullRequests(pullRequests);

			// Generate formatted release notes
			const releaseNotes = this.formatReleaseNotes(categorizedPRs, tagName);

			return releaseNotes;
		} catch (error) {
			console.error('Error generating release notes:', error.message);
			throw error;
		}
	}

	async getMergedPullRequests(tagName) {
		const config = {
			headers: {
				Authorization: `token ${this.token}`,
				Accept: 'application/vnd.github.v3+json',
			},
		};

		const response = await axios.get(
			`${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/pulls`,
			{
				...config,
				params: {
					state: 'closed',
					sort: 'updated',
					direction: 'desc',
					per_page: 100,
				},
			}
		);

		return response.data.filter((pr) => pr.merged_at !== null);
	}

	categorizePullRequests(pullRequests) {
		const categories = {
			Features: [],
			'Bug Fixes': [],
			Documentation: [],
			Other: [],
		};

		pullRequests.forEach((pr) => {
			const labels = pr.labels.map((label) => label.name.toLowerCase());

			if (labels.includes('feature') || labels.includes('enhancement')) {
				categories['Features'].push(pr);
			} else if (labels.includes('bug') || labels.includes('fix')) {
				categories['Bug Fixes'].push(pr);
			} else if (labels.includes('documentation')) {
				categories['Documentation'].push(pr);
			} else {
				categories['Other'].push(pr);
			}
		});

		return categories;
	}

	formatReleaseNotes(categorizedPRs, tagName) {
		let markdownNotes = `# Release Notes - ${tagName}\n\n`;

		for (const [category, prs] of Object.entries(categorizedPRs)) {
			if (prs.length > 0) {
				markdownNotes += `## ${category}\n\n`;
				prs.forEach((pr) => {
					markdownNotes += `- ${pr.title} (#${pr.number})\n`;
				});
				markdownNotes += '\n';
			}
		}

		// Generate PDF
		this.generatePDF(categorizedPRs, tagName);

		return markdownNotes;
	}

	generatePDF(categorizedPRs, tagName) {
		const doc = new PDFDocument();
		const outputPath = `release-notes-${tagName}.pdf`;

		// Pipe the PDF output to a file
		doc.pipe(fs.createWriteStream(outputPath));

		// Add title
		doc
			.fontSize(24)
			.font('Helvetica-Bold')
			.text(`Release Notes - ${tagName}`, {
				align: 'center',
			})
			.moveDown(2);

		// Add categories and their pull requests
		for (const [category, prs] of Object.entries(categorizedPRs)) {
			if (prs.length > 0) {
				doc.fontSize(16).font('Helvetica-Bold').text(category).moveDown(0.5);

				prs.forEach((pr) => {
					doc
						.fontSize(12)
						.font('Helvetica')
						.text(`• ${pr.title} (#${pr.number})`)
						.moveDown(0.2);
				});

				doc.moveDown(1);
			}
		}

		// Add footer with generation date
		doc
			.fontSize(10)
			.font('Helvetica')
			.text(`Generated on ${new Date().toLocaleDateString()}`, {
				align: 'center',
			});

		// Finalize the PDF
		doc.end();

		console.log(`PDF generated successfully: ${outputPath}`);
	}
}

// Example usage
async function main() {
	if (!process.env.GITHUB_TOKEN) {
		console.error('Please set GITHUB_TOKEN environment variable');
		process.exit(1);
	}

	const generator = new ReleaseNoteGenerator(
		process.env.GITHUB_OWNER || 'owner',
		process.env.GITHUB_REPO || 'repo',
		process.env.GITHUB_TOKEN
	);

	try {
		const releaseNotes = await generator.generateReleaseNotes('v1.0.0');
		console.log(releaseNotes);
	} catch (error) {
		console.error('Failed to generate release notes:', error);
	}
}

if (require.main === module) {
	main();
}

module.exports = ReleaseNoteGenerator;
