/* list of default strings to remove */
let defaultStrings = [
	"Foundry Virtual Tabletop requires a minimum screen resolution",
	"not displayed because the game Canvas is disabled",
	"is unmaintained and may introduce stability issues"
];

let removeStrings = []

const W_R_ID = 'warning-remove';

Hooks.on('ready', () => {
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
			hint: 'Enter the text or part of the text in the message you want to remove, try to enter as much text is possible to avoid removing useful messages. The text must be chase sensitive',
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
function InitNotificationsProxy(patternsToHide = []) {
	// Do nothing if no patterns are provided.
	if (!patternsToHide.length) { return; }

	// Get the original array of queued notifications, and store a constant reference to it
	const notificationQueue = ui.notifications.queue;

	// Convert the provided patterns into regular expressions
	const regExpPatterns = patternsToHide.map((pattern) => new RegExp(pattern));

	// Define a handler for the proxy that will be used to intercept notifications
	const handler = {
		set: function (target, property, value) {
			// Handle changes to the array length property
			if (property === "length") {
				// Perform the default behavior for length changes
				target.length = value;
				return true; // Indicate success
			}
			// Handle directly setting the value for non-index properties (necessary for array methods like 'next')
			else if (typeof property === "string" && isNaN(Number(property))) {
				// Perform the default behavior for non-index properties.
				target[property] = value;
				return true; // Indicate success
			}
			// Handle setting array indices
			else if (!isNaN(Number(property))) {
				// If the value is a notification and its content matches one of the provided patterns ...
				if (value
					&& typeof value === "object"
					&& "message" in value
					&& typeof value.message === "string"
					&& regExpPatterns.some((pattern) => pattern.exec(value.message))) {
					// ... edit the notification to:
					Object.assign(value, {
						console: false, // ... prevent logging it to the console
						permanent: false, // ... ensure the notification element is removed automatically
						type: "do-not-display" // ... 'hack' the type to add the 'do-not-display' class
					});
				}
				// Otherwise, perform the default behavior for setting index properties.
				target[Number(property)] = value;
				return true; // Indicate success
			}
			return false; // Indicate failure for all other cases
		}
	};

	// Replace the notifications queue array with a Proxy defined by the above handler.
	ui.notifications.queue = new Proxy(notificationQueue, handler);
}
// Initialize the notifications proxy during the 'ready' hook, after ui.notifications has been defined
Hooks.once("ready", () => {
	// I've hard-coded the two notifications I want to hide, but this could easily be a
	//   user setting, allowing users to customize which notifications are silenced.
	InitNotificationsProxy(removeStrings);
});