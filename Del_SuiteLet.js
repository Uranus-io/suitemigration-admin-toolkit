/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @version v1.0
 *
 * Name: SuiteMigration Mass Purge
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
 * - Script ID: customscript_delete1
 * - Deployment ID: customdeploy_delete2
 * - Parameters: custscript_recordtype, custscript_subsidiary,
 *   custscript_pushmode, custscript_trandatefrom, custscript_trandateto,
 *   custscript_createddatefrom, custscript_createddateto
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
], function (serverWidget, task, log, search, url, runtime) {
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
		journalentry_sm: "Date Range Push Journal Entries",
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
		var form = serverWidget.createForm({ title: "Delete Records" });

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
			"</style>" +
			"<b>Info:</b> Select a subsidiary, push mode, and record type, then choose how to filter by date.<br>" +
			"<ul style='margin:5px 0;'>" +
			"<li><b>Push Mode</b> &mdash; <b>Pushed from SuiteMigration</b> (default) targets records with an external ID; <b>Manually Created in NetSuite</b> targets records without an external ID; <b>Both</b> targets all records regardless of external ID.</li>" +
			"<li><b>Record Type</b> &mdash; choose an individual type or a group option: <b>All Records</b>, <b>All Cust/Vend/Emp/Item Records</b>, or <b>All Transactions</b>.</li>" +
			"<li><b>Delete by Date</b> options &mdash; <b>All Records</b> deletes every record with no date filtering;<br><b>Transaction Date Range</b> filters by transaction date (available for transactions only); <b>Creation Date Range</b> filters by creation date (available for all record types).</li>" +
			"<li>The <b>From</b> date is optional &mdash; leave it blank to delete all records up to and including the <b>To</b> date.</li>" +
			"<li>All dates are <b>inclusive</b> &mdash; both the From and To dates are included in the deletion range.</li>" +
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
			"      if (el) el.placeholder = 'DD/MM/YYYY';" +
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
			"    try { recVal = nlapiGetFieldValue('custpage_delete_action') || ''; } catch(e) {}" +
			"    try { pmVal = nlapiGetFieldValue('custpage_pushmode') || ''; } catch(e) {}" +
			"    if (!subVal || !recVal || !pmVal) { div.innerHTML = ''; return; }" +
			"    try { sub = nlapiGetFieldText('custpage_subsidiary') || ''; } catch(e) {}" +
			"    try { rec = nlapiGetFieldText('custpage_delete_action') || ''; } catch(e) {}" +
			"    try { pm = nlapiGetFieldText('custpage_pushmode') || ''; } catch(e) {}" +
			"    try { mode = nlapiGetFieldValue('custpage_deletemode') || 'all'; } catch(e) {}" +
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
			"    div.innerHTML = msg ? '<div style=\"padding:10px;background:#fff3e0;border:1px solid #ff9800;border-radius:4px;margin-top:10px;color:#e65100;font-weight:bold;width:580px;\">' + msg + '</div>' : '';" +
			"  }" +
			"  function toggleDateFields() {" +
			"    var mode = 'all'; var recType = ''; var sub = ''; var pmv = '';" +
			"    var tf = ''; var tt = ''; var cf = ''; var ct = '';" +
			"    try { mode = nlapiGetFieldValue('custpage_deletemode') || 'all'; } catch(e) {}" +
			"    try { recType = nlapiGetFieldValue('custpage_delete_action') || ''; } catch(e) {}" +
			"    try { sub = nlapiGetFieldValue('custpage_subsidiary') || ''; } catch(e) {}" +
			"    try { pmv = nlapiGetFieldValue('custpage_pushmode') || ''; } catch(e) {}" +
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
			"        nlapiRemoveSelectOption('custpage_deletemode', 'trandate');" +
			"        hasTrandateOpt = false;" +
			"        if (mode === 'trandate') {" +
			"          nlapiSetFieldValue('custpage_deletemode', 'createddate');" +
			"          mode = 'createddate';" +
			"        }" +
			"      } catch(e) {}" +
			"    } else if (!isEntity && !hasTrandateOpt && recType) {" +
			"      try {" +
			"        nlapiRemoveSelectOption('custpage_deletemode', null);" +
			"        nlapiInsertSelectOption('custpage_deletemode', 'all', 'All Records');" +
			"        nlapiInsertSelectOption('custpage_deletemode', 'trandate', 'Transaction Date Range');" +
			"        nlapiInsertSelectOption('custpage_deletemode', 'createddate', 'Creation Date Range');" +
			"        hasTrandateOpt = true;" +
			"        nlapiSetFieldValue('custpage_deletemode', mode);" +
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
			"  function init() {" +
			"    captureRefStyles();" +
			"    applyPlaceholders();" +
			"    setInterval(toggleDateFields, 300);" +
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
		form.addFieldGroup({ id: "custpage_grp1", label: " " });
		var subsidiaryField = form.addField({
			id: "custpage_subsidiary",
			type: serverWidget.FieldType.SELECT,
			label: "Subsidiary",
			container: "custpage_grp1",
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

		// --- Push Mode (below Subsidiary) ---
		form.addFieldGroup({ id: "custpage_grp_pushmode", label: " " });
		var pushModeField = form.addField({
			id: "custpage_pushmode",
			type: serverWidget.FieldType.SELECT,
			label: "Push Mode",
			container: "custpage_grp_pushmode",
		});
		pushModeField.isMandatory = true;
		pushModeField.addSelectOption({
			value: "sm_pushed",
			text: "Pushed from SuiteMigration",
		});
		pushModeField.addSelectOption({
			value: "manually_created",
			text: "Manually Created in NetSuite",
		});
		pushModeField.addSelectOption({
			value: "both",
			text: "Both SM Pushed and Manually Created",
		});
		pushModeField.defaultValue = "sm_pushed";

		// --- Row 2: Record Type ---
		form.addFieldGroup({ id: "custpage_grp2", label: " " });
		var deleteActionField = form.addField({
			id: "custpage_delete_action",
			type: serverWidget.FieldType.SELECT,
			label: "Record Type",
			container: "custpage_grp2",
		});
		deleteActionField.isMandatory = true;
		deleteActionField.addSelectOption({
			value: "",
			text: "-- Select Record Type --",
		});
		// --- Group Options ---
		deleteActionField.addSelectOption({
			value: "all_records",
			text: "All Records",
		});
		deleteActionField.addSelectOption({
			value: "all_entities",
			text: "All Cust/Vend/Emp/Item Records",
		});
		deleteActionField.addSelectOption({
			value: "all_transactions",
			text: "All Transactions (incl. JEs)",
		});
		// --- Individual Options ---
		deleteActionField.addSelectOption({
			value: "customer",
			text: "Customers",
		});
		deleteActionField.addSelectOption({ value: "vendor", text: "Vendors" });
		deleteActionField.addSelectOption({
			value: "employee",
			text: "Employees",
		});
		deleteActionField.addSelectOption({ value: "item", text: "Items" });
		deleteActionField.addSelectOption({ value: "job", text: "Projects" });
		deleteActionField.addSelectOption({
			value: "journalentry",
			text: "Journal Entries",
		});
		deleteActionField.addSelectOption({
			value: "journalentry_sm",
			text: "Date Range Push Journal Entries",
		});
		deleteActionField.addSelectOption({
			value: "invoice",
			text: "Invoices",
		});
		deleteActionField.addSelectOption({
			value: "customerpayment",
			text: "Customer Payments",
		});
		deleteActionField.addSelectOption({
			value: "creditmemo",
			text: "Credit Memos",
		});
		deleteActionField.addSelectOption({
			value: "vendorbill",
			text: "Vendor Bills",
		});
		deleteActionField.addSelectOption({
			value: "vendorpayment",
			text: "Vendor Payments",
		});
		deleteActionField.addSelectOption({
			value: "vendorcredit",
			text: "Vendor Credits",
		});
		deleteActionField.addSelectOption({
			value: "check",
			text: "Checks",
		});
		deleteActionField.addSelectOption({
			value: "deposit",
			text: "Deposits",
		});
		deleteActionField.addSelectOption({
			value: "cashsale",
			text: "Cash Sales",
		});
		deleteActionField.addSelectOption({
			value: "creditcardcharge",
			text: "Credit Card Charges",
		});
		deleteActionField.addSelectOption({
			value: "creditcardrefund",
			text: "Credit Card Refunds",
		});
		deleteActionField.addSelectOption({
			value: "purchaseorder",
			text: "Purchase Orders",
		});
		deleteActionField.addSelectOption({
			value: "cashrefund",
			text: "Cash Refunds",
		});
		deleteActionField.addSelectOption({
			value: "cashexpense",
			text: "Cash Expenses",
		});
		deleteActionField.addSelectOption({
			value: "transfer",
			text: "Transfers",
		});

		// --- Row 3: Delete by Date ---
		form.addFieldGroup({ id: "custpage_grp3", label: " " });
		var deleteModeField = form.addField({
			id: "custpage_deletemode",
			type: serverWidget.FieldType.SELECT,
			label: "Delete by Date",
			container: "custpage_grp3",
		});
		deleteModeField.isMandatory = true;
		deleteModeField.addSelectOption({
			value: "all",
			text: "All Records",
		});
		deleteModeField.addSelectOption({
			value: "trandate",
			text: "Transaction Date Range",
		});
		deleteModeField.addSelectOption({
			value: "createddate",
			text: "Creation Date Range",
		});
		deleteModeField.defaultValue = "createddate";

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
			'<div id="custpage_confirmation_text"></div>';

		form.addSubmitButton({ label: "Delete Records" });
		context.response.writePage(form);
	}

	function handleSubmit(context) {
		var recordType = context.request.parameters.custpage_delete_action;
		var subsidiaryId = context.request.parameters.custpage_subsidiary;
		var pushMode = context.request.parameters.custpage_pushmode;
		var deleteMode = context.request.parameters.custpage_deletemode;
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

		// Validate required fields (skip for chain requests — already validated)
		if (!isChainRequest && (!recordType || !subsidiaryId || !pushMode || !deleteMode)) {
			context.response.write(
				'<h3 style="color: red;">Please select a subsidiary, push mode, record type, and delete by date option.</h3>' +
					'<p><a href="javascript:history.back()">Go Back</a></p>',
			);
			return;
		}

		// Validate Transaction Date To when Transaction Date Range is selected
		if (deleteMode === "trandate" && !tranDateTo) {
			context.response.write(
				'<h3 style="color: red;">Please provide a Transaction Date To.</h3>' +
					'<p><a href="javascript:history.back()">Go Back</a></p>',
			);
			return;
		}

		// Validate Creation Date To when Creation Date Range is selected
		if (deleteMode === "createddate" && !createdDateTo) {
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
		var effectiveMode = deleteMode;
		if (
			deleteMode === "trandate" &&
			!isCurrentTransaction &&
			isChainRequest
		) {
			// Entity type in a chain — skip trandate, use createddate instead
			effectiveMode = "createddate";
		}

		try {
			var scriptTask = task.create({
				taskType: task.TaskType.MAP_REDUCE,
			});
			scriptTask.scriptId = "customscript_delete1";
			scriptTask.deploymentId = "customdeploy_delete2";

			var params = {
				custscript_recordtype: currentType,
				custscript_subsidiary: subsidiaryId,
				custscript_pushmode: pushMode,
			};

			// Pass date params based on effective mode
			if (effectiveMode === "trandate") {
				if (tranDateFrom) {
					params.custscript_trandatefrom = tranDateFrom;
				}
				params.custscript_trandateto = tranDateTo;
			} else if (effectiveMode === "createddate") {
				if (createdDateFrom) {
					params.custscript_createddatefrom = createdDateFrom;
				}
				params.custscript_createddateto = createdDateTo;
			}

			scriptTask.params = params;

			var taskId = scriptTask.submit();
			log.audit(
				"Task Submitted",
				"Task ID: " +
					taskId +
					", Mode: " +
					deleteMode +
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
					deleteMode: deleteMode,
					pushMode: pushMode,
					subsidiaryId: subsidiaryId,
					tranDateFrom: tranDateFrom || "",
					tranDateTo: tranDateTo || "",
					createdDateFrom: createdDateFrom || "",
					createdDateTo: createdDateTo || "",
				};
			}

			renderProgressPage(context, taskId, currentType, chainInfo);
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

			context.response.write(
				JSON.stringify({
					status: taskStatus.status,
					percentComplete: percentComplete,
				}),
			);
		} catch (e) {
			context.response.write(
				JSON.stringify({ error: e.message, status: "UNKNOWN" }),
			);
		}
	}

	function renderProgressPage(context, taskId, recordType, chainInfo) {
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

			// Completed types
			for (var c = 0; c < completedArr.length; c++) {
				if (completedArr[c]) {
					typeListHtml +=
						'<div class="type-item type-done">' +
						(RECORD_LABELS[completedArr[c]] || completedArr[c]) +
						' <span class="type-badge badge-done">Completed</span></div>';
				}
			}
			// Current type
			typeListHtml +=
				'<div class="type-item type-current">' +
				recordLabel +
				' <span class="type-badge badge-current">Processing</span></div>';
			// Remaining types
			for (var r = 0; r < remainingArr.length; r++) {
				if (remainingArr[r]) {
					typeListHtml +=
						'<div class="type-item type-pending">' +
						(RECORD_LABELS[remainingArr[r]] || remainingArr[r]) +
						' <span class="type-badge badge-pending">Pending</span></div>';
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
				'<input type="hidden" name="custpage_delete_action" value="' +
				nextType +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_subsidiary" value="' +
				chainInfo.subsidiaryId +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_pushmode" value="' +
				chainInfo.pushMode +
				'">';
			chainFormHtml +=
				'<input type="hidden" name="custpage_deletemode" value="' +
				chainInfo.deleteMode +
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
			".chain-progress { margin: 20px 0; padding: 15px; background: #fafafa; border-radius: 6px; border: 1px solid #e0e0e0; }" +
			".chain-progress h3 { margin: 0 0 12px 0; font-size: 14px; color: #555; }" +
			".type-list { display: flex; flex-direction: column; gap: 6px; }" +
			".type-item { padding: 8px 12px; border-radius: 4px; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }" +
			".type-done { background: #e8f5e9; color: #2e7d32; }" +
			".type-current { background: #e3f2fd; color: #1565c0; font-weight: bold; }" +
			".type-pending { background: #f5f5f5; color: #999; }" +
			".type-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }" +
			".badge-done { background: #c8e6c9; color: #2e7d32; }" +
			".badge-current { background: #bbdefb; color: #1565c0; }" +
			".badge-pending { background: #e0e0e0; color: #999; }" +
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
			"      var percent = Math.round(data.percentComplete || 0);" +
			'      if (data.status === "PENDING") {' +
			'        statusBox.className = "status status-starting";' +
			'        statusBox.textContent = "Starting...";' +
			'        progressText.textContent = "0%";' +
			'      } else if (data.status === "PROCESSING") {' +
			'        statusBox.className = "status status-progress";' +
			'        statusBox.textContent = "In Progress...";' +
			"        if (percent > maxPercent) { maxPercent = percent; }" +
			"        if (maxPercent >= 100) { maxPercent = 95; }" +
			'        progressFill.style.width = maxPercent + "%";' +
			'        progressText.textContent = maxPercent + "%";' +
			'      } else if (data.status === "COMPLETE") {' +
			'        statusBox.className = "status status-complete";' +
			'        progressFill.style.width = "100%";' +
			'        progressText.textContent = "100%";' +
			"        isComplete = true;" +
			"        clearInterval(refreshInterval);" +
			"        if (hasChainRemaining) {" +
			'          statusBox.textContent = "Completed — submitting next type...";' +
			'          noteText.textContent = "Moving to next record type...";' +
			"          setTimeout(function() {" +
			'            document.getElementById("chainForm").submit();' +
			"          }, 1500);" +
			"        } else {" +
			'          statusBox.textContent = "Completed";' +
			'          backBtn.className = "btn";' +
			'          noteText.textContent = "Done. You can now start a new deletion.";' +
			"          var curItem = document.querySelector('.type-current');" +
			"          if (curItem) {" +
			"            curItem.className = 'type-item type-done';" +
			"            var badge = curItem.querySelector('.type-badge');" +
			"            if (badge) { badge.className = 'type-badge badge-done'; badge.textContent = 'Completed'; }" +
			"          }" +
			"          if (isChain) {" +
			'            document.getElementById("titleText").textContent = "All Records Deleted";' +
			'            document.getElementById("subtitleText").textContent = "All " + chainTotal + " record types processed successfully";' +
			'            var cpt = document.getElementById("chainProgressTitle");' +
			'            if (cpt) { cpt.textContent = "All " + chainTotal + " of " + chainTotal + " Completed"; }' +
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
			"refreshInterval = setInterval(checkStatus, 2000);" +
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
