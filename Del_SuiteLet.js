/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @version v1.0
 *
 * Name: SuiteMigration Admin Toolkit
 * Description: Automated bulk cleanup and data reset utility for NetSuite Admins & Consultants.
 * Publisher: SuiteMigration (https://suitemigration.com)
 * License: SuiteMigration Free Utility License (See LICENSE file or https://suitemigration.com/license)
 *
 * Copyright (c) 2026 SuiteMigration. All rights reserved.
 * Provided "AS IS" without warranty of any kind.
 *
 * Suitelet to delete records by subsidiary and record type.
 * Triggers a Map/Reduce script to perform bulk deletion.
 *
 * This Suitelet calls the Map/Reduce script (Del_MapReduce.js).
 *
 * Required IDs for Map/Reduce (must match exactly):
 * - Script ID: customscript_sm_toolkit_delete_mr
 * - Deployment ID: customdeploy_sm_toolkit_delete_mr
 * - Parameters: custscript_sm_recordtype, custscript_sm_subsidiary,
 *   custscript_sm_externalid, custscript_sm_trandate_from, custscript_sm_trandate_to,
 *   custscript_sm_createddate_from, custscript_sm_createddate_to
 *
 * See DEPLOYMENT_GUIDE.md for full setup instructions.
 */
define([
	"N/ui/serverWidget",
	"N/task",
	"N/log",
	"N/search",
	"N/url",
	"N/runtime",
	"N/format",
	"N/cache",
], function (serverWidget, task, log, search, url, runtime, format, cache) {
	// Cache used to read back the final deleted/failed counts written by the
	// Map/Reduce script, so we can display them when the job completes.
	var RESULT_CACHE_NAME = "smAdminToolkit";
	var RESULT_CACHE_KEY = "lastDeleteResult";

	// Deletion order: payments/credits first, then invoices/bills, then JEs, then entities
	var GROUP_TYPES = {
		all_transactions: [
			"deposit",
			"customerpayment",
			"creditmemo",
			"invoice",
			"cashrefund",
			"cashsale",
			"vendorpayment",
			"vendorcredit",
			"vendorbill",
			"purchaseorder",
			"check",
			"cashexpense",
			"creditcardrefund",
			"creditcardcharge",
			"transfer",
			"journalentry",
			"journalentry_sm",
		],
		all_entities: ["job", "customer", "vendor", "employee", "item"],
		all_records: [
			"deposit",
			"customerpayment",
			"creditmemo",
			"invoice",
			"cashrefund",
			"cashsale",
			"vendorpayment",
			"vendorcredit",
			"vendorbill",
			"purchaseorder",
			"check",
			"cashexpense",
			"creditcardrefund",
			"creditcardcharge",
			"transfer",
			"journalentry",
			"journalentry_sm",
			"job",
			"customer",
			"vendor",
			"employee",
			"item",
		],
	};

	var RECORD_LABELS = {
		customer: "Customers",
		vendor: "Vendors",
		employee: "Employees",
		item: "Items",
		journalentry: "Journal Entries",
		journalentry_sm: "Journal Entries matching SuiteMigration Trial Balance push",
		deposit: "Deposits",
		invoice: "Invoices",
		cashsale: "Cash Sales",
		customerpayment: "Customer Payments",
		creditmemo: "Credit Memos",
		vendorbill: "Vendor Bills",
		vendorpayment: "Vendor Payments",
		vendorcredit: "Vendor Credits",
		check: "Checks",
		cashexpense: "Cash Expenses",
		creditcardcharge: "Credit Card Charges",
		creditcardrefund: "Credit Card Refunds",
		transfer: "Transfers",
		purchaseorder: "Purchase Orders",
		cashrefund: "Cash Refunds",
		job: "Projects",
	};

	function onRequest(context) {
		var action = context.request.parameters.action;

		if (action === "checkstatus") {
			handleStatusCheck(context);
			return;
		}

		if (context.request.method === "GET") {
			renderForm(context);
		} else if (context.request.method === "POST") {
			handleSubmit(context);
		}
	}

	function renderForm(context) {
		var form = serverWidget.createForm({
			title: "SuiteMigration Admin Toolkit",
		});

		// Build the date-field placeholder as a format pattern (e.g. DD/MM/YYYY
		// or MM/DD/YYYY) that matches the account's date preference. We format a
		// known date (31 Dec 2025) so the day/month/year are unambiguous, then
		// swap the numbers for DD/MM/YYYY tokens while keeping the account's own
		// separators and field order.
		var datePlaceholder = "";
		try {
			var sampleDate = format.format({
				value: new Date(2025, 11, 31),
				type: format.Type.DATE,
			});
			datePlaceholder = sampleDate
				.replace("2025", "YYYY")
				.replace("31", "DD")
				.replace("12", "MM")
				.replace("25", "YY");
		} catch (e) {
			datePlaceholder = "";
		}

		// --- Info text, CSS, and JS ---
		var filterField = form.addField({
			id: "custpage_filter_info",
			type: serverWidget.FieldType.INLINEHTML,
			label: " ",
		});
		filterField.updateLayoutType({
			layoutType: serverWidget.FieldLayoutType.OUTSIDEABOVE,
		});
		filterField.defaultValue =
			"<style>" +
			".uir-field-group-title { display: none !important; }" +
			".uir-field-group { border: none !important; background: transparent !important; padding: 0 !important; margin: 0 !important; }" +
			".custpage-date-layout { margin-top: 8px; }" +
			".custpage-date-row { display: flex; gap: 20px; flex-wrap: nowrap; }" +
			".custpage-date-row + .custpage-date-row { margin-top: 16px; }" +
			".custpage-date-field { display: flex; flex-direction: column; min-width: 330px; width: 330px; flex: 0 0 330px; }" +
			".custpage-date-field label { margin-bottom: 4px; }" +
			".custpage-date-field .uir-field-wrapper { display: block; width: auto !important; }" +
			".custpage-date-layout .uir-field, .custpage-date-layout .uir-field-wrapper { float: none !important; width: auto !important; }" +
			"#custpage_grp_dates_fields, #custpage_grp_dates_fields_fs { display: none !important; }" +
			"#custpage_trandatefrom, #custpage_trandateto, #custpage_createddatefrom, #custpage_createddateto { width: 240px !important; box-sizing: border-box; }" +
			"[id^='custpage_trandatefrom'], [id^='custpage_trandateto'], [id^='custpage_createddatefrom'], [id^='custpage_createddateto'] { display: none !important; }" +
			"label[for='custpage_trandatefrom']:not(.custpage-date-label), label[for='custpage_trandateto']:not(.custpage-date-label), label[for='custpage_createddatefrom']:not(.custpage-date-label), label[for='custpage_createddateto']:not(.custpage-date-label) { display: none !important; }" +
			".custpage-date-layout [id^='custpage_trandatefrom'], .custpage-date-layout [id^='custpage_trandateto'], .custpage-date-layout [id^='custpage_createddatefrom'], .custpage-date-layout [id^='custpage_createddateto'] { display: inline-block !important; }" +
			".custpage-date-layout .custpage-date-label { display: block !important; }" +
			".custpage-date-label { margin: 0 0 4px 0 !important; padding: 0 !important; width: auto !important; text-align: left; text-transform: uppercase; color: var(--custpage-label-color, inherit); font-size: calc(var(--custpage-label-size, 12px) - 2px); font-weight: normal; letter-spacing: var(--custpage-label-spacing, inherit); }" +
			".custpage-confirm-value { color: #7a3b00; background: #ffe6cc; padding: 0 4px; border-radius: 3px; font-weight: 700; border: 1px solid #ffcc99; }" +
			".sm-modal-overlay { display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.45); z-index:100000; }" +
			".sm-modal-overlay.sm-show { display:flex; align-items:center; justify-content:center; }" +
			".sm-modal { background:#fff; border-radius:8px; max-width:560px; width:90%; box-shadow:0 8px 30px rgba(0,0,0,0.25); overflow:hidden; }" +
			".sm-modal-header { background:#fff8e1; color:#8a6d00; font-weight:700; font-size:16px; padding:16px 20px; border-bottom:1px solid #ffe0a3; }" +
			".sm-modal-body { padding:18px 20px; color:#333; font-size:14px; line-height:1.5; }" +
			".sm-modal-note { padding:0 20px 4px; color:#a01212; font-size:12px; font-weight:600; }" +
			".sm-modal-footer { padding:14px 20px; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #eee; }" +
			".sm-btn { padding:9px 18px; border-radius:4px; font-size:14px; font-weight:600; cursor:pointer; border:1px solid transparent; }" +
			".sm-btn-cancel { background:#f0f0f0; color:#333; border:1px solid #ccc; }" +
			".sm-btn-cancel:hover { background:#e5e5e5; }" +
			".sm-btn-delete { background:#e53935; color:#fff; }" +
			".sm-btn-delete:hover { background:#d32f2f; }" +
			"</style>" +
			"<b>Getting started:</b> Select a Subsidiary, External ID option, and Record Type, then choose a Date Filter. A confirmation summary appears for you to review before anything is deleted.<br>" +
			"<ul style='margin:8px 0;padding-left:20px;line-height:1.5;'>" +
			"<li><b>External ID</b> &mdash; which records to target, based on their External ID:" +
			"<ul style='margin:4px 0;'>" +
			"<li>All records (Blank + All populated values) &mdash; every record, whether it has an External ID or not.</li>" +
			"<li>All populated values &mdash; records that have an External ID (any value).</li>" +
			"<li>Blank &mdash; records with no External ID.</li>" +
			"<li>All populated values that match SuiteMigration &mdash; records whose External ID matches the SuiteMigration format.</li>" +
			"</ul></li>" +
			"<li><b>Record Type</b> &mdash; a single record type, or a group option: All Records, All Entities (Customers, Vendors, Employees, Items, Projects), or All Transactions.</li>" +
			"<li><b>Date Filter</b> &mdash; how records are matched by date:" +
			"<ul style='margin:4px 0;'>" +
			"<li>Created Date &mdash; filters by the date each record was created (all record types).</li>" +
			"<li>Transaction Date &mdash; filters by transaction date (transactions only).</li>" +
			"<li>No Date Filter &mdash; deletes every matching record.</li>" +
			"</ul></li>" +
			"<li>The From date is optional &mdash; leave it blank to delete everything up to and including the To date.</li>" +
			"<li>All dates are inclusive &mdash; both the From and To dates fall within the deletion range.</li>" +
			"</ul>" +
			"<script>" +
			"(function() {" +
			"  var fieldIds = ['custpage_trandatefrom','custpage_trandateto','custpage_createddatefrom','custpage_createddateto'];" +
			"  var labelTextMap = {" +
			"    custpage_trandatefrom: 'TRANSACTION DATE FROM (OPTIONAL)'," +
			"    custpage_trandateto: 'TRANSACTION DATE TO <span style=\"font-size:14px;font-weight:600;color:#c77f02;padding:0 2px\">*</span>'," +
			"    custpage_createddatefrom: 'CREATION DATE FROM (OPTIONAL)'," +
			"    custpage_createddateto: 'CREATION DATE TO <span style=\"font-size:14px;font-weight:600;color:#c77f02;padding:0 2px\">*</span>'" +
			"  };" +
			"  function captureRefStyles() {" +
			"    var refLabel = document.querySelector('label[for=\"custpage_subsidiary\"]') || document.querySelector('label');" +
			"    if (!refLabel) return;" +
			"    var refStyle = window.getComputedStyle(refLabel);" +
			"    var refFontSize = parseFloat(refStyle.fontSize || '0');" +
			"    var smallFontSize = refFontSize ? (refFontSize - 2) + 'px' : '';" +
			"    var root = document.documentElement;" +
			"    if (root) {" +
			"      if (refStyle.color) root.style.setProperty('--custpage-label-color', refStyle.color);" +
			"      if (smallFontSize) root.style.setProperty('--custpage-label-size', smallFontSize);" +
			"      root.style.setProperty('--custpage-label-weight', 'normal');" +
			"      if (refStyle.letterSpacing) root.style.setProperty('--custpage-label-spacing', refStyle.letterSpacing);" +
			"    }" +
			"    var labels = document.querySelectorAll('.custpage-date-label');" +
			"    if (labels && labels.length) {" +
			"      labels.forEach(function(l) {" +
			"        l.style.color = refStyle.color;" +
			"        if (smallFontSize) { l.style.fontSize = smallFontSize; }" +
			"        l.style.fontWeight = 'normal';" +
			"        l.style.letterSpacing = refStyle.letterSpacing;" +
			"        l.style.textTransform = 'uppercase';" +
			"      });" +
			"    }" +
			"  }" +
			"  function moveField(fieldId, rowId) {" +
			"    var row = document.getElementById(rowId);" +
			"    if (!row) return false;" +
			"    var input = document.getElementById(fieldId);" +
			"    if (!input) return false;" +
			"    var wrapper = document.getElementById(fieldId + '_fs') || input.closest('.uir-field-wrapper') || input.closest('.uir-field') || input.parentElement;" +
			"    if (!wrapper) return false;" +
			"    if (wrapper.dataset && wrapper.dataset.moved === '1') return true;" +
			"    var box = document.createElement('div');" +
			"    box.className = 'custpage-date-field';" +
			"    var label = document.querySelector('label[for=\"' + fieldId + '\"]');" +
			"    if (label) {" +
			"      var clone = label.cloneNode(true);" +
			"      clone.className = 'custpage-date-label';" +
			"      clone.style.display = 'block';" +
			"      if (labelTextMap[fieldId]) {" +
			"        clone.innerHTML = labelTextMap[fieldId];" +
			"      } else {" +
			"        clone.textContent = (label.textContent || '').toUpperCase();" +
			"      }" +
			"      box.appendChild(clone);" +
			"    } else if (labelTextMap[fieldId]) {" +
			"      var newLabel = document.createElement('label');" +
			"      newLabel.className = 'custpage-date-label';" +
			"      newLabel.setAttribute('for', fieldId);" +
			"      newLabel.innerHTML = labelTextMap[fieldId];" +
			"      box.appendChild(newLabel);" +
			"    }" +
			"    box.appendChild(wrapper);" +
			"    if (wrapper.dataset) wrapper.dataset.moved = '1';" +
			"    row.appendChild(box);" +
			"    return true;" +
			"  }" +
			"  function applyPlaceholders() {" +
			"    fieldIds.forEach(function(id) {" +
			"      var el = document.getElementById(id);" +
			"      if (el) el.placeholder = " + JSON.stringify(datePlaceholder) + ";" +
			"    });" +
			"  }" +
			"  function tryMoveAll() {" +
			"    var moved = 0;" +
			"    if (moveField('custpage_trandatefrom','custpage_tran_row')) moved++;" +
			"    if (moveField('custpage_trandateto','custpage_tran_row')) moved++;" +
			"    if (moveField('custpage_createddatefrom','custpage_create_row')) moved++;" +
			"    if (moveField('custpage_createddateto','custpage_create_row')) moved++;" +
			"    return moved === 4;" +
			"  }" +
			"  var lastState = '';" +
			"  var hasTrandateOpt = true;" +
			"  function updateConfirmation() {" +
			"    var div = document.getElementById('custpage_confirmation_text');" +
			"    if (!div) return;" +
			"    var sub = ''; var rec = ''; var mode = 'all'; var pm = '';" +
			"    var subVal = ''; var recVal = ''; var pmVal = '';" +
			"    try { subVal = nlapiGetFieldValue('custpage_subsidiary') || ''; } catch(e) {}" +
			"    try { recVal = nlapiGetFieldValue('custpage_recordtype') || ''; } catch(e) {}" +
			"    try { pmVal = nlapiGetFieldValue('custpage_externalid') || ''; } catch(e) {}" +
			"    if (!subVal || !recVal || !pmVal) { div.innerHTML = ''; return; }" +
			"    try { sub = nlapiGetFieldText('custpage_subsidiary') || ''; } catch(e) {}" +
			"    try { rec = nlapiGetFieldText('custpage_recordtype') || ''; } catch(e) {}" +
			"    try { pm = nlapiGetFieldText('custpage_externalid') || ''; } catch(e) {}" +
			"    try { mode = nlapiGetFieldValue('custpage_datefilter') || 'all'; } catch(e) {}" +
			"    var isGroup = (recVal === 'all_records' || recVal === 'all_entities' || recVal === 'all_transactions');" +
			"    var groupDesc = '';" +
			"    if (recVal === 'all_records') groupDesc = 'all transactions and all entity/item records';" +
			"    else if (recVal === 'all_entities') groupDesc = 'all Project, Customer, Vendor, Employee, and Item records';" +
			"    else if (recVal === 'all_transactions') groupDesc = 'all transaction records (Deposits, Cash Refunds, Cash Sales, Invoices, Customer Payments, Credit Memos, Vendor Bills, Vendor Payments, Vendor Credits, Purchase Orders, Checks, Cash Expenses, Credit Card Charges, Credit Card Refunds, Transfers, Journal Entries)';" +
			"    var msg = '';" +
			"    var pmDesc = ' (<span class=\"custpage-confirm-value\">' + pm + '</span>)';" +
			"    if (mode === 'all') {" +
			"      if (isGroup) {" +
			"        msg = '<b>Warning:</b> This will delete <span class=\"custpage-confirm-value\">' + groupDesc + '</span> in <span class=\"custpage-confirm-value\">' + sub + '</span> subsidiary' + pmDesc + '. No date filtering will be applied &mdash; every record of these types in this subsidiary will be deleted.';" +
			"      } else {" +
			"        msg = '<b>Warning:</b> This will delete <span class=\"custpage-confirm-value\">ALL ' + rec + '</span> records in <span class=\"custpage-confirm-value\">' + sub + '</span> subsidiary' + pmDesc + '. No date filtering will be applied &mdash; every record of this type in this subsidiary will be deleted.';" +
			"      }" +
			"    } else if (mode === 'trandate') {" +
			"      var f = ''; var t = '';" +
			"      var label = isGroup ? groupDesc : rec;" +
			"      try { f = nlapiGetFieldValue('custpage_trandatefrom') || ''; } catch(e) {}" +
			"      try { t = nlapiGetFieldValue('custpage_trandateto') || ''; } catch(e) {}" +
			"      if (f && t) {" +
			"        msg = 'This will delete <span class=\"custpage-confirm-value\">' + label + '</span> in <span class=\"custpage-confirm-value\">' + sub + '</span> subsidiary with transaction dates from <span class=\"custpage-confirm-value\">' + f + '</span> to <span class=\"custpage-confirm-value\">' + t + '</span>. Records outside this date range will not be deleted.';" +
			"      } else if (t) {" +
			"        msg = 'This will delete <span class=\"custpage-confirm-value\">' + label + '</span> in <span class=\"custpage-confirm-value\">' + sub + '</span> subsidiary with transaction dates before and including <span class=\"custpage-confirm-value\">' + t + '</span>. All records with transaction dates after <span class=\"custpage-confirm-value\">' + t + '</span> will not be deleted.';" +
			"      }" +
			"    } else if (mode === 'createddate') {" +
			"      var f = ''; var t = '';" +
			"      var label = isGroup ? groupDesc : rec;" +
			"      try { f = nlapiGetFieldValue('custpage_createddatefrom') || ''; } catch(e) {}" +
			"      try { t = nlapiGetFieldValue('custpage_createddateto') || ''; } catch(e) {}" +
			"      if (f && t) {" +
			"        msg = 'This will delete <span class=\"custpage-confirm-value\">' + label + '</span> in <span class=\"custpage-confirm-value\">' + sub + '</span> subsidiary with creation dates from <span class=\"custpage-confirm-value\">' + f + '</span> to <span class=\"custpage-confirm-value\">' + t + '</span>. Records outside this date range will not be deleted.';" +
			"      } else if (t) {" +
			"        msg = 'This will delete <span class=\"custpage-confirm-value\">' + label + '</span> in <span class=\"custpage-confirm-value\">' + sub + '</span> subsidiary with creation dates before and including <span class=\"custpage-confirm-value\">' + t + '</span>. All records with creation dates after <span class=\"custpage-confirm-value\">' + t + '</span> will not be deleted.';" +
			"      }" +
			"    }" +
			"    window.__smMsg = msg;" +
			"    div.innerHTML = msg ? '<div style=\"padding:10px;background:#fff3e0;border:1px solid #ff9800;border-radius:4px;margin-top:10px;color:#e65100;font-weight:bold;width:580px;\">' + msg + '</div>' : '';" +
			"  }" +
			"  function toggleDateFields() {" +
			"    var mode = 'all'; var recType = ''; var sub = ''; var pmv = '';" +
			"    var tf = ''; var tt = ''; var cf = ''; var ct = '';" +
			"    try { mode = nlapiGetFieldValue('custpage_datefilter') || 'all'; } catch(e) {}" +
			"    try { recType = nlapiGetFieldValue('custpage_recordtype') || ''; } catch(e) {}" +
			"    try { sub = nlapiGetFieldValue('custpage_subsidiary') || ''; } catch(e) {}" +
			"    try { pmv = nlapiGetFieldValue('custpage_externalid') || ''; } catch(e) {}" +
			"    try { tf = nlapiGetFieldValue('custpage_trandatefrom') || ''; } catch(e) {}" +
			"    try { tt = nlapiGetFieldValue('custpage_trandateto') || ''; } catch(e) {}" +
			"    try { cf = nlapiGetFieldValue('custpage_createddatefrom') || ''; } catch(e) {}" +
			"    try { ct = nlapiGetFieldValue('custpage_createddateto') || ''; } catch(e) {}" +
			"    var state = mode + '|' + recType + '|' + sub + '|' + pmv + '|' + tf + '|' + tt + '|' + cf + '|' + ct;" +
			"    if (state === lastState) return;" +
			"    lastState = state;" +
			"    var isEntity = (recType === 'customer' || recType === 'vendor' || recType === 'employee' || recType === 'item' || recType === 'job' || recType === 'all_records' || recType === 'all_entities');" +
			"    if (isEntity && hasTrandateOpt) {" +
			"      try {" +
			"        nlapiRemoveSelectOption('custpage_datefilter', 'trandate');" +
			"        hasTrandateOpt = false;" +
			"        if (mode === 'trandate') {" +
			"          nlapiSetFieldValue('custpage_datefilter', 'createddate');" +
			"          mode = 'createddate';" +
			"        }" +
			"      } catch(e) {}" +
			"    } else if (!isEntity && !hasTrandateOpt && recType) {" +
			"      try {" +
			"        nlapiRemoveSelectOption('custpage_datefilter', null);" +
			"        nlapiInsertSelectOption('custpage_datefilter', 'createddate', 'Created Date');" +
			"        nlapiInsertSelectOption('custpage_datefilter', 'trandate', 'Transaction Date');" +
			"        nlapiInsertSelectOption('custpage_datefilter', 'all', 'No Date Filter');" +
			"        hasTrandateOpt = true;" +
			"        nlapiSetFieldValue('custpage_datefilter', mode);" +
			"      } catch(e) {}" +
			"    }" +
			"    var layout = document.getElementById('custpage_date_layout');" +
			"    if (!layout) return;" +
			"    var tranRow = document.getElementById('custpage_tran_row');" +
			"    var createRow = document.getElementById('custpage_create_row');" +
			"    if (mode === 'trandate') {" +
			"      layout.style.display = 'block';" +
			"      if (tranRow) tranRow.style.display = 'flex';" +
			"      if (createRow) createRow.style.display = 'none';" +
			"    } else if (mode === 'createddate') {" +
			"      layout.style.display = 'block';" +
			"      if (tranRow) tranRow.style.display = 'none';" +
			"      if (createRow) createRow.style.display = 'flex';" +
			"    } else {" +
			"      layout.style.display = 'none';" +
			"    }" +
			"    updateConfirmation();" +
			"  }" +
			"  function updateSubmitButton() {" +
			"    var sub='', rec='', pm='', mode='all', tt='', ct='';" +
			"    try { sub = nlapiGetFieldValue('custpage_subsidiary') || ''; } catch(e) {}" +
			"    try { rec = nlapiGetFieldValue('custpage_recordtype') || ''; } catch(e) {}" +
			"    try { pm = nlapiGetFieldValue('custpage_externalid') || ''; } catch(e) {}" +
			"    try { mode = nlapiGetFieldValue('custpage_datefilter') || 'all'; } catch(e) {}" +
			"    try { tt = nlapiGetFieldValue('custpage_trandateto') || ''; } catch(e) {}" +
			"    try { ct = nlapiGetFieldValue('custpage_createddateto') || ''; } catch(e) {}" +
			"    var ok = !!sub && !!rec && !!pm;" +
			"    if (ok && mode === 'trandate') ok = !!tt;" +
			"    if (ok && mode === 'createddate') ok = !!ct;" +
			"    var btns = [];" +
			"    var ids = ['submitter','secondarysubmitter'];" +
			"    for (var k = 0; k < ids.length; k++) { var e = document.getElementById(ids[k]); if (e) btns.push(e); }" +
			"    var nodes = document.querySelectorAll('input[type=\"submit\"], button, input.rndbuttoninpt, a.rndbuttoninpt');" +
			"    for (var n = 0; n < nodes.length; n++) {" +
			"      var node = nodes[n];" +
			"      var lbl = (node.value || node.textContent || '').replace(/\\s+/g, ' ').trim();" +
			"      if (lbl === 'Preview Deletion' && btns.indexOf(node) === -1) btns.push(node);" +
			"    }" +
			"    var tip = ok ? '' : 'Select a subsidiary, External ID option, and record type (and a To date when a date range is chosen) to continue.';" +
			"    function styleEl(el, off) {" +
			"      if (!el) return;" +
			"      var props = { 'background-color':'#8b929b','background-image':'none','color':'#f4f5f6','border-color':'#8b929b','border-top-color':'#8b929b','border-bottom-color':'#8b929b','border-left-color':'#8b929b','border-right-color':'#8b929b','box-shadow':'none','text-shadow':'none','outline':'none','opacity':'1' };" +
			"      for (var p in props) {" +
			"        if (off) { el.style.setProperty(p, props[p], 'important'); } else { el.style.removeProperty(p); }" +
			"      }" +
			"      el.style.filter = '';" +
			"      el.style.cursor = off ? 'not-allowed' : '';" +
			"      el.style.pointerEvents = off ? 'none' : '';" +
			"    }" +
			"    for (var i = 0; i < btns.length; i++) {" +
			"      var b = btns[i];" +
			"      try { b.disabled = !ok; } catch(e) {}" +
			"      b.title = tip;" +
			"      styleEl(b, !ok);" +
			"      styleEl(b.parentElement, !ok);" +
			"    }" +
			"    smSetup();" +
			"  }" +
			"  function smGetMsg() {" +
			"    if (window.__smMsg && window.__smMsg.replace(/\\s/g,'') !== '') return window.__smMsg;" +
			"    return 'You are about to permanently delete the selected records. Do you want to proceed?';" +
			"  }" +
			"  function smShowModal() {" +
			"    var body = document.getElementById('smModalBody');" +
			"    var overlay = document.getElementById('smModalOverlay');" +
			"    if (!body || !overlay) return;" +
			"    body.innerHTML = smGetMsg();" +
			"    overlay.className = 'sm-modal-overlay sm-show';" +
			"  }" +
			"  function smHideModal() {" +
			"    var overlay = document.getElementById('smModalOverlay');" +
			"    if (overlay) overlay.className = 'sm-modal-overlay';" +
			"  }" +
			"  function smSetup() {" +
			"    var c = document.getElementById('smCancelBtn');" +
			"    var d = document.getElementById('smConfirmBtn');" +
			"    if (c && !c.getAttribute('data-wired')) { c.setAttribute('data-wired','1'); c.addEventListener('click', function(){ smHideModal(); }); }" +
			"    if (d && !d.getAttribute('data-wired')) { d.setAttribute('data-wired','1'); d.addEventListener('click', function(){ window.__smConfirmed = true; smHideModal(); if (window.__smPendingBtn) { window.__smPendingBtn.click(); } }); }" +
			"  }" +
			"  function init() {" +
			"    captureRefStyles();" +
			"    applyPlaceholders();" +
			"    updateSubmitButton();" +
			"    setInterval(toggleDateFields, 300);" +
			"    setInterval(updateSubmitButton, 300);" +
			"    document.addEventListener('click', function(e) {" +
			"      var t = e.target;" +
			"      var btn = (t && t.closest) ? t.closest('input[type=\"submit\"], button, .rndbuttoninpt, a.rndbuttoninpt') : null;" +
			"      if (!btn) return;" +
			"      var lbl = (btn.value || btn.textContent || '').replace(/\\s+/g,' ').trim();" +
			"      var isDel = (btn.id === 'submitter' || btn.id === 'secondarysubmitter' || lbl === 'Preview Deletion');" +
			"      if (!isDel) return;" +
			"      if (window.__smConfirmed) return;" +
			"      e.preventDefault(); e.stopImmediatePropagation();" +
			"      window.__smPendingBtn = btn;" +
			"      smShowModal();" +
			"    }, true);" +
			"    var attempts = 0;" +
			"    var timer = setInterval(function() {" +
			"      attempts++;" +
			"      if (tryMoveAll() || attempts >= 40) {" +
			"        lastState = '__force__';" +
			"        toggleDateFields();" +
			"        captureRefStyles();" +
			"        setTimeout(captureRefStyles, 50);" +
			"        clearInterval(timer);" +
			"      }" +
			"    }, 50);" +
			"  }" +
			"  if (document.readyState === 'loading') {" +
			"    document.addEventListener('DOMContentLoaded', init);" +
			"  } else {" +
			"    init();" +
			"  }" +
			"})();" +
			"</script>";

		// --- Row 1: Subsidiary ---
		form.addFieldGroup({ id: "custpage_grp_subsidiary", label: " " });
		var subsidiaryField = form.addField({
			id: "custpage_subsidiary",
			type: serverWidget.FieldType.SELECT,
			label: "Subsidiary",
			container: "custpage_grp_subsidiary",
		});
		subsidiaryField.isMandatory = true;
		subsidiaryField.addSelectOption({
			value: "",
			text: "-- Select Subsidiary --",
		});
		var subsidiaries = loadSubsidiaries();
		subsidiaries.forEach(function (sub) {
			subsidiaryField.addSelectOption({
				value: sub.id,
				text: sub.name,
			});
		});

		// --- External ID (below Subsidiary) ---
		form.addFieldGroup({ id: "custpage_grp_externalid", label: " " });
		var externalIdField = form.addField({
			id: "custpage_externalid",
			type: serverWidget.FieldType.SELECT,
			label: "External ID",
			container: "custpage_grp_externalid",
		});
		externalIdField.isMandatory = true;
		externalIdField.addSelectOption({
			value: "",
			text: "-- Select External ID Criteria --",
		});
		externalIdField.addSelectOption({
			value: "all",
			text: "All records (Blank + All populated values)",
		});
		externalIdField.addSelectOption({
			value: "populated",
			text: "All populated values",
		});
		externalIdField.addSelectOption({
			value: "blank",
			text: "Blank",
		});
		externalIdField.addSelectOption({
			value: "sm_match",
			text: "All populated values that match SuiteMigration",
		});

		// --- Row 2: Record Type ---
		form.addFieldGroup({ id: "custpage_grp_recordtype", label: " " });
		var recordTypeField = form.addField({
			id: "custpage_recordtype",
			type: serverWidget.FieldType.SELECT,
			label: "Record Type",
			container: "custpage_grp_recordtype",
		});
		recordTypeField.isMandatory = true;
		recordTypeField.addSelectOption({
			value: "",
			text: "-- Select Record Type --",
		});
		// --- Group Options ---
		recordTypeField.addSelectOption({
			value: "all_records",
			text: "All Records",
		});
		recordTypeField.addSelectOption({
			value: "all_entities",
			text: "All Entities (Customers, Vendors, Employees, Items, Projects)",
		});
		recordTypeField.addSelectOption({
			value: "all_transactions",
			text: "All Transactions (including Journal Entries)",
		});
		// --- Individual Options ---
		recordTypeField.addSelectOption({
			value: "customer",
			text: "Customers",
		});
		recordTypeField.addSelectOption({ value: "vendor", text: "Vendors" });
		recordTypeField.addSelectOption({
			value: "employee",
			text: "Employees",
		});
		recordTypeField.addSelectOption({ value: "item", text: "Items" });
		recordTypeField.addSelectOption({ value: "job", text: "Projects" });
		recordTypeField.addSelectOption({
			value: "journalentry",
			text: "Journal Entries",
		});
		recordTypeField.addSelectOption({
			value: "journalentry_sm",
			text: "Journal Entries matching SuiteMigration Trial Balance push",
		});
		recordTypeField.addSelectOption({
			value: "invoice",
			text: "Invoices",
		});
		recordTypeField.addSelectOption({
			value: "customerpayment",
			text: "Customer Payments",
		});
		recordTypeField.addSelectOption({
			value: "creditmemo",
			text: "Credit Memos",
		});
		recordTypeField.addSelectOption({
			value: "vendorbill",
			text: "Vendor Bills",
		});
		recordTypeField.addSelectOption({
			value: "vendorpayment",
			text: "Vendor Payments",
		});
		recordTypeField.addSelectOption({
			value: "vendorcredit",
			text: "Vendor Credits",
		});
		recordTypeField.addSelectOption({
			value: "check",
			text: "Checks",
		});
		recordTypeField.addSelectOption({
			value: "deposit",
			text: "Deposits",
		});
		recordTypeField.addSelectOption({
			value: "cashsale",
			text: "Cash Sales",
		});
		recordTypeField.addSelectOption({
			value: "creditcardcharge",
			text: "Credit Card Charges",
		});
		recordTypeField.addSelectOption({
			value: "creditcardrefund",
			text: "Credit Card Refunds",
		});
		recordTypeField.addSelectOption({
			value: "purchaseorder",
			text: "Purchase Orders",
		});
		recordTypeField.addSelectOption({
			value: "cashrefund",
			text: "Cash Refunds",
		});
		recordTypeField.addSelectOption({
			value: "cashexpense",
			text: "Cash Expenses",
		});
		recordTypeField.addSelectOption({
			value: "transfer",
			text: "Transfers",
		});

		// --- Row 3: Date Filter ---
		form.addFieldGroup({ id: "custpage_grp_datefilter", label: " " });
		var dateFilterField = form.addField({
			id: "custpage_datefilter",
			type: serverWidget.FieldType.SELECT,
			label: "Date Filter",
			container: "custpage_grp_datefilter",
		});
		dateFilterField.isMandatory = true;
		dateFilterField.addSelectOption({
			value: "createddate",
			text: "Created Date",
		});
		dateFilterField.addSelectOption({
			value: "trandate",
			text: "Transaction Date",
		});
		dateFilterField.addSelectOption({
			value: "all",
			text: "No Date Filter",
		});
		dateFilterField.defaultValue = "createddate";

		// --- Date Layout (custom rows for tighter spacing) ---
		form.addFieldGroup({ id: "custpage_grp_dates_layout", label: " " });
		var dateLayoutField = form.addField({
			id: "custpage_date_layout",
			type: serverWidget.FieldType.INLINEHTML,
			label: " ",
			container: "custpage_grp_dates_layout",
		});
		dateLayoutField.defaultValue =
			'<div id="custpage_date_layout" class="custpage-date-layout" style="display:none;">' +
			'<div class="custpage-date-row" id="custpage_tran_row"></div>' +
			'<div class="custpage-date-row" id="custpage_create_row"></div>' +
			"</div>";

		// --- Date Fields (hidden group; moved into layout on load) ---
		form.addFieldGroup({ id: "custpage_grp_dates_fields", label: " " });
		var tranDateFromField = form.addField({
			id: "custpage_trandatefrom",
			type: serverWidget.FieldType.DATE,
			label: "Transaction Date From",
			container: "custpage_grp_dates_fields",
		});
		var tranDateToField = form.addField({
			id: "custpage_trandateto",
			type: serverWidget.FieldType.DATE,
			label: "Transaction Date To",
			container: "custpage_grp_dates_fields",
		});
		tranDateToField.updateBreakType({
			breakType: serverWidget.FieldBreakType.STARTCOL,
		});

		var createdDateFromField = form.addField({
			id: "custpage_createddatefrom",
			type: serverWidget.FieldType.DATE,
			label: "Creation Date From",
			container: "custpage_grp_dates_fields",
		});
		var createdDateToField = form.addField({
			id: "custpage_createddateto",
			type: serverWidget.FieldType.DATE,
			label: "Creation Date To",
			container: "custpage_grp_dates_fields",
		});
		createdDateToField.updateBreakType({
			breakType: serverWidget.FieldBreakType.STARTCOL,
		});

		// --- Confirmation Text ---
		form.addFieldGroup({ id: "custpage_grp_confirm", label: " " });
		var confirmField = form.addField({
			id: "custpage_confirmation",
			type: serverWidget.FieldType.INLINEHTML,
			label: " ",
			container: "custpage_grp_confirm",
		});
		confirmField.defaultValue =
			'<div id="custpage_confirmation_text" style="display:none;"></div>' +
			'<div id="smModalOverlay" class="sm-modal-overlay">' +
			'<div class="sm-modal">' +
			'<div class="sm-modal-header">&#9888; Confirm Deletion</div>' +
			'<div class="sm-modal-body" id="smModalBody"></div>' +
			'<div class="sm-modal-note">This action is permanent and cannot be undone.</div>' +
			'<div class="sm-modal-footer">' +
			'<button type="button" id="smCancelBtn" class="sm-btn sm-btn-cancel">Cancel</button>' +
			'<button type="button" id="smConfirmBtn" class="sm-btn sm-btn-delete">Delete Records</button>' +
			"</div></div></div>";

		form.addSubmitButton({ label: "Preview Deletion" });
		context.response.writePage(form);
	}

	function handleSubmit(context) {
		var recordType = context.request.parameters.custpage_recordtype;
		var subsidiaryId = context.request.parameters.custpage_subsidiary;
		var externalIdMode = context.request.parameters.custpage_externalid;
		var dateFilter = context.request.parameters.custpage_datefilter;
		var tranDateFrom = context.request.parameters.custpage_trandatefrom;
		var tranDateTo = context.request.parameters.custpage_trandateto;
		var createdDateFrom =
			context.request.parameters.custpage_createddatefrom;
		var createdDateTo = context.request.parameters.custpage_createddateto;

		// Chain parameters (for grouped type sequential processing)
		var chainRemaining =
			context.request.parameters.custpage_chain_remaining || "";
		var chainTotal = parseInt(
			context.request.parameters.custpage_chain_total || "0",
			10,
		);
		var chainIndex = parseInt(
			context.request.parameters.custpage_chain_index || "0",
			10,
		);
		var chainCompleted =
			context.request.parameters.custpage_chain_completed || "";
		var isChainRequest = chainTotal > 0;

		// Running deleted/failed totals carried across chain steps (grouped deletes)
		var accDeleted = parseInt(
			context.request.parameters.custpage_acc_deleted || "0",
			10,
		);
		var accFailed = parseInt(
			context.request.parameters.custpage_acc_failed || "0",
			10,
		);
		var accResults = context.request.parameters.custpage_acc_results || "";

		// Validate required fields (skip for chain requests — already validated)
		if (!isChainRequest && (!recordType || !subsidiaryId || !externalIdMode || !dateFilter)) {
			context.response.write(
				'<h3 style="color: red;">Please select a subsidiary, External ID option, record type, and date filter option.</h3>' +
					'<p><a href="javascript:history.back()">Go Back</a></p>',
			);
			return;
		}

		// Validate Transaction Date To when Transaction Date is selected
		if (dateFilter === "trandate" && !tranDateTo) {
			context.response.write(
				'<h3 style="color: red;">Please provide a Transaction Date To.</h3>' +
					'<p><a href="javascript:history.back()">Go Back</a></p>',
			);
			return;
		}

		// Validate Creation Date To when Created Date is selected
		if (dateFilter === "createddate" && !createdDateTo) {
			context.response.write(
				'<h3 style="color: red;">Please provide a Creation Date To.</h3>' +
					'<p><a href="javascript:history.back()">Go Back</a></p>',
			);
			return;
		}

		// Resolve group types into ordered list for first submission
		var isGroupType = GROUP_TYPES.hasOwnProperty(recordType);
		var typeList = [];
		var currentType = recordType;

		if (isGroupType && !isChainRequest) {
			typeList = GROUP_TYPES[recordType].slice();
			currentType = typeList.shift();
			chainTotal = typeList.length + 1;
			chainIndex = 1;
			chainRemaining = typeList.join(",");
			chainCompleted = "";
		}

		// For transactions using createddate mode, override to createddate for entity types
		var TRANSACTION_TYPES = [
			"journalentry",
			"journalentry_sm",
			"invoice",
			"customerpayment",
			"creditmemo",
			"vendorbill",
			"vendorpayment",
			"vendorcredit",
			"check",
			"deposit",
			"cashsale",
			"creditcardcharge",
			"creditcardrefund",
			"cashexpense",
			"transfer",
			"purchaseorder",
			"cashrefund",
		];
		var isCurrentTransaction =
			TRANSACTION_TYPES.indexOf(currentType) !== -1;
		var effectiveDateFilter = dateFilter;
		if (
			dateFilter === "trandate" &&
			!isCurrentTransaction &&
			isChainRequest
		) {
			// Entity type in a chain — skip trandate, use createddate instead
			effectiveDateFilter = "createddate";
		}

		try {
			var scriptTask = task.create({
				taskType: task.TaskType.MAP_REDUCE,
			});
			scriptTask.scriptId = "customscript_sm_toolkit_delete_mr";
			scriptTask.deploymentId = "customdeploy_sm_toolkit_delete_mr";

			var params = {
				custscript_sm_recordtype: currentType,
				custscript_sm_subsidiary: subsidiaryId,
				custscript_sm_externalid: externalIdMode,
			};

			// Pass date params based on effective mode
			if (effectiveDateFilter === "trandate") {
				if (tranDateFrom) {
					params.custscript_sm_trandate_from = tranDateFrom;
				}
				params.custscript_sm_trandate_to = tranDateTo;
			} else if (effectiveDateFilter === "createddate") {
				if (createdDateFrom) {
					params.custscript_sm_createddate_from = createdDateFrom;
				}
				params.custscript_sm_createddate_to = createdDateTo;
			}

			scriptTask.params = params;

			var taskId = scriptTask.submit();
			log.audit(
				"Task Submitted",
				"Task ID: " +
					taskId +
					", Mode: " +
					dateFilter +
					", Record Type: " +
					currentType +
					(chainTotal
						? " (" + chainIndex + "/" + chainTotal + ")"
						: ""),
			);

			// Build chain info for progress page
			var chainInfo = null;
			if (isGroupType || isChainRequest) {
				chainInfo = {
					remaining: chainRemaining,
					total: chainTotal,
					index: chainIndex,
					completed: chainCompleted,
					dateFilter: dateFilter,
					externalIdMode: externalIdMode,
					subsidiaryId: subsidiaryId,
					tranDateFrom: tranDateFrom || "",
					tranDateTo: tranDateTo || "",
					createdDateFrom: createdDateFrom || "",
					createdDateTo: createdDateTo || "",
				};
			}

			renderProgressPage(
				context,
				taskId,
				currentType,
				chainInfo,
				accDeleted,
				accFailed,
				accResults,
			);
		} catch (error) {
			log.error("Error Submitting Task", error);

			var errorMessage = error.message;
			if (errorMessage.indexOf("already") !== -1) {
				errorMessage =
					"A delete task is already running. Please wait for it to complete.";
			}

			context.response.write(
				'<h3 style="color: red;">Error: ' +
					errorMessage +
					"</h3>" +
					'<p><a href="javascript:history.back()">Go Back</a></p>',
			);
		}
	}

	function handleStatusCheck(context) {
		var taskId = context.request.parameters.taskId;

		if (!taskId) {
			context.response.write(JSON.stringify({ error: "No task ID" }));
			return;
		}

		try {
			var taskStatus = task.checkStatus({ taskId: taskId });

			var percentComplete = 0;
			if (taskStatus.getPercentageCompleted) {
				percentComplete = taskStatus.getPercentageCompleted();
			}

			// Reduce counts drive an accurate, deletion-based progress bar.
			// Deletion happens in the reduce phase and map emits one key per
			// record, so totalReduce ~= records to delete and pendingReduce =
			// records not yet processed. All guarded in case a getter is absent.
			var stage = "";
			var totalReduce = 0;
			var pendingReduce = 0;
			try {
				stage = taskStatus.getCurrentStage() || "";
			} catch (e) {}
			try {
				totalReduce = taskStatus.getTotalReduceCount() || 0;
			} catch (e) {}
			try {
				pendingReduce = taskStatus.getPendingReduceCount() || 0;
			} catch (e) {}

			// On completion, read the deleted/failed counts the Map/Reduce
			// wrote to the shared cache. Best-effort — null if unavailable.
			var deleted = null;
			var failed = null;
			if (taskStatus.status === "COMPLETE") {
				try {
					var resultCache = cache.getCache({
						name: RESULT_CACHE_NAME,
						scope: cache.Scope.PUBLIC,
					});
					var cachedResult = resultCache.get({
						key: RESULT_CACHE_KEY,
					});
					if (cachedResult) {
						var parsed = JSON.parse(cachedResult);
						deleted = parsed.deleted;
						failed = parsed.failed;
					}
				} catch (e) {}
			}

			context.response.write(
				JSON.stringify({
					status: taskStatus.status,
					percentComplete: percentComplete,
					stage: stage,
					totalReduce: totalReduce,
					pendingReduce: pendingReduce,
					deleted: deleted,
					failed: failed,
				}),
			);
		} catch (e) {
			context.response.write(
				JSON.stringify({ error: e.message, status: "UNKNOWN" }),
			);
		}
	}

	function renderProgressPage(
		context,
		taskId,
		recordType,
		chainInfo,
		accDeleted,
		accFailed,
		accResults,
	) {
		accDeleted = accDeleted || 0;
		accFailed = accFailed || 0;
		accResults = accResults || "";

		// Parse per-type results carried across chain steps.
		// Format: "type:deleted:failed|type:deleted:failed"
		var resultsMap = {};
		if (accResults) {
			var resultEntries = accResults.split("|");
			for (var ri = 0; ri < resultEntries.length; ri++) {
				var rp = resultEntries[ri].split(":");
				if (rp.length === 3) {
					resultsMap[rp[0]] = { d: rp[1], f: rp[2] };
				}
			}
		}

		var suiteletUrl = url.resolveScript({
			scriptId: runtime.getCurrentScript().id,
			deploymentId: runtime.getCurrentScript().deploymentId,
		});

		var isChain = chainInfo !== null && chainInfo !== undefined;
		var chainTotal = isChain ? chainInfo.total : 0;
		var chainIndex = isChain ? chainInfo.index : 0;
		var chainRemaining = isChain ? chainInfo.remaining : "";
		var chainCompleted = isChain ? chainInfo.completed : "";
		var recordLabel = RECORD_LABELS[recordType] || recordType;

		// Build the type status list for chain progress
		var typeListHtml = "";
		if (isChain) {
			var completedArr = chainCompleted
				? chainCompleted.split(",")
				: [];
			var remainingArr = chainRemaining
				? chainRemaining.split(",")
				: [];

			typeListHtml += '<div class="chain-progress">';
			typeListHtml +=
				'<h3 id="chainProgressTitle">Overall Progress (' +
				chainIndex +
				" of " +
				chainTotal +
				")</h3>";
			typeListHtml += '<div class="type-list">';

			// Completed types (with per-type deleted/failed counts when known)
			for (var c = 0; c < completedArr.length; c++) {
				if (completedArr[c]) {
					var ctype = completedArr[c];
					var cLabel = RECORD_LABELS[ctype] || ctype;
					var cDel = resultsMap[ctype]
						? "Deleted: " + resultsMap[ctype].d
						: "";
					var cFail = resultsMap[ctype]
						? "Failed: " + resultsMap[ctype].f
						: "";
					var cHasFail =
						resultsMap[ctype] && Number(resultsMap[ctype].f) > 0;
					typeListHtml +=
						'<div class="type-item ' +
						(cHasFail ? "type-warn" : "type-done") +
						'"><span class="type-name">' +
						cLabel +
						'</span><span class="type-del">' +
						cDel +
						'</span><span class="type-fail' +
						(cHasFail ? " has-fail" : "") +
						'">' +
						cFail +
						'</span><span class="type-badge ' +
						(cHasFail ? "badge-warn" : "badge-done") +
						'">Completed</span></div>';
				}
			}
			// Current type (counts filled in by the client on completion)
			typeListHtml +=
				'<div class="type-item type-current"><span class="type-name">' +
				recordLabel +
				'</span><span class="type-del" id="curDel"></span><span class="type-fail" id="curFail"></span><span class="type-badge badge-current">Processing</span></div>';
			// Remaining types
			for (var r = 0; r < remainingArr.length; r++) {
				if (remainingArr[r]) {
					typeListHtml +=
						'<div class="type-item type-pending"><span class="type-name">' +
						(RECORD_LABELS[remainingArr[r]] || remainingArr[r]) +
						'</span><span class="type-del"></span><span class="type-fail"></span><span class="type-badge badge-pending">Pending</span></div>';
				}
			}
			typeListHtml += "</div></div>";
		}

		// Build hidden form for chain submissions
		var chainFormHtml = "";
		if (isChain && chainRemaining) {
			var remainingArr = chainRemaining.split(",");
			var nextType = remainingArr[0];
			var newRemaining = remainingArr.slice(1).join(",");
			var newCompleted = chainCompleted
				? chainCompleted + "," + recordType
				: recordType;

			chainFormHtml +=
				'<form id="chainForm" method="POST" action="' +
				suiteletUrl +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_recordtype" value="' +
				nextType +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_subsidiary" value="' +
				chainInfo.subsidiaryId +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_externalid" value="' +
				chainInfo.externalIdMode +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_datefilter" value="' +
				chainInfo.dateFilter +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_trandatefrom" value="' +
				chainInfo.tranDateFrom +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_trandateto" value="' +
				chainInfo.tranDateTo +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_createddatefrom" value="' +
				chainInfo.createdDateFrom +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_createddateto" value="' +
				chainInfo.createdDateTo +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_chain_remaining" value="' +
				newRemaining +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_chain_total" value="' +
				chainInfo.total +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_chain_index" value="' +
				(chainInfo.index + 1) +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_chain_completed" value="' +
				newCompleted +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_acc_deleted" id="accDeletedField" value="">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_acc_failed" id="accFailedField" value="">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_acc_results" id="accResultsField" value="">';
			chainFormHtml += "</form>";
		}

		var titleText = isChain
			? "Deleting Records (" + chainIndex + "/" + chainTotal + ")"
			: "Deleting Records";
		var subtitleText = isChain
			? "Currently processing: " + recordLabel
			: "Record Type: " + recordLabel;

		var html =
			"<!DOCTYPE html>" +
			"<html><head>" +
			'<meta charset="UTF-8">' +
			"<title>Delete Records</title>" +
			"<style>" +
			"body { font-family: Arial, sans-serif; margin: 40px; background-color: #f5f5f5; }" +
			".container { max-width: 550px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }" +
			"h2 { margin-top: 0; color: #333; text-align: center; }" +
			".record-type { text-align: center; color: #666; margin-bottom: 25px; }" +
			".progress-container { margin: 25px 0; }" +
			".progress-bar { width: 100%; height: 28px; background-color: #e0e0e0; border-radius: 14px; overflow: hidden; }" +
			".progress-fill { height: 100%; background-color: #4CAF50; transition: width 0.3s ease; border-radius: 14px; }" +
			".progress-text { text-align: center; margin-top: 10px; font-size: 18px; font-weight: bold; color: #333; }" +
			".status { padding: 12px; border-radius: 4px; margin: 20px 0; text-align: center; font-size: 15px; }" +
			".status-starting { background: #fff3e0; color: #e65100; }" +
			".status-progress { background: #e3f2fd; color: #1565c0; }" +
			".status-complete { background: #e8f5e9; color: #2e7d32; }" +
			".status-failed { background: #ffebee; color: #c62828; }" +
			".btn { display: block; width: 100%; padding: 12px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 4px; text-align: center; margin-top: 20px; box-sizing: border-box; }" +
			".btn:hover { background-color: #1565c0; }" +
			".btn-disabled { background-color: #ccc; cursor: not-allowed; pointer-events: none; }" +
			".note { font-size: 12px; color: #888; margin-top: 15px; text-align: center; }" +
			".summary-box { display: none; margin: 18px 0 0; padding: 14px 16px; border-radius: 6px; background: #eef7f0; border: 1px solid #cfe8d4; text-align: center; font-size: 16px; color: #333; }" +
			".summary-box .s-deleted { color: #2e7d32; font-weight: 700; }" +
			".summary-box .s-failed-has { color: #c62828; font-weight: 700; }" +
			".summary-box .s-failed-none { color: #2e7d32; font-weight: 700; }" +
			".chain-progress { margin: 20px 0; padding: 15px; background: #fafafa; border-radius: 6px; border: 1px solid #e0e0e0; }" +
			".chain-progress h3 { margin: 0 0 12px 0; font-size: 14px; color: #555; }" +
			".type-list { display: flex; flex-direction: column; gap: 6px; }" +
			".type-item { padding: 8px 12px; border-radius: 4px; font-size: 13px; display: flex; align-items: center; }" +
			".type-name { flex: 0 0 190px; padding-right: 10px; line-height: 1.35; overflow-wrap: break-word; }" +
			".type-del { flex: 0 0 105px; font-size: 12px; font-weight: normal; }" +
			".type-fail { flex: 0 0 90px; font-size: 12px; font-weight: normal; }" +
			".type-done { background: #e8f5e9; color: #333; }" +
			".type-current { background: #e3f2fd; color: #1565c0; font-weight: bold; }" +
			".type-pending { background: #f5f5f5; color: #999; }" +
			".type-warn { background: #fff8e1; color: #333; }" +
			".type-fail.has-fail { color: #c62828; font-weight: 600; }" +
			".type-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; margin-left: auto; }" +
			".badge-done { background: #c8e6c9; color: #2e7d32; }" +
			".badge-current { background: #bbdefb; color: #1565c0; }" +
			".badge-pending { background: #e0e0e0; color: #999; }" +
			".badge-warn { background: #ffe0b2; color: #8a6d00; }" +
			"</style>" +
			"</head><body>" +
			'<div class="container">' +
			'<h2 id="titleText">' +
			titleText +
			"</h2>" +
			'<div class="record-type" id="subtitleText">' +
			subtitleText +
			"</div>" +
			'<div class="progress-container">' +
			'<div class="progress-bar"><div class="progress-fill" id="progressFill" style="width: 0%"></div></div>' +
			'<div class="progress-text" id="progressText">0%</div>' +
			"</div>" +
			'<div class="status status-starting" id="statusBox">Starting...</div>' +
			'<div class="summary-box" id="summaryBox"></div>' +
			typeListHtml +
			chainFormHtml +
			'<a class="btn btn-disabled" id="backBtn" href="' +
			suiteletUrl +
			'">Back to Form</a>' +
			'<div class="note" id="noteText">Please wait while records are being deleted...</div>' +
			"</div>" +
			"<script>" +
			'var taskId = "' +
			taskId +
			'";' +
			'var suiteletUrl = "' +
			suiteletUrl +
			'";' +
			"var hasChainRemaining = " +
			(isChain && chainRemaining ? "true" : "false") +
			";" +
			"var isChain = " +
			(isChain ? "true" : "false") +
			";" +
			"var chainTotal = " +
			chainTotal +
			";" +
			"var accDeleted = " +
			accDeleted +
			";" +
			"var accFailed = " +
			accFailed +
			";" +
			"var accResults = " +
			JSON.stringify(accResults) +
			";" +
			"var currentRecordType = " +
			JSON.stringify(recordType) +
			";" +
			"var refreshInterval = null;" +
			"var isComplete = false;" +
			"var maxPercent = 0;" +
			"function checkStatus() {" +
			"  if (isComplete) return;" +
			'  fetch(suiteletUrl + "&action=checkstatus&taskId=" + encodeURIComponent(taskId))' +
			"    .then(function(r) { return r.json(); })" +
			"    .then(function(data) {" +
			"      if (isComplete) return;" +
			'      var statusBox = document.getElementById("statusBox");' +
			'      var progressFill = document.getElementById("progressFill");' +
			'      var progressText = document.getElementById("progressText");' +
			'      var backBtn = document.getElementById("backBtn");' +
			'      var noteText = document.getElementById("noteText");' +
			'      if (data.status === "PENDING") {' +
			'        statusBox.className = "status status-starting";' +
			'        statusBox.textContent = "Starting...";' +
			'        progressText.textContent = "0%";' +
			'      } else if (data.status === "PROCESSING") {' +
			'        statusBox.className = "status status-progress";' +
			"        var total = data.totalReduce || 0;" +
			"        var pending = data.pendingReduce || 0;" +
			"        if (total > 0) {" +
			"          var done = total - pending; if (done < 0) { done = 0; }" +
			"          var pct = Math.round((done / total) * 100);" +
			"          if (pct > 99) { pct = 99; }" +
			"          if (pct > maxPercent) { maxPercent = pct; }" +
			'          progressFill.style.width = maxPercent + "%";' +
			'          progressText.textContent = maxPercent + "%";' +
			'          statusBox.textContent = "Deleting: " + done.toLocaleString() + " of " + total.toLocaleString() + " records";' +
			"        } else {" +
			'          statusBox.textContent = "Scanning records...";' +
			'          progressFill.style.width = "5%";' +
			'          progressText.textContent = "";' +
			"        }" +
			'      } else if (data.status === "COMPLETE") {' +
			'        statusBox.className = "status status-complete";' +
			'        progressFill.style.width = "100%";' +
			'        progressText.textContent = "100%";' +
			"        isComplete = true;" +
			"        clearInterval(refreshInterval);" +
			"        var runDeleted = (typeof data.deleted === 'number') ? data.deleted : null;" +
			"        var runFailed = (typeof data.failed === 'number') ? data.failed : 0;" +
			"        var totDeleted = accDeleted + (runDeleted || 0);" +
			"        var totFailed = accFailed + (runFailed || 0);" +
			"        var haveCounts = (runDeleted !== null);" +
			"        var showSummary = function(label) {" +
			"          var sb = document.getElementById('summaryBox');" +
			"          if (!sb || !haveCounts) return;" +
			"          var failClass = totFailed > 0 ? 's-failed-has' : 's-failed-none';" +
			"          sb.style.display = 'block';" +
			"          sb.innerHTML = (label ? '<b>' + label + '</b> &mdash; ' : '') + '<span class=\"s-deleted\">Deleted: ' + totDeleted.toLocaleString() + '</span> &nbsp;&middot;&nbsp; <span class=\"' + failClass + '\">Failed: ' + totFailed.toLocaleString() + '</span>';" +
			"        };" +
			"        var runEntry = currentRecordType + ':' + (runDeleted || 0) + ':' + (runFailed || 0);" +
			"        var newResults = accResults ? (accResults + '|' + runEntry) : runEntry;" +
			"        var curHasFail = (runFailed || 0) > 0;" +
			"        var cd = document.getElementById('curDel');" +
			"        var cf2 = document.getElementById('curFail');" +
			"        if (haveCounts) {" +
			"          if (cd) { cd.textContent = 'Deleted: ' + (runDeleted || 0).toLocaleString(); }" +
			"          if (cf2) { cf2.textContent = 'Failed: ' + (runFailed || 0).toLocaleString(); if (curHasFail) { cf2.className = 'type-fail has-fail'; } }" +
			"        }" +
			"        var curItem = document.querySelector('.type-current');" +
			"        if (curItem) {" +
			"          curItem.className = curHasFail ? 'type-item type-warn' : 'type-item type-done';" +
			"          var badge = curItem.querySelector('.type-badge');" +
			"          if (badge) { badge.className = curHasFail ? 'type-badge badge-warn' : 'type-badge badge-done'; badge.textContent = 'Completed'; }" +
			"        }" +
			"        if (hasChainRemaining) {" +
			'          statusBox.textContent = "Completed — submitting next type...";' +
			"          noteText.textContent = 'Moving to next record type...';" +
			"          var af = document.getElementById('accDeletedField'); if (af) { af.value = totDeleted; }" +
			"          var ff = document.getElementById('accFailedField'); if (ff) { ff.value = totFailed; }" +
			"          var rf = document.getElementById('accResultsField'); if (rf) { rf.value = newResults; }" +
			"          setTimeout(function() {" +
			'            document.getElementById("chainForm").submit();' +
			"          }, 1500);" +
			"        } else {" +
			'          statusBox.textContent = "Completed";' +
			'          backBtn.className = "btn";' +
			"          noteText.textContent = 'You can now start a new deletion.';" +
			"          showSummary(isChain ? 'Total' : '');" +
			"          if (isChain) {" +
			"            document.getElementById('titleText').textContent = (totFailed > 0) ? 'Deletion Complete' : 'All Records Deleted';" +
			"            document.getElementById('subtitleText').textContent = (totFailed > 0) ? ('All ' + chainTotal + ' record types processed \\u2014 ' + totFailed.toLocaleString() + ' record(s) could not be deleted') : ('All ' + chainTotal + ' record types processed successfully');" +
			"            var cpt = document.getElementById('chainProgressTitle');" +
			"            if (cpt) { cpt.textContent = 'All ' + chainTotal + ' of ' + chainTotal + ' Completed'; }" +
			"          }" +
			"        }" +
			'      } else if (data.status === "FAILED") {' +
			'        statusBox.className = "status status-failed";' +
			'        statusBox.textContent = "Failed";' +
			"        isComplete = true;" +
			'        backBtn.className = "btn";' +
			'        noteText.textContent = "Task failed. Check script logs for details.";' +
			"        clearInterval(refreshInterval);" +
			"      }" +
			"    })" +
			"    .catch(function(e) { });" +
			"}" +
			"checkStatus();" +
			"refreshInterval = setInterval(checkStatus, 1000);" +
			"</script>" +
			"</body></html>";

		context.response.write(html);
	}

	function loadSubsidiaries() {
		var subsidiaries = [];

		try {
			var subsidiarySearch = search.create({
				type: search.Type.SUBSIDIARY,
				filters: [["isinactive", "is", "F"]],
				columns: [
					search.createColumn({ name: "internalid" }),
					search.createColumn({
						name: "name",
						sort: search.Sort.ASC,
					}),
				],
			});

			subsidiarySearch.run().each(function (result) {
				subsidiaries.push({
					id: result.getValue("internalid"),
					name: result.getValue("name"),
				});
				return true;
			});
		} catch (e) {
			log.error("Error loading subsidiaries", e);
		}

		return subsidiaries;
	}

	return { onRequest: onRequest };
});
