/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @version v1.0
 *
 * Name: SuiteMigration Admin Toolkit
 * Description: Automated bulk cleanup and data reset utility for NetSuite Admins & Consultants.
 * Publisher: SuiteMigration (https://suitemigration.com)
 * License: SuiteMigration Free Utility License
 *          https://github.com/Uranus-io/suitemigration-admin-toolkit/blob/main/LICENSE
 *
 * Copyright (c) 2026 SuiteMigration. All rights reserved.
 * Provided "AS IS" without warranty of any kind.
 *
 * Map/Reduce script to delete records by subsidiary.
 * Handles subcustomers, contacts, and entity relationships before deletion.
 *
 * Performance Optimizations:
 * - Uses Reduce phase for deletion (5,000 governance units per invocation)
 * - Parallel processing in Reduce phase
 * - Map phase only collects and emits data (minimal governance usage)
 *
 * Required IDs (must match exactly):
 * - Script ID: customscript_sm_toolkit_delete_mr
 * - Deployment ID: customdeploy_sm_toolkit_delete_mr
 * - Parameters: custscript_sm_recordtype, custscript_sm_subsidiary,
 *   custscript_sm_externalid, custscript_sm_trandate_from, custscript_sm_trandate_to,
 *   custscript_sm_createddate_from, custscript_sm_createddate_to
 *
 * Date filtering:
 * - Transaction Date (trandate): Only applies to transaction record types.
 *   Ignored for entities (customer, vendor) and items.
 * - Creation Date (datecreated/created): Applies to all record types.
 *   Uses "datecreated" for entities, "created" for items.
 * - Both date ranges are optional. When both are provided, AND logic is used.
 * - When no dates are provided, all records for the subsidiary are selected.
 *
 * See DEPLOYMENT_GUIDE.md for full setup instructions.
 */
define(["N/search", "N/record", "N/runtime", "N/log", "N/cache"], function (
	search,
	record,
	runtime,
	log,
	cache,
) {
	// Cache used to hand the final deleted/failed counts back to the Suitelet
	// for on-screen display. Shared (PUBLIC) so the Suitelet can read it.
	var RESULT_CACHE_NAME = "smAdminToolkit";
	var RESULT_CACHE_KEY = "lastDeleteResult";
	/**
	 * Transaction record types — these support "trandate" filtering.
	 * Entity types (customer, vendor) and items do NOT have trandate.
	 */
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

	function getInputData() {
		var scriptObj = runtime.getCurrentScript();
		var recordType = scriptObj.getParameter({
			name: "custscript_sm_recordtype",
		});
		var subsidiaryId = scriptObj.getParameter({
			name: "custscript_sm_subsidiary",
		});
		var externalIdMode = scriptObj.getParameter({
			name: "custscript_sm_externalid",
		});
		var tranDateFrom = scriptObj.getParameter({
			name: "custscript_sm_trandate_from",
		});
		var tranDateTo = scriptObj.getParameter({
			name: "custscript_sm_trandate_to",
		});
		var createdDateFrom = scriptObj.getParameter({
			name: "custscript_sm_createddate_from",
		});
		var createdDateTo = scriptObj.getParameter({
			name: "custscript_sm_createddate_to",
		});

		if (!recordType || !subsidiaryId) {
			throw new Error(
				"Missing required parameters: record type or subsidiary",
			);
		}

		// Some types share a NetSuite record type but use externalid filters to distinguish
		var isSmJE = recordType === "journalentry_sm";
		var isCashExpense = recordType === "cashexpense";
		var isTransfer = recordType === "transfer";
		var actualRecordType = recordType;
		if (isSmJE || isTransfer) {
			actualRecordType = "journalentry";
		} else if (isCashExpense) {
			actualRecordType = "check";
		}

		var isTransaction = TRANSACTION_TYPES.indexOf(recordType) !== -1;
		var isItem = recordType === "item";

		log.audit(
			"getInputData",
			"Record Type: " +
				recordType +
				", Subsidiary: " +
				subsidiaryId +
				", External ID: " +
				(externalIdMode || "N/A") +
				", Is Transaction: " +
				isTransaction +
				", Tran Date: " +
				(tranDateFrom || "N/A") +
				" to " +
				(tranDateTo || "N/A") +
				", Created Date: " +
				(createdDateFrom || "N/A") +
				" to " +
				(createdDateTo || "N/A"),
		);

		// Build filters — always filter by subsidiary
		var filters = [["subsidiary", "anyof", subsidiaryId]];

		// Transaction Date filter — only applies to transaction record types
		if (isTransaction && tranDateTo) {
			filters.push("AND");
			if (tranDateFrom) {
				filters.push(["trandate", "within", tranDateFrom, tranDateTo]);
			} else {
				filters.push(["trandate", "onorbefore", tranDateTo]);
			}
		}

		// Creation Date filter — applies to all record types
		// Uses "datecreated" for entities, "created" for items
		if (createdDateTo) {
			var createdField = isItem ? "created" : "datecreated";
			filters.push("AND");
			if (createdDateFrom) {
				filters.push([
					createdField,
					"within",
					createdDateFrom,
					createdDateTo,
				]);
			} else {
				filters.push([createdField, "onorbefore", createdDateTo]);
			}
		}

		// SuiteMigration Trial Balance push journal entries carry externalid
		// substrings sm_net / sm_rebuild / sm_manual. Direct "contains" is not
		// supported on the externalid search field, so we use an Oracle LIKE
		// expression via formulatext instead.
		// Include only these records when deleting Trial Balance push JEs;
		// exclude them when deleting regular journal entries.
		if (isSmJE) {
			filters.push("AND");
			filters.push([
				"formulatext: CASE WHEN ({externalid} LIKE '%sm_net%' OR {externalid} LIKE '%sm_rebuild%' OR {externalid} LIKE '%sm_manual%') THEN '1' ELSE '0' END",
				"is",
				"1",
			]);
		} else if (recordType === "journalentry") {
			filters.push("AND");
			filters.push([
				"formulatext: CASE WHEN ({externalid} LIKE '%sm_net%' OR {externalid} LIKE '%sm_rebuild%' OR {externalid} LIKE '%sm_manual%') THEN '0' ELSE '1' END",
				"is",
				"1",
			]);
		}

		// Cash Expenses are pushed as checks with externalid suffix "__cex_chk".
		// Include only cex_chk_ records when deleting cash expenses;
		// exclude them when deleting regular checks.
		if (isCashExpense) {
			filters.push("AND");
			filters.push([
				"formulatext: CASE WHEN {externalid} LIKE '%__cex_chk' THEN '1' ELSE '0' END",
				"is",
				"1",
			]);
		} else if (recordType === "check") {
			filters.push("AND");
			filters.push([
				"formulatext: CASE WHEN {externalid} LIKE '%__cex_chk' THEN '0' ELSE '1' END",
				"is",
				"1",
			]);
		}

		// Transfers are pushed as journal entries with externalid suffix "__trf_jrn".
		// Include only trf_jrn_ records when deleting transfers;
		// exclude them when deleting regular journal entries.
		if (isTransfer) {
			filters.push("AND");
			filters.push([
				"formulatext: CASE WHEN {externalid} LIKE '%__trf_jrn' THEN '1' ELSE '0' END",
				"is",
				"1",
			]);
		} else if (recordType === "journalentry") {
			filters.push("AND");
			filters.push([
				"formulatext: CASE WHEN {externalid} LIKE '%__trf_jrn' THEN '0' ELSE '1' END",
				"is",
				"1",
			]);
		}

		// External ID filter. Values sent by the Suitelet:
		//   "all"       -> no filter (records with or without an External ID)
		//   "populated" -> records that HAVE any External ID (not blank)
		//   "blank"     -> records with NO External ID
		//   "sm_match"  -> External ID matches the SuiteMigration format
		//                  ({org_id}__{source_id}__{prefix}_{id} with prefixes
		//                  cmp_/txn_/itm_, plus JE-specific sm_net/sm_rebuild/sm_manual).
		//                  If a new record type prefix is added to SM, update this list.
		if (externalIdMode === "sm_match") {
			filters.push("AND");
			filters.push([
				"formulatext: CASE WHEN REGEXP_LIKE({externalid}, '.+__.+__(cmp|txn|itm)_') OR {externalid} LIKE 'sm_net%' OR {externalid} LIKE 'sm_rebuild%' OR {externalid} LIKE 'sm_manual%' THEN '1' ELSE '0' END",
				"is",
				"1",
			]);
		} else if (externalIdMode === "populated") {
			filters.push("AND");
			filters.push([
				"formulatext: CASE WHEN {externalid} IS NOT NULL THEN '1' ELSE '0' END",
				"is",
				"1",
			]);
		} else if (externalIdMode === "blank") {
			filters.push("AND");
			filters.push([
				"formulatext: CASE WHEN {externalid} IS NULL THEN '1' ELSE '0' END",
				"is",
				"1",
			]);
		}

		var columns = isItem ? ["internalid", "type"] : ["internalid"];

		return search.create({
			type: isItem ? "item" : actualRecordType,
			filters: filters,
			columns: columns,
		});
	}

	/**
	 * Map phase - ONLY collects data and emits to reduce
	 * Minimal processing here to save governance for reduce phase
	 */
	function map(context) {
		var result = JSON.parse(context.value);
		var recordId = result.id;
		var recordType = result.recordType;

		if (!recordType || !recordId) {
			return;
		}

		var actualRecordType = recordType;

		// Handle item types
		if (recordType === "item") {
			var itemType = result.values.type;
			var itemTypeValue =
				typeof itemType === "object" ? itemType.value : itemType;
			var itemTypeMap = {
				InvtPart: record.Type.INVENTORY_ITEM,
				NonInvtPart: record.Type.NON_INVENTORY_ITEM,
				Service: record.Type.SERVICE_ITEM,
				Assembly: record.Type.ASSEMBLY_ITEM,
				Kit: record.Type.KIT_ITEM,
				Group: record.Type.ITEM_GROUP,
			};

			actualRecordType = itemTypeMap[itemTypeValue] || null;
			if (!actualRecordType) {
				return;
			}
		}

		// Emit each record to reduce phase with unique key for parallel processing
		context.write({
			key: recordId,
			value: JSON.stringify({
				id: recordId,
				type: actualRecordType,
			}),
		});
	}

	/**
	 * Reduce phase - DOES THE ACTUAL DELETION
	 * Each reduce invocation gets 5,000 governance units
	 * Runs in parallel for better performance
	 */
	function reduce(context) {
		var key = context.key;
		var values = context.values;

		if (!values || values.length === 0) {
			return;
		}

		var data = JSON.parse(values[0]);
		var recordId = data.id;
		var recordType = data.type;

		var deletedCount = 0;
		var failedCount = 0;

		try {
			if (recordType === "customer") {
				// Step 1: Collect ALL descendants first (children, grandchildren, etc.)
				var allDescendants = collectAllDescendants(recordId);

				// Step 2: Delete from deepest level up (grandchildren first, then children)
				for (var i = allDescendants.length - 1; i >= 0; i--) {
					var descendantId = allDescendants[i];
					var result = deleteCustomerSafely(descendantId);
					if (result) {
						deletedCount++;
					} else {
						failedCount++;
					}
				}

				// Step 3: Delete contacts for main customer
				deleteLinkedRecords("contact", "company", recordId);

				// Step 4: Clear relationships for main customer
				clearCustomerRelationships(recordId);
			}

			// Delete the main record
			record.delete({ type: recordType, id: recordId });
			deletedCount++;

			context.write({
				key: "result",
				value: JSON.stringify({
					deleted: deletedCount,
					failed: failedCount,
				}),
			});
		} catch (error) {
			log.error(
				"Delete Failed",
				"ID: " + recordId + ", Error: " + error.message,
			);
			failedCount++;
			context.write({
				key: "result",
				value: JSON.stringify({
					deleted: deletedCount,
					failed: failedCount,
				}),
			});
		}
	}

	/**
	 * Collect ALL descendants of a customer (children, grandchildren, great-grandchildren, etc.)
	 * Returns array of IDs ordered by hierarchy level (parents before children)
	 */
	function collectAllDescendants(customerId) {
		var allDescendants = [];
		var queue = [customerId];
		var visited = {};
		visited[customerId] = true;

		while (queue.length > 0) {
			var currentId = queue.shift();

			try {
				var childSearch = search.create({
					type: "customer",
					filters: [["parent", "anyof", currentId]],
					columns: ["internalid"],
				});

				childSearch.run().each(function (result) {
					var childId = result.getValue("internalid");
					if (!visited[childId]) {
						visited[childId] = true;
						allDescendants.push(childId);
						queue.push(childId);
					}
					return true;
				});
			} catch (e) {
				// Continue if search fails
			}
		}

		return allDescendants;
	}

	/**
	 * Safely delete a customer - handles contacts and relationships first
	 * Returns true if deleted, false if failed
	 */
	function deleteCustomerSafely(customerId) {
		try {
			// Delete contacts first
			deleteLinkedRecords("contact", "company", customerId);

			// Clear relationships
			clearCustomerRelationships(customerId);

			// Delete the customer
			record.delete({ type: "customer", id: customerId });
			return true;
		} catch (e) {
			log.error(
				"Failed to delete subcustomer",
				"ID: " + customerId + ", Error: " + e.message,
			);
			return false;
		}
	}

	/**
	 * Clear vendor/employee/subsidiary relationships that block deletion
	 */
	function clearCustomerRelationships(customerId) {
		try {
			var custRec = record.load({
				type: record.Type.CUSTOMER,
				id: customerId,
				isDynamic: true,
			});

			var needsSave = false;

			if (custRec.getValue({ fieldId: "representingsubsidiary" })) {
				custRec.setValue({
					fieldId: "representingsubsidiary",
					value: "",
				});
				needsSave = true;
			}
			if (custRec.getValue({ fieldId: "isvendor" })) {
				custRec.setValue({ fieldId: "isvendor", value: false });
				needsSave = true;
			}
			if (custRec.getValue({ fieldId: "isemployee" })) {
				custRec.setValue({ fieldId: "isemployee", value: false });
				needsSave = true;
			}

			if (needsSave) {
				custRec.save({ ignoreMandatoryFields: true });
			}
		} catch (e) {
			// Continue even if clearing relationships fails
		}
	}

	/**
	 * Delete all records linked to a parent entity
	 */
	function deleteLinkedRecords(recordType, fieldId, parentId) {
		try {
			var linkedSearch = search.create({
				type: recordType,
				filters: [[fieldId, "anyof", parentId]],
				columns: ["internalid"],
			});

			linkedSearch.run().each(function (result) {
				try {
					var id = result.getValue("internalid");
					record.delete({ type: recordType, id: id });
				} catch (e) {
					// Continue with next record
				}
				return true;
			});
		} catch (e) {
			// Continue if search fails
		}
	}

	function summarize(summary) {
		var totalDeleted = 0;
		var totalFailed = 0;

		summary.output.iterator().each(function (key, value) {
			if (key === "result") {
				try {
					var data = JSON.parse(value);
					totalDeleted += data.deleted || 0;
					totalFailed += data.failed || 0;
				} catch (e) {
					// Skip invalid data
				}
			}
			return true;
		});

		summary.mapSummary.errors.iterator().each(function (key, error) {
			log.error("Map Error", error);
			return true;
		});

		summary.reduceSummary.errors.iterator().each(function (key, error) {
			log.error("Reduce Error", error);
			return true;
		});

		log.audit(
			"Summary",
			"Deleted: " + totalDeleted + ", Failed: " + totalFailed,
		);

		// Publish the counts so the Suitelet can display them on completion.
		// Best-effort: if the cache write fails, the UI simply falls back to
		// "see log for counts" — it never affects the deletion itself.
		try {
			var resultCache = cache.getCache({
				name: RESULT_CACHE_NAME,
				scope: cache.Scope.PUBLIC,
			});
			resultCache.put({
				key: RESULT_CACHE_KEY,
				value: JSON.stringify({
					deleted: totalDeleted,
					failed: totalFailed,
				}),
				ttl: 3600,
			});
		} catch (e) {
			log.error("Result cache write failed", e);
		}
	}

	return {
		getInputData: getInputData,
		map: map,
		reduce: reduce,
		summarize: summarize,
	};
});
