/**
 * A wrapper around LocalStorage to support environments where LocalStorage is not available.
 * Stores and retrieves items from LocalStorage if available and uses a non-persistent cache otherwise.
 */
var storage = {};
try {
    storage.getItem = localStorage.getItem;
    storage.setItem = localStorage.setItem;
} catch (e) { /* Ignore Exception, use fallback implementation. */ }

if (!storage) {
    var cache = Object.create(null);
    storage.getItem = function (key) { return cache[key] || null; };
    storage.setItem = function (key, value) { cache[key] = value; };
}

module.export = storage;
