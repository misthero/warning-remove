/* list of default strings to remove */
let defaultStrings = [
	"Foundry Virtual Tabletop requires",
	"not displayed because the game Canvas is disabled",
	"is unmaintained and may introduce stability issues"
];

let removeStrings = []

// CONFIG.debug.hooks = true

const W_R_ID = 'warning-remove';

Hooks.on('init', () => {
	game.settings.register(W_R_ID, 'qty', {
		name: 'Number of messages to remove',
		hint: 'default: 3',
		scope: 'client',
		requiresReload: true,
		default: '3',
		type: Number,
		config: true
	});

	const qty = game.settings.get(W_R_ID, 'qty');
	for (let s = 0; s < (qty); s++) {
		let defaultString = "Enter a long Exact message";
		switch (s) {
			case 0:
				defaultString = defaultStrings[0];
				break;
			case 1:
				defaultString = defaultStrings[1];
				break;
			case 2:
				defaultString = defaultStrings[2];
				break;
		}

		game.settings.register(W_R_ID, 'string_' + s, {
			name: 'Message to remove #' + (s + 1),
			hint: 'Enter the text or part of the text in the message you want to remove, try to enter as much text is possible to avoid removing useful messages. The text must be case sensitive',
			scope: 'client',
			requiresReload: true,
			default: defaultString,
			type: String,
			config: true
		});

		let savedString = game.settings.get(W_R_ID, 'string_' + s);
		if (savedString && savedString.length > 0) {
			removeStrings.push(game.settings.get(W_R_ID, 'string_' + s));
		}
	}

	// get the final string array
	removeStrings = foundry.utils.mergeObject(defaultStrings, removeStrings);

	// reset module
	game.settings.register(W_R_ID, "resetModule", {
		name: "Reset default options",
		hint: "Select 'Reset' and save to go back to the module original settings.",
		scope: "client",
		config: true,
		requiresReload: false,
		type: String,
		choices: {
			"a": "No",
			"b": "Reset"
		},
		default: "a",
		onChange: value => {
			if (value == 'a') {
				return;
			}
			const clientStorage = game.settings.storage.get("client");
			const worldStorage = game.settings.storage.get("world");
			for (const clientKey of Object.keys(clientStorage)) {
				if (clientKey.startsWith(W_R_ID)) clientStorage.removeItem(clientKey);
			}
			for (const worldSetting of worldStorage) {
				if (worldSetting.key.startsWith(W_R_ID)) worldSetting.delete();
			}
			window.location.reload();
		}
	});

});

/**
 * This function initializes a Proxy to intercept changes to the `ui.notifications.queue` array.
 * It accepts an array of strings to match against any notification that would be added to the queue.
 * If a notification matches, the Proxy will modify it to prevent it from logging anything to the
 *  console, and to hide it in the UI.
 *
 * This function should be run during the "ready" Hook call.
 */
Hooks.once("canvasReady", () => {
	removeWarnings(removeStrings);
});

removeWarnings = (removeStrings) => {
	if (!ui.notifications) {
		console.error("ui.notifications is not initialized. Skipping notification interception.");
		return;
	}

	// List of patterns to block
	const patternsToBlock = removeStrings;

	console.log("Patterns to block:", removeStrings);

	// Convert patterns to regular expressions
	const regExpPatterns = patternsToBlock.map(pattern => new RegExp(pattern, "i"));

	// Save the original notify method
	const originalNotify = ui.notifications.notify;

	// Override the notify method
	ui.notifications.notify = function (message, type = "info", opts = {}) {
		// Shallow-copy options so we don't mutate the caller's object
		const options = foundry.utils.mergeObject({ localize: false, escape: true, clean: true, format: null }, opts, { inplace: false });

		// 1) Normalize to string (or Error.message)
		let text = message instanceof Error ? message.message : String(message);

		// 2) Apply formatting placeholders if present
		if (options.format) {
			if (options.escape) {
				for (let k of Object.keys(options.format)) {
					if (typeof foundry.utils.escapeHTML === "function") {
						options.format[k] = foundry.utils.escapeHTML(options.format[k]);
					}
				}
				// If it’s a real localization key, no extra cleaning
				if (game.i18n.has(text)) options.clean = false;
			}
			text = game.i18n.format(text, options.format);
		}
		// 3) Otherwise localize if requested
		else if (options.localize) {
			if (game.i18n.has(text)) options.clean = false;
			text = game.i18n.localize(text);
		}
		// 4) Finally clean HTML if still flagged
		if (typeof foundry.utils.cleanHTML === "function") {
			if (options.clean) text = foundry.utils.cleanHTML(text);
		}

		// Check if the message matches any of the patterns
		if (regExpPatterns.some(pattern => pattern.test(text))) {
			console.warn(`Blocked notification [${type}]: ${text}`);
			return; // Prevent the notification from being displayed
		}

		// Call the original notify method for non-blocked messages
		return originalNotify.call(this, message, type, options);
	};

	console.log("Notification interception initialized.");
}