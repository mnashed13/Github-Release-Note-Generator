const axios = require('axios');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
	fs.mkdirSync(outputDir, { recursive: true });
	console.log(`Created output directory at: ${outputDir}`);
}

class ReleaseNoteGenerator {
	constructor(owner, repo, token) {
		this.owner = owner;
		this.repo = repo;
		this.token = token;
		this.apiBaseUrl = 'https://api.github.com';
		console.log(`Initialized generator for ${owner}/${repo}`);
	}

	async generateReleaseNotes(endTagName, startTagName = null, options = {}) {
		console.log('\n=== Starting Release Notes Generation ===');
		console.log(`End Version: ${endTagName}`);
		console.log(`Start Version: ${startTagName || 'Previous Release'}`);

		try {
			// Get release information for the end tag
			console.log('\nFetching end release information...');
			const endRelease = await this.getReleaseByTag(endTagName);
			if (!endRelease) {
				throw new Error(`Release with tag ${endTagName} not found`);
			}
			console.log(
				`Found end release: ${endRelease.tag_name} (${endRelease.created_at})`
			);

			let startDate;
			if (startTagName) {
				console.log('\nFetching start release information...');
				const startRelease = await this.getReleaseByTag(startTagName);
				if (!startRelease) {
					throw new Error(`Release with tag ${startTagName} not found`);
				}
				startDate = new Date(startRelease.created_at);
				console.log(
					`Found start release: ${startRelease.tag_name} (${startDate})`
				);
			} else {
				console.log('\nFetching previous release...');
				const previousRelease = await this.getPreviousRelease(endTagName);
				startDate = previousRelease
					? new Date(previousRelease.created_at)
					: null;
				console.log(
					startDate
						? `Found previous release: ${previousRelease.tag_name} (${startDate})`
						: 'No previous release found'
				);
			}

			// Get all pull requests merged between the releases
			console.log('\nFetching pull requests...');
			const pullRequests = await this.getMergedPullRequests(
				new Date(endRelease.created_at),
				startDate
			);
			console.log(`Found ${pullRequests.length} merged pull requests`);

			// Categorize pull requests
			console.log('\nCategorizing pull requests...');
			const categorizedPRs = this.categorizePullRequests(pullRequests);
			for (const [category, prs] of Object.entries(categorizedPRs)) {
				console.log(`${category}: ${prs.length} PRs`);
			}

			// Generate formatted release notes
			console.log('\nGenerating formatted release notes...');
			const releaseNotes = this.formatReleaseNotes(
				categorizedPRs,
				endTagName,
				startTagName
			);

			// Generate email content if requested
			if (options.generateEmail) {
				console.log('\nGenerating email content...');
				const emailContent = await this.generateEmailContent(
					endTagName,
					categorizedPRs,
					options
				);
				if (options.sendEmail) {
					await this.sendEmail(emailContent, {
						tagName: endTagName,
						...options,
					});
				}
				return { releaseNotes, emailContent };
			}

			console.log('\n=== Release Notes Generation Complete ===');
			return { releaseNotes };
		} catch (error) {
			console.error('\n=== Error Generating Release Notes ===');
			console.error('Error details:', error);
			console.error('Stack trace:', error.stack);
			throw error;
		}
	}

	async getReleaseByTag(tagName) {
		console.log(`Fetching release info for tag: ${tagName}`);
		try {
			const config = {
				headers: {
					Authorization: `token ${this.token}`,
					Accept: 'application/vnd.github.v3+json',
				},
			};

			const url = `${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/releases/tags/${tagName}`;
			console.log(`Making request to: ${url}`);

			const response = await axios.get(url, config);
			console.log(`Successfully fetched release data for ${tagName}`);
			return response.data;
		} catch (error) {
			if (error.response && error.response.status === 404) {
				console.log(`No release found for tag: ${tagName}`);
				return null;
			}
			console.error(
				`Error fetching release for tag ${tagName}:`,
				error.message
			);
			throw error;
		}
	}

	async getPreviousRelease(currentTagName) {
		try {
			const config = {
				headers: {
					Authorization: `token ${this.token}`,
					Accept: 'application/vnd.github.v3+json',
				},
			};

			const response = await axios.get(
				`${this.apiBaseUrl}/repos/${this.owner}/${this.repo}/releases`,
				{
					...config,
					params: {
						per_page: 100,
					},
				}
			);

			const releases = response.data;
			const currentReleaseIndex = releases.findIndex(
				(release) => release.tag_name === currentTagName
			);

			if (
				currentReleaseIndex === -1 ||
				currentReleaseIndex === releases.length - 1
			) {
				return null;
			}

			return releases[currentReleaseIndex + 1];
		} catch (error) {
			console.error('Error fetching previous release:', error.message);
			throw error;
		}
	}

	async getMergedPullRequests(endDate, startDate = null) {
		console.log('\n=== Fetching Pull Requests ===');
		console.log(
			`Date Range: ${
				startDate ? startDate.toISOString() : 'Beginning'
			} to ${endDate.toISOString()}`
		);

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

			// Filter for merged pull requests within the date range
			const filteredPRs = response.data.filter((pr) => {
				if (!pr.merged_at) return false;

				const mergedDate = new Date(pr.merged_at);
				if (mergedDate > endDate) return false;
				if (startDate && mergedDate <= startDate) return false;

				return true;
			});

			console.log(
				`\nFound ${filteredPRs.length} merged pull requests in date range:`
			);
			filteredPRs.forEach((pr) => {
				console.log(`\n- PR #${pr.number}: ${pr.title}`);
				console.log(`  Author: ${pr.user.login}`);
				console.log(`  Merged: ${new Date(pr.merged_at).toLocaleString()}`);
				console.log(
					`  Labels: ${
						pr.labels.map((label) => label.name).join(', ') || 'None'
					}`
				);
				if (pr.body) {
					const description = pr.body.split('\n')[0]; // First line of description
					console.log(`  Description: ${description}`);
				}
			});

			return filteredPRs;
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

	formatReleaseNotes(categorizedPRs, endTagName, startTagName = null) {
		console.log('\n=== Formatting Release Notes ===');
		console.log(
			`Generating notes for ${endTagName}${
				startTagName ? ` (from ${startTagName})` : ''
			}`
		);

		let markdownNotes = `# Release Notes - ${endTagName}`;
		if (startTagName) {
			markdownNotes += ` (Changes since ${startTagName})`;
		}
		markdownNotes += '\n\n';

		// Generate email content
		let emailReleaseNotes = '';
		let totalPRs = 0;
		console.log('\nChanges by category:');

		for (const [category, prs] of Object.entries(categorizedPRs)) {
			console.log(`\n${category} (${prs.length} changes):`);

			if (prs.length > 0) {
				markdownNotes += `## ${category}\n\n`;
				emailReleaseNotes += `\n${category}:\n`;

				prs.forEach((pr) => {
					const prLine = `- ${pr.title} (#${pr.number})`;
					markdownNotes += prLine + '\n';
					emailReleaseNotes += prLine + '\n';
					console.log(prLine);

					// Log additional details in console only
					console.log(`  Author: ${pr.user.login}`);
					console.log(`  Merged: ${new Date(pr.merged_at).toLocaleString()}`);
					if (pr.body) {
						const description = pr.body.split('\n')[0];
						console.log(`  Description: ${description}`);
					}
					console.log(''); // Empty line for readability

					totalPRs++;
				});
				markdownNotes += '\n';
				emailReleaseNotes += '\n';
			}
		}

		if (totalPRs === 0) {
			const message = 'No pull requests found for this release period.';
			console.log(`\n⚠️  ${message}`);
			markdownNotes += `> ${message}\n`;
			emailReleaseNotes += `> ${message}\n`;
		} else {
			console.log(`\nTotal changes: ${totalPRs} pull requests`);
		}

		// Clean up old files
		this.cleanupOldFiles();

		// Generate PDF and Markdown files
		this.generatePDF(categorizedPRs, endTagName);
		this.generateMarkdownFile(markdownNotes, endTagName);

		// Generate email file
		this.generateEmailFile(emailReleaseNotes, endTagName, startTagName);

		return markdownNotes;
	}

	cleanupOldFiles() {
		try {
			// Ensure output directory exists before cleaning
			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true });
				return; // No files to clean if directory was just created
			}

			const files = fs.readdirSync(outputDir);
			const releaseNoteFiles = files.filter(
				(file) =>
					file.startsWith('release-notes-') &&
					(file.endsWith('.pdf') || file.endsWith('.md'))
			);

			releaseNoteFiles.forEach((file) => {
				const filePath = path.join(outputDir, file);
				fs.unlinkSync(filePath);
				console.log(`Cleaned up old file: ${file}`);
			});
		} catch (error) {
			console.error('Error cleaning up old files:', error.message);
		}
	}

	generateMarkdownFile(markdownContent, tagName) {
		try {
			// Ensure output directory exists
			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true });
			}

			const outputPath = path.join(outputDir, `release-notes-${tagName}.md`);
			fs.writeFileSync(outputPath, markdownContent);
			console.log(`Markdown file generated successfully: ${outputPath}`);

			// Verify file was created and has content
			if (fs.existsSync(outputPath)) {
				const content = fs.readFileSync(outputPath, 'utf8');
				if (!content) {
					console.error('Warning: Generated markdown file is empty');
				} else {
					console.log(
						`Generated ${content.split('\n').length} lines of content`
					);
				}
			} else {
				console.error('Error: Failed to create markdown file');
			}
		} catch (error) {
			console.error('Error generating markdown file:', error.message);
			throw error;
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

		// Ensure output directory exists
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		const outputPath = path.join(outputDir, `release-notes-${tagName}.pdf`);
		const writeStream = fs.createWriteStream(outputPath);

		// Handle write stream errors
		writeStream.on('error', (error) => {
			console.error('Error writing PDF file:', error.message);
		});

		doc.pipe(writeStream);

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

	async generateEmailContent(tagName, categorizedPRs, options = {}) {
		try {
			// Read email template
			const templatePath = './Template/email-template.eml';
			let emailTemplate = fs.readFileSync(templatePath, 'utf8');

			// Generate release notes in a format suitable for email
			let emailReleaseNotes = '';
			for (const [category, prs] of Object.entries(categorizedPRs)) {
				if (prs.length > 0) {
					emailReleaseNotes += `\n${category}:\n`;
					prs.forEach((pr) => {
						emailReleaseNotes += `- ${pr.title} (#${pr.number})\n`;
					});
					emailReleaseNotes += '\n';
				}
			}

			// Replace placeholders in the template
			const replacements = {
				'{from_email}':
					options.fromEmail ||
					process.env.EMAIL_FROM ||
					'release-bot@example.com',
				'{to_email}':
					options.toEmail || process.env.EMAIL_TO || 'team@example.com',
				'{cc_email}': options.ccEmail || process.env.EMAIL_CC || '',
				'{product_name}': options.productName || this.repo,
				'{release_version}': tagName,
				'{prior_release_version}': options.priorVersion || 'previous version',
				'{release_notes}': emailReleaseNotes,
			};

			Object.entries(replacements).forEach(([key, value]) => {
				emailTemplate = emailTemplate.replace(new RegExp(key, 'g'), value);
			});

			return emailTemplate;
		} catch (error) {
			console.error('Error generating email content:', error.message);
			throw error;
		}
	}

	async sendEmail(emailContent, options = {}) {
		try {
			const transporter = nodemailer.createTransport({
				host: process.env.SMTP_HOST,
				port: process.env.SMTP_PORT,
				secure: process.env.SMTP_SECURE === 'true',
				auth: {
					user: process.env.SMTP_USER,
					pass: process.env.SMTP_PASS,
				},
			});

			const attachments = [];
			const pdfPath = path.join(
				outputDir,
				`release-notes-${options.tagName}.pdf`
			);
			const mdPath = path.join(
				outputDir,
				`release-notes-${options.tagName}.md`
			);

			if (fs.existsSync(pdfPath)) {
				attachments.push({
					filename: `release-notes-${options.tagName}.pdf`,
					path: pdfPath,
				});
			}

			if (fs.existsSync(mdPath)) {
				attachments.push({
					filename: `release-notes-${options.tagName}.md`,
					path: mdPath,
				});
			}

			const [headers, body] = emailContent.split('\n\n');
			const headerLines = headers.split('\n');
			const emailHeaders = {};

			headerLines.forEach((line) => {
				const [key, value] = line.split(': ');
				emailHeaders[key.toLowerCase()] = value;
			});

			const mailOptions = {
				from: emailHeaders.from,
				to: emailHeaders.to,
				cc: emailHeaders.cc,
				subject: emailHeaders.subject,
				text: body,
				attachments,
			};

			const info = await transporter.sendMail(mailOptions);
			console.log('Email sent successfully:', info.messageId);
			return info;
		} catch (error) {
			console.error('Error sending email:', error.message);
			throw error;
		}
	}

	generateEmailFile(releaseNotes, endTagName, startTagName) {
		try {
			console.log('\nGenerating email file...');

			// Read email template
			const templatePath = path.join(
				__dirname,
				'Template',
				'email-template.eml'
			);
			let emailTemplate = fs.readFileSync(templatePath, 'utf8');

			// Replace placeholders in the template
			const replacements = {
				'{from_email}': process.env.EMAIL_FROM || 'release-bot@example.com',
				'{to_email}': process.env.EMAIL_TO || 'team@example.com',
				'{cc_email}': process.env.EMAIL_CC || '',
				'{product_name}': this.repo,
				'{release_version}': endTagName,
				'{prior_release_version}': startTagName || 'previous version',
				'{release_notes}': releaseNotes,
			};

			Object.entries(replacements).forEach(([key, value]) => {
				emailTemplate = emailTemplate.replace(new RegExp(key, 'g'), value);
			});

			// Write email file
			const emailPath = path.join(outputDir, `release-notes-${endTagName}.eml`);
			fs.writeFileSync(emailPath, emailTemplate);
			console.log(`Email file generated successfully: ${emailPath}`);

			// Verify file was created and has content
			if (fs.existsSync(emailPath)) {
				const content = fs.readFileSync(emailPath, 'utf8');
				if (!content) {
					console.error('Warning: Generated email file is empty');
				} else {
					console.log(
						`Generated email file with ${content.split('\n').length} lines`
					);
				}
			} else {
				console.error('Error: Failed to create email file');
			}
		} catch (error) {
			console.error('Error generating email file:', error.message);
			throw error;
		}
	}

	async main() {
		console.log('\n=== Starting Release Note Generator ===');
		console.log('Environment Check:');
		console.log(
			`GITHUB_OWNER: ${process.env.GITHUB_OWNER ? 'Set' : 'Not Set'}`
		);
		console.log(`GITHUB_REPO: ${process.env.GITHUB_REPO ? 'Set' : 'Not Set'}`);
		console.log(
			`GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? 'Set' : 'Not Set'}`
		);
		console.log(`END_VERSION: ${process.env.END_VERSION || 'Not Set'}`);
		console.log(`START_VERSION: ${process.env.START_VERSION || 'Not Set'}`);

		if (!process.env.GITHUB_TOKEN) {
			console.error('Error: Please set GITHUB_TOKEN environment variable');
			process.exit(1);
		}

		// Get command line arguments
		const args = process.argv.slice(2);
		const endVersion = args[0] || process.env.END_VERSION;
		const startVersion = args[1] || process.env.START_VERSION || null;

		if (!endVersion) {
			console.error('Error: No end version specified');
			console.error('Please provide version either through:');
			console.error(
				'1. Command line: node releaseNoteGenerator.js <endVersion> [startVersion]'
			);
			console.error(
				'2. Environment variables in .env file: END_VERSION and optionally START_VERSION'
			);
			process.exit(1);
		}

		console.log(`\nUsing versions:`);
		console.log(`End Version: ${endVersion}`);
		console.log(`Start Version: ${startVersion || 'Previous Release'}`);

		const generator = new ReleaseNoteGenerator(
			process.env.GITHUB_OWNER || 'owner',
			process.env.GITHUB_REPO || 'repo',
			process.env.GITHUB_TOKEN
		);

		try {
			const releaseNotes = await generator.generateReleaseNotes(
				endVersion,
				startVersion
			);
			console.log('\nRelease notes generated successfully!');
			console.log('Check the following files:');
			console.log(
				`- PDF: ${path.join(outputDir, `release-notes-${endVersion}.pdf`)}`
			);
			console.log(
				`- Markdown: ${path.join(outputDir, `release-notes-${endVersion}.md`)}`
			);
		} catch (error) {
			console.error('\nFailed to generate release notes:', error.message);
			process.exit(1);
		}
	}
}

// Run the main function if this file is being run directly
if (require.main === module) {
	const generator = new ReleaseNoteGenerator();
	generator.main().catch((error) => {
		console.error('Fatal error:', error);
		process.exit(1);
	});
}

module.exports = ReleaseNoteGenerator;
