const axios = require('axios');
const PDFDocument = require('pdfkit');
const fs = require('fs');
require('dotenv').config();

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
		try {
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

			// Filter for merged pull requests only
			return response.data.filter((pr) => pr.merged_at !== null);
		} catch (error) {
			console.error('Error fetching pull requests:', error.message);
			throw error;
		}
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

		// Clean up old files
		this.cleanupOldFiles();

		// Generate PDF and Markdown files
		this.generatePDF(categorizedPRs, tagName);
		this.generateMarkdownFile(markdownNotes, tagName);

		return markdownNotes;
	}

	cleanupOldFiles() {
		try {
			// Clean up PDF files
			const files = fs.readdirSync('.');
			const releaseNoteFiles = files.filter(
				(file) =>
					file.startsWith('release-notes-') &&
					(file.endsWith('.pdf') || file.endsWith('.md'))
			);

			releaseNoteFiles.forEach((file) => {
				fs.unlinkSync(file);
				console.log(`Cleaned up old file: ${file}`);
			});
		} catch (error) {
			console.error('Error cleaning up old files:', error.message);
		}
	}

	generateMarkdownFile(markdownContent, tagName) {
		try {
			const outputPath = `release-notes-${tagName}.md`;
			fs.writeFileSync(outputPath, markdownContent);
			console.log(`Markdown file generated successfully: ${outputPath}`);
		} catch (error) {
			console.error('Error generating markdown file:', error.message);
		}
	}

	generatePDF(categorizedPRs, tagName) {
		const doc = new PDFDocument({
			size: 'A4',
			margins: {
				top: 72,
				bottom: 72,
				left: 72,
				right: 72,
			},
		});

		const outputPath = `release-notes-${tagName}.pdf`;
		doc.pipe(fs.createWriteStream(outputPath));

		// Header background image
		try {
			if (fs.existsSync('./assets/header-bg.png')) {
				doc.image('./assets/header-bg.png', 0, 0, {
					width: doc.page.width,
					height: 150,
				});
			}
		} catch (error) {
			console.log('No header background image found, skipping...');
		}

		// Title section with logo
		doc.save();
		try {
			if (fs.existsSync('./assets/logo.png')) {
				doc.image('./assets/logo.png', 72, 30, {
					fit: [100, 50],
					align: 'left',
				});
			}
		} catch (error) {
			console.log('No logo found, skipping...');
		}

		// Title text positioned next to logo
		doc
			.fontSize(28)
			.font('Helvetica-Bold')
			.fillColor('white')
			.text('Release Notes', 200, 40, {
				align: 'left',
			});

		doc.restore();

		// Version and Date
		doc
			.fontSize(16)
			.font('Helvetica')
			.fillColor('#7f8c8d')
			.text(`Version: ${tagName}`, 72, 180, {
				align: 'left',
			})
			.text(`Release Date: ${new Date().toLocaleDateString()}`, {
				align: 'left',
			});

		// Categories and their pull requests
		let yPosition = 250;

		for (const [category, prs] of Object.entries(categorizedPRs)) {
			if (prs.length > 0) {
				if (yPosition > doc.page.height - 150) {
					doc.addPage();
					yPosition = 72;
				}

				doc
					.fontSize(14)
					.font('Helvetica-Bold')
					.fillColor('#34495e')
					.text(category, 72, yPosition);

				yPosition += 30;

				prs.forEach((pr) => {
					if (yPosition > doc.page.height - 150) {
						doc.addPage();
						yPosition = 72;
					}

					doc
						.fontSize(12)
						.font('Helvetica')
						.fillColor('#2c3e50')
						.text(`• ${pr.title} (#${pr.number})`, 72, yPosition);

					yPosition += 20;
				});

				yPosition += 20;
			}
		}

		// Footer
		doc
			.fontSize(10)
			.font('Helvetica')
			.fillColor('#95a5a6')
			.text(
				`Generated on ${new Date().toLocaleDateString()}`,
				72,
				doc.page.height - 50,
				{
					align: 'center',
				}
			);

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
		console.log('\nRelease notes generated successfully!');
		console.log('Check the following files:');
		console.log(`- PDF: release-notes-v1.0.0.pdf`);
		console.log(`- Markdown: release-notes-v1.0.0.md`);
	} catch (error) {
		console.error('Failed to generate release notes:', error);
	}
}

if (require.main === module) {
	main();
}

module.exports = ReleaseNoteGenerator;
