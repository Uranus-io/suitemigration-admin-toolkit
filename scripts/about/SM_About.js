/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 *
 * Name: SuiteMigration Admin Toolkit — About content
 * Publisher: SuiteMigration (https://suitemigration.com)
 * License: SuiteMigration Free Utility License (See LICENSE file or https://suitemigration.com/license)
 *
 * Copyright (c) 2026 SuiteMigration. All rights reserved.
 * Provided "AS IS" without warranty of any kind.
 *
 * Content for the "About SuiteMigration" tab of the Suitelet.
 * Kept separate so the copy and its styling can be edited without touching
 * the deletion logic.
 *
 * IMPORTANT: this file must live in the same File Cabinet folder as
 * Del_SuiteLet.js, which loads it with the relative path "./SM_About".
 */
define([], function () {
	// CSS rules for the About tab. Injected into the Suitelet's <style> block.
	var styles =
		".sm-about { max-width:760px; padding:16px 2px 14px; font-size:13px; line-height:1.55; }" +
		".sm-about h2 { margin:0 0 10px; font-size:20px; color:#2b3a4a; }" +
		".sm-about h3 { margin:20px 0 6px; font-size:15px; color:#2b3a4a; }" +
		".sm-about p { margin:0 0 10px; }" +
		".sm-about-tagline { font-size:15px; font-weight:600; margin:0 0 12px; }" +
		".sm-about-list { margin:6px 0; padding-left:20px; }" +
		".sm-about-list li { margin-bottom:7px; }" +
		".sm-about-links { margin:6px 0; padding-left:20px; }" +
		".sm-about-links li { margin-bottom:6px; }" +
		".sm-about-links a { color:#1565c0; font-weight:600; text-decoration:none; }" +
		".sm-about-links a:hover { text-decoration:underline; }" +
		"";

	// Markup for the About tab.
	var html =
		'<div class="sm-about">' +
		"<h2>SuiteMigration</h2>" +
		'<p class="sm-about-tagline">Migration without the migraine &mdash; NetSuite migrations that don\'t drag on for months.</p>' +
		"<p>SuiteMigration gives your NetSuite practice the tools to migrate data from " +
		"<b>QuickBooks</b> and <b>Xero</b> &mdash; accurately, auditably, and in a fraction of the " +
		"time. No more spreadsheets or manual trial-balance detective work.</p>" +
		"<h3>Key features</h3>" +
		'<ul class="sm-about-list">' +
		"<li><b>Painless &amp; rapid</b> &mdash; complete migrations in a fraction of the time, " +
		"eliminating manual work and spreadsheets.</li>" +
		"<li><b>Automated data mapping</b> &mdash; AI-assisted mapping matches fields instantly " +
		"between systems, with no VLOOKUPs or spreadsheet juggling.</li>" +
		"<li><b>Migration Readiness Audit</b> &mdash; surfaces records that would fail NetSuite " +
		"validation before the migration starts, with a white-labeled report of the findings.</li>" +
		"<li><b>Trial balance audit reports</b> &mdash; your NetSuite trial balance is checked " +
		"period-by-period against the source, so your books match to the penny.</li>" +
		"<li><b>Line-item audit reports</b> &mdash; every customer, vendor, bill, invoice, and payment " +
		"is individually verified against the source, so nothing slips through unnoticed.</li>" +
		"<li><b>Zero downtime</b> &mdash; multiple sandbox dry-run migrations validate everything " +
		"before go-live, preventing business interruption.</li>" +
		"<li><b>Progress tracking &amp; error resolution</b> &mdash; monitor migration milestones in " +
		"real time and resolve mismatches through guided suggestions.</li>" +
		"</ul>" +
		"<h3>Enterprise-grade security</h3>" +
		'<ul class="sm-about-list">' +
		"<li><b>Encrypted data transfers</b> &mdash; client data moves through fully encrypted " +
		"channels with end-to-end protection.</li>" +
		"<li><b>MFA &amp; audit logging</b> &mdash; multi-factor authentication on every login, and " +
		"every mapping change, push, error, and retry is logged.</li>" +
		"<li><b>Complete data integrity</b> &mdash; full historical transaction migration with " +
		"accuracy and zero data loss.</li>" +
		"</ul>" +
		"<h3>For NetSuite consultants</h3>" +
		"<p>Offer your clients full historical transaction migration &mdash; a capability many " +
		"consultants can't match &mdash; complete more projects in the same amount of time, and " +
		"cut implementation time dramatically.</p>" +
		"<h3>About this toolkit</h3>" +
		"<p>The <b>SuiteMigration Admin Toolkit</b> is a free utility for NetSuite Administrators " +
		"and Consultants. It performs bulk cleanup and data resets &mdash; useful when you need to " +
		"re-run a migration, clear down a Sandbox, or remove test data from an account.</p>" +
		"<p>Deletions performed by this tool are permanent and cannot be undone &mdash; a confirmation " +
		"summary is shown for you to review before anything is deleted.</p>" +
		"<h3>Learn more</h3>" +
		'<ul class="sm-about-links">' +
		'<li><a href="https://suitemigration.com/" target="_blank" rel="noopener noreferrer">SuiteMigration website</a>' +
		" &mdash; product overview</li>" +
		'<li><a href="https://suitemigration.com/how-it-works/" target="_blank" rel="noopener noreferrer">How It Works</a>' +
		" &mdash; the full migration journey, step by step</li>" +
		'<li><a href="https://suitemigration.com/contact/" target="_blank" rel="noopener noreferrer">Contact Us</a>' +
		" &mdash; book a demo or a free consultation</li>" +
		'<li><a href="https://github.com/Uranus-io/suitemigration-admin-toolkit" target="_blank" rel="noopener noreferrer">Toolkit source on GitHub</a>' +
		" &mdash; scripts, deployment guide and release notes</li>" +
		'<li><a href="https://github.com/Uranus-io/suitemigration-admin-toolkit/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">SuiteMigration Free Utility License</a>' +
		" &mdash; the licence terms this toolkit is provided under</li>" +
		"</ul></div>";

	return { styles: styles, html: html };
});
